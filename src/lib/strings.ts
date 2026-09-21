// Uma lista só de idiomas, compartilhada com o núcleo: o app e o diário
// precisam concordar sobre o que é um idioma válido.
import { LANGUAGES, type Language } from '../../core/languages.ts'
import type { PageKind } from '../../core/pages.ts'
import type { Touch } from '../../core/items.ts'
import type { WritingKind } from '../../core/metrics.ts'

type TouchSource = Touch['source']

export { LANGUAGES, type Language }

/**
 * Os textos da interface, em cinco idiomas.
 *
 * O tipo é fechado de propósito: acrescentar uma chave aqui quebra a compilação
 * enquanto os cinco idiomas não tiverem a tradução. É o que impede um idioma de
 * ficar pela metade sem ninguém perceber.
 */
export type Strings = {
  tabs: { today: string; rhythm: string; work: string; journal: string; chat: string; settings: string }
  status: {
    brand: string
    /** Por que uma fonte de dados não está coletando. */
    source: Record<'aguardando-permissao' | 'sem-permissao' | 'nunca', string>
    measuring: string; idle: string; stopped: string; coreDown: string
    inFocus: string; accessibility: string; classification: string; narrative: string
    startItWith: string; noCore: string
  }
  today: {
    title: string; today: string; loading: string
    previousDay: string; todayButton: string; nextDay: string
    from: string; to: string; idleMachine: string; nothingMeasured: string
    measuringNoActivity: string; backToKeyboard: string; collectorRecords: string; onlySees: string
    yourTime: string; awayFromMachine: string
    delegated: string; delegatedNote: string; noDelegated: string
    focused: string; focusedNote: string
    switches: string; switchesNote: (n: number) => string
    dominated: string; biggestSlice: string
    ribbon: string; stretches: string; tooShort: string; hoverRibbon: string
    focusShape: string; sessions: string; shapeNote: string; noSession: string
    medianOf: string; longestWas: string
    whereTimeWent: string; byCategory: string; projects: string; noProject: string
    windows: string; noTitles: string
    hands: string; keys: string; clicks: string; scroll: string
    writing: string; reading: string; mixed: string; handsNote: string; noKeyboard: string
    whatCameOut: string; commits: string; aiRequests: string; nothingRecorded: string
    signals: string; visits: string; sites: string; shortcuts: string
    charactersTypedIn: string; sound: string; somethingPlaying: string; call: string; screens: string
    missingAccessibility: string; missingAccessibilityText: string; openAccessibility: string
    others: string
  }
  rhythm: {
    title: string; daysMeasured: string; dayMeasured: string; between: string; and: string
    days7: string; days30: string; days90: string
    noDays: string; rhythmAppears: string
    totalTime: string; perDay: string
    averageFocus: string; averageFocusNote: string
    longestDay: string; output: string; commits: string
    whenYouWork: string; hourByWeekday: string; sumOfPeriod: string; inTotal: string
    filterHint: string; showingOnly: string; wholeDay: string; clearFilter: string; nothingThen: string
    trend: string; activeTimePerDay: string; averageOf: string; perMeasuredDay: string; needsThreeDays: string
    whereTimeWent: string; byCategory: string; projects: string; noProject: string
    signature: string; noShortcuts: string; sites: string; characters: string
    handsLead: (pct: number, app: string) => string; noHands: string
    written: string; writtenNote: string; writing: Record<WritingKind, string>
  }
  /** The pieces of work: tickets, pages, pull requests, documents, and whose they are. */
  work: {
    title: string; pieces: (n: number) => string
    byClient: string; byClientNote: string; piecesTitle: string; all: string; seeAll: string
    focused: string; agent: string; visit: [string, string]; prompt: [string, string]
    moments: string; source: Record<TouchSource, string>; noMoments: string; more: (n: number) => string
    browser: string; browserTime: string; browserVisits: string; timeSince: (day: string) => string
    empty: string; emptyNote: string
    kinds: Record<PageKind, string>
  }
  journal: {
    title: string; subtitle: string; noDays: string; fillsTomorrow: string
    notWritten: string; notWrittenYet: string; writeThisDay: string; writing: string
    rewrite: string; rewriting: string; daySummary: string; theRecap: string
    claudeDidNotAnswer: string; claudeText: string
  }
  chat: {
    title: string; titleStrong: string; explanation: string
    placeholder: string; listening: string; transcribing: string; reconnecting: string
    thinking: string; lookingUp: string; send: string; speak: string; stopListening: string
    liveStart: string; liveStop: string; liveConnecting: string; liveOn: string
    liveNoAnswer: string
    connected: string
    stopTalking: string; alwaysAloud: string; aloudWhenYouSpeak: string; coreIsDown: string
    listen: string; clickToSpeak: string
    suggestions: string[]
  }
  settings: {
    title: string; subtitle: string
    language: string; languageNote: string
    name: string; nameNote: string
    vault: string; vaultNote: string; chooseFolder: string; noVault: string; journalSubfolder: string
    keys: string; keysNote: string; inTheKeychain: string
    jevKey: string; jevNote: string; openaiKey: string; openaiNote: string
    optional: string; isSet: string; notSet: string; remove: string
    day: string; dayNote: string; hourSuffix: string
    keepTyping: string; keepTypingNote: string
    shortcut: string; shortcutNote: string; shortcutPress: string; shortcutTaken: string; shortcutOff: string; shortcutClear: string
    voiceMode: string; voiceModeNote: string; voicePush: string; voicePushNote: string; voiceLive: string; voiceLiveNote: string; voiceLiveNeedsKey: string; liveVoiceLabel: string
    region: string; regionNote: string; regionGlobal: string; regionEu: string
    caption: string; captionNote: string
    wideTools: string; wideToolsNote: string; wideToolsOn: string
    save: string; saved: string; saving: string; test: string; working: string; failed: string
    agents: string; agentsNote: string; agentsOn: string; agentsOff: string
    agentsApprove: string; agentsWhere: string
  }
  /** Pares [singular, plural] para o que a tela conta. */
  counts: {
    stretch: [string, string]; session: [string, string]; project: [string, string]
    commit: [string, string]; aiRequest: [string, string]; visit: [string, string]
    site: [string, string]; day: [string, string]; window: [string, string]
  }
  common: {
    min: string; h: string; s: string; of: string; no: string; close: string
    active: string; inTotal: string; nothingHere: string; noTime: string; agentWorking: string
    at: string; ofActive: string; session: string; sessions: string
    averageOf: string; perDay: string; others: (n: number) => string
    restOnScreen: string; didNotCatch: string; micDenied: string
    keyRefused: string
  }
}

