import { useEffect, useRef } from 'react'
import { Nucleo as Cena, type EstadoNucleo } from '../three/Nucleo.ts'

export type { EstadoNucleo }

export function Nucleo({
  estado, nivel, tamanho,
}: { estado: EstadoNucleo; nivel: number; tamanho: 'grande' | 'pequeno' | 'solto' }) {
  const tela = useRef<HTMLCanvasElement>(null)
  const cena = useRef<Cena | null>(null)

  useEffect(() => {
    if (!tela.current) return
    // O solto é o grande sem a poeira: ele fica por cima do trabalho da
    // pessoa, e ali a poeira lê como sujeira na tela, não como profundidade.
    const instancia = new Cena(tela.current, {
      compacto: tamanho === 'pequeno',
      poeira: tamanho === 'grande',
    })
    cena.current = instancia
    // O tamanho muda por CSS (grande na abertura, pequeno durante a conversa),
    // então quem manda no renderizador é o elemento, não uma prop.
    const observador = new ResizeObserver(() => instancia.redimensiona())
    observador.observe(tela.current)
    return () => {
      observador.disconnect()
      instancia.dispose()
      cena.current = null
    }
  }, [tamanho])

  useEffect(() => { cena.current?.setEstado(estado) }, [estado])
  useEffect(() => { cena.current?.setNivel(nivel) }, [nivel])

  return (
    <div className={`nucleo ${tamanho}`}>
      <canvas ref={tela} />
    </div>
  )
}
