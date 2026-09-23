# Hippocampus

O seu Mac já sabe onde o seu tempo foi. O Hippocampus guarda isso — **tudo local,
todo dia** — e devolve em gráfico, em diário e em conversa.

*[Read in English](README.md).*

**[Baixar para Mac](https://github.com/rodolfobortolin/hippocampus/releases/latest/download/Hippocampus-arm64.dmg)**
— macOS 13 ou mais novo, Apple silicon. Assinado e notarizado; ele se atualiza sozinho.

```
helper nativo (Swift)   ─┐
navegadores, git, shell  ├─►  coletor (launchd, sempre de pé)  ─►  SQLite local
sessões do Claude Code  ─┤                                             │
Computer History        ─┘                                             ▼
                                            jev classifica ─► Claude Code narra
                                                                       │
                                              app (Electron) ◄─────────┘
                                                       │
                                               vault do Obsidian
```

O banco fica nesta máquina e em nenhum outro lugar. O que sai dele vai com as
suas chaves e o seu login: o jev recebe títulos de janela, para rotulá-los; o
Claude Code recebe o dia — os números, os sites, o que você pediu aos seus
agentes e, com o Computer History do Codex ligado, algumas linhas do que você
digitou — e, quando você pede para ele olhar, uma imagem da sua tela; a OpenAI
recebe a sua voz, só enquanto você fala com ele. As chaves são suas e ficam no
Chaveiro do macOS, digitadas dentro do próprio app. Sem chave nenhuma ele
continua medindo, desenhando e guardando: só a classificação, a narrativa e a
conversa ficam desligadas.

## Texto e eventos

O Hippocampus mede a partir do que já é texto: o título da janela em foco, a URL
da aba, os comandos, os commits, o que você pediu ao Claude Code. Roda com um
helper nativo de alguns milissegundos por amostra.

Também não existe servidor, nem conta, nem painel de administrador. Não há nada
em que um empregador possa entrar para olhar o seu dia: o medo mais comum nessa
categoria aqui é impossível por construção, não por política.

## O tom

O diário é escrito como um `git log`: registro do que aconteceu, não veredito
sobre a pessoa. Sem elogio, sem bronca, sem nota, sem meta implícita.

Isso é decisão de produto, não estilo. A causa número um de abandono em
rastreador de tempo é **culpa**: a medição revela que ninguém faz oito horas
concentradas — faz de duas a cinco — e quase todo app trata isso como falha. Dia
curto, dia picado e dia cheio de reunião são fatos sobre o mundo. E quando o
coletor esteve fora do ar, o texto diz que faltou medição, em vez de deixar
parecer um dia em que você não fez nada.

## Começando

Baixe o `.dmg` lá em cima, arraste o Hippocampus para `/Applications`, abra e
ligue **medir sozinho** nos Ajustes. Isso registra três itens de login — o
coletor, o leitor de janelas e o ouvinte da palavra de ativação — que o macOS
pede para você aprovar em **Ajustes do Sistema → Geral → Itens de Início**. Eles
sobem com o Mac e voltam sozinhos se caírem.

Para compilar você mesmo:

```bash
npm install
npm run build:native      # compila os helpers em Swift
npm run dist              # gera e assina o Hippocampus.app em release/
```

Para mexer no código, sem empacotar:

```bash
npm run dev:app           # core, interface e janela, a partir do código
npm run install:agent     # os agentes do launchd instalados à mão, do jeito antigo
npm test
```

Requisitos: macOS 13+, Node 24+, Xcode command line tools e o `claude` instalado
e logado para a parte escrita. O app empacotado não precisa de Node nenhum —
ele roda o core no Electron que já traz.

**Mantenha o app fora de `~/Documents`.** O macOS protege essa pasta, e um
agente em segundo plano que não consegue lê-la não falha — ele trava, antes de
escrever uma única linha de log. `/Applications` não é protegida, e essa é
metade da razão de o app ser empacotado.

Depois abra os **Ajustes** dentro do app: escolha o idioma, diga como quer ser
chamado, aponte o vault do Obsidian e cole as chaves. Nada ali passa por arquivo
de texto — veja [Chaves](#chaves).

## Cinco idiomas, do começo ao fim

Português, inglês, espanhol, francês e alemão. A escolha vale para tudo, não só
para os botões: a interface, as datas e os números, o diário que o Claude Code
escreve, a conversa, a voz e as perguntas que o jev recebe ao classificar uma
janela. Um app que mede o seu dia e depois escreve sobre ele na língua de outra
pessoa não serve para você.

As chaves de categoria (`code`, `ai`, `distraction`…) são identificadores
guardados no banco e nunca mudam — trocar de idioma não reescreve o passado. Só
muda o que você lê.

## Chaves

Duas chaves, as duas opcionais, as duas guardadas no **Chaveiro do macOS** e
digitadas na tela de Ajustes do próprio app. Nunca passam por arquivo de
configuração e nunca aparecem num commit. Quando você digita uma, ela vai para o
Chaveiro pela entrada padrão, e não como argumento de comando — argumentos de
processo são legíveis por qualquer `ps` na máquina.

| Chave | O que destrava | Sem ela |
| --- | --- | --- |
| **jev (TypeSafe)** | categoria, projeto e foco por janela | o tempo por app continua; nada é agrupado por assunto |
| **OpenAI** | transcrever o que você fala, falar as respostas e a voz ao vivo | a voz do sistema lê as respostas e não há voz ao vivo; a conversa não muda |

A conversa é sempre o Claude Code, pelo login do `claude` que já está na
máquina — sem chave de API, sem conta nova, sem custo além da assinatura que
você já paga.

Um `.env` ainda funciona para desenvolvimento, mas o Chaveiro vence: o que você
digita no app é o que vale.

## As permissões

O macOS protege justamente o que interessa aqui. Os primeiros pedidos aparecem
na primeira execução — e enquanto não forem respondidos, aquela fonte fica
marcada como *aguardando permissão* na barra lateral, sem travar o resto. Os
dois últimos só aparecem na primeira vez que você pede para ele olhar a sua
tela ou clicar nela.

| Permissão | Quem pede | O que destrava | Sem ela |
| --- | --- | --- | --- |
| **Acessibilidade** | Hippocampus Focus | título da janela e URL da aba | você vê *qual app*, não *em que* estava trabalhando |
| **Acesso a dados de outros apps** | Hippocampus | histórico do Chrome/Arc e o Computer History | perde sites visitados e os eventos finos de teclado |
| **Microfone e Reconhecimento de Fala** | Hippocampus Listener | a palavra de ativação, reconhecida no próprio Mac | sem palavra de ativação; o atalho e o clique continuam |
| **Calendários** — só se você ligar | Hippocampus | nome e horário das reuniões | a chamada continua "microfone aberto", sem nome |
| **Gravação de Tela** — só quando pedido | Hippocampus | olhar a sua tela quando você pede | ele avisa que falta a permissão |
| **Acessibilidade** — só quando pedido | Hippocampus | clicar na sua tela quando você pede | ele avisa que falta a permissão, e não clica |

```bash
npm run permission
```

**Autorize pelo diálogo, não ligando o interruptor à mão.** Parecem a mesma
coisa e não são: o diálogo grava o requisito de código junto com a permissão, e
o interruptor sozinho deixa o macOS negando por dentro enquanto mostra ligado na
tela.

O helper tem um agente do `launchd` próprio, de propósito. O macOS não atribui a
permissão a quem pede, e sim ao **processo responsável** — quem o iniciou. Se o
coletor em Node o iniciasse, o que apareceria na lista seria o `node`, e
autorizar o `node` daria Acessibilidade a qualquer script Node da máquina.
Iniciado direto pelo `launchd`, ele responde por si e aparece como "Hippocampus
Focus".

A build usa o **Developer ID** do Chaveiro quando existe um, e isso não tem a ver
com distribuição: a permissão fica presa à identidade do certificado, que não
muda entre builds. Com assinatura ad hoc ela fica presa ao hash do código, e aí
todo `npm run build:native` derruba a permissão **em silêncio** — o interruptor
continua ligado na tela enquanto o sistema nega por baixo. Sem Developer ID no
Chaveiro a build avisa e cai para ad hoc; o `npm run permission` concede de novo
quando isso acontece.

## O que ele coleta

| Fonte | O que vira | Com que frequência |
| --- | --- | --- |
| Helper nativo em Swift | app em foco, título da janela, URL da aba, ociosidade | a cada 4s |
| Computer History (Codex) | atalhos, trocas de janela, cliques, o que você digitou | a cada 2min |
| Chrome · Arc · Brave · Edge · Safari | sites visitados | a cada 10min |
| Sessões do Claude Code e do Codex | o que você pediu e quais ferramentas rodaram | a cada 10min |
| `~/.zsh_history` | comandos | a cada 15min |
| Repositórios na sua pasta de código (`~/Documents/GitHub`, a menos que você escolha outra) | commits, linhas somadas e cortadas, e cada troca de branch pelo reflog | a cada 30min |
| O log de energia do macOS (`pmset`) | quando você sentou e quando saiu, mesmo com o app fechado | a cada hora |
| Calendário do macOS — desligado até você ligar | nome e horário das reuniões, de ontem a amanhã | a cada 10min |

O tempo vira um **bloco**: um trecho contínuo no mesmo app e na mesma janela. O
bloco é gravado quando começa e estendido a cada amostra, então um travamento
custa no máximo uma amostra. Depois de dois minutos ocioso ele vira um bloco de
ociosidade, que não conta como tempo ativo.

Cada bloco também leva **teclas, cliques e rolagem** — os contadores do sistema,
que não custam permissão nenhuma — e se havia **microfone ou câmera em uso**. O
primeiro separa ler de escrever; o segundo detecta uma chamada, e uma chamada
de vídeo, sem precisar reconhecer Zoom, Teams ou Meet pelo nome do processo.
Nenhum dos dois lê um som ou um quadro: o sistema só é perguntado se o
dispositivo está ligado.

Os logs de agentes registram como "usuário" muita coisa que ninguém digitou —
tarefas em segundo plano se anunciando, a saída do `/model`, listas de plugins.
Só o que uma pessoa escreveu fica como pedido; as palavras dentro de uma
delegação de voz ou depois de uma imagem anexada também ficam.

Blocos seguidos do mesmo projeto viram um **episódio**, que é a unidade que dá
para buscar de verdade. Quatro segundos no Chrome não respondem pergunta
nenhuma, mas "quarenta minutos no atende, com estes commits e estes comandos"
respondem. Os episódios são indexados em FTS5, e é isso que responde *"onde
parei no X"*.

## O que ele mede

**Trabalho concentrado** é o tempo nas categorias código, IA, escrita, design e
pesquisa — uma fração real do tempo, não a média de uma probabilidade. Uma
**sessão de foco** é o trecho em que isso se manteve: uma janela deslizante de
15 minutos exigindo 75%, tolerando pausas de até 2 minutos. É a diferença entre
quatro horas concentradas em duas sessões e as mesmas quatro horas picadas em
dez — que todo total diário mostra igual.

**Trocas de app** vêm separadas: a que muda de projeto custa resíduo de atenção,
a que não muda é o próprio trabalho.

**Trabalho delegado** é contado à parte. Esta máquina trabalha com agentes:
tempo longe do teclado enquanto um agente está produzindo não é ociosidade, e o
diário é instruído a dizer isso.

Os limiares são uma convenção, e o que importa é que fiquem congelados: o número
serve para comparar você com você, nunca com outra pessoa ou outro app.

O Computer History é um cache que a própria OpenAI apaga em poucas horas. O
Hippocampus colhe antes de sumir e arquiva comprimido em `archive/` — e é assim
que ele consegue reconstruir dias de antes de ser instalado
(`npx tsx core/backfill.ts`).

## Peças de trabalho

O app sabe em que app você estava; os identificadores que cruzam as fontes dizem
em que você estava trabalhando. O endereço de uma aba vira uma peça de trabalho —
um ticket do Jira, uma página do Confluence, um pull request, um documento, um
vídeo — e de quem ela é: o subdomínio do Jira ou do Confluence, o dono no GitHub.
A mesma chave de ticket numa aba, numa pergunta ao Claude Code e numa mensagem de
commit vira uma linha só. O branch em que o repositório estava junta o que não
nomeia nada: um commit, uma pergunta, os minutos do agente ou um trecho no
editor em `feature/sup-12-login` contam para o SUP-12.

A aba **Trabalho** mostra isso por cliente e por peça, com cada momento que tocou
uma delas a um clique. Ela mostra só o eixo que os seus dados têm: quem não tem
clientes não vê caixa de clientes. E-mail é "e-mail", nunca o assunto.

Para quem cobra por hora existe um **rascunho de timesheet**, desligado até você
ligar: o foco medido da semana por cliente e linha, o tempo do agente à parte, e
o tempo sem cliente dito com todas as letras. É um registro para conferir, nunca
um julgamento — para quem não cobra por hora, timesheet soa como vigilância, e é
por isso que não vem ligado.

## A conversa

A aba Conversa e o núcleo flutuante respondem a partir do banco local, pelo
Claude Code e por uma dúzia de ferramentas sobre o que foi medido — nunca de
memória, e nunca com SQL escrito na hora, então um número quer dizer a mesma
coisa em todo lugar. Pergunte digitando ou em voz alta.

- **Apertar e falar** grava uma pergunta, transcreve e lê a resposta. **Ao vivo**
  mantém uma conversa aberta que você pode interromper, e cobra pelo tempo que
  fica aberta; uma linha sobre a caixa de texto diz quando está conectando,
  quando está ao vivo e há quanto tempo, o que você fala aparece enquanto você
  fala, e a esfera se mexe com a sua voz além da dela.
- **Peça para ele olhar a sua tela** e ele olha, naquele momento: a tela onde
  está o cursor, ou todas se você disser, sem as janelas do próprio Hippocampus.
  A imagem serve para aquela resposta e é apagada.
- Quando a resposta é um lugar na tela, uma faísca do núcleo **voa até lá e diz
  o nome**. Peça para **clicar** e ele clica, depois que o ponteiro pousa onde
  você consegue ver — e não envia, compra, apaga nem confirma nada a menos que
  seja exatamente isso que você pediu.
- **Ferramentas ampliadas**, desligadas por padrão, entregam a ele o resto do
  Claude Code neste Mac: arquivos, comandos, a web, os seus servidores MCP —
  digitando ou falando, sem perguntar antes.

## O núcleo, de plantão

O núcleo flutuante é o app quando você não quer o app: uma janela sem moldura só
com a esfera, por cima do que você estiver fazendo. Ele escuta com um clique e
responde em voz alta.

- Diga **"Hippocampus"** e ele vem para a frente, já ouvindo — no modo ao vivo,
  com a conversa aberta. A palavra de ativação é reconhecida inteira no próprio
  Mac pelo `SFSpeechRecognizer`: nenhum áudio sai da máquina, e nada é gravado
  até você falar com ele. Em repouso a esfera se mexe de leve com o som do
  ambiente, e é assim que você sabe que o ouvinte está vivo.
- **⌘⇧Espaço** faz o mesmo sem a palavra. **⌘⇧H** mostra e esconde.
- Arraste a esfera para movê-la; onde você deixar é onde ela volta.
- Clique nela para ela parar de falar, ou para perguntar outra coisa.

## Assinado, e notarizado quando você quiser compartilhar

A build pega um certificado **Developer ID** do Chaveiro quando existe um, e liga
o hardened runtime e entitlements com o mínimo de privilégio. Na sua própria
máquina isso basta — e é o que faz a permissão de Acessibilidade sobreviver a uma
nova build, porque ela fica presa à identidade do certificado e não ao hash do
código.

A notarização só importa quando outra pessoa baixa: o Gatekeeper recusa, na
primeira abertura, um app Developer ID que a Apple nunca viu. Guarde uma
credencial uma vez e um comando faz o resto:

```bash
xcrun notarytool store-credentials hippocampus --apple-id VOCE@EXEMPLO.COM --team-id SEUTIME
npm run notarize
```

Sem `--password` a senha é pedida sem eco, então nunca vai parar no histórico do
shell. O `npm run notarize` deixa três arquivos em `release/vX.Y.Z/`: o `.dmg`
para baixar, e o zip e o `latest-mac.yml` de onde as cópias instaladas se
atualizam — o app procura uma release nova no GitHub quando abre e a cada quatro
horas, e instala ao reiniciar.

A senha específica de app é gerada em appleid.apple.com — não é a senha do seu
Apple ID, e fica no Chaveiro, nunca no repositório.

## O dia fechado

Quando a data vira (às 4h, para a madrugada contar como o dia anterior), o
coletor fecha o dia: classifica com o jev, calcula os números, pede o texto ao
Claude Code e escreve em `AAAA-MM-DD.md` no seu vault, dentro dos próprios
marcadores — o que mais tiver escrito na mesma nota fica intacto. A pasta do
vault e a subpasta do diário são escolhidas nos Ajustes.

Depois ele lê o dia mais uma vez, atrás do que sobrevive a ele. Os pedidos que
você escreveu naquele dia vão ao Claude Code, que responde com as poucas coisas
que valem guardar — um projeto que andou, um problema entendido, o que alguém
está esperando — e cada uma é escrita nas suas próprias notas: `20 Projetos`,
`40 Conhecimento`, `50 Pessoas`, `30 Áreas`, `00 Caixa de entrada`, ou como
essas pastas já se chamarem no seu vault, em qualquer um dos cinco idiomas. Uma
nota que existe ganha mais uma linha na seção que já tem; uma que não existe
nasce do modelo do seu vault. A maioria dos dias guarda uma coisa ou nenhuma, um
dia já lido nunca é lido de novo, e o interruptor nos Ajustes desliga tudo isso.
A aba Notas mostra o que foi guardado e aceita o que você quiser escrever.

Se a máquina estava dormindo na virada, o dia entra numa fila e é fechado no
próximo boot. À mão:

```bash
npm run rollup -- 2026-09-19
npm run rollup -- 2026-09-19 --no-narrative   # só os números
```

## Onde ficam os dados

```
~/Library/Application Support/Hippocampus/
  hippocampus.db        tudo o que foi medido
  archive/              eventos do Computer History, comprimidos
~/Library/Logs/Hippocampus/
  collector.log         o core
  listener.log          a palavra de ativação
```

Para sair sem deixar rastro: `npm run uninstall:agent` e apague essa pasta. Para
parar de guardar o que você digita, desligue nos Ajustes — o que já está guardado
passou pela redação de segredos antes de ser gravado.

## Estrutura

```
native/focus.swift     helper que amostra foco, janela, URL, ociosidade, microfone
                       e câmera — e o calendário, quando pedido
native/listener.swift  a palavra de ativação, reconhecida no próprio Mac, e o volume do ambiente
native/screen.swift    uma imagem da tela sem o app nela, e um clique
native/agents.swift    registra os helpers como itens de login
core/
  collector.ts         o laço: amostrar, colher, fechar o dia
  db.ts                esquema do SQLite e as migrações
  sources/             foco, Computer History, navegadores, Claude Code, Codex,
                       git e o reflog, shell, o log de energia, o calendário
  pages.ts             uma URL lida como peça de trabalho, e de quem ela é
  items.ts             peças de trabalho reunidas de todas as fontes
  timesheet.ts         o rascunho semanal opcional por cliente e linha
  prompts.ts           o que uma pessoa digitou, tirado do log de um agente
  jev.ts               classificação por janela, memorizada
  metrics.ts           o dia e o período, em números
  rollup.ts            fecha o dia e pede a narrativa
  agent.ts             a conversa, com ferramentas sobre o banco e a tela
  live.ts              a voz ao vivo, que passa cada pergunta ao Claude Code
  screen.ts            olhar, apontar e clicar, quando pedido
  server.ts            API local em 127.0.0.1
  settings.ts          ajustes, e as chaves no Chaveiro
  languages.ts         os cinco idiomas, para tudo o que o core escreve
  guard.ts             nenhuma fonte pode travar o coletor
app/main.cjs           a janela, o ícone na barra, o núcleo flutuante e o ponteiro
app/pointer.html       a faísca que voa até um lugar na tela
src/                   a interface (React + SVG escrito à mão)
site/                  o site do projeto
```

## Uma nota sobre o idioma do código

A interface fala cinco idiomas. O código fala um: identificadores e comentários
estão em inglês, e os comentários explicam o *porquê* — quase todos em `native/`
e em `app/main.cjs` existem porque o macOS puniu uma ideia razoável. Pull
requests em português ou inglês são bem-vindos.

## Licença

MIT.
