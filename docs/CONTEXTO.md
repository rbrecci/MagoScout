# MagoScout — contexto para retomar em outra sessão

Última atualização: 12/08/2026. Substitui o `CONTEXTO.md` que ficava na raiz.

App de scout de futsal para o professor Raul, treinador. Substitui uma planilha
Excel de botões e adiciona o que ela nunca teve: histórico que não se perde,
gráficos de desempenho e acesso pelos jogadores.

---

## Onde está cada coisa

```
MagoScout/
├── app/      o aplicativo (é isto que vai para o servidor)
├── docs/     esta pasta — o que o app faz, como e por quê
└── smoke/    diagnóstico do host. Descartável depois de rodado.
```

| Arquivo | Para quê |
|---------|----------|
| `docs/CONTEXTO.md` | **Este arquivo.** Estado, mapa do código, armadilhas e pendências. Comece por aqui. |
| `docs/ESPECIFICACAO.md` | **O que o app faz.** Fechado com as 33 respostas do Raul. Manda em qualquer dúvida de regra. |
| `docs/PLANEJAMENTO.md` | Como e quando: stack, arquitetura, fases, o que a planilha original revelou. |
| `docs/Entrevista-Raul.html` | O questionário respondido. Publicado em `claude.ai/code/artifact/5de1aa74-1ff6-4ac9-9c2d-a97517bcfef6`. |
| `docs/OldRaulScout.xlsx` | A planilha original dele. Já analisada; não precisa reabrir. |

---

## Estado: fases 0 a 4 completas e testadas

Falta só a fase 5 (IA). O app funciona **inteiro offline, sem servidor** — e,
quando há rede e login, sincroniza entre aparelhos.

```
index.html    retomar jogo aberto + histórico + estado da sincronização
elenco.html   cadastro de jogadores (com desfazer na exclusão)
partida.html  dados do jogo + convocação
scout.html    o jogo ao vivo
analise.html  os números da partida (?p=<uuid>, abre pelo histórico)
jogador.html  evolução jogo a jogo (?j=<uuid>, abre pela ficha na análise)
login.html    entrada da comissão — e o primeiro acesso, que cria a conta
publico.html  o link somente-leitura dos jogadores (?t=<token>)
```

### Fase 1 — o jogo ao vivo

Cadastro com ordenação por posição, edição sem duplicar, exclusão com desfazer,
convocação com mínimo de 5, partida com minutos configuráveis, quadra com
goleiro no topo, painel filtrado por posição (16 ações para goleiro, 12 para
linha), gol no placar, undo, substituição, troca de período fechando e
reabrindo passagens, encerramento alimentando o histórico.

**O layout da tela de scout foi aprovado pelo Saker em 11/08.** Pode construir
em cima dele.

### Fase 2 — a análise da partida

`analise.html` abre por qualquer item do histórico. De cima para baixo:

1. **Placar e resumo.**
2. **1º contra 2º tempo** — tabela do time com a variação de um tempo para o
   outro. É a primeira coisa que o Raul pediu para ver, então é a primeira
   coisa da tela.
3. **Recorte de período** (jogo todo · 1º · 2º), que filtra os números do time
   e a lista de jogadores.
4. **Lista de jogadores** com tempo em quadra, ações, ações por minuto e as
   taxas resumidas. Toque abre a ficha completa, com uma coluna por período e o
   total, mais a comparação com a média do time.

### Fase 3 — gráficos e relatório em imagem

**Sem biblioteca de gráfico.** O planejamento previa Chart.js; o Saker aprovou
trocar por um módulo próprio (`js/grafico.js`, canvas 2D) em 11/08. O motivo que
decidiu: a mesma função que desenha na tela desenha o PNG do relatório, que é
canvas de qualquer jeito — e o app continua sem nenhuma dependência externa, o
que num PWA offline hospedado de graça vale mais que tooltip pronto.

- **`js/grafico.js`** — barras agrupadas, barras horizontais com linha de
  referência, linha temporal e legenda. Lê as cores das variáveis do CSS, então
  mudar o tema muda o gráfico.
- **Na análise:** gráfico do 1º × 2º tempo e comparativo dos jogadores com a
  média do time, com seletor de métrica, respeitando o recorte de período.
- **`jogador.html`** — evolução jogo a jogo: linha do jogador contra a média do
  time, médias, **variação típica** (desvio padrão), melhor e pior jogo, a queda
  do 1º para o 2º tempo e a lista de jogos, cada um linkando de volta para a
  análise daquela partida.
