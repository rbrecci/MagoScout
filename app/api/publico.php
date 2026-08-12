<?php
// Dados do link público dos jogadores. Somente leitura, sem conta e sem senha:
// o token longo na URL é o obstáculo, e é por isso que a página vai com
// noindex, porque são nomes de menores com dados de desempenho e não podem cair em
// buscador.

declare(strict_types=1);

require __DIR__ . '/comum.php';

header('X-Robots-Tag: noindex, nofollow');

$token = (string) ($_GET['t'] ?? '');
if (!preg_match('/^[0-9a-f]{32}$/', $token)) {
    erro('link inválido', 404);
}

$pdo = banco();
$st = $pdo->prepare('SELECT id, nome, escudo FROM time_futsal WHERE token_publico = ?');
$st->execute([$token]);
$time = $st->fetch();
if (!$time) {
    // Mesma resposta de token malformado: não confirma se um token existe.
    erro('link inválido', 404);
}

$timeId = (int) $time['id'];

// Teto de partidas: o payload cresce com o histórico e quem abre isto está no
// celular, provavelmente com dados móveis.
$LIMITE = 20;

$st = $pdo->prepare('SELECT uuid, adversario, data, campeonato, tipo, periodos,
                            minutos_periodo AS minutosPeriodo, gols_pro, gols_contra,
                            status, criado_em, atualizado_em
                     FROM partida
                     WHERE time_id = ? AND status = "encerrada"
                     ORDER BY data DESC, criado_em DESC
                     LIMIT ' . $LIMITE);
$st->execute([$timeId]);
$partidas = $st->fetchAll();

if (!$partidas) {
    responder([
        'time' => ['nome' => $time['nome'], 'escudo' => $time['escudo']],
        'jogadores' => [],
        'partidas' => [],
        'convocacoes' => [],
        'eventos' => [],
        'passagens' => [],
    ]);
}

$uuids = array_column($partidas, 'uuid');
$marcas = implode(',', array_fill(0, count($uuids), '?'));

$st = $pdo->prepare('SELECT uuid, numero, nome, posicao, ativo, criado_em
                     FROM jogador WHERE time_id = ? ORDER BY nome');
$st->execute([$timeId]);
$jogadores = $st->fetchAll();

$st = $pdo->prepare("SELECT partida_uuid, jogador_uuid FROM convocacao WHERE partida_uuid IN ($marcas)");
$st->execute($uuids);
$porPartida = [];
foreach ($st->fetchAll() as $linha) {
    $porPartida[$linha['partida_uuid']][] = $linha['jogador_uuid'];
}
$convocacoes = [];
foreach ($porPartida as $partidaUuid => $lista) {
    $convocacoes[] = ['partida_uuid' => $partidaUuid, 'jogadores' => $lista];
}

$st = $pdo->prepare("SELECT uuid, partida_uuid, jogador_uuid, tipo, periodo, segundo, anulado, criado_em
                     FROM evento WHERE partida_uuid IN ($marcas) AND anulado = 0");
$st->execute($uuids);
$eventos = $st->fetchAll();

$st = $pdo->prepare("SELECT uuid, partida_uuid, jogador_uuid, periodo, entrou, saiu, criado_em
                     FROM passagem WHERE partida_uuid IN ($marcas)");
$st->execute($uuids);
$passagens = $st->fetchAll();

responder([
    'time' => ['nome' => $time['nome'], 'escudo' => $time['escudo']],
    'jogadores' => $jogadores,
    'partidas' => $partidas,
    'convocacoes' => $convocacoes,
    'eventos' => $eventos,
    'passagens' => $passagens,
]);
