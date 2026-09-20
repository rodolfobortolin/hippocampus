import { useEffect, useState } from 'react'
import { api, type Dia, type Status } from '../lib/api.ts'
import { duracao, horas, relogio, dataLonga, somaDias, hoje as diaDeHoje, cor, numero, principais, plural } from '../lib/format.ts'
import { useIdioma } from '../lib/idioma.tsx'
import { Rosca, Fita, Medidor, Barras, FormaDoFoco } from './graficos.tsx'
import { IconeAlerta } from './Icons.tsx'

function Cartao({ rotulo, children, nota }: { rotulo: string; children: React.ReactNode; nota?: string }) {
  return (
    <div className="painel">
      <div className="rotulo">{rotulo}</div>
      {children}
      {nota && <div className="nota">{nota}</div>}
    </div>
  )
}

export function Hoje({ status }: { status: Status | null }) {
  const { t, categoria } = useIdioma()
  const [dia, setDia] = useState(diaDeHoje())
  const [dados, setDados] = useState<Dia | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let vivo = true
    const carrega = () => api.dia(dia).then((d) => vivo && setDados(d)).catch((e) => vivo && setErro(e.message))
    carrega()
    // Enquanto é hoje, a tela acompanha o que está sendo medido agora.
    const timer = dia === diaDeHoje() ? setInterval(carrega, 20_000) : null
    return () => { vivo = false; if (timer) clearInterval(timer) }
  }, [dia])

  if (erro) return <p className="vazio">{t.estado.semNucleo} {erro}</p>
  if (!dados) return <p className="vazio">{t.hoje.carregando}</p>

  const ehHoje = dia === diaDeHoje()
  const ativo = horas(dados.activeSeconds)
  const semDado = dados.activeSeconds < 60
  const categoriaTopo = dados.categories[0]

  return (
    <>
      <div className="topo">
        <div>
          <h2>{ehHoje ? <b>{t.hoje.hoje}</b> : <b>{dataLonga(dia)}</b>}</h2>
          <p>
            {ehHoje && <>{dataLonga(dia)} · </>}
            {dados.firstAt
              ? `${t.hoje.das} ${relogio(dados.firstAt)} ${t.hoje.as} ${relogio(dados.lastAt)}`
              : dados.idleSeconds > 60
                ? `${duracao(dados.idleSeconds)} ${t.hoje.maquinaParada}`
                : t.hoje.nadaMedido}
          </p>
        </div>
        <div className="navega">
          <button onClick={() => setDia(somaDias(dia, -1))}>{t.hoje.diaAnterior}</button>
          <button onClick={() => setDia(diaDeHoje())} disabled={ehHoje} className={ehHoje ? 'ativo' : ''}>
            {t.hoje.hojeBotao}
          </button>
          <button onClick={() => setDia(somaDias(dia, 1))} disabled={ehHoje}>{t.hoje.diaSeguinte}</button>
        </div>
      </div>

      {status && !status.coletor.trusted && (
        <div className="aviso">
          <IconeAlerta />
          <div>
            <p><strong>{t.hoje.faltaAcessibilidade}</strong> {t.hoje.faltaAcessibilidadeTexto}</p>
            <p style={{ marginTop: 8, fontSize: 12.5, color: 'var(--texto-fraco)' }}>
              {t.hoje.atalhoPermissao} <code>npm run permissao</code>
            </p>
          </div>
        </div>
      )}

      {semDado ? (
        <div className="painel" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--texto-medio)' }}>
            {dados.idleSeconds > 60
              ? `${t.hoje.medindoSemAtividade} ${duracao(dados.idleSeconds)} ${t.hoje.maquinaParada}.`
              : `${t.hoje.nadaMedido}.`}
          </p>
          <p className="nota">
            {dados.idleSeconds > 60
              ? t.hoje.voltaAoTeclado
              : ehHoje ? t.hoje.coletorGrava : t.hoje.soEnxerga}
          </p>
        </div>
      ) : (
        <div className="grade" style={{ gap: 14 }}>
          <div className="grade g5">
            <Cartao rotulo={t.hoje.seuTempo}
              nota={dados.awaySeconds > 60 ? `${duracao(dados.awaySeconds)} ${t.hoje.longeDaMaquina}` : undefined}>
              <div className="numero brilha">{ativo.valor}<small>{ativo.unidade}</small></div>
            </Cartao>

            <Cartao rotulo={t.hoje.delegado}
              nota={dados.delegatedSeconds > 60 ? t.hoje.delegadoNota : t.hoje.semDelegado}>
              <div className="numero" style={{ color: 'var(--ai)', textShadow: '0 0 26px rgba(167,139,250,.35)' }}>
                {horas(dados.delegatedSeconds).valor}
                <small>{horas(dados.delegatedSeconds).unidade}</small>
              </div>
            </Cartao>

            <div className="painel">
              <div className="rotulo">{t.hoje.concentrado}</div>
              <Medidor valor={dados.focusRatio} segundos={dados.focusSeconds} />
              <div className="nota">{t.hoje.concentradoNota}</div>
            </div>

            <Cartao rotulo={t.hoje.trocas} nota={t.hoje.trocasNota(dados.switchesProjeto)}>
              <div className="numero">{numero(dados.switches)}</div>
            </Cartao>

            <Cartao rotulo={t.hoje.dominou}
              nota={categoriaTopo
                ? `${duracao(dados.apps[0]?.seconds ?? 0)} · ${t.hoje.maiorFatia} ${categoria(categoriaTopo.name)}, ${duracao(categoriaTopo.seconds)}`
                : undefined}>
              <div className="numero" style={{ fontSize: 26, letterSpacing: '-0.6px', paddingTop: 8 }}>
                {dados.apps[0]?.name ?? '—'}
              </div>
            </Cartao>
          </div>

          <div className="painel">
            <h3>
              {t.hoje.fita}
              <em>
                {plural(dados.timeline.length, t.contagem.trecho)}
                {dados.timelineOcultos > 0 && ` · ${numero(dados.timelineOcultos)} ${t.hoje.curtosDemais}`}
              </em>
            </h3>
            <Fita blocos={dados.timeline} dia={dia} />
            <div className="legenda">
              {dados.categories.slice(0, 8).map((c) => (
                <span key={c.name} className="pilula">
                  <i style={{ background: cor(c.name) }} />{categoria(c.name)}
                </span>
              ))}
            </div>
          </div>

          <div className="grade g32">
            <div className="painel">
              <h3>{t.hoje.formaDoFoco}<em>{plural(dados.forma.sessoes, t.contagem.sessao)}</em></h3>
              <FormaDoFoco faixas={dados.forma.faixas} mediana={dados.forma.mediana} maior={dados.forma.maior} />
              <div className="nota">{t.hoje.formaNota}</div>
            </div>
            <div className="painel">
              <h3>{t.hoje.porCategoria}</h3>
              <Rosca fatias={dados.categories} total={dados.activeSeconds} />
            </div>
          </div>

          <div className="grade g32">
            <div className="painel">
              <h3>{t.hoje.ondeOTempoFoi}</h3>
              <Barras itens={principais(dados.apps)} total={dados.activeSeconds} tom="var(--brasa)" />
            </div>
            <div className="painel">
              <h3>{t.hoje.projetos} <em>{plural(dados.projects.length, t.contagem.projeto)}</em></h3>
              {dados.projects.length
                ? <Barras itens={dados.projects} total={dados.activeSeconds} tom="var(--agua)" />
                : <p className="vazio">{t.hoje.semProjeto}</p>}
            </div>
          </div>

          <div className="grade g2">
            <div className="painel">
              <h3>{t.hoje.janelas}</h3>
              <div className="linhas">
                {dados.windows.slice(0, 8).map((janela, i) => (
                  <div key={i} className="linha">
                    <span className="nome" title={janela.title}>
                      <span style={{ color: 'var(--texto-fraco)' }}>{janela.app}</span> · {janela.title}
                    </span>
                    <span className="valor">{duracao(janela.seconds)}</span>
                  </div>
                ))}
                {!dados.windows.length && <p className="vazio">{t.hoje.semTitulos}</p>}
              </div>
            </div>
          </div>

          <div className="painel">
            <h3>
              {t.hoje.maos}
              <em>
                {numero(dados.entrada.teclas)} {t.hoje.teclas} ·{' '}
                {numero(dados.entrada.cliques)} {t.hoje.cliques} ·{' '}
                {numero(dados.entrada.rolagem)} {t.hoje.rolagem}
              </em>
            </h3>
            <div className="linhas">
              {dados.entradaPorApp.map((linha) => {
                const total = linha.teclas + linha.cliques + linha.rolagem
                const escrevendo = total ? linha.teclas / total : 0
                return (
                  <div key={linha.app} className="linha">
                    <span className="nome">{linha.app}</span>
                    <span className="valor">
                      {escrevendo > 0.4 ? t.hoje.escrevendo : escrevendo > 0.12 ? t.hoje.misto : t.hoje.lendo}
                    </span>
                    <span className="trilho"
                      title={`${numero(linha.teclas)} ${t.hoje.teclas}, ${numero(linha.cliques)} ${t.hoje.cliques}, ${numero(linha.rolagem)} ${t.hoje.rolagem}`}>
                      <i style={{
                        width: `${Math.round(escrevendo * 100)}%`,
                        background: 'var(--ouro)', boxShadow: '0 0 9px var(--ouro)', opacity: 0.85,
                      }} />
                    </span>
                  </div>
                )
              })}
              {!dados.entradaPorApp.length && <p className="vazio">{t.hoje.semTeclado}</p>}
            </div>
            <div className="nota">{t.hoje.maosNota}</div>
          </div>

          <div className="grade g2">
            <div className="painel">
              <h3>
                {t.hoje.saiuDasMaos}
                <em>{plural(dados.commits.length, t.contagem.commit)} · {plural(dados.aiTurns.length, t.contagem.pedidoIA)}</em>
              </h3>
              <div className="linhas" style={{ maxHeight: 250, overflowY: 'auto' }}>
                {dados.commits.map((commit, i) => (
                  <div key={i} className="linha" style={{ gridTemplateColumns: '1fr auto' }}>
                    <span className="nome">
                      <span style={{ color: 'var(--code)' }}>{commit.repo}</span> · {commit.subject}
                    </span>
                    <span className="valor">+{commit.insertions}/−{commit.deletions}</span>
                  </div>
                ))}
                {dados.aiTurns.slice(-12).map((turno, i) => (
                  <div key={`ia-${i}`} className="linha" style={{ gridTemplateColumns: '1fr auto' }}>
                    <span className="nome" title={turno.prompt}>
                      <span style={{ color: 'var(--ai)' }}>{turno.project}</span> · {turno.prompt}
                    </span>
                    <span className="valor">{relogio(turno.ts)}</span>
                  </div>
                ))}
                {!dados.commits.length && !dados.aiTurns.length && <p className="vazio">{t.hoje.nadaRegistrado}</p>}
              </div>
            </div>

            <div className="painel">
              <h3>
                {t.hoje.sinais}
                <em>
                  {plural(dados.visits, t.contagem.visita)}
                  {dados.hosts.length > 0 && ` · ${plural(dados.hosts.length, t.contagem.site)}`}
                </em>
              </h3>
              <div className="linhas">
                {dados.hosts.slice(0, 6).map((host) => (
                  <div key={host.name} className="linha">
                    <span className="nome">{host.name}</span>
                    <span className="valor">{numero(host.n)}</span>
                  </div>
                ))}
              </div>
              {dados.shortcuts.length > 0 && (
                <>
                  <h3 style={{ marginTop: 20 }}>{t.hoje.atalhos}</h3>
                  <div className="legenda" style={{ marginTop: 0 }}>
                    {dados.shortcuts.slice(0, 8).map((atalho) => (
                      <span key={atalho.name} className="pilula">
                        {atalho.name} <span style={{ color: 'var(--texto-fraco)' }}>×{atalho.n}</span>
                      </span>
                    ))}
                  </div>
                </>
              )}
              {dados.typing.chars > 0 && (
                <div className="nota" style={{ marginTop: 16 }}>
                  {numero(dados.typing.chars)} {t.hoje.caracteresDigitados} {numero(dados.typing.samples)}
                </div>
              )}

              {(dados.trilha.segundos > 60 || dados.trilha.emChamada > 60) && (
                <>
                  <h3 style={{ marginTop: 22 }}>{t.hoje.som}</h3>
                  <div className="linhas">
                    {dados.trilha.segundos > 60 && (
                      <div className="linha">
                        <span className="nome">{t.hoje.algoTocando}</span>
                        <span className="valor">{duracao(dados.trilha.segundos)}</span>
                      </div>
                    )}
                    {dados.trilha.emChamada > 60 && (
                      <div className="linha">
                        <span className="nome">{t.hoje.chamada}</span>
                        <span className="valor">{duracao(dados.trilha.emChamada)}</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {dados.telas.length > 1 && (
                <>
                  <h3 style={{ marginTop: 22 }}>{t.hoje.telas}</h3>
                  <div className="linhas">
                    {dados.telas.map((tela) => (
                      <div key={tela.name} className="linha">
                        <span className="nome">{tela.name}</span>
                        <span className="valor">{duracao(tela.seconds)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