const pt: Strings = {
  tabs: { today: 'Hoje', rhythm: 'Ritmo', work: 'Trabalho', journal: 'Diário', chat: 'Conversa', settings: 'Ajustes' },
  status: {
    brand: 'memória da máquina',
    source: { 'aguardando-permissao': 'esperando você permitir', 'sem-permissao': 'sem permissão', nunca: 'ainda não tentou' },
    measuring: 'medindo', idle: 'ocioso', stopped: 'parado', coreDown: 'núcleo desligado',
    inFocus: 'em foco', accessibility: 'acessibilidade', classification: 'classificação das janelas',
    narrative: 'narrativa e conversa',
    startItWith: 'Suba com', noCore: 'O núcleo não está respondendo.',
  },
  today: {
    title: 'Hoje', today: 'Hoje', loading: 'Carregando…',
    previousDay: '← dia anterior', todayButton: 'hoje', nextDay: 'dia seguinte →',
    from: 'das', to: 'às', idleMachine: 'de máquina parada', nothingMeasured: 'nada medido ainda',
    measuringNoActivity: 'Medindo, mas sem atividade:', backToKeyboard: 'Assim que você voltar ao teclado, esta tela se enche sozinha.',
    collectorRecords: 'O coletor grava a partir do momento em que sobe — o histórico anterior não existe.',
    onlySees: 'O Hippocampus só enxerga a partir do dia em que começou a medir.',
    yourTime: 'seu tempo', awayFromMachine: 'longe da máquina',
    delegated: 'trabalho delegado', delegatedNote: 'agentes produzindo enquanto você fazia outra coisa',
    noDelegated: 'nenhum agente trabalhou fora do seu tempo',
    focused: 'trabalho concentrado', focusedNote: 'tempo em código, IA, escrita, design e pesquisa',
    switches: 'trocas de aplicativo', switchesNote: (n) => `${n} mudaram de projeto — só essas custam caro`,
    dominated: 'aplicativo que dominou', biggestSlice: 'maior fatia foi',
    ribbon: 'a fita do dia', stretches: 'trechos', tooShort: 'curtos demais para desenhar',
    hoverRibbon: 'passe o mouse na fita para ver a janela',
    focusShape: 'a forma do foco', sessions: 'sessões sustentadas',
    shapeNote: 'minutos por tamanho de sessão — trecho de 15min com 75% de foco, sem quebra maior que 2min',
    noSession: 'Nenhuma sessão de foco sustentada neste dia.',
    medianOf: 'mediana de', longestWas: 'a maior foi',
    whereTimeWent: 'onde o tempo foi', byCategory: 'por categoria', projects: 'projetos tocados',
    noProject: 'O jev ainda não atribuiu projeto a nenhuma janela deste dia.',
    windows: 'janelas onde você mais ficou', noTitles: 'Sem títulos de janela — falta Acessibilidade.',
    hands: 'as suas mãos', keys: 'teclas', clicks: 'cliques', scroll: 'gestos de rolagem',
    writing: 'escrevendo', reading: 'lendo', mixed: 'misto',
    handsNote: 'a barra é a fatia de teclas sobre o total — cheia é escrever, vazia é ler. São contagens de eventos do sistema, não distância: rolagem é quantas vezes você rolou, não quanto. E o que foi digitado não é guardado aqui, só quanto.',
    noKeyboard: 'Sem sinal de teclado ainda.',
    whatCameOut: 'o que saiu das mãos', commits: 'commits', aiRequests: 'pedidos de IA',
    nothingRecorded: 'Nada registrado.',
    signals: 'sinais', visits: 'visitas de navegador', sites: 'sites', shortcuts: 'atalhos',
    charactersTypedIn: 'caracteres digitados em', sound: 'som', somethingPlaying: 'com algo tocando',
    call: 'microfone aberto — chamada', screens: 'telas',
    missingAccessibility: 'Falta a permissão de Acessibilidade.',
    missingAccessibilityText: 'Sem ela eu vejo qual aplicativo está na frente, mas não o título da janela — então não dá para saber em que você estava trabalhando, só onde.',
    openAccessibility: 'abrir os Ajustes de Acessibilidade',
    others: 'outros',
  },
  rhythm: {
    title: 'Ritmo', daysMeasured: 'dias medidos', dayMeasured: 'dia medido', between: 'entre', and: 'e',
    days7: '7 dias', days30: '30 dias', days90: '90 dias',
    noDays: 'Ainda não há dias medidos o bastante.',
    rhythmAppears: 'O ritmo aparece quando houver pelo menos dois dias com atividade.',
    totalTime: 'tempo total', perDay: 'por dia medido',
    averageFocus: 'foco médio', averageFocusNote: 'ponderado pelo tempo de cada janela',
    longestDay: 'dia mais longo', output: 'produção', commits: 'commits',
    whenYouWork: 'quando você trabalha', hourByWeekday: 'hora × dia da semana',
    sumOfPeriod: 'soma de todo o período', inTotal: 'no total',
    filterHint: 'clique numa célula ou num dia para ver só aquele horário abaixo', showingOnly: 'abaixo, só', wholeDay: 'o dia todo', clearFilter: 'ver o período todo', nothingThen: 'Nada medido nesse horário.',
    trend: 'tendência', activeTimePerDay: 'tempo ativo por dia', averageOf: 'média de',
    perMeasuredDay: 'por dia medido', needsThreeDays: 'Precisa de pelo menos três dias medidos para a tendência.',
    whereTimeWent: 'onde o tempo foi no período', byCategory: 'por categoria',
    projects: 'projetos', noProject: 'Sem projeto atribuído ainda.',
    signature: 'sua assinatura de teclado', noShortcuts: 'Sem atalhos capturados no período.',
    sites: 'sites', characters: 'caracteres digitados no período',
    handsLead: (pct, app) => `${pct}% das teclas foram em ${app}`, noHands: 'Sem teclas contadas no período.',
    written: 'o que você escreveu', writtenNote: 'caracteres, por tipo de app — o texto em si não entra na conta',
    writing: { ai: 'pedidos à IA', chat: 'conversas', mail: 'e-mail', search: 'buscas', code: 'código e terminal', web: 'no navegador', other: 'outros' },
  },
  work: {
    title: 'Trabalho', pieces: (n) => `${n} ${n === 1 ? 'peça de trabalho' : 'peças de trabalho'}`,
    byClient: 'por cliente', byClientNote: 'pelo subdomínio do Jira e do Confluence e pelo dono no GitHub',
    piecesTitle: 'peças de trabalho', all: 'tudo', seeAll: 'ver todos os clientes',
    focused: 'em foco', agent: 'do agente', visit: ['visita', 'visitas'], prompt: ['pedido', 'pedidos'],
    moments: 'tudo que tocou nisso, em ordem',
    source: { window: 'janela', visit: 'visita', commit: 'commit', prompt: 'pedido', branch: 'branch', agent: 'agente' },
    noMoments: 'Nenhum momento neste período.', more: (n) => `mostrar mais ${n}`,
    browser: 'o navegador, por tipo', browserTime: 'tempo em foco em cada tipo de página',
    browserVisits: 'visitas a cada tipo de página',
    timeSince: (day) => `o tempo em foco só é medido desde ${day}; para cobrir o período inteiro, contam as visitas, os commits e os pedidos`,
    empty: 'Nenhuma peça de trabalho neste período.',
    emptyNote: 'Elas aparecem quando o navegador, os commits e os pedidos aos agentes citam tickets, páginas, pull requests e documentos.',
    kinds: {
      ticket: 'tickets', board: 'quadros', wiki: 'páginas wiki', space: 'espaços', admin: 'administração',
      'pull-request': 'pull requests', issue: 'issues', repo: 'repositórios', doc: 'documentos', sheet: 'planilhas',
      slides: 'apresentações', design: 'design', video: 'vídeos', mail: 'e-mail', meeting: 'reuniões', chat: 'conversas',
      ai: 'IA', search: 'busca', docs: 'documentação', 'sign-in': 'login', page: 'outras páginas',
    },
  },
  journal: {
    title: 'Diário', subtitle: 'o que o computador viu, escrito pelo Claude Code',
    noDays: 'Nenhum dia medido ainda.', fillsTomorrow: 'Amanhã de manhã esta lista começa a encher sozinha.',
    notWritten: 'sem narrativa', notWrittenYet: 'Este dia foi medido mas ainda não foi escrito.',
    writeThisDay: 'escrever este dia', writing: 'escrevendo…',
    rewrite: 'reescrever', rewriting: 'reescrevendo…',
    daySummary: 'resumo do dia', theRecap: 'o recap',
    claudeDidNotAnswer: 'O Claude Code não respondeu.',
    claudeText: 'Sem ele a medição continua inteira, mas o diário não é escrito. Confira se o comando claude está instalado e logado.',
  },
  chat: {
    title: 'Pergunte sobre', titleStrong: 'o seu dia',
    explanation: 'Eu consulto o que foi medido nesta máquina — tempo por app e janela, projetos, commits, sites, atalhos, o que você digitou e o que pediu aos agentes. Nada disso sai daqui.',
    placeholder: 'pergunte qualquer coisa sobre o seu tempo',
    listening: 'ouvindo… pare de falar que eu envio', transcribing: 'transcrevendo…',
    reconnecting: 'reconectando ao núcleo…', thinking: 'pensando…', lookingUp: 'consultando',
    send: 'enviar', speak: 'falar', stopListening: 'parar de ouvir', stopTalking: 'parar de falar',
    liveStart: 'conversar ao vivo', liveStop: 'encerrar a conversa', liveConnecting: 'conectando…', liveOn: 'ao vivo',
    liveNoAnswer: 'A voz ao vivo não respondeu. Confira a chave da OpenAI em Ajustes.',
    connected: 'ligado ao núcleo',
    alwaysAloud: 'responder sempre falando', aloudWhenYouSpeak: 'responder falando só quando você falar',
    coreIsDown: 'O núcleo está fora do ar. Assim que ele voltar, mande de novo.',
    listen: 'ouvir', clickToSpeak: 'clique para falar',
    suggestions: [
      'Me dá um recap divertido do meu histórico: padrão de trabalho, distrações, atalhos favoritos, meu estilo de escrita e uma zoeira leve',
      'Onde foi meu tempo essa semana?',
      'Em que projeto eu mais trabalhei nos últimos 30 dias?',
      'Qual foi minha maior distração ontem?',
      'A que horas eu rendo mais?',
    ],
  },
  settings: {
    title: 'Ajustes', subtitle: 'tudo fica nesta máquina',
    language: 'idioma', languageNote: 'vale para a interface, o diário, a conversa e a voz',
    name: 'como te chamar', nameNote: 'usado no diário e na conversa',
    vault: 'vault do Obsidian', vaultNote: 'onde o resumo de cada dia é escrito',
    chooseFolder: 'escolher pasta', noVault: 'nenhuma pasta escolhida — o diário não é gravado',
    journalSubfolder: 'subpasta do diário',
    keys: 'chaves', keysNote: 'guardadas no Chaveiro do macOS, nunca em arquivo de texto',
    inTheKeychain: 'guardada no Chaveiro',
    jevKey: 'chave do jev (TypeSafe)', jevNote: 'classifica cada janela em categoria e projeto',
    openaiKey: 'chave da OpenAI', openaiNote: 'só para falar e transcrever; a conversa é sempre Claude Code',
    optional: 'opcional', isSet: 'configurada', notSet: 'não configurada', remove: 'remover',
    day: 'o dia começa às', dayNote: 'madrugada conta para o dia anterior', hourSuffix: 'h',
    keepTyping: 'guardar o que você digita', keepTypingNote: 'já passa por redação de segredos; desligue se preferir só os números',
    shortcut: 'atalho para chamar', shortcutNote: 'o núcleo aparece onde você deixou, já escutando', shortcutPress: 'aperte a combinação…', shortcutTaken: 'outro app já usa essa combinação', shortcutOff: 'nenhum', shortcutClear: 'desligar',
    voiceMode: 'como você fala com ele', voiceModeNote: 'os dois usam o Claude Code para pensar; muda só a boca e o ouvido', voicePush: 'apertar e falar', voicePushNote: 'você aperta, fala, ele responde — um turno de cada vez, e só a transcrição custa', voiceLive: 'ao vivo', voiceLiveNote: 'ele ouve enquanto você fala e você pode cortar no meio — cobra pelo tempo de sessão aberta', voiceLiveNeedsKey: 'precisa da chave da OpenAI', liveVoiceLabel: 'voz',
    region: 'região da chave', regionNote: 'chave de projeto europeu não fala com o servidor global — e só a voz reclama', regionGlobal: 'global', regionEu: 'Europa',
    caption: 'legenda no núcleo flutuante', captionNote: 'escrever na tela o que ouviu e o que respondeu — desligue para deixar só a esfera',
    wideTools: 'ferramentas ampliadas', wideToolsNote: 'desligado, ele responde só do que foi medido aqui e nada sai da máquina', wideToolsOn: 'ligado: ele pode ler arquivos, rodar comandos e buscar na web sem perguntar, e usa os seus servidores MCP',
    save: 'salvar', saved: 'salvo', saving: 'salvando…', test: 'testar', working: 'funcionando', failed: 'falhou',
    agents: 'medir sozinho, desde o login',
    agentsNote: 'o coletor, o leitor de janela e a escuta sobem com o Mac e voltam se caírem',
    agentsOn: 'ligados', agentsOff: 'desligados',
    agentsApprove: 'registrados — falta você aprovar',
    agentsWhere: 'Ajustes → Geral → Itens de Início',
  },
  counts: {
    stretch: ['trecho', 'trechos'], session: ['sessão sustentada', 'sessões sustentadas'],
    project: ['projeto', 'projetos'], commit: ['commit', 'commits'],
    aiRequest: ['pedido de IA', 'pedidos de IA'], visit: ['visita de navegador', 'visitas de navegador'],
    site: ['site', 'sites'], day: ['dia medido', 'dias medidos'], window: ['janela', 'janelas'],
  },
  common: {
    min: 'min', h: 'h', s: 's', of: 'de', no: 'sem', close: 'fechar',
    active: 'ativo', inTotal: 'no total', nothingHere: 'Nada aqui ainda.', noTime: 'Sem tempo medido.',
    agentWorking: 'agente trabalhando', at: 'às', ofActive: 'do ativo',
    session: 'sessão', sessions: 'sessões', averageOf: 'média de', perDay: 'por dia medido',
    others: (n) => `outros ${n}`,
    restOnScreen: '… o resto está escrito na tela.', didNotCatch: 'Não entendi o que você falou.',
    keyRefused: 'A OpenAI recusou a chave. Troque em Ajustes → chaves.',
    micDenied: 'O microfone foi negado. Autorize em Ajustes → Privacidade e Segurança → Microfone.',
  },
}

