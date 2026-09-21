import { config } from './config.ts'
import { all, db } from './db.ts'
import { ask } from './claude.ts'
import { validLanguage, HOW_TO_WRITE, type Language } from './languages.ts'
import { capture, listNotes, NOTE_KINDS, type Captured, type NoteKind } from './notes.ts'
import { vaultReady } from './vault.ts'

/**
 * What the day left behind that is worth keeping past the day.
 *
 * The journal says what the machine measured. This reads what the person
 * actually asked for — their own words, the only half of a conversation the
 * app keeps — and turns the few durable things into notes: a project moved, a
 * problem understood, someone who is waiting for something.
 *
 * It runs once, at the close of the day, and writes on its own. A day that
 * produced nothing durable writes nothing: an empty answer is a good answer,
 * and a note invented to fill the silence is worse than no note.
 */

export type Proposal = { kind: NoteKind; title: string; text: string }

/** How much of the day's asking is read. A day of his runs 8–14 KB. */
const BUDGET = 60_000
const PER_PROMPT = 900
const MOST = 5

const HOW: Record<Language, string> = {
  'pt-BR': `Você lê o que uma pessoa pediu ao Claude Code durante um dia de trabalho e decide o que merece virar nota durável no second brain dela.

Tipos:
- projeto: algo em andamento, com começo e fim (um produto, uma migração, um cliente)
- conhecimento: uma solução, um aprendizado, uma armadilha que ela vai reencontrar
- pessoa: alguém com quem ela trabalha, e o que ficou combinado
- area: responsabilidade contínua que não termina (saúde, finanças, uma prática)
- inbox: pendência solta que precisa de decisão depois

Regras:
- No máximo ${MOST} notas, e é comum um dia render uma ou nenhuma. Não invente para encher.
- Escreva o conteúdo em uma ou duas frases, na terceira pessoa, como registro: o que aconteceu e o resultado. Sem elogio, sem avaliação, sem conselho.
- Nada de senha, chave, token ou dado financeiro, mesmo que apareça no material.
- Se o título já existe na lista de notas do cofre, use o título EXATO da lista — a linha entra na nota que já existe.
- Nada sobre o próprio app estar medindo o dia; isso o diário já registra.
- Só o que a pessoa faria questão de reler daqui a seis meses.

Responda APENAS com JSON, um array, sem cercas de código e sem comentário:
[{"kind":"projeto|conhecimento|pessoa|area|inbox","title":"…","text":"…"}]
Array vazio [] quando o dia não rendeu nada durável.`,
  'en-US': `You read what a person asked Claude Code during a working day and decide what deserves to become a durable note in their second brain.

Kinds:
- project: something under way, with a beginning and an end
- knowledge: a solution, a lesson, a trap they will meet again
- person: someone they work with, and what was agreed
- area: a standing responsibility that never ends
- inbox: a loose end that needs a decision later

Rules:
- At most ${MOST} notes, and one or none is a common day. Do not invent to fill.
- Write one or two sentences, as a record: what happened and what came of it. No praise, no judgement, no advice.
- No password, key, token or financial data, even if it appears in the material.
- If the title already exists in the vault's list, use the EXACT title from the list — the line joins the note that is already there.
- Nothing about the app measuring the day; the journal already records that.
- Only what they would want to reread in six months.

Answer with JSON ONLY, an array, no code fences and no commentary:
[{"kind":"project|knowledge|person|area|inbox","title":"…","text":"…"}]
An empty array [] when the day produced nothing durable.`,
  'es-ES': `Lees lo que una persona pidió a Claude Code durante un día de trabajo y decides qué merece convertirse en nota duradera en su second brain.

Tipos: proyecto (algo en marcha), conocimiento (una solución o aprendizaje), persona (con quién trabaja y qué se acordó), area (responsabilidad continua), inbox (un pendiente suelto).

Reglas:
- Como máximo ${MOST} notas; un día con una o ninguna es normal. No inventes para llenar.
- Una o dos frases, como registro: qué pasó y en qué quedó. Sin elogio ni juicio.
- Nada de contraseñas, claves, tokens ni datos financieros.
- Si el título ya existe en la lista del cofre, usa el título EXACTO de la lista.
- Nada sobre la propia app midiendo el día.

Responde SOLO con JSON, un array, sin vallas de código:
[{"kind":"project|knowledge|person|area|inbox","title":"…","text":"…"}]
Array vacío [] si el día no dejó nada duradero.`,
  'fr-FR': `Tu lis ce qu’une personne a demandé à Claude Code pendant une journée de travail et tu décides ce qui mérite de devenir une note durable dans son second brain.

Types : projet (quelque chose en cours), connaissance (une solution, un apprentissage), personne (avec qui elle travaille et ce qui a été convenu), area (responsabilité continue), inbox (un point en suspens).

Règles :
- Au plus ${MOST} notes ; une ou aucune est une journée normale. N’invente pas pour remplir.
- Une ou deux phrases, comme un relevé : ce qui s’est passé et ce que ça a donné. Sans éloge ni jugement.
- Aucun mot de passe, clé, jeton ni donnée financière.
- Si le titre existe déjà dans la liste du coffre, reprends le titre EXACT de la liste.
- Rien sur l’application elle-même qui mesure la journée.

Réponds UNIQUEMENT en JSON, un tableau, sans balises de code :
[{"kind":"project|knowledge|person|area|inbox","title":"…","text":"…"}]
Tableau vide [] si la journée n’a rien laissé de durable.`,
  'de-DE': `Du liest, was eine Person Claude Code an einem Arbeitstag aufgetragen hat, und entscheidest, was eine dauerhafte Notiz im Second Brain verdient.

Arten: Projekt (etwas Laufendes), Wissen (eine Lösung, eine Erkenntnis), Person (mit wem sie arbeitet und was vereinbart wurde), area (dauernde Verantwortung), inbox (ein offener Punkt).

Regeln:
- Höchstens ${MOST} Notizen; eine oder keine ist ein normaler Tag. Erfinde nichts, um zu füllen.
- Ein bis zwei Sätze, als Protokoll: was geschah und was dabei herauskam. Kein Lob, kein Urteil.
- Keine Passwörter, Schlüssel, Token oder Finanzdaten.
- Wenn der Titel in der Liste des Tresors schon existiert, nimm GENAU diesen Titel.
- Nichts darüber, dass die App den Tag misst.

Antworte NUR mit JSON, einem Array, ohne Code-Zäune:
[{"kind":"project|knowledge|person|area|inbox","title":"…","text":"…"}]
Leeres Array [], wenn der Tag nichts Dauerhaftes hinterlassen hat.`,
}

