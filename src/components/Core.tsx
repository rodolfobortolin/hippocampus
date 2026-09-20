import { useEffect, useRef } from 'react'
import { Core as Cena, type CoreState } from '../three/Core.ts'

export type { CoreState }

export function Core({
  state, level, size,
}: { state: CoreState; level: number; size: 'large' | 'small' | 'floating' }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<Cena | null>(null)

  useEffect(() => {
    if (!canvas.current) return
    // O floating é o large sem a poeira: ele fica por cima do trabalho da
    // pessoa, e ali a poeira lê como sujeira na canvas, não como profundidade.
    const instance = new Cena(canvas.current, {
      compacto: size === 'small',
      poeira: size === 'large',
    })
    scene.current = instance
    // O size muda por CSS (large na opening, small durante a conversa),
    // então quem manda no renderizador é o elemento, não uma prop.
    const observador = new ResizeObserver(() => instance.redimensiona())
    observador.observe(canvas.current)
    return () => {
      observador.disconnect()
      instance.dispose()
      scene.current = null
    }
  }, [size])

  useEffect(() => { scene.current?.setState(state) }, [state])
  useEffect(() => { scene.current?.setNivel(level) }, [level])

  return (
    <div className={`nucleo ${size}`}>
      <canvas ref={canvas} />
    </div>
  )
}
