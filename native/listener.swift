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

func value(_ name: String, _ fallback: String) -> String {
    guard let i = args.firstIndex(of: name), i + 1 < args.count else { return fallback }
    return args[i + 1]
}

let target = URL(string: value("--post", "http://127.0.0.1:7878/api/wake"))!
let language = value("--language", "pt-BR")
// Variations, because the recogniser mishears a proper noun in predictable ways.
let triggers = value("--word", "hippocampus,hipocampo,hipocampa,ipocampo,hipo campo,hippocampo")
    .split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces).lowercased() }

let engine = AVAudioEngine()
var task: SFSpeechRecognitionTask?
var request: SFSpeechAudioBufferRecognitionRequest?
var lastNotice = Date.distantPast

guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: language)),
      recognizer.supportsOnDeviceRecognition else {
    FileHandle.standardError.write("on-device recognition unavailable for \(language)\n".data(using: .utf8)!)
    exit(1)
}

func notify() {
    // Uma chamada por vez: o recognizer repete o trecho enquanto refina.
    guard Date().timeIntervalSince(lastNotice) > 2 else { return }
    lastNotice = Date()
    var httpRequest = URLRequest(url: target)
    httpRequest.httpMethod = "POST"
    httpRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
    httpRequest.httpBody = "{\"word\":\"\(triggers.first ?? "")\"}".data(using: .utf8)
    httpRequest.timeoutInterval = 4
    URLSession.shared.dataTask(with: httpRequest).resume()
    print("woke")
    fflush(stdout)
}

func listen() {
    task?.cancel()
    task = nil

    let fresh = SFSpeechAudioBufferRecognitionRequest()
    fresh.shouldReportPartialResults = true
    // This is what guarantees nothing leaves the machine.
    fresh.requiresOnDeviceRecognition = true
    request = fresh

    task = recognizer.recognitionTask(with: fresh) { result, error in
        if let result {
            let said = result.bestTranscription.formattedString.lowercased()
            // Only the end of the phrase matters: the recogniser accumulates the whole session.
            let cauda = String(said.suffix(40))
            if triggers.contains(where: { cauda.contains($0) }) {
                notify()
                // Restart so the same stretch does not fire it again.
                DispatchQueue.main.async { listen() }
            }
        }
        if error != nil || result?.isFinal == true {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { listen() }
        }
    }
}

/** Opens the microphone, or reopens it with whatever format the device has now. */
func startMicrophone() throws {
    engine.stop()
    let input = engine.inputNode
    input.removeTap(onBus: 0)
    input.installTap(onBus: 0, bufferSize: 2048, format: input.outputFormat(forBus: 0)) { buffer, _ in
        request?.append(buffer)
    }
    engine.prepare()
    try engine.start()
}

SFSpeechRecognizer.requestAuthorization { estado in
    guard estado == .authorized else {
        FileHandle.standardError.write("no authorisation for speech recognition\n".data(using: .utf8)!)
        exit(1)
    }

    DispatchQueue.main.async {
        do {
            try startMicrophone()
        } catch {
            FileHandle.standardError.write("could not open the microphone: \(error)\n".data(using: .utf8)!)
            exit(1)
        }
        // When another program opens the microphone with echo cancellation —
        // the live voice does, through WebRTC — macOS reconfigures the device
        // and this engine stops without an error. The process stayed up and
        // heard nothing: the wake word worked once, and never again.
        NotificationCenter.default.addObserver(
            forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main
        ) { _ in
            do {
                try startMicrophone()
                listen()
                print("microphone changed — listening again")
            } catch {
                // Exiting lets launchd start a fresh process, which opens the
                // device as it is now.
                FileHandle.standardError.write("could not reopen the microphone: \(error)\n".data(using: .utf8)!)
                exit(1)
            }
            fflush(stdout)
        }
        listen()
        print("listening for \"\(triggers.first ?? "")\" — on device, no cloud")
        fflush(stdout)

        // A sign of life, in a file. The collector needs to know the microphone
        // is busy because of us, or it counts a call where there was none; and
        // this process does not show up in NSWorkspace, because it never
        // becomes an application — it is just a loop with a recogniser inside.
        let alive = FileManager.default
            .homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/Hippocampus/listener.alive")
        func mark() { try? Date().description.write(to: alive, atomically: true, encoding: .utf8) }
        mark()
        Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { _ in mark() }

        // The recognition session degrades over time; restart it hourly.
        Timer.scheduledTimer(withTimeInterval: 3600, repeats: true) { _ in listen() }
    }
}

RunLoop.main.run()
