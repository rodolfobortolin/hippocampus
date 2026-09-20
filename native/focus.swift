// hippocampus-focus — samples what is in focus on the Mac and writes NDJSON to stdout.
//
// One line per sample: app, bundle, window title, URL (when it is a browser),
// seconds of idleness and whether the screen is locked. Without the window
// title the sample still goes out — it only loses the detail, which needs
// Accessibility.

import AppKit
import ApplicationServices
import CoreAudio
import CoreGraphics
import Foundation

let args = CommandLine.arguments

/// Where the samples go. Without `--post`, they go to stdout as before.
///
/// The `--post` mode exists because of the TCC: macOS attributes the
/// Accessibility permission to the *responsible process*, which is whoever
/// launched the program. If the Node collector starts it, node is what shows up
/// asking — and authorising node would grant Accessibility to every Node script
/// on the machine. Launched directly by launchd, this helper answers for
/// itself, and the grant stays where it belongs: on this app, and only on it.
let target: URL? = args.firstIndex(of: "--post").flatMap { i in
    i + 1 < args.count ? URL(string: args[i + 1]) : nil
}
let interval = args.firstIndex(of: "--interval").flatMap { i -> Double? in
    i + 1 < args.count ? Double(args[i + 1]) : nil
} ?? 4.0

// --check only queries and exits. It never asks: scripts call it in a loop, and
// asking here would raise a system dialog on every call.
if args.contains("--check") {
    print(AXIsProcessTrusted() ? "trusted" : "untrusted")
    exit(AXIsProcessTrusted() ? 0 : 1)
}

// The prompt only comes from something with its own identity in the TCC: the
// launchd agent (which is what uses --post) or an explicit request. Launched by
// another program, the dialog would go out in the parent's name, which is not
// what anyone means to authorise.
if !AXIsProcessTrusted() && (target != nil || args.contains("--ask")) {
    let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true]
    AXIsProcessTrustedWithOptions(options as CFDictionary)
}

func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else { return nil }
    return value
}

func stringAttribute(_ element: AXUIElement, _ name: String) -> String? {
    guard let value = attribute(element, name) else { return nil }
    if let text = value as? String { return text }
    if CFGetTypeID(value) == AXValueGetTypeID() { return nil }
    return (value as? NSURL)?.absoluteString
}

/// Finds the active tab's URL by walking the window's accessibility tree.
/// Chromium-based browsers expose AXURL on the AXWebArea node.
func findURL(in window: AXUIElement) -> String? {
    var queue: [(AXUIElement, Int)] = [(window, 0)]
    var visited = 0
    while !queue.isEmpty, visited < 400 {
        let (element, depth) = queue.removeFirst()
        visited += 1
        if depth > 8 { continue }
        if let role = stringAttribute(element, kAXRoleAttribute as String), role == "AXWebArea" {
            if let url = stringAttribute(element, "AXURL") { return url }
        }
        if let children = attribute(element, kAXChildrenAttribute as String) as? [AXUIElement] {
            for child in children.prefix(40) { queue.append((child, depth + 1)) }
        }
    }
    return nil
}

let browsers: Set<String> = [
    "com.google.Chrome", "com.apple.Safari", "company.thebrowser.Browser",
    "com.brave.Browser", "com.microsoft.edgemac", "org.mozilla.firefox",
    "com.google.Chrome.canary", "com.vivaldi.Vivaldi",
]

/// Counters accumulated since boot. They need neither Accessibility nor Input
/// Monitoring: it is the same class that already gives idleness.
/// O delta entre amostras mede *engajamento* — ler tem rolagem e zero tecla;
/// writing has keys. This is the signal that was missing to stop depending on
/// the title alone.
func counter(_ kind: CGEventType) -> Int {
    Int(CGEventSource.counterForEventType(.hidSystemState, eventType: kind))
}

/// A media app that is open, if any. It comes from the list of running apps,
/// which costs no permission — unlike asking the player what is playing, which
/// needs Automation and returns the track name.
let MEDIA_APPS: [String: String] = [
    "com.apple.Music": "Music", "com.spotify.client": "Spotify",
    "com.apple.TV": "TV", "org.videolan.vlc": "VLC",
    "com.deezer.deezer-desktop": "Deezer", "com.tidal.desktop": "Tidal",
    "com.soundcloud.desktop": "SoundCloud", "com.apple.Podcasts": "Podcasts",
]

