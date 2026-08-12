<?php
// Sincronização nos dois sentidos, numa chamada só.
//
// O celular manda o que criou offline e recebe o que mudou desde a última vez.
// Duas garantias sustentam isso:
//
// 1. Tudo tem UUID gerado no cliente, então subir a mesma fila duas vezes não
//    duplica nada — o INSERT vira UPDATE do mesmo registro.
// 2. O relógio que manda é o do servidor (`recebido_em`). O celular nunca
//    compara datas próprias com as de outro aparelho: ele guarda o carimbo que
//    o servidor devolveu e usa esse na próxima pergunta.

declare(strict_types=1);

require __DIR__ . '/comum.php';
exigirMetodo('POST');

$usuario = exigirLogin();
$timeId = $usuario['time_id'];
$pdo = banco();
$dados = corpo();

// Lido antes de gravar qualquer coisa: o que este mesmo lote escrever entra na
// resposta como novidade, o que é inofensivo (idempotente) e evita a janela em
// que uma escrita concorrente cairia entre a gravação e a leitura.
$agora = $pdo->query('SELECT NOW()')->fetchColumn();
$desde = (string) ($dados['desde'] ?? '');
if ($desde === '' || !preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $desde)) {
    $desde = '1970-01-01 00:00:00';
}

function lista($valor): array
{
    return is_array($valor) ? $valor : [];
}

function texto($v, int $limite): ?string
{
    if ($v === null) {
        return null;
    }
    $s = trim((string) $v);
    return $s === '' ? null : mb_substr($s, 0, $limite);
}

function dataHora($v): string
{
    $s = (string) $v;
    return preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $s) ? $s : date('Y-m-d H:i:s');
}

function uuidValido($v): bool
{
    return is_string($v) && preg_match('/^[0-9a-fA-F-]{36}$/', $v) === 1;
}

$aceitos = ['jogadores' => 0, 'partidas' => 0, 'convocacoes' => 0, 'eventos' => 0, 'passagens' => 0];

