import Foundation
import ServiceManagement

/*
 O registrador dos agentes do Hipocampo.

 Até aqui o coletor e os dois helpers eram instalados escrevendo plists à mão em
 ~/Library/LaunchAgents e chamando `launchctl`. Funciona, mas nada disso pertence
 ao app: desinstalar o Hipocampo deixava os agentes para trás, e eles não
 apareciam em lugar nenhum dos Ajustes onde alguém pudesse desligá-los.

 Com SMAppService os plists moram dentro do próprio bundle, em
 Contents/Library/LaunchAgents, e o sistema passa a conhecê-los como parte do
 app: eles aparecem em Ajustes → Geral → Itens de Início sob o nome "Hipocampo",
 a pessoa liga e desliga por lá, e apagar o app leva os agentes junto.

 Este binário mora em Contents/MacOS do próprio bundle de propósito — é de lá
 que `Bundle.main` resolve para o app, que é o que o SMAppService consulta para
 saber de quem são os agentes.
*/

let AGENTES = [
  "com.hipocampo.coletor": "o coletor, que mede o dia",
  "com.hipocampo.foco": "o helper de foco, que lê a janela da frente",
  "com.hipocampo.ouvido": "a escuta da palavra de ativação",
]

/// Código estável, não frase.
///
/// Quem lê isto é a tela de Ajustes, que fala cinco idiomas. Devolver texto em
/// português obrigaria a interface a casar com a tradução para saber o que
/// aconteceu — e a primeira versão fazia exatamente isso.
func codigo(_ estado: SMAppService.Status) -> String {
  switch estado {
  case .enabled: return "ligado"
  case .notRegistered: return "nao-registrado"
  case .notFound: return "nao-encontrado"
  case .requiresApproval: return "requer-aprovacao"
  @unknown default: return "desconhecido"
  }
}

func servico(_ etiqueta: String) -> SMAppService {
  SMAppService.agent(plistName: "\(etiqueta).plist")
}

func registrar() -> Int32 {
  var falhas: Int32 = 0
  for (etiqueta, oQueFaz) in AGENTES.sorted(by: { $0.key < $1.key }) {
    let servico = servico(etiqueta)
    // Registrar duas vezes devolve erro; já estar ligado é sucesso, não falha.
    if servico.status == .enabled {
      print("\(etiqueta): já estava ligado")
      continue
    }
    do {
      try servico.register()
      print("\(etiqueta): ligado — \(oQueFaz)")
    } catch {
      // requiresApproval não é erro: o macOS registrou e está esperando a
      // pessoa aprovar. Dizer "falhou" aqui mandaria alguém procurar problema
      // onde só falta um clique.
      if servico.status == .requiresApproval {
        print("\(etiqueta): registrado, esperando aprovação em Ajustes → Geral → Itens de Início")
      } else {
        FileHandle.standardError.write("\(etiqueta): \(error.localizedDescription)\n".data(using: .utf8)!)
        falhas += 1
      }
    }
  }
  return falhas
}

func desregistrar() -> Int32 {
  for (etiqueta, _) in AGENTES.sorted(by: { $0.key < $1.key }) {
    do {
      try servico(etiqueta).unregister()
      print("\(etiqueta): desligado")
    } catch {
      // Desregistrar o que já não está lá é o resultado desejado.
      print("\(etiqueta): já não estava registrado")
    }
  }
  return 0
}

/// O estado de cada agente, em JSON, para o app mostrar sem interpretar texto.
func estado() -> Int32 {
  let linhas = AGENTES.keys.sorted().map { etiqueta -> String in
    let e = servico(etiqueta).status
    return "  \"\(etiqueta)\": { \"estado\": \"\(codigo(e))\", \"ligado\": \(e == .enabled) }"
  }
  print("{\n\(linhas.joined(separator: ",\n"))\n}")
  return 0
}

let comando = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "estado"
switch comando {
case "registrar": exit(registrar())
case "desregistrar": exit(desregistrar())
case "estado": exit(estado())
default:
  print("uso: hipocampo-agentes [registrar|desregistrar|estado]")
  exit(2)
}