const HEADER: Record<Language, (day: string) => string> = {
  'pt-BR': (day) => `Dia ${day}. O que ele pediu, na ordem:`,
  'en-US': (day) => `Day ${day}. What they asked for, in order:`,
  'es-ES': (day) => `Día ${day}. Lo que pidió, en orden:`,
  'fr-FR': (day) => `Jour ${day}. Ce qu’elle a demandé, dans l’ordre :`,
  'de-DE': (day) => `Tag ${day}. Was sie verlangt hat, der Reihe nach:`,
}

const ALSO: Record<Language, { commits: string; meetings: string; notes: string }> = {
  'pt-BR': { commits: 'Commits do dia:', meetings: 'Reuniões:', notes: 'Notas que já existem no cofre (use o título exato quando for a mesma coisa):' },
  'en-US': { commits: 'Commits of the day:', meetings: 'Meetings:', notes: 'Notes already in the vault (use the exact title when it is the same thing):' },
  'es-ES': { commits: 'Commits del día:', meetings: 'Reuniones:', notes: 'Notas que ya existen (usa el título exacto cuando sea lo mismo):' },
  'fr-FR': { commits: 'Commits du jour :', meetings: 'Réunions :', notes: 'Notes déjà présentes (reprends le titre exact quand c’est la même chose) :' },
  'de-DE': { commits: 'Commits des Tages:', meetings: 'Termine:', notes: 'Notizen, die es schon gibt (nimm genau diesen Titel, wenn es dasselbe ist):' },
}

