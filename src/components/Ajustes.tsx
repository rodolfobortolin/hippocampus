import { useEffect, useState } from 'react'
import { useIdioma } from '../lib/idioma.tsx'
import { IDIOMAS, type Idioma } from '../lib/textos.ts'
import { IconeChave, IconePasta } from './Icons.tsx'

/**
 * O caminho do vault cabe em uma linha só se for cortado pelo começo — o que
 * identifica a pasta é o fim dele, não o `/Users/fulano` que toda pasta tem.
 */
function caminhoCurto(caminho: string): string {
  const partes = caminho.replace(/\/$/, '').split('/').filter(Boolean)
  return partes.length > 3 ? `…/${partes.slice(-3).join('/')}` : caminho
}

/** O Electron expõe o seletor de pasta; no navegador ele simplesmente não existe. */
const ponte = (globalThis as any).hipocampo as { escolherPasta?: () => Promise<string | null> } | undefined

function Campo({ rotulo, nota, children }: { rotulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <div className="ajuste">
      <div className="ajuste-rotulo">
        {rotulo}
        {nota && <span>{nota}</span>}
      </div>
      <div className="ajuste-campo">{children}</div>
    </div>
  )
}

export function Ajustes() {
  const { t, idioma, ajustes, salva } = useIdioma()
  const [nome, setNome] = useState('')
  const [pastaDiario, setPastaDiario] = useState('')
  const [jev, setJev] = useState('')
  const [openai, setOpenai] = useState('')
  const [estado, setEstado] = useState<'' | 'salvando' | 'salvo'>('')

  // Os campos de texto só se sincronizam quando os ajustes chegam ou mudam
  // por fora; enquanto a pessoa digita, quem manda é o que está na tela.
  useEffect(() => {
    if (!ajustes) return
    setNome(ajustes.nome)
    setPastaDiario(ajustes.pastaDiario)
  }, [ajustes])

  if (!ajustes) return <p className="vazio">{t.hoje.carregando}</p>

  const guarda = async (mudanca: Parameters<typeof salva>[0]) => {
    setEstado('salvando')
    try {
      await salva(mudanca)
      setEstado('salvo')
      setTimeout(() => setEstado(''), 1800)
    } catch {
      setEstado('')
    }
  }

  const escolhePasta = async () => {
    const escolhida = await ponte?.escolherPasta?.()
    if (escolhida) void guarda({ vault: escolhida })
  }

  const rotuloDaChave = (qual: 'jev' | 'openai') => {
    const onde = ajustes.chaves[qual]
    return onde === 'chaveiro' ? t.ajustes.guardadoNoChaveiro
      : onde === 'ambiente' ? `${t.ajustes.configurada} · .env`
      : t.ajustes.naoConfigurada
  }

  return (
    <>
      <div className="topo">
        <div>
          <h2><b>{t.ajustes.titulo}</b></h2>
          <p>{t.ajustes.subtitulo}</p>
        </div>
        {estado && <div className="navega"><span className="pilula">{estado === 'salvando' ? t.ajustes.salvando : t.ajustes.salvo}</span></div>}
      </div>

      <div className="grade" style={{ gap: 14 }}>
        <div className="painel">
          <h3>{t.ajustes.idioma}<em>{t.ajustes.idiomaNota}</em></h3>
          <div className="idiomas">
            {(Object.keys(IDIOMAS) as Idioma[]).map((chave) => (
              <button key={chave} className={`pilula ${chave === idioma ? 'ativo' : ''}`}
                onClick={() => guarda({ idioma: chave })}>
                <b>{IDIOMAS[chave].bandeira}</b> {IDIOMAS[chave].nome}
              </button>
            ))}
          </div>

          <Campo rotulo={t.ajustes.nome} nota={t.ajustes.nomeNota}>
            <input value={nome} onChange={(e) => setNome(e.target.value)}
              onBlur={() => nome.trim() && nome !== ajustes.nome && guarda({ nome: nome.trim() })} />
          </Campo>

          <Campo rotulo={t.ajustes.dia} nota={t.ajustes.diaNota}>
            <select value={ajustes.inicioDoDia}
              onChange={(e) => guarda({ inicioDoDia: Number(e.target.value) })}>
              {Array.from({ length: 13 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}{t.ajustes.horas}</option>
              ))}
            </select>
          </Campo>

          <Campo rotulo={t.ajustes.digitacao} nota={t.ajustes.digitacaoNota}>
            <button className={`chave ${ajustes.guardarDigitacao ? 'ativo' : ''}`}
              onClick={() => guarda({ guardarDigitacao: !ajustes.guardarDigitacao })}>
              <i />
            </button>
          </Campo>
        </div>

        <div className="painel">
          <h3><IconePasta /> {t.ajustes.vault}<em>{t.ajustes.vaultNota}</em></h3>
          <Campo rotulo={t.ajustes.escolherPasta}>
            <div className="caminho">
              <code title={ajustes.vault}>{ajustes.vault ? caminhoCurto(ajustes.vault) : t.ajustes.semVault}</code>
              {ponte?.escolherPasta && <button onClick={escolhePasta}>{t.ajustes.escolherPasta}</button>}
            </div>
          </Campo>
          <Campo rotulo={t.ajustes.pastaDoDiario}>
            <input value={pastaDiario} onChange={(e) => setPastaDiario(e.target.value)}
              onBlur={() => pastaDiario !== ajustes.pastaDiario && guarda({ pastaDiario })} />
          </Campo>
        </div>

        <div className="painel">
          <h3><IconeChave /> {t.ajustes.chaves}<em>{t.ajustes.chavesNota}</em></h3>

          <Campo rotulo={t.ajustes.jevChave} nota={t.ajustes.jevNota}>
            <div className="caminho">
              <input type="password" value={jev} placeholder={rotuloDaChave('jev')}
                onChange={(e) => setJev(e.target.value)} />
              <button disabled={!jev.trim()}
                onClick={() => { void guarda({ chaves: { jev: jev.trim() } }); setJev('') }}>
                {t.ajustes.salvar}
              </button>
              {ajustes.chaves.jev === 'chaveiro' && (
                <button onClick={() => guarda({ chaves: { jev: '' } })}>{t.ajustes.remover}</button>
              )}
            </div>
          </Campo>

          <Campo rotulo={`${t.ajustes.openaiChave} · ${t.ajustes.opcional}`} nota={t.ajustes.openaiNota}>
            <div className="caminho">
              <input type="password" value={openai} placeholder={rotuloDaChave('openai')}
                onChange={(e) => setOpenai(e.target.value)} />
              <button disabled={!openai.trim()}
                onClick={() => { void guarda({ chaves: { openai: openai.trim() } }); setOpenai('') }}>
                {t.ajustes.salvar}
              </button>
              {ajustes.chaves.openai === 'chaveiro' && (
                <button onClick={() => guarda({ chaves: { openai: '' } })}>{t.ajustes.remover}</button>
              )}
            </div>
          </Campo>
        </div>
      </div>
    </>
  )
}
