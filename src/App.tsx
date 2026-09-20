import { useEffect, useState } from 'react'
import { api, type Status } from './lib/api.ts'
import { Hoje } from './components/Hoje.tsx'
import { Ritmo } from './components/Ritmo.tsx'
import { Diario } from './components/Diario.tsx'
import { Conversa } from './components/Conversa.tsx'
import { Emblema, IconeHoje, IconeRitmo, IconeDiario, IconeConversa } from './components/Icons.tsx'

const ABAS = [
  { id: 'hoje', nome: 'Hoje', Icone: IconeHoje },
  { id: 'ritmo', nome: 'Ritmo', Icone: IconeRitmo },
  { id: 'diario', nome: 'Diário', Icone: IconeDiario },
  { id: 'conversa', nome: 'Conversa', Icone: IconeConversa },
] as const

export function App() {
  const [aba, setAba] = useState<(typeof ABAS)[number]['id']>('hoje')
  const [status, setStatus] = useState<Status | null>(null)
  const [semNucleo, setSemNucleo] = useState(false)

  useEffect(() => {
    const busca = () => api.status().then((s) => { setStatus(s); setSemNucleo(false) }).catch(() => setSemNucleo(true))
    busca()
    const timer = setInterval(busca, 15_000)
    return () => clearInterval(timer)
  }, [])

  const amostra = status?.coletor.lastSample
  const medindo = status?.coletor.running && !!amostra
  const ocioso = amostra ? amostra.idle > 120 || amostra.locked : false

  return (
    <div className="app">
      {/* Faixa de arrasto no topo inteiro da janela. Sem ela só a barra lateral
          pegava, e mover a janela virava caça ao pixel certo. Fica acima de
          tudo e nada interativo mora embaixo dela. */}
      <div className="arrasto" />

      <aside className="rail">
        <div className="marca">
          <Emblema />
          <div>
            <h1>Hipocampo</h1>
            <span>memória da máquina</span>
          </div>
        </div>

        <nav>
          {ABAS.map(({ id, nome, Icone }) => (
            <button key={id} className="aba" aria-current={aba === id} onClick={() => setAba(id)}>
              <Icone />
              {nome}
            </button>
          ))}
        </nav>

        <div className="rail-pe">
          <div className="sinal">
            <i className={`ponto ${medindo ? (ocioso ? 'morno' : 'vivo') : ''}`} />
            {semNucleo ? 'núcleo desligado' : medindo ? (ocioso ? 'ocioso' : 'medindo') : 'parado'}
          </div>
          {amostra?.app && !ocioso && (
            // Não é um serviço — é o que está em foco agora. Sem o rótulo, uma
            // linha sem bolinha no meio das bolinhas de status lê como algo
            // desligado, que foi exatamente o que aconteceu.
            <div className="em-foco" title={amostra.title ?? amostra.app}>
              <span>em foco</span>
              <b>{amostra.app === 'Electron' ? 'Hipocampo' : amostra.app}</b>
              {amostra.title && amostra.title !== amostra.app && (
                <i>{amostra.title}</i>
              )}
            </div>
          )}
          {status && (
            <>
              <div className="sinal" title="classificação das janelas">
                <i className={`ponto ${status.jev ? 'vivo' : ''}`} />jev
              </div>
              <div className="sinal" title="narrativa e conversa">
                <i className={`ponto ${status.claude ? 'vivo' : ''}`} />claude code
              </div>
              <div className="sinal" title="títulos de janela">
                <i className={`ponto ${status.coletor.trusted ? 'vivo' : 'morno'}`} />acessibilidade
              </div>
              {Object.entries(status.coletor.fontes ?? {})
                .filter(([, estado]) => estado !== 'ok' && estado !== 'ainda não tentou')
                .map(([fonte, estado]) => (
                  <div key={fonte} className="sinal" title={estado} style={{ color: 'var(--comunicacao)' }}>
                    <i className="ponto morno" />{fonte}: {estado}
                  </div>
                ))}
            </>
          )}
        </div>
      </aside>

      <main className="tela">
        {semNucleo ? (
          <div className="painel" style={{ marginTop: 60, padding: '44px 24px', textAlign: 'center' }}>
            <p style={{ color: 'var(--texto-medio)' }}>O núcleo não está respondendo.</p>
            <p className="nota">Suba com <code>npm run dev:core</code> ou instale o agente com <code>npm run install:agent</code>.</p>
          </div>
        ) : aba === 'hoje' ? <Hoje status={status} />
          : aba === 'ritmo' ? <Ritmo />
          : aba === 'diario' ? <Diario status={status} />
          : <Conversa status={status} />}
      </main>
    </div>
  )
}