const en: Strings = {
  tabs: { today: 'Today', rhythm: 'Rhythm', work: 'Work', journal: 'Journal', chat: 'Chat', settings: 'Settings' },
  status: {
    brand: 'the machine’s memory',
    source: { 'aguardando-permissao': 'waiting for you to allow it', 'sem-permissao': 'no permission', nunca: 'not tried yet' },
    measuring: 'measuring', idle: 'idle', stopped: 'stopped', coreDown: 'core is down',
    inFocus: 'in focus', accessibility: 'accessibility', classification: 'window classification',
    narrative: 'writing and chat',
    startItWith: 'Start it with', noCore: 'The core is not responding.',
  },
  today: {
    title: 'Today', today: 'Today', loading: 'Loading…',
    previousDay: '← previous day', todayButton: 'today', nextDay: 'next day →',
    from: 'from', to: 'to', idleMachine: 'of idle machine', nothingMeasured: 'nothing measured yet',
    measuringNoActivity: 'Measuring, but no activity:', backToKeyboard: 'The moment you come back to the keyboard, this fills in on its own.',
    collectorRecords: 'The collector records from the moment it starts — there is no history before that.',
    onlySees: 'Hippocampus only sees from the day it started measuring.',
    yourTime: 'your time', awayFromMachine: 'away from the machine',
    delegated: 'delegated work', delegatedNote: 'agents producing while you did something else',
    noDelegated: 'no agent worked outside your time',
    focused: 'focused work', focusedNote: 'time in code, AI, writing, design and research',
    switches: 'app switches', switchesNote: (n) => `${n} changed project — only those cost you`,
    dominated: 'app that dominated', biggestSlice: 'biggest slice was',
    ribbon: 'the day as a ribbon', stretches: 'stretches', tooShort: 'too short to draw',
    hoverRibbon: 'hover the ribbon to see the window',
    focusShape: 'the shape of focus', sessions: 'sustained sessions',
    shapeNote: 'minutes by session length — a 15min window at 75% focus, with no break longer than 2min',
    noSession: 'No focus session held together on this day.',
    medianOf: 'median of', longestWas: 'the longest was',
    whereTimeWent: 'where the time went', byCategory: 'by category', projects: 'projects touched',
    noProject: 'jev has not assigned a project to any window of this day yet.',
    windows: 'windows you stayed in most', noTitles: 'No window titles — accessibility is missing.',
    hands: 'your hands', keys: 'keys', clicks: 'clicks', scroll: 'scroll gestures',
    writing: 'writing', reading: 'reading', mixed: 'mixed',
    handsNote: 'the bar is the share of keys over the total — full means writing, empty means reading. These are counts of system events, not distance: scroll is how many times you scrolled, not how far. And what you typed is not stored here, only how much.',
    noKeyboard: 'No keyboard signal yet.',
    whatCameOut: 'what came out', commits: 'commits', aiRequests: 'AI requests',
    nothingRecorded: 'Nothing recorded.',
    signals: 'signals', visits: 'browser visits', sites: 'sites', shortcuts: 'shortcuts',
    charactersTypedIn: 'characters typed across', sound: 'sound', somethingPlaying: 'with something playing',
    call: 'microphone open — a call', screens: 'screens',
    missingAccessibility: 'Accessibility permission is missing.',
    missingAccessibilityText: 'Without it I see which app is in front, but not the window title — so there is no way to know what you were working on, only where.',
    openAccessibility: 'open the Accessibility settings',
    others: 'others',
  },
  rhythm: {
    title: 'Rhythm', daysMeasured: 'days measured', dayMeasured: 'day measured', between: 'between', and: 'and',
    days7: '7 days', days30: '30 days', days90: '90 days',
    noDays: 'Not enough measured days yet.',
    rhythmAppears: 'The rhythm appears once there are at least two days with activity.',
    totalTime: 'total time', perDay: 'per measured day',
    averageFocus: 'average focus', averageFocusNote: 'weighted by the time of each window',
    longestDay: 'longest day', output: 'output', commits: 'commits',
    whenYouWork: 'when you work', hourByWeekday: 'hour × weekday',
    sumOfPeriod: 'sum of the whole period', inTotal: 'in total',
    filterHint: 'click a cell or a day to see only that slot below', showingOnly: 'below, only', wholeDay: 'all day', clearFilter: 'show the whole period', nothingThen: 'Nothing was measured in that slot.',
    trend: 'trend', activeTimePerDay: 'active time per day', averageOf: 'average of',
    perMeasuredDay: 'per measured day', needsThreeDays: 'Needs at least three measured days for a trend.',
    whereTimeWent: 'where the time went in the period', byCategory: 'by category',
    projects: 'projects', noProject: 'No project assigned yet.',
    signature: 'your keyboard signature', noShortcuts: 'No shortcuts captured in the period.',
    sites: 'sites', characters: 'characters typed in the period',
    handsLead: (pct, app) => `${pct}% of the keys went to ${app}`, noHands: 'No keys counted in this period.',
    written: 'what you wrote', writtenNote: 'characters, by kind of app — the text itself never counts',
    writing: { ai: 'requests to AI', chat: 'chats', mail: 'email', search: 'searches', code: 'code and terminal', web: 'in the browser', other: 'other' },
  },
  work: {
    title: 'Work', pieces: (n) => `${n} ${n === 1 ? 'piece of work' : 'pieces of work'}`,
    byClient: 'by client', byClientNote: 'from the Jira and Confluence subdomain and the GitHub owner',
    piecesTitle: 'pieces of work', all: 'all', seeAll: 'see every client',
    focused: 'in focus', agent: 'by the agent', visit: ['visit', 'visits'], prompt: ['request', 'requests'],
    moments: 'everything that touched it, in order',
    source: { window: 'window', visit: 'visit', commit: 'commit', prompt: 'request', branch: 'branch', agent: 'agent' },
    noMoments: 'No moments in this period.', more: (n) => `show ${n} more`,
    browser: 'the browser, by kind', browserTime: 'time in focus on each kind of page',
    browserVisits: 'visits to each kind of page',
    timeSince: (day) => `time in focus is only measured since ${day}; to cover the whole period, visits, commits and requests count`,
    empty: 'No pieces of work in this period.',
    emptyNote: 'They show up once the browser, commits and requests to agents name tickets, pages, pull requests and documents.',
    kinds: {
      ticket: 'tickets', board: 'boards', wiki: 'wiki pages', space: 'spaces', admin: 'administration',
      'pull-request': 'pull requests', issue: 'issues', repo: 'repositories', doc: 'documents', sheet: 'spreadsheets',
      slides: 'slides', design: 'design', video: 'videos', mail: 'email', meeting: 'meetings', chat: 'chat',
      ai: 'AI', search: 'search', docs: 'docs', 'sign-in': 'sign-in', page: 'other pages',
    },
  },
  journal: {
    title: 'Journal', subtitle: 'what the computer saw, written by Claude Code',
    noDays: 'No days measured yet.', fillsTomorrow: 'Tomorrow morning this list starts filling on its own.',
    notWritten: 'not written', notWrittenYet: 'This day was measured but has not been written yet.',
    writeThisDay: 'write this day', writing: 'writing…',
    rewrite: 'rewrite', rewriting: 'rewriting…',
    daySummary: 'summary of the day', theRecap: 'the recap',
    claudeDidNotAnswer: 'Claude Code did not answer.',
    claudeText: 'Without it the measuring carries on intact, but the journal is not written. Check that the claude command is installed and signed in.',
  },
  chat: {
    title: 'Ask about', titleStrong: 'your day',
    explanation: 'I look up what was measured on this machine — time per app and window, projects, commits, sites, shortcuts, what you typed and what you asked the agents. None of it leaves here.',
    placeholder: 'ask anything about your time',
    listening: 'listening… stop talking and I send it', transcribing: 'transcribing…',
    reconnecting: 'reconnecting to the core…', thinking: 'thinking…', lookingUp: 'looking up',
    send: 'send', speak: 'speak', stopListening: 'stop listening', stopTalking: 'stop talking',
    liveStart: 'talk live', liveStop: 'end the conversation', liveConnecting: 'connecting…', liveOn: 'live',
    liveNoAnswer: 'The live voice did not answer. Check the OpenAI key in Settings.',
    connected: 'connected to the core',
    alwaysAloud: 'always answer out loud', aloudWhenYouSpeak: 'answer out loud only when you speak',
    coreIsDown: 'The core is down. Send it again once it is back.',
    listen: 'listen', clickToSpeak: 'click to speak',
    suggestions: [
      'Give me a fun recap of my history: work patterns, distractions, favourite shortcuts, my writing style and a light roast',
      'Where did my time go this week?',
      'Which project did I work on most over the last 30 days?',
      'What was my biggest distraction yesterday?',
      'What time of day do I do my best work?',
    ],
  },
  settings: {
    title: 'Settings', subtitle: 'everything stays on this machine',
    language: 'language', languageNote: 'applies to the interface, the journal, the chat and the voice',
    name: 'what to call you', nameNote: 'used in the journal and the chat',
    vault: 'Obsidian vault', vaultNote: 'where each day’s summary is written',
    chooseFolder: 'choose folder', noVault: 'no folder chosen — the journal is not written',
    journalSubfolder: 'journal subfolder',
    keys: 'keys', keysNote: 'kept in the macOS Keychain, never in a text file',
    inTheKeychain: 'in the Keychain',
    jevKey: 'jev (TypeSafe) key', jevNote: 'classifies each window into a category and a project',
    openaiKey: 'OpenAI key', openaiNote: 'only for speaking and transcribing; the chat is always Claude Code',
    optional: 'optional', isSet: 'set', notSet: 'not set', remove: 'remove',
    day: 'the day starts at', dayNote: 'the small hours count as the day before', hourSuffix: ':00',
    keepTyping: 'keep what you type', keepTypingNote: 'secrets are already redacted; turn it off if you prefer only the numbers',
    shortcut: 'shortcut to call it', shortcutNote: 'the core appears where you left it, already listening', shortcutPress: 'press the combination…', shortcutTaken: 'another app already holds that combination', shortcutOff: 'none', shortcutClear: 'turn off',
    voiceMode: 'how you talk to it', voiceModeNote: 'both think with Claude Code; only the mouth and the ear change', voicePush: 'press and speak', voicePushNote: 'you press, you speak, it answers — one turn at a time, and only the transcription costs', voiceLive: 'live', voiceLiveNote: 'it hears you while you speak and you can cut in mid-sentence — it bills for the time the session is open', voiceLiveNeedsKey: 'needs the OpenAI key', liveVoiceLabel: 'voice',
    region: 'key region', regionNote: 'a European project key cannot talk to the global server — and only the voice complains', regionGlobal: 'global', regionEu: 'Europe',
    caption: 'caption on the floating core', captionNote: 'write what it heard and what it answered — turn it off to leave just the sphere',
    wideTools: 'wider tools', wideToolsNote: 'off, it answers only from what was measured here and nothing leaves the machine', wideToolsOn: 'on: it can read files, run commands and search the web without asking, and it uses your MCP servers',
    save: 'save', saved: 'saved', saving: 'saving…', test: 'test', working: 'working', failed: 'failed',
    agents: 'measure on its own, from login',
    agentsNote: 'the collector, the window reader and the listener start with the Mac and come back if they fall',
    agentsOn: 'on', agentsOff: 'off',
    agentsApprove: 'registered — waiting for you to approve',
    agentsWhere: 'Settings → General → Login Items',
  },
  counts: {
    stretch: ['stretch', 'stretches'], session: ['sustained session', 'sustained sessions'],
    project: ['project', 'projects'], commit: ['commit', 'commits'],
    aiRequest: ['AI request', 'AI requests'], visit: ['browser visit', 'browser visits'],
    site: ['site', 'sites'], day: ['day measured', 'days measured'], window: ['window', 'windows'],
  },
  common: {
    min: 'min', h: 'h', s: 's', of: 'of', no: 'no', close: 'close',
    active: 'active', inTotal: 'in total', nothingHere: 'Nothing here yet.', noTime: 'No time measured.',
    agentWorking: 'agent working', at: 'at', ofActive: 'of active',
    session: 'session', sessions: 'sessions', averageOf: 'average of', perDay: 'per measured day',
    others: (n) => `${n} others`,
    restOnScreen: '… the rest is written on screen.', didNotCatch: 'I did not catch that.',
    keyRefused: 'OpenAI refused the key. Replace it in Settings → keys.',
    micDenied: 'The microphone was denied. Allow it in Settings → Privacy & Security → Microphone.',
  },
}

