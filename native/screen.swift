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

// ---------- controls, through Accessibility ----------
//
// Looking at a picture to find a button costs a model turn per step. The
// Accessibility tree already has the button, with its name and its place, so
// `controls` lists what can be pressed in the window on top and `press`
// presses one of them — no picture, no coordinates guessed from pixels.

/** The app whose window is on top, leaving Hippocampus out: the window list is front to back. */
func appOnTop(named: String?) -> NSRunningApplication? {
    let apps = NSWorkspace.shared.runningApplications
    if let named, !named.isEmpty {
        let wanted = named.lowercased()
        return apps.first { ($0.localizedName ?? "").lowercased() == wanted }
            ?? apps.first { ($0.localizedName ?? "").lowercased().contains(wanted) && $0.activationPolicy == .regular }
    }
    let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
    for window in windows {
        guard (window[kCGWindowLayer as String] as? Int) == 0,
              let pid = window[kCGWindowOwnerPID as String] as? pid_t,
              let app = NSRunningApplication(processIdentifier: pid),
              !(app.bundleIdentifier ?? "").hasPrefix("com.hippocampus") else { continue }
        return app
    }
    return nil
}

func attribute(_ element: AXUIElement, _ name: String) -> AnyObject? {
    var value: AnyObject?
    return AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success ? value : nil
}

func text(_ element: AXUIElement, _ name: String) -> String? {
    guard let value = attribute(element, name) as? String else { return nil }
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : String(trimmed.prefix(90))
}

func frame(_ element: AXUIElement) -> CGRect? {
    guard let position = attribute(element, kAXPositionAttribute), let size = attribute(element, kAXSizeAttribute) else { return nil }
    var point = CGPoint.zero, extent = CGSize.zero
    AXValueGetValue(position as! AXValue, .cgPoint, &point)
    AXValueGetValue(size as! AXValue, .cgSize, &extent)
    return CGRect(origin: point, size: extent)
}

func actions(_ element: AXUIElement) -> [String] {
    var names: CFArray?
    return AXUIElementCopyActionNames(element, &names) == .success ? (names as? [String] ?? []) : []
}

func children(_ element: AXUIElement) -> [AXUIElement] {
    attribute(element, kAXChildrenAttribute) as? [AXUIElement] ?? []
}

let PRESSABLE: Set<String> = [
    "AXButton", "AXLink", "AXMenuItem", "AXMenuButton", "AXMenuBarItem", "AXCheckBox", "AXRadioButton",
    "AXPopUpButton", "AXTab", "AXRow", "AXCell", "AXDisclosureTriangle", "AXTextField", "AXComboBox",
    "AXSearchField", "AXSegment",
]

/** A row names itself by the text inside it; a button by its own title or description. */
func label(_ element: AXUIElement, role: String) -> String? {
    if let own = text(element, kAXTitleAttribute) ?? text(element, kAXDescriptionAttribute) { return own }
    if let value = text(element, kAXValueAttribute), role != "AXTextField" { return value }
    var parts: [String] = []
    var queue = children(element)
    var seen = 0
    while !queue.isEmpty && parts.count < 4 && seen < 40 {
        let next = queue.removeFirst(); seen += 1
        if let words = text(next, kAXValueAttribute) ?? text(next, kAXTitleAttribute) ?? text(next, kAXDescriptionAttribute) {
            parts.append(words)
        } else {
            queue.append(contentsOf: children(next))
        }
    }
    if !parts.isEmpty { return parts.joined(separator: " · ") }
    return text(element, kAXHelpAttribute) ?? text(element, kAXPlaceholderValueAttribute)
}

/** The window controls are read from: the focused one, or the first. */
func mainWindow(_ app: AXUIElement) -> AXUIElement? {
    if let focused = attribute(app, kAXFocusedWindowAttribute) { return (focused as! AXUIElement) }
    return (attribute(app, kAXWindowsAttribute) as? [AXUIElement])?.first
}

