// hipocampo-ouvido — escuta a palavra de ativação, sem mandar áudio a lugar nenhum.
//
// Usa o reconhecimento de fala do próprio macOS em modo local
// (`requiresOnDeviceRecognition`), então o áudio não sai da máquina e não há
// custo por uso. É um programa à parte do coletor de propósito: assim a
// permissão de microfone é dele, e desligar a escuta não desliga a medição.

import AVFoundation
import Foundation
import Speech

let args = CommandLine.arguments

func valor(_ nome: String, _ padrao: String) -> String {
    guard let i = args.firstIndex(of: nome), i + 1 < args.count else { return padrao }
    return args[i + 1]
}

let destino = URL(string: valor("--post", "http://127.0.0.1:7878/api/acordar"))!
let idioma = valor("--idioma", "pt-BR")
// Variações porque o reconhecedor erra o nome próprio de formas previsíveis.
let gatilhos = valor("--palavra", "hipocampo,hipocampa,ipocampo,hipo campo")
    .split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces).lowercased() }

let motor = AVAudioEngine()
var tarefa: SFSpeechRecognitionTask?
var pedido: SFSpeechAudioBufferRecognitionRequest?
var ultimoAviso = Date.distantPast

guard let reconhecedor = SFSpeechRecognizer(locale: Locale(identifier: idioma)),
      reconhecedor.supportsOnDeviceRecognition else {
    FileHandle.standardError.write("reconhecimento local indisponível para \(idioma)\n".data(using: .utf8)!)
    exit(1)
}

func avisa() {
    // Uma chamada por vez: o reconhecedor repete o trecho enquanto refina.
    guard Date().timeIntervalSince(ultimoAviso) > 2 else { return }
    ultimoAviso = Date()
    var pedidoHTTP = URLRequest(url: destino)
    pedidoHTTP.httpMethod = "POST"
    pedidoHTTP.setValue("application/json", forHTTPHeaderField: "Content-Type")
    pedidoHTTP.httpBody = "{\"palavra\":\"\(gatilhos.first ?? "")\"}".data(using: .utf8)
    pedidoHTTP.timeoutInterval = 4
    URLSession.shared.dataTask(with: pedidoHTTP).resume()
    print("acordou")
    fflush(stdout)
}

func escuta() {
    tarefa?.cancel()
    tarefa = nil

    let novo = SFSpeechAudioBufferRecognitionRequest()
    novo.shouldReportPartialResults = true
    // O que garante que nada sai da máquina.
    novo.requiresOnDeviceRecognition = true
    pedido = novo

    tarefa = reconhecedor.recognitionTask(with: novo) { resultado, erro in
        if let resultado {
            let dito = resultado.bestTranscription.formattedString.lowercased()
            // Só o fim da frase interessa: o reconhecedor acumula a sessão inteira.
            let cauda = String(dito.suffix(40))
            if gatilhos.contains(where: { cauda.contains($0) }) {
                avisa()
                // Recomeça para não disparar de novo com o mesmo trecho.
                DispatchQueue.main.async { escuta() }
            }
        }
        if erro != nil || resultado?.isFinal == true {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { escuta() }
        }
    }
}

SFSpeechRecognizer.requestAuthorization { estado in
    guard estado == .authorized else {
        FileHandle.standardError.write("sem autorização para reconhecimento de fala\n".data(using: .utf8)!)
        exit(1)
    }

    DispatchQueue.main.async {
        let entrada = motor.inputNode
        entrada.installTap(onBus: 0, bufferSize: 2048, format: entrada.outputFormat(forBus: 0)) { buffer, _ in
            pedido?.append(buffer)
        }
        motor.prepare()
        do {
            try motor.start()
        } catch {
            FileHandle.standardError.write("não consegui abrir o microfone: \(error)\n".data(using: .utf8)!)
            exit(1)
        }
        escuta()
        print("ouvindo \"\(gatilhos.first ?? "")\" — local, sem nuvem")
        fflush(stdout)

        // Sinal de vida em arquivo. O coletor precisa saber que o microfone
        // está ocupado por nós, senão conta chamada onde não houve; e este
        // processo não aparece em NSWorkspace, porque nunca vira aplicação —
        // é só um laço com um reconhecedor dentro.
        let vivo = FileManager.default
            .homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/Hipocampo/ouvido.vivo")
        func marca() { try? Date().description.write(to: vivo, atomically: true, encoding: .utf8) }
        marca()
        Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { _ in marca() }

        // A sessão de reconhecimento degrada com o tempo; reinicia de hora em hora.
        Timer.scheduledTimer(withTimeInterval: 3600, repeats: true) { _ in escuta() }
    }
}

RunLoop.main.run()