- **`js/relatorio.js`** — o PNG de 1080×1350 (4:5, o retrato que o WhatsApp não
  corta) para mandar no grupo. Compartilha pela bandeja do sistema quando o
  aparelho oferece `navigator.share`; baixa quando não.

### Fase 4 — servidor, login e link dos jogadores

A primeira fase que não roda só no celular. API em PHP + PDO, sem framework:

```
app/api/
├── config.php          credenciais e nome do time — NÃO versionado
├── config.exemplo.php  o modelo a copiar
├── comum.php           PDO, sessão, resposta JSON, erro
├── instalar.php        cria banco + schema + a primeira conta; se recusa depois disso
├── login.php · sessao.php   entrar, quem sou eu, sair
├── sync.php            sobe a fila e baixa o que mudou, numa chamada só
└── publico.php         dados do link dos jogadores (somente leitura, por token)
```

**Como a sincronização funciona.** O relógio que manda é o do servidor: cada
tabela tem `recebido_em`, o celular guarda o carimbo que veio na última resposta
e pergunta "o que mudou de lá para cá". Nenhum aparelho compara data própria com
data de outro. Subir a mesma fila duas vezes não duplica nada, porque tudo tem
UUID gerado no cliente e o INSERT vira UPDATE do mesmo registro.

**Quando sincroniza:** ao abrir a tela inicial, quando a rede volta e no botão
`Sincronizar`. Não durante o jogo, de propósito — o scout não pode gastar
bateria e dados a cada toque, e os eventos ficam salvos localmente até o fim da
partida.

**Jogador removido vira inativo, não some.** É a única forma de a remoção
atravessar para o outro celular, e preserva o histórico das partidas antigas. A
tela de elenco lista só os ativos; a análise continua achando os inativos.

---

## Como rodar

```bash
preview_start com {"name": "magoscout"}
```

Sobe o PHP embutido do XAMPP2 na porta 8755 (configuração em
`.claude/launch.json`, na raiz do workspace). Depois abrir
`http://localhost:8755/index.html`. Se outra sessão já estiver segurando a 8755,
existe `magoscout-2` na 8756 com o mesmo diretório.

O banco local já está instalado: base `magoscout` no MariaDB do XAMPP2, com a
conta de teste `raul@magoscout.test` (a senha fica na memória do projeto, fora
do repositório). Se ela se perder, é só `DROP DATABASE magoscout;` e abrir
`login.html`, que volta a oferecer o primeiro acesso.

Para zerar a base do navegador durante testes, no console:

```js
localStorage.clear(); indexedDB.deleteDatabase('magoscout');
```

Para zerar o servidor: `DROP DATABASE magoscout;` e abrir `login.html` de novo,
que volta a oferecer o primeiro acesso.

### Subir para um host

1. Copiar a pasta `app/` inteira para o `htdocs` do host.
2. Criar o banco no painel, copiar `api/config.exemplo.php` para
   `api/config.php` e preencher. Com HTTPS emitido, virar `'https' => true`.
3. Abrir `login.html`: como não existe usuário, ela mostra o formulário de
   primeiro acesso. Criar a conta ali.
4. Copiar o link dos jogadores na tela inicial e mandar no grupo.

---

## Mapa do código

```
app/
├── index.html · elenco.html · partida.html · scout.html
├── analise.html · jogador.html · login.html · publico.html
├── css/magoscout.css       tema azul, alvos de toque grandes
├── api/                    PHP + PDO (ver fase 4)
├── banco/schema.sql        8 tabelas, MySQL/InnoDB (+ .htaccess que barra download)
└── js/
    ├── tipos.js         catálogo das 20 ações (espelha tipo_evento no SQL)
    ├── db.js            IndexedDB puro, versão 3
    ├── dados.js         camada que as telas usam (nunca chamam DB direto)
    ├── estatisticas.js  agrega eventos em números; não toca em tela nem banco
    ├── grafico.js       desenho em canvas 2D; serve tela e relatório
    ├── relatorio.js     o PNG 1080×1350 do jogo
    ├── api.js           o único arquivo que sabe que existe um servidor
    ├── sync.js          a fila: sobe o pendente, aplica o que veio
    ├── inicio.js · elenco.js · partida.js · scout.js
    ├── analise.js · jogador.js · login.js · publico.js
```

---

## Decisões que o código não explica sozinho

**Event sourcing.** Cada toque vira uma linha imutável em `evento`, nunca um
contador incrementado. É o que dá, de uma vez: offline, reenvio idempotente
(mesmo UUID não duplica), gráfico por minuto e undo sem corrigir totais.

