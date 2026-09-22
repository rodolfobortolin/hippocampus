import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { simplex3 } from './noise.glsl.ts'

export type CoreState = 'idle' | 'listening' | 'thinking' | 'tool' | 'speaking' | 'error'

type Visual = { a: string; b: string; energia: number; giro: number }

// The palette: ember and gold, with water held back for the moment it is
// reaching into the database — so you can tell what is happening without reading.
const LOOKS: Record<CoreState, Visual> = {
  idle: { a: '#ff7a2f', b: '#ffd9a8', energia: 0.12, giro: 0.7 },
  listening: { a: '#ffb43d', b: '#fff1cf', energia: 0.3, giro: 1.5 },
  thinking: { a: '#ff6a1f', b: '#ffffff', energia: 0.62, giro: 4.0 },
  tool: { a: '#4dd8c0', b: '#dffdf7', energia: 0.7, giro: 5.2 },
  speaking: { a: '#ffc861', b: '#fff6e2', energia: 0.32, giro: 1.4 },
  error: { a: '#f87171', b: '#ffe1e6', energia: 0.5, giro: 2.0 },
}

/**
 * Transparency derived from brightness.
 *
 * The composer returns black where there is nothing, and opaque black draws a
 * rectangle. Blending in screen mode solves it over a dark panel, but washes
 * everything out in a floating window over a light desktop. Here the alpha
 * comes from luminance: dark becomes transparent, lit becomes solid, and the
 * core floats over any background.
 */
