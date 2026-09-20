// hippocampus-listener — listens for the wake word, sending audio nowhere.
//
// Uses macOS's own speech recognition on-device (`requiresOnDeviceRecognition`),
// so the audio never leaves the machine and there is no cost per use. A
// separate program from the collector on purpose: the microphone permission is
// its own, and turning the listening off does not turn the measuring off.

import AVFoundation
import Foundation
import Speech

let args = CommandLine.arguments

func valor(_ nome: String, _ padrao: String) -> String {
    guard let i = args.firstIndex(of: nome), i + 1 < args.count else { return padrao }
    return args[i + 1]
}

let destino = URL(string: valor("--post", "http://127.0.0.1:7878/api/acordar"))!
let language = valor("--language", "pt-BR")
// Variations, because the recogniser mishears a proper noun in predictable ways.
let gatilhos = valor("--palavra", "hipocampo,hipocampa,ipocampo,hipo campo")
    .split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces).lowercased() }

let motor = AVAudioEngine()
var tarefa: SFSpeechRecognitionTask?
var pedido: SFSpeechAudioBufferRecognitionRequest?
var ultimoAviso = Date.distantPast

guard let reconhecedor = SFSpeechRecognizer(locale: Locale(identifier: language)),
      reconhecedor.supportsOnDeviceRecognition else {
    FileHandle.standardError.write("on-device recognition unavailable for \(language)\n".data(using: .utf8)!)
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
    // This is what guarantees nothing leaves the machine.
    novo.requiresOnDeviceRecognition = true
    pedido = novo

    tarefa = reconhecedor.recognitionTask(with: novo) { resultado, erro in
        if let resultado {
            let dito = resultado.bestTranscription.formattedString.lowercased()
            // Only the end of the phrase matters: the recogniser accumulates the whole session.
            let cauda = String(dito.suffix(40))
            if gatilhos.contains(where: { cauda.contains($0) }) {
                avisa()
                // Restart so the same stretch does not fire it again.
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
        FileHandle.standardError.write("no authorisation for speech recognition\n".data(using: .utf8)!)
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
            FileHandle.standardError.write("could not open the microphone: \(error)\n".data(using: .utf8)!)
            exit(1)
        }
        escuta()
        print("ouvindo \"\(gatilhos.first ?? "")\" — local, sem nuvem")
        fflush(stdout)

        // Sinal de vida em arquivo. O coletor precisa saber que o microfone
        // is busy because of us, or it counts a call where there was none; and
        // this process does not show up in NSWorkspace, because it never
        // becomes an application — it is just a loop with a recogniser inside.
        let vivo = FileManager.default
            .homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/Hipocampo/ouvido.vivo")
        func marca() { try? Date().description.write(to: vivo, atomically: true, encoding: .utf8) }
        marca()
        Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { _ in marca() }

        // The recognition session degrades over time; restart it hourly.
        Timer.scheduledTimer(withTimeInterval: 3600, repeats: true) { _ in escuta() }
    }
}

RunLoop.main.run()
