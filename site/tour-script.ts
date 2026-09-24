/**
 * The guided tour: what is said, where the page scrolls to, and where the
 * spark points while it is said.
 *
 * The voice is generated once from this text by scripts/site-voice.ts and
 * shipped as files in site/public/voice/ — the page calls no API. Change a
 * line here and generate again, or the voice and the caption disagree.
 *
 * `scroll` is what the page brings to the middle of the screen before the
 * line starts. Each point is a selector, an optional place inside it as
 * fractions of its box (0,0 top left — inside a screenshot, a place in the
 * picture), and `at`, how far into the line the spark goes there, as a
 * fraction of the line's length, so a slower voice does not break the timing.
 */

export type TourPoint = { at: number; target: string; x?: number; y?: number; label: string }
export type TourStep = { id: string; text: string; scroll: string; points: TourPoint[] }

export const TOUR: TourStep[] = [
  {
    id: 'hello',
    text: "Hi, I'm Hippocampus. I remember where your time goes on your Mac, and I can do things on your screen when you ask. Let me show you around.",
    scroll: '.hero',
    points: [{ at: 0.05, target: '.hero h1', x: 0.3, y: 0.3, label: 'Hippocampus' }],
  },
  {
    id: 'today',
    text: "This is your day. Your time at the machine. The work your agents did while you were away. How much of it was focused. And the day as a ribbon, every stretch coloured by the kind of work it was.",
    scroll: '.shot',
    points: [
      { at: 0.12, target: '.shot img', x: 0.22, y: 0.26, label: 'your time' },
      { at: 0.3, target: '.shot img', x: 0.38, y: 0.26, label: 'your agents' },
      { at: 0.52, target: '.shot img', x: 0.575, y: 0.3, label: 'focus' },
      { at: 0.7, target: '.shot img', x: 0.5, y: 0.585, label: 'the day' },
    ],
  },
  {
    id: 'ask',
    text: "Ask me out loud, and I'll look at your screen, point at what you mean, like this, and click when you tell me to. Click me, or say stop, and I stop.",
    scroll: '#ask',
    points: [
      { at: 0.1, target: '#ask article:nth-child(2) h3', label: 'it looks' },
      { at: 0.38, target: '#ask article:nth-child(3) h3', label: 'points and clicks' },
      { at: 0.72, target: '#ask article:nth-child(4) h3', label: 'and stops' },
    ],
  },
  {
    id: 'how',
    text: "Everything comes from what your Mac already writes down: windows, browser history, git, your agents. It all goes into one database, here, on your Mac.",
    scroll: '#how .arch',
    points: [
      { at: 0.1, target: '#how .sources', x: 0.5, y: 0.2, label: 'what it reads' },
      { at: 0.62, target: '#how .core', label: 'one database' },
    ],
  },
  {
    id: 'rhythm',
    text: "Ask the heatmap a question. Pick Thursday at four, and every chart below answers what you were actually doing then.",
    scroll: 'img[src*="rhythm"]',
    points: [
      { at: 0.22, target: 'img[src*="rhythm"]', x: 0.727, y: 0.355, label: 'Thursday, 4 pm' },
      { at: 0.6, target: 'img[src*="rhythm"]', x: 0.27, y: 0.59, label: 'only that hour' },
    ],
  },
  {
    id: 'work',
    text: "Work follows the ticket, not just the app. A Jira tab, a question to Claude Code and a commit on the same ticket become one line, with the client behind it.",
    scroll: 'img[src*="work"]',
    points: [
      { at: 0.2, target: 'img[src*="work"]', x: 0.24, y: 0.49, label: 'one ticket' },
      { at: 0.75, target: 'img[src*="work"]', x: 0.215, y: 0.25, label: 'the client' },
    ],
  },
  {
    id: 'chat',
    text: "And you can simply ask. Where did my time go this week? The answer comes from what was measured, not from a guess.",
    scroll: 'img[src*="chat"]',
    points: [
      { at: 0.15, target: 'img[src*="chat"]', x: 0.87, y: 0.085, label: 'your question' },
      { at: 0.62, target: 'img[src*="chat"]', x: 0.22, y: 0.237, label: 'measured' },
    ],
  },
  {
    id: 'journal',
    text: "When the day closes, a short journal lands in your Obsidian vault. A record of what happened, never a verdict on you.",
    scroll: 'img[src*="journal"]',
    points: [{ at: 0.2, target: 'img[src*="journal"]', x: 0.6, y: 0.32, label: 'every day' }],
  },
  {
    id: 'bye',
    text: "That's me. Free, open source, and what I measure is stored only on your Mac.",
    scroll: '.hero',
    points: [{ at: 0.3, target: '.actions .button.primary', label: 'download' }],
  },
]

/**
 * A click on the sphere: it says hello and offers the tour, and the answer is
 * given on the screen. `yes` takes the place of the tour's first line, since
 * the sphere has already introduced itself by then.
 */
export const GREETING = {
  ask: { id: 'greet', text: "Hey, nice to meet you! I'm Hippocampus. Would you like a quick private tour of how I can help you?" },
  later: { id: 'later', text: "No problem. I'll be right here if you need me." },
  yes: {
    ...TOUR[0],
    id: 'hello-yes',
    text: "Great. I remember where your time goes on your Mac, and I can do things on your screen when you ask. Let me show you around.",
  } satisfies TourStep,
}
