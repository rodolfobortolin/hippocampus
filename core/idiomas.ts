/**
 * Os cinco idiomas do Hipocampo.
 *
 * O idioma escolhido vale para tudo: a interface, o diário, a conversa, a voz
 * e o formato das datas. Um app que mede o seu dia e escreve sobre ele em outra
 * língua que não a sua não serve para nada.
 */
export const IDIOMAS = {
  'pt-BR': { nome: 'Português', bandeira: 'BR', intl: 'pt-BR' },
  'en-US': { nome: 'English', bandeira: 'US', intl: 'en-US' },
  'es-ES': { nome: 'Español', bandeira: 'ES', intl: 'es-ES' },
  'fr-FR': { nome: 'Français', bandeira: 'FR', intl: 'fr-FR' },
  'de-DE': { nome: 'Deutsch', bandeira: 'DE', intl: 'de-DE' },
} as const

export type Idioma = keyof typeof IDIOMAS

export function idiomaValido(valor: string): Idioma {
  return (valor in IDIOMAS ? valor : 'en-US') as Idioma
}

/** Como o modelo deve escrever, por idioma. */
export const COMO_ESCREVER: Record<Idioma, string> = {
  'pt-BR': 'Escreva SEMPRE em português do Brasil, inclusive o aviso curto antes de usar uma ferramenta.',
  'en-US': 'ALWAYS write in English, including the short note before using a tool.',
  'es-ES': 'Escribe SIEMPRE en español, incluido el aviso breve antes de usar una herramienta.',
  'fr-FR': 'Écris TOUJOURS en français, y compris la courte note avant d\'utiliser un outil.',
  'de-DE': 'Schreibe IMMER auf Deutsch, auch den kurzen Hinweis vor dem Einsatz eines Werkzeugs.',
}

/** As categorias que o jev usa, no idioma de quem lê. */
export const CATEGORIAS_POR_IDIOMA: Record<Idioma, Record<string, string>> = {
  'pt-BR': {
    codigo: 'Escrever, ler ou revisar código; terminal; git; banco de dados',
    ia: 'Conversar com um assistente de IA para produzir trabalho',
    pesquisa: 'Investigar ou aprender algo que serve ao trabalho: documentação, busca, artigo, fórum, e também vídeo ou tutorial sobre assunto técnico, ferramenta, produto concorrente ou tema do projeto. O meio não decide — um vídeo sobre uma tecnologia é pesquisa, não entretenimento.',
    comunicacao: 'E-mail, chat, mensagens, reunião, chamada',
    escrita: 'Escrever texto, documento, proposta, nota',
    design: 'Interface, protótipo, editar imagem ou vídeo do próprio trabalho',
    admin: 'Arquivos, ajustes, instalação, organização, burocracia, banco, contas',
    distracao: 'Lazer: o assunto não tem relação com o trabalho da pessoa — humor, fofoca, esporte, jogo, compras, rede social, notícia geral. Um vídeo só entra aqui quando o ASSUNTO é entretenimento.',
  },
  'en-US': {
    codigo: 'Writing, reading or reviewing code; terminal; git; databases',
    ia: 'Talking to an AI assistant to get work done',
    pesquisa: 'Investigating or learning something that serves the work: documentation, search, articles, forums, and also video or tutorial about a technical subject, a tool, a competing product or the project topic. The medium does not decide — a video about a technology is research, not entertainment.',
    comunicacao: 'Email, chat, messages, meetings, calls',
    escrita: 'Writing prose, a document, a proposal, a note',
    design: 'Interface, prototype, editing an image or video of one\'s own work',
    admin: 'Files, settings, installation, organising, paperwork, banking, accounts',
    distracao: 'Leisure: the subject has no bearing on the person\'s work — humour, gossip, sport, games, shopping, social media, general news. A video belongs here only when the SUBJECT is entertainment.',
  },
  'es-ES': {
    codigo: 'Escribir, leer o revisar código; terminal; git; bases de datos',
    ia: 'Conversar con un asistente de IA para producir trabajo',
    pesquisa: 'Investigar o aprender algo que sirve al trabajo: documentación, búsqueda, artículo, foro, y también vídeo o tutorial sobre un tema técnico, una herramienta, un producto competidor o el tema del proyecto. El medio no decide — un vídeo sobre una tecnología es investigación, no entretenimiento.',
    comunicacao: 'Correo, chat, mensajes, reunión, llamada',
    escrita: 'Escribir texto, documento, propuesta, nota',
    design: 'Interfaz, prototipo, editar imagen o vídeo del propio trabajo',
    admin: 'Archivos, ajustes, instalación, organización, burocracia, banco, cuentas',
    distracao: 'Ocio: el tema no tiene relación con el trabajo de la persona — humor, cotilleo, deporte, juego, compras, redes sociales, noticias generales. Un vídeo entra aquí solo cuando el TEMA es entretenimiento.',
  },
  'fr-FR': {
    codigo: 'Écrire, lire ou relire du code ; terminal ; git ; bases de données',
    ia: 'Dialoguer avec un assistant IA pour produire du travail',
    pesquisa: 'Enquêter ou apprendre quelque chose qui sert au travail : documentation, recherche, article, forum, et aussi vidéo ou tutoriel sur un sujet technique, un outil, un produit concurrent ou le thème du projet. Le support ne décide pas — une vidéo sur une technologie est de la recherche, pas du divertissement.',
    comunicacao: 'Courriel, chat, messages, réunion, appel',
    escrita: 'Écrire un texte, un document, une proposition, une note',
    design: 'Interface, prototype, retoucher une image ou une vidéo de son propre travail',
    admin: 'Fichiers, réglages, installation, rangement, démarches, banque, comptes',
    distracao: 'Loisir : le sujet n\'a aucun rapport avec le travail de la personne — humour, ragots, sport, jeu, achats, réseaux sociaux, actualité générale. Une vidéo n\'entre ici que si le SUJET est le divertissement.',
  },
  'de-DE': {
    codigo: 'Code schreiben, lesen oder prüfen; Terminal; git; Datenbanken',
    ia: 'Mit einem KI-Assistenten arbeiten, um etwas fertigzustellen',
    pesquisa: 'Etwas untersuchen oder lernen, das der Arbeit dient: Dokumentation, Suche, Artikel, Forum, und auch Video oder Tutorial über ein technisches Thema, ein Werkzeug, ein Konkurrenzprodukt oder das Projektthema. Das Medium entscheidet nicht — ein Video über eine Technologie ist Recherche, keine Unterhaltung.',
    comunicacao: 'E-Mail, Chat, Nachrichten, Besprechung, Anruf',
    escrita: 'Text, Dokument, Angebot oder Notiz schreiben',
    design: 'Oberfläche, Prototyp, eigenes Bild oder Video bearbeiten',
    admin: 'Dateien, Einstellungen, Installation, Ordnen, Papierkram, Bank, Konten',
    distracao: 'Freizeit: das Thema hat nichts mit der Arbeit zu tun — Humor, Klatsch, Sport, Spiele, Einkaufen, soziale Medien, allgemeine Nachrichten. Ein Video gehört nur hierher, wenn das THEMA Unterhaltung ist.',
  },
}

