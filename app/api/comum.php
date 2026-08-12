<?php
// Base de todos os endpoints: conexão, sessão, resposta e erro.
// Nenhum endpoint fala com o PDO sem passar por aqui.

declare(strict_types=1);

// Erro de PHP não pode virar HTML no meio de um JSON: o cliente engasga com um
// "<" e não consegue nem dizer o que houve.
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

// `config.php` não é versionado (carrega a senha do banco). Em instalação nova,
// o arquivo simplesmente não existe — e isso precisa dizer o que fazer, não
// morrer com erro de include.
if (!file_exists(__DIR__ . '/config.php')) {
    http_response_code(503);
    echo json_encode([
        'erro' => 'falta o api/config.php — copie o api/config.exemplo.php e preencha as credenciais do banco',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$CONFIG = require __DIR__ . '/config.php';

function responder($dados, int $codigo = 200): void
{
    http_response_code($codigo);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

function erro(string $mensagem, int $codigo = 400): void
{
    responder(['erro' => $mensagem], $codigo);
}

function corpo(): array
{
    $bruto = file_get_contents('php://input');
    if ($bruto === '' || $bruto === false) {
        return [];
    }
    $dados = json_decode($bruto, true);
    return is_array($dados) ? $dados : [];
}

function exigirMetodo(string $metodo): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $metodo) {
        erro('método não permitido', 405);
    }
}

function banco(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }
    global $CONFIG;
    $b = $CONFIG['banco'];
    $dsn = "mysql:host={$b['host']};port={$b['porta']};dbname={$b['nome']};charset=utf8mb4";
    try {
        $pdo = new PDO($dsn, $b['usuario'], $b['senha'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $e) {
        // A mensagem do PDO carrega usuário e host: fica no log, não na tela.
        error_log('MagoScout: falha conectando ao banco — ' . $e->getMessage());
        erro('banco indisponível', 503);
    }
    return $pdo;
}

function iniciarSessao(): void
{
    global $CONFIG;
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 30,
        'path' => '/',
        'httponly' => true,
        'secure' => (bool) $CONFIG['https'],
        // O app e a API moram no mesmo domínio; Lax já barra o post de outro
        // site e não atrapalha a navegação normal.
        'samesite' => 'Lax',
    ]);
    session_name('magoscout');
    session_start();
}

function usuarioLogado(): ?array
{
    iniciarSessao();
    if (empty($_SESSION['usuario_id'])) {
        return null;
    }
    return [
        'id' => (int) $_SESSION['usuario_id'],
        'nome' => $_SESSION['usuario_nome'] ?? '',
        'time_id' => (int) ($_SESSION['time_id'] ?? 0),
    ];
}

function exigirLogin(): array
{
    $u = usuarioLogado();
    if ($u === null) {
        erro('sessão expirada', 401);
    }
    return $u;
}

// O time é sempre um só nesta versão do app, mas tudo que grava passa o
// time_id: não deixa a porta fechada para o dia em que houver mais de um.
function timeDoUsuario(array $usuario): array
{
    $st = banco()->prepare('SELECT id, nome, escudo, token_publico FROM time_futsal WHERE id = ?');
    $st->execute([$usuario['time_id']]);
    $time = $st->fetch();
    if (!$time) {
        erro('time não encontrado', 404);
    }
    return $time;
}
