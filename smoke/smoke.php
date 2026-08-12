<?php
declare(strict_types=1);

// Diagnóstico do host antes de construir o MagoScout em cima dele.
// GET  -> roda todos os testes de servidor
// POST -> confere se o PHP consegue ler um corpo JSON (é como a API vai receber eventos)
// ?limpar=1 -> derruba a tabela de teste

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');

date_default_timezone_set('America/Sao_Paulo');

$r = ['ok' => true, 'quando' => date('c'), 'checks' => []];

function check(array &$r, string $nome, bool $ok, ?string $detalhe = null, bool $fatal = true): void
{
    $r['checks'][] = ['nome' => $nome, 'ok' => $ok, 'detalhe' => $detalhe];
    if (!$ok && $fatal) {
        $r['ok'] = false;
    }
}

function responde(array $r): void
{
    echo json_encode($r, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

// ---------- 1. PHP ----------

check($r, 'PHP roda e devolve JSON', true, 'versão ' . PHP_VERSION);
check(
    $r,
    'PHP 8 ou superior',
    PHP_VERSION_ID >= 80000,
    PHP_VERSION_ID >= 80000 ? null : 'o host está em PHP ' . PHP_VERSION . ', o código assume 8+'
);

foreach (['pdo_mysql' => true, 'json' => true, 'mbstring' => true, 'curl' => false] as $ext => $fatal) {
    check($r, "Extensão $ext", extension_loaded($ext), null, $fatal);
}

check(
    $r,
    'HTTPS na requisição',
    !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'sem HTTPS não existe service worker, e sem service worker não existe PWA offline'
);

$r['ambiente'] = [
    'timezone'      => date_default_timezone_get(),
    'hora_servidor' => date('Y-m-d H:i:s'),
    'memory_limit'  => ini_get('memory_limit'),
    'post_max_size' => ini_get('post_max_size'),
];

// ---------- 2. Corpo JSON (POST) ----------

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $bruto = file_get_contents('php://input');
    $corpo = json_decode($bruto, true);
    check(
        $r,
        'PHP lê corpo JSON no POST',
        is_array($corpo) && isset($corpo['ping']),
        is_array($corpo) ? 'recebido: ' . json_encode($corpo, JSON_UNESCAPED_UNICODE) : 'corpo veio vazio ou inválido'
    );
    $r['eco'] = $corpo;
}

// ---------- 3. MySQL ----------

require __DIR__ . '/config.php';

if (str_contains($DB['senha'], 'TROQUE_AQUI')) {
    check($r, 'Conexão MySQL', false, 'config.php ainda está com os valores de exemplo');
    responde($r);
}

try {
    $pdo = new PDO(
        "mysql:host={$DB['host']};dbname={$DB['nome']};charset=utf8mb4",
        $DB['usuario'],
        $DB['senha'],
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
    check($r, 'Conexão MySQL', true, 'servidor ' . $pdo->getAttribute(PDO::ATTR_SERVER_VERSION));
} catch (Throwable $e) {
    check($r, 'Conexão MySQL', false, $e->getMessage());
    responde($r);
}

if (isset($_GET['limpar'])) {
    $pdo->exec('DROP TABLE IF EXISTS smoke_evento');
    $r['checks'][] = ['nome' => 'Tabela de teste removida', 'ok' => true, 'detalhe' => null];
    responde($r);
}

try {
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS smoke_evento (
            uuid      CHAR(36)    NOT NULL PRIMARY KEY,
            jogador   VARCHAR(80) NOT NULL,
            criado_em DATETIME    NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    check($r, 'CREATE TABLE', true);
} catch (Throwable $e) {
    check($r, 'CREATE TABLE', false, $e->getMessage());
    responde($r);
}

// O event sourcing depende de transação: a engine tem que ser InnoDB de verdade.
try {
    $eng = $pdo->query(
        "SELECT ENGINE FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'smoke_evento'"
    )->fetchColumn();
    check($r, 'Engine InnoDB', $eng === 'InnoDB', 'engine reportada: ' . var_export($eng, true));
} catch (Throwable $e) {
    check($r, 'Engine InnoDB', false, $e->getMessage(), false);
}

// Nome com acento: o elenco tem José, Vinícius, ação. Tem que voltar idêntico.
$uuid = '11111111-2222-3333-4444-555555555555';
$nome = 'José Pedro (ação nº 1)';

try {
    $ins = $pdo->prepare('INSERT IGNORE INTO smoke_evento (uuid, jogador, criado_em) VALUES (?, ?, NOW())');
    $ins->execute([$uuid, $nome]);
    $primeira = $ins->rowCount();
    $ins->execute([$uuid, $nome]);
    $segunda = $ins->rowCount();

    check($r, 'INSERT grava', $primeira === 1, "linhas afetadas: $primeira");

    // Este é o teste que valida a sincronização: reenviar o mesmo evento não pode duplicar.
    check(
        $r,
        'Reenvio do mesmo UUID não duplica',
        $segunda === 0,
        "segunda tentativa afetou $segunda linha(s)"
    );
} catch (Throwable $e) {
    check($r, 'INSERT grava', false, $e->getMessage());
    responde($r);
}

try {
    $sel = $pdo->prepare('SELECT jogador, criado_em FROM smoke_evento WHERE uuid = ?');
    $sel->execute([$uuid]);
    $linha = $sel->fetch();
    check($r, 'SELECT devolve a linha', $linha !== false);
    check(
        $r,
        'Acento sobrevive (utf8mb4)',
        $linha && $linha['jogador'] === $nome,
        $linha ? 'gravado: ' . $nome . ' | lido: ' . $linha['jogador'] : null
    );
    if ($linha) {
        $r['ambiente']['hora_gravada_no_banco'] = $linha['criado_em'];
    }
} catch (Throwable $e) {
    check($r, 'SELECT devolve a linha', false, $e->getMessage());
}

try {
    $pdo->beginTransaction();
    $pdo->prepare('INSERT INTO smoke_evento (uuid, jogador, criado_em) VALUES (?, ?, NOW())')
        ->execute(['99999999-9999-9999-9999-999999999999', 'rollback', ]);
    $pdo->rollBack();
    $restou = (int) $pdo->query("SELECT COUNT(*) FROM smoke_evento WHERE uuid = '99999999-9999-9999-9999-999999999999'")->fetchColumn();
    check($r, 'Transação faz rollback', $restou === 0, "linhas remanescentes: $restou");
} catch (Throwable $e) {
    check($r, 'Transação faz rollback', false, $e->getMessage(), false);
}

// ---------- 4. Conexão de saída (a IA da fase 5 depende disso) ----------

if (extension_loaded('curl')) {
    $ch = curl_init('https://example.com');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_NOBODY         => true,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);
    curl_exec($ch);
    $codigo = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $erro   = curl_error($ch);
    curl_close($ch);

    check(
        $r,
        'Servidor consegue chamar API externa',
        $codigo >= 200 && $codigo < 400,
        $codigo ? "HTTP $codigo" : ('curl falhou: ' . $erro),
        false // não é fatal: só bloqueia a fase 5
    );
} else {
    check($r, 'Servidor consegue chamar API externa', false, 'sem extensão curl', false);
}

responde($r);