**UUID em tudo que nasce no celular** (jogador, partida, convocação, evento,
passagem). O Raul cria partida dentro do ginásio, sem rede. Só `time_futsal` e
`usuario` usam AUTO_INCREMENT, porque só nascem online.

**`tipo_evento` é tabela, não ENUM.** Ação nova vira INSERT, não migração. O
Raul respondeu que prefere pedir a criar sozinho, mas o custo de deixar assim
foi zero.

**Passe certo e errado ficam no card; as outras 10 ações num painel.** São as
duas de maior volume num jogo de futsal. Foi como resolvi o problema de 5
jogadores × 12 ações não caberem numa tela com "botões grandes".

**Goleiro sempre no topo da quadra.** Posição fixa deixa o dedo acertar sem ler.

**`estatisticas.js` não conhece tela nem banco.** Recebe partida, eventos,
passagens e elenco; devolve números. A análise, os gráficos, o relatório e o
ranking público leem da mesma função — é o que garante que os quatro nunca
discordem entre si.

**Percentual sem tentativa é `null`, e a tela mostra "—".** Zero por cento e
"não tentou" são conversas diferentes com o jogador.

**Média do time só compara com jogador quando é taxa.** Em métrica de soma
(gols, faltas, minutos) o número do time é o total do elenco — pôr um jogador ao
lado do total dos seis não compara nada. `referenciaDoTime()` divide pelo número
de quem esteve em quadra; para taxa e percentual devolve o valor direto.

**`acoes` e `acoesJogadores` são coisas diferentes.** A primeira conta tudo que
foi registrado no jogo, inclusive lateral e escanteio, que não têm dono — é o
número da tela ("185 ações"). A segunda deixa os coletivos de fora e é a que
vale como régua de "ações por minuto", senão o time aparece mais produtivo do
que qualquer um dos seus jogadores.

**Passagem sem `saiu` vale até o fim conhecido do período**: o cronômetro salvo
na partida, se for o período corrente; senão a duração cheia. Acontece quando o
app é fechado no meio do jogo. Sem isso o tempo em quadra do sujeito ficaria
zero e derrubaria junto todo o "por minuto" dele.

**O cronômetro é do aparelho, não do servidor.** Período corrente, `base` e
`desde` não viajam na sincronização: só um scout registra por vez, e a partida
que chega de fora não pode zerar o relógio de quem está apitando o jogo.

**Instalador que se tranca sozinho.** `instalar.php` só funciona enquanto não
existe usuário nenhum. Essa é toda a proteção dele, e basta porque a janela dura
o tempo entre subir os arquivos e criar a conta.

**O ranking público tem botão de trocar o critério.** A intenção é deliberada:
não responde "quem é o melhor", responde "quem mais faz isso". Nenhuma métrica é
a padrão privilegiada, e a troca fica à vista.

---

## Armadilhas já encontradas (não repetir)

1. **IndexedDB não migra keyPath de índice.** Ao trocar `partida_id` por
   `partida_uuid`, o índice antigo continuou apontando para o campo velho e
   passou a devolver **lista vazia sem erro nenhum** — o histórico mostrava
   "0 ações" numa partida com eventos. Ao mexer em chave, derrube e recrie a
   loja, e suba `VERSAO` em `db.js`.
2. **Cronômetro é timestamp, não contagem de tiques.** `base` guarda o acumulado
   até a pausa, `desde` o instante em que voltou a correr. Contar tiques
   quebrava quando a tela do celular apagava, e ao reabrir o app o tempo em
   quadra ficava negativo — corrompendo justamente o dado da comparação por
   minuto.
3. **Não reconstruir os cards a cada segundo.** `renderTempos()` mexe só no
   texto. Trocar o DOM inteiro cancelaria o toque em curso.
4. **`var` não iça o valor, só a declaração.** Um `terminou` declarado abaixo do
   bloco que o usava quebrou só no caminho de erro, que era justamente o que
   aquele código existia para detectar.
5. **Canvas falha calado.** Erro de coordenada não levanta exceção: desenha fora
   da área e o console fica limpo. Para conferir gráfico, varra os pixels
   (contar tinta por faixa de linha) em vez de confiar no "sem erro" — foi assim
   que apareceu a legenda por cima da linha de números no relatório.
6. **Canvas não redimensiona sozinho.** Trocar a largura do elemento não
   redesenha nada, e mudar `width`/`height` apaga o conteúdo. As telas
   redesenham no `resize` com um respiro de 150 ms.