func openMediaApp() -> String? {
    for app in NSWorkspace.shared.runningApplications {
        if let bundle = app.bundleIdentifier, let name = MEDIA_APPS[bundle] { return name }
    }
    return nil
}

/// The wake-word listener holds the microphone the whole time.
///
/// Without knowing that, "microphone in use" would be true forever and call
/// detection would turn to noise — which is exactly what happened the moment
/// the listener was switched on.
func ownListeningIsOn() -> Bool {
    // By its liveness file, not by the application list: the listener is a loop
    // with a recogniser inside, never calls NSApplicationMain, and therefore
    // does not appear as an application to the system.
    let alive = FileManager.default
        .homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Application Support/Hippocampus/listener.alive")
    guard let attributes = try? FileManager.default.attributesOfItem(atPath: alive.path),
          let modifiedAt = attributes[.modificationDate] as? Date
    else { return false }
    return Date().timeIntervalSince(modifiedAt) < 90
}

/// Sites that are a source of music or video. Used to pick, among the open
/// tabs, the one that is probably playing.
/// In two tiers because the browser does not say which tab has audio: with
/// YouTube and a music service open at once, the safe bet is the music.
let MUSIC_SITES = [
    "flowmusic.app", "open.spotify.com", "music.youtube.com", "soundcloud.com",
    "deezer.com", "tidal.com", "music.apple.com", "bandcamp.com",
]
let VIDEO_SITES = ["youtube.com", "twitch.tv", "netflix.com", "vimeo.com"]

/// Asks the app what is playing. Needs the Automation permission.
///
/// Only runs when there is actually sound and the app is open: `osascript`
/// against
/// um app fechado pode travar por minutos, e travar a amostragem por causa de
/// a track name would be a terrible bargain.
func askByAppleScript(_ script: String) -> String? {
    var error: NSDictionary?
    guard let result = NSAppleScript(source: script)?.executeAndReturnError(&error),
          error == nil, let text = result.stringValue, !text.isEmpty
    else { return nil }
    return text
}

func appIsOpen(_ bundle: String) -> Bool {
    NSWorkspace.shared.runningApplications.contains { $0.bundleIdentifier == bundle }
}

/// What is playing: the players first, then the browser tab.
func whatIsPlaying() -> String? {
    if appIsOpen("com.spotify.client"),
       let track = askByAppleScript(
        "tell application \"Spotify\" to if player state is playing "
        + "then return name of current track & \" — \" & artist of current track") {
        return track
    }

    if appIsOpen("com.apple.Music"),
       let track = askByAppleScript(
        "tell application \"Music\" to if player state is playing "
        + "then return name of current track & \" — \" & artist of current track") {
        return track
    }

    // Music in a browser tab, which no player can report. Among the open tabs,
    // one on a media site is the bet.
    for (bundle, name) in [("com.google.Chrome", "Google Chrome"),
                           ("company.thebrowser.Browser", "Arc")] {
        guard appIsOpen(bundle) else { continue }
        // Asking for every title at once glues them into one string with no
        // separator, and there is no telling which title belongs to which
        // address. So the search happens inside the AppleScript itself, tab by tab.
        for list in [MUSIC_SITES, VIDEO_SITES] {
            let conditions = list.map { "(u contains \"\($0)\")" }.joined(separator: " or ")
            let script = """
            tell application "\(name)"
              repeat with j in windows
                repeat with a in tabs of j
                  set u to URL of a
                  if \(conditions) then return title of a
                end repeat
              end repeat
            end tell
            """
            if let title = askByAppleScript(script) { return title }
        }
    }
    return nil
}

/// Is any audio OUTPUT playing right now?
///
/// On its own this does not prove music: a headset open for a call lights it
/// up too, and so does a system sound. Crossed with an open media app and with
/// the absence
/// de microfone em uso, vira um sinal decente de "estava ouvindo algo".
func soundIsPlaying() -> Bool {
    audioDevices().contains { device in
        hasStream(device, input: false) && deviceIsRunning(device)
    }
}

/// Is any audio INPUT device capturing right now?
/// This is the hardware layer, not AVCaptureDevice — which is why it asks for
/// no permission. It works as a meeting detector independent of Zoom, Teams or
/// Meet.
func audioDevices() -> [AudioDeviceID] {
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioHardwarePropertyDevices,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain)
    var size: UInt32 = 0
    guard AudioObjectGetPropertyDataSize(
        AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &size) == noErr
    else { return [] }
    let count = Int(size) / MemoryLayout<AudioDeviceID>.size
    if count == 0 { return [] }
    var list = [AudioDeviceID](repeating: 0, count: count)
    guard AudioObjectGetPropertyData(
        AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &size, &list) == noErr
    else { return [] }
    return list
}

