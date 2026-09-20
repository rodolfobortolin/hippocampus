# Hipocampo

Medidor local do dia no Mac. Leia o `README.md` para o que ele é e o
`CONTRIBUTING.md` para as duas regras que não se negociam — nunca tirar
screenshot, e nunca dar nota em quem usa.

## Commit messages

English, like the rest of the project. One logical change per commit. An
imperative subject line, 50 characters as a target and 72 as the ceiling. A
blank line, then a body explaining **why** — the diff already shows the what.
If the subject needs an "and" to fit, it is two commits.

No attribution line: no `Co-Authored-By`, no mention of which model or tool
wrote the code. The commit's author is whoever answers for it.

```
Hide the floating core instead of closing it

Closing destroyed the WebGL scene, so the wake word had to wait for it to load
again before it could listen.
```

When the reason came from a measurement, the number goes in the body. "It gives
up after seven seconds" is worth less than "at rest closed, five seconds after
the wake word open, fifteen seconds later closed again".

## Comments

They explain why, not what, and they are in English like the code. Where they
matter most is `native/` and `app/main.cjs`: nearly every comment there exists
because macOS punished a reasonable idea, and without the record someone
reintroduces the idea.

## Antes de dizer que terminou

```bash
npm run build     # tipos e interface
npm test          # é o que a CI roda, os dois
```

Mexeu no núcleo? Reinicie e confira que ele voltou inteiro:

```bash
launchctl kickstart -k gui/$(id -u)/com.hipocampo.coletor
curl -s http://127.0.0.1:7878/api/status
```

## Os cinco idiomas são checados pelo compilador

`src/lib/textos.ts` tem um tipo fechado: acrescentar uma chave quebra o build
até os cinco idiomas terem tradução. Isso é proposital. O mesmo vale no núcleo,
em `core/idiomas.ts`, `core/personas.ts` e `core/dossie.ts`.

Nunca traduzir chave guardada no banco (`codigo`, `ia`, `distracao`): trocar de
idioma não pode reescrever o passado. Só muda o nome exibido, em
`NOMES_CATEGORIA`.

## Disco síncrono é proibido nas fontes

Nada de `readdirSync`, `readFileSync`, `existsSync` ou `openSync` sob
`core/sources/`. Em pasta que o macOS protege, essas chamadas não devolvem
erro — elas param, e param o coletor inteiro junto. O `comLimite` não salva,
porque o timeout dele também precisa do event loop. Há um teste verificando.

Pelo mesmo motivo, o app empacotado roda de `/Applications`: sob launchd, o
Node não consegue nem carregar os próprios arquivos de `~/Documents`.

## Os agentes

No app empacotado, os três agentes — coletor, foco e ouvido — são login items
registrados por `SMAppService`, com os plists dentro do bundle em
`Contents/Library/LaunchAgents`. Quem registra é `native/agentes.swift`, que
mora em `Contents/MacOS` porque é de lá que `Bundle.main` resolve para o app.

O `scripts/agent.sh`, que escreve plists à mão em `~/Library/LaunchAgents`,
continua existindo para desenvolvimento.

**O registrador precisa ser assinado com o identificador do app.** O
SMAppService compara a identidade de quem pede com a do app, e "quem pede" é
literal. Assinado com o nome do arquivo, o registro falha com um seco
"Operation not permitted" e nenhuma pista. É o que o `build/assina-registrador.cjs`
faz no afterPack, antes do selo.

## Chaves

Vivem no Chaveiro do macOS, gravadas pela tela de Ajustes. Nunca em arquivo,
nunca em commit, nunca num argumento de processo — argumento qualquer `ps` lê.
O `.env` existe só para desenvolvimento e perde para o Chaveiro.
