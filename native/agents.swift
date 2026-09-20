import Foundation
import ServiceManagement

/*
 The registrar for the app's agents.

 Until now the collector and the two helpers were installed by writing plists
 into ~/Library/LaunchAgents by hand and calling `launchctl`. That works, but
 none of it belonged to the app: uninstalling left the agents behind, and they
 showed up nowhere a person could turn them off.

 With SMAppService the plists live inside the bundle itself, in
 Contents/Library/LaunchAgents, and the system knows them as part of the app:
 they appear in Settings → General → Login Items under the app's name, the
 person switches them on and off there, and deleting the app takes the agents
 with it.

 This binary lives in the bundle's Contents/MacOS on purpose — that is where
 `Bundle.main` resolves to the app, which is what SMAppService consults to know
 whose agents these are. It must also be signed with the app's own identifier,
 or registration fails with a bare "Operation not permitted".
*/

let AGENTS = [
  "com.hippocampus.collector": "the collector, which measures the day",
  "com.hippocampus.focus": "the focus helper, which reads the window in front",
  "com.hippocampus.listener": "the wake-word listener",
]

/// A stable code, not a sentence.
///
/// What reads this is the Settings screen, which speaks five languages.
/// Returning prose would force the interface to match against a translation to
/// know what happened — and the first version did exactly that.
func statusCode(_ estado: SMAppService.Status) -> String {
  switch estado {
  case .enabled: return "on"
  case .notRegistered: return "not-registered"
  case .notFound: return "not-found"
  case .requiresApproval: return "needs-approval"
  @unknown default: return "unknown"
  }
}

func service(_ label: String) -> SMAppService {
  SMAppService.agent(plistName: "\(label).plist")
}

func register() -> Int32 {
  var failures: Int32 = 0
  for (label, whatItDoes) in AGENTS.sorted(by: { $0.key < $1.key }) {
    let servico = service(label)
    // Registering twice returns an error; being on already is success, not failure.
    if servico.status == .enabled {
      print("\(label): was already on")
      continue
    }
    do {
      try servico.register()
      print("\(label): on — \(whatItDoes)")
    } catch {
      // requiresApproval is not an error: macOS registered it and is waiting
      // for the person to approve. Saying "failed" here would send someone
      // looking for a problem where only a click is missing.
      if servico.status == .requiresApproval {
        print("\(label): registered, waiting for approval in Settings → General → Login Items")
      } else {
        FileHandle.standardError.write("\(label): \(error.localizedDescription)\n".data(using: .utf8)!)
        failures += 1
      }
    }
  }
  return failures
}

func unregister() -> Int32 {
  for (label, _) in AGENTS.sorted(by: { $0.key < $1.key }) {
    do {
      try service(label).unregister()
      print("\(label): off")
    } catch {
      // Unregistering what is no longer there is the desired outcome.
      print("\(label): was not registered anyway")
    }
  }
  return 0
}

/// O estado de cada agente, em JSON, para o app mostrar sem interpretar texto.
func status() -> Int32 {
  let linhas = AGENTS.keys.sorted().map { label -> String in
    let e = service(label).status
    return "  \"\(label)\": { \"status\": \"\(statusCode(e))\", \"on\": \(e == .enabled) }"
  }
  print("{\n\(linhas.joined(separator: ",\n"))\n}")
  return 0
}

let command = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "status"
switch command {
case "register": exit(register())
case "unregister": exit(unregister())
case "status": exit(status())
default:
  print("usage: hippocampus-agents [register|unregister|status]")
  exit(2)
}