7. **PHP não pode cuspir HTML no meio de um JSON.** `display_errors` fica
   desligado na API e todo erro sai como JSON; do lado do cliente, `api.js`
   traduz "resposta que não é JSON" para uma mensagem legível, em vez de
   "token inesperado <".

---

## Verificações já feitas

Nenhuma delas por screenshot: o painel do navegador esteve oculto nas sessões,
então a conferência foi por DOM, varredura de pixels do canvas, consulta ao
MySQL e chamadas diretas à API.

| Quando | O que foi verificado |
|--------|----------------------|
| 11/08 | Fase 1 inteira no navegador; console limpo. |
| 11/08 | Fase 2 com uma partida semeada de 271 eventos e 12 passagens (uma anulada, duas substituições): totais, percentuais, tempo por período, filtro, ficha do goleiro e partida sem nenhum evento. |
| 11/08 | Fase 3 com 5 partidas semeadas (1.741 eventos, elenco de 6, um jogador relacionado sem entrar em quadra): gráficos redesenhando ao trocar métrica, período e ao girar a tela; os 5 relatórios sem nada fora da margem e sem faixas sobrepostas. |
| 12/08 | Fase 4 com dois "aparelhos" (duas origens, cada uma com IndexedDB e cookie próprios): instalação, recusa da segunda instalação (409), senha errada e e-mail inexistente com a mesma resposta (401), sync exigindo sessão, 1.815 registros numa tacada, aparelho B partindo do zero e recebendo 1.822, ida e volta de jogador novo e de undo, remoção virando inativo nos dois lados, offline mantendo a fila e subindo ao voltar, link público rejeitando token inválido (404) e servindo `X-Robots-Tag: noindex`. |

---

## Pendências

### Bloqueadas em terceiros

- **Smoke test nunca foi rodado.** Os arquivos estão em `smoke/` e o host é
  `https://magoscout.infinityfreeapp.com`. Falta o Saker preencher o
  `config.php` (copiando o `config.exemplo.php`), emitir o SSL no painel e subir
  para `htdocs/smoke/`. Ele agora trava três coisas: **PWA offline** (precisa de
  HTTPS), o **`'https' => true`** no `api/config.php` e a **IA da fase 5 rodando
  no servidor** (precisa de conexão de saída — se não houver, a chamada tem que
  sair do navegador).
- **Hospedagem definitiva.** InfinityFree é só para teste e apresentação. O Raul
  ainda vai decidir se banca um host pago. Por isso: credenciais e URL base num
  único `config.php`, sem cron, sem WebSocket, sem extensão exótica.
- **Escudo do time.** Ele disse que tem e vai mandar. O banco já tem a coluna.
- **Validar a tela de scout com o Raul operando de verdade.**

### Próximo passo natural: fase 5 (IA)

Sugerir o que treinar na semana, ajuste tático para o intervalo, análise escrita
do jogo e quem está caindo de rendimento. `Estatisticas.temporada()` já entrega
o agregado que a IA precisa ler.

### Pontas soltas conhecidas

- **PWA de verdade**: manifest e service worker. Só valem com HTTPS.
- **Apagar partida não existe** em lugar nenhum, nem na tela nem na
  sincronização. Se um dia existir, vai precisar de marca de exclusão: hoje, o
  que some de um aparelho continua no outro (o caminho de jogador, que usa
  `ativo = 0`, é o modelo a seguir).
- **`jogador.html` só é alcançável** pela ficha do jogador dentro da análise de
  uma partida. Se o Raul quiser abrir a evolução direto, o item do elenco vira
  link.
- **O link público mostra os últimos 20 jogos**, por causa do tamanho do
  download no celular do atleta. Passando disso, vai precisar paginar.
- **Trocar a senha e cadastrar um segundo membro da comissão** ainda não têm
  tela; hoje só existe a conta criada no primeiro acesso.

---

## Detalhes que valem lembrar na hora de mexer na análise

- Aproveitamento de finalização inclui o gol:
  `(gol + certa) / (gol + certa + errada)`. Drible e passe seguem
  `certo / (certo + errado)`, como na planilha original.
- Tudo é comparado **por minuto jogado** — decisão do Raul. Vem de `passagem`,
  somando `saiu - entrou`.
- "Regularidade" para ele são **as duas coisas**: constância entre jogos e
  constância do 1º para o 2º tempo. A primeira virou a variação típica (desvio
  padrão) em `jogador.html`; a segunda, a linha "do 1º para o 2º tempo".
- Relatório é **imagem** para mandar no grupo. Não é PDF, e não exporta Excel.
