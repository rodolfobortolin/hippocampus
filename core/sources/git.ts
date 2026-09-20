import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { config, dayOf } from '../config.ts'
import { db } from '../db.ts'

const insert = db.prepare(
  `insert or ignore into commits (sha, repo, ts, day, subject, files, insertions, deletions)
   values (?, ?, ?, ?, ?, ?, ?, ?)`,
)

function git(repo: string, args: string[]): string {
  try {
    return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  } catch {
    return ''
  }
}

/**
 * Varre os repositórios e guarda os commits dos últimos `days` dias.
 *
 * Tudo que toca o disco aqui é assíncrono de propósito. A pasta de código mora
 * em `~/Documents`, que o macOS protege: sem a permissão, um `readdirSync` não
 * devolve erro — ele para. E parado no event loop, para o coletor inteiro, com
 * o servidor já dizendo "de pé" e nenhuma rota respondendo. O `withTimeout` que
 * embrulha esta função não salva disso, porque o timeout dele também precisa
 * do event loop para disparar; assíncrono é o que devolve o controle a ele.
 */
export async function harvestGit(days = 3): Promise<{ commits: number }> {
  let nomes: string[]
  try {
    nomes = await fs.readdir(config.codeRoot)
  } catch {
    return { commits: 0 }
  }
  let total = 0

  for (const name of nomes) {
    const repo = path.join(config.codeRoot, name)
    try {
      await fs.access(path.join(repo, '.git'))
    } catch {
      continue
    }

    // %x1f separa campos e %x1e ABRE cada commit — não fecha.
    //
    // Com o separador no fim, o --shortstat sai na linha seguinte ao cabeçalho
    // e cai dentro do pedaço do commit seguinte; o parser lia a estatística
    // errada e gravava tudo como +0/-0. Abrindo o registro, cabeçalho e
    // estatística ficam no mesmo pedaço.
    const log = git(repo, [
      'log', '--all', '--no-merges', `--since=${days}.days.ago`,
      '--pretty=format:%x1e%H%x1f%at%x1f%s', '--shortstat',
    ])
    if (!log.trim()) continue

    for (const entry of log.split('\x1e')) {
      if (!entry.trim()) continue
      const [header, ...rest] = entry.split('\n')
      const [sha, at, subject] = header.trim().split('\x1f')
      if (!sha || !at) continue
      const stat = rest.join(' ')
      const files = Number(/(\d+) files? changed/.exec(stat)?.[1] ?? 0)
      const insertions = Number(/(\d+) insertions?/.exec(stat)?.[1] ?? 0)
      const deletions = Number(/(\d+) deletions?/.exec(stat)?.[1] ?? 0)
      const ts = Number(at)
      insert.run(sha, name, ts, dayOf(ts), (subject ?? '').slice(0, 300), files, insertions, deletions)
      total++
    }
  }
  return { commits: total }
}
