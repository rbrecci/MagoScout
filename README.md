# MagoScout

Scout de futsal para o banco de reservas: registrar o jogo com o polegar, de pé,
sem rede, e depois entender o que aconteceu.

Nasceu para substituir uma planilha Excel de botões usada por um treinador, cuja
tecla **LIMPAR** apagava o histórico inteiro a cada partida. O app resolve isso e
o que vinha junto: comparar 1º e 2º tempo, acompanhar o jogador ao longo dos
jogos e deixar o elenco ver os próprios números.

## O que ele faz

| Tela | Para quê |
|------|----------|
| `index.html` | Retomar o jogo aberto, histórico de partidas, estado da sincronização |
| `elenco.html` | Cadastro do elenco (número, nome, posição), com desfazer na exclusão |
| `partida.html` | Dados do jogo e a relação de convocados |
| `scout.html` | **O jogo ao vivo**: cronômetro, 5 cards grandes, 20 ações, substituição e undo |
| `analise.html` | Os números da partida, começando pelo recorte **1º × 2º tempo** |
| `jogador.html` | Evolução jogo a jogo, contra a média do time e contra ele mesmo |
| `login.html` | Entrada da comissão técnica, e o primeiro acesso, que instala o sistema |
| `publico.html` | Link somente-leitura dos jogadores, com ranking de critério trocável |

Mais o **relatório do jogo em PNG** (1080×1350), para mandar no grupo do time.

## Como funciona

Três decisões explicam quase todo o código.

**Event sourcing.** Cada toque de botão vira uma linha imutável em `evento`, com
UUID gerado no próprio celular, nunca um contador incrementado. É o que entrega,
de uma vez só: funcionar offline, reenviar sem duplicar, desfazer sem corrigir
totais e ter o gráfico por minuto de graça.

**Zero dependência.** Sem framework, sem build step, sem biblioteca de gráfico:
o mesmo módulo de canvas 2D desenha a tela e o PNG do relatório. O app tem que
rodar offline, em hospedagem compartilhada, num celular qualquer.

**O servidor é opcional.** Grava local primeiro e sincroniza depois. Quem resolve
conflito é o relógio do servidor (`recebido_em` em cada tabela); o relógio do
jogo, esse, é do aparelho que está apitando a partida.

## Stack

HTML, CSS e JavaScript sem framework · IndexedDB · PHP 8 com PDO · MySQL/MariaDB.

## Rodar local

Precisa de PHP com `pdo_mysql` e um MySQL ou MariaDB.

```bash
cp app/api/config.exemplo.php app/api/config.php
```

Preencha as credenciais do banco (no XAMPP local: `root`, senha vazia) e suba o
servidor embutido do PHP:

```bash
php -S 127.0.0.1:8755 -t app
```

Abra `http://localhost:8755/login.html`. Como ainda não existe usuário, a tela
oferece o primeiro acesso: ela cria o banco, aplica o schema e registra a conta
da comissão. Depois disso, o instalador se tranca sozinho.

## Subir para um host

1. Copiar a pasta `app/` para o `htdocs`.
2. Criar o banco no painel, copiar `api/config.exemplo.php` para `api/config.php`
   e preencher. Com HTTPS emitido, virar `'https' => true`.
3. Abrir `login.html` e criar a conta no formulário de primeiro acesso.
4. Copiar o link dos jogadores na tela inicial e mandar no grupo.

Nada depende do host: sem cron, sem WebSocket, sem extensão exótica. Trocar de
servidor é editar um arquivo.

## Estrutura

```
MagoScout/
├── app/      o aplicativo (é isto que vai para o servidor)
│   ├── api/     PHP + PDO: instalar, login, sessão, sync, link público
│   ├── banco/   schema.sql, com 8 tabelas em InnoDB e utf8mb4
│   ├── css/     um arquivo
│   └── js/      dados, estatísticas, gráfico, relatório, sync e uma tela por arquivo
├── docs/     documentação
└── smoke/    diagnóstico do host (descartável depois de rodado)
```

## Documentação

- [`docs/CONTEXTO.md`](docs/CONTEXTO.md): **comece por aqui.** Estado, mapa do
  código, decisões que o código não explica sozinho, armadilhas já encontradas
  e pendências.
- [`docs/ESPECIFICACAO.md`](docs/ESPECIFICACAO.md): o que o app faz. Manda em
  qualquer dúvida de regra.
- [`docs/PLANEJAMENTO.md`](docs/PLANEJAMENTO.md): como e quando. Arquitetura,
  fases e o que a planilha original revelou.

## Estado

| Fase | Entrega | |
|------|---------|---|
| 0 | Schema, API PHP e login da comissão | ✅ |
| 1 | Elenco, partida, substituição e scout offline | ✅ |
| 2 | Histórico, totais e 1º contra 2º tempo | ✅ |
| 3 | Gráficos e relatório em imagem | ✅ |
| 4 | Sincronização entre aparelhos e acesso dos jogadores | ✅ |
| 5 | IA de dicas de treino e tática | pendente |

Falta também o PWA (manifest e service worker), que depende de HTTPS confirmado
no host.

## Privacidade

O link dos jogadores é somente leitura e não tem senha: o obstáculo é um token
de 32 caracteres na URL. Como a página mostra nomes de menores com dados de
desempenho, ela vai com `noindex` no HTML e no cabeçalho HTTP, para não cair em
buscador. Quem tem o link vê estatísticas e ranking, e nada mais.

Os arquivos de credencial (`app/api/config.php` e `smoke/config.php`) ficam fora
do versionamento de propósito; o que se versiona são os `config.exemplo.php` ao
lado deles.
