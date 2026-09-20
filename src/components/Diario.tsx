import { useEffect, useState } from 'react'
import { api, type DiaSalvo, type Status } from '../lib/api.ts'
import { duracao, dataLonga, somaDias, hoje as diaDeHoje } from '../lib/format.ts'
import { Markdown } from '../lib/markdown.tsx'
import { useIdioma } from '../lib/idioma.tsx'
import { IconeAbrir } from './Icons.tsx'

type Linha = { day: string; active: number; salvo?: DiaSalvo }

export function Diario({ status }: { status: Status | null }) {
  const t = useIdioma().t
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [aberto, setAberto] = useState<string | null>(null)
  const [gerando, setGerando] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  const carrega = async () => {
    const ate = diaDeHoje()
    const [periodo, salvos] = await Promise.all([api.periodo(somaDias(ate, -89), ate), api.dias()])
    const porDia = new Map(salvos.map((s) => [s.day, s]))
    const dias = new Map<string, Linha>()
    for (const dia of periodo.dias) dias.set(dia.day, { day: dia.day, active: dia.active, salvo: porDia.get(dia.day) })
    for (const salvo of salvos) if (!dias.has(salvo.day)) dias.set(salvo.day, { day: salvo.day, active: salvo.active_seconds, salvo })
    setLinhas([...dias.values()].sort((a, b) => b.day.localeCompare(a.day)))
  }

  useEffect(() => { carrega().catch((e) => setErro(e.message)) }, [])

  const gerar = async (dia: string) => {
    setGerando(dia)
    setErro('')
    try {
      await api.fechar(dia, true)
      await carrega()
      setAberto(dia)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setGerando(null)
    }
  }

  return (
    <>
      <div className="topo">
        <div>
          <h2><b>{t.diario.titulo}</b></h2>
          <p>{t.diario.subtitulo}</p>
        </div>
      </div>

      {status && !status.claude && (
        <div className="aviso">
          <div>
            <p><strong>{t.diario.claudeNaoRespondeu}</strong> {t.diario.claudeTexto}</p>
          </div>
        </div>
      )}

      {erro && <div className="aviso"><div><p>{erro}</p></div></div>}

      {!linhas.length ? (
        <div className="painel" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--texto-medio)' }}>{t.diario.semDias}</p>
          <p className="nota">{t.diario.amanhaEnche}</p>
        </div>
      ) : (
        <div className="grade" style={{ gap: 10 }}>
          {linhas.map((linha) => {
            const estaAberto = aberto === linha.day
            return (
              <div key={linha.day} className="dia-cartao">
                <button className="dia-cabeca" onClick={() => setAberto(estaAberto ? null : linha.day)}>
                  <span style={{
                    transform: estaAberto ? 'rotate(90deg)' : 'none',
                    transition: 'transform .2s', color: 'var(--texto-fraco)', display: 'grid',
                  }}>
                    <IconeAbrir />
                  </span>
                  <span className="data">
                    {linha.day}
                    <span>{dataLonga(linha.day)}</span>
                  </span>
                  <span style={{ color: 'var(--ouro)', fontVariantNumeric: 'tabular-nums', minWidth: 68 }}>
                    {duracao(linha.active)}
                  </span>
                  <span style={{ flex: 1, color: 'var(--texto-fraco)', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {linha.salvo?.narrative
                      ? linha.salvo.narrative.replace(/[*#-]/g, '').trim().slice(0, 110)
                      : linha.salvo?.top_app ?? t.diario.semNarrativa}
                  </span>
                </button>

                {estaAberto && (
                  <div className="dia-corpo aparece">
                    {linha.salvo?.narrative ? (
                      <>
                        <h4>{t.diario.resumoDoDia}</h4>
                        <div className="fala dele"><Markdown texto={linha.salvo.narrative} /></div>
                        {linha.salvo.recap && (
                          <>
                            <h4>{t.diario.oRecap}</h4>
                            <div className="fala dele"><Markdown texto={linha.salvo.recap} /></div>
                          </>
                        )}
                        <button
                          onClick={() => gerar(linha.day)}
                          disabled={gerando === linha.day}
                          style={{
                            marginTop: 18, padding: '7px 13px', borderRadius: 9, fontSize: 12.5,
                            border: '1px solid var(--borda)', color: 'var(--texto-medio)',
                          }}>
                          {gerando === linha.day ? t.diario.reescrevendo : t.diario.reescrever}
                        </button>
                      </>
                    ) : (
                      <div style={{ paddingTop: 16 }}>
                        <p style={{ color: 'var(--texto-medio)', fontSize: 13 }}>{t.diario.naoEscrito}</p>
                        <button
                          onClick={() => gerar(linha.day)}
                          disabled={gerando === linha.day || !status?.claude}
                          style={{
                            marginTop: 12, padding: '8px 15px', borderRadius: 9, fontSize: 13,
                            border: '1px solid rgba(255,209,102,.35)', color: 'var(--ouro)',
                          }}>
                          {gerando === linha.day ? t.diario.escrevendo : t.diario.escreverDia}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
