# MagoScout: planejamento

App de scout de futsal para o técnico Raul. Substitui e amplia uma planilha Excel
com botões (registro manual de ações durante o jogo), adicionando histórico
persistente e gráficos de desempenho.

Iniciado em 10/08/2026.

---

## Origem: a planilha atual

Três abas:

| Aba | Conteúdo | Limitação |
|-----|----------|-----------|
| **Scout** | 1 linha por jogador (01 a 15) × 9 botões de ação + cronômetro de tempo em quadra + 4 botões coletivos (lateral e escanteio, ofensivo/defensivo) | Registro ao vivo, exige Excel |
| **Info** | Contadores da partida + linha de totais + botão LIMPAR | **O LIMPAR apaga o histórico** |
| **Total** | Agregado com aproveitamento (% certa de finalização, drible, passe) | Sem evolução ao longo dos jogos |

Ações da planilha: Finalização Certa/Errada, Drible Certo/Errado, Passe
Certo/Errado, Bola Roubada, Falta, Defesa. Coletivas: Lateral Of./Def.,
Escanteio Of./Def.

---

## O que a planilha original revelou

Arquivo analisado: `OldRaulScout.xlsx` (recebido em 10/08/2026).

**A planilha inteira tem 10 fórmulas.** Só existem três tipos:

| Onde | Fórmula | O que faz |
|------|---------|-----------|
| Info L17 | `=SUM(B2:B16)` | total de cada ação |
| Total D/G/J | `=SUM(B2*100)/(B2+C2)` | % de acerto de finalização, drible e passe |
| Total L22 | `=SUM(B2:B21)` | total geral |

Consequências:

1. **Não existe cálculo de posse de bola nem de ritmo de jogo.** A premissa do
   briefing inicial estava errada: isso nunca foi implementado. Vira feature
   nova a definir com o Raul, não uma fórmula a portar.
2. **Nenhuma fórmula cruza abas.** A passagem Info → Total é manual. Confirma
   que não há histórico automatizado: o LIMPAR zera e o que não foi copiado se
   perde.
3. **As macros não vieram.** Os 139 botões chamam `Botao10_1`, `Botao11_2` etc.,
   mas o arquivo é `.xlsx`, que não guarda VBA, então não há `vbaProject.bin`. Os
   botões estão inertes. Não bloqueia nada: a lógica é somar 1 na célula.
4. **A coluna Tempo está zerada e sem fórmula** nas três abas. Formato de hora.
   Como era alimentada, não dá para saber sem o `.xlsm`.
5. **Nada de gol, cartão, assistência, adversário, placar, data ou período.**
   Confirma que tudo isso é decisão nova.
6. **Nenhum gráfico no arquivo:** a análise visual é 100% novidade.

Estrutura confirmada das abas (ordem real das colunas):

- **Scout** `A:N`: Nome, 9 ações, Tempo, 3 colunas sobrando (`Coluna1..3`),
  15 linhas de jogador. Zero fórmulas: é só a grade de botões.
- **Info** `A:O`: Nome, 9 ações, Tempo, Lat.Of, Lat.Def, Esc.Of, Esc.Def,
  15 jogadores + linha Total. Lateral e escanteio existem só no nível do time.
- **Total** `A:R`: igual à Info mais três colunas de %, com 20 linhas de jogador.

Elenco extraído (14 nomes, prontos para semear o cadastro): João Levote, Vitor
Damasceno, Felipe Evangelista, Ryan Henrique, Paulo Henrique, Vitor Betiol,
Arthur Rodrigues, Matheus Henrique, Carlos Daniel, Vinicius de Oliveira, Marcus
Vinicius, Vinicius Cypriano, José Pedro, Raul Gustavo.

**Sem histórico a importar.** Decisão do Saker em 10/08/2026: começa zerado.

---

## Decisões fechadas

- **Nome:** MagoScout. **Cor:** azul (tom a definir com o Raul).
- **Formato:** PWA, instalável em Android e iPhone, um código só, sem loja.
- **Stack:** HTML/CSS/JS vanilla + PHP (PDO) + MySQL. Sem framework, sem build step.
- **Gráficos:** ~~Chart.js~~ → **módulo próprio em canvas 2D** (`js/grafico.js`).
  Trocado em 11/08/2026, com aval do Saker: a mesma função desenha a tela e o
  PNG do relatório, e o app segue sem dependência externa, o que num PWA
  offline em host grátis vale mais que tooltip pronto.
- **Offline-first:** IndexedDB local + fila de sincronização.
- **Backend desde o início**, mas tela de login só na fase 4.
- **IA fica para o final** (fase 5).
- **Dev local:** XAMPP2 (MariaDB 10.4).

Escopo decidido pelo Saker em 10/08/2026, sem precisar perguntar ao Raul:

- **Sem posse de bola e sem ritmo de jogo.** Não serão calculados.
- **Só o time do Raul.** Nenhuma ação do adversário é registrada.
- **Lateral e escanteio ficam no nível do time**, sem jogador associado.
- **Um único time/categoria.** O modelo de dados mantém a tabela de time para
  não fechar a porta, mas a interface não expõe troca de equipe.
