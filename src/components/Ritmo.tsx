import { useEffect, useState } from 'react'
import { api, type Periodo } from '../lib/api.ts'
import { duracao, horas, somaDias, hoje as diaDeHoje, principais, plural } from '../lib/format.ts'
import { Mapa, Tendencia, Barras, Rosca } from './graficos.tsx'

const JANELAS = [
  { dias: 7, nome: '7 dias' },
  { dias: 30, nome: '30 dias' },
  { dias: 90, nome: '90 dias' },
]

export function Ritmo() {
  const [janela, setJanela] = useState(30)
  const [dados, setDados] = useState<Periodo | null>(null)

  useEffect(() => {
    let vivo = true
    const ate = diaDeHoje()
    api.periodo(somaDias(ate, -(janela - 1)), ate).then((d) => vivo && setDados(d))
    return () => { vivo = false }
  }, [janela])

  if (!dados) return <p className="vazio">Carregando…</p>

  const { resumo } = dados
  const medidos = dados.dias.filter((d) => d.active > 60)
  const media = medidos.length ? resumo.total / medidos.length : 0
  const total = horas(resumo.total)
  const maisLongo = [...medidos].sort((a, b) => b.active - a.active)[0]

  return (
    <>
      <div className="topo">
        <div>
          <h2><b>Ritmo</b></h2>
          <p>{plural(medidos.length, 'dia medido', 'dias medidos')} entre {dados.de} e {dados.ate}</p>
        </div>
        <div className="navega">
          {JANELAS.map((opcao) => (
            <button key={opcao.dias} onClick={() => setJanela(opcao.dias)}
              className={janela === opcao.dias ? 'ativo' : ''}>{opcao.nome}</button>
          ))}
        </div>
      </div>

      {!medidos.length ? (
        <div className="painel" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--texto-medio)' }}>Ainda não há dias medidos o bastante.</p>
          <p className="nota">O ritmo aparece quando houver pelo menos dois dias com atividade.</p>
        </div>
      ) : (
        <div className="grade" style={{ gap: 14 }}>
          <div className="grade g4">
            <div className="painel">
              <div className="rotulo">tempo total</div>
              <div className="numero brilha">{total.valor}<small>{total.unidade}</small></div>
              <div className="nota">média de {duracao(media)} por dia medido</div>
            </div>
            <div className="painel">
              <div className="rotulo">foco médio</div>
              <div className="numero brasa">{Math.round(resumo.focusRatio * 100)}<small>%</small></div>
              <div className="nota">ponderado pelo tempo de cada janela</div>
            </div>
            <div className="painel">
              <div className="rotulo">dia mais longo</div>
              <div className="numero" style={{ fontSize: 30 }}>{duracao(maisLongo?.active ?? 0)}</div>
              <div className="nota">{maisLongo?.day}</div>
            </div>
            <div className="painel">
              <div className="rotulo">produção</div>
              <div className="numero" style={{ fontSize: 30 }}>{resumo.commits}<small> commits</small></div>
              <div className="nota">{resumo.aiTurns} pedidos ao Claude Code</div>
            </div>
          </div>

          <div className="painel">
            <h3>quando você trabalha <em>hora × dia da semana</em></h3>
            <Mapa grade={dados.ritmo} />
          </div>

          {medidos.length >= 3 && (
            <div className="painel">
              <h3>tendência <em>tempo ativo por dia</em></h3>
              <Tendencia dias={dados.dias} />
            </div>
          )}

          <div className="grade g32">
            <div className="painel">
              <h3>onde o tempo foi no período</h3>
              <Barras itens={principais(resumo.apps)} total={resumo.total} tom="var(--brasa)" />
            </div>
            <div className="painel">
              <h3>por categoria</h3>
              <Rosca fatias={resumo.categories} total={resumo.total} />
            </div>
          </div>

          <div className="grade g2">
            <div className="painel">
              <h3>projetos</h3>
              {resumo.projects.length
                ? <Barras itens={resumo.projects} total={resumo.total} tom="var(--agua)" />
                : <p className="vazio">Sem projeto atribuído ainda.</p>}
            </div>

            <div className="painel">
              <h3>sua assinatura de teclado</h3>
              {resumo.shortcuts.length ? (
                <div className="legenda" style={{ marginTop: 0 }}>
                  {resumo.shortcuts.map((atalho) => (
                    <span key={atalho.name} className="pilula" style={{ fontSize: 12.5, padding: '5px 11px' }}>
                      <b style={{ fontWeight: 500 }}>{atalho.name}</b>
                      <span style={{ color: 'var(--texto-fraco)' }}>×{atalho.n}</span>
                    </span>
                  ))}
                </div>
              ) : <p className="vazio">Sem atalhos capturados no período.</p>}

              <h3 style={{ marginTop: 22 }}>sites</h3>
              <div className="linhas">
                {resumo.hosts.slice(0, 7).map((host) => (
                  <div key={host.name} className="linha">
                    <span className="nome">{host.name}</span>
                    <span className="valor">{host.n}</span>
                  </div>
                ))}
              </div>

              {resumo.typing.chars > 0 && (
                <div className="nota" style={{ marginTop: 16 }}>
                  {resumo.typing.chars.toLocaleString('pt-BR')} caracteres digitados no período
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
