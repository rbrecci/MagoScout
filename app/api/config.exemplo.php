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
    // certificado, então fica desligado. O smoke test de 12/08 confirmou HTTPS
    // no host, então lá isto pode ser true.
    'https' => false,

    // A IA da fase 5. A chave fica aqui, no servidor, e nunca chega ao
    // navegador: quem fala com o Gemini é o `api/ia.php`. O smoke test
    // confirmou que o host alcança a internet de saída, que é o que torna isto
    // possível sem expor a chave no cliente.
    //
    // Chave: https://aistudio.google.com/apikey
    // Deixe 'chave' vazia para desligar a IA; o app continua inteiro sem ela.
    'ia' => [
        'chave'  => '',
        // Conferido em 12/08/2026: `gemini-2.5-flash` foi fechado para contas
        // novas e responde erro. `gemini-3.6-flash` funciona no free tier.
        'modelo' => 'gemini-3.6-flash',
    ],
];
