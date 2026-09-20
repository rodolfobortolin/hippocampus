import type { ReactNode } from 'react'

/** Negrito, itálico e `código` — o suficiente para o que o model devolve. */
function inline(text: string, chave: string): ReactNode[] {
  const chunks: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g
  let last = 0
  let achado: RegExpExecArray | null
  let i = 0

  while ((achado = pattern.exec(text))) {
    if (achado.index > last) chunks.push(text.slice(last, achado.index))
    const raw = achado[0]
    const k = `${chave}-${i++}`
    if (raw.startsWith('**')) chunks.push(<strong key={k}>{raw.slice(2, -2)}</strong>)
    else if (raw.startsWith('`')) chunks.push(<code key={k}>{raw.slice(1, -1)}</code>)
    else chunks.push(<em key={k}>{raw.slice(1, -1)}</em>)
    last = achado.index + raw.length
  }
  if (last < text.length) chunks.push(text.slice(last))
  return chunks
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let list: ReactNode[] = []

  const closeList = () => {
    if (!list.length) return
    blocks.push(<ul key={`l${blocks.length}`}>{list}</ul>)
    list = []
  }

  for (const [index, linha] of text.split('\n').entries()) {
    const clear = linha.trim()
    if (!clear) { closeList(); continue }
    if (/^[-*•]\s+/.test(clear)) {
      list.push(<li key={index}>{inline(clear.replace(/^[-*•]\s+/, ''), `i${index}`)}</li>)
      continue
    }
    closeList()
    if (/^#{1,6}\s/.test(clear)) {
      blocks.push(<h4 key={index}>{inline(clear.replace(/^#{1,6}\s/, ''), `h${index}`)}</h4>)
      continue
    }
    blocks.push(<p key={index}>{inline(clear, `p${index}`)}</p>)
  }
  closeList()
  return <>{blocks}</>
}
