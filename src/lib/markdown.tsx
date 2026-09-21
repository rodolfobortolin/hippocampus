import type { ReactNode } from 'react'
import { parse, type Block, type Span } from './markdown.ts'

/**
 * The other half of the markdown: turning the tree into React.
 *
 * The reading lives in `markdown.ts`, which knows nothing about React and is
 * tested on its own. This file only draws.
 */

function spans(list: Span[], key: string): ReactNode[] {
  return list.map((span, i) => {
    const k = `${key}-${i}`
    switch (span.kind) {
      case 'strong': return <strong key={k}>{span.text}</strong>
      case 'em': return <em key={k}>{span.text}</em>
      case 'code': return <code key={k}>{span.text}</code>
      case 'link': return (
        // The shell sends these to the person's real browser rather than
        // navigating the app's own window into a web page.
        <a key={k} href={span.href} target="_blank" rel="noreferrer noopener">{span.text}</a>
      )
      default: return span.text
    }
  })
}

function draw(block: Block, key: string): ReactNode {
  switch (block.kind) {
    case 'heading':
      return <h4 key={key}>{spans(block.spans, key)}</h4>
    case 'quote':
      return <blockquote key={key}>{spans(block.spans, key)}</blockquote>
    case 'bullets':
      return (
        <ul key={key}>
          {block.items.map((item, i) => <li key={i}>{spans(item, `${key}-${i}`)}</li>)}
        </ul>
      )
    case 'numbers':
      return (
        <ol key={key}>
          {block.items.map((item, i) => <li key={i}>{spans(item, `${key}-${i}`)}</li>)}
        </ol>
      )
    case 'code':
      return <pre key={key}><code>{block.text}</code></pre>
    case 'table':
      return (
        // A wide table is the one thing allowed past the message's own width,
        // and it scrolls inside itself rather than pushing the conversation.
        <div className="table-scroll" key={key}>
          <table>
            <thead>
              <tr>{block.head.map((cell, c) => <th key={c}>{spans(cell, `${key}-h${c}`)}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => <td key={c}>{spans(cell, `${key}-${r}-${c}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    default:
      return <p key={key}>{spans(block.spans, key)}</p>
  }
}

export function Markdown({ text }: { text: string }) {
  return <>{parse(text).map((block, i) => draw(block, `b${i}`))}</>
}
