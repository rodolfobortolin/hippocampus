// hipocampo-focus — amostra o que está em foco no Mac e escreve NDJSON no stdout.
//
// Uma linha por amostra: app, bundle, título da janela, URL (quando é navegador),
// segundos de ociosidade e se a tela está bloqueada. Sem título de janela a
// amostra ainda sai — só perde o detalhe, que exige Acessibilidade.

import AppKit
import ApplicationServices
import CoreAudio
import CoreGraphics
import Foundation

let args = CommandLine.arguments

/// Para onde as amostras vão. Sem `--post`, saem no stdout como antes.
///
/// O modo `--post` existe por causa do TCC: o macOS atribui a permissão de
/// Acessibilidade ao *processo responsável*, que é quem lançou o programa. Se o
/// coletor em Node der o start, quem aparece pedindo é o node — e autorizar o
/// node daria Acessibilidade a qualquer script Node da máquina. Lançado direto
/// pelo launchd, este helper responde por si mesmo, e a autorização fica onde
/// deve: neste app, e só nele.
let destino: URL? = args.firstIndex(of: "--post").flatMap { i in
    i + 1 < args.count ? URL(string: args[i + 1]) : nil
}
let interval = args.firstIndex(of: "--interval").flatMap { i -> Double? in
    i + 1 < args.count ? Double(args[i + 1]) : nil
} ?? 4.0

// --check apenas consulta e sai. Nunca pede: é chamado em laço por scripts, e
// pedir aqui gera um diálogo do sistema a cada chamada.
if args.contains("--check") {
    print(AXIsProcessTrusted() ? "trusted" : "untrusted")
    exit(AXIsProcessTrusted() ? 0 : 1)
}

// O pedido só parte de quem tem identidade própria no TCC: o agente do launchd
// (que é quem usa --post) ou um pedido explícito. Lançado por outro programa,
// o diálogo sairia em nome do programa pai, que não é o que se quer autorizar.
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

/// Contadores acumulados desde o boot. Não exigem Acessibilidade nem
/// Monitoramento de Entrada: é a mesma classe que já dá a ociosidade.
/// O delta entre amostras mede *engajamento* — ler tem rolagem e zero tecla;
/// escrever tem tecla. É o sinal que faltava para não depender só do título.
func contador(_ tipo: CGEventType) -> Int {
    Int(CGEventSource.counterForEventType(.hidSystemState, eventType: tipo))
}

/// Um app de mídia aberto, se houver. Vem da lista de apps em execução, que
/// não custa permissão — diferente de perguntar ao player o que está tocando,
/// que exige Automação e devolve o nome da faixa.
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

/// A escuta da palavra de ativação segura o microfone o tempo todo.
///
/// Sem saber disso, "microfone em uso" passaria a valer sempre e a detecção de
/// chamada viraria ruído — foi o que aconteceu assim que a escuta foi ligada.
func escutaPropriaAtiva() -> Bool {
    // Pelo sinal de vida, não pela lista de aplicações: a escuta é um laço com
    // um reconhecedor dentro, nunca chama NSApplicationMain, e por isso não
    // aparece como aplicação para o sistema.
    let vivo = FileManager.default
        .homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Application Support/Hipocampo/ouvido.vivo")
    guard let atributos = try? FileManager.default.attributesOfItem(atPath: vivo.path),
          let modificado = atributos[.modificationDate] as? Date
    else { return false }
    return Date().timeIntervalSince(modificado) < 90
}

/// Sites que são fonte de música ou vídeo. Serve para escolher, entre as abas
/// abertas, qual é a que provavelmente está tocando.
/// Em dois níveis porque o navegador não diz qual aba tem áudio: com YouTube
/// e um serviço de música abertos ao mesmo tempo, a aposta certa é a música.
let SITES_DE_MUSICA = [
    "flowmusic.app", "open.spotify.com", "music.youtube.com", "soundcloud.com",
    "deezer.com", "tidal.com", "music.apple.com", "bandcamp.com",
]
let SITES_DE_VIDEO = ["youtube.com", "twitch.tv", "netflix.com", "vimeo.com"]

/// Pergunta ao app o que está tocando. Exige permissão de Automação.
///
/// Só roda quando há som de fato e quando o app está aberto: `osascript` contra
/// um app fechado pode travar por minutos, e travar a amostragem por causa de
/// um nome de faixa seria um péssimo negócio.
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

/// O que está tocando: primeiro os players, depois a aba do navegador.
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

    // A música do Rodolfo toca em aba de navegador, que nenhum player reporta.
    // Entre as abas abertas, a de um site de mídia é a aposta.
    for (bundle, nome) in [("com.google.Chrome", "Google Chrome"),
                           ("company.thebrowser.Browser", "Arc")] {
        guard appEstaAberto(bundle) else { continue }
        // Pedir todos os títulos de uma vez cola tudo num texto só, sem
        // separador, e não dá para saber qual título pertence a qual endereço.
        // Então a busca acontece dentro do próprio AppleScript, aba por aba.
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

/// Alguma SAÍDA de áudio está tocando agora?
///
/// Sozinho isso não prova música: fone aberto para uma chamada também acende,
/// e som de sistema também. Cruzado com o app de mídia aberto e com a ausência
/// de microfone em uso, vira um sinal decente de "estava ouvindo algo".
func somTocando() -> Bool {
    dispositivosDeAudio().contains { dispositivo in
        temFluxo(dispositivo, entrada: false) && dispositivoAtivo(dispositivo)
    }
}

/// Algum dispositivo de ENTRADA de áudio está capturando agora?
/// É a camada de hardware, não AVCaptureDevice — por isso não pede permissão.
/// Serve como detector de reunião que independe de Zoom, Teams ou Meet.
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

/// Sem fluxo daquele lado, o dispositivo não serve para aquilo.
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

/// Em qual tela a janela em foco está.
///
/// Nada aqui é por monitor — o app em foco é global —, mas saber onde a janela
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

/// Gancho de depuração: se o arquivo-marca existir, despeja a árvore de
/// acessibilidade do app em foco e apaga a marca. Serve para descobrir onde um
/// app guarda o que interessa sem ficar recompilando às cegas — e só o helper
/// consegue fazer isso, porque só ele tem a permissão.
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

/// A consulta por AppleScript é cara e pede permissão; faz sentido repetir de
/// vez em quando, não a cada amostra de 4 segundos.
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
    // O app de mídia aberto é pista fraca, não fonte: um player aberto e parado
    // aparece igual, e som de aba de navegador não aparece aqui de jeito nenhum.
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
    // Falha de envio é silenciosa de propósito: o núcleo pode estar reiniciando,
    // e derrubar a amostragem por causa disso perderia mais do que ganharia.
    URLSession.shared.dataTask(with: pedido).resume()
}

sample()
let timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { _ in sample() }
RunLoop.main.add(timer, forMode: .common)
RunLoop.main.run()
