import type { Language } from './languages.ts'

/**
 * The day's material, in the chosen language.
 *
 * This is what the model reads to write the journal. Leaving the dossier in
 * one language and asking for prose in another costs quality: the model spends
 * half its effort translating before it starts thinking. So the numbers arrive
 * already narrated in the right language, not as loose labels.
 */
export type Dossier = {
  header: (day: string, active: string) => string
  delegated: (delegated: string, away: string) => string
  idle: (idle: string) => string
  window: (start: string, end: string) => string
  switches: (total: number, ofProject: number) => string
  focus: (focus: string, active: string, pct: number) => string
  sessions: (n: number, longest: number, median: number, bands: string) => string
  noSession: string
  byApp: string
  byCategory: string
  byProject: string
  alsoMeasured: (commits: number, requests: number, visits: number, windows: number) => string
  windows: string
  commits: string
  requests: (n: number) => string
  sites: string
  shortcuts: string
  typed: string
}

export const DOSSIER: Record<Language, Dossier> = {
  'pt-BR': {
    header: (d, a) => `Dia ${d}. Nas mãos dele: ${a}.`,
    delegated: (d, a) =>
      `Trabalho delegated: ${d} em que um agente estava produzindo enquanto ele estava longe do ` +
      `teclado. Isso NÃO é ociosidade — é resultado que saiu sem ele na frente, e vale ser contado ` +
      `como parte do dia. Fora isso, ${a} de ausência de verdade.`,
    idle: (o) => `Tempo idle: ${o}, sem agente trabalhando no meio.`,
    window: (i, f) => `Começou ${i}, parou ${f}.`,
    switches: (t, p) => `${t} trocas de aplicativo, das quais ${p} mudaram de projeto (só essas custam resíduo de atenção).`,
    focus: (f, a, p) => `Trabalho concentrado: ${f} de ${a} ativos (${p}%), em categorias de código, IA, escrita, design e pesquisa.`,
    sessions: (n, ma, me, fx) => `Isso veio em ${n} sessões sustentadas: a maior de ${ma}min, mediana de ${me}min. Por tamanho: ${fx}.`,
    noSession: 'Nenhuma sessão de foco se sustentou por 15 minutos seguidos.',
    byApp: 'Tempo por aplicativo:', byCategory: 'Por categoria:', byProject: 'Por projeto:',
    alsoMeasured: (c, p, v, j) =>
      `Também medido, se precisar peça o detalhe: ${c} commits, ${p} pedidos a agentes, ${v} visitas de navegador, ${j} janelas distintas.`,
    windows: 'Janelas onde mais ficou:', commits: 'Commits:',
    requests: (n) => `Pedidos a agentes (${n}):`,
    sites: 'Sites mais visitados:', shortcuts: 'Atalhos:', typed: 'Amostras do que digitou:',
  },

  'en-US': {
    header: (d, a) => `Day ${d}. From their own hands: ${a}.`,
    delegated: (d, a) =>
      `Delegated work: ${d} in which an agent was producing while they were away from the keyboard. ` +
      `That is NOT idleness — it is output that happened without them in front of the machine, and it ` +
      `counts as part of the day. Beyond that, ${a} of genuine absence.`,
    idle: (o) => `Idle time: ${o}, with no agent working through it.`,
    window: (i, f) => `Started ${i}, stopped ${f}.`,
    switches: (t, p) => `${t} app switches, ${p} of which changed project (only those cost attention residue).`,
    focus: (f, a, p) => `Focused work: ${f} out of ${a} active (${p}%), in code, AI, writing, design and research categories.`,
    sessions: (n, ma, me, fx) => `That came in ${n} sustained sessions: the longest ${ma}min, median ${me}min. By length: ${fx}.`,
    noSession: 'No focus session held together for 15 straight minutes.',
    byApp: 'Time per app:', byCategory: 'By category:', byProject: 'By project:',
    alsoMeasured: (c, p, v, j) =>
      `Also measured, ask for the detail if you need it: ${c} commits, ${p} agent requests, ${v} browser visits, ${j} distinct windows.`,
    windows: 'Windows they stayed in most:', commits: 'Commits:',
    requests: (n) => `Agent requests (${n}):`,
    sites: 'Most visited sites:', shortcuts: 'Shortcuts:', typed: 'Samples of what they typed:',
  },

  'es-ES': {
    header: (d, a) => `Día ${d}. De sus propias manos: ${a}.`,
    delegated: (d, a) =>
      `Trabajo delegated: ${d} en los que un agente estaba produciendo mientras él estaba lejos del ` +
      `teclado. Eso NO es ociosidad — es resultado que salió sin él delante, y cuenta como parte del ` +
      `día. Aparte de eso, ${a} de ausencia real.`,
    idle: (o) => `Tiempo idle: ${o}, sin ningún agente trabajando de por medio.`,
    window: (i, f) => `Empezó ${i}, paró ${f}.`,
    switches: (t, p) => `${t} cambios de aplicación, de los cuales ${p} cambiaron de proyecto (solo esos dejan residuo de atención).`,
    focus: (f, a, p) => `Trabajo concentrado: ${f} de ${a} activos (${p}%), en categorías de código, IA, escritura, diseño e investigación.`,
    sessions: (n, ma, me, fx) => `Eso vino en ${n} sesiones sostenidas: la mayor de ${ma}min, mediana de ${me}min. Por tamaño: ${fx}.`,
    noSession: 'Ninguna sesión de concentración se sostuvo 15 minutos seguidos.',
    byApp: 'Tiempo por aplicación:', byCategory: 'Por categoría:', byProject: 'Por proyecto:',
    alsoMeasured: (c, p, v, j) =>
      `También medido, pide el detalle si hace falta: ${c} commits, ${p} peticiones a agentes, ${v} visitas de navegador, ${j} ventanas distintas.`,
    windows: 'Ventanas donde más estuvo:', commits: 'Commits:',
    requests: (n) => `Peticiones a agentes (${n}):`,
    sites: 'Sitios más visitados:', shortcuts: 'Atajos:', typed: 'Muestras de lo que escribió:',
  },

  'fr-FR': {
    header: (d, a) => `Journée ${d}. De ses propres mains : ${a}.`,
    delegated: (d, a) =>
      `Travail délégué : ${d} pendant lesquels un agent produisait alors qu'il était loin du clavier. ` +
      `Ce n'est PAS de l'inactivité — c'est un résultat obtenu sans lui devant la machine, et cela ` +
      `compte dans la journée. En dehors de ça, ${a} d'absence réelle.`,
    idle: (o) => `Temps immobile : ${o}, sans aucun agent au travail entre-temps.`,
    window: (i, f) => `A commencé ${i}, s'est arrêté ${f}.`,
    switches: (t, p) => `${t} changements d'application, dont ${p} ont changé de projet (seuls ceux-là laissent un résidu d'attention).`,
    focus: (f, a, p) => `Travail concentré : ${f} sur ${a} actifs (${p} %), dans les catégories code, IA, écriture, design et recherche.`,
    sessions: (n, ma, me, fx) => `Cela s'est réparti en ${n} sessions tenues : la plus longue ${ma}min, médiane ${me}min. Par durée : ${fx}.`,
    noSession: 'Aucune session de concentration n\'a tenu 15 minutes d\'affilée.',
    byApp: 'Temps par application :', byCategory: 'Par catégorie :', byProject: 'Par projet :',
    alsoMeasured: (c, p, v, j) =>
      `Également mesuré, demande le détail si besoin : ${c} commits, ${p} requêtes à des agents, ${v} visites de navigateur, ${j} fenêtres distinctes.`,
    windows: 'Fenêtres où il est resté le plus :', commits: 'Commits :',
    requests: (n) => `Requêtes à des agents (${n}) :`,
    sites: 'Sites les plus visités :', shortcuts: 'Raccourcis :', typed: 'Échantillons de ce qu\'il a tapé :',
  },

  'de-DE': {
    header: (d, a) => `Tag ${d}. Aus eigener Hand: ${a}.`,
    delegated: (d, a) =>
      `Delegierte Arbeit: ${d}, in denen ein Agent produzierte, während er weg von der Tastatur war. ` +
      `Das ist KEIN Leerlauf — es ist Ergebnis, das ohne ihn vor dem Rechner entstand, und es zählt ` +
      `zum Tag. Davon abgesehen ${a} echte Abwesenheit.`,
    idle: (o) => `Stillstand: ${o}, ohne dass dabei ein Agent gearbeitet hätte.`,
    window: (i, f) => `Begann ${i}, hörte ${f} auf.`,
    switches: (t, p) => `${t} App-Wechsel, davon ${p} mit Projektwechsel (nur die hinterlassen Aufmerksamkeitsreste).`,
    focus: (f, a, p) => `Konzentrierte Arbeit: ${f} von ${a} aktiv (${p} %), in den Kategorien Code, KI, Schreiben, Design und Recherche.`,
    sessions: (n, ma, me, fx) => `Das verteilte sich auf ${n} durchgehaltene Sitzungen: die längste ${ma}min, Median ${me}min. Nach Länge: ${fx}.`,
    noSession: 'Keine Fokus-Sitzung hielt 15 Minuten am Stück.',
    byApp: 'Zeit pro App:', byCategory: 'Nach Kategorie:', byProject: 'Nach Projekt:',
    alsoMeasured: (c, p, v, j) =>
      `Ebenfalls gemessen, frag nach dem Detail, wenn du es brauchst: ${c} Commits, ${p} Agenten-Anfragen, ${v} Browser-Aufrufe, ${j} verschiedene Fenster.`,
    windows: 'Fenster, in denen er am längsten war:', commits: 'Commits:',
    requests: (n) => `Agenten-Anfragen (${n}):`,
    sites: 'Meistbesuchte Seiten:', shortcuts: 'Kürzel:', typed: 'Proben dessen, was er tippte:',
  },
}
