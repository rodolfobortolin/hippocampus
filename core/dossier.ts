import type { Language } from './languages.ts'

/**
 * O material do dia, no idioma escolhido.
 *
 * Isto é o que o modelo lê para escrever o diário. Deixar o dossiê em português
 * e mandar escrever em alemão custa qualidade: o modelo passa metade do esforço
 * traduzindo antes de começar a pensar. Por isso os números vêm já narrados no
 * idioma certo, e não como rótulos soltos.
 */
export type Dossie = {
  cabecalho: (dia: string, ativo: string) => string
  delegado: (delegado: string, ausente: string) => string
  parado: (ocioso: string) => string
  janela: (inicio: string, fim: string) => string
  trocas: (total: number, deProjeto: number) => string
  foco: (foco: string, ativo: string, pct: number) => string
  sessoes: (n: number, maior: number, mediana: number, faixas: string) => string
  semSessao: string
  porApp: string
  porCategoria: string
  porProjeto: string
  tambemMedido: (commits: number, pedidos: number, visitas: number, janelas: number) => string
  janelas: string
  commits: string
  pedidos: (n: number) => string
  sites: string
  atalhos: string
  digitou: string
}

export const DOSSIER: Record<Language, Dossie> = {
  'pt-BR': {
    cabecalho: (d, a) => `Dia ${d}. Nas mãos dele: ${a}.`,
    delegado: (d, a) =>
      `Trabalho delegado: ${d} em que um agente estava produzindo enquanto ele estava longe do ` +
      `teclado. Isso NÃO é ociosidade — é resultado que saiu sem ele na frente, e vale ser contado ` +
      `como parte do dia. Fora isso, ${a} de ausência de verdade.`,
    parado: (o) => `Tempo parado: ${o}, sem agente trabalhando no meio.`,
    janela: (i, f) => `Começou ${i}, parou ${f}.`,
    trocas: (t, p) => `${t} trocas de aplicativo, das quais ${p} mudaram de projeto (só essas custam resíduo de atenção).`,
    foco: (f, a, p) => `Trabalho concentrado: ${f} de ${a} ativos (${p}%), em categorias de código, IA, escrita, design e pesquisa.`,
    sessoes: (n, ma, me, fx) => `Isso veio em ${n} sessões sustentadas: a maior de ${ma}min, mediana de ${me}min. Por tamanho: ${fx}.`,
    semSessao: 'Nenhuma sessão de foco se sustentou por 15 minutos seguidos.',
    porApp: 'Tempo por aplicativo:', porCategoria: 'Por categoria:', porProjeto: 'Por projeto:',
    tambemMedido: (c, p, v, j) =>
      `Também medido, se precisar peça o detalhe: ${c} commits, ${p} pedidos a agentes, ${v} visitas de navegador, ${j} janelas distintas.`,
    janelas: 'Janelas onde mais ficou:', commits: 'Commits:',
    pedidos: (n) => `Pedidos a agentes (${n}):`,
    sites: 'Sites mais visitados:', atalhos: 'Atalhos:', digitou: 'Amostras do que digitou:',
  },

  'en-US': {
    cabecalho: (d, a) => `Day ${d}. From their own hands: ${a}.`,
    delegado: (d, a) =>
      `Delegated work: ${d} in which an agent was producing while they were away from the keyboard. ` +
      `That is NOT idleness — it is output that happened without them in front of the machine, and it ` +
      `counts as part of the day. Beyond that, ${a} of genuine absence.`,
    parado: (o) => `Idle time: ${o}, with no agent working through it.`,
    janela: (i, f) => `Started ${i}, stopped ${f}.`,
    trocas: (t, p) => `${t} app switches, ${p} of which changed project (only those cost attention residue).`,
    foco: (f, a, p) => `Focused work: ${f} out of ${a} active (${p}%), in code, AI, writing, design and research categories.`,
    sessoes: (n, ma, me, fx) => `That came in ${n} sustained sessions: the longest ${ma}min, median ${me}min. By length: ${fx}.`,
    semSessao: 'No focus session held together for 15 straight minutes.',
    porApp: 'Time per app:', porCategoria: 'By category:', porProjeto: 'By project:',
    tambemMedido: (c, p, v, j) =>
      `Also measured, ask for the detail if you need it: ${c} commits, ${p} agent requests, ${v} browser visits, ${j} distinct windows.`,
    janelas: 'Windows they stayed in most:', commits: 'Commits:',
    pedidos: (n) => `Agent requests (${n}):`,
    sites: 'Most visited sites:', atalhos: 'Shortcuts:', digitou: 'Samples of what they typed:',
  },

  'es-ES': {
    cabecalho: (d, a) => `Día ${d}. De sus propias manos: ${a}.`,
    delegado: (d, a) =>
      `Trabajo delegado: ${d} en los que un agente estaba produciendo mientras él estaba lejos del ` +
      `teclado. Eso NO es ociosidad — es resultado que salió sin él delante, y cuenta como parte del ` +
      `día. Aparte de eso, ${a} de ausencia real.`,
    parado: (o) => `Tiempo parado: ${o}, sin ningún agente trabajando de por medio.`,
    janela: (i, f) => `Empezó ${i}, paró ${f}.`,
    trocas: (t, p) => `${t} cambios de aplicación, de los cuales ${p} cambiaron de proyecto (solo esos dejan residuo de atención).`,
    foco: (f, a, p) => `Trabajo concentrado: ${f} de ${a} activos (${p}%), en categorías de código, IA, escritura, diseño e investigación.`,
    sessoes: (n, ma, me, fx) => `Eso vino en ${n} sesiones sostenidas: la mayor de ${ma}min, mediana de ${me}min. Por tamaño: ${fx}.`,
    semSessao: 'Ninguna sesión de concentración se sostuvo 15 minutos seguidos.',
    porApp: 'Tiempo por aplicación:', porCategoria: 'Por categoría:', porProjeto: 'Por proyecto:',
    tambemMedido: (c, p, v, j) =>
      `También medido, pide el detalle si hace falta: ${c} commits, ${p} peticiones a agentes, ${v} visitas de navegador, ${j} ventanas distintas.`,
    janelas: 'Ventanas donde más estuvo:', commits: 'Commits:',
    pedidos: (n) => `Peticiones a agentes (${n}):`,
    sites: 'Sitios más visitados:', atalhos: 'Atajos:', digitou: 'Muestras de lo que escribió:',
  },

  'fr-FR': {
    cabecalho: (d, a) => `Journée ${d}. De ses propres mains : ${a}.`,
    delegado: (d, a) =>
      `Travail délégué : ${d} pendant lesquels un agent produisait alors qu'il était loin du clavier. ` +
      `Ce n'est PAS de l'inactivité — c'est un résultat obtenu sans lui devant la machine, et cela ` +
      `compte dans la journée. En dehors de ça, ${a} d'absence réelle.`,
    parado: (o) => `Temps immobile : ${o}, sans aucun agent au travail entre-temps.`,
    janela: (i, f) => `A commencé ${i}, s'est arrêté ${f}.`,
    trocas: (t, p) => `${t} changements d'application, dont ${p} ont changé de projet (seuls ceux-là laissent un résidu d'attention).`,
    foco: (f, a, p) => `Travail concentré : ${f} sur ${a} actifs (${p} %), dans les catégories code, IA, écriture, design et recherche.`,
    sessoes: (n, ma, me, fx) => `Cela s'est réparti en ${n} sessions tenues : la plus longue ${ma}min, médiane ${me}min. Par durée : ${fx}.`,
    semSessao: 'Aucune session de concentration n\'a tenu 15 minutes d\'affilée.',
    porApp: 'Temps par application :', porCategoria: 'Par catégorie :', porProjeto: 'Par projet :',
    tambemMedido: (c, p, v, j) =>
      `Également mesuré, demande le détail si besoin : ${c} commits, ${p} requêtes à des agents, ${v} visites de navigateur, ${j} fenêtres distinctes.`,
    janelas: 'Fenêtres où il est resté le plus :', commits: 'Commits :',
    pedidos: (n) => `Requêtes à des agents (${n}) :`,
    sites: 'Sites les plus visités :', atalhos: 'Raccourcis :', digitou: 'Échantillons de ce qu\'il a tapé :',
  },

  'de-DE': {
    cabecalho: (d, a) => `Tag ${d}. Aus eigener Hand: ${a}.`,
    delegado: (d, a) =>
      `Delegierte Arbeit: ${d}, in denen ein Agent produzierte, während er weg von der Tastatur war. ` +
      `Das ist KEIN Leerlauf — es ist Ergebnis, das ohne ihn vor dem Rechner entstand, und es zählt ` +
      `zum Tag. Davon abgesehen ${a} echte Abwesenheit.`,
    parado: (o) => `Stillstand: ${o}, ohne dass dabei ein Agent gearbeitet hätte.`,
    janela: (i, f) => `Begann ${i}, hörte ${f} auf.`,
    trocas: (t, p) => `${t} App-Wechsel, davon ${p} mit Projektwechsel (nur die hinterlassen Aufmerksamkeitsreste).`,
    foco: (f, a, p) => `Konzentrierte Arbeit: ${f} von ${a} aktiv (${p} %), in den Kategorien Code, KI, Schreiben, Design und Recherche.`,
    sessoes: (n, ma, me, fx) => `Das verteilte sich auf ${n} durchgehaltene Sitzungen: die längste ${ma}min, Median ${me}min. Nach Länge: ${fx}.`,
    semSessao: 'Keine Fokus-Sitzung hielt 15 Minuten am Stück.',
    porApp: 'Zeit pro App:', porCategoria: 'Nach Kategorie:', porProjeto: 'Nach Projekt:',
    tambemMedido: (c, p, v, j) =>
      `Ebenfalls gemessen, frag nach dem Detail, wenn du es brauchst: ${c} Commits, ${p} Agenten-Anfragen, ${v} Browser-Aufrufe, ${j} verschiedene Fenster.`,
    janelas: 'Fenster, in denen er am längsten war:', commits: 'Commits:',
    pedidos: (n) => `Agenten-Anfragen (${n}):`,
    sites: 'Meistbesuchte Seiten:', atalhos: 'Kürzel:', digitou: 'Proben dessen, was er tippte:',
  },
}
