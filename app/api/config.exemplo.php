<?php
// Modelo de configuração. Copie para `config.php` e preencha.
//
//     cp api/config.exemplo.php api/config.php
//
// `config.php` fica fora do Git de propósito: é o arquivo que carrega a senha
// do banco. Este aqui, com os valores em branco, é o que fica versionado.
//
// É também o único arquivo a editar quando o app trocar de servidor. A
// hospedagem é provisória (InfinityFree para teste e apresentação; o Raul ainda
// vai decidir se banca um host pago), então nada mais no código pode saber onde
// o app está rodando. Sem cron, sem WebSocket, sem extensão exótica: só PDO e
// MySQL.

return [
    // No XAMPP2 local: host 127.0.0.1, usuário root, senha vazia.
    // No host compartilhado: os quatro valores saem do painel, em
    // "MySQL Databases".
    'banco' => [
        'host'  => '127.0.0.1',
        'nome'  => 'magoscout',
        'usuario' => 'root',
        'senha' => '',
        'porta' => 3306,
    ],

    // Nome que aparece na tela no primeiro acesso. Editável porque o Raul
    // cogitou usar o app em outro time.
    'time_padrao' => 'União Mauá Futsal',

    // Em produção o cookie de sessão só deve viajar em HTTPS. Local não tem
    // certificado, então fica desligado — e é por isso que o smoke test do
    // host importa: sem HTTPS confirmado, isto aqui nunca pode virar true.
    'https' => false,
];