try {
    $pdo->beginTransaction();

    // -------------------------------------------------- jogadores
    $st = $pdo->prepare(
        'INSERT INTO jogador (uuid, time_id, numero, nome, posicao, ativo, criado_em)
         VALUES (:uuid, :time_id, :numero, :nome, :posicao, :ativo, :criado_em)
         ON DUPLICATE KEY UPDATE
            numero = VALUES(numero), nome = VALUES(nome),
            posicao = VALUES(posicao), ativo = VALUES(ativo)'
    );
    foreach (lista($dados['jogadores'] ?? null) as $j) {
        if (!uuidValido($j['uuid'] ?? null) || texto($j['nome'] ?? null, 80) === null) {
            continue;
        }
        if (!in_array($j['posicao'] ?? '', ['goleiro', 'fixo', 'ala', 'pivo'], true)) {
            continue;
        }
        $st->execute([
            'uuid' => $j['uuid'],
            'time_id' => $timeId,
            'numero' => isset($j['numero']) && $j['numero'] !== null && $j['numero'] !== ''
                ? (int) $j['numero'] : null,
            'nome' => texto($j['nome'], 80),
            'posicao' => $j['posicao'],
            'ativo' => empty($j['ativo']) ? 0 : 1,
            'criado_em' => dataHora($j['criado_em'] ?? null),
        ]);
        $aceitos['jogadores']++;
    }

    // -------------------------------------------------- partidas
    $st = $pdo->prepare(
        'INSERT INTO partida (uuid, time_id, adversario, data, campeonato, tipo, periodos,
                              minutos_periodo, gols_pro, gols_contra, status, criado_em, atualizado_em)
         VALUES (:uuid, :time_id, :adversario, :data, :campeonato, :tipo, :periodos,
                 :minutos, :gols_pro, :gols_contra, :status, :criado_em, :atualizado_em)
         ON DUPLICATE KEY UPDATE
            adversario = VALUES(adversario), data = VALUES(data), campeonato = VALUES(campeonato),
            tipo = VALUES(tipo), periodos = VALUES(periodos), minutos_periodo = VALUES(minutos_periodo),
            gols_pro = VALUES(gols_pro), gols_contra = VALUES(gols_contra),
            status = VALUES(status), atualizado_em = VALUES(atualizado_em)'
    );
    foreach (lista($dados['partidas'] ?? null) as $p) {
        if (!uuidValido($p['uuid'] ?? null)) {
            continue;
        }
        $data = (string) ($p['data'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $data)) {
            continue;
        }
        $st->execute([
            'uuid' => $p['uuid'],
            'time_id' => $timeId,
            'adversario' => texto($p['adversario'] ?? null, 80),
            'data' => $data,
            'campeonato' => texto($p['campeonato'] ?? null, 80),
            'tipo' => in_array($p['tipo'] ?? '', ['oficial', 'amistoso', 'treino'], true) ? $p['tipo'] : 'oficial',
            'periodos' => max(1, min(9, (int) ($p['periodos'] ?? 2))),
            'minutos' => max(1, min(60, (int) ($p['minutosPeriodo'] ?? 20))),
            'gols_pro' => isset($p['gols_pro']) && $p['gols_pro'] !== null ? (int) $p['gols_pro'] : null,
            'gols_contra' => isset($p['gols_contra']) && $p['gols_contra'] !== null ? (int) $p['gols_contra'] : null,
            'status' => in_array($p['status'] ?? '', ['rascunho', 'em_andamento', 'encerrada'], true)
                ? $p['status'] : 'em_andamento',
            'criado_em' => dataHora($p['criado_em'] ?? null),
            'atualizado_em' => dataHora($p['atualizado_em'] ?? null),
        ]);
        $aceitos['partidas']++;
    }

    // -------------------------------------------------- convocação
    // Lista fechada por partida: o jeito honesto de refletir uma remoção é
    // apagar a relação e regravá-la.
    $apaga = $pdo->prepare('DELETE FROM convocacao WHERE partida_uuid = ?');
    $poe = $pdo->prepare('INSERT IGNORE INTO convocacao (partida_uuid, jogador_uuid) VALUES (?, ?)');
    foreach (lista($dados['convocacoes'] ?? null) as $c) {
        if (!uuidValido($c['partida_uuid'] ?? null)) {
            continue;
        }
        $apaga->execute([$c['partida_uuid']]);
        foreach (lista($c['jogadores'] ?? null) as $ju) {
            if (uuidValido($ju)) {
                $poe->execute([$c['partida_uuid'], $ju]);
            }
        }
        $aceitos['convocacoes']++;
    }

    // -------------------------------------------------- eventos
    $st = $pdo->prepare(
        'INSERT INTO evento (uuid, partida_uuid, jogador_uuid, tipo, periodo, segundo, anulado, criado_por, criado_em)
         VALUES (:uuid, :partida, :jogador, :tipo, :periodo, :segundo, :anulado, :criado_por, :criado_em)
         ON DUPLICATE KEY UPDATE anulado = VALUES(anulado)'
    );
    foreach (lista($dados['eventos'] ?? null) as $e) {
        if (!uuidValido($e['uuid'] ?? null) || !uuidValido($e['partida_uuid'] ?? null)) {
            continue;
        }
        $st->execute([
            'uuid' => $e['uuid'],
            'partida' => $e['partida_uuid'],
            'jogador' => uuidValido($e['jogador_uuid'] ?? null) ? $e['jogador_uuid'] : null,
            'tipo' => (string) ($e['tipo'] ?? ''),
            'periodo' => max(1, (int) ($e['periodo'] ?? 1)),
            'segundo' => max(0, (int) ($e['segundo'] ?? 0)),
            'anulado' => empty($e['anulado']) ? 0 : 1,
            'criado_por' => $usuario['id'],
            'criado_em' => dataHora($e['criado_em'] ?? null),
        ]);
        $aceitos['eventos']++;
    }

    // -------------------------------------------------- passagens
    $st = $pdo->prepare(
        'INSERT INTO passagem (uuid, partida_uuid, jogador_uuid, periodo, entrou, saiu, criado_em)
         VALUES (:uuid, :partida, :jogador, :periodo, :entrou, :saiu, :criado_em)
         ON DUPLICATE KEY UPDATE saiu = VALUES(saiu)'
    );
    foreach (lista($dados['passagens'] ?? null) as $p) {
        if (!uuidValido($p['uuid'] ?? null) || !uuidValido($p['partida_uuid'] ?? null)
            || !uuidValido($p['jogador_uuid'] ?? null)) {
            continue;
        }
        $st->execute([
            'uuid' => $p['uuid'],
            'partida' => $p['partida_uuid'],
            'jogador' => $p['jogador_uuid'],
            'periodo' => max(1, (int) ($p['periodo'] ?? 1)),
            'entrou' => max(0, (int) ($p['entrou'] ?? 0)),
            'saiu' => isset($p['saiu']) && $p['saiu'] !== null ? max(0, (int) $p['saiu']) : null,
            'criado_em' => dataHora($p['criado_em'] ?? null),
        ]);
        $aceitos['passagens']++;
    }

    $pdo->commit();
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('MagoScout: falha sincronizando — ' . $e->getMessage());
    // Nada foi gravado: o cliente mantém a fila e tenta de novo.
    erro('falha gravando o lote', 500);
}