func requireAccessibility() {
    let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
    guard AXIsProcessTrustedWithOptions(options) else { fail(4, "no accessibility permission") }
}

if args.count > 1 && args[1] == "controls" {
    requireAccessibility()
    guard let running = appOnTop(named: value("--app", "")) else { fail(5, "no app on top") }
    let app = AXUIElementCreateApplication(running.processIdentifier)
    // Chromium-based apps (Electron, CEF: Slack, Spotify, VS Code) build their
    // tree only when an assistive app asks for it; this is how one asks.
    AXUIElementSetAttributeValue(app, "AXManualAccessibility" as CFString, kCFBooleanTrue)
    guard let window = mainWindow(app) else { fail(5, "no window for \(running.localizedName ?? "the app")") }
    // With --text, what the window says comes along too — a result on a
    // display, a status line — so a task can end by reading its answer.
    let withText = args.contains("--text")
    let started = Date()
    var found: [[String: Any]] = []
    var stack: [(AXUIElement, String, Int)] = [(window, "", 0)]
    var visited = 0
    while let (element, path, depth) = stack.popLast(), visited < 6000, found.count < 400,
          Date().timeIntervalSince(started) < 2.5 {
        visited += 1
        let role = text(element, kAXRoleAttribute) ?? ""
        let pressable = PRESSABLE.contains(role) || actions(element).contains(kAXPressAction as String)
        let readable = withText && !pressable && role == "AXStaticText"
        if pressable || readable, !path.isEmpty, let box = frame(element), box.width > 1, box.height > 1,
           let name = readable ? (text(element, kAXValueAttribute) ?? text(element, kAXTitleAttribute)) : label(element, role: role) {
            found.append(["path": path, "role": role, "label": name,
                          "x": box.midX, "y": box.midY, "width": box.width, "height": box.height])
        }
        if depth < 40 {
            for (index, child) in children(element).enumerated().reversed() {
                stack.append((child, path.isEmpty ? "\(index)" : "\(path).\(index)", depth + 1))
            }
        }
    }
    let payload: [String: Any] = [
        "app": running.localizedName ?? "", "pid": running.processIdentifier,
        "window": text(window, kAXTitleAttribute) ?? "", "controls": found,
        "ms": Int(Date().timeIntervalSince(started) * 1000),
    ]
    FileHandle.standardOutput.write(try! JSONSerialization.data(withJSONObject: payload))
    exit(0)
}

if args.count > 1 && args[1] == "press" {
    requireAccessibility()
    guard let pid = Int32(value("--pid", "")) else { fail(1, "--pid is required") }
    let app = AXUIElementCreateApplication(pid)
    guard var element = mainWindow(app) else { fail(5, "the window is gone") }
    for step in value("--path", "").split(separator: ".") {
        let list = children(element)
        guard let index = Int(step), index < list.count else { fail(6, "the control is gone") }
        element = list[index]
    }
    // The window may have changed between the listing and now: press only
    // what is still the same kind of thing.
    let expected = value("--role", "")
    if !expected.isEmpty, text(element, kAXRoleAttribute) != expected { fail(6, "the control changed") }
    var via = "ax"
    if AXUIElementPerformAction(element, kAXPressAction as CFString) != .success {
        guard let box = frame(element) else { fail(6, "the control has no place on screen") }
        let place = CGPoint(x: box.midX, y: box.midY)
        let source = CGEventSource(stateID: .hidSystemState)
        for type in [CGEventType.mouseMoved, .leftMouseDown, .leftMouseUp] {
            CGEvent(mouseEventSource: source, mouseType: type, mouseCursorPosition: place, mouseButton: .left)?.post(tap: .cghidEventTap)
            usleep(30_000)
        }
        via = "mouse"
    }
    print("{\"pressed\":true,\"via\":\"\(via)\"}")
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
