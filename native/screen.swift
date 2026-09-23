// hippocampus-screen — what is on the screen right now, without Hippocampus in it,
// and, when asked, a click at a place on it.
//
// `screencapture` photographs everything, the app's own windows included, so
// the sphere and the pointer would show up in the picture they are pointing
// at. ScreenCaptureKit can leave a bundle's windows out, and it also says where
// each display sits, which is what turns a pixel in the picture back into a
// place on the screen.
//
// Run by the core, never on its own. Screen Recording is granted to whoever
// is responsible for the process that asks, and the core's is the app, so the
// permission shows up under "Hippocampus".
//
// Prints JSON on stdout. Exit 2: no permission. Exit 3: macOS older than 14.
//
// `hippocampus-screen click --x X --y Y [--double] [--right]` clicks at a
// place in global coordinates. Posting mouse events needs Accessibility, and
// like Screen Recording it is asked for on behalf of the app. Exit 4: no
// Accessibility.

import AppKit
import ApplicationServices
import CoreGraphics
import Foundation
import ImageIO
import ScreenCaptureKit
import UniformTypeIdentifiers

let args = CommandLine.arguments
func value(_ name: String, _ fallback: String) -> String {
    guard let i = args.firstIndex(of: name), i + 1 < args.count else { return fallback }
    return args[i + 1]
}
func fail(_ code: Int32, _ message: String) -> Never {
    FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
    exit(code)
}

if args.count > 1 && args[1] == "click" {
    // Asking with the prompt option is what puts Hippocampus in the list in
    // Settings; without it the grant has nowhere to be given.
    let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
    guard AXIsProcessTrustedWithOptions(options) else { fail(4, "no accessibility permission") }
    guard let x = Double(value("--x", "")), let y = Double(value("--y", "")) else { fail(1, "--x and --y are required") }
    let place = CGPoint(x: x, y: y)
    let right = args.contains("--right")
    let (down, up, button): (CGEventType, CGEventType, CGMouseButton) =
        right ? (.rightMouseDown, .rightMouseUp, .right) : (.leftMouseDown, .leftMouseUp, .left)
    let source = CGEventSource(stateID: .hidSystemState)
    // Moving first: many controls only arm on hover, and a click that arrives
    // without the pointer ever having been there is ignored by them.
    CGEvent(mouseEventSource: source, mouseType: .mouseMoved, mouseCursorPosition: place, mouseButton: button)?.post(tap: .cghidEventTap)
    usleep(60_000)
    let clicks = args.contains("--double") ? 2 : 1
    for n in 1...clicks {
        for type in [down, up] {
            let event = CGEvent(mouseEventSource: source, mouseType: type, mouseCursorPosition: place, mouseButton: button)
            event?.setIntegerValueField(.mouseEventClickState, value: Int64(n))
            event?.post(tap: .cghidEventTap)
            usleep(30_000)
        }
    }
    print("{\"clicked\":true}")
    exit(0)
}

let outDir = URL(fileURLWithPath: value("--out", NSTemporaryDirectory()))
let longest = CGFloat(Double(value("--max", "1568")) ?? 1568)
let excludePrefix = value("--exclude", "com.hippocampus")
let onlyCursor = args.contains("--cursor-only")

guard #available(macOS 14.0, *) else { fail(3, "ScreenCaptureKit screenshots need macOS 14") }

// Asking without the permission would put a dialog in front of someone who
// asked a question; asking once, here, is what makes it show up in Settings.
if !CGPreflightScreenCaptureAccess() {
    CGRequestScreenCaptureAccess()
    fail(2, "no screen recording permission")
}

/// Global coordinates, origin at the top left of the main display — the same
/// space Electron's `screen` module uses, so nothing has to be flipped later.
let cursor = CGEvent(source: nil)?.location ?? .zero

func writeJPEG(_ image: CGImage, to url: URL) -> Bool {
    guard let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.jpeg.identifier as CFString, 1, nil)
    else { return false }
    CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.7] as CFDictionary)
    return CGImageDestinationFinalize(destination)
}

@available(macOS 14.0, *)
func capture() async throws -> [[String: Any]] {
    let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
    let ours = content.windows.filter { $0.owningApplication?.bundleIdentifier.hasPrefix(excludePrefix) ?? false }

    // A number per display that does not change between pictures: the main
    // one first, then left to right. Numbering from the cursor made "screen 1"
    // swap monitors after every click, since a click moves the cursor.
    let numbered = content.displays.sorted { a, b in
        let mainA = CGDisplayIsMain(a.displayID) != 0, mainB = CGDisplayIsMain(b.displayID) != 0
        if mainA != mainB { return mainA }
        return a.frame.minX != b.frame.minX ? a.frame.minX < b.frame.minX : a.frame.minY < b.frame.minY
    }.enumerated().map { (number: $0.offset + 1, display: $0.element) }
    let wanted = onlyCursor
        ? numbered.filter { $0.display.frame.contains(cursor) }.prefix(1).map { $0 }
        : numbered

    var result: [[String: Any]] = []
    for (number, display) in (wanted.isEmpty ? Array(numbered.prefix(1)) : wanted) {
        let frame = display.frame
        let fit = min(1, longest / max(frame.width, frame.height))
        let config = SCStreamConfiguration()
        config.width = Int((frame.width * fit).rounded())
        config.height = Int((frame.height * fit).rounded())
        config.showsCursor = true
        let filter = SCContentFilter(display: display, excludingWindows: ours)
        let image = try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: config)
        let file = outDir.appendingPathComponent("\(number).jpg")
        guard writeJPEG(image, to: file) else { continue }
        result.append([
            "screen": number,
            "of": numbered.count,
            "displayId": display.displayID,
            "main": CGDisplayIsMain(display.displayID) != 0,
            "hasCursor": frame.contains(cursor),
            "frame": ["x": frame.origin.x, "y": frame.origin.y, "width": frame.width, "height": frame.height],
            "pixelWidth": image.width,
            "pixelHeight": image.height,
            "file": file.path,
        ])
    }
    return result
}

let done = DispatchSemaphore(value: 0)
Task {
    do {
        let shots = try await capture()
        let payload: [String: Any] = ["cursor": ["x": cursor.x, "y": cursor.y], "screens": shots]
        let data = try JSONSerialization.data(withJSONObject: payload)
        FileHandle.standardOutput.write(data)
        exit(0)
    } catch {
        // A permission revoked after the preflight surfaces here, as a
        // ScreenCaptureKit error rather than a clean refusal.
        fail(2, "capture failed: \(error.localizedDescription)")
    }
}
done.wait()