const es: Strings = {
  tabs: { today: 'Hoy', rhythm: 'Ritmo', work: 'Trabajo', journal: 'Diario', chat: 'Conversación', settings: 'Ajustes' },
  status: {
    brand: 'la memoria de la máquina',
    source: { 'aguardando-permissao': 'esperando que lo permitas', 'sem-permissao': 'sin permiso', nunca: 'aún no lo intentó' },
    measuring: 'midiendo', idle: 'inactivo', stopped: 'parado', coreDown: 'núcleo apagado',
    inFocus: 'en foco', accessibility: 'accesibilidad', classification: 'clasificación de ventanas',
    narrative: 'redacción y conversación',
    startItWith: 'Arráncalo con', noCore: 'El núcleo no responde.',
  },
  today: {
    title: 'Hoy', today: 'Hoy', loading: 'Cargando…',
    previousDay: '← día anterior', todayButton: 'hoy', nextDay: 'día siguiente →',
    from: 'de', to: 'a', idleMachine: 'de máquina parada', nothingMeasured: 'nada medido todavía',
    measuringNoActivity: 'Midiendo, pero sin actividad:', backToKeyboard: 'En cuanto vuelvas al teclado, esta pantalla se llena sola.',
    collectorRecords: 'El recolector graba desde que arranca — antes de eso no hay historial.',
    onlySees: 'Hippocampus solo ve desde el día en que empezó a medir.',
    yourTime: 'tu tiempo', awayFromMachine: 'lejos de la máquina',
    delegated: 'trabajo delegado', delegatedNote: 'agentes produciendo mientras hacías otra cosa',
    noDelegated: 'ningún agente trabajó fuera de tu tiempo',
    focused: 'trabajo concentrado', focusedNote: 'tiempo en código, IA, escritura, diseño e investigación',
    switches: 'cambios de aplicación', switchesNote: (n) => `${n} cambiaron de proyecto — solo esos cuestan caro`,
    dominated: 'aplicación que dominó', biggestSlice: 'la mayor porción fue',
    ribbon: 'la cinta del día', stretches: 'tramos', tooShort: 'demasiado cortos para dibujar',
    hoverRibbon: 'pasa el ratón por la cinta para ver la ventana',
    focusShape: 'la forma del foco', sessions: 'sesiones sostenidas',
    shapeNote: 'minutos por tamaño de sesión — tramo de 15min con 75% de foco, sin pausa mayor de 2min',
    noSession: 'Ninguna sesión de foco se sostuvo este día.',
    medianOf: 'mediana de', longestWas: 'la mayor fue',
    whereTimeWent: 'dónde fue el tiempo', byCategory: 'por categoría', projects: 'proyectos tocados',
    noProject: 'jev aún no asignó proyecto a ninguna ventana de este día.',
    windows: 'ventanas donde más estuviste', noTitles: 'Sin títulos de ventana — falta accesibilidad.',
    hands: 'tus manos', keys: 'teclas', clicks: 'clics', scroll: 'gestos de desplazamiento',
    writing: 'escribiendo', reading: 'leyendo', mixed: 'mixto',
    handsNote: 'la barra es la porción de teclas sobre el total — llena es escribir, vacía es leer. Son recuentos de eventos del sistema, no distancia: el desplazamiento es cuántas veces te desplazaste, no cuánto. Y lo que escribiste no se guarda aquí, solo cuánto.',
    noKeyboard: 'Sin señal de teclado todavía.',
    whatCameOut: 'lo que salió', commits: 'commits', aiRequests: 'peticiones a la IA',
    nothingRecorded: 'Nada registrado.',
    signals: 'señales', visits: 'visitas de navegador', sites: 'sitios', shortcuts: 'atajos',
    charactersTypedIn: 'caracteres escritos en', sound: 'sonido', somethingPlaying: 'con algo sonando',
    call: 'micrófono abierto — llamada', screens: 'pantallas',
    missingAccessibility: 'Falta el permiso de accesibilidad.',
    missingAccessibilityText: 'Sin él veo qué aplicación está delante, pero no el título de la ventana — así que no hay forma de saber en qué trabajabas, solo dónde.',
    openAccessibility: 'abrir los ajustes de Accesibilidad',
    others: 'otros',
  },
  rhythm: {
    title: 'Ritmo', daysMeasured: 'días medidos', dayMeasured: 'día medido', between: 'entre', and: 'y',
    days7: '7 días', days30: '30 días', days90: '90 días',
    noDays: 'Todavía no hay suficientes días medidos.',
    rhythmAppears: 'El ritmo aparece cuando haya al menos dos días con actividad.',
    totalTime: 'tiempo total', perDay: 'por día medido',
    averageFocus: 'foco medio', averageFocusNote: 'ponderado por el tiempo de cada ventana',
    longestDay: 'día más largo', output: 'producción', commits: 'commits',
    whenYouWork: 'cuándo trabajas', hourByWeekday: 'hora × día de la semana',
    sumOfPeriod: 'suma de todo el periodo', inTotal: 'en total',
    filterHint: 'haz clic en una celda o en un día para ver solo esa franja abajo', showingOnly: 'abajo, solo', wholeDay: 'todo el día', clearFilter: 'ver todo el periodo', nothingThen: 'Nada medido en esa franja.',
    trend: 'tendencia', activeTimePerDay: 'tiempo activo por día', averageOf: 'media de',
    perMeasuredDay: 'por día medido', needsThreeDays: 'Necesita al menos tres días medidos para la tendencia.',
    whereTimeWent: 'dónde fue el tiempo en el periodo', byCategory: 'por categoría',
    projects: 'proyectos', noProject: 'Sin proyecto asignado todavía.',
    signature: 'tu firma de teclado', noShortcuts: 'Sin atajos capturados en el periodo.',
    sites: 'sitios', characters: 'caracteres escritos en el periodo',
    handsLead: (pct, app) => `${pct}% de las teclas fueron en ${app}`, noHands: 'Sin teclas contadas en el periodo.',
    written: 'lo que escribiste', writtenNote: 'caracteres, por tipo de app — el texto en sí no cuenta',
    writing: { ai: 'peticiones a la IA', chat: 'conversaciones', mail: 'correo', search: 'búsquedas', code: 'código y terminal', web: 'en el navegador', other: 'otros' },
  },
  work: {
    title: 'Trabajo', pieces: (n) => `${n} ${n === 1 ? 'pieza de trabajo' : 'piezas de trabajo'}`,
    byClient: 'por cliente', byClientNote: 'por el subdominio de Jira y Confluence y el dueño en GitHub',
    piecesTitle: 'piezas de trabajo', all: 'todo', seeAll: 'ver todos los clientes',
    focused: 'en foco', agent: 'del agente', visit: ['visita', 'visitas'], prompt: ['petición', 'peticiones'],
    moments: 'todo lo que lo tocó, en orden',
    source: { window: 'ventana', visit: 'visita', commit: 'commit', prompt: 'petición', branch: 'rama', agent: 'agente' },
    noMoments: 'Ningún momento en este periodo.', more: (n) => `mostrar ${n} más`,
    browser: 'el navegador, por tipo', browserTime: 'tiempo en foco en cada tipo de página',
    browserVisits: 'visitas a cada tipo de página',
    timeSince: (day) => `el tiempo en foco solo se mide desde ${day}; para cubrir todo el periodo, cuentan las visitas, los commits y las peticiones`,
    empty: 'Ninguna pieza de trabajo en este periodo.',
    emptyNote: 'Aparecen cuando el navegador, los commits y las peticiones a los agentes nombran tickets, páginas, pull requests y documentos.',
    kinds: {
      ticket: 'tickets', board: 'tableros', wiki: 'páginas wiki', space: 'espacios', admin: 'administración',
      'pull-request': 'pull requests', issue: 'issues', repo: 'repositorios', doc: 'documentos', sheet: 'hojas de cálculo',
      slides: 'presentaciones', design: 'diseño', video: 'vídeos', mail: 'correo', meeting: 'reuniones', chat: 'chat',
      ai: 'IA', search: 'búsqueda', docs: 'documentación', 'sign-in': 'inicio de sesión', page: 'otras páginas',
    },
  },
  journal: {
    title: 'Diario', subtitle: 'lo que el ordenador vio, escrito por Claude Code',
    noDays: 'Ningún día medido todavía.', fillsTomorrow: 'Mañana por la mañana esta lista empieza a llenarse sola.',
    notWritten: 'sin escribir', notWrittenYet: 'Este día se midió pero aún no se escribió.',
    writeThisDay: 'escribir este día', writing: 'escribiendo…',
    rewrite: 'reescribir', rewriting: 'reescribiendo…',
    daySummary: 'resumen del día', theRecap: 'el resumen divertido',
    claudeDidNotAnswer: 'Claude Code no respondió.',
    claudeText: 'Sin él la medición sigue entera, pero el diario no se escribe. Comprueba que el comando claude esté instalado y con sesión iniciada.',
  },
  chat: {
    title: 'Pregunta sobre', titleStrong: 'tu día',
    explanation: 'Consulto lo que se midió en esta máquina — tiempo por app y ventana, proyectos, commits, sitios, atajos, lo que escribiste y lo que pediste a los agentes. Nada de eso sale de aquí.',
    placeholder: 'pregunta cualquier cosa sobre tu tiempo',
    listening: 'escuchando… deja de hablar y lo envío', transcribing: 'transcribiendo…',
    reconnecting: 'reconectando al núcleo…', thinking: 'pensando…', lookingUp: 'consultando',
    send: 'enviar', speak: 'hablar', stopListening: 'dejar de escuchar', stopTalking: 'dejar de hablar',
    liveStart: 'hablar en vivo', liveStop: 'terminar la conversación', liveConnecting: 'conectando…', liveOn: 'en vivo',
    liveNoAnswer: 'La voz en vivo no respondió. Revisa la clave de OpenAI en Ajustes.',
    connected: 'conectado al núcleo',
    alwaysAloud: 'responder siempre en voz alta', aloudWhenYouSpeak: 'responder en voz alta solo cuando hables',
    coreIsDown: 'El núcleo está caído. Envíalo de nuevo cuando vuelva.',
    listen: 'escuchar', clickToSpeak: 'haz clic para hablar',
    suggestions: [
      'Dame un resumen divertido de mi historial: patrón de trabajo, distracciones, atajos favoritos, mi estilo de escritura y una pulla suave',
      '¿Dónde se fue mi tiempo esta semana?',
      '¿En qué proyecto trabajé más en los últimos 30 días?',
      '¿Cuál fue mi mayor distracción ayer?',
      '¿A qué hora rindo más?',
    ],
  },
  settings: {
    title: 'Ajustes', subtitle: 'todo se queda en esta máquina',
    language: 'idioma', languageNote: 'vale para la interfaz, el diario, la conversación y la voz',
    name: 'cómo llamarte', nameNote: 'se usa en el diario y en la conversación',
    vault: 'vault de Obsidian', vaultNote: 'donde se escribe el resumen de cada día',
    chooseFolder: 'elegir carpeta', noVault: 'ninguna carpeta elegida — el diario no se graba',
    journalSubfolder: 'subcarpeta del diario',
    keys: 'claves', keysNote: 'guardadas en el Llavero de macOS, nunca en un archivo de texto',
    inTheKeychain: 'en el Llavero',
    jevKey: 'clave de jev (TypeSafe)', jevNote: 'clasifica cada ventana en categoría y proyecto',
    openaiKey: 'clave de OpenAI', openaiNote: 'solo para hablar y transcribir; la conversación es siempre Claude Code',
    optional: 'opcional', isSet: 'configurada', notSet: 'sin configurar', remove: 'quitar',
    day: 'el día empieza a las', dayNote: 'la madrugada cuenta para el día anterior', hourSuffix: 'h',
    keepTyping: 'guardar lo que escribes', keepTypingNote: 'los secretos ya se redactan; desactívalo si prefieres solo los números',
    shortcut: 'atajo para llamarlo', shortcutNote: 'el núcleo aparece donde lo dejaste, ya escuchando', shortcutPress: 'pulsa la combinación…', shortcutTaken: 'otra app ya usa esa combinación', shortcutOff: 'ninguno', shortcutClear: 'desactivar',
    voiceMode: 'cómo hablas con él', voiceModeNote: 'los dos piensan con Claude Code; solo cambian la boca y el oído', voicePush: 'pulsar y hablar', voicePushNote: 'pulsas, hablas, responde — un turno cada vez, y solo cuesta la transcripción', voiceLive: 'en vivo', voiceLiveNote: 'te oye mientras hablas y puedes cortarlo a media frase — cobra por el tiempo de sesión abierta', voiceLiveNeedsKey: 'necesita la clave de OpenAI', liveVoiceLabel: 'voz',
    region: 'región de la clave', regionNote: 'una clave de proyecto europeo no habla con el servidor global — y solo la voz se queja', regionGlobal: 'global', regionEu: 'Europa',
    caption: 'subtítulo en el núcleo flotante', captionNote: 'escribir lo que oyó y lo que respondió — desactívalo para dejar solo la esfera',
    wideTools: 'herramientas ampliadas', wideToolsNote: 'desactivado, responde solo con lo medido aquí y nada sale de la máquina', wideToolsOn: 'activado: puede leer archivos, ejecutar comandos y buscar en la web sin preguntar, y usa tus servidores MCP',
    save: 'guardar', saved: 'guardado', saving: 'guardando…', test: 'probar', working: 'funciona', failed: 'falló',
    agents: 'medir solo, desde el inicio de sesión',
    agentsNote: 'el recolector, el lector de ventanas y la escucha arrancan con el Mac y vuelven si se caen',
    agentsOn: 'encendidos', agentsOff: 'apagados',
    agentsApprove: 'registrados — falta que los apruebes',
    agentsWhere: 'Ajustes → General → Ítems de inicio',
  },
  counts: {
    stretch: ['tramo', 'tramos'], session: ['sesión sostenida', 'sesiones sostenidas'],
    project: ['proyecto', 'proyectos'], commit: ['commit', 'commits'],
    aiRequest: ['petición a la IA', 'peticiones a la IA'], visit: ['visita de navegador', 'visitas de navegador'],
    site: ['sitio', 'sitios'], day: ['día medido', 'días medidos'], window: ['ventana', 'ventanas'],
  },
  common: {
    min: 'min', h: 'h', s: 's', of: 'de', no: 'sin', close: 'cerrar',
    active: 'activo', inTotal: 'en total', nothingHere: 'Nada aquí todavía.', noTime: 'Sin tiempo medido.',
    agentWorking: 'agente trabajando', at: 'a las', ofActive: 'del activo',
    session: 'sesión', sessions: 'sesiones', averageOf: 'media de', perDay: 'por día medido',
    others: (n) => `otros ${n}`,
    restOnScreen: '… el resto está escrito en la pantalla.', didNotCatch: 'No entendí lo que dijiste.',
    keyRefused: 'OpenAI rechazó la clave. Cámbiala en Ajustes → claves.',
    micDenied: 'El micrófono fue denegado. Permítelo en Ajustes → Privacidad y seguridad → Micrófono.',
  },
}