- **App entregue com o cadastro vazio.** Os 14 nomes extraídos da planilha
  ficam registrados aqui e só são semeados se o Raul pedir.
- **Undo durante o jogo entra por padrão**, sem perguntar.
- **Sem limite de jogadores no elenco.** A tela de scout precisa aguentar
  qualquer tamanho de lista, o que reforça a opção de mostrar só quem está em
  quadra na tela principal (pergunta 17 da entrevista).

## Hospedagem

Decidido em 11/08/2026: **InfinityFree** para desenvolvimento, testes e a
apresentação. A hospedagem definitiva fica para uma conversa posterior com o
Raul: se ele quiser bancar, migra-se para um host pago.

Consequência de projeto: **nada pode depender do host**. Credenciais e URL base
ficam num único `config.php`; sem cron, sem WebSocket, sem extensão PHP exótica,
só PDO e MySQL. Trocar de servidor tem que ser editar um arquivo.

Riscos a verificar **antes** de construir em cima (ver "Smoke test" abaixo):

- HTTPS no InfinityFree exige emitir o certificado à mão. Sem HTTPS não existe
  service worker, e sem service worker não existe PWA offline.
- Hospedagem grátis costuma barrar conexões de saída (`curl` para fora). Se for
  o caso, a IA da fase 5 não roda a partir do servidor gratuito.
- Camada anti-bot pode interferir em requisição que não venha de navegador.

Nenhum desses pontos está confirmado: são padrões de hospedagem gratuita que
precisam ser testados neste host específico.

---

## Arquitetura: event sourcing

Cada toque de botão vira um evento imutável, não um incremento de contador:

```
evento { uuid, partida_id, jogador_id (nullable p/ ações coletivas),
         tipo, minuto, periodo, timestamp, criado_por }
```

UUID gerado no cliente. Consequências:

- **Offline:** grava no IndexedDB primeiro; a UI responde sem esperar a rede.
- **Sync idempotente:** o servidor ignora UUID já existente; reenvio não duplica.
- **Dois scouts na mesma partida:** eventos só empilham, sem conflito.
- **Ritmo de jogo:** o minuto em cada evento entrega o gráfico temporal de graça.
- **Undo:** evento de anulação (ou soft delete), sem corrigir contador.

Contadores, percentuais e as visões "Info" e "Total" da planilha são
agregações (`COUNT`/`SUM`) sobre essa tabela.

**Realtime:** hospedagem PHP compartilhada não suporta WebSocket bem. Como os
eventos são append-only, polling de 3 a 5s é suficiente para 2 scouts simultâneos.

---

## Fases

| Fase | Entrega | Resultado |
|------|---------|-----------|
| 0a | **Smoke test do host**: página HTTPS + endpoint PHP + INSERT/SELECT no MySQL | ⏳ arquivos prontos em `smoke/`, **ainda não rodado no host** |
| 0 | Schema MySQL + API PHP + login da comissão | ✅ feito em 12/08, junto com a fase 4 |
| 1 | Elenco, partida, substituição e tela de scout offline | **Já substitui a planilha** |
| 2 | Histórico + totais + 1º contra 2º tempo | ✅ feito em 11/08. Recupera o que o LIMPAR apagava |
| 3 | Gráficos e relatório em imagem | ✅ feito em 11/08. **A novidade principal** |
| 4 | Login da comissão, sincronização e acesso somente-leitura dos jogadores | ✅ feito em 12/08. Pedido na entrevista |
| 5 | IA de dicas de treino/tática | Bônus |

Revisado em 11/08/2026 com as respostas da entrevista: o login da comissão subiu
para a fase 0 (ele quer usar em mais de um celular) e a substituição entrou na
fase 1 por ser pré-requisito do cronômetro e da comparação por minuto.

---

## Entrevista: concluída

33 perguntas respondidas pelo Raul em 11/08/2026, via `Entrevista-Raul.html`.
O que o app faz está em **`ESPECIFICACAO.md`**. Resumo do que as respostas
mudaram neste plano:

1. **Login virou estrutural, não bônus.** Ele quer acessar de vários celulares e
   quer que os jogadores vejam (só vejam) as estatísticas. Dois perfis desde o
   começo. A fase 4 deixa de ser opcional.
2. **Substituição virou caminho crítico.** Ela alimenta o cronômetro, a tela de
   scout (só os 5 em quadra) e a comparação por minuto jogado. Se ela falhar,
   três funcionalidades caem juntas.
3. **Split 1º/2º tempo é núcleo**, não refinamento: é a primeira coisa que ele
   abre depois do jogo.
4. **A lista de eventos foi de 9 para 20**, e o goleiro tem conjunto próprio de
   botões. Valida a escolha de event sourcing com tabela de tipos.
5. **Relatório é imagem**, não PDF. E não exporta Excel.
6. **Hospedagem virou obrigatória:** multi-dispositivo e acesso dos jogadores
   não funcionam sem servidor.

