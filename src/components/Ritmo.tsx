import { useEffect, useState } from 'react'
import { api, type Periodo } from '../lib/api.ts'
import { duracao, horas, somaDias, hoje as diaDeHoje, numero, principais, plural } from '../lib/format.ts'
import { useIdioma } from '../lib/idioma.tsx'
import { Mapa, Tendencia, Barras, Rosca } from './graficos.tsx'

export function Ritmo() {
  const t = useIdioma().t
  const JANELAS = [
    { dias: 7, nome: t.ritmo.dias7 },
    { dias: 30, nome: t.ritmo.dias30 },
    { dias: 90, nome: t.ritmo.dias90 },
  ]
  const [janela, setJanela] = useState(30)
  const [dados, setDados] = useState<Periodo | null>(null)

  useEffect(() => {
    let vivo = true
    const ate = diaDeHoje()
    api.periodo(somaDias(ate, -(janela - 1)), ate).then((d) => vivo && setDados(d))
    return () => { vivo = false }
  }, [janela])

  if (!dados) return <p className="vazio">{t.hoje.carregando}</p>

  const { resumo } = dados
  const medidos = dados.dias.filter((d) => d.active > 60)
  const media = medidos.length ? resumo.total / medidos.length : 0
  const total = horas(resumo.total)
  const maisLongo = [...medidos].sort((a, b) => b.active - a.active)[0]

  return (
    <>
      <div className="topo">
        <div>
          <h2><b>{t.ritmo.titulo}</b></h2>
          <p>{plural(medidos.length, t.contagem.dia)} {t.ritmo.entre} {dados.de} {t.ritmo.e} {dados.ate}</p>
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
          <p style={{ color: 'var(--texto-medio)' }}>{t.ritmo.semDias}</p>
          <p className="nota">{t.ritmo.ritmoAparece}</p>
        </div>
      ) : (
        <div className="grade" style={{ gap: 14 }}>
          <div className="grade g4">
            <div className="painel">
              <div className="rotulo">{t.ritmo.tempoTotal}</div>
              <div className="numero brilha">{total.valor}<small>{total.unidade}</small></div>
              <div className="nota">{t.comum.mediaDe} {duracao(media)} {t.ritmo.mediaPorDia}</div>
            </div>
            <div className="painel">
              <div className="rotulo">{t.ritmo.focoMedio}</div>
              <div className="numero brasa">{Math.round(resumo.focusRatio * 100)}<small>%</small></div>
              <div className="nota">{t.ritmo.focoMedioNota}</div>
            </div>
            <div className="painel">
              <div className="rotulo">{t.ritmo.diaMaisLongo}</div>
              <div className="numero" style={{ fontSize: 30 }}>{duracao(maisLongo?.active ?? 0)}</div>
              <div className="nota">{maisLongo?.day}</div>
            </div>
            <div className="painel">
              <div className="rotulo">{t.ritmo.producao}</div>
              <div className="numero" style={{ fontSize: 30 }}>{numero(resumo.commits)}<small> {t.ritmo.commits}</small></div>
              <div className="nota">
                {resumo.agentes.length
                  ? resumo.agentes.map((a) => `${duracao(a.minutos * 60)} ${t.comum.de} ${a.name}`).join(' · ')
                  : plural(resumo.aiTurns, t.contagem.pedidoIA)}
              </div>
            </div>
          </div>

          <div className="painel">
            <h3>{t.ritmo.quandoTrabalha} <em>{t.ritmo.horaPorDia}</em></h3>
            <Mapa grade={dados.ritmo} />
          </div>

          {medidos.length >= 3 && (
            <div className="painel">
              <h3>{t.ritmo.tendencia} <em>{t.ritmo.tempoAtivoPorDia}</em></h3>
              <Tendencia dias={dados.dias} />
            </div>
          )}

          <div className="grade g32">
            <div className="painel">
              <h3>{t.ritmo.ondeOTempoFoi}</h3>
              <Barras itens={principais(resumo.apps)} total={resumo.total} tom="var(--brasa)" />
            </div>
            <div className="painel">
              <h3>{t.ritmo.porCategoria}</h3>
              <Rosca fatias={resumo.categories} total={resumo.total} />
            </div>
          </div>

          <div className="grade g2">
            <div className="painel">
              <h3>{t.ritmo.projetos}</h3>
              {resumo.projects.length
                ? <Barras itens={resumo.projects} total={resumo.total} tom="var(--agua)" />
                : <p className="vazio">{t.ritmo.semProjeto}</p>}
            </div>

            <div className="painel">
              <h3>{t.ritmo.assinatura}</h3>
              {resumo.shortcuts.length ? (
                <div className="legenda" style={{ marginTop: 0 }}>
                  {resumo.shortcuts.map((atalho) => (
                    <span key={atalho.name} className="pilula" style={{ fontSize: 12.5, padding: '5px 11px' }}>
                      <b style={{ fontWeight: 500 }}>{atalho.name}</b>
                      <span style={{ color: 'var(--texto-fraco)' }}>×{atalho.n}</span>
                    </span>
                  ))}
                </div>
              ) : <p className="vazio">{t.ritmo.semAtalhos}</p>}

              <h3 style={{ marginTop: 22 }}>{t.ritmo.sites}</h3>
              <div className="linhas">
                {resumo.hosts.slice(0, 7).map((host) => (
                  <div key={host.name} className="linha">
                    <span className="nome">{host.name}</span>
                    <span className="valor">{numero(host.n)}</span>
                  </div>
                ))}
              </div>

              {resumo.typing.chars > 0 && (
                <div className="nota" style={{ marginTop: 16 }}>
                  {numero(resumo.typing.chars)} {t.ritmo.caracteres}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