const fr: Strings = {
  tabs: { today: 'Aujourd’hui', rhythm: 'Rythme', work: 'Travail', journal: 'Journal', chat: 'Conversation', settings: 'Réglages' },
  status: {
    brand: 'la mémoire de la machine',
    source: { 'aguardando-permissao': 'en attente de ton autorisation', 'sem-permissao': 'sans autorisation', nunca: 'pas encore tenté' },
    measuring: 'mesure en cours', idle: 'inactif', stopped: 'arrêté', coreDown: 'le noyau est éteint',
    inFocus: 'concentré', accessibility: 'accessibilité', classification: 'classement des fenêtres',
    narrative: 'rédaction et conversation',
    startItWith: 'Lance-le avec', noCore: 'Le noyau ne répond pas.',
  },
  today: {
    title: 'Aujourd’hui', today: 'Aujourd’hui', loading: 'Chargement…',
    previousDay: '← jour précédent', todayButton: 'aujourd’hui', nextDay: 'jour suivant →',
    from: 'de', to: 'à', idleMachine: 'de machine à l’arrêt', nothingMeasured: 'rien de mesuré pour l’instant',
    measuringNoActivity: 'La mesure tourne, mais sans activité :', backToKeyboard: 'Dès que tu reviens au clavier, cet écran se remplit tout seul.',
    collectorRecords: 'Le collecteur enregistre à partir du moment où il démarre — rien n’existe avant.',
    onlySees: 'Hippocampus ne voit qu’à partir du jour où il a commencé à mesurer.',
    yourTime: 'ton temps', awayFromMachine: 'loin de la machine',
    delegated: 'travail délégué', delegatedNote: 'des agents produisaient pendant que tu faisais autre chose',
    noDelegated: 'aucun agent n’a travaillé en dehors de ton temps',
    focused: 'travail concentré', focusedNote: 'temps passé en code, IA, écriture, design et recherche',
    switches: 'changements d’application', switchesNote: (n) => `${n} ont changé de projet — seuls ceux-là coûtent cher`,
    dominated: 'application dominante', biggestSlice: 'la plus grosse part revient à',
    ribbon: 'la journée en ruban', stretches: 'segments', tooShort: 'trop courts pour être dessinés',
    hoverRibbon: 'survole le ruban pour voir la fenêtre',
    focusShape: 'la forme de la concentration', sessions: 'sessions tenues',
    shapeNote: 'minutes par durée de session — fenêtre de 15 min à 75 % de concentration, sans pause de plus de 2 min',
    noSession: 'Aucune session de concentration n’a tenu ce jour-là.',
    medianOf: 'médiane de', longestWas: 'la plus longue a duré',
    whereTimeWent: 'où est passé le temps', byCategory: 'par catégorie', projects: 'projets touchés',
    noProject: 'jev n’a encore attribué de projet à aucune fenêtre de ce jour.',
    windows: 'fenêtres où tu es resté le plus', noTitles: 'Aucun titre de fenêtre — l’accessibilité manque.',
    hands: 'tes mains', keys: 'touches', clicks: 'clics', scroll: 'gestes de défilement',
    writing: 'écriture', reading: 'lecture', mixed: 'mixte',
    handsNote: 'la barre est la part des touches sur le total — pleine, c’est écrire ; vide, c’est lire. Ce sont des comptes d’événements système, pas une distance : le défilement, c’est combien de fois tu as fait défiler, pas de combien. Et ce que tu as tapé n’est pas gardé ici, seulement la quantité.',
    noKeyboard: 'Aucun signal du clavier pour l’instant.',
    whatCameOut: 'ce qui en est sorti', commits: 'commits', aiRequests: 'requêtes à l’IA',
    nothingRecorded: 'Rien d’enregistré.',
    signals: 'signaux', visits: 'visites de navigateur', sites: 'sites', shortcuts: 'raccourcis',
    charactersTypedIn: 'caractères tapés dans', sound: 'son', somethingPlaying: 'avec quelque chose qui jouait',
    call: 'micro ouvert — un appel', screens: 'écrans',
    missingAccessibility: 'La permission d’accessibilité manque.',
    missingAccessibilityText: 'Sans elle je vois quelle application est au premier plan, mais pas le titre de la fenêtre — impossible donc de savoir sur quoi tu travaillais, seulement où.',
    openAccessibility: 'ouvrir les réglages d’Accessibilité',
    others: 'autres',
  },
  rhythm: {
    title: 'Rythme', daysMeasured: 'jours mesurés', dayMeasured: 'jour mesuré', between: 'entre', and: 'et',
    days7: '7 jours', days30: '30 jours', days90: '90 jours',
    noDays: 'Pas encore assez de jours mesurés.',
    rhythmAppears: 'Le rythme apparaît dès qu’il y a au moins deux jours avec de l’activité.',
    totalTime: 'temps total', perDay: 'par jour mesuré',
    averageFocus: 'concentration moyenne', averageFocusNote: 'pondérée par le temps de chaque fenêtre',
    longestDay: 'journée la plus longue', output: 'production', commits: 'commits',
    whenYouWork: 'quand tu travailles', hourByWeekday: 'heure × jour de la semaine',
    sumOfPeriod: 'somme de toute la période', inTotal: 'au total',
    filterHint: 'clique sur une case ou un jour pour ne voir que ce créneau en dessous', showingOnly: 'en dessous, seulement', wholeDay: 'toute la journée', clearFilter: 'voir toute la période', nothingThen: 'Rien de mesuré sur ce créneau.',
    trend: 'tendance', activeTimePerDay: 'temps actif par jour', averageOf: 'moyenne de',
    perMeasuredDay: 'par jour mesuré', needsThreeDays: 'Il faut au moins trois jours mesurés pour une tendance.',
    whereTimeWent: 'où est passé le temps sur la période', byCategory: 'par catégorie',
    projects: 'projets', noProject: 'Aucun projet attribué pour l’instant.',
    signature: 'ta signature au clavier', noShortcuts: 'Aucun raccourci capté sur la période.',
    sites: 'sites', characters: 'caractères tapés sur la période',
    handsLead: (pct, app) => `${pct} % des frappes sont allées à ${app}`, noHands: 'Aucune frappe comptée sur la période.',
    written: 'ce que tu as écrit', writtenNote: 'caractères, par type d’app — le texte lui-même n’entre jamais dans le compte',
    writing: { ai: 'demandes à l’IA', chat: 'discussions', mail: 'e-mail', search: 'recherches', code: 'code et terminal', web: 'dans le navigateur', other: 'autres' },
  },
  work: {
    title: 'Travail', pieces: (n) => `${n} ${n === 1 ? 'élément de travail' : 'éléments de travail'}`,
    byClient: 'par client', byClientNote: 'd’après le sous-domaine Jira et Confluence et le propriétaire sur GitHub',
    piecesTitle: 'éléments de travail', all: 'tout', seeAll: 'voir tous les clients',
    focused: 'au premier plan', agent: 'de l’agent', visit: ['visite', 'visites'], prompt: ['demande', 'demandes'],
    moments: 'tout ce qui y a touché, dans l’ordre',
    source: { window: 'fenêtre', visit: 'visite', commit: 'commit', prompt: 'demande', branch: 'branche', agent: 'agent' },
    noMoments: 'Aucun moment sur cette période.', more: (n) => `afficher ${n} de plus`,
    browser: 'le navigateur, par type', browserTime: 'temps au premier plan par type de page',
    browserVisits: 'visites par type de page',
    timeSince: (day) => `le temps au premier plan n’est mesuré que depuis le ${day} ; pour couvrir toute la période, ce sont les visites, les commits et les demandes qui comptent`,
    empty: 'Aucun élément de travail sur cette période.',
    emptyNote: 'Ils apparaissent quand le navigateur, les commits et les demandes aux agents citent des tickets, des pages, des pull requests et des documents.',
    kinds: {
      ticket: 'tickets', board: 'tableaux', wiki: 'pages wiki', space: 'espaces', admin: 'administration',
      'pull-request': 'pull requests', issue: 'issues', repo: 'dépôts', doc: 'documents', sheet: 'tableurs',
      slides: 'présentations', design: 'design', video: 'vidéos', mail: 'e-mail', meeting: 'réunions', chat: 'discussions',
      ai: 'IA', search: 'recherche', docs: 'documentation', 'sign-in': 'connexion', page: 'autres pages',
    },
  },
  journal: {
    title: 'Journal', subtitle: 'ce que l’ordinateur a vu, écrit par Claude Code',
    noDays: 'Aucun jour mesuré pour l’instant.', fillsTomorrow: 'Demain matin cette liste commence à se remplir toute seule.',
    notWritten: 'non écrit', notWrittenYet: 'Ce jour a été mesuré mais pas encore écrit.',
    writeThisDay: 'écrire cette journée', writing: 'écriture…',
    rewrite: 'réécrire', rewriting: 'réécriture…',
    daySummary: 'résumé de la journée', theRecap: 'le récap',
    claudeDidNotAnswer: 'Claude Code n’a pas répondu.',
    claudeText: 'Sans lui la mesure continue intacte, mais le journal ne s’écrit pas. Vérifie que la commande claude est installée et connectée.',
  },
  chat: {
    title: 'Pose une question sur', titleStrong: 'ta journée',
    explanation: 'Je consulte ce qui a été mesuré sur cette machine — temps par application et par fenêtre, projets, commits, sites, raccourcis, ce que tu as tapé et ce que tu as demandé aux agents. Rien de tout ça ne sort d’ici.',
    placeholder: 'demande ce que tu veux sur ton temps',
    listening: 'j’écoute… arrête de parler et j’envoie', transcribing: 'transcription…',
    reconnecting: 'reconnexion au noyau…', thinking: 'réflexion…', lookingUp: 'consultation',
    send: 'envoyer', speak: 'parler', stopListening: 'arrêter d’écouter', stopTalking: 'arrêter de parler',
    liveStart: 'parler en direct', liveStop: 'terminer la conversation', liveConnecting: 'connexion…', liveOn: 'en direct',
    liveNoAnswer: 'La voix en direct n’a pas répondu. Vérifie la clé OpenAI dans Réglages.',
    connected: 'connecté au noyau',
    alwaysAloud: 'répondre toujours à voix haute', aloudWhenYouSpeak: 'répondre à voix haute seulement quand tu parles',
    coreIsDown: 'Le noyau est éteint. Renvoie-le quand il sera revenu.',
    listen: 'écouter', clickToSpeak: 'clique pour parler',
    suggestions: [
      'Fais-moi un récap amusant de mon historique : habitudes de travail, distractions, raccourcis préférés, mon style d’écriture et une petite pique',
      'Où est passé mon temps cette semaine ?',
      'Sur quel projet ai-je le plus travaillé ces 30 derniers jours ?',
      'Quelle a été ma plus grande distraction hier ?',
      'À quelle heure suis-je le plus efficace ?',
    ],
  },
  settings: {
    title: 'Réglages', subtitle: 'tout reste sur cette machine',
    language: 'langue', languageNote: 'vaut pour l’interface, le journal, la conversation et la voix',
    name: 'comment t’appeler', nameNote: 'utilisé dans le journal et la conversation',
    vault: 'coffre Obsidian', vaultNote: 'où le résumé de chaque journée est écrit',
    chooseFolder: 'choisir un dossier', noVault: 'aucun dossier choisi — le journal n’est pas écrit',
    journalSubfolder: 'sous-dossier du journal',
    keys: 'clés', keysNote: 'gardées dans le Trousseau de macOS, jamais dans un fichier texte',
    inTheKeychain: 'dans le Trousseau',
    jevKey: 'clé jev (TypeSafe)', jevNote: 'classe chaque fenêtre en catégorie et en projet',
    openaiKey: 'clé OpenAI', openaiNote: 'seulement pour parler et transcrire ; la conversation est toujours Claude Code',
    optional: 'facultatif', isSet: 'configurée', notSet: 'non configurée', remove: 'retirer',
    day: 'la journée commence à', dayNote: 'le petit matin compte pour la veille', hourSuffix: 'h',
    keepTyping: 'garder ce que tu tapes', keepTypingNote: 'les secrets sont déjà masqués ; désactive si tu préfères seulement les chiffres',
    shortcut: 'raccourci pour l’appeler', shortcutNote: 'le noyau apparaît là où tu l’as laissé, déjà à l’écoute', shortcutPress: 'appuie sur la combinaison…', shortcutTaken: 'une autre app utilise déjà cette combinaison', shortcutOff: 'aucun', shortcutClear: 'désactiver',
    voiceMode: 'comment tu lui parles', voiceModeNote: 'les deux réfléchissent avec Claude Code ; seuls la bouche et l’oreille changent', voicePush: 'appuyer et parler', voicePushNote: 'tu appuies, tu parles, il répond — un tour à la fois, et seule la transcription coûte', voiceLive: 'en direct', voiceLiveNote: 'il t’entend pendant que tu parles et tu peux le couper — facturé au temps de session ouverte', voiceLiveNeedsKey: 'nécessite la clé OpenAI', liveVoiceLabel: 'voix',
    region: 'région de la clé', regionNote: 'une clé de projet européen ne parle pas au serveur global — et seule la voix s’en plaint', regionGlobal: 'global', regionEu: 'Europe',
    caption: 'légende sur le noyau flottant', captionNote: 'écrire ce qu’il a entendu et ce qu’il a répondu — désactive pour ne laisser que la sphère',
    wideTools: 'outils élargis', wideToolsNote: 'désactivé, il répond seulement avec ce qui a été mesuré ici et rien ne sort de la machine', wideToolsOn: 'activé : il peut lire des fichiers, lancer des commandes et chercher sur le web sans demander, et il utilise tes serveurs MCP',
    save: 'enregistrer', saved: 'enregistré', saving: 'enregistrement…', test: 'tester', working: 'fonctionne', failed: 'a échoué',
    agents: 'mesurer tout seul, dès l’ouverture de session',
    agentsNote: 'le collecteur, le lecteur de fenêtre et l’écoute démarrent avec le Mac et reviennent s’ils tombent',
    agentsOn: 'activés', agentsOff: 'désactivés',
    agentsApprove: 'enregistrés — il ne manque que ton accord',
    agentsWhere: 'Réglages → Général → Ouverture',
  },
  counts: {
    stretch: ['segment', 'segments'], session: ['session tenue', 'sessions tenues'],
    project: ['projet', 'projets'], commit: ['commit', 'commits'],
    aiRequest: ['requête à l’IA', 'requêtes à l’IA'], visit: ['visite de navigateur', 'visites de navigateur'],
    site: ['site', 'sites'], day: ['jour mesuré', 'jours mesurés'], window: ['fenêtre', 'fenêtres'],
  },
  common: {
    min: 'min', h: 'h', s: 's', of: 'de', no: 'sans', close: 'fermer',
    active: 'actif', inTotal: 'au total', nothingHere: 'Rien ici pour l’instant.', noTime: 'Aucun temps mesuré.',
    agentWorking: 'agent au travail', at: 'à', ofActive: 'de l’actif',
    session: 'session', sessions: 'sessions', averageOf: 'moyenne de', perDay: 'par jour mesuré',
    others: (n) => `${n} autres`,
    restOnScreen: '… le reste est écrit à l’écran.', didNotCatch: 'Je n’ai pas compris.',
    keyRefused: 'OpenAI a refusé la clé. Remplace-la dans Réglages → clés.',
    micDenied: 'Le micro a été refusé. Autorise-le dans Réglages → Confidentialité et sécurité → Microphone.',
  },
}