/** Os níveis de complexidade que o jev pontua para escolher o modelo. */
export const NIVEIS_POR_IDIOMA: Record<Idioma, string[]> = {
  'pt-BR': [
    'Pergunta direta: a resposta é um número, uma data ou um fato que sai de uma consulta só',
    'Precisa cruzar algumas fontes, comparar períodos ou resumir em poucas linhas',
    'Análise de verdade, comparação ao longo do tempo, texto longo, recap com graça, ou raciocínio sobre causa',
  ],
  'en-US': [
    'A direct question: the answer is a number, a date or a fact that comes out of a single query',
    'Needs to cross a few sources, compare periods or summarise in a few lines',
    'Real analysis, comparison over time, long prose, a recap with wit, or reasoning about cause',
  ],
  'es-ES': [
    'Pregunta directa: la respuesta es un número, una fecha o un hecho que sale de una sola consulta',
    'Necesita cruzar algunas fuentes, comparar periodos o resumir en pocas líneas',
    'Análisis de verdad, comparación a lo largo del tiempo, texto largo, un resumen con gracia, o razonar sobre la causa',
  ],
  'fr-FR': [
    'Question directe : la réponse est un nombre, une date ou un fait issu d\'une seule requête',
    'Doit croiser quelques sources, comparer des périodes ou résumer en quelques lignes',
    'Véritable analyse, comparaison dans le temps, texte long, un récapitulatif avec du mordant, ou raisonner sur la cause',
  ],
  'de-DE': [
    'Direkte Frage: die Antwort ist eine Zahl, ein Datum oder ein Fakt aus einer einzigen Abfrage',
    'Muss mehrere Quellen verbinden, Zeiträume vergleichen oder in wenigen Zeilen zusammenfassen',
    'Echte Analyse, Vergleich über die Zeit, langer Text, ein Rückblick mit Witz, oder über Ursachen nachdenken',
  ],
}

