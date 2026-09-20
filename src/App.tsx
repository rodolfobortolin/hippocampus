import { useEffect, useState } from 'react'
import { api, type Status } from './lib/api.ts'
import { useIdioma } from './lib/idioma.tsx'
import { Hoje } from './components/Hoje.tsx'
import { Ritmo } from './components/Ritmo.tsx'
import { Diario } from './components/Diario.tsx'
import { Conversa } from './components/Conversa.tsx'
import { Ajustes } from './components/Ajustes.tsx'
import {
  Emblema, IconeHoje, IconeRitmo, IconeDiario, IconeConversa, IconeAjustes,
} from './components/Icons.tsx'

type Aba = 'hoje' | 'ritmo' | 'diario' | 'conversa' | 'ajustes'

export function App() {
  const t = useIdioma().t
  const [aba, setAba] = useState<Aba>('hoje')
  const [status, setStatus] = useState<Status | null>(null)
  const [semNucleo, setSemNucleo] = useState(false)

  useEffect(() => {
    const busca = () => api.status().then((s) => { setStatus(s); setSemNucleo(false) }).catch(() => setSemNucleo(true))
    busca()
    const timer = setInterval(busca, 15_000)
    return () => clearInterval(timer)
  }, [])

  const abas: { id: Aba; nome: string; Icone: () => React.ReactElement }[] = [
    { id: 'hoje', nome: t.abas.hoje, Icone: IconeHoje },
    { id: 'ritmo', nome: t.abas.ritmo, Icone: IconeRitmo },
    { id: 'diario', nome: t.abas.diario, Icone: IconeDiario },
    { id: 'conversa', nome: t.abas.conversa, Icone: IconeConversa },
    { id: 'ajustes', nome: t.abas.ajustes, Icone: IconeAjustes },
  ]

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
            <span>{t.estado.marca}</span>
          </div>
        </div>

        <nav>
          {abas.map(({ id, nome, Icone }) => (
            <button key={id} className="aba" aria-current={aba === id} onClick={() => setAba(id)}>
              <Icone />
              {nome}
            </button>
          ))}
        </nav>

        <div className="rail-pe">
          <div className="sinal">
            <i className={`ponto ${medindo ? (ocioso ? 'morno' : 'vivo') : ''}`} />
            {semNucleo ? t.estado.nucleoDesligado
              : medindo ? (ocioso ? t.estado.ocioso : t.estado.medindo)
              : t.estado.parado}
          </div>
          {amostra?.app && !ocioso && (
            // Não é um serviço — é o que está em foco agora. Sem o rótulo, uma
            // linha sem bolinha no meio das bolinhas de status lê como algo
            // desligado, que foi exatamente o que aconteceu.
            <div className="em-foco" title={amostra.title ?? amostra.app}>
              <span>{t.estado.emFoco}</span>
              <b>{amostra.app === 'Electron' ? 'Hipocampo' : amostra.app}</b>
              {amostra.title && amostra.title !== amostra.app && <i>{amostra.title}</i>}
            </div>
          )}
          {status && (
            <>
              <div className="sinal" title={t.estado.classificacao}>
                <i className={`ponto ${status.jev ? 'vivo' : ''}`} />jev
              </div>
              <div className="sinal" title={t.estado.narrativa}>
                <i className={`ponto ${status.claude ? 'vivo' : ''}`} />claude code
              </div>
              <div className="sinal" title={t.hoje.janelas}>
                <i className={`ponto ${status.coletor.trusted ? 'vivo' : 'morno'}`} />{t.estado.acessibilidade}
              </div>
              {Object.entries(status.coletor.fontes ?? {})
                .filter(([, estado]) => estado !== 'ok' && estado !== 'nunca')
                .map(([fonte, estado]) => {
                  // Código conhecido vira frase na língua da pessoa; o que não
                  // é conhecido veio do sistema e vai cru, porque inventar uma
                  // tradução para um erro do macOS só esconde o erro.
                  const motivo = (t.estado.fonte as Record<string, string>)[estado] ?? estado
                  return (
                    <div key={fonte} className="sinal" title={motivo} style={{ color: 'var(--comunicacao)' }}>
                      <i className="ponto morno" />{fonte}: {motivo}
                    </div>
                  )
                })}
            </>
          )}
        </div>
      </aside>

      <main className="tela">
        {semNucleo && aba !== 'ajustes' ? (
          <div className="painel" style={{ marginTop: 60, padding: '44px 24px', textAlign: 'center' }}>
            <p style={{ color: 'var(--texto-medio)' }}>{t.estado.semNucleo}</p>
            <p className="nota">{t.estado.subaComNucleo} <code>npm run dev:core</code>.</p>
          </div>
        ) : aba === 'hoje' ? <Hoje status={status} />
          : aba === 'ritmo' ? <Ritmo />
          : aba === 'diario' ? <Diario status={status} />
          : aba === 'ajustes' ? <Ajustes />
          : <Conversa status={status} />}
      </main>
    </div>
  )
}
