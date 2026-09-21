# Hippocampus

*[Read in English](README.md).*

O seu Mac já sabe onde o seu tempo foi. O Hippocampus guarda isso — **tudo local, todo dia** — e devolve em gráfico, em diário e em conversa.

```
helper nativo (Swift)  ─┐
navegadores, git, shell ├─►  coletor (launchd, sempre de pé)  ─►  SQLite local
sessões do Claude Code ─┤                                             │
Computer History       ─┘                                             ▼
                                            jev classifica ─► Claude Code narra
                                                                      │
                                              app (Electron) ◄────────┘
                                                      │
                                          vault do Obsidian (10 Diário)
```

Nada sai desta máquina. As chaves são suas e ficam num `.env` que o git ignora.
Sem chave nenhuma o app continua medindo, desenhando e guardando: só a
classificação, a narrativa e a conversa ficam desligadas.

## Texto e eventos, não pixels

Quase todo app desta categoria grava a tela e manda para um modelo de visão.
É por isso que eles custam caro (um concorrente popular queima por volta de
dez dólares num expediente, com cerca de um milhão de tokens de entrada por
hora), comem bateria, acendem o ícone laranja de compartilhamento de tela e
não podem ser vendidos na União Europeia.

O Hippocampus não tira um único screenshot. Ele lê o que já é texto: o título da
janela em foco, a URL da aba, os comandos, os commits, o que você pediu ao
Claude Code. Sai mais barato em duas ordens de grandeza, roda com um helper
nativo de alguns milissegundos por amostra — e "nunca tirei um screenshot" é
uma frase que os outros não conseguem dizer.

Também não existe servidor, nem conta, nem painel de administrador. Não há
nada que um empregador possa ligar para olhar o seu dia: o medo mais comum
nessa categoria aqui é impossível por construção, não por política.

## O tom

O diário é escrito como um `git log`: registro do que aconteceu, não avaliação
de quem fez. Sem elogio, sem repreensão, sem nota, sem meta implícita.

Isso é decisão de projeto, não estilo. A causa número um de abandono em
rastreador de tempo é **culpa**: a medição revela que ninguém faz oito horas
concentradas — faz de duas a cinco — e quase todo app trata isso como falha.
Dia curto, dia picado e dia de reunião são fatos sobre o mundo. E quando o
coletor fica fora do ar, o texto diz que faltou medição, em vez de deixar
parecer um dia em que você não fez nada.

## Começando

```bash
npm install
npm run build:native      # compila o helper que lê o foco das janelas
cp .env.example .env      # ajuste o nome, o vault e as chaves
npm run install:agent     # coletor sobe no login e volta sozinho se cair
npm run dev:app           # a janela
```

Requisitos: macOS, Node 22+, Xcode command line tools (para o helper),
e o `claude` instalado e logado para a parte escrita.

## As duas permissões

O macOS protege justamente o que interessa aqui. Na primeira execução aparecem
dois pedidos — e enquanto eles não forem respondidos, aquela fonte fica marcada
como *aguardando permissão* na barra lateral, sem travar o resto.

| Permissão | O que destrava | Sem ela |
| --- | --- | --- |
| **Acessibilidade** | título da janela e URL da aba | você vê *qual app*, não *em que* estava trabalhando |
| **Acesso a dados de outros apps** | histórico do Chrome/Arc e o Computer History | perde sites visitados e os eventos finos de teclado |
| **Calendários** — só se você ligar | nome e horário das reuniões | a chamada continua "microfone aberto", sem nome |

```bash
npm run permission
```

**Autorize pelo diálogo, não ligando o interruptor à mão.** Os dois parecem a
mesma coisa e não são: o diálogo grava o requisito de código junto com a
permissão, e o interruptor sozinho deixa o macOS negando por dentro enquanto
mostra ligado na tela.

O helper tem agente próprio no `launchd` de propósito. O macOS não atribui a
permissão a quem pede, e sim ao **processo responsável** — quem lançou. Fosse o
coletor em Node a lançá-lo, quem apareceria na lista seria o `node`, e autorizar
o `node` daria Acessibilidade a qualquer script Node da máquina. Lançado direto
pelo `launchd`, ele responde por si mesmo e aparece como "Hippocampus Focus".

