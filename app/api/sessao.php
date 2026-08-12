<?php
// Quem está logado. O app pergunta isto ao abrir para saber se pode
// sincronizar, e segue funcionando offline se a resposta não vier.

declare(strict_types=1);

require __DIR__ . '/comum.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'DELETE' || ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    iniciarSessao();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
    responder(['saiu' => true]);
}

$usuario = usuarioLogado();
if ($usuario === null) {
    responder(['logado' => false], 200);
}

responder([
    'logado' => true,
    'usuario' => ['nome' => $usuario['nome']],
    'time' => timeDoUsuario($usuario),
]);
