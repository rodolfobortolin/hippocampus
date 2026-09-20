// Uma lista só de idiomas, compartilhada com o núcleo: o app e o diário
// precisam concordar sobre o que é um idioma válido.
import { IDIOMAS, type Idioma } from '../../core/idiomas.ts'

export { IDIOMAS, type Idioma }

/**
 * Os textos da interface, em cinco idiomas.
 *
 * O tipo é fechado de propósito: acrescentar uma chave aqui quebra a compilação
 * enquanto os cinco idiomas não tiverem a tradução. É o que impede um idioma de
 * ficar pela metade sem ninguém perceber.
 */
export type Textos = {
  abas: { hoje: string; ritmo: string; diario: string; conversa: string; ajustes: string }
  estado: {
    marca: string
    /** Por que uma fonte de dados não está coletando. */
    fonte: Record<'aguardando-permissao' | 'sem-permissao' | 'nunca', string>
    medindo: string; ocioso: string; parado: string; nucleoDesligado: string
    emFoco: string; acessibilidade: string; classificacao: string; narrativa: string
    subaComNucleo: string; semNucleo: string
  }
  hoje: {
    titulo: string; hoje: string; carregando: string
    diaAnterior: string; hojeBotao: string; diaSeguinte: string
    das: string; as: string; maquinaParada: string; nadaMedido: string
    medindoSemAtividade: string; voltaAoTeclado: string; coletorGrava: string; soEnxerga: string
    seuTempo: string; longeDaMaquina: string
    delegado: string; delegadoNota: string; semDelegado: string
    concentrado: string; concentradoNota: string
    trocas: string; trocasNota: (n: number) => string
    dominou: string; maiorFatia: string
    fita: string; trechos: string; curtosDemais: string; passeOMouse: string
    formaDoFoco: string; sessoes: string; formaNota: string; semSessao: string
    medianaDe: string; aMaiorFoi: string
    ondeOTempoFoi: string; porCategoria: string; projetos: string; semProjeto: string
    janelas: string; semTitulos: string
    maos: string; teclas: string; cliques: string; rolagem: string
    escrevendo: string; lendo: string; misto: string; maosNota: string; semTeclado: string
    saiuDasMaos: string; commits: string; pedidosIA: string; nadaRegistrado: string
    sinais: string; visitas: string; sites: string; atalhos: string
    caracteresDigitados: string; som: string; algoTocando: string; chamada: string; telas: string
    faltaAcessibilidade: string; faltaAcessibilidadeTexto: string; atalhoPermissao: string
    outros: string
  }
  ritmo: {
    titulo: string; diasMedidos: string; diaMedido: string; entre: string; e: string
    dias7: string; dias30: string; dias90: string
    semDias: string; ritmoAparece: string
    tempoTotal: string; mediaPorDia: string
    focoMedio: string; focoMedioNota: string
    diaMaisLongo: string; producao: string; commits: string
    quandoTrabalha: string; horaPorDia: string; somaDoPeriodo: string; noTotal: string
    tendencia: string; tempoAtivoPorDia: string; mediaDe: string; porDiaMedido: string; precisaTresDias: string
    ondeOTempoFoi: string; porCategoria: string; projetos: string; semProjeto: string
    assinatura: string; semAtalhos: string; sites: string; caracteres: string
  }
  diario: {
    titulo: string; subtitulo: string; semDias: string; amanhaEnche: string
    semNarrativa: string; naoEscrito: string; escreverDia: string; escrevendo: string
    reescrever: string; reescrevendo: string; resumoDoDia: string; oRecap: string
    claudeNaoRespondeu: string; claudeTexto: string
  }
  conversa: {
    titulo: string; tituloForte: string; explicacao: string
    placeholder: string; ouvindo: string; transcrevendo: string; reconectando: string
    pensando: string; consultando: string; enviar: string; falar: string; pararDeOuvir: string
    calar: string; vozSempre: string; vozQuandoFalar: string; nucleoFora: string
    ouvir: string; cliqueParaFalar: string
    sugestoes: string[]
  }
  ajustes: {
    titulo: string; subtitulo: string
    idioma: string; idiomaNota: string
    nome: string; nomeNota: string
    vault: string; vaultNota: string; escolherPasta: string; semVault: string; pastaDoDiario: string
    chaves: string; chavesNota: string; guardadoNoChaveiro: string
    jevChave: string; jevNota: string; openaiChave: string; openaiNota: string
    opcional: string; configurada: string; naoConfigurada: string; remover: string
    dia: string; diaNota: string; horas: string
    digitacao: string; digitacaoNota: string
    salvar: string; salvo: string; salvando: string; testar: string; funcionando: string; falhou: string
    agentes: string; agentesNota: string; agentesLigados: string; agentesDesligados: string
    agentesAprovar: string; agentesOnde: string
  }
  /** Pares [singular, plural] para o que a tela conta. */
  contagem: {
    trecho: [string, string]; sessao: [string, string]; projeto: [string, string]
    commit: [string, string]; pedidoIA: [string, string]; visita: [string, string]
    site: [string, string]; dia: [string, string]; janela: [string, string]
  }
  comum: {
    min: string; h: string; s: string; de: string; sem: string; fechar: string
    ativo: string; noTotal: string; nadaAqui: string; semTempo: string; agente: string
    as: string; doAtivo: string; sessao: string; sessoes: string
    mediaDe: string; porDia: string; outros: (n: number) => string
    restoNaTela: string; naoEntendi: string; microfoneNegado: string
  }
}

