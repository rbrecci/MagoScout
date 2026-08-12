# MagoScout: especificação funcional

Fechada com as respostas do Raul em 11/08/2026 (entrevista de 33 perguntas,
`Entrevista-Raul.html`). Este documento manda no que o app faz; o
`PLANEJAMENTO.md` manda no como e no quando.

---

## Identidade

- Time: **União Mauá Futsal**, mas o nome tem que ser **editável**, porque ele cogita
  usar em outro time.
- Escudo: ele tem e vai mandar.
- Azul vivo, mais claro (a família do `#2E9BE0`).

---

## Eventos registrados

### Jogador de linha (12)

| Evento | Par | Observação |
|--------|-----|------------|
| Gol | (sem par) | botão próprio, separado do chute |
| Finalização certa | Finalização errada | "certa" = no alvo sem gol |
| Drible certo | Drible errado | |
| Passe certo | Passe errado | |
| Bola roubada | (sem par) | sem contrário, decidido |
| Falta cometida | Falta sofrida | botões separados |
| Cartão amarelo | Cartão vermelho | |

### Goleiro (4, além dos de linha)

Defesa, gol sofrido, reposição certa, reposição errada. O botão "Defesa" é
exclusivo do goleiro. O conjunto de botões é definido pela **posição** cadastrada
no jogador.

### Time (4)

Lateral ofensivo, lateral defensivo, escanteio ofensivo, escanteio defensivo.
Sem jogador associado.

**Fora de escopo, decidido:** assistência, contador coletivo de faltas (regra das
5), posse de bola, ritmo de jogo, qualquer ação do adversário. Ações novas não
são criáveis pelo Raul: ele pede e nós implementamos.

### Aproveitamento

`% finalização = (gol + certa) × 100 / (gol + certa + errada)`.
Drible e passe seguem a fórmula da planilha original: `certo × 100 / (certo + errado)`.

---

## Partida

Guarda: **placar, data, campeonato e tipo** (oficial, amistoso ou treino).
Nome do adversário não foi marcado, então entra como campo opcional.

O placar sai dos eventos (gol nosso, gol sofrido do goleiro) e pode ser corrigido
na mão.

### Cronômetro

- Cronômetro do jogo dentro do app, com **play e pause**.
- Padrão 2×20, mas a **duração do tempo é configurável** (2×18, 2×16), pedido
  explícito dele.
- Estatísticas **separadas por 1º e 2º tempo**. Não é opcional: é a primeira
  coisa que ele quer ver depois do jogo.

### Tempo em quadra

Automático por **substituição**: ele marca quem entra e quem sai, o app cronometra
os que estão em quadra. Alimenta a comparação por minuto jogado.

---

## Elenco

- Ficha do jogador: **número, nome e posição** (goleiro, fixo, ala, pivô). Sem
  foto, sem pé dominante, sem data de nascimento.
- **Relação por jogo**: ele monta a lista de convocados a cada partida.
- **Sem limite de tamanho** de elenco.
- App entregue com cadastro vazio.

---

## Tela de scout

**Só os 5 que estão em quadra, com botões grandes.** A troca do que aparece na
tela é consequência da substituição.

Undo do último registro é obrigatório.

Um scout por vez (uma pessoa registrando).

---

## Análise

Ordem de importância declarada:

1. **1º tempo contra 2º tempo:** a primeira coisa que ele abre.
2. Jogador contra a **média do time**.
3. Jogador contra **ele mesmo, jogo a jogo**.

- **Normalizado por minuto jogado**, decisão dele, e é o que torna a
  substituição caminho crítico.
- **Regularidade = as duas coisas**: constância entre jogos e constância do 1º
  para o 2º tempo.
- Decisões que os gráficos precisam sustentar: o que treinar na semana, quem
  está evoluindo ou caindo, ajuste tático no intervalo, conversa individual.
- **Relatório = imagem** para mandar no grupo. Não é PDF. Não exporta Excel.

---

## Acesso e permissões

Requisito novo, levantado nas perguntas 26 e 33:

| Perfil | Pode |
|--------|------|
| Comissão técnica | tudo: registrar, editar, cadastrar |
| Jogador | **só ver** estatísticas por jogo e o ranking do time |

O Raul também quer **acessar de mais de um celular**. Isso tira o login de
"bônus da fase 4" e torna o backend obrigatório desde cedo.

**Jogador não tem conta.** O acesso é por **link público**, somente leitura.
Sem senha, sem cadastro de atleta, sem suporte técnico para o Raul.
A URL carrega um token longo e aleatório, e a página vai com `noindex` para não
cair em buscador, porque são nomes de menores com dados de desempenho.

**Ranking com critério trocável.** Um botão no canto muda a métrica ordenada.
A intenção é deliberada: o painel não responde "quem é o melhor", responde
"quem mais faz isso". Nenhuma métrica é o padrão privilegiado: a primeira da
lista é só a primeira, e a troca é visível.

---

## IA (última fase)

Ele quer os quatro: sugerir o que treinar na semana, ajuste tático pro intervalo,
análise escrita do jogo, e apontar quem está caindo de rendimento.