const ALPHA_FROM_BRIGHTNESS = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() {
      vec4 colour = texture2D(tDiffuse, vUv);
      float brightness = dot(colour.rgb, vec3(0.299, 0.587, 0.114));
      float alpha = smoothstep(0.045, 0.26, brightness);
      // The bloom does not stop; it thins out and keeps going all the way to
      // the edge of the frame, and the frame is a rectangle. Over a desktop —
      // light or dark, it shows either way — that reads as a grey square around
      // the sphere, because a square is exactly what it is.
      //
      // So the halo is faded out in a circle before it can reach any edge. The
      // sphere sits in the middle and never comes near this, so nothing that
      // should be lit is lost: what goes is only the wash that was giving the
      // canvas away.
      float radius = length(vUv - 0.5) * 2.0;
      alpha *= 1.0 - smoothstep(0.62, 0.98, radius);
      if (alpha < 0.004) discard;
      // Premultiplied. With straight alpha Safari drew the halo at full colour
      // wherever its alpha was fading, so on an iPhone the fade above became
      // an opaque disc around the sphere.
      gl_FragColor = vec4(colour.rgb * alpha, alpha);
    }`,
}

const damp = (from: number, to: number, lambda: number, dt: number) =>
  THREE.MathUtils.lerp(from, to, 1 - Math.exp(-lambda * dt))

/**
 * The core: a plasma sphere displaced by noise, with rings around it. It reacts
 * to volume — yours when you speak, its own when it answers — and changes colour
 * and agitation according to its state.
 */
export class Core {
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly renderer: THREE.WebGLRenderer
  private readonly composer: EffectComposer
  private readonly bloom: UnrealBloomPass
  private readonly plasma: THREE.ShaderMaterial
  private readonly sphere: THREE.Mesh
  private readonly rings: THREE.Mesh[] = []
  private readonly dust: THREE.Points
  private readonly clock = new THREE.Clock()
  private readonly compact: boolean

  private state: CoreState = 'idle'
  private level = 0
  private smoothLevel = 0
  private smoothEnergy = LOOKS.idle.energia
  private smoothSpin = LOOKS.idle.giro
  private flash = 0
  private phase = 0
  private frame = 0
  private disposed = false

  private readonly colorA = new THREE.Color(LOOKS.idle.a)
  private readonly colorB = new THREE.Color(LOOKS.idle.b)
  private readonly targetA = new THREE.Color(LOOKS.idle.a)
  private readonly targetB = new THREE.Color(LOOKS.idle.b)

  /**
   * `compact` is the miniature core beside the composer.
   *
   * At the small size the rings and the dust become noise, and a sphere filling
   * the frame lets the glow be cut off at the edge — the result is a square
   * smudge. Here it keeps only the sphere, smaller inside the frame, so the
   * halo terminar antes do end do canvas.
   *
   * `dust` is dropped in the floating window: there the core hovers over what
   * the person is doing, and the dust, which gives depth inside the panel,
   * vira sujeira espalhada por cima do trabalho dela.
   */
  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: { compact?: boolean; dust?: boolean } | boolean = {},
  ) {
    const { compact = false, dust = true } =
      typeof options === 'boolean' ? { compact: options, dust: !options } : options
    this.compact = compact
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas, antialias: true, alpha: true,
    })
    this.renderer.setClearColor(0x000000, 0)
    // Above 2 the cost grows and nobody sees the difference.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    // The camera sits far enough back for the rings (diameter 3.9) to fit
    // inteiros no frame; encostados na borda eles viram um corte reto.
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    this.camera.position.set(0, 0, compact ? 5.2 : 6.6)

    this.plasma = new THREE.ShaderMaterial({
      uniforms: {
        uFase: { value: 0 },
        uEnergia: { value: 0.2 },
        uNivel: { value: 0 },
        uClarao: { value: 0 },
        uCorA: { value: this.colorA },
        uCorB: { value: this.colorB },
      },
      vertexShader: /* glsl */ `
        uniform float uFase; uniform float uEnergia; uniform float uNivel;
        varying vec3 vNormal; varying vec3 vVista; varying float vDesl; varying vec3 vObj;
        ${simplex3}
        void main() {
          vObj = normal;
          float lento = snoise(normal * 1.35 + vec3(uFase * 0.55));
          float fino = snoise(normal * 3.8 - vec3(uFase * 1.1));
          float desl = lento * (0.07 + uEnergia * 0.2 + uNivel * 0.34)
                     + fino * (0.015 + uEnergia * 0.05 + uNivel * 0.07);
          vDesl = desl;
          vec4 mv = modelViewMatrix * vec4(position + normal * desl, 1.0);
          vVista = normalize(-mv.xyz);
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCorA; uniform vec3 uCorB; uniform float uClarao;
        uniform float uEnergia; uniform float uFase;
        varying vec3 vNormal; varying vec3 vVista; varying float vDesl; varying vec3 vObj;
        ${simplex3}

        // Ridged noise: where the noise crosses zero a thin filament is born.
        float veia(vec3 p, float nitidez) {
          return pow(max(1.0 - abs(snoise(p)), 0.0), nitidez);
        }

        void main() {
          float fresnel = pow(1.0 - max(dot(vNormal, vVista), 0.0), 2.4);
          vec3 fundo = uCorA * 0.07;
          vec3 colour = mix(fundo, uCorA * (0.9 + uEnergia), smoothstep(-0.12, 0.22, vDesl));
          colour = mix(colour, uCorB, fresnel * 0.4);
          colour += uCorB * pow(fresnel, 6.0) * 0.55;

          vec3 sp = vObj * 2.7 + vec3(uFase * 0.3, uFase * 0.22, -uFase * 0.26);
          float filamentos = veia(sp, 22.0) + 0.6 * veia(sp * 2.1 + 17.0, 34.0);
          float disparo = 0.45 + 0.55 * sin(uFase * 1.6 + snoise(vObj * 0.8) * 6.28);
          colour += uCorB * filamentos * disparo * (0.1 + uEnergia * 1.4);

          colour += uCorB * uClarao;
          gl_FragColor = vec4(colour, 1.0);
        }`,
    })

    this.sphere = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, compact ? 24 : 48), this.plasma)
    // Smaller inside the frame: room left over for the halo to die before the edge.
    if (compact) this.sphere.scale.setScalar(0.62)
    this.scene.add(this.sphere)

    // Two rings tilted on different axes: they give the spin some depth.
    for (const [index, radius] of (compact ? [] : [1.55, 1.95]).entries()) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.006, 8, 220),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(LOOKS.idle.b),
          transparent: true,
          opacity: index === 0 ? 0.5 : 0.28,
          blending: THREE.AdditiveBlending,
        }),
      )
      ring.rotation.set(index === 0 ? 1.15 : -0.5, index === 0 ? 0.3 : 0.9, 0)
      this.rings.push(ring)
      this.scene.add(ring)
    }

    // Dust around it: without it the core looks cut out and pasted on.
    const total = compact || !dust ? 0 : 420
    const positions = new Float32Array(total * 3)
    for (let i = 0; i < total; i++) {
      const radius = 2.2 + Math.random() * 1.2
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.6
      positions[i * 3 + 2] = radius * Math.cos(phi)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.dust = new THREE.Points(geometry, new THREE.PointsMaterial({
      color: new THREE.Color('#ffd9a8'), size: 0.018, transparent: true,
      opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
    }))
    this.scene.add(this.dust)

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(1, 1), compact ? 0.62 : 0.85, compact ? 0.55 : 0.75, 0.2)
    this.composer.addPass(this.bloom)
    const alphaPass = new ShaderPass(ALPHA_FROM_BRIGHTNESS)
    alphaPass.renderToScreen = true
    this.composer.addPass(alphaPass)

    this.resize()
    this.draw()
  }

  setState(state: CoreState): void {
    if (state === this.state) return
    this.state = state
    const visual = LOOKS[state]
    this.targetA.set(visual.a)
    this.targetB.set(visual.b)
    this.flash = Math.max(this.flash, 0.35)
  }

  /** 0 to 1: the volume of whoever is speaking now. */
  setLevel(level: number): void {
    this.level = THREE.MathUtils.clamp(level, 0, 1)
  }

  pulse(strength = 1): void {
    this.flash = Math.max(this.flash, strength)
  }

  resize(): void {
    const width = this.canvas.clientWidth || 1
    const height = this.canvas.clientHeight || 1
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
    this.composer.setSize(width, height)
    this.bloom.setSize(width, height)
  }

  private draw = (): void => {
    if (this.disposed) return
    this.frame = requestAnimationFrame(this.draw)
    const dt = Math.min(this.clock.getDelta(), 0.05)
    const visual = LOOKS[this.state]

    this.smoothLevel = damp(this.smoothLevel, this.level, 14, dt)
    this.smoothEnergy = damp(this.smoothEnergy, visual.energia, 3.2, dt)
    this.smoothSpin = damp(this.smoothSpin, visual.giro, 2.6, dt)
    this.flash = damp(this.flash, 0, 3.4, dt)
    this.colorA.lerp(this.targetA, 1 - Math.exp(-3 * dt))
    this.colorB.lerp(this.targetB, 1 - Math.exp(-3 * dt))

    // The baseline breathing never goes away: idle, it is still alive.
    this.phase += dt * (0.45 + this.smoothSpin * 0.32 + this.smoothLevel * 1.1)
    this.plasma.uniforms.uFase.value = this.phase
    this.plasma.uniforms.uEnergia.value = this.smoothEnergy
    this.plasma.uniforms.uNivel.value = this.smoothLevel
    this.plasma.uniforms.uClarao.value = this.flash

    const base = this.compact ? 0.62 : 1
    const scale = base * (1 + this.smoothLevel * 0.14 + Math.sin(this.phase * 0.9) * 0.012)
    this.sphere.scale.setScalar(scale)
    this.sphere.rotation.y += dt * 0.12 * this.smoothSpin

    for (const [index, ring] of this.rings.entries()) {
      const direction = index === 0 ? 1 : -1
      ring.rotation.z += dt * 0.22 * this.smoothSpin * direction
      ring.rotation.x += dt * 0.05 * direction
      ring.scale.setScalar(1 + this.smoothLevel * 0.09)
      const material = ring.material as THREE.MeshBasicMaterial
      material.color.copy(this.colorB)
      material.opacity = (index === 0 ? 0.5 : 0.28) + this.smoothLevel * 0.35
    }

    this.dust.rotation.y -= dt * 0.03 * this.smoothSpin
    this.bloom.strength = (this.compact ? 0.5 : 0.72)
      + this.smoothEnergy * (this.compact ? 0.3 : 0.5)
      + this.smoothLevel * (this.compact ? 0.3 : 0.55)

    this.composer.render()
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.sphere.geometry.dispose()
    this.plasma.dispose()
    for (const ring of this.rings) {
      ring.geometry.dispose()
      ;(ring.material as THREE.Material).dispose()
    }
    this.dust.geometry.dispose()
    ;(this.dust.material as THREE.Material).dispose()
    this.composer.dispose()
    this.renderer.dispose()
  }
}
