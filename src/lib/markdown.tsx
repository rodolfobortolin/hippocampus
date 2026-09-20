import type { ReactNode } from 'react'

/** Negrito, itálico e `código` — o suficiente para o que o modelo devolve. */
function inline(texto: string, chave: string): ReactNode[] {
  const pedacos: ReactNode[] = []
  const padrao = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g
  let ultimo = 0
  let achado: RegExpExecArray | null
  let i = 0

  while ((achado = padrao.exec(texto))) {
    if (achado.index > ultimo) pedacos.push(texto.slice(ultimo, achado.index))
    const bruto = achado[0]
    const k = `${chave}-${i++}`
    if (bruto.startsWith('**')) pedacos.push(<strong key={k}>{bruto.slice(2, -2)}</strong>)
    else if (bruto.startsWith('`')) pedacos.push(<code key={k}>{bruto.slice(1, -1)}</code>)
    else pedacos.push(<em key={k}>{bruto.slice(1, -1)}</em>)
    ultimo = achado.index + bruto.length
  }
  if (ultimo < texto.length) pedacos.push(texto.slice(ultimo))
  return pedacos
}

export function Markdown({ texto }: { texto: string }) {
  const blocos: ReactNode[] = []
  let lista: ReactNode[] = []

  const fechaLista = () => {
    if (!lista.length) return
    blocos.push(<ul key={`l${blocos.length}`}>{lista}</ul>)
    lista = []
  }

  for (const [indice, linha] of texto.split('\n').entries()) {
    const limpa = linha.trim()
    if (!limpa) { fechaLista(); continue }
    if (/^[-*•]\s+/.test(limpa)) {
      lista.push(<li key={indice}>{inline(limpa.replace(/^[-*•]\s+/, ''), `i${indice}`)}</li>)
      continue
    }
    fechaLista()
    if (/^#{1,6}\s/.test(limpa)) {
      blocos.push(<h4 key={indice}>{inline(limpa.replace(/^#{1,6}\s/, ''), `h${indice}`)}</h4>)
      continue
    }
    blocos.push(<p key={indice}>{inline(limpa, `p${indice}`)}</p>)
  }
  fechaLista()
  return <>{blocos}</>
}
