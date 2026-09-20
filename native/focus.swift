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
let destino: URL? = args.firstIndex(of: "--post").flatMap { i in
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
if !AXIsProcessTrusted() && (destino != nil || args.contains("--ask")) {
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
func contador(_ tipo: CGEventType) -> Int {
    Int(CGEventSource.counterForEventType(.hidSystemState, eventType: tipo))
}

/// A media app that is open, if any. It comes from the list of running apps,
/// which costs no permission — unlike asking the player what is playing, which
/// needs Automation and returns the track name.
let APPS_DE_MIDIA: [String: String] = [
    "com.apple.Music": "Music", "com.spotify.client": "Spotify",
    "com.apple.TV": "TV", "org.videolan.vlc": "VLC",
    "com.deezer.deezer-desktop": "Deezer", "com.tidal.desktop": "Tidal",
    "com.soundcloud.desktop": "SoundCloud", "com.apple.Podcasts": "Podcasts",
]

func appDeMidiaAberto() -> String? {
    for app in NSWorkspace.shared.runningApplications {
        if let bundle = app.bundleIdentifier, let nome = APPS_DE_MIDIA[bundle] { return nome }
    }
    return nil
}

/// The wake-word listener holds the microphone the whole time.
///
/// Without knowing that, "microphone in use" would be true forever and call
/// detection would turn to noise — which is exactly what happened the moment
/// the listener was switched on.
func escutaPropriaAtiva() -> Bool {
    // By its liveness file, not by the application list: the listener is a loop
    // with a recogniser inside, never calls NSApplicationMain, and therefore
    // does not appear as an application to the system.
    let vivo = FileManager.default
        .homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Application Support/Hipocampo/ouvido.vivo")
    guard let atributos = try? FileManager.default.attributesOfItem(atPath: vivo.path),
          let modificado = atributos[.modificationDate] as? Date
    else { return false }
    return Date().timeIntervalSince(modificado) < 90
}

/// Sites that are a source of music or video. Used to pick, among the open
/// tabs, the one that is probably playing.
/// In two tiers because the browser does not say which tab has audio: with
/// YouTube and a music service open at once, the safe bet is the music.
let SITES_DE_MUSICA = [
    "flowmusic.app", "open.spotify.com", "music.youtube.com", "soundcloud.com",
    "deezer.com", "tidal.com", "music.apple.com", "bandcamp.com",
]
let SITES_DE_VIDEO = ["youtube.com", "twitch.tv", "netflix.com", "vimeo.com"]

/// Asks the app what is playing. Needs the Automation permission.
///
/// Only runs when there is actually sound and the app is open: `osascript`
/// against
/// um app fechado pode travar por minutos, e travar a amostragem por causa de
/// a track name would be a terrible bargain.
func consultaPorAppleScript(_ script: String) -> String? {
    var erro: NSDictionary?
    guard let resultado = NSAppleScript(source: script)?.executeAndReturnError(&erro),
          erro == nil, let texto = resultado.stringValue, !texto.isEmpty
    else { return nil }
    return texto
}

func appEstaAberto(_ bundle: String) -> Bool {
    NSWorkspace.shared.runningApplications.contains { $0.bundleIdentifier == bundle }
}

/// What is playing: the players first, then the browser tab.
func oQueEstaTocando() -> String? {
    if appEstaAberto("com.spotify.client"),
       let faixa = consultaPorAppleScript(
        "tell application \"Spotify\" to if player state is playing "
        + "then return name of current track & \" — \" & artist of current track") {
        return faixa
    }

    if appEstaAberto("com.apple.Music"),
       let faixa = consultaPorAppleScript(
        "tell application \"Music\" to if player state is playing "
        + "then return name of current track & \" — \" & artist of current track") {
        return faixa
    }

    // Music in a browser tab, which no player can report. Among the open tabs,
    // one on a media site is the bet.
    for (bundle, nome) in [("com.google.Chrome", "Google Chrome"),
                           ("company.thebrowser.Browser", "Arc")] {
        guard appEstaAberto(bundle) else { continue }
        // Asking for every title at once glues them into one string with no
        // separator, and there is no telling which title belongs to which
        // address. So the search happens inside the AppleScript itself, tab by tab.
        for lista in [SITES_DE_MUSICA, SITES_DE_VIDEO] {
            let condicoes = lista.map { "(u contains \"\($0)\")" }.joined(separator: " or ")
            let script = """
            tell application "\(nome)"
              repeat with j in windows
                repeat with a in tabs of j
                  set u to URL of a
                  if \(condicoes) then return title of a
                end repeat
              end repeat
            end tell
            """
            if let titulo = consultaPorAppleScript(script) { return titulo }
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
func somTocando() -> Bool {
    dispositivosDeAudio().contains { dispositivo in
        temFluxo(dispositivo, entrada: false) && dispositivoAtivo(dispositivo)
    }
}

/// Is any audio INPUT device capturing right now?
/// This is the hardware layer, not AVCaptureDevice — which is why it asks for
/// no permission. It works as a meeting detector independent of Zoom, Teams or
/// Meet.
func dispositivosDeAudio() -> [AudioDeviceID] {
    var endereco = AudioObjectPropertyAddress(
        mSelector: kAudioHardwarePropertyDevices,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain)
    var tamanho: UInt32 = 0
    guard AudioObjectGetPropertyDataSize(
        AudioObjectID(kAudioObjectSystemObject), &endereco, 0, nil, &tamanho) == noErr
    else { return [] }
    let quantidade = Int(tamanho) / MemoryLayout<AudioDeviceID>.size
    if quantidade == 0 { return [] }
    var lista = [AudioDeviceID](repeating: 0, count: quantidade)
    guard AudioObjectGetPropertyData(
        AudioObjectID(kAudioObjectSystemObject), &endereco, 0, nil, &tamanho, &lista) == noErr
    else { return [] }
    return lista
}

/// With no stream on that side, the device is no use for that.
func temFluxo(_ dispositivo: AudioDeviceID, entrada: Bool) -> Bool {
    var endereco = AudioObjectPropertyAddress(
        mSelector: kAudioDevicePropertyStreams,
        mScope: entrada ? kAudioDevicePropertyScopeInput : kAudioDevicePropertyScopeOutput,
        mElement: kAudioObjectPropertyElementMain)
    var tamanho: UInt32 = 0
    guard AudioObjectGetPropertyDataSize(dispositivo, &endereco, 0, nil, &tamanho) == noErr
    else { return false }
    return tamanho > 0
}

func dispositivoAtivo(_ dispositivo: AudioDeviceID) -> Bool {
    var endereco = AudioObjectPropertyAddress(
        mSelector: kAudioDevicePropertyDeviceIsRunningSomewhere,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain)
    var ativo: UInt32 = 0
    var tamanho = UInt32(MemoryLayout<UInt32>.size)
    guard AudioObjectGetPropertyData(dispositivo, &endereco, 0, nil, &tamanho, &ativo) == noErr
    else { return false }
    return ativo != 0
}

func microfoneEmUso() -> Bool {
    dispositivosDeAudio().contains { dispositivo in
        temFluxo(dispositivo, entrada: true) && dispositivoAtivo(dispositivo)
    }
}

/// Which screen the focused window is on.
///
/// Nothing here is per monitor — the focused app is global — but knowing where
/// the window
/// estava responde "trabalho mais no monitor grande ou no notebook?" e serve de
/// prova de que nenhuma tela fica de fora.
func telaDaJanela(_ janela: AXUIElement) -> String? {
    var valor: CFTypeRef?
    guard AXUIElementCopyAttributeValue(janela, kAXPositionAttribute as CFString, &valor) == .success,
          let bruto = valor, CFGetTypeID(bruto) == AXValueGetTypeID()
    else { return nil }

    var ponto = CGPoint.zero
    guard AXValueGetValue(bruto as! AXValue, .cgPoint, &ponto) else { return nil }

    // A acessibilidade mede do topo da tela principal para baixo; o NSScreen
    // mede de baixo para cima. Sem converter, tudo cai na tela errada.
    guard let principal = NSScreen.screens.first else { return nil }
    let alturaTotal = principal.frame.maxY
    let convertido = CGPoint(x: ponto.x, y: alturaTotal - ponto.y)

    for (indice, tela) in NSScreen.screens.enumerated() {
        if tela.frame.contains(convertido) {
            let nome = tela.localizedName
            return nome.isEmpty ? "Tela \(indice + 1)" : nome
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
/// acessibilidade do app em foco e apaga a marca. Serve para descobrir onde um
/// app stores what matters without recompiling blind — and only the helper can
/// do this, because only it holds the permission.
func despejaArvoreSePedido(_ janela: AXUIElement, app: String) {
    let marca = "/tmp/hipocampo-arvore"
    guard FileManager.default.fileExists(atPath: marca) else { return }
    try? FileManager.default.removeItem(atPath: marca)

    var linhas: [String] = ["APP: \(app)"]
    var fila: [(AXUIElement, Int)] = [(janela, 0)]
    var vistos = 0

    while !fila.isEmpty, vistos < 900 {
        let (elemento, nivel) = fila.removeFirst()
        vistos += 1
        if nivel > 12 { continue }

        let papel = stringAttribute(elemento, kAXRoleAttribute as String) ?? "?"
        let titulo = stringAttribute(elemento, kAXTitleAttribute as String) ?? ""
        let descricao = stringAttribute(elemento, kAXDescriptionAttribute as String) ?? ""
        let valor = stringAttribute(elemento, kAXValueAttribute as String) ?? ""
        let selecionado = (attribute(elemento, kAXSelectedAttribute as String) as? Bool) == true

        if !titulo.isEmpty || !descricao.isEmpty || !valor.isEmpty || selecionado {
            let recuo = String(repeating: "  ", count: nivel)
            linhas.append("\(recuo)\(papel)\(selecionado ? " [SELECIONADO]" : "")"
                + " | t=\(titulo.prefix(70)) | d=\(descricao.prefix(70)) | v=\(valor.prefix(70))")
        }

        if let filhos = attribute(elemento, kAXChildrenAttribute as String) as? [AXUIElement] {
            for filho in filhos.prefix(60) { fila.append((filho, nivel + 1)) }
        }
    }

    try? linhas.joined(separator: "\n").write(
        toFile: "/tmp/hipocampo-arvore.txt", atomically: true, encoding: .utf8)
}

var tocandoCache: (valor: String?, quando: Date) = (nil, .distantPast)

/// The AppleScript query is expensive and asks for a permission; repeating it
/// now and then makes sense, on every 4-second sample it does not.
func tocandoAgora(_ temSom: Bool) -> String? {
    guard temSom else { tocandoCache = (nil, Date()); return nil }
    if Date().timeIntervalSince(tocandoCache.quando) < 30 { return tocandoCache.valor }
    tocandoCache = (oQueEstaTocando(), Date())
    return tocandoCache.valor
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
    parts.append("\"keys\":\(contador(.keyDown))")
    parts.append("\"clicks\":\(contador(.leftMouseDown) + contador(.rightMouseDown))")
    parts.append("\"scroll\":\(contador(.scrollWheel))")
    let escutaPropria = escutaPropriaAtiva()
    parts.append("\"mic\":\(microfoneEmUso())")
    parts.append("\"escuta\":\(escutaPropria)")
    let temSom = somTocando()
    parts.append("\"som\":\(temSom)")
    if let faixa = field("tocando", tocandoAgora(temSom)) { parts.append(faixa) }
    // An open media app is a weak hint, not a source: a player that is open and
    // paused looks the same, and sound from a browser tab does not show up here
    // at all.
    if let midia = field("midiaAberta", appDeMidiaAberto()) { parts.append(midia) }

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
                despejaArvoreSePedido(window, app: app.localizedName ?? "?")
                if let title = field("title", stringAttribute(window, kAXTitleAttribute as String)) {
                    parts.append(title)
                }
                if let bundle = app.bundleIdentifier, browsers.contains(bundle),
                   let url = field("url", findURL(in: window)) {
                    parts.append(url)
                }
                if let tela = field("tela", telaDaJanela(window)) {
                    parts.append(tela)
                }
            }
        }
    }

    let linha = "{\(parts.joined(separator: ","))}"

    guard let destino else {
        print(linha)
        fflush(stdout)
        return
    }

    var pedido = URLRequest(url: destino)
    pedido.httpMethod = "POST"
    pedido.setValue("application/json", forHTTPHeaderField: "Content-Type")
    pedido.httpBody = linha.data(using: .utf8)
    pedido.timeoutInterval = 5
    // A failed send is silent on purpose: the core may be restarting,
    // e derrubar a amostragem por causa disso perderia mais do que ganharia.
    URLSession.shared.dataTask(with: pedido).resume()
}

sample()
let timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { _ in sample() }
RunLoop.main.add(timer, forMode: .common)
RunLoop.main.run()