/**
 * As perguntas que o jev recebe, no idioma escolhido.
 *
 * A pergunta vai junto com os critérios: perguntar em português e oferecer
 * critérios em alemão produz uma classificação pior do que qualquer um dos dois
 * sozinho, porque o modelo passa a adivinhar qual dos dois manda.
 */
export const PERGUNTAS_JEV: Record<Idioma, {
  categoria: string; projeto: string; foco: string; complexidade: string; semProjeto: string
}> = {
  'pt-BR': {
    categoria: 'Que tipo de atividade é esta',
    projeto: 'A qual projeto esta janela pertence, se der para saber pelo título',
    foco: 'Esta é uma atividade de trabalho concentrado, e não uma distração ou pausa',
    complexidade: 'Quanto esforço de raciocínio este pedido exige para ser respondido bem',
    semProjeto: 'Nenhum projeto identificável',
  },
  'en-US': {
    categoria: 'What kind of activity is this',
    projeto: 'Which project does this window belong to, if the title makes it knowable',
    foco: 'This is focused work, not a distraction or a break',
    complexidade: 'How much reasoning effort this request needs to be answered well',
    semProjeto: 'No identifiable project',
  },
  'es-ES': {
    categoria: 'Qué tipo de actividad es esta',
    projeto: 'A qué proyecto pertenece esta ventana, si el título permite saberlo',
    foco: 'Esta es una actividad de trabajo concentrado, no una distracción ni una pausa',
    complexidade: 'Cuánto esfuerzo de razonamiento exige esta petición para responderse bien',
    semProjeto: 'Ningún proyecto identificable',
  },
  'fr-FR': {
    categoria: 'De quel type d’activité s’agit-il',
    projeto: 'À quel projet appartient cette fenêtre, si le titre permet de le savoir',
    foco: 'Il s’agit d’un travail concentré, pas d’une distraction ni d’une pause',
    complexidade: 'Quel effort de raisonnement cette demande exige pour être bien traitée',
    semProjeto: 'Aucun projet identifiable',
  },
  'de-DE': {
    categoria: 'Um welche Art von Tätigkeit handelt es sich',
    projeto: 'Zu welchem Projekt gehört dieses Fenster, sofern der Titel es erkennen lässt',
    foco: 'Das ist konzentrierte Arbeit, keine Ablenkung und keine Pause',
    complexidade: 'Wie viel Denkaufwand diese Anfrage braucht, um gut beantwortet zu werden',
    semProjeto: 'Kein erkennbares Projekt',
  },
}

/** O idioma em vigor, resolvido na hora de usar. */
export function idiomaAtual(lang: string): Idioma {
  return idiomaValido(lang)
}

/**
 * O nome de cada categoria na tela.
 *
 * As chaves (`codigo`, `ia`, `distracao`…) são identificadores guardados no
 * banco e nunca mudam — trocar o idioma não pode reescrever o passado. O que
 * muda é só o que se lê.
 */
export const NOMES_CATEGORIA: Record<Idioma, Record<string, string>> = {
  'pt-BR': {
    codigo: 'código', ia: 'IA', pesquisa: 'pesquisa', comunicacao: 'comunicação',
    escrita: 'escrita', design: 'design', admin: 'admin', distracao: 'distração',
    'sem rótulo': 'sem rótulo',
  },
  'en-US': {
    codigo: 'code', ia: 'AI', pesquisa: 'research', comunicacao: 'communication',
    escrita: 'writing', design: 'design', admin: 'admin', distracao: 'distraction',
    'sem rótulo': 'unlabelled',
  },
  'es-ES': {
    codigo: 'código', ia: 'IA', pesquisa: 'investigación', comunicacao: 'comunicación',
    escrita: 'escritura', design: 'diseño', admin: 'admin', distracao: 'distracción',
    'sem rótulo': 'sin etiqueta',
  },
  'fr-FR': {
    codigo: 'code', ia: 'IA', pesquisa: 'recherche', comunicacao: 'communication',
    escrita: 'écriture', design: 'design', admin: 'admin', distracao: 'distraction',
    'sem rótulo': 'sans étiquette',
  },
  'de-DE': {
    codigo: 'Code', ia: 'KI', pesquisa: 'Recherche', comunicacao: 'Kommunikation',
    escrita: 'Schreiben', design: 'Design', admin: 'Admin', distracao: 'Ablenkung',
    'sem rótulo': 'ohne Etikett',
  },
}
