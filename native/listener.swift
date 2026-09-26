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

/** Where the room's loudness goes: the same core, one door over from the wake word. */
let hearing = target.deletingLastPathComponent().appendingPathComponent("room")

let engine = AVAudioEngine()
var task: SFSpeechRecognitionTask?
var request: SFSpeechAudioBufferRecognitionRequest?
var lastNotice = Date.distantPast

guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: language)),
      recognizer.supportsOnDeviceRecognition else {
    FileHandle.standardError.write("on-device recognition unavailable for \(language)\n".data(using: .utf8)!)
    exit(1)
}

/**
 * How loud the room is, so the sphere stirs while you speak.
 *
 * The microphone here is open all day and nothing is recorded from it, which
 * leaves no way to tell a listener that is working from one that died in the
 * night. So a number goes out — one float, never a sample of audio — and the
 * sphere on screen moves with it: proof you can see, for the price of a POST
 * to localhost.
 *
 * The tap runs on the audio thread, so it only leaves the loudest reading
 * behind; the sending happens on a timer, and only when the reading moved
 * enough to be visible.
 */
let meter = NSLock()
var loudest: Float = 0
var lastSent: Float = -1

func measure(_ buffer: AVAudioPCMBuffer) {
    guard let samples = buffer.floatChannelData?[0] else { return }
    let count = Int(buffer.frameLength)
    guard count > 0 else { return }
    var sum: Float = 0
    for i in 0..<count { sum += samples[i] * samples[i] }
    let rms = (sum / Float(count)).squareRoot()
    meter.lock()
    loudest = max(loudest, rms)
    meter.unlock()
}

func report() {
    meter.lock()
    let peak = loudest
    loudest = 0
    meter.unlock()
    // A floor for the room itself: a fan, a fridge and breathing are not a voice.
    let level = min(1, max(0, peak - 0.02) * 6)
    // Silence is worth one message, the one that says it went quiet.
    guard abs(level - lastSent) > 0.04 || (level == 0 && lastSent != 0) else { return }
    lastSent = level
    var httpRequest = URLRequest(url: hearing)
    httpRequest.httpMethod = "POST"
    httpRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
    httpRequest.httpBody = "{\"level\":\(level)}".data(using: .utf8)
    httpRequest.timeoutInterval = 2
    URLSession.shared.dataTask(with: httpRequest).resume()
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

/**
 * Whether the person wants the wake word at all, asked of the core.
 *
 * Listening is not free: the on-device recogniser ran at 55 to 75% of a core,
 * with the Neural Engine's own process at 20% more, all day — 28 hours of CPU
 * in under two days, for a word said a few times. So it is a switch in
 * Settings, and this process follows it without being restarted: off closes
 * the microphone and ends the recognition, which is what costs; on opens them
 * again. The process itself stays, as launchd's login item, and asks every ten
 * seconds.
 */
var wanted = false
let asking = target.deletingLastPathComponent().appendingPathComponent("wake")
let alive = FileManager.default
    .homeDirectoryForCurrentUser
    .appendingPathComponent("Library/Application Support/Hippocampus/listener.alive")

/** A sign of life, in a file — only while the microphone is open because of us. */
func mark() {
    if wanted { try? Date().description.write(to: alive, atomically: true, encoding: .utf8) }
}

func stopListening() {
    task?.cancel()
    task = nil
    request = nil
    engine.stop()
    engine.inputNode.removeTap(onBus: 0)
    // Without the sign of life, the collector counts an open microphone as a
    // call again — it is someone else's now.
    try? FileManager.default.removeItem(at: alive)
    print("wake word off — microphone closed")
    fflush(stdout)
}

func follow(_ on: Bool) {
    guard on != wanted else { return }
    wanted = on
    if on {
        do {
            try startMicrophone()
            listen()
            mark()
            print("listening for \"\(triggers.first ?? "")\" — on device, no cloud")
        } catch {
            FileHandle.standardError.write("could not open the microphone: \(error)\n".data(using: .utf8)!)
            exit(1)
        }
    } else {
        stopListening()
    }
    fflush(stdout)
}

/** Asks the core; a core that does not answer leaves things as they are. */
func check() {
    var ask = URLRequest(url: asking)
    ask.timeoutInterval = 3
    URLSession.shared.dataTask(with: ask) { data, response, _ in
        guard (response as? HTTPURLResponse)?.statusCode == 200, let data,
              let answer = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let on = answer["listening"] as? Bool else { return }
        DispatchQueue.main.async { follow(on) }
    }.resume()
}

/** Opens the microphone, or reopens it with whatever format the device has now. */
func startMicrophone() throws {
    engine.stop()
    let input = engine.inputNode
    input.removeTap(onBus: 0)
    input.installTap(onBus: 0, bufferSize: 2048, format: input.outputFormat(forBus: 0)) { buffer, _ in
        request?.append(buffer)
        measure(buffer)
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
        // When another program opens the microphone with echo cancellation —
        // the live voice does, through WebRTC — macOS reconfigures the device
        // and this engine stops without an error. The process stayed up and
        // heard nothing: the wake word worked once, and never again.
        NotificationCenter.default.addObserver(
            forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main
        ) { _ in
            guard wanted else { return }
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

        // Nothing opens until the core says the wake word is wanted.
        check()
        Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { _ in check() }

        // The sign of life the collector reads. It needs to know the
        // microphone is busy because of us, or it counts a call where there
        // was none; and this process does not show up in NSWorkspace, because
        // it never becomes an application — it is just a loop with a
        // recogniser inside.
        Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { _ in mark() }

        // Twelve a second is enough for the eye and cheap on localhost; below
        // that the sphere moves in steps instead of with the voice.
        Timer.scheduledTimer(withTimeInterval: 0.08, repeats: true) { _ in if wanted { report() } }

        // The recognition session degrades over time; restart it hourly.
        Timer.scheduledTimer(withTimeInterval: 3600, repeats: true) { _ in if wanted { listen() } }
    }
}

RunLoop.main.run()