### Ainda em aberto

- Validar o layout da tela de scout com o Raul operando de verdade.

### Feito

**Schema** (`app/banco/schema.sql`): 8 tabelas. `evento` e `passagem` com UUID
gerado no cliente; `tipo_evento` como tabela em vez de ENUM, para ação nova
virar INSERT e não migração.

**Fluxo completo da fase 1**, tudo offline sobre IndexedDB, sem servidor:
`index.html` (retomar jogo aberto, histórico) → `elenco.html` (cadastro, com
desfazer na exclusão) → `partida.html` (dados do jogo e convocação) →
`scout.html` (o jogo) → encerrar e voltar ao histórico.

**Chaves UUID em tudo que nasce no celular:** jogador, partida, convocação,
evento e passagem. O treinador cria partida e monta relação dentro do ginásio,
sem rede; quem cria offline precisa gerar o próprio identificador.

**Tela de scout** (`app/scout.html`):

- Resolvido o problema dos botões: 5 cards grandes, com **passe certo e errado
  direto no card** (as duas ações de maior volume, um toque) e as outras 10
  atrás de um toque no nome do jogador. O painel filtra por posição: goleiro
  vê 16 ações, jogador de linha vê 12.
- Cronômetro por timestamp, não por contagem de tiques: sobrevive à tela
  apagando, ao segundo plano e a fechar o app no intervalo.
- Substituição fecha e abre `passagem`, que é a fonte do tempo em quadra.
- Undo marca `anulado`, não apaga.
- Goleiro fixo no topo da lista.

**Análise da partida** (`app/analise.html` + `js/estatisticas.js`), fase 2:

- O cálculo mora num arquivo que não conhece tela nem banco. Cada número é um
  balde `{1, 2, total}`, então o recorte por período sai de graça em qualquer
  métrica, e os gráficos da fase 3 e o relatório em imagem vão ler da mesma
  função, em vez de recalcular por conta.
- A tela abre pelo histórico e começa pelo comparativo 1º × 2º tempo, com a
  variação de um tempo para o outro pintada de verde ou vermelho conforme a
  métrica melhora subindo ou descendo.
- Tudo o mais fica atrás de um recorte de período; a ficha do jogador mostra
  uma coluna por tempo e o total, mais a média do time para comparar.
- Aproveitamento sem tentativa nenhuma é `null` e aparece como hífen. A linha
  inteira some da ficha quando o jogador nunca tentou aquilo.

**Gráficos e relatório** (`js/grafico.js`, `js/relatorio.js`, `jogador.html`),
fase 3:

- Um módulo de desenho, dois destinos: a tela e o PNG. O que muda entre eles é
  o contexto e um fator de escala.
- A análise da partida ganhou o gráfico do 1º × 2º tempo e o comparativo dos
  jogadores com a média do time, com seletor de métrica.
- `jogador.html` responde as duas comparações que faltavam: contra a média do
  time e contra ele mesmo, jogo a jogo, com variação típica como medida de
  regularidade.
- O relatório é 1080×1350 (4:5, o retrato que o WhatsApp não corta), ~575 KB.
  Compartilha pela bandeja do sistema quando o aparelho oferece `navigator.share`,
  baixa quando não.
- Métrica de soma (gols, faltas, minutos) tem a referência do time dividida por
  quem esteve em quadra; taxa e percentual entram direto. Sem isso, comparar um
  jogador com "o time" era comparar com a soma de seis pessoas.

**Servidor, sincronização e acesso** (`app/api/`, `js/api.js`, `js/sync.js`,
`login.html`, `publico.html`), fases 0 e 4:

- API em PHP + PDO, sem framework e sem nada exótico: seis arquivos, um deles
  só de configuração. Trocar de host é editar `api/config.php`.
- Sincronização nos dois sentidos numa chamada. O carimbo é do servidor
  (`recebido_em` em cada tabela); o cliente só repete o que recebeu. Como tudo
  tem UUID do cliente, reenviar é inofensivo, e é por isso que a fila pode
  simplesmente tentar de novo quando a rede voltar.
- O relógio do jogo não sincroniza: é do aparelho que está apitando.
- Remoção de jogador vira `ativo = 0`. Sem isso, apagar num celular não teria
  como apagar no outro, e o histórico perderia o dono dos eventos antigos.
- Instalador de primeiro acesso que se tranca assim que existe uma conta.
- Link público por token de 32 caracteres, `noindex` no HTML e no cabeçalho
  HTTP, teto de 20 jogos no payload.
- Ranking com critério trocável, lendo o mesmo catálogo de métricas da análise.

Rodar local: `preview_start` com a configuração `magoscout`
(PHP embutido na porta 8755, definida em `.claude/launch.json`); `magoscout-2`
na 8756 é o reserva para quando duas sessões rodam o app ao mesmo tempo.

Resolvido em 11/08/2026: acesso do jogador por link público somente-leitura, e
ranking com botão para trocar o critério.
