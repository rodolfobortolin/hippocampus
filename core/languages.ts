/**
 * The five languages.
 *
 * The chosen one applies to everything: the interface, the journal, the chat,
 * the voice and the shape of dates. An app that measures your day and then
 * writes about it in someone else's language is of no use to you.
 */
export const LANGUAGES = {
  'pt-BR': { name: 'Português', flag: 'BR', intl: 'pt-BR' },
  'en-US': { name: 'English', flag: 'US', intl: 'en-US' },
  'es-ES': { name: 'Español', flag: 'ES', intl: 'es-ES' },
  'fr-FR': { name: 'Français', flag: 'FR', intl: 'fr-FR' },
  'de-DE': { name: 'Deutsch', flag: 'DE', intl: 'de-DE' },
} as const

export type Language = keyof typeof LANGUAGES

export function validLanguage(value: string): Language {
  return (value in LANGUAGES ? value : 'en-US') as Language
}

/** How the model should write, per language. */
export const HOW_TO_WRITE: Record<Language, string> = {
  'pt-BR': 'Escreva SEMPRE em português do Brasil, inclusive o aviso curto antes de usar uma ferramenta.',
  'en-US': 'ALWAYS write in English, including the short note before using a tool.',
  'es-ES': 'Escribe SIEMPRE en español, incluido el aviso breve antes de usar una herramienta.',
  'fr-FR': 'Écris TOUJOURS en français, y compris la courte note avant d\'utiliser un outil.',
  'de-DE': 'Schreibe IMMER auf Deutsch, auch den kurzen Hinweis vor dem Einsatz eines Werkzeugs.',
}

/** The categories jev uses, in the reader's language. */
export const CATEGORIES_BY_LANGUAGE: Record<Language, Record<string, string>> = {
  'pt-BR': {
    code: 'Escrever, ler ou revisar código; terminal; git; banco de dados',
    ai: 'Conversar com um assistente de IA para produzir trabalho',
    research: 'Investigar ou aprender algo que serve ao trabalho: documentação, busca, artigo, fórum, e também vídeo ou tutorial sobre assunto técnico, ferramenta, produto concorrente ou tema do projeto. O meio não decide — um vídeo sobre uma tecnologia é pesquisa, não entretenimento.',
    communication: 'E-mail, chat, mensagens, reunião, chamada',
    writing: 'Escrever texto, documento, proposta, nota',
    design: 'Interface, protótipo, editar imagem ou vídeo do próprio trabalho',
    admin: 'Arquivos, ajustes, instalação, organização, burocracia, banco, contas',
    distraction: 'Lazer: o assunto não tem relação com o trabalho da pessoa — humor, fofoca, esporte, jogo, compras, rede social, notícia geral. Um vídeo só entra aqui quando o ASSUNTO é entretenimento.',
  },
  'en-US': {
    code: 'Writing, reading or reviewing code; terminal; git; databases',
    ai: 'Talking to an AI assistant to get work done',
    research: 'Investigating or learning something that serves the work: documentation, search, articles, forums, and also video or tutorial about a technical subject, a tool, a competing product or the project topic. The medium does not decide — a video about a technology is research, not entertainment.',
    communication: 'Email, chat, messages, meetings, calls',
    writing: 'Writing prose, a document, a proposal, a note',
    design: 'Interface, prototype, editing an image or video of one\'s own work',
    admin: 'Files, settings, installation, organising, paperwork, banking, accounts',
    distraction: 'Leisure: the subject has no bearing on the person\'s work — humour, gossip, sport, games, shopping, social media, general news. A video belongs here only when the SUBJECT is entertainment.',
  },
  'es-ES': {
    code: 'Escribir, leer o revisar código; terminal; git; bases de datos',
    ai: 'Conversar con un asistente de IA para producir trabajo',
    research: 'Investigar o aprender algo que sirve al trabajo: documentación, búsqueda, artículo, foro, y también vídeo o tutorial sobre un tema técnico, una herramienta, un producto competidor o el tema del proyecto. El medio no decide — un vídeo sobre una tecnología es investigación, no entretenimiento.',
    communication: 'Correo, chat, mensajes, reunión, llamada',
    writing: 'Escribir texto, documento, propuesta, nota',
    design: 'Interfaz, prototipo, editar imagen o vídeo del propio trabajo',
    admin: 'Archivos, ajustes, instalación, organización, burocracia, banco, cuentas',
    distraction: 'Ocio: el tema no tiene relación con el trabajo de la persona — humor, cotilleo, deporte, juego, compras, redes sociales, noticias generales. Un vídeo entra aquí solo cuando el TEMA es entretenimiento.',
  },
  'fr-FR': {
    code: 'Écrire, lire ou relire du code ; terminal ; git ; bases de données',
    ai: 'Dialoguer avec un assistant IA pour produire du travail',
    research: 'Enquêter ou apprendre quelque chose qui sert au travail : documentation, recherche, article, forum, et aussi vidéo ou tutoriel sur un sujet technique, un outil, un produit concurrent ou le thème du projet. Le support ne décide pas — une vidéo sur une technologie est de la recherche, pas du divertissement.',
    communication: 'Courriel, chat, messages, réunion, appel',
    writing: 'Écrire un texte, un document, une proposition, une note',
    design: 'Interface, prototype, retoucher une image ou une vidéo de son propre travail',
    admin: 'Fichiers, réglages, installation, rangement, démarches, banque, comptes',
    distraction: 'Loisir : le sujet n\'a aucun rapport avec le travail de la personne — humour, ragots, sport, jeu, achats, réseaux sociaux, actualité générale. Une vidéo n\'entre ici que si le SUJET est le divertissement.',
  },
  'de-DE': {
    code: 'Code schreiben, lesen oder prüfen; Terminal; git; Datenbanken',
    ai: 'Mit einem KI-Assistenten arbeiten, um etwas fertigzustellen',
    research: 'Etwas untersuchen oder lernen, das der Arbeit dient: Dokumentation, Suche, Artikel, Forum, und auch Video oder Tutorial über ein technisches Thema, ein Werkzeug, ein Konkurrenzprodukt oder das Projektthema. Das Medium entscheidet nicht — ein Video über eine Technologie ist Recherche, keine Unterhaltung.',
    communication: 'E-Mail, Chat, Nachrichten, Besprechung, Anruf',
    writing: 'Text, Dokument, Angebot oder Notiz schreiben',
    design: 'Oberfläche, Prototyp, eigenes Bild oder Video bearbeiten',
    admin: 'Dateien, Einstellungen, Installation, Ordnen, Papierkram, Bank, Konten',
    distraction: 'Freizeit: das Thema hat nichts mit der Arbeit zu tun — Humor, Klatsch, Sport, Spiele, Einkaufen, soziale Medien, allgemeine Nachrichten. Ein Video gehört nur hierher, wenn das THEMA Unterhaltung ist.',
  },
}

