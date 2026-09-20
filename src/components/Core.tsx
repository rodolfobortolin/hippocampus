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
    // The floating one is the large one without the dust: it sits over a
    // person's work, and there the dust reads as dirt on the screen rather
    // than as depth.
    const instance = new Cena(canvas.current, {
      compacto: size === 'small',
      poeira: size === 'large',
    })
    scene.current = instance
    // O size muda por CSS (large na opening, small durante a conversa),
    // so what drives the renderer is the element, not a prop.
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
