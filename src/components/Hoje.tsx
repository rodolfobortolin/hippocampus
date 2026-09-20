import { useEffect, useState } from 'react'
import { api, type Dia, type Status } from '../lib/api.ts'
import { duracao, horas, relogio, dataLonga, somaDias, hoje as diaDeHoje, cor, NOMES, principais, plural } from '../lib/format.ts'
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

  if (erro) return <p className="vazio">Não consegui falar com o núcleo: {erro}</p>
  if (!dados) return <p className="vazio">Carregando…</p>

  const ehHoje = dia === diaDeHoje()
  const ativo = horas(dados.activeSeconds)
  const semDado = dados.activeSeconds < 60
  const categoriaTopo = dados.categories[0]

  return (
    <>
      <div className="topo">
        <div>
          <h2>{ehHoje ? <><b>Hoje</b></> : <b>{dataLonga(dia)}</b>}</h2>
          <p>
            {ehHoje && <>{dataLonga(dia)} · </>}
            {dados.firstAt
              ? `das ${relogio(dados.firstAt)} às ${relogio(dados.lastAt)}`
              : dados.idleSeconds > 60
                ? `${duracao(dados.idleSeconds)} de máquina parada`
                : 'nada medido ainda'}
          </p>
        </div>
        <div className="navega">
          <button onClick={() => setDia(somaDias(dia, -1))}>← dia anterior</button>
          <button onClick={() => setDia(diaDeHoje())} disabled={ehHoje} className={ehHoje ? 'ativo' : ''}>hoje</button>
          <button onClick={() => setDia(somaDias(dia, 1))} disabled={ehHoje}>dia seguinte →</button>
        </div>
      </div>

      {status && !status.coletor.trusted && (
        <div className="aviso">
          <IconeAlerta />
          <div>
            <p>
              <strong>Falta a permissão de Acessibilidade.</strong> Sem ela eu vejo qual aplicativo
              está na frente, mas não o título da janela — então não dá para saber <em>em que</em> você
              estava trabalhando, só <em>onde</em>. Conceda em Ajustes → Privacidade e Segurança →
              Acessibilidade.
            </p>
            <p style={{ marginTop: 8, fontSize: 12.5, color: 'var(--texto-fraco)' }}>
              O atalho é <code>sh scripts/permissao.sh</code> na pasta do projeto — ele abre
              o pedido e o painel certo dos Ajustes.
            </p>
          </div>
        </div>
      )}

      {semDado ? (
        <div className="painel" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--texto-medio)' }}>
            {dados.idleSeconds > 60
              ? `Medindo, mas sem atividade: ${duracao(dados.idleSeconds)} de máquina parada.`
              : `Nada medido ${ehHoje ? 'ainda hoje' : 'neste dia'}.`}
          </p>
          <p className="nota">
            {dados.idleSeconds > 60
              ? 'Assim que você voltar ao teclado, esta tela se enche sozinha.'
              : ehHoje
                ? 'O coletor grava a partir do momento em que sobe — o histórico anterior não existe.'
                : 'O Hipocampo só enxerga a partir do dia em que começou a medir.'}
          </p>
        </div>
      ) : (
        <div className="grade" style={{ gap: 14 }}>
          <div className="grade g5">
            <Cartao rotulo="seu tempo"
              nota={dados.awaySeconds > 60 ? `${duracao(dados.awaySeconds)} longe da máquina` : undefined}>
              <div className="numero brilha">{ativo.valor}<small>{ativo.unidade}</small></div>
            </Cartao>

            <Cartao rotulo="trabalho delegado"
              nota={dados.delegatedSeconds > 60
                ? `agentes produzindo enquanto você fazia outra coisa`
                : 'nenhum agente trabalhou fora do seu tempo'}>
              <div className="numero" style={{ color: 'var(--ia)', textShadow: '0 0 26px rgba(167,139,250,.35)' }}>
                {horas(dados.delegatedSeconds).valor}
                <small>{horas(dados.delegatedSeconds).unidade}</small>
              </div>
            </Cartao>

            <div className="painel">
              <div className="rotulo">trabalho concentrado</div>
              <Medidor valor={dados.focusRatio} segundos={dados.focusSeconds} />
              <div className="nota">tempo em código, IA, escrita, design e pesquisa</div>
            </div>

            <Cartao rotulo="trocas de aplicativo"
              nota={`${dados.switchesProjeto} mudaram de projeto — só essas custam caro`}>
              <div className="numero">{dados.switches}</div>
            </Cartao>

            <Cartao rotulo="aplicativo que dominou"
              nota={categoriaTopo
                ? `${duracao(dados.apps[0]?.seconds ?? 0)} · maior fatia foi ${NOMES[categoriaTopo.name] ?? categoriaTopo.name}, ${duracao(categoriaTopo.seconds)}`
                : undefined}>
              <div className="numero" style={{ fontSize: 26, letterSpacing: '-0.6px', paddingTop: 8 }}>
                {dados.apps[0]?.name ?? '—'}
              </div>
            </Cartao>
          </div>

          <div className="painel">
            <h3>
              a fita do dia
              <em>
                {plural(dados.timeline.length, 'trecho', 'trechos')}
                {dados.timelineOcultos > 0 && ` · ${dados.timelineOcultos} curtos demais para desenhar`}
              </em>
            </h3>
            <Fita blocos={dados.timeline} dia={dia} />
            <div className="legenda">
              {dados.categories.slice(0, 8).map((c) => (
                <span key={c.name} className="pilula">
                  <i style={{ background: cor(c.name) }} />{NOMES[c.name] ?? c.name}
                </span>
              ))}
            </div>
          </div>

          <div className="grade g32">
            <div className="painel">
              <h3>
                a forma do foco
                <em>{plural(dados.forma.sessoes, 'sessão sustentada', 'sessões sustentadas')}</em>
              </h3>
              <FormaDoFoco faixas={dados.forma.faixas} mediana={dados.forma.mediana} maior={dados.forma.maior} />
              <div className="nota">
                minutos por tamanho de sessão — trecho de 15min com 75% de foco, sem quebra maior que 2min
              </div>
            </div>
            <div className="painel">
              <h3>por categoria</h3>
              <Rosca fatias={dados.categories} total={dados.activeSeconds} />
            </div>
          </div>

          <div className="grade g32">
            <div className="painel">
              <h3>onde o tempo foi</h3>
              <Barras itens={principais(dados.apps)} total={dados.activeSeconds} tom="var(--brasa)" />
            </div>
            <div className="painel">
              <h3>projetos tocados <em>{plural(dados.projects.length, 'projeto', 'projetos')}</em></h3>
              {dados.projects.length
                ? <Barras itens={dados.projects} total={dados.activeSeconds} tom="var(--agua)" />
                : <p className="vazio">O jev ainda não atribuiu projeto a nenhuma janela deste dia.</p>}
            </div>
          </div>

          <div className="grade g2">
            <div className="painel">
              <h3>janelas onde você mais ficou</h3>
              <div className="linhas">
                {dados.windows.slice(0, 8).map((janela, i) => (
                  <div key={i} className="linha">
                    <span className="nome" title={janela.title}>
                      <span style={{ color: 'var(--texto-fraco)' }}>{janela.app}</span> · {janela.title}
                    </span>
                    <span className="valor">{duracao(janela.seconds)}</span>
                  </div>
                ))}
                {!dados.windows.length && <p className="vazio">Sem títulos de janela — falta Acessibilidade.</p>}
              </div>
            </div>
          </div>

          <div className="painel">
            <h3>
              as suas mãos
              <em>
                {dados.entrada.teclas.toLocaleString('pt-BR')} teclas ·{' '}
                {dados.entrada.cliques.toLocaleString('pt-BR')} cliques ·{' '}
                {dados.entrada.rolagem.toLocaleString('pt-BR')} gestos de rolagem
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
                      {escrevendo > 0.4 ? 'escrevendo' : escrevendo > 0.12 ? 'misto' : 'lendo'}
                    </span>
                    <span className="trilho" title={`${linha.teclas} teclas, ${linha.cliques} cliques, ${linha.rolagem} de rolagem`}>
                      <i style={{
                        width: `${Math.round(escrevendo * 100)}%`,
                        background: 'var(--ouro)', boxShadow: '0 0 9px var(--ouro)', opacity: 0.85,
                      }} />
                    </span>
                  </div>
                )
              })}
              {!dados.entradaPorApp.length && <p className="vazio">Sem sinal de teclado ainda.</p>}
            </div>
            <div className="nota">
              a barra é a fatia de teclas sobre o total — cheia é escrever, vazia é ler.
              São contagens de eventos do sistema, não distância: rolagem é quantas vezes
              você rolou, não quanto. E o que foi digitado não é guardado aqui, só quanto.
            </div>
          </div>

          <div className="grade g2">
            <div className="painel">
              <h3>o que saiu das mãos <em>{plural(dados.commits.length, 'commit', 'commits')} · {plural(dados.aiTurns.length, 'pedido de IA', 'pedidos de IA')}</em></h3>
              <div className="linhas" style={{ maxHeight: 250, overflowY: 'auto' }}>
                {dados.commits.map((commit, i) => (
                  <div key={i} className="linha" style={{ gridTemplateColumns: '1fr auto' }}>
                    <span className="nome">
                      <span style={{ color: 'var(--codigo)' }}>{commit.repo}</span> · {commit.subject}
                    </span>
                    <span className="valor">+{commit.insertions}/−{commit.deletions}</span>
                  </div>
                ))}
                {dados.aiTurns.slice(-12).map((turno, i) => (
                  <div key={`ia-${i}`} className="linha" style={{ gridTemplateColumns: '1fr auto' }}>
                    <span className="nome" title={turno.prompt}>
                      <span style={{ color: 'var(--ia)' }}>{turno.project}</span> · {turno.prompt}
                    </span>
                    <span className="valor">{relogio(turno.ts)}</span>
                  </div>
                ))}
                {!dados.commits.length && !dados.aiTurns.length && <p className="vazio">Nada registrado.</p>}
              </div>
            </div>

            <div className="painel">
              <h3>sinais <em>{plural(dados.visits, 'visita', 'visitas')} · {dados.clicks.toLocaleString('pt-BR')} cliques</em></h3>
              <div className="linhas">
                {dados.hosts.slice(0, 6).map((host) => (
                  <div key={host.name} className="linha">
                    <span className="nome">{host.name}</span>
                    <span className="valor">{host.n}</span>
                  </div>
                ))}
              </div>
              {dados.shortcuts.length > 0 && (
                <>
                  <h3 style={{ marginTop: 20 }}>atalhos</h3>
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
                  {dados.typing.chars.toLocaleString('pt-BR')} caracteres digitados em {dados.typing.samples} campos
                </div>
              )}

              {dados.telas.length > 1 && (
                <>
                  <h3 style={{ marginTop: 22 }}>telas</h3>
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