/** The kind names the model may answer with, in any of the languages. */
const KIND_OF: Record<string, NoteKind> = {
  project: 'project', projeto: 'project', proyecto: 'project', projet: 'project', projekt: 'project',
  knowledge: 'knowledge', conhecimento: 'knowledge', conocimiento: 'knowledge', connaissance: 'knowledge', wissen: 'knowledge',
  person: 'person', pessoa: 'person', persona: 'person', personne: 'person',
  area: 'area', área: 'area', domaine: 'area', bereich: 'area',
  inbox: 'inbox', entrada: 'inbox', boîte: 'inbox', eingang: 'inbox',
}

/** The day's material: their own asking, plus what the machine saw around it. */
export function material(day: string): string {
  const language = validLanguage(config.lang)
  const also = ALSO[language]
  const lines: string[] = [HEADER[language](day), '']

  let spent = 0
  for (const turn of all<any>(
    `select project, prompt from ai_turns where day = ? and prompt <> '' order by ts`, day)) {
    const text = String(turn.prompt).replace(/\s+/g, ' ').trim().slice(0, PER_PROMPT)
    if (!text) continue
    spent += text.length
    if (spent > BUDGET) break
    lines.push(`- [${turn.project ?? '—'}] ${text}`)
  }

  const commits = all<any>(
    `select repo, subject from commits where day = ? order by ts limit 40`, day)
  if (commits.length) {
    lines.push('', also.commits, ...commits.map((c) => `- ${c.repo}: ${c.subject}`))
  }

  const meetings = all<any>(
    `select title, attendees from meetings where day = ? order by started_at limit 20`, day)
  if (meetings.length) {
    lines.push('', also.meetings, ...meetings.map((m) => `- ${m.title ?? '—'} (${m.attendees})`))
  }

  const known = NOTE_KINDS.flatMap((kind) => listNotes(kind).map((title) => `- ${kind}: ${title}`))
  if (known.length) lines.push('', also.notes, ...known.slice(0, 120))

  return lines.join('\n')
}

/** The proposals inside whatever the model answered, and nothing else. */
export function readProposals(answer: string): Proposal[] {
  // A model that was told not to fence its JSON sometimes fences it anyway.
  const body = answer.replace(/^```(?:json)?/gm, '').replace(/```$/gm, '').trim()
  const from = body.indexOf('[')
  const to = body.lastIndexOf(']')
  if (from < 0 || to < from) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(body.slice(from, to + 1))
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const seen = new Set<string>()
  const proposals: Proposal[] = []
  for (const item of parsed) {
    const kind = KIND_OF[String((item as any)?.kind ?? '').trim().toLowerCase()]
    const title = String((item as any)?.title ?? '').trim()
    const text = String((item as any)?.text ?? '').trim()
    if (!kind || !title || !text) continue
    const key = `${kind}:${title.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    proposals.push({ kind, title, text })
    if (proposals.length === MOST) break
  }
  return proposals
}

export function capturesOf(day: string): { kind: NoteKind; title: string; file: string; created: number }[] {
  return all<any>('select kind, title, file, created from captures where day = ? order by id', day)
}

/**
 * Reads the day and writes what it left behind.
 *
 * Writing twice is the danger — the same line arriving in a note every time a
 * day is closed again. A day that already has captures is left alone unless
 * this is asked for again on purpose.
 */
export async function curate(day: string, options: { again?: boolean } = {}): Promise<Proposal[]> {
  if (!vaultReady()) return []
  if (!options.again && capturesOf(day).length) return []

  const language = validLanguage(config.lang)
  const answer = await ask(material(day), [HOW_TO_WRITE[language], '', HOW[language]].join('\n'))
  const proposals = readProposals(answer)

  const written: Captured[] = []
  for (const proposal of proposals) {
    try {
      const saved = capture({ ...proposal, day })
      written.push(saved)
      db.prepare(
        `insert into captures (day, kind, title, file, created, at)
         values (?, ?, ?, ?, ?, ?)
         on conflict(day, kind, title) do nothing`,
      ).run(day, proposal.kind, proposal.title, saved.file, saved.created ? 1 : 0, Math.floor(Date.now() / 1000))
    } catch (error) {
      // One bad title does not cost the day the other notes.
      console.error('[curator]', proposal.title, (error as Error).message)
    }
  }
  return proposals.slice(0, written.length)
}