const pt: Textos = {
  abas: { hoje: 'Hoje', ritmo: 'Ritmo', diario: 'Diário', conversa: 'Conversa', ajustes: 'Ajustes' },
  estado: {
    marca: 'memória da máquina',
    fonte: { 'aguardando-permissao': 'esperando você permitir', 'sem-permissao': 'sem permissão', nunca: 'ainda não tentou' },
    medindo: 'medindo', ocioso: 'ocioso', parado: 'parado', nucleoDesligado: 'núcleo desligado',
    emFoco: 'em foco', acessibilidade: 'acessibilidade', classificacao: 'classificação das janelas',
    narrativa: 'narrativa e conversa',
    subaComNucleo: 'Suba com', semNucleo: 'O núcleo não está respondendo.',
  },
  hoje: {
    titulo: 'Hoje', hoje: 'Hoje', carregando: 'Carregando…',
    diaAnterior: '← dia anterior', hojeBotao: 'hoje', diaSeguinte: 'dia seguinte →',
    das: 'das', as: 'às', maquinaParada: 'de máquina parada', nadaMedido: 'nada medido ainda',
    medindoSemAtividade: 'Medindo, mas sem atividade:', voltaAoTeclado: 'Assim que você voltar ao teclado, esta tela se enche sozinha.',
    coletorGrava: 'O coletor grava a partir do momento em que sobe — o histórico anterior não existe.',
    soEnxerga: 'O Hipocampo só enxerga a partir do dia em que começou a medir.',
    seuTempo: 'seu tempo', longeDaMaquina: 'longe da máquina',
    delegado: 'trabalho delegado', delegadoNota: 'agentes produzindo enquanto você fazia outra coisa',
    semDelegado: 'nenhum agente trabalhou fora do seu tempo',
    concentrado: 'trabalho concentrado', concentradoNota: 'tempo em código, IA, escrita, design e pesquisa',
    trocas: 'trocas de aplicativo', trocasNota: (n) => `${n} mudaram de projeto — só essas custam caro`,
    dominou: 'aplicativo que dominou', maiorFatia: 'maior fatia foi',
    fita: 'a fita do dia', trechos: 'trechos', curtosDemais: 'curtos demais para desenhar',
    passeOMouse: 'passe o mouse na fita para ver a janela',
    formaDoFoco: 'a forma do foco', sessoes: 'sessões sustentadas',
    formaNota: 'minutos por tamanho de sessão — trecho de 15min com 75% de foco, sem quebra maior que 2min',
    semSessao: 'Nenhuma sessão de foco sustentada neste dia.',
    medianaDe: 'mediana de', aMaiorFoi: 'a maior foi',
    ondeOTempoFoi: 'onde o tempo foi', porCategoria: 'por categoria', projetos: 'projetos tocados',
    semProjeto: 'O jev ainda não atribuiu projeto a nenhuma janela deste dia.',
    janelas: 'janelas onde você mais ficou', semTitulos: 'Sem títulos de janela — falta Acessibilidade.',
    maos: 'as suas mãos', teclas: 'teclas', cliques: 'cliques', rolagem: 'gestos de rolagem',
    escrevendo: 'escrevendo', lendo: 'lendo', misto: 'misto',
    maosNota: 'a barra é a fatia de teclas sobre o total — cheia é escrever, vazia é ler. São contagens de eventos do sistema, não distância: rolagem é quantas vezes você rolou, não quanto. E o que foi digitado não é guardado aqui, só quanto.',
    semTeclado: 'Sem sinal de teclado ainda.',
    saiuDasMaos: 'o que saiu das mãos', commits: 'commits', pedidosIA: 'pedidos de IA',
    nadaRegistrado: 'Nada registrado.',
    sinais: 'sinais', visitas: 'visitas de navegador', sites: 'sites', atalhos: 'atalhos',
    caracteresDigitados: 'caracteres digitados em', som: 'som', algoTocando: 'com algo tocando',
    chamada: 'microfone aberto — chamada', telas: 'telas',
    faltaAcessibilidade: 'Falta a permissão de Acessibilidade.',
    faltaAcessibilidadeTexto: 'Sem ela eu vejo qual aplicativo está na frente, mas não o título da janela — então não dá para saber em que você estava trabalhando, só onde.',
    atalhoPermissao: 'O atalho, na pasta do projeto:',
    outros: 'outros',
  },
  ritmo: {
    titulo: 'Ritmo', diasMedidos: 'dias medidos', diaMedido: 'dia medido', entre: 'entre', e: 'e',
    dias7: '7 dias', dias30: '30 dias', dias90: '90 dias',
    semDias: 'Ainda não há dias medidos o bastante.',
    ritmoAparece: 'O ritmo aparece quando houver pelo menos dois dias com atividade.',
    tempoTotal: 'tempo total', mediaPorDia: 'por dia medido',
    focoMedio: 'foco médio', focoMedioNota: 'ponderado pelo tempo de cada janela',
    diaMaisLongo: 'dia mais longo', producao: 'produção', commits: 'commits',
    quandoTrabalha: 'quando você trabalha', horaPorDia: 'hora × dia da semana',
    somaDoPeriodo: 'soma de todo o período', noTotal: 'no total',
    tendencia: 'tendência', tempoAtivoPorDia: 'tempo ativo por dia', mediaDe: 'média de',
    porDiaMedido: 'por dia medido', precisaTresDias: 'Precisa de pelo menos três dias medidos para a tendência.',
    ondeOTempoFoi: 'onde o tempo foi no período', porCategoria: 'por categoria',
    projetos: 'projetos', semProjeto: 'Sem projeto atribuído ainda.',
    assinatura: 'sua assinatura de teclado', semAtalhos: 'Sem atalhos capturados no período.',
    sites: 'sites', caracteres: 'caracteres digitados no período',
  },
  diario: {
    titulo: 'Diário', subtitulo: 'o que o computador viu, escrito pelo Claude Code',
    semDias: 'Nenhum dia medido ainda.', amanhaEnche: 'Amanhã de manhã esta lista começa a encher sozinha.',
    semNarrativa: 'sem narrativa', naoEscrito: 'Este dia foi medido mas ainda não foi escrito.',
    escreverDia: 'escrever este dia', escrevendo: 'escrevendo…',
    reescrever: 'reescrever', reescrevendo: 'reescrevendo…',
    resumoDoDia: 'resumo do dia', oRecap: 'o recap',
    claudeNaoRespondeu: 'O Claude Code não respondeu.',
    claudeTexto: 'Sem ele a medição continua inteira, mas o diário não é escrito. Confira se o comando claude está instalado e logado.',
  },
  conversa: {
    titulo: 'Pergunte sobre', tituloForte: 'o seu dia',
    explicacao: 'Eu consulto o que foi medido nesta máquina — tempo por app e janela, projetos, commits, sites, atalhos, o que você digitou e o que pediu aos agentes. Nada disso sai daqui.',
    placeholder: 'pergunte qualquer coisa sobre o seu tempo',
    ouvindo: 'ouvindo… pare de falar que eu envio', transcrevendo: 'transcrevendo…',
    reconectando: 'reconectando ao núcleo…', pensando: 'pensando…', consultando: 'consultando',
    enviar: 'enviar', falar: 'falar', pararDeOuvir: 'parar de ouvir', calar: 'parar de falar',
    vozSempre: 'responder sempre falando', vozQuandoFalar: 'responder falando só quando você falar',
    nucleoFora: 'O núcleo está fora do ar. Assim que ele voltar, mande de novo.',
    ouvir: 'ouvir', cliqueParaFalar: 'clique para falar',
    sugestoes: [
      'Me dá um recap divertido do meu histórico: padrão de trabalho, distrações, atalhos favoritos, meu estilo de escrita e uma zoeira leve',
      'Onde foi meu tempo essa semana?',
      'Em que projeto eu mais trabalhei nos últimos 30 dias?',
      'Qual foi minha maior distração ontem?',
      'A que horas eu rendo mais?',
    ],
  },
  ajustes: {
    titulo: 'Ajustes', subtitulo: 'tudo fica nesta máquina',
    idioma: 'idioma', idiomaNota: 'vale para a interface, o diário, a conversa e a voz',
    nome: 'como te chamar', nomeNota: 'usado no diário e na conversa',
    vault: 'vault do Obsidian', vaultNota: 'onde o resumo de cada dia é escrito',
    escolherPasta: 'escolher pasta', semVault: 'nenhuma pasta escolhida — o diário não é gravado',
    pastaDoDiario: 'subpasta do diário',
    chaves: 'chaves', chavesNota: 'guardadas no Chaveiro do macOS, nunca em arquivo de texto',
    guardadoNoChaveiro: 'guardada no Chaveiro',
    jevChave: 'chave do jev (TypeSafe)', jevNota: 'classifica cada janela em categoria e projeto',
    openaiChave: 'chave da OpenAI', openaiNota: 'só para falar e transcrever; a conversa é sempre Claude Code',
    opcional: 'opcional', configurada: 'configurada', naoConfigurada: 'não configurada', remover: 'remover',
    dia: 'o dia começa às', diaNota: 'madrugada conta para o dia anterior', horas: 'h',
    digitacao: 'guardar o que você digita', digitacaoNota: 'já passa por redação de segredos; desligue se preferir só os números',
    salvar: 'salvar', salvo: 'salvo', salvando: 'salvando…', testar: 'testar', funcionando: 'funcionando', falhou: 'falhou',
    agentes: 'medir sozinho, desde o login',
    agentesNota: 'o coletor, o leitor de janela e a escuta sobem com o Mac e voltam se caírem',
    agentesLigados: 'ligados', agentesDesligados: 'desligados',
    agentesAprovar: 'registrados — falta você aprovar',
    agentesOnde: 'Ajustes → Geral → Itens de Início',
  },
  contagem: {
    trecho: ['trecho', 'trechos'], sessao: ['sessão sustentada', 'sessões sustentadas'],
    projeto: ['projeto', 'projetos'], commit: ['commit', 'commits'],
    pedidoIA: ['pedido de IA', 'pedidos de IA'], visita: ['visita de navegador', 'visitas de navegador'],
    site: ['site', 'sites'], dia: ['dia medido', 'dias medidos'], janela: ['janela', 'janelas'],
  },
  comum: {
    min: 'min', h: 'h', s: 's', de: 'de', sem: 'sem', fechar: 'fechar',
    ativo: 'ativo', noTotal: 'no total', nadaAqui: 'Nada aqui ainda.', semTempo: 'Sem tempo medido.',
    agente: 'agente trabalhando', as: 'às', doAtivo: 'do ativo',
    sessao: 'sessão', sessoes: 'sessões', mediaDe: 'média de', porDia: 'por dia medido',
    outros: (n) => `outros ${n}`,
    restoNaTela: '… o resto está escrito na tela.', naoEntendi: 'Não entendi o que você falou.',
    microfoneNegado: 'O microfone foi negado. Autorize em Ajustes → Privacidade e Segurança → Microfone.',
  },
}