O build usa o **Developer ID** do chaveiro quando existe, e isso não é sobre
distribuição: a autorização fica amarrada à identidade do certificado, que não
muda entre compilações. Com assinatura ad hoc ela fica amarrada ao hash do
código, e aí cada `npm run build:native` derruba a permissão **em silêncio** —
o interruptor continua ligado na tela enquanto o sistema nega por dentro. Sem
Developer ID no chaveiro o build avisa e cai para ad hoc; `npm run permission`
reconcede quando isso acontecer.

## O que ele coleta

| Fonte | O que vira | Com que frequência |
| --- | --- | --- |
| Helper nativo em Swift | app em foco, título da janela, URL da aba, ociosidade | a cada 4s |
| Computer History (Codex) | atalhos, trocas de janela, cliques, o que você digitou | a cada 2min |
| Chrome · Arc · Brave · Edge | sites visitados | a cada 10min |
| Sessões do Claude Code | o que você pediu e as ferramentas usadas | a cada 10min |
| `~/.zsh_history` | comandos | a cada 15min |
| Repositórios em `~/Documents/GitHub` | commits, linhas somadas e cortadas, e cada troca de branch pelo reflog | a cada 30min |
| O registro de energia do macOS (`pmset`) | quando você sentou e quando saiu, mesmo com o app fechado | a cada hora |
| Calendário do macOS — desligado até você ligar | nome e horário das reuniões, de ontem a amanhã | a cada 10min |

O tempo vira **bloco**: um trecho contínuo no mesmo app e na mesma janela. O bloco
é gravado quando começa e estendido a cada amostra, então uma queda custa no
máximo uma amostra. Acima de dois minutos parado vira bloco ocioso, que não
conta como tempo ativo.

Cada bloco carrega também **teclas, cliques e rolagem** — os contadores do
sistema, que não custam permissão nenhuma — e se **microfone ou câmera
estiveram em uso**. O primeiro separa ler de escrever; o segundo detecta chamada,
e chamada com vídeo, sem depender de reconhecer Zoom, Teams ou Meet pelo nome do
processo. Nenhum dos dois lê som ou imagem: só se pergunta ao sistema se o
dispositivo está rodando.

Os logs dos agentes registram como "usuário" muita coisa que ninguém digitou —
tarefas em segundo plano se anunciando, a saída do `/model`, listas de plugins.
Só o que uma pessoa escreveu fica como pedido; as palavras dentro de uma
delegação por voz ou depois de uma imagem anexada também ficam.

Blocos contíguos do mesmo projeto viram **episódio**, que é a unidade que dá
para procurar: quatro segundos no Chrome não casam com pergunta nenhuma, mas
"quarenta minutos no atende, com estes commits e estes comandos" casa. Os
episódios são indexados em FTS5, e é o que responde *"onde eu parei no X"*.

## O que ele mede

**Trabalho concentrado** é tempo em categorias de código, IA, escrita, design
e pesquisa — uma fração de tempo de verdade, e não a média de uma
probabilidade. **Sessão de foco** é o trecho em que isso se sustentou: janela
deslizante de 15 minutos exigindo 75%, com quebra de até 2 minutos tolerada.
É a diferença entre quatro horas de foco em duas sessões e as mesmas quatro
horas picadas em dez — que todo total diário mostra igual.

**Trocas de aplicativo** vêm separadas: a que muda de projeto custa resíduo de
atenção, a que não muda é o próprio trabalho.

Os limiares são convenção, e o que importa é que fiquem congelados: o número
serve para comparar você com você, nunca com outra pessoa nem com outro app.

O Computer History é um cache que a própria OpenAI apaga em poucas horas. O
Hippocampus colhe antes de sumir e arquiva em `archive/` compactado — é por isso
que ele consegue reconstruir dias anteriores ao dia em que foi instalado
(`npx tsx core/backfill.ts`).

## Peças de trabalho