// -------------------------------------------------- o que mudou lá
// `>=` de propósito: reenviar o que já se tem é barato e idempotente, perder
// uma linha gravada no mesmo segundo do último carimbo não seria.

function novidades(PDO $pdo, int $timeId, string $desde): array
{
    $jog = $pdo->prepare('SELECT uuid, numero, nome, posicao, ativo, criado_em
                          FROM jogador WHERE time_id = ? AND recebido_em >= ?');
    $jog->execute([$timeId, $desde]);

    $par = $pdo->prepare('SELECT uuid, adversario, data, campeonato, tipo, periodos,
                                 minutos_periodo AS minutosPeriodo, gols_pro, gols_contra,
                                 status, criado_em, atualizado_em
                          FROM partida WHERE time_id = ? AND recebido_em >= ?');
    $par->execute([$timeId, $desde]);
    $partidas = $par->fetchAll();

    $con = $pdo->prepare('SELECT c.partida_uuid, c.jogador_uuid
                          FROM convocacao c
                          JOIN partida p ON p.uuid = c.partida_uuid
                          WHERE p.time_id = ? AND c.recebido_em >= ?');
    $con->execute([$timeId, $desde]);
    $convocacoes = [];
    foreach ($con->fetchAll() as $linha) {
        $convocacoes[$linha['partida_uuid']][] = $linha['jogador_uuid'];
    }

    $eve = $pdo->prepare('SELECT e.uuid, e.partida_uuid, e.jogador_uuid, e.tipo, e.periodo,
                                 e.segundo, e.anulado, e.criado_em
                          FROM evento e JOIN partida p ON p.uuid = e.partida_uuid
                          WHERE p.time_id = ? AND e.recebido_em >= ?');
    $eve->execute([$timeId, $desde]);

    $pas = $pdo->prepare('SELECT s.uuid, s.partida_uuid, s.jogador_uuid, s.periodo,
                                 s.entrou, s.saiu, s.criado_em
                          FROM passagem s JOIN partida p ON p.uuid = s.partida_uuid
                          WHERE p.time_id = ? AND s.recebido_em >= ?');
    $pas->execute([$timeId, $desde]);

    $listaConv = [];
    foreach ($convocacoes as $partidaUuid => $jogadores) {
        $listaConv[] = ['partida_uuid' => $partidaUuid, 'jogadores' => $jogadores];
    }

    return [
        'jogadores' => $jog->fetchAll(),
        'partidas' => $partidas,
        'convocacoes' => $listaConv,
        'eventos' => $eve->fetchAll(),
        'passagens' => $pas->fetchAll(),
    ];
}

responder([
    'agora' => $agora,
    'aceitos' => $aceitos,
    'novidades' => novidades($pdo, $timeId, $desde),
]);
