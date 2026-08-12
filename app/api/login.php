<?php
// Entrada da comissão técnica. Só a comissão tem conta; o jogador entra por
// link público, sem senha.

declare(strict_types=1);

require __DIR__ . '/comum.php';
exigirMetodo('POST');
iniciarSessao();

$dados = corpo();
$email = trim((string) ($dados['email'] ?? ''));
$senha = (string) ($dados['senha'] ?? '');

if ($email === '' || $senha === '') {
    erro('informe e-mail e senha', 422);
}

// Freio simples contra tentativa em série. Não é rate limit de verdade (sem
// cron e sem Redis num host grátis), mas transforma força bruta em algo lento
// o bastante para não valer a pena.
$tentativas = (int) ($_SESSION['tentativas'] ?? 0);
if ($tentativas > 0) {
    usleep(min($tentativas, 8) * 400000);
}

$st = banco()->prepare('SELECT id, time_id, nome, senha_hash FROM usuario WHERE email = ?');
$st->execute([$email]);
$usuario = $st->fetch();

if (!$usuario || !password_verify($senha, $usuario['senha_hash'])) {
    $_SESSION['tentativas'] = $tentativas + 1;
    // Mesma resposta para e-mail que não existe e senha errada: não conta ao
    // curioso quais e-mails estão cadastrados.
    erro('e-mail ou senha não conferem', 401);
}

// Troca o identificador da sessão no login: sessão anônima capturada antes não
// vira sessão autenticada depois.
session_regenerate_id(true);
unset($_SESSION['tentativas']);
$_SESSION['usuario_id'] = (int) $usuario['id'];
$_SESSION['usuario_nome'] = $usuario['nome'];
$_SESSION['time_id'] = (int) $usuario['time_id'];

$time = timeDoUsuario([
    'id' => (int) $usuario['id'],
    'nome' => $usuario['nome'],
    'time_id' => (int) $usuario['time_id'],
]);

responder([
    'usuario' => ['nome' => $usuario['nome'], 'email' => $email],
    'time' => $time,
]);