/** Os níveis de complexidade que o jev pontua para escolher o modelo. */
export const LEVELS_BY_LANGUAGE: Record<Language, string[]> = {
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
 * The questions jev is asked, in the chosen language.
 *
 * The question travels with the criteria: asking in Portuguese while offering
 * criteria in German classifies worse than either would alone, because the
 * model starts guessing which of the two is in charge.
 */
export const JEV_QUESTIONS: Record<Language, {
  category: string; project: string; focus: string; complexity: string; noProject: string
}> = {
  'pt-BR': {
    category: 'Que tipo de atividade é esta',
    project: 'A qual projeto esta janela pertence, se der para saber pelo título',
    focus: 'Esta é uma atividade de trabalho concentrado, e não uma distração ou pausa',
    complexity: 'Quanto esforço de raciocínio este pedido exige para ser respondido bem',
    noProject: 'Nenhum projeto identificável',
  },
  'en-US': {
    category: 'What kind of activity is this',
    project: 'Which project does this window belong to, if the title makes it knowable',
    focus: 'This is focused work, not a distraction or a break',
    complexity: 'How much reasoning effort this request needs to be answered well',
    noProject: 'No identifiable project',
  },
  'es-ES': {
    category: 'Qué tipo de actividad es esta',
    project: 'A qué proyecto pertenece esta ventana, si el título permite saberlo',
    focus: 'Esta es una actividad de trabajo concentrado, no una distracción ni una pausa',
    complexity: 'Cuánto esfuerzo de razonamiento exige esta petición para responderse bien',
    noProject: 'Ningún proyecto identificable',
  },
  'fr-FR': {
    category: 'De quel type d’activité s’agit-il',
    project: 'À quel projet appartient cette fenêtre, si le titre permet de le savoir',
    focus: 'Il s’agit d’un travail concentré, pas d’une distraction ni d’une pause',
    complexity: 'Quel effort de raisonnement cette demande exige pour être bien traitée',
    noProject: 'Aucun projet identifiable',
  },
  'de-DE': {
    category: 'Um welche Art von Tätigkeit handelt es sich',
    project: 'Zu welchem Projekt gehört dieses Fenster, sofern der Titel es erkennen lässt',
    focus: 'Das ist konzentrierte Arbeit, keine Ablenkung und keine Pause',
    complexity: 'Wie viel Denkaufwand diese Anfrage braucht, um gut beantwortet zu werden',
    noProject: 'Kein erkennbares Projekt',
  },
}

/** The language in force, resolved at the moment of use. */
export function currentLanguage(lang: string): Language {
  return validLanguage(lang)
}

/**
 * The display name of each category.
 *
 * The keys (`code`, `ai`, `distraction`…) are identifiers stored in the
 * database and never change — switching language cannot be allowed to rewrite
 * the past. Only what you read changes.
 */
export const CATEGORY_NAMES: Record<Language, Record<string, string>> = {
  'pt-BR': {
    code: 'código', ai: 'IA', research: 'research', communication: 'comunicação',
    writing: 'writing', design: 'design', admin: 'admin', distraction: 'distração',
    'unlabelled': 'unlabelled',
  },
  'en-US': {
    code: 'code', ai: 'AI', research: 'research', communication: 'communication',
    writing: 'writing', design: 'design', admin: 'admin', distraction: 'distraction',
    'unlabelled': 'unlabelled',
  },
  'es-ES': {
    code: 'código', ai: 'IA', research: 'investigación', communication: 'comunicación',
    writing: 'escritura', design: 'diseño', admin: 'admin', distraction: 'distracción',
    'unlabelled': 'sin etiqueta',
  },
  'fr-FR': {
    code: 'code', ai: 'IA', research: 'recherche', communication: 'communication',
    writing: 'écriture', design: 'design', admin: 'admin', distraction: 'distraction',
    'unlabelled': 'sans étiquette',
  },
  'de-DE': {
    code: 'Code', ai: 'KI', research: 'Recherche', communication: 'Kommunikation',
    writing: 'Schreiben', design: 'Design', admin: 'Admin', distraction: 'Ablenkung',
    'unlabelled': 'ohne Etikett',
  },
}