O app sabe em que app você estava; os identificadores que atravessam as fontes
dizem em que você estava trabalhando. O endereço de uma aba vira uma peça de
trabalho — ticket do Jira, página do Confluence, pull request, documento,
vídeo — e de quem ela é: o subdomínio do Jira ou do Confluence, o dono no
GitHub. A mesma chave de ticket numa aba, num pedido ao Claude Code e numa
mensagem de commit vira uma linha só. O branch em que o repositório estava junta
o que não cita nada: um commit, um pedido, os minutos do agente ou um trecho no
editor em `feature/sup-12-login` contam para o SUP-12.

A aba **Trabalho** mostra isso por cliente e por peça, com todos os momentos que
tocaram cada uma a um clique. Ela mostra só o eixo que os seus dados têm: quem
não tem clientes não vê caixa de clientes. E-mail é "e-mail", nunca o assunto.

Para quem cobra por hora existe um **rascunho de apontamento**, desligado até
você ligar: o foco medido da semana por cliente e linha, o tempo do agente à
parte, e o tempo sem cliente dito com todas as letras. É um registro para
conferir, nunca uma avaliação — para quem não cobra por hora, apontamento soa
como vigilância, e é por isso que ele não vem ligado.

## Os dois modelos, e por que dois

**jev (TypeSafe)** classifica cada janela: categoria, projeto e a probabilidade
de ser trabalho concentrado. São perguntas tipadas com resposta calibrada, a
~110ms e uma fração de centavo — e o resultado fica guardado por janela, então a
mesma janela nunca custa duas chamadas.

**Claude Code** escreve. Usa o login do `claude` que já está na máquina: sem
chave de API, sem conta nova, sem custo além da assinatura que você já paga. É
ele que redige o resumo do dia, o recap e responde na aba Conversa — ali com
ferramentas que consultam o banco local, então a resposta vem do número medido,
não de palpite.

## O dia fechado

Quando a data vira (às 4h, para a madrugada contar no dia anterior), o coletor
fecha o dia: classifica com o jev, calcula os números, pede o texto ao Claude
Code e grava em `10 Diário/AAAA-MM-DD.md` do vault, dentro de marcadores
próprios — o que o Jarvis escreveu na mesma nota fica intacto.

Se a máquina estava dormindo na virada, o dia entra numa fila e é fechado no
próximo boot. À mão:

```bash
npm run rollup -- 2026-09-19
npm run rollup -- 2026-09-19 --no-narrative   # só os números
```

## Onde ficam os dados

```
~/Library/Application Support/Hippocampus/
  hippocampus.db          tudo que foi medido
  archive/              eventos do Computer History, compactados
~/Library/Logs/Hippocampus/collector.log
```

Para sair sem deixar rastro: `npm run uninstall:agent` e apague essa pasta.
Para não guardar o que você digita, `HIPOCAMPO_KEEP_TYPING=0` no `.env` —
o que já está guardado passa pela redação de segredos antes de ser gravado.

## Estrutura

```
native/focus.swift     helper que amostra foco, janela, URL, ociosidade, microfone
                       e câmera — e o calendário, quando pedido
native/listener.swift  a palavra de ativação, reconhecida no próprio Mac
native/agents.swift    registra os helpers como itens de início
core/
  collector.ts         o laço: amostra, colhe, fecha o dia
  db.ts                esquema SQLite e suas migrações
  sources/             foco, Computer History, navegadores, Claude Code, Codex,
                       git e seu reflog, shell, o registro de energia, o calendário
  pages.ts             uma URL lida como peça de trabalho, e de quem ela é
  items.ts             as peças de trabalho juntadas de todas as fontes
  timesheet.ts         o rascunho semanal opcional por cliente e linha
  prompts.ts           o que uma pessoa digitou, dentro do log de um agente
  jev.ts               classificação por janela, memorizada
  metrics.ts           o dia e o período, em números
  rollup.ts            fecha o dia e pede a narrativa
  agent.ts             a conversa, com ferramentas sobre o banco
  server.ts            API local em 127.0.0.1
  settings.ts          ajustes, e as chaves no Chaveiro
  languages.ts         os cinco idiomas, para tudo que o núcleo escreve
  guard.ts             nenhuma coleta pode travar o coletor
app/main.cjs           a janela, o ícone da barra e o núcleo flutuante
src/                   a interface (React + SVG à mão)
site/                  o site do projeto
```
