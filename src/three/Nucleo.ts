import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { simplex3 } from './noise.glsl.ts'

export type EstadoNucleo = 'parado' | 'ouvindo' | 'pensando' | 'ferramenta' | 'falando' | 'erro'

type Visual = { a: string; b: string; energia: number; giro: number }

// A paleta é a do Hipocampo: brasa e ouro, com a água reservada para o momento
// em que ele está mexendo no banco — assim dá para saber o que acontece sem ler.
const VISUAIS: Record<EstadoNucleo, Visual> = {
  parado: { a: '#ff7a2f', b: '#ffd9a8', energia: 0.12, giro: 0.7 },
  ouvindo: { a: '#ffb43d', b: '#fff1cf', energia: 0.3, giro: 1.5 },
  pensando: { a: '#ff6a1f', b: '#ffffff', energia: 0.62, giro: 4.0 },
  ferramenta: { a: '#4dd8c0', b: '#dffdf7', energia: 0.7, giro: 5.2 },
  falando: { a: '#ffc861', b: '#fff6e2', energia: 0.32, giro: 1.4 },
  erro: { a: '#f87171', b: '#ffe1e6', energia: 0.5, giro: 2.0 },
}

const amortece = (de: number, para: number, lambda: number, dt: number) =>
  THREE.MathUtils.lerp(de, para, 1 - Math.exp(-lambda * dt))

/**
 * O núcleo: uma esfera de plasma deslocada por ruído, com anéis em volta.
 * Ele reage ao volume — o seu quando você fala, o dele quando responde — e
 * muda de cor e de agitação conforme o estado.
 */
export class Nucleo {
  private readonly cena = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly renderer: THREE.WebGLRenderer
  private readonly composer: EffectComposer
  private readonly bloom: UnrealBloomPass
  private readonly plasma: THREE.ShaderMaterial
  private readonly esfera: THREE.Mesh
  private readonly aneis: THREE.Mesh[] = []
  private readonly poeira: THREE.Points
  private readonly relogio = new THREE.Clock()

  private estado: EstadoNucleo = 'parado'
  private nivel = 0
  private nivelSuave = 0
  private energiaSuave = VISUAIS.parado.energia
  private giroSuave = VISUAIS.parado.giro
  private clarao = 0
  private fase = 0
  private quadro = 0
  private morto = false

  private readonly corA = new THREE.Color(VISUAIS.parado.a)
  private readonly corB = new THREE.Color(VISUAIS.parado.b)
  private readonly alvoA = new THREE.Color(VISUAIS.parado.a)
  private readonly alvoB = new THREE.Color(VISUAIS.parado.b)

