import { useState } from 'react'
import { cor, duracao, diasDaSemana, numero } from '../lib/format.ts'
import { useIdioma } from '../lib/idioma.tsx'
import type { BlocoFita, Fatia } from '../lib/api.ts'

/** "outros 12" é um agregado do próprio app, não um projeto — traduz aqui. */
function nomeDaFatia(nome: string, categoria: (c: string) => string, outros: (n: number) => string): string {
  const agregado = /^__outros__(\d+)$/.exec(nome)
  return agregado ? outros(Number(agregado[1])) : categoria(nome)
}

const polar = (cx: number, cy: number, raio: number, grau: number) => {
  const rad = ((grau - 90) * Math.PI) / 180
  return { x: cx + raio * Math.cos(rad), y: cy + raio * Math.sin(rad) }
}

function arco(cx: number, cy: number, externo: number, interno: number, de: number, ate: number): string {
  const grande = ate - de > 180 ? 1 : 0
  const a = polar(cx, cy, externo, ate)
  const b = polar(cx, cy, externo, de)
  const c = polar(cx, cy, interno, de)
  const d = polar(cx, cy, interno, ate)
  return `M${a.x} ${a.y}A${externo} ${externo} 0 ${grande} 0 ${b.x} ${b.y}` +
    `L${c.x} ${c.y}A${interno} ${interno} 0 ${grande} 1 ${d.x} ${d.y}Z`
}

