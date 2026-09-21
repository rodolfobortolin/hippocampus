import { useEffect, useRef } from 'react'
import { Core as Scene, type CoreState } from '../three/Core.ts'

export type { CoreState }

export function Core({
  state, level, size,
}: { state: CoreState; level: number; size: 'large' | 'small' | 'floating' }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<Scene | null>(null)

  useEffect(() => {
    if (!canvas.current) return
    // The floating one is the large one without the dust: it sits over a
    // person's work, and there the dust reads as dirt on the screen rather
    // than as depth.
    const instance = new Scene(canvas.current, {
      compact: size === 'small',
      dust: size === 'large',
    })
    scene.current = instance
    // The size changes through CSS (large at the opening, small during the
    // conversation), so what drives the renderer is the element, not a prop.
    const observer = new ResizeObserver(() => instance.resize())
    observer.observe(canvas.current)
    return () => {
      observer.disconnect()
      instance.dispose()
      scene.current = null
    }
  }, [size])

  useEffect(() => { scene.current?.setState(state) }, [state])
  useEffect(() => { scene.current?.setLevel(level) }, [level])

  return (
    <div className={`core ${size}`}>
      <canvas ref={canvas} />
    </div>
  )
}