const de: Strings = {
  tabs: { today: 'Heute', rhythm: 'Rhythmus', work: 'Arbeit', journal: 'Tagebuch', chat: 'Gespräch', settings: 'Einstellungen' },
  status: {
    brand: 'das Gedächtnis der Maschine',
    source: { 'aguardando-permissao': 'wartet auf deine Erlaubnis', 'sem-permissao': 'keine Berechtigung', nunca: 'noch nicht versucht' },
    measuring: 'misst', idle: 'untätig', stopped: 'steht still', coreDown: 'Kern ist aus',
    inFocus: 'konzentriert', accessibility: 'Bedienungshilfen', classification: 'Fensterklassifizierung',
    narrative: 'Schreiben und Gespräch',
    startItWith: 'Starte ihn mit', noCore: 'Der Kern antwortet nicht.',
  },
  today: {
    title: 'Heute', today: 'Heute', loading: 'Lädt…',
    previousDay: '← voriger Tag', todayButton: 'heute', nextDay: 'nächster Tag →',
    from: 'von', to: 'bis', idleMachine: 'stillstehender Rechner', nothingMeasured: 'noch nichts gemessen',
    measuringNoActivity: 'Es wird gemessen, aber ohne Aktivität:', backToKeyboard: 'Sobald du zur Tastatur zurückkommst, füllt sich dieser Bildschirm von selbst.',
    collectorRecords: 'Der Sammler zeichnet ab dem Moment auf, in dem er startet — davor gibt es keine Historie.',
    onlySees: 'Hippocampus sieht erst ab dem Tag, an dem es zu messen begann.',
    yourTime: 'deine Zeit', awayFromMachine: 'weg vom Rechner',
    delegated: 'delegierte Arbeit', delegatedNote: 'Agenten haben produziert, während du etwas anderes gemacht hast',
    noDelegated: 'kein Agent hat außerhalb deiner Zeit gearbeitet',
    focused: 'konzentrierte Arbeit', focusedNote: 'Zeit in Code, KI, Schreiben, Design und Recherche',
    switches: 'App-Wechsel', switchesNote: (n) => `${n} haben das Projekt gewechselt — nur die kosten wirklich`,
    dominated: 'App, die dominiert hat', biggestSlice: 'das größte Stück ging an',
    ribbon: 'der Tag als Band', stretches: 'Abschnitte', tooShort: 'zu kurz zum Zeichnen',
    hoverRibbon: 'fahre über das Band, um das Fenster zu sehen',
    focusShape: 'die Form der Konzentration', sessions: 'durchgehaltene Sitzungen',
    shapeNote: 'Minuten nach Sitzungslänge — 15-Minuten-Fenster mit 75 % Fokus, ohne Pause über 2 Minuten',
    noSession: 'An diesem Tag hat keine Fokus-Sitzung gehalten.',
    medianOf: 'Median von', longestWas: 'die längste war',
    whereTimeWent: 'wohin die Zeit ging', byCategory: 'nach Kategorie', projects: 'berührte Projekte',
    noProject: 'jev hat noch keinem Fenster dieses Tages ein Projekt zugeordnet.',
    windows: 'Fenster, in denen du am längsten warst', noTitles: 'Keine Fenstertitel — die Bedienungshilfen fehlen.',
    hands: 'deine Hände', keys: 'Tasten', clicks: 'Klicks', scroll: 'Scrollgesten',
    writing: 'Schreiben', reading: 'Lesen', mixed: 'gemischt',
    handsNote: 'der Balken ist der Anteil der Tasten am Gesamten — voll heißt schreiben, leer heißt lesen. Das sind Zählungen von Systemereignissen, keine Strecke: Scrollen ist, wie oft du gescrollt hast, nicht wie weit. Und was du getippt hast, wird hier nicht gespeichert, nur wie viel.',
    noKeyboard: 'Noch kein Signal von der Tastatur.',
    whatCameOut: 'was dabei herauskam', commits: 'Commits', aiRequests: 'KI-Anfragen',
    nothingRecorded: 'Nichts aufgezeichnet.',
    signals: 'Signale', visits: 'Browser-Aufrufe', sites: 'Seiten', shortcuts: 'Kürzel',
    charactersTypedIn: 'Zeichen getippt in', sound: 'Ton', somethingPlaying: 'mit etwas, das lief',
    call: 'Mikrofon offen — ein Anruf', screens: 'Bildschirme',
    missingAccessibility: 'Die Berechtigung für Bedienungshilfen fehlt.',
    missingAccessibilityText: 'Ohne sie sehe ich, welche App vorn ist, aber nicht den Fenstertitel — es lässt sich also nicht sagen, woran du gearbeitet hast, nur wo.',
    openAccessibility: 'die Bedienungshilfen-Einstellungen öffnen',
    others: 'andere',
  },
  rhythm: {
    title: 'Rhythmus', daysMeasured: 'gemessene Tage', dayMeasured: 'gemessener Tag', between: 'zwischen', and: 'und',
    days7: '7 Tage', days30: '30 Tage', days90: '90 Tage',
    noDays: 'Noch nicht genug gemessene Tage.',
    rhythmAppears: 'Der Rhythmus erscheint, sobald es mindestens zwei Tage mit Aktivität gibt.',
    totalTime: 'Gesamtzeit', perDay: 'pro gemessenem Tag',
    averageFocus: 'durchschnittlicher Fokus', averageFocusNote: 'gewichtet nach der Zeit jedes Fensters',
    longestDay: 'längster Tag', output: 'Ausstoß', commits: 'Commits',
    whenYouWork: 'wann du arbeitest', hourByWeekday: 'Stunde × Wochentag',
    sumOfPeriod: 'Summe des ganzen Zeitraums', inTotal: 'insgesamt',
    filterHint: 'klick auf ein Feld oder einen Tag, um darunter nur diese Zeit zu sehen', showingOnly: 'darunter nur', wholeDay: 'den ganzen Tag', clearFilter: 'ganzen Zeitraum zeigen', nothingThen: 'In dieser Zeit wurde nichts gemessen.',
    trend: 'Tendenz', activeTimePerDay: 'aktive Zeit pro Tag', averageOf: 'Durchschnitt von',
    perMeasuredDay: 'pro gemessenem Tag', needsThreeDays: 'Für eine Tendenz braucht es mindestens drei gemessene Tage.',
    whereTimeWent: 'wohin die Zeit im Zeitraum ging', byCategory: 'nach Kategorie',
    projects: 'Projekte', noProject: 'Noch kein Projekt zugeordnet.',
    signature: 'deine Tastatur-Handschrift', noShortcuts: 'Im Zeitraum keine Kürzel erfasst.',
    sites: 'Seiten', characters: 'Zeichen im Zeitraum getippt',
    handsLead: (pct, app) => `${pct} % der Tastenanschläge gingen an ${app}`, noHands: 'Keine Tastenanschläge im Zeitraum gezählt.',
    written: 'was du geschrieben hast', writtenNote: 'Zeichen, nach Art der App — der Text selbst zählt nie',
    writing: { ai: 'KI-Anfragen', chat: 'Chats', mail: 'E-Mail', search: 'Suchen', code: 'Code und Terminal', web: 'im Browser', other: 'Sonstiges' },
  },
  work: {
    title: 'Arbeit', pieces: (n) => `${n} ${n === 1 ? 'Arbeitselement' : 'Arbeitselemente'}`,
    byClient: 'nach Kunde', byClientNote: 'nach der Jira- und Confluence-Subdomain und dem Besitzer auf GitHub',
    piecesTitle: 'Arbeitselemente', all: 'alle', seeAll: 'alle Kunden zeigen',
    focused: 'im Fokus', agent: 'vom Agenten', visit: ['Aufruf', 'Aufrufe'], prompt: ['Anfrage', 'Anfragen'],
    moments: 'alles, was es berührt hat, der Reihe nach',
    source: { window: 'Fenster', visit: 'Aufruf', commit: 'Commit', prompt: 'Anfrage', branch: 'Branch', agent: 'Agent' },
    noMoments: 'Keine Momente in diesem Zeitraum.', more: (n) => `${n} weitere zeigen`,
    browser: 'der Browser, nach Art', browserTime: 'Zeit im Fokus je Seitenart',
    browserVisits: 'Aufrufe je Seitenart',
    timeSince: (day) => `Zeit im Fokus wird erst seit ${day} gemessen; damit der ganze Zeitraum zählt, zählen Aufrufe, Commits und Anfragen`,
    empty: 'Keine Arbeitselemente in diesem Zeitraum.',
    emptyNote: 'Sie erscheinen, sobald Browser, Commits und Anfragen an Agenten Tickets, Seiten, Pull Requests und Dokumente nennen.',
    kinds: {
      ticket: 'Tickets', board: 'Boards', wiki: 'Wiki-Seiten', space: 'Bereiche', admin: 'Verwaltung',
      'pull-request': 'Pull Requests', issue: 'Issues', repo: 'Repositories', doc: 'Dokumente', sheet: 'Tabellen',
      slides: 'Präsentationen', design: 'Design', video: 'Videos', mail: 'E-Mail', meeting: 'Meetings', chat: 'Chat',
      ai: 'KI', search: 'Suche', docs: 'Doku', 'sign-in': 'Anmeldung', page: 'andere Seiten',
    },
  },
  journal: {
    title: 'Tagebuch', subtitle: 'was der Rechner gesehen hat, geschrieben von Claude Code',
    noDays: 'Noch keine Tage gemessen.', fillsTomorrow: 'Morgen früh fängt diese Liste an, sich von selbst zu füllen.',
    notWritten: 'nicht geschrieben', notWrittenYet: 'Dieser Tag wurde gemessen, aber noch nicht geschrieben.',
    writeThisDay: 'diesen Tag schreiben', writing: 'schreibt…',
    rewrite: 'neu schreiben', rewriting: 'schreibt neu…',
    daySummary: 'Zusammenfassung des Tages', theRecap: 'der Rückblick',
    claudeDidNotAnswer: 'Claude Code hat nicht geantwortet.',
    claudeText: 'Ohne ihn läuft die Messung unverändert weiter, aber das Tagebuch wird nicht geschrieben. Prüfe, ob der Befehl claude installiert und angemeldet ist.',
  },
  chat: {
    title: 'Frag nach', titleStrong: 'deinem Tag',
    explanation: 'Ich schaue nach, was auf diesem Rechner gemessen wurde — Zeit pro App und Fenster, Projekte, Commits, Seiten, Kürzel, was du getippt und was du die Agenten gefragt hast. Nichts davon verlässt diesen Rechner.',
    placeholder: 'frag irgendetwas über deine Zeit',
    listening: 'ich höre zu… hör auf zu sprechen und ich schicke es', transcribing: 'transkribiert…',
    reconnecting: 'verbinde neu mit dem Kern…', thinking: 'denkt nach…', lookingUp: 'schlägt nach',
    send: 'senden', speak: 'sprechen', stopListening: 'nicht mehr zuhören', stopTalking: 'nicht mehr sprechen',
    liveStart: 'live sprechen', liveStop: 'Gespräch beenden', liveConnecting: 'verbinde…', liveOn: 'live',
    liveNoAnswer: 'Die Live-Stimme hat nicht geantwortet. Prüfe den OpenAI-Schlüssel in den Einstellungen.',
    connected: 'mit dem Kern verbunden',
    alwaysAloud: 'immer laut antworten', aloudWhenYouSpeak: 'nur laut antworten, wenn du sprichst',
    coreIsDown: 'Der Kern ist aus. Schick es noch einmal, wenn er zurück ist.',
    listen: 'zuhören', clickToSpeak: 'klicken zum Sprechen',
    suggestions: [
      'Gib mir einen lustigen Rückblick auf meine Historie: Arbeitsmuster, Ablenkungen, Lieblingskürzel, meinen Schreibstil und einen kleinen Seitenhieb',
      'Wohin ist diese Woche meine Zeit gegangen?',
      'An welchem Projekt habe ich in den letzten 30 Tagen am meisten gearbeitet?',
      'Was war gestern meine größte Ablenkung?',
      'Zu welcher Tageszeit arbeite ich am besten?',
    ],
  },
  settings: {
    title: 'Einstellungen', subtitle: 'alles bleibt auf diesem Rechner',
    language: 'Sprache', languageNote: 'gilt für Oberfläche, Tagebuch, Gespräch und Stimme',
    name: 'wie du genannt werden willst', nameNote: 'wird im Tagebuch und im Gespräch benutzt',
    vault: 'Obsidian-Vault', vaultNote: 'wohin die Zusammenfassung jedes Tages geschrieben wird',
    chooseFolder: 'Ordner wählen', noVault: 'kein Ordner gewählt — das Tagebuch wird nicht geschrieben',
    journalSubfolder: 'Unterordner des Tagebuchs',
    keys: 'Schlüssel', keysNote: 'im macOS-Schlüsselbund gespeichert, nie in einer Textdatei',
    inTheKeychain: 'im Schlüsselbund',
    jevKey: 'jev-Schlüssel (TypeSafe)', jevNote: 'ordnet jedes Fenster einer Kategorie und einem Projekt zu',
    openaiKey: 'OpenAI-Schlüssel', openaiNote: 'nur zum Sprechen und Transkribieren; das Gespräch ist immer Claude Code',
    optional: 'optional', isSet: 'gesetzt', notSet: 'nicht gesetzt', remove: 'entfernen',
    day: 'der Tag beginnt um', dayNote: 'die frühen Stunden zählen zum Vortag', hourSuffix: 'Uhr',
    keepTyping: 'behalten, was du tippst', keepTypingNote: 'Geheimnisse werden schon geschwärzt; schalte es aus, wenn dir die Zahlen reichen',
    shortcut: 'Kurzbefehl zum Rufen', shortcutNote: 'der Kern erscheint, wo du ihn gelassen hast, und hört schon zu', shortcutPress: 'Tastenkombination drücken…', shortcutTaken: 'eine andere App belegt diese Kombination schon', shortcutOff: 'keiner', shortcutClear: 'ausschalten',
    voiceMode: 'wie du mit ihm sprichst', voiceModeNote: 'beide denken mit Claude Code; nur Mund und Ohr ändern sich', voicePush: 'drücken und sprechen', voicePushNote: 'du drückst, sprichst, es antwortet — ein Zug nach dem anderen, und nur die Transkription kostet', voiceLive: 'live', voiceLiveNote: 'es hört dich beim Sprechen und du kannst mitten im Satz unterbrechen — abgerechnet wird die offene Sitzungszeit', voiceLiveNeedsKey: 'braucht den OpenAI-Schlüssel', liveVoiceLabel: 'Stimme',
    region: 'Region des Schlüssels', regionNote: 'ein europäischer Projektschlüssel spricht nicht mit dem globalen Server — und nur die Stimme beschwert sich', regionGlobal: 'global', regionEu: 'Europa',
    caption: 'Untertitel am schwebenden Kern', captionNote: 'schreiben, was er gehört und geantwortet hat — aus lässt nur die Kugel stehen',
    wideTools: 'erweiterte Werkzeuge', wideToolsNote: 'aus antwortet er nur aus dem hier Gemessenen, und nichts verlässt den Rechner', wideToolsOn: 'an: er darf Dateien lesen, Befehle ausführen und im Web suchen, ohne zu fragen, und nutzt deine MCP-Server',
    save: 'speichern', saved: 'gespeichert', saving: 'speichert…', test: 'testen', working: 'funktioniert', failed: 'fehlgeschlagen',
    agents: 'von der Anmeldung an selbst messen',
    agentsNote: 'Sammler, Fensterleser und Mithören starten mit dem Mac und kommen zurück, wenn sie ausfallen',
    agentsOn: 'an', agentsOff: 'aus',
    agentsApprove: 'registriert — wartet auf deine Zustimmung',
    agentsWhere: 'Einstellungen → Allgemein → Anmeldeobjekte',
  },
  counts: {
    stretch: ['Abschnitt', 'Abschnitte'], session: ['durchgehaltene Sitzung', 'durchgehaltene Sitzungen'],
    project: ['Projekt', 'Projekte'], commit: ['Commit', 'Commits'],
    aiRequest: ['KI-Anfrage', 'KI-Anfragen'], visit: ['Browser-Aufruf', 'Browser-Aufrufe'],
    site: ['Seite', 'Seiten'], day: ['gemessener Tag', 'gemessene Tage'], window: ['Fenster', 'Fenster'],
  },
  common: {
    min: 'Min', h: 'Std', s: 's', of: 'von', no: 'kein', close: 'schließen',
    active: 'aktiv', inTotal: 'insgesamt', nothingHere: 'Noch nichts hier.', noTime: 'Keine Zeit gemessen.',
    agentWorking: 'Agent arbeitet', at: 'um', ofActive: 'der aktiven Zeit',
    session: 'Sitzung', sessions: 'Sitzungen', averageOf: 'Durchschnitt von', perDay: 'pro gemessenem Tag',
    others: (n) => `${n} weitere`,
    restOnScreen: '… der Rest steht auf dem Bildschirm.', didNotCatch: 'Das habe ich nicht verstanden.',
    keyRefused: 'OpenAI hat den Schlüssel abgelehnt. Ersetze ihn in Einstellungen → Schlüssel.',
    micDenied: 'Das Mikrofon wurde verweigert. Erlaube es in Einstellungen → Datenschutz & Sicherheit → Mikrofon.',
  },
}

/** Todos os idiomas, prontos para escolher. */
export const STRINGS: Record<Language, Strings> = { 'pt-BR': pt, 'en-US': en, 'es-ES': es, 'fr-FR': fr, 'de-DE': de }
