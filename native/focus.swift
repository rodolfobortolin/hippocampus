// hipocampo-focus — amostra o que está em foco no Mac e escreve NDJSON no stdout.
//
// Uma linha por amostra: app, bundle, título da janela, URL (quando é navegador),
// segundos de ociosidade e se a tela está bloqueada. Sem título de janela a
// amostra ainda sai — só perde o detalhe, que exige Acessibilidade.

import AppKit
import ApplicationServices
import CoreGraphics
import Foundation

let args = CommandLine.arguments
let interval = args.firstIndex(of: "--interval").flatMap { i -> Double? in
    i + 1 < args.count ? Double(args[i + 1]) : nil
} ?? 4.0

// --ask abre o diálogo de Acessibilidade do sistema uma única vez.
if args.contains("--ask") {
    let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true]
    AXIsProcessTrustedWithOptions(options as CFDictionary)
}

if args.contains("--check") {
    print(AXIsProcessTrusted() ? "trusted" : "untrusted")
    exit(AXIsProcessTrusted() ? 0 : 1)
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

/// Procura a URL da aba ativa varrendo a árvore de acessibilidade da janela.
/// Navegadores baseados em Chromium expõem AXURL no nó AXWebArea.
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
                if let title = field("title", stringAttribute(window, kAXTitleAttribute as String)) {
                    parts.append(title)
                }
                if let bundle = app.bundleIdentifier, browsers.contains(bundle),
                   let url = field("url", findURL(in: window)) {
                    parts.append(url)
                }
            }
        }
    }

    print("{\(parts.joined(separator: ","))}")
    fflush(stdout)
}

sample()
let timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { _ in sample() }
RunLoop.main.add(timer, forMode: .common)
RunLoop.main.run()