/** Rosca das categorias. O buraco do meio carrega o total. */
export function Rosca({ fatias, total }: { fatias: Fatia[]; total: number }) {
  const { t, categoria } = useIdioma()
  const [sobre, setSobre] = useState<number | null>(null)
  if (!total) return <p className="vazio">{t.comum.semTempo}</p>

  let acumulado = 0
  const desenhos = fatias.map((fatia, indice) => {
    const de = (acumulado / total) * 360
    acumulado += fatia.seconds
    const ate = (acumulado / total) * 360
    // Um respiro entre fatias, sem deixar a fatia fina sumir.
    const folga = Math.min(1.4, (ate - de) / 4)
    return { fatia, de: de + folga, ate: ate - folga, indice }
  })

  const destaque = sobre != null ? fatias[sobre] : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
      <svg viewBox="0 0 160 160" style={{ width: 160, height: 160, flex: 'none' }}>
        {desenhos.map(({ fatia, de, ate, indice }) => (
          <path
            key={fatia.name}
            d={arco(80, 80, sobre === indice ? 74 : 70, 50, de, ate)}
            fill={cor(fatia.name)}
            opacity={sobre == null || sobre === indice ? 0.92 : 0.28}
            style={{ transition: 'opacity .18s, d .18s', cursor: 'default' }}
            onMouseEnter={() => setSobre(indice)}
            onMouseLeave={() => setSobre(null)}
          />
        ))}
        <text x="80" y="76" textAnchor="middle" fill="var(--texto)" fontSize="21" fontWeight="300"
          style={{ fontVariantNumeric: 'tabular-nums' }}>
          {duracao(destaque ? destaque.seconds : total)}
        </text>
        <text x="80" y="94" textAnchor="middle" fill="var(--texto-fraco)" fontSize="10.5"
          style={{ letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          {destaque ? categoria(destaque.name) : t.comum.ativo}
        </text>
      </svg>

      <div className="linhas" style={{ flex: 1, minWidth: 0 }}>
        {fatias.slice(0, 7).map((fatia, indice) => (
          <div key={fatia.name} className="linha"
            onMouseEnter={() => setSobre(indice)} onMouseLeave={() => setSobre(null)}>
            <span className="nome" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i style={{ width: 7, height: 7, borderRadius: 2, background: cor(fatia.name), flex: 'none' }} />
              {categoria(fatia.name)}
            </span>
            <span className="valor">{Math.round((fatia.seconds / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** A fita do dia: cada faixa é um pedaço contínuo no mesmo app. */
export function Fita({ blocos, dia, inicioDia = 4 }: { blocos: BlocoFita[]; dia: string; inicioDia?: number }) {
  const t = useIdioma().t
  const [sobre, setSobre] = useState<BlocoFita | null>(null)
  const [ano, mes, d] = dia.split('-').map(Number)
  const base = new Date(ano, mes - 1, d, inicioDia).getTime() / 1000
  const fim = base + 24 * 3600
  const largura = 1000
  const posicao = (ts: number) => ((Math.min(Math.max(ts, base), fim) - base) / (24 * 3600)) * largura

  const marcas = Array.from({ length: 13 }, (_, i) => inicioDia + i * 2)

  return (
    <div>
      <div style={{ height: 22, marginBottom: 6, fontSize: 12, color: 'var(--texto-medio)' }}>
        {sobre ? (
          <span className="aparece">
            <b style={{ color: sobre.delegado ? 'var(--ia)' : 'var(--texto)', fontWeight: 500 }}>
              {sobre.delegado ? t.comum.agente : sobre.app}
            </b>
            {!sobre.delegado && sobre.title ? ` · ${sobre.title.slice(0, 70)}` : ''}
            <span style={{ color: 'var(--texto-fraco)' }}> · {duracao(sobre.end - sobre.start)}</span>
          </span>
        ) : (
          <span style={{ color: 'var(--texto-fraco)' }}>{t.hoje.passeOMouse}</span>
        )}
      </div>

      {/* O SVG da fita é esticado sem manter proporção, então texto dentro dele
          sai deformado. As horas ficam em HTML, alinhadas por porcentagem. */}
      <svg viewBox={`0 0 ${largura} 40`} preserveAspectRatio="none" style={{ width: '100%', height: 40 }}>
        <rect x="0" y="0" width={largura} height="36" rx="7" fill="rgba(255,255,255,.035)" />
        {blocos.map((bloco, indice) => {
          const x = posicao(bloco.start)
          const w = Math.max(1.4, posicao(bloco.end) - x)
          // Tempo delegado é trabalho acontecendo, só que não pelas suas mãos:
          // ganha a cor da IA e altura própria, entre o ativo e o vazio.
          const cores = bloco.delegado ? 'var(--ia)' : bloco.idle ? 'var(--sem-rotulo)' : cor(bloco.category)
          const altura = bloco.delegado ? 22 : bloco.idle ? 16 : 30
          const topo = bloco.delegado ? 8 : bloco.idle ? 13 : 3
          return (
            <rect
              key={indice} x={x} y={topo} width={w} height={altura} rx={2}
              fill={cores}
              opacity={bloco.delegado ? 0.55 : bloco.idle ? 0.3 : sobre && sobre !== bloco ? 0.4 : 0.9}
              style={{ transition: 'opacity .18s' }}
              onMouseEnter={() => setSobre(bloco)} onMouseLeave={() => setSobre(null)}
            />
          )
        })}
        {marcas.map((hora) => {
          const x = ((hora - inicioDia) / 24) * largura
          return (
            <line key={hora} x1={x} y1="37" x2={x} y2="40"
              stroke="rgba(255,255,255,.14)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          )
        })}
      </svg>

      <div className="fita-horas">
        {marcas.map((hora) => (
          <span key={hora} style={{ left: `${((hora - inicioDia) / 24) * 100}%` }}>
            {String(hora % 24).padStart(2, '0')}{t.comum.h}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Medidor de foco. O número grande é a hora absoluta, e não a proporção:
 * proporção sozinha premia o dia curto — 1h de código puro daria 100%.
 */
export function Medidor({ valor, segundos }: { valor: number; segundos?: number }) {
  const t = useIdioma().t
  const porcento = Math.round(valor * 100)
  const horas = segundos != null ? duracao(segundos) : null
  const raio = 52
  const comprimento = Math.PI * raio
  return (
    <svg viewBox="0 0 130 74" style={{ width: '100%', maxWidth: 190 }}>
      <path d={`M13 66A${raio} ${raio} 0 0 1 117 66`} fill="none"
        stroke="rgba(255,255,255,.07)" strokeWidth="9" strokeLinecap="round" />
      <path d={`M13 66A${raio} ${raio} 0 0 1 117 66`} fill="none"
        stroke="var(--ouro)" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${(porcento / 100) * comprimento} ${comprimento}`}
        style={{ filter: 'drop-shadow(0 0 7px rgba(255,209,102,.5))', transition: 'stroke-dasharray .7s cubic-bezier(.22,1,.36,1)' }} />
      {horas ? (
        <>
          <text x="65" y="56" textAnchor="middle" fill="var(--ouro)" fontSize="27" fontWeight="300"
            style={{ fontVariantNumeric: 'tabular-nums' }}>{horas}</text>
          <text x="65" y="70" textAnchor="middle" fill="var(--texto-fraco)" fontSize="11"
            style={{ fontVariantNumeric: 'tabular-nums' }}>{porcento}% {t.comum.doAtivo}</text>
        </>
      ) : (
        <text x="65" y="60" textAnchor="middle" fill="var(--ouro)" fontSize="30" fontWeight="300"
          style={{ fontVariantNumeric: 'tabular-nums' }}>{porcento}<tspan fontSize="15">%</tspan></text>
      )}
    </svg>
  )
}

/**
 * Mapa hora × dia da semana. Quanto mais quente, mais tempo ali.
 *
 * Os rótulos ficam em HTML, fora do SVG. Texto dentro do SVG escala junto com
 * o desenho — num monitor largo a mesma fonte chegava ao dobro do tamanho do
 * resto da interface, e diminuir a fonte no SVG só empurra o problema, porque
 * o fator de escala muda com a largura da janela.
 */
export function Mapa({ grade }: { grade: number[][] }) {
  const t = useIdioma().t
  const DIAS_SEMANA = diasDaSemana()
  const [sobre, setSobre] = useState<{ dia: number; hora: number } | null>(null)
  const maior = Math.max(1, ...grade.flat())
  const celula = 30
  const folga = 5
  const largura = 24 * (celula + folga) - folga
  const altura = 7 * (celula + folga) - folga

  return (
    <div>
      <div style={{ height: 18, marginBottom: 10, fontSize: 12, color: 'var(--texto-medio)' }}>
        {sobre ? (
          <span className="aparece">
            {DIAS_SEMANA[sobre.dia]} {t.comum.as} {String(sobre.hora).padStart(2, '0')}{t.comum.h} ·{' '}
            <b style={{ fontWeight: 500 }}>{duracao(grade[sobre.dia][sobre.hora])}</b> {t.comum.noTotal}
          </span>
        ) : <span style={{ color: 'var(--texto-fraco)' }}>{t.ritmo.somaDoPeriodo}</span>}
      </div>

      <div className="mapa">
        <div className="mapa-dias">
          {DIAS_SEMANA.map((nome) => <span key={nome}>{nome}</span>)}
        </div>

        <div>
          <svg viewBox={`0 0 ${largura} ${altura}`} style={{ width: '100%', display: 'block' }}>
            {grade.map((linha, dia) =>
              linha.map((segundos, hora) => {
                const intensidade = segundos / maior
                return (
                  <rect
                    key={`${dia}-${hora}`}
                    x={hora * (celula + folga)} y={dia * (celula + folga)}
                    width={celula} height={celula} rx={6}
                    fill="var(--brasa)"
                    opacity={segundos ? 0.13 + intensidade * 0.87 : 0.045}
                    style={{
                      filter: intensidade > 0.62 ? 'drop-shadow(0 0 6px rgba(255,138,61,.5))' : undefined,
                      transition: 'opacity .15s',
                    }}
                    onMouseEnter={() => setSobre({ dia, hora })} onMouseLeave={() => setSobre(null)}
                  />
                )
              }),
            )}
          </svg>

          <div className="mapa-horas">
            {[0, 6, 12, 18, 23].map((hora) => (
              <span key={hora}
                style={{ left: `${((hora + 0.5) / 24) * 100}%` }}>{hora}{t.comum.h}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Tendência do tempo ativo por dia. */
export function Tendencia({ dias }: { dias: { day: string; active: number }[] }) {
  const t = useIdioma().t
  const [sobre, setSobre] = useState<number | null>(null)
  if (dias.length < 3) return <p className="vazio">{t.ritmo.precisaTresDias}</p>

  const largura = 1000
  const altura = 130
  const maior = Math.max(...dias.map((d) => d.active), 3600)
  const x = (i: number) => (i / (dias.length - 1)) * largura
  const y = (v: number) => altura - (v / maior) * (altura - 14) - 4

  const pontos = dias.map((d, i) => `${x(i)},${y(d.active)}`).join(' ')
  const media = dias.reduce((soma, d) => soma + d.active, 0) / dias.length

  return (
    <div>
      <div style={{ height: 18, marginBottom: 6, fontSize: 12, color: 'var(--texto-medio)' }}>
        {sobre != null ? (
          <span className="aparece">
            {dias[sobre].day} · <b style={{ fontWeight: 500 }}>{duracao(dias[sobre].active)}</b>
          </span>
        ) : (
          <span style={{ color: 'var(--texto-fraco)' }}>{t.comum.mediaDe} {duracao(media)} {t.comum.porDia}</span>
        )}
      </div>
      <svg viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none" style={{ width: '100%', height: altura }}>
        <defs>
          <linearGradient id="preenche" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brasa)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--brasa)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1={y(media)} x2={largura} y2={y(media)}
          stroke="rgba(255,255,255,.16)" strokeWidth="1" strokeDasharray="4 5" />
        <polygon points={`0,${altura} ${pontos} ${largura},${altura}`} fill="url(#preenche)" />
        <polyline points={pontos} fill="none" stroke="var(--brasa)" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 0 6px rgba(255,138,61,.45))' }} vectorEffect="non-scaling-stroke" />
        {dias.map((dia, i) => (
          <rect key={dia.day} x={x(i) - largura / dias.length / 2} y="0"
            width={largura / dias.length} height={altura} fill="transparent"
            onMouseEnter={() => setSobre(i)} onMouseLeave={() => setSobre(null)} />
        ))}
        {sobre != null && (
          <circle cx={x(sobre)} cy={y(dias[sobre].active)} r="3.5" fill="var(--ouro)"
            style={{ filter: 'drop-shadow(0 0 6px var(--ouro))' }} />
        )}
      </svg>
    </div>
  )
}

/** Lista com barra proporcional — apps, projetos, janelas. */
export function Barras({ itens, total, tom }: { itens: Fatia[]; total: number; tom?: string }) {
  const { t, categoria } = useIdioma()
  if (!itens.length) return <p className="vazio">{t.comum.nadaAqui}</p>
  const maior = Math.max(...itens.map((i) => i.seconds), 1)
  return (
    <div className="linhas">
      {itens.map((item) => (
        <div key={item.name} className="linha">
          <span className="nome">{nomeDaFatia(item.name, categoria, t.comum.outros)}</span>
          <span className="valor">{duracao(item.seconds)}</span>
          <span className="trilho">
            <i style={{
              width: `${(item.seconds / maior) * 100}%`,
              background: tom ?? cor(item.name),
              boxShadow: `0 0 9px ${tom ?? cor(item.name)}`,
              opacity: 0.85,
            }} />
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * A forma do foco: quantos minutos vieram de sessões de cada tamanho.
 * A barra conta MINUTOS, não sessões — contar sessões faz os pedaços curtos
 * dominarem a vista, e o que interessa é onde o tempo foi de fato.
 */
export function FormaDoFoco({ faixas, mediana, maior }: {
  faixas: { name: string; minutes: number; n: number }[]
  mediana: number
  maior: number
}) {
  const t = useIdioma().t
  const [sobre, setSobre] = useState<number | null>(null)
  const total = faixas.reduce((soma, f) => soma + f.minutes, 0)
  if (!total) {
    return <p className="vazio">{t.hoje.semSessao}</p>
  }

  const maiorFaixa = Math.max(...faixas.map((f) => f.minutes), 1)
  const largura = 520
  const altura = 132
  const passo = largura / faixas.length

  return (
    <div>
      <div style={{ height: 18, marginBottom: 8, fontSize: 12, color: 'var(--texto-medio)' }}>
        {sobre != null ? (
          <span className="aparece">
            {faixas[sobre].n} {faixas[sobre].n === 1 ? t.comum.sessao : t.comum.sessoes} {t.comum.de}{' '}
            {faixas[sobre].name} {t.comum.min} ·{' '}
            <b style={{ fontWeight: 500 }}>{duracao(faixas[sobre].minutes * 60)}</b> {t.comum.noTotal}
          </span>
        ) : (
          <span style={{ color: 'var(--texto-fraco)' }}>
            {t.hoje.medianaDe} {mediana}{t.comum.min} · {t.hoje.aMaiorFoi} {duracao(maior * 60)}
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${largura} ${altura}`} style={{ width: '100%', maxWidth: 620, height: altura }}>
        {faixas.map((faixa, indice) => {
          const h = (faixa.minutes / maiorFaixa) * (altura - 34)
          const x = indice * passo + passo * 0.16
          const w = passo * 0.68
          // O glow marca hierarquia, não enfeite: só a sessão longa acende.
          const longa = indice >= 3
          return (
            <g key={faixa.name}
              onMouseEnter={() => setSobre(indice)} onMouseLeave={() => setSobre(null)}>
              <rect x={x} y={0} width={w} height={altura - 20} fill="transparent" />
              <rect
                x={x} y={altura - 20 - h} width={w} height={Math.max(h, faixa.minutes ? 2 : 0)} rx={3}
                fill={longa ? 'var(--ouro)' : 'var(--brasa)'}
                opacity={sobre == null || sobre === indice ? 0.9 : 0.4}
                style={{
                  filter: longa && faixa.minutes ? 'drop-shadow(0 0 8px rgba(255,209,102,.5))' : undefined,
                  transition: 'opacity .16s',
                }}
              />
              {faixa.minutes > 0 && (
                <text x={x + w / 2} y={altura - 26 - h} textAnchor="middle"
                  fill="var(--texto-medio)" fontSize="11" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {numero(faixa.minutes)}
                </text>
              )}
              <text x={x + w / 2} y={altura - 4} textAnchor="middle" fill="var(--texto-fraco)" fontSize="11">
                {faixa.name}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