  constructor(private readonly tela: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: true, alpha: true })
    this.renderer.setClearColor(0x000000, 0)
    // Acima de 2 o custo cresce e ninguém enxerga a diferença.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    // A câmera fica longe o bastante para os anéis (diâmetro 3,9) caberem
    // inteiros no quadro; encostados na borda eles viram um corte reto.
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    this.camera.position.set(0, 0, 6.6)

    this.plasma = new THREE.ShaderMaterial({
      uniforms: {
        uFase: { value: 0 },
        uEnergia: { value: 0.2 },
        uNivel: { value: 0 },
        uClarao: { value: 0 },
        uCorA: { value: this.corA },
        uCorB: { value: this.corB },
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

        // Ruído em crista: onde o ruído cruza o zero nasce um filamento fino.
        float veia(vec3 p, float nitidez) {
          return pow(max(1.0 - abs(snoise(p)), 0.0), nitidez);
        }

        void main() {
          float fresnel = pow(1.0 - max(dot(vNormal, vVista), 0.0), 2.4);
          vec3 fundo = uCorA * 0.07;
          vec3 cor = mix(fundo, uCorA * (0.9 + uEnergia), smoothstep(-0.12, 0.22, vDesl));
          cor = mix(cor, uCorB, fresnel * 0.4);
          cor += uCorB * pow(fresnel, 6.0) * 0.55;

          vec3 sp = vObj * 2.7 + vec3(uFase * 0.3, uFase * 0.22, -uFase * 0.26);
          float filamentos = veia(sp, 22.0) + 0.6 * veia(sp * 2.1 + 17.0, 34.0);
          float disparo = 0.45 + 0.55 * sin(uFase * 1.6 + snoise(vObj * 0.8) * 6.28);
          cor += uCorB * filamentos * disparo * (0.1 + uEnergia * 1.4);

          cor += uCorB * uClarao;
          gl_FragColor = vec4(cor, 1.0);
        }`,
    })

    this.esfera = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 48), this.plasma)
    this.cena.add(this.esfera)

    // Dois anéis inclinados em eixos diferentes: dão profundidade ao giro.
    for (const [indice, raio] of [1.55, 1.95].entries()) {
      const anel = new THREE.Mesh(
        new THREE.TorusGeometry(raio, 0.006, 8, 220),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(VISUAIS.parado.b),
          transparent: true,
          opacity: indice === 0 ? 0.5 : 0.28,
          blending: THREE.AdditiveBlending,
        }),
      )
      anel.rotation.set(indice === 0 ? 1.15 : -0.5, indice === 0 ? 0.3 : 0.9, 0)
      this.aneis.push(anel)
      this.cena.add(anel)
    }

    // Poeira em volta: sem ela o núcleo parece recortado e colado no fundo.
    const total = 420
    const posicoes = new Float32Array(total * 3)
    for (let i = 0; i < total; i++) {
      const raio = 2.2 + Math.random() * 1.2
      const teta = Math.random() * Math.PI * 2
      const fi = Math.acos(2 * Math.random() - 1)
      posicoes[i * 3] = raio * Math.sin(fi) * Math.cos(teta)
      posicoes[i * 3 + 1] = raio * Math.sin(fi) * Math.sin(teta) * 0.6
      posicoes[i * 3 + 2] = raio * Math.cos(fi)
    }
    const geometria = new THREE.BufferGeometry()
    geometria.setAttribute('position', new THREE.BufferAttribute(posicoes, 3))
    this.poeira = new THREE.Points(geometria, new THREE.PointsMaterial({
      color: new THREE.Color('#ffd9a8'), size: 0.018, transparent: true,
      opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
    }))
    this.cena.add(this.poeira)

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.cena, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.75, 0.2)
    this.composer.addPass(this.bloom)

    this.redimensiona()
    this.desenha()
  }

  setEstado(estado: EstadoNucleo): void {
    if (estado === this.estado) return
    this.estado = estado
    const visual = VISUAIS[estado]
    this.alvoA.set(visual.a)
    this.alvoB.set(visual.b)
    this.clarao = Math.max(this.clarao, 0.35)
  }

  /** 0 a 1: o volume de quem está falando agora. */
  setNivel(nivel: number): void {
    this.nivel = THREE.MathUtils.clamp(nivel, 0, 1)
  }

  pulso(forca = 1): void {
    this.clarao = Math.max(this.clarao, forca)
  }

  redimensiona(): void {
    const largura = this.tela.clientWidth || 1
    const altura = this.tela.clientHeight || 1
    this.camera.aspect = largura / altura
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(largura, altura, false)
    this.composer.setSize(largura, altura)
    this.bloom.setSize(largura, altura)
  }

  private desenha = (): void => {
    if (this.morto) return
    this.quadro = requestAnimationFrame(this.desenha)
    const dt = Math.min(this.relogio.getDelta(), 0.05)
    const visual = VISUAIS[this.estado]

    this.nivelSuave = amortece(this.nivelSuave, this.nivel, 14, dt)
    this.energiaSuave = amortece(this.energiaSuave, visual.energia, 3.2, dt)
    this.giroSuave = amortece(this.giroSuave, visual.giro, 2.6, dt)
    this.clarao = amortece(this.clarao, 0, 3.4, dt)
    this.corA.lerp(this.alvoA, 1 - Math.exp(-3 * dt))
    this.corB.lerp(this.alvoB, 1 - Math.exp(-3 * dt))

    // A respiração de base nunca some: parado ele continua vivo.
    this.fase += dt * (0.45 + this.giroSuave * 0.32 + this.nivelSuave * 1.1)
    this.plasma.uniforms.uFase.value = this.fase
    this.plasma.uniforms.uEnergia.value = this.energiaSuave
    this.plasma.uniforms.uNivel.value = this.nivelSuave
    this.plasma.uniforms.uClarao.value = this.clarao

    const escala = 1 + this.nivelSuave * 0.14 + Math.sin(this.fase * 0.9) * 0.012
    this.esfera.scale.setScalar(escala)
    this.esfera.rotation.y += dt * 0.12 * this.giroSuave

    for (const [indice, anel] of this.aneis.entries()) {
      const sentido = indice === 0 ? 1 : -1
      anel.rotation.z += dt * 0.22 * this.giroSuave * sentido
      anel.rotation.x += dt * 0.05 * sentido
      anel.scale.setScalar(1 + this.nivelSuave * 0.09)
      const material = anel.material as THREE.MeshBasicMaterial
      material.color.copy(this.corB)
      material.opacity = (indice === 0 ? 0.5 : 0.28) + this.nivelSuave * 0.35
    }

    this.poeira.rotation.y -= dt * 0.03 * this.giroSuave
    this.bloom.strength = 0.72 + this.energiaSuave * 0.5 + this.nivelSuave * 0.55

    this.composer.render()
  }

  dispose(): void {
    this.morto = true
    cancelAnimationFrame(this.quadro)
    this.esfera.geometry.dispose()
    this.plasma.dispose()
    for (const anel of this.aneis) {
      anel.geometry.dispose()
      ;(anel.material as THREE.Material).dispose()
    }
    this.poeira.geometry.dispose()
    ;(this.poeira.material as THREE.Material).dispose()
    this.composer.dispose()
    this.renderer.dispose()
  }
}