/// With no stream on that side, the device is no use for that.
func hasStream(_ device: AudioDeviceID, input: Bool) -> Bool {
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioDevicePropertyStreams,
        mScope: input ? kAudioDevicePropertyScopeInput : kAudioDevicePropertyScopeOutput,
        mElement: kAudioObjectPropertyElementMain)
    var size: UInt32 = 0
    guard AudioObjectGetPropertyDataSize(device, &address, 0, nil, &size) == noErr
    else { return false }
    return size > 0
}

func deviceIsRunning(_ device: AudioDeviceID) -> Bool {
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioDevicePropertyDeviceIsRunningSomewhere,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain)
    var running: UInt32 = 0
    var size = UInt32(MemoryLayout<UInt32>.size)
    guard AudioObjectGetPropertyData(device, &address, 0, nil, &size, &running) == noErr
    else { return false }
    return running != 0
}

func microphoneInUse() -> Bool {
    audioDevices().contains { device in
        hasStream(device, input: true) && deviceIsRunning(device)
    }
}

/// Which screen the focused window is on.
///
/// Nothing here is per monitor — the focused app is global — but knowing where
/// the window
/// estava responde "trabalho mais no monitor grande ou no notebook?" e serve de
/// prova de que nenhuma screen fica de fora.
func screenOfWindow(_ window: AXUIElement) -> String? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(window, kAXPositionAttribute as CFString, &value) == .success,
          let raw = value, CFGetTypeID(raw) == AXValueGetTypeID()
    else { return nil }

    var point = CGPoint.zero
    guard AXValueGetValue(raw as! AXValue, .cgPoint, &point) else { return nil }

    // A acessibilidade mede do topo da screen main para baixo; o NSScreen
    // mede de baixo para cima. Sem converter, tudo cai na screen errada.
    guard let main = NSScreen.screens.first else { return nil }
    let fullHeight = main.frame.maxY
    let converted = CGPoint(x: point.x, y: fullHeight - point.y)

    for (index, screen) in NSScreen.screens.enumerated() {
        if screen.frame.contains(converted) {
            let name = screen.localizedName
            return name.isEmpty ? "Screen \(index + 1)" : name
        }
    }
    return nil
}

func idleSeconds() -> Double {
    let types: [CGEventType] = [.mouseMoved, .keyDown, .leftMouseDown, .scrollWheel, .flagsChanged]
    return types
        .map { CGEventSource.secondsSinceLastEventType(.hidSystemState, eventType: $0) }
        .min() ?? 0
}

func screenIsLocked() -> Bool {
    guard let session = CGSessionCopyCurrentDictionary() as? [String: Any] else { return false }
    return (session["CGSSessionScreenIsLocked"] as? Int) == 1
}

func escape(_ value: String) -> String {
    var out = ""
    for scalar in value.unicodeScalars {
        switch scalar {
        case "\"": out += "\\\""
        case "\\": out += "\\\\"
        case "\n": out += "\\n"
        case "\r": out += "\\r"
        case "\t": out += "\\t"
        default:
            if scalar.value < 0x20 {
                out += String(format: "\\u%04x", scalar.value)
            } else {
                out.unicodeScalars.append(scalar)
            }
        }
    }
    return out
}

func field(_ key: String, _ value: String?) -> String? {
    guard let value, !value.isEmpty else { return nil }
    return "\"\(key)\":\"\(escape(value))\""
}