const en: Textos = {
  abas: { hoje: 'Today', ritmo: 'Rhythm', diario: 'Journal', conversa: 'Chat', ajustes: 'Settings' },
  estado: {
    marca: 'the machine’s memory',
    fonte: { 'aguardando-permissao': 'waiting for you to allow it', 'sem-permissao': 'no permission', nunca: 'not tried yet' },
    medindo: 'measuring', ocioso: 'idle', parado: 'stopped', nucleoDesligado: 'core is down',
    emFoco: 'in focus', acessibilidade: 'accessibility', classificacao: 'window classification',
    narrativa: 'writing and chat',
    subaComNucleo: 'Start it with', semNucleo: 'The core is not responding.',
  },
  hoje: {
    titulo: 'Today', hoje: 'Today', carregando: 'Loading…',
    diaAnterior: '← previous day', hojeBotao: 'today', diaSeguinte: 'next day →',
    das: 'from', as: 'to', maquinaParada: 'of idle machine', nadaMedido: 'nothing measured yet',
    medindoSemAtividade: 'Measuring, but no activity:', voltaAoTeclado: 'The moment you come back to the keyboard, this fills in on its own.',
    coletorGrava: 'The collector records from the moment it starts — there is no history before that.',
    soEnxerga: 'Hipocampo only sees from the day it started measuring.',
    seuTempo: 'your time', longeDaMaquina: 'away from the machine',
    delegado: 'delegated work', delegadoNota: 'agents producing while you did something else',
    semDelegado: 'no agent worked outside your time',
    concentrado: 'focused work', concentradoNota: 'time in code, AI, writing, design and research',
    trocas: 'app switches', trocasNota: (n) => `${n} changed project — only those cost you`,
    dominou: 'app that dominated', maiorFatia: 'biggest slice was',
    fita: 'the day as a ribbon', trechos: 'stretches', curtosDemais: 'too short to draw',
    passeOMouse: 'hover the ribbon to see the window',
    formaDoFoco: 'the shape of focus', sessoes: 'sustained sessions',
    formaNota: 'minutes by session length — a 15min window at 75% focus, with no break longer than 2min',
    semSessao: 'No focus session held together on this day.',
    medianaDe: 'median of', aMaiorFoi: 'the longest was',
    ondeOTempoFoi: 'where the time went', porCategoria: 'by category', projetos: 'projects touched',
    semProjeto: 'jev has not assigned a project to any window of this day yet.',
    janelas: 'windows you stayed in most', semTitulos: 'No window titles — accessibility is missing.',
    maos: 'your hands', teclas: 'keys', cliques: 'clicks', rolagem: 'scroll gestures',
    escrevendo: 'writing', lendo: 'reading', misto: 'mixed',
    maosNota: 'the bar is the share of keys over the total — full means writing, empty means reading. These are counts of system events, not distance: scroll is how many times you scrolled, not how far. And what you typed is not stored here, only how much.',
    semTeclado: 'No keyboard signal yet.',
    saiuDasMaos: 'what came out', commits: 'commits', pedidosIA: 'AI requests',
    nadaRegistrado: 'Nothing recorded.',
    sinais: 'signals', visitas: 'browser visits', sites: 'sites', atalhos: 'shortcuts',
    caracteresDigitados: 'characters typed across', som: 'sound', algoTocando: 'with something playing',
    chamada: 'microphone open — a call', telas: 'screens',
    faltaAcessibilidade: 'Accessibility permission is missing.',
    faltaAcessibilidadeTexto: 'Without it I see which app is in front, but not the window title — so there is no way to know what you were working on, only where.',
    atalhoPermissao: 'The shortcut, in the project folder:',
    outros: 'others',
  },
  ritmo: {
    titulo: 'Rhythm', diasMedidos: 'days measured', diaMedido: 'day measured', entre: 'between', e: 'and',
    dias7: '7 days', dias30: '30 days', dias90: '90 days',
    semDias: 'Not enough measured days yet.',
    ritmoAparece: 'The rhythm appears once there are at least two days with activity.',
    tempoTotal: 'total time', mediaPorDia: 'per measured day',
    focoMedio: 'average focus', focoMedioNota: 'weighted by the time of each window',
    diaMaisLongo: 'longest day', producao: 'output', commits: 'commits',
    quandoTrabalha: 'when you work', horaPorDia: 'hour × weekday',
    somaDoPeriodo: 'sum of the whole period', noTotal: 'in total',
    tendencia: 'trend', tempoAtivoPorDia: 'active time per day', mediaDe: 'average of',
    porDiaMedido: 'per measured day', precisaTresDias: 'Needs at least three measured days for a trend.',
    ondeOTempoFoi: 'where the time went in the period', porCategoria: 'by category',
    projetos: 'projects', semProjeto: 'No project assigned yet.',
    assinatura: 'your keyboard signature', semAtalhos: 'No shortcuts captured in the period.',
    sites: 'sites', caracteres: 'characters typed in the period',
  },
  diario: {
    titulo: 'Journal', subtitulo: 'what the computer saw, written by Claude Code',
    semDias: 'No days measured yet.', amanhaEnche: 'Tomorrow morning this list starts filling on its own.',
    semNarrativa: 'not written', naoEscrito: 'This day was measured but has not been written yet.',
    escreverDia: 'write this day', escrevendo: 'writing…',
    reescrever: 'rewrite', reescrevendo: 'rewriting…',
    resumoDoDia: 'summary of the day', oRecap: 'the recap',
    claudeNaoRespondeu: 'Claude Code did not answer.',
    claudeTexto: 'Without it the measuring carries on intact, but the journal is not written. Check that the claude command is installed and signed in.',
  },
  conversa: {
    titulo: 'Ask about', tituloForte: 'your day',
    explicacao: 'I look up what was measured on this machine — time per app and window, projects, commits, sites, shortcuts, what you typed and what you asked the agents. None of it leaves here.',
    placeholder: 'ask anything about your time',
    ouvindo: 'listening… stop talking and I send it', transcrevendo: 'transcribing…',
    reconectando: 'reconnecting to the core…', pensando: 'thinking…', consultando: 'looking up',
    enviar: 'send', falar: 'speak', pararDeOuvir: 'stop listening', calar: 'stop talking',
    vozSempre: 'always answer out loud', vozQuandoFalar: 'answer out loud only when you speak',
    nucleoFora: 'The core is down. Send it again once it is back.',
    ouvir: 'listen', cliqueParaFalar: 'click to speak',
    sugestoes: [
      'Give me a fun recap of my history: work patterns, distractions, favourite shortcuts, my writing style and a light roast',
      'Where did my time go this week?',
      'Which project did I work on most over the last 30 days?',
      'What was my biggest distraction yesterday?',
      'What time of day do I do my best work?',
    ],
  },
  ajustes: {
    titulo: 'Settings', subtitulo: 'everything stays on this machine',
    idioma: 'language', idiomaNota: 'applies to the interface, the journal, the chat and the voice',
    nome: 'what to call you', nomeNota: 'used in the journal and the chat',
    vault: 'Obsidian vault', vaultNota: 'where each day’s summary is written',
    escolherPasta: 'choose folder', semVault: 'no folder chosen — the journal is not written',
    pastaDoDiario: 'journal subfolder',
    chaves: 'keys', chavesNota: 'kept in the macOS Keychain, never in a text file',
    guardadoNoChaveiro: 'in the Keychain',
    jevChave: 'jev (TypeSafe) key', jevNota: 'classifies each window into a category and a project',
    openaiChave: 'OpenAI key', openaiNota: 'only for speaking and transcribing; the chat is always Claude Code',
    opcional: 'optional', configurada: 'set', naoConfigurada: 'not set', remover: 'remove',
    dia: 'the day starts at', diaNota: 'the small hours count as the day before', horas: ':00',
    digitacao: 'keep what you type', digitacaoNota: 'secrets are already redacted; turn it off if you prefer only the numbers',
    salvar: 'save', salvo: 'saved', salvando: 'saving…', testar: 'test', funcionando: 'working', falhou: 'failed',
    agentes: 'measure on its own, from login',
    agentesNota: 'the collector, the window reader and the listener start with the Mac and come back if they fall',
    agentesLigados: 'on', agentesDesligados: 'off',
    agentesAprovar: 'registered — waiting for you to approve',
    agentesOnde: 'Settings → General → Login Items',
  },
  contagem: {
    trecho: ['stretch', 'stretches'], sessao: ['sustained session', 'sustained sessions'],
    projeto: ['project', 'projects'], commit: ['commit', 'commits'],
    pedidoIA: ['AI request', 'AI requests'], visita: ['browser visit', 'browser visits'],
    site: ['site', 'sites'], dia: ['day measured', 'days measured'], janela: ['window', 'windows'],
  },
  comum: {
    min: 'min', h: 'h', s: 's', de: 'of', sem: 'no', fechar: 'close',
    ativo: 'active', noTotal: 'in total', nadaAqui: 'Nothing here yet.', semTempo: 'No time measured.',
    agente: 'agent working', as: 'at', doAtivo: 'of active',
    sessao: 'session', sessoes: 'sessions', mediaDe: 'average of', porDia: 'per measured day',
    outros: (n) => `${n} others`,
    restoNaTela: '… the rest is written on screen.', naoEntendi: 'I did not catch that.',
    microfoneNegado: 'The microphone was denied. Allow it in Settings → Privacy & Security → Microphone.',
  },
}

