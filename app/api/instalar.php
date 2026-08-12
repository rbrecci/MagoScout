<?php
// Instalação em um passo: cria o banco, aplica o schema e registra o primeiro
// usuário da comissão.
//
// Existe porque a hospedagem é provisória e o Raul vai precisar subir isto
// sozinho mais de uma vez. Depois que houver um usuário, este endpoint recusa
// tudo — é a única proteção dele, e é suficiente porque a janela dura o tempo
// entre subir os arquivos e criar a conta.

declare(strict_types=1);

require __DIR__ . '/comum.php';

function conexaoServidor(array $b): PDO
{
    $dsn = "mysql:host={$b['host']};port={$b['porta']};charset=utf8mb4";
    return new PDO($dsn, $b['usuario'], $b['senha'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}

function estado(array $b): array
{
    try {
        $pdo = conexaoServidor($b);
    } catch (PDOException $e) {
        return ['banco' => false, 'motivo' => 'não conectou no servidor MySQL'];
    }

    $st = $pdo->prepare('SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = ?');
    $st->execute([$b['nome']]);
    if (!$st->fetchColumn()) {
        return ['banco' => true, 'schema' => false, 'instalado' => false];
    }

    $pdo->exec('USE `' . str_replace('`', '', $b['nome']) . '`');
    $st = $pdo->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ? AND table_name = ?');
    $st->execute([$b['nome'], 'usuario']);
    if (!$st->fetchColumn()) {
        return ['banco' => true, 'schema' => false, 'instalado' => false];
    }

    $quantos = (int) $pdo->query('SELECT COUNT(*) FROM usuario')->fetchColumn();
    return ['banco' => true, 'schema' => true, 'instalado' => $quantos > 0];
}

// Divide o schema em comandos. O arquivo é nosso e não tem procedure nem
// delimitador customizado, então quebrar no ponto-e-vírgula de fim de linha dá
// conta — e evita depender de multi-statement, que nem todo host habilita.
function comandos(string $sql): array
{
    $linhas = preg_split('/\r?\n/', $sql);
    $atual = '';
    $saida = [];
    foreach ($linhas as $linha) {
        $limpa = trim($linha);
        if ($limpa === '' || strpos($limpa, '--') === 0) {
            continue;
        }
        $atual .= $linha . "\n";
        if (substr($limpa, -1) === ';') {
            $saida[] = trim($atual);
            $atual = '';
        }
    }
    if (trim($atual) !== '') {
        $saida[] = trim($atual);
    }
    return $saida;
}

$b = $CONFIG['banco'];

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    responder(estado($b) + ['time_padrao' => $CONFIG['time_padrao']]);
}

exigirMetodo('POST');

$situacao = estado($b);
if (!empty($situacao['instalado'])) {
    erro('já existe um usuário: a instalação está fechada', 409);
}

$dados = corpo();
$nome  = trim((string) ($dados['nome'] ?? ''));
$email = trim((string) ($dados['email'] ?? ''));
$senha = (string) ($dados['senha'] ?? '');
$time  = trim((string) ($dados['time'] ?? '')) ?: $CONFIG['time_padrao'];

if ($nome === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($senha) < 8) {
    erro('informe nome, e-mail válido e senha de pelo menos 8 caracteres', 422);
}

try {
    $pdo = conexaoServidor($b);
    $pdo->exec('CREATE DATABASE IF NOT EXISTS `' . str_replace('`', '', $b['nome']) .
        '` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $pdo->exec('USE `' . str_replace('`', '', $b['nome']) . '`');

    if (empty($situacao['schema'])) {
        $sql = file_get_contents(__DIR__ . '/../banco/schema.sql');
        if ($sql === false) {
            erro('não achei o arquivo banco/schema.sql', 500);
        }
        foreach (comandos($sql) as $comando) {
            $pdo->exec($comando);
        }
    }

    $pdo->beginTransaction();

    $token = bin2hex(random_bytes(16));
    $st = $pdo->prepare('INSERT INTO time_futsal (nome, token_publico) VALUES (?, ?)');
    $st->execute([$time, $token]);
    $timeId = (int) $pdo->lastInsertId();

    $st = $pdo->prepare('INSERT INTO usuario (time_id, nome, email, senha_hash) VALUES (?, ?, ?, ?)');
    $st->execute([$timeId, $nome, $email, password_hash($senha, PASSWORD_DEFAULT)]);

    $pdo->commit();
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('MagoScout: falha instalando — ' . $e->getMessage());
    erro('falha instalando: ' . $e->getCode(), 500);
}

responder([
    'instalado' => true,
    'time' => $time,
    'token_publico' => $token,
]);