/// A debugging hook: if the marker file exists, it dumps the accessibility
/// acessibilidade do app em foco e apaga a marker. Serve para descobrir onde um
/// app stores what matters without recompiling blind — and only the helper can
/// do this, because only it holds the permission.
func dumpTreeIfAsked(_ window: AXUIElement, app: String) {
    let marker = "/tmp/hippocampus-tree"
    guard FileManager.default.fileExists(atPath: marker) else { return }
    try? FileManager.default.removeItem(atPath: marker)

    var lines: [String] = ["APP: \(app)"]
    var queue: [(AXUIElement, Int)] = [(window, 0)]
    var seen = 0

    while !queue.isEmpty, seen < 900 {
        let (element, depth) = queue.removeFirst()
        seen += 1
        if depth > 12 { continue }

        let role = stringAttribute(element, kAXRoleAttribute as String) ?? "?"
        let title = stringAttribute(element, kAXTitleAttribute as String) ?? ""
        let description = stringAttribute(element, kAXDescriptionAttribute as String) ?? ""
        let value = stringAttribute(element, kAXValueAttribute as String) ?? ""
        let selected = (attribute(element, kAXSelectedAttribute as String) as? Bool) == true

        if !title.isEmpty || !description.isEmpty || !value.isEmpty || selected {
            let indent = String(repeating: "  ", count: depth)
            lines.append("\(indent)\(role)\(selected ? " [SELECTED]" : "")"
                + " | t=\(title.prefix(70)) | d=\(description.prefix(70)) | v=\(value.prefix(70))")
        }

        if let children = attribute(element, kAXChildrenAttribute as String) as? [AXUIElement] {
            for child in children.prefix(60) { queue.append((child, depth + 1)) }
        }
    }

    try? lines.joined(separator: "\n").write(
        toFile: "/tmp/hippocampus-tree.txt", atomically: true, encoding: .utf8)
}

var playingCache: (value: String?, at: Date) = (nil, .distantPast)

/// The AppleScript query is expensive and asks for a permission; repeating it
/// now and then makes sense, on every 4-second sample it does not.
func playingNow(_ hasSound: Bool) -> String? {
    guard hasSound else { playingCache = (nil, Date()); return nil }
    if Date().timeIntervalSince(playingCache.at) < 30 { return playingCache.value }
    playingCache = (whatIsPlaying(), Date())
    return playingCache.value
}

let formatter = ISO8601DateFormatter()
formatter.formatOptions = [.withInternetDateTime]

func sample() {
    let trusted = AXIsProcessTrusted()
    let locked = screenIsLocked()
    let idle = idleSeconds()

    var parts = ["\"ts\":\"\(formatter.string(from: Date()))\""]
    parts.append("\"idle\":\(Int(idle.rounded()))")
    parts.append("\"locked\":\(locked)")
    parts.append("\"trusted\":\(trusted)")
    parts.append("\"keys\":\(counter(.keyDown))")
    parts.append("\"clicks\":\(counter(.leftMouseDown) + counter(.rightMouseDown))")
    parts.append("\"scroll\":\(counter(.scrollWheel))")
    let ownListening = ownListeningIsOn()
    parts.append("\"mic\":\(microphoneInUse())")
    parts.append("\"listening\":\(ownListening)")
    let hasSound = soundIsPlaying()
    parts.append("\"sound\":\(hasSound)")
    if let track = field("playing", playingNow(hasSound)) { parts.append(track) }
    // An open media app is a weak hint, not a source: a player that is open and
    // paused looks the same, and sound from a browser tab does not show up here
    // at all.
    if let midia = field("mediaOpen", openMediaApp()) { parts.append(midia) }

    if !locked, let app = NSWorkspace.shared.frontmostApplication {
        if let name = field("app", app.localizedName) { parts.append(name) }
        if let bundle = field("bundle", app.bundleIdentifier) { parts.append(bundle) }

        if trusted {
            let axApp = AXUIElementCreateApplication(app.processIdentifier)
            var window = attribute(axApp, kAXFocusedWindowAttribute as String).map { $0 as! AXUIElement }
            if window == nil,
               let windows = attribute(axApp, kAXWindowsAttribute as String) as? [AXUIElement] {
                window = windows.first
            }
            if let window {
                dumpTreeIfAsked(window, app: app.localizedName ?? "?")
                if let title = field("title", stringAttribute(window, kAXTitleAttribute as String)) {
                    parts.append(title)
                }
                if let bundle = app.bundleIdentifier, browsers.contains(bundle),
                   let url = field("url", findURL(in: window)) {
                    parts.append(url)
                }
                if let screen = field("screen", screenOfWindow(window)) {
                    parts.append(screen)
                }
            }
        }
    }

    let line = "{\(parts.joined(separator: ","))}"

    guard let target else {
        print(line)
        fflush(stdout)
        return
    }

    var request = URLRequest(url: target)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = line.data(using: .utf8)
    request.timeoutInterval = 5
    // A failed send is silent on purpose: the core may be restarting,
    // e derrubar a amostragem por causa disso perderia mais do que ganharia.
    URLSession.shared.dataTask(with: request).resume()
}

sample()
let timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { _ in sample() }
RunLoop.main.add(timer, forMode: .common)
RunLoop.main.run()