const es: Textos = {
  abas: { hoje: 'Hoy', ritmo: 'Ritmo', diario: 'Diario', conversa: 'Conversación', ajustes: 'Ajustes' },
  estado: {
    marca: 'la memoria de la máquina',
    fonte: { 'aguardando-permissao': 'esperando que lo permitas', 'sem-permissao': 'sin permiso', nunca: 'aún no lo intentó' },
    medindo: 'midiendo', ocioso: 'inactivo', parado: 'parado', nucleoDesligado: 'núcleo apagado',
    emFoco: 'en foco', acessibilidade: 'accesibilidad', classificacao: 'clasificación de ventanas',
    narrativa: 'redacción y conversación',
    subaComNucleo: 'Arráncalo con', semNucleo: 'El núcleo no responde.',
  },
  hoje: {
    titulo: 'Hoy', hoje: 'Hoy', carregando: 'Cargando…',
    diaAnterior: '← día anterior', hojeBotao: 'hoy', diaSeguinte: 'día siguiente →',
    das: 'de', as: 'a', maquinaParada: 'de máquina parada', nadaMedido: 'nada medido todavía',
    medindoSemAtividade: 'Midiendo, pero sin actividad:', voltaAoTeclado: 'En cuanto vuelvas al teclado, esta pantalla se llena sola.',
    coletorGrava: 'El recolector graba desde que arranca — antes de eso no hay historial.',
    soEnxerga: 'Hipocampo solo ve desde el día en que empezó a medir.',
    seuTempo: 'tu tiempo', longeDaMaquina: 'lejos de la máquina',
    delegado: 'trabajo delegado', delegadoNota: 'agentes produciendo mientras hacías otra cosa',
    semDelegado: 'ningún agente trabajó fuera de tu tiempo',
    concentrado: 'trabajo concentrado', concentradoNota: 'tiempo en código, IA, escritura, diseño e investigación',
    trocas: 'cambios de aplicación', trocasNota: (n) => `${n} cambiaron de proyecto — solo esos cuestan caro`,
    dominou: 'aplicación que dominó', maiorFatia: 'la mayor porción fue',
    fita: 'la cinta del día', trechos: 'tramos', curtosDemais: 'demasiado cortos para dibujar',
    passeOMouse: 'pasa el ratón por la cinta para ver la ventana',
    formaDoFoco: 'la forma del foco', sessoes: 'sesiones sostenidas',
    formaNota: 'minutos por tamaño de sesión — tramo de 15min con 75% de foco, sin pausa mayor de 2min',
    semSessao: 'Ninguna sesión de foco se sostuvo este día.',
    medianaDe: 'mediana de', aMaiorFoi: 'la mayor fue',
    ondeOTempoFoi: 'dónde fue el tiempo', porCategoria: 'por categoría', projetos: 'proyectos tocados',
    semProjeto: 'jev aún no asignó proyecto a ninguna ventana de este día.',
    janelas: 'ventanas donde más estuviste', semTitulos: 'Sin títulos de ventana — falta accesibilidad.',
    maos: 'tus manos', teclas: 'teclas', cliques: 'clics', rolagem: 'gestos de desplazamiento',
    escrevendo: 'escribiendo', lendo: 'leyendo', misto: 'mixto',
    maosNota: 'la barra es la porción de teclas sobre el total — llena es escribir, vacía es leer. Son recuentos de eventos del sistema, no distancia: el desplazamiento es cuántas veces te desplazaste, no cuánto. Y lo que escribiste no se guarda aquí, solo cuánto.',
    semTeclado: 'Sin señal de teclado todavía.',
    saiuDasMaos: 'lo que salió', commits: 'commits', pedidosIA: 'peticiones a la IA',
    nadaRegistrado: 'Nada registrado.',
    sinais: 'señales', visitas: 'visitas de navegador', sites: 'sitios', atalhos: 'atajos',
    caracteresDigitados: 'caracteres escritos en', som: 'sonido', algoTocando: 'con algo sonando',
    chamada: 'micrófono abierto — llamada', telas: 'pantallas',
    faltaAcessibilidade: 'Falta el permiso de accesibilidad.',
    faltaAcessibilidadeTexto: 'Sin él veo qué aplicación está delante, pero no el título de la ventana — así que no hay forma de saber en qué trabajabas, solo dónde.',
    atalhoPermissao: 'El atajo, en la carpeta del proyecto:',
    outros: 'otros',
  },
  ritmo: {
    titulo: 'Ritmo', diasMedidos: 'días medidos', diaMedido: 'día medido', entre: 'entre', e: 'y',
    dias7: '7 días', dias30: '30 días', dias90: '90 días',
    semDias: 'Todavía no hay suficientes días medidos.',
    ritmoAparece: 'El ritmo aparece cuando haya al menos dos días con actividad.',
    tempoTotal: 'tiempo total', mediaPorDia: 'por día medido',
    focoMedio: 'foco medio', focoMedioNota: 'ponderado por el tiempo de cada ventana',
    diaMaisLongo: 'día más largo', producao: 'producción', commits: 'commits',
    quandoTrabalha: 'cuándo trabajas', horaPorDia: 'hora × día de la semana',
    somaDoPeriodo: 'suma de todo el periodo', noTotal: 'en total',
    tendencia: 'tendencia', tempoAtivoPorDia: 'tiempo activo por día', mediaDe: 'media de',
    porDiaMedido: 'por día medido', precisaTresDias: 'Necesita al menos tres días medidos para la tendencia.',
    ondeOTempoFoi: 'dónde fue el tiempo en el periodo', porCategoria: 'por categoría',
    projetos: 'proyectos', semProjeto: 'Sin proyecto asignado todavía.',
    assinatura: 'tu firma de teclado', semAtalhos: 'Sin atajos capturados en el periodo.',
    sites: 'sitios', caracteres: 'caracteres escritos en el periodo',
  },
  diario: {
    titulo: 'Diario', subtitulo: 'lo que el ordenador vio, escrito por Claude Code',
    semDias: 'Ningún día medido todavía.', amanhaEnche: 'Mañana por la mañana esta lista empieza a llenarse sola.',
    semNarrativa: 'sin escribir', naoEscrito: 'Este día se midió pero aún no se escribió.',
    escreverDia: 'escribir este día', escrevendo: 'escribiendo…',
    reescrever: 'reescribir', reescrevendo: 'reescribiendo…',
    resumoDoDia: 'resumen del día', oRecap: 'el resumen divertido',
    claudeNaoRespondeu: 'Claude Code no respondió.',
    claudeTexto: 'Sin él la medición sigue entera, pero el diario no se escribe. Comprueba que el comando claude esté instalado y con sesión iniciada.',
  },
  conversa: {
    titulo: 'Pregunta sobre', tituloForte: 'tu día',
    explicacao: 'Consulto lo que se midió en esta máquina — tiempo por app y ventana, proyectos, commits, sitios, atajos, lo que escribiste y lo que pediste a los agentes. Nada de eso sale de aquí.',
    placeholder: 'pregunta cualquier cosa sobre tu tiempo',
    ouvindo: 'escuchando… deja de hablar y lo envío', transcrevendo: 'transcribiendo…',
    reconectando: 'reconectando al núcleo…', pensando: 'pensando…', consultando: 'consultando',
    enviar: 'enviar', falar: 'hablar', pararDeOuvir: 'dejar de escuchar', calar: 'dejar de hablar',
    vozSempre: 'responder siempre en voz alta', vozQuandoFalar: 'responder en voz alta solo cuando hables',
    nucleoFora: 'El núcleo está caído. Envíalo de nuevo cuando vuelva.',
    ouvir: 'escuchar', cliqueParaFalar: 'haz clic para hablar',
    sugestoes: [
      'Dame un resumen divertido de mi historial: patrón de trabajo, distracciones, atajos favoritos, mi estilo de escritura y una pulla suave',
      '¿Dónde se fue mi tiempo esta semana?',
      '¿En qué proyecto trabajé más en los últimos 30 días?',
      '¿Cuál fue mi mayor distracción ayer?',
      '¿A qué hora rindo más?',
    ],
  },
  ajustes: {
    titulo: 'Ajustes', subtitulo: 'todo se queda en esta máquina',
    idioma: 'idioma', idiomaNota: 'vale para la interfaz, el diario, la conversación y la voz',
    nome: 'cómo llamarte', nomeNota: 'se usa en el diario y en la conversación',
    vault: 'vault de Obsidian', vaultNota: 'donde se escribe el resumen de cada día',
    escolherPasta: 'elegir carpeta', semVault: 'ninguna carpeta elegida — el diario no se graba',
    pastaDoDiario: 'subcarpeta del diario',
    chaves: 'claves', chavesNota: 'guardadas en el Llavero de macOS, nunca en un archivo de texto',
    guardadoNoChaveiro: 'en el Llavero',
    jevChave: 'clave de jev (TypeSafe)', jevNota: 'clasifica cada ventana en categoría y proyecto',
    openaiChave: 'clave de OpenAI', openaiNota: 'solo para hablar y transcribir; la conversación es siempre Claude Code',
    opcional: 'opcional', configurada: 'configurada', naoConfigurada: 'sin configurar', remover: 'quitar',
    dia: 'el día empieza a las', diaNota: 'la madrugada cuenta para el día anterior', horas: 'h',
    digitacao: 'guardar lo que escribes', digitacaoNota: 'los secretos ya se redactan; desactívalo si prefieres solo los números',
    salvar: 'guardar', salvo: 'guardado', salvando: 'guardando…', testar: 'probar', funcionando: 'funciona', falhou: 'falló',
    agentes: 'medir solo, desde el inicio de sesión',
    agentesNota: 'el recolector, el lector de ventanas y la escucha arrancan con el Mac y vuelven si se caen',
    agentesLigados: 'encendidos', agentesDesligados: 'apagados',
    agentesAprovar: 'registrados — falta que los apruebes',
    agentesOnde: 'Ajustes → General → Ítems de inicio',
  },
  contagem: {
    trecho: ['tramo', 'tramos'], sessao: ['sesión sostenida', 'sesiones sostenidas'],
    projeto: ['proyecto', 'proyectos'], commit: ['commit', 'commits'],
    pedidoIA: ['petición a la IA', 'peticiones a la IA'], visita: ['visita de navegador', 'visitas de navegador'],
    site: ['sitio', 'sitios'], dia: ['día medido', 'días medidos'], janela: ['ventana', 'ventanas'],
  },
  comum: {
    min: 'min', h: 'h', s: 's', de: 'de', sem: 'sin', fechar: 'cerrar',
    ativo: 'activo', noTotal: 'en total', nadaAqui: 'Nada aquí todavía.', semTempo: 'Sin tiempo medido.',
    agente: 'agente trabajando', as: 'a las', doAtivo: 'del activo',
    sessao: 'sesión', sessoes: 'sesiones', mediaDe: 'media de', porDia: 'por día medido',
    outros: (n) => `otros ${n}`,
    restoNaTela: '… el resto está escrito en la pantalla.', naoEntendi: 'No entendí lo que dijiste.',
    microfoneNegado: 'El micrófono fue denegado. Permítelo en Ajustes → Privacidad y seguridad → Micrófono.',
  },
}

const fr: Textos = {
  abas: { hoje: 'Aujourd’hui', ritmo: 'Rythme', diario: 'Journal', conversa: 'Conversation', ajustes: 'Réglages' },
  estado: {
    marca: 'la mémoire de la machine',
    fonte: { 'aguardando-permissao': 'en attente de ton autorisation', 'sem-permissao': 'sans autorisation', nunca: 'pas encore tenté' },
    medindo: 'mesure en cours', ocioso: 'inactif', parado: 'arrêté', nucleoDesligado: 'le noyau est éteint',
    emFoco: 'concentré', acessibilidade: 'accessibilité', classificacao: 'classement des fenêtres',
    narrativa: 'rédaction et conversation',
    subaComNucleo: 'Lance-le avec', semNucleo: 'Le noyau ne répond pas.',
  },
  hoje: {
    titulo: 'Aujourd’hui', hoje: 'Aujourd’hui', carregando: 'Chargement…',
    diaAnterior: '← jour précédent', hojeBotao: 'aujourd’hui', diaSeguinte: 'jour suivant →',
    das: 'de', as: 'à', maquinaParada: 'de machine à l’arrêt', nadaMedido: 'rien de mesuré pour l’instant',
    medindoSemAtividade: 'La mesure tourne, mais sans activité :', voltaAoTeclado: 'Dès que tu reviens au clavier, cet écran se remplit tout seul.',
    coletorGrava: 'Le collecteur enregistre à partir du moment où il démarre — rien n’existe avant.',
    soEnxerga: 'Hipocampo ne voit qu’à partir du jour où il a commencé à mesurer.',
    seuTempo: 'ton temps', longeDaMaquina: 'loin de la machine',
    delegado: 'travail délégué', delegadoNota: 'des agents produisaient pendant que tu faisais autre chose',
    semDelegado: 'aucun agent n’a travaillé en dehors de ton temps',
    concentrado: 'travail concentré', concentradoNota: 'temps passé en code, IA, écriture, design et recherche',
    trocas: 'changements d’application', trocasNota: (n) => `${n} ont changé de projet — seuls ceux-là coûtent cher`,
    dominou: 'application dominante', maiorFatia: 'la plus grosse part revient à',
    fita: 'la journée en ruban', trechos: 'segments', curtosDemais: 'trop courts pour être dessinés',
    passeOMouse: 'survole le ruban pour voir la fenêtre',
    formaDoFoco: 'la forme de la concentration', sessoes: 'sessions tenues',
    formaNota: 'minutes par durée de session — fenêtre de 15 min à 75 % de concentration, sans pause de plus de 2 min',
    semSessao: 'Aucune session de concentration n’a tenu ce jour-là.',
    medianaDe: 'médiane de', aMaiorFoi: 'la plus longue a duré',
    ondeOTempoFoi: 'où est passé le temps', porCategoria: 'par catégorie', projetos: 'projets touchés',
    semProjeto: 'jev n’a encore attribué de projet à aucune fenêtre de ce jour.',
    janelas: 'fenêtres où tu es resté le plus', semTitulos: 'Aucun titre de fenêtre — l’accessibilité manque.',
    maos: 'tes mains', teclas: 'touches', cliques: 'clics', rolagem: 'gestes de défilement',
    escrevendo: 'écriture', lendo: 'lecture', misto: 'mixte',
    maosNota: 'la barre est la part des touches sur le total — pleine, c’est écrire ; vide, c’est lire. Ce sont des comptes d’événements système, pas une distance : le défilement, c’est combien de fois tu as fait défiler, pas de combien. Et ce que tu as tapé n’est pas gardé ici, seulement la quantité.',
    semTeclado: 'Aucun signal du clavier pour l’instant.',
    saiuDasMaos: 'ce qui en est sorti', commits: 'commits', pedidosIA: 'requêtes à l’IA',
    nadaRegistrado: 'Rien d’enregistré.',
    sinais: 'signaux', visitas: 'visites de navigateur', sites: 'sites', atalhos: 'raccourcis',
    caracteresDigitados: 'caractères tapés dans', som: 'son', algoTocando: 'avec quelque chose qui jouait',
    chamada: 'micro ouvert — un appel', telas: 'écrans',
    faltaAcessibilidade: 'La permission d’accessibilité manque.',
    faltaAcessibilidadeTexto: 'Sans elle je vois quelle application est au premier plan, mais pas le titre de la fenêtre — impossible donc de savoir sur quoi tu travaillais, seulement où.',
    atalhoPermissao: 'Le raccourci, dans le dossier du projet :',
    outros: 'autres',
  },
  ritmo: {
    titulo: 'Rythme', diasMedidos: 'jours mesurés', diaMedido: 'jour mesuré', entre: 'entre', e: 'et',
    dias7: '7 jours', dias30: '30 jours', dias90: '90 jours',
    semDias: 'Pas encore assez de jours mesurés.',
    ritmoAparece: 'Le rythme apparaît dès qu’il y a au moins deux jours avec de l’activité.',
    tempoTotal: 'temps total', mediaPorDia: 'par jour mesuré',
    focoMedio: 'concentration moyenne', focoMedioNota: 'pondérée par le temps de chaque fenêtre',
    diaMaisLongo: 'journée la plus longue', producao: 'production', commits: 'commits',
    quandoTrabalha: 'quand tu travailles', horaPorDia: 'heure × jour de la semaine',
    somaDoPeriodo: 'somme de toute la période', noTotal: 'au total',
    tendencia: 'tendance', tempoAtivoPorDia: 'temps actif par jour', mediaDe: 'moyenne de',
    porDiaMedido: 'par jour mesuré', precisaTresDias: 'Il faut au moins trois jours mesurés pour une tendance.',
    ondeOTempoFoi: 'où est passé le temps sur la période', porCategoria: 'par catégorie',
    projetos: 'projets', semProjeto: 'Aucun projet attribué pour l’instant.',
    assinatura: 'ta signature au clavier', semAtalhos: 'Aucun raccourci capté sur la période.',
    sites: 'sites', caracteres: 'caractères tapés sur la période',
  },
  diario: {
    titulo: 'Journal', subtitulo: 'ce que l’ordinateur a vu, écrit par Claude Code',
    semDias: 'Aucun jour mesuré pour l’instant.', amanhaEnche: 'Demain matin cette liste commence à se remplir toute seule.',
    semNarrativa: 'non écrit', naoEscrito: 'Ce jour a été mesuré mais pas encore écrit.',
    escreverDia: 'écrire cette journée', escrevendo: 'écriture…',
    reescrever: 'réécrire', reescrevendo: 'réécriture…',
    resumoDoDia: 'résumé de la journée', oRecap: 'le récap',
    claudeNaoRespondeu: 'Claude Code n’a pas répondu.',
    claudeTexto: 'Sans lui la mesure continue intacte, mais le journal ne s’écrit pas. Vérifie que la commande claude est installée et connectée.',
  },
  conversa: {
    titulo: 'Pose une question sur', tituloForte: 'ta journée',
    explicacao: 'Je consulte ce qui a été mesuré sur cette machine — temps par application et par fenêtre, projets, commits, sites, raccourcis, ce que tu as tapé et ce que tu as demandé aux agents. Rien de tout ça ne sort d’ici.',
    placeholder: 'demande ce que tu veux sur ton temps',
    ouvindo: 'j’écoute… arrête de parler et j’envoie', transcrevendo: 'transcription…',
    reconectando: 'reconnexion au noyau…', pensando: 'réflexion…', consultando: 'consultation',
    enviar: 'envoyer', falar: 'parler', pararDeOuvir: 'arrêter d’écouter', calar: 'arrêter de parler',
    vozSempre: 'répondre toujours à voix haute', vozQuandoFalar: 'répondre à voix haute seulement quand tu parles',
    nucleoFora: 'Le noyau est éteint. Renvoie-le quand il sera revenu.',
    ouvir: 'écouter', cliqueParaFalar: 'clique pour parler',
    sugestoes: [
      'Fais-moi un récap amusant de mon historique : habitudes de travail, distractions, raccourcis préférés, mon style d’écriture et une petite pique',
      'Où est passé mon temps cette semaine ?',
      'Sur quel projet ai-je le plus travaillé ces 30 derniers jours ?',
      'Quelle a été ma plus grande distraction hier ?',
      'À quelle heure suis-je le plus efficace ?',
    ],
  },
  ajustes: {
    titulo: 'Réglages', subtitulo: 'tout reste sur cette machine',
    idioma: 'langue', idiomaNota: 'vaut pour l’interface, le journal, la conversation et la voix',
    nome: 'comment t’appeler', nomeNota: 'utilisé dans le journal et la conversation',
    vault: 'coffre Obsidian', vaultNota: 'où le résumé de chaque journée est écrit',
    escolherPasta: 'choisir un dossier', semVault: 'aucun dossier choisi — le journal n’est pas écrit',
    pastaDoDiario: 'sous-dossier du journal',
    chaves: 'clés', chavesNota: 'gardées dans le Trousseau de macOS, jamais dans un fichier texte',
    guardadoNoChaveiro: 'dans le Trousseau',
    jevChave: 'clé jev (TypeSafe)', jevNota: 'classe chaque fenêtre en catégorie et en projet',
    openaiChave: 'clé OpenAI', openaiNota: 'seulement pour parler et transcrire ; la conversation est toujours Claude Code',
    opcional: 'facultatif', configurada: 'configurée', naoConfigurada: 'non configurée', remover: 'retirer',
    dia: 'la journée commence à', diaNota: 'le petit matin compte pour la veille', horas: 'h',
    digitacao: 'garder ce que tu tapes', digitacaoNota: 'les secrets sont déjà masqués ; désactive si tu préfères seulement les chiffres',
    salvar: 'enregistrer', salvo: 'enregistré', salvando: 'enregistrement…', testar: 'tester', funcionando: 'fonctionne', falhou: 'a échoué',
    agentes: 'mesurer tout seul, dès l’ouverture de session',
    agentesNota: 'le collecteur, le lecteur de fenêtre et l’écoute démarrent avec le Mac et reviennent s’ils tombent',
    agentesLigados: 'activés', agentesDesligados: 'désactivés',
    agentesAprovar: 'enregistrés — il ne manque que ton accord',
    agentesOnde: 'Réglages → Général → Ouverture',
  },
  contagem: {
    trecho: ['segment', 'segments'], sessao: ['session tenue', 'sessions tenues'],
    projeto: ['projet', 'projets'], commit: ['commit', 'commits'],
    pedidoIA: ['requête à l’IA', 'requêtes à l’IA'], visita: ['visite de navigateur', 'visites de navigateur'],
    site: ['site', 'sites'], dia: ['jour mesuré', 'jours mesurés'], janela: ['fenêtre', 'fenêtres'],
  },
  comum: {
    min: 'min', h: 'h', s: 's', de: 'de', sem: 'sans', fechar: 'fermer',
    ativo: 'actif', noTotal: 'au total', nadaAqui: 'Rien ici pour l’instant.', semTempo: 'Aucun temps mesuré.',
    agente: 'agent au travail', as: 'à', doAtivo: 'de l’actif',
    sessao: 'session', sessoes: 'sessions', mediaDe: 'moyenne de', porDia: 'par jour mesuré',
    outros: (n) => `${n} autres`,
    restoNaTela: '… le reste est écrit à l’écran.', naoEntendi: 'Je n’ai pas compris.',
    microfoneNegado: 'Le micro a été refusé. Autorise-le dans Réglages → Confidentialité et sécurité → Microphone.',
  },
}

const de: Textos = {
  abas: { hoje: 'Heute', ritmo: 'Rhythmus', diario: 'Tagebuch', conversa: 'Gespräch', ajustes: 'Einstellungen' },
  estado: {
    marca: 'das Gedächtnis der Maschine',
    fonte: { 'aguardando-permissao': 'wartet auf deine Erlaubnis', 'sem-permissao': 'keine Berechtigung', nunca: 'noch nicht versucht' },
    medindo: 'misst', ocioso: 'untätig', parado: 'steht still', nucleoDesligado: 'Kern ist aus',
    emFoco: 'konzentriert', acessibilidade: 'Bedienungshilfen', classificacao: 'Fensterklassifizierung',
    narrativa: 'Schreiben und Gespräch',
    subaComNucleo: 'Starte ihn mit', semNucleo: 'Der Kern antwortet nicht.',
  },
  hoje: {
    titulo: 'Heute', hoje: 'Heute', carregando: 'Lädt…',
    diaAnterior: '← voriger Tag', hojeBotao: 'heute', diaSeguinte: 'nächster Tag →',
    das: 'von', as: 'bis', maquinaParada: 'stillstehender Rechner', nadaMedido: 'noch nichts gemessen',
    medindoSemAtividade: 'Es wird gemessen, aber ohne Aktivität:', voltaAoTeclado: 'Sobald du zur Tastatur zurückkommst, füllt sich dieser Bildschirm von selbst.',
    coletorGrava: 'Der Sammler zeichnet ab dem Moment auf, in dem er startet — davor gibt es keine Historie.',
    soEnxerga: 'Hipocampo sieht erst ab dem Tag, an dem es zu messen begann.',
    seuTempo: 'deine Zeit', longeDaMaquina: 'weg vom Rechner',
    delegado: 'delegierte Arbeit', delegadoNota: 'Agenten haben produziert, während du etwas anderes gemacht hast',
    semDelegado: 'kein Agent hat außerhalb deiner Zeit gearbeitet',
    concentrado: 'konzentrierte Arbeit', concentradoNota: 'Zeit in Code, KI, Schreiben, Design und Recherche',
    trocas: 'App-Wechsel', trocasNota: (n) => `${n} haben das Projekt gewechselt — nur die kosten wirklich`,
    dominou: 'App, die dominiert hat', maiorFatia: 'das größte Stück ging an',
    fita: 'der Tag als Band', trechos: 'Abschnitte', curtosDemais: 'zu kurz zum Zeichnen',
    passeOMouse: 'fahre über das Band, um das Fenster zu sehen',
    formaDoFoco: 'die Form der Konzentration', sessoes: 'durchgehaltene Sitzungen',
    formaNota: 'Minuten nach Sitzungslänge — 15-Minuten-Fenster mit 75 % Fokus, ohne Pause über 2 Minuten',
    semSessao: 'An diesem Tag hat keine Fokus-Sitzung gehalten.',
    medianaDe: 'Median von', aMaiorFoi: 'die längste war',
    ondeOTempoFoi: 'wohin die Zeit ging', porCategoria: 'nach Kategorie', projetos: 'berührte Projekte',
    semProjeto: 'jev hat noch keinem Fenster dieses Tages ein Projekt zugeordnet.',
    janelas: 'Fenster, in denen du am längsten warst', semTitulos: 'Keine Fenstertitel — die Bedienungshilfen fehlen.',
    maos: 'deine Hände', teclas: 'Tasten', cliques: 'Klicks', rolagem: 'Scrollgesten',
    escrevendo: 'Schreiben', lendo: 'Lesen', misto: 'gemischt',
    maosNota: 'der Balken ist der Anteil der Tasten am Gesamten — voll heißt schreiben, leer heißt lesen. Das sind Zählungen von Systemereignissen, keine Strecke: Scrollen ist, wie oft du gescrollt hast, nicht wie weit. Und was du getippt hast, wird hier nicht gespeichert, nur wie viel.',
    semTeclado: 'Noch kein Signal von der Tastatur.',
    saiuDasMaos: 'was dabei herauskam', commits: 'Commits', pedidosIA: 'KI-Anfragen',
    nadaRegistrado: 'Nichts aufgezeichnet.',
    sinais: 'Signale', visitas: 'Browser-Aufrufe', sites: 'Seiten', atalhos: 'Kürzel',
    caracteresDigitados: 'Zeichen getippt in', som: 'Ton', algoTocando: 'mit etwas, das lief',
    chamada: 'Mikrofon offen — ein Anruf', telas: 'Bildschirme',
    faltaAcessibilidade: 'Die Berechtigung für Bedienungshilfen fehlt.',
    faltaAcessibilidadeTexto: 'Ohne sie sehe ich, welche App vorn ist, aber nicht den Fenstertitel — es lässt sich also nicht sagen, woran du gearbeitet hast, nur wo.',
    atalhoPermissao: 'Die Abkürzung, im Projektordner:',
    outros: 'andere',
  },
  ritmo: {
    titulo: 'Rhythmus', diasMedidos: 'gemessene Tage', diaMedido: 'gemessener Tag', entre: 'zwischen', e: 'und',
    dias7: '7 Tage', dias30: '30 Tage', dias90: '90 Tage',
    semDias: 'Noch nicht genug gemessene Tage.',
    ritmoAparece: 'Der Rhythmus erscheint, sobald es mindestens zwei Tage mit Aktivität gibt.',
    tempoTotal: 'Gesamtzeit', mediaPorDia: 'pro gemessenem Tag',
    focoMedio: 'durchschnittlicher Fokus', focoMedioNota: 'gewichtet nach der Zeit jedes Fensters',
    diaMaisLongo: 'längster Tag', producao: 'Ausstoß', commits: 'Commits',
    quandoTrabalha: 'wann du arbeitest', horaPorDia: 'Stunde × Wochentag',
    somaDoPeriodo: 'Summe des ganzen Zeitraums', noTotal: 'insgesamt',
    tendencia: 'Tendenz', tempoAtivoPorDia: 'aktive Zeit pro Tag', mediaDe: 'Durchschnitt von',
    porDiaMedido: 'pro gemessenem Tag', precisaTresDias: 'Für eine Tendenz braucht es mindestens drei gemessene Tage.',
    ondeOTempoFoi: 'wohin die Zeit im Zeitraum ging', porCategoria: 'nach Kategorie',
    projetos: 'Projekte', semProjeto: 'Noch kein Projekt zugeordnet.',
    assinatura: 'deine Tastatur-Handschrift', semAtalhos: 'Im Zeitraum keine Kürzel erfasst.',
    sites: 'Seiten', caracteres: 'Zeichen im Zeitraum getippt',
  },
  diario: {
    titulo: 'Tagebuch', subtitulo: 'was der Rechner gesehen hat, geschrieben von Claude Code',
    semDias: 'Noch keine Tage gemessen.', amanhaEnche: 'Morgen früh fängt diese Liste an, sich von selbst zu füllen.',
    semNarrativa: 'nicht geschrieben', naoEscrito: 'Dieser Tag wurde gemessen, aber noch nicht geschrieben.',
    escreverDia: 'diesen Tag schreiben', escrevendo: 'schreibt…',
    reescrever: 'neu schreiben', reescrevendo: 'schreibt neu…',
    resumoDoDia: 'Zusammenfassung des Tages', oRecap: 'der Rückblick',
    claudeNaoRespondeu: 'Claude Code hat nicht geantwortet.',
    claudeTexto: 'Ohne ihn läuft die Messung unverändert weiter, aber das Tagebuch wird nicht geschrieben. Prüfe, ob der Befehl claude installiert und angemeldet ist.',
  },
  conversa: {
    titulo: 'Frag nach', tituloForte: 'deinem Tag',
    explicacao: 'Ich schaue nach, was auf diesem Rechner gemessen wurde — Zeit pro App und Fenster, Projekte, Commits, Seiten, Kürzel, was du getippt und was du die Agenten gefragt hast. Nichts davon verlässt diesen Rechner.',
    placeholder: 'frag irgendetwas über deine Zeit',
    ouvindo: 'ich höre zu… hör auf zu sprechen und ich schicke es', transcrevendo: 'transkribiert…',
    reconectando: 'verbinde neu mit dem Kern…', pensando: 'denkt nach…', consultando: 'schlägt nach',
    enviar: 'senden', falar: 'sprechen', pararDeOuvir: 'nicht mehr zuhören', calar: 'nicht mehr sprechen',
    vozSempre: 'immer laut antworten', vozQuandoFalar: 'nur laut antworten, wenn du sprichst',
    nucleoFora: 'Der Kern ist aus. Schick es noch einmal, wenn er zurück ist.',
    ouvir: 'zuhören', cliqueParaFalar: 'klicken zum Sprechen',
    sugestoes: [
      'Gib mir einen lustigen Rückblick auf meine Historie: Arbeitsmuster, Ablenkungen, Lieblingskürzel, meinen Schreibstil und einen kleinen Seitenhieb',
      'Wohin ist diese Woche meine Zeit gegangen?',
      'An welchem Projekt habe ich in den letzten 30 Tagen am meisten gearbeitet?',
      'Was war gestern meine größte Ablenkung?',
      'Zu welcher Tageszeit arbeite ich am besten?',
    ],
  },
  ajustes: {
    titulo: 'Einstellungen', subtitulo: 'alles bleibt auf diesem Rechner',
    idioma: 'Sprache', idiomaNota: 'gilt für Oberfläche, Tagebuch, Gespräch und Stimme',
    nome: 'wie du genannt werden willst', nomeNota: 'wird im Tagebuch und im Gespräch benutzt',
    vault: 'Obsidian-Vault', vaultNota: 'wohin die Zusammenfassung jedes Tages geschrieben wird',
    escolherPasta: 'Ordner wählen', semVault: 'kein Ordner gewählt — das Tagebuch wird nicht geschrieben',
    pastaDoDiario: 'Unterordner des Tagebuchs',
    chaves: 'Schlüssel', chavesNota: 'im macOS-Schlüsselbund gespeichert, nie in einer Textdatei',
    guardadoNoChaveiro: 'im Schlüsselbund',
    jevChave: 'jev-Schlüssel (TypeSafe)', jevNota: 'ordnet jedes Fenster einer Kategorie und einem Projekt zu',
    openaiChave: 'OpenAI-Schlüssel', openaiNota: 'nur zum Sprechen und Transkribieren; das Gespräch ist immer Claude Code',
    opcional: 'optional', configurada: 'gesetzt', naoConfigurada: 'nicht gesetzt', remover: 'entfernen',
    dia: 'der Tag beginnt um', diaNota: 'die frühen Stunden zählen zum Vortag', horas: 'Uhr',
    digitacao: 'behalten, was du tippst', digitacaoNota: 'Geheimnisse werden schon geschwärzt; schalte es aus, wenn dir die Zahlen reichen',
    salvar: 'speichern', salvo: 'gespeichert', salvando: 'speichert…', testar: 'testen', funcionando: 'funktioniert', falhou: 'fehlgeschlagen',
    agentes: 'von der Anmeldung an selbst messen',
    agentesNota: 'Sammler, Fensterleser und Mithören starten mit dem Mac und kommen zurück, wenn sie ausfallen',
    agentesLigados: 'an', agentesDesligados: 'aus',
    agentesAprovar: 'registriert — wartet auf deine Zustimmung',
    agentesOnde: 'Einstellungen → Allgemein → Anmeldeobjekte',
  },
  contagem: {
    trecho: ['Abschnitt', 'Abschnitte'], sessao: ['durchgehaltene Sitzung', 'durchgehaltene Sitzungen'],
    projeto: ['Projekt', 'Projekte'], commit: ['Commit', 'Commits'],
    pedidoIA: ['KI-Anfrage', 'KI-Anfragen'], visita: ['Browser-Aufruf', 'Browser-Aufrufe'],
    site: ['Seite', 'Seiten'], dia: ['gemessener Tag', 'gemessene Tage'], janela: ['Fenster', 'Fenster'],
  },
  comum: {
    min: 'Min', h: 'Std', s: 's', de: 'von', sem: 'kein', fechar: 'schließen',
    ativo: 'aktiv', noTotal: 'insgesamt', nadaAqui: 'Noch nichts hier.', semTempo: 'Keine Zeit gemessen.',
    agente: 'Agent arbeitet', as: 'um', doAtivo: 'der aktiven Zeit',
    sessao: 'Sitzung', sessoes: 'Sitzungen', mediaDe: 'Durchschnitt von', porDia: 'pro gemessenem Tag',
    outros: (n) => `${n} weitere`,
    restoNaTela: '… der Rest steht auf dem Bildschirm.', naoEntendi: 'Das habe ich nicht verstanden.',
    microfoneNegado: 'Das Mikrofon wurde verweigert. Erlaube es in Einstellungen → Datenschutz & Sicherheit → Mikrofon.',
  },
}

/** Todos os idiomas, prontos para escolher. */
export const TEXTOS: Record<Idioma, Textos> = { 'pt-BR': pt, 'en-US': en, 'es-ES': es, 'fr-FR': fr, 'de-DE': de }
