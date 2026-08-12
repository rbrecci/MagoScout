// Conversa com o servidor. Só este arquivo sabe que existe um servidor.
//
// Nenhuma tela espera resposta daqui para funcionar: o app grava local primeiro
// e sobe depois. Rede caída é situação normal, não erro.

var Api = (function () {
  'use strict';

  var BASE = 'api/';

  function chamar(caminho, opcoes) {
    var config = opcoes || {};
    config.credentials = 'same-origin';
    config.headers = { 'Content-Type': 'application/json' };
    if (config.corpo !== undefined) {
      config.method = config.method || 'POST';
      config.body = JSON.stringify(config.corpo);
      delete config.corpo;
    }

    return fetch(BASE + caminho, config).then(function (resposta) {
      return resposta.text().then(function (texto) {
        var dados;
        try {
          dados = texto ? JSON.parse(texto) : {};
        } catch (e) {
          // Servidor cuspindo HTML no lugar de JSON é erro de configuração
          // (PHP fora do ar, host servindo página de bloqueio). Vale dizer isso
          // em vez de "token inesperado <".
          var falha = new Error('o servidor não respondeu em JSON');
          falha.codigo = resposta.status;
          falha.bruto = texto.slice(0, 200);
          throw falha;
        }
        if (!resposta.ok) {
          var erro = new Error(dados.erro || ('erro ' + resposta.status));
          erro.codigo = resposta.status;
          throw erro;
        }
        return dados;
      });
    });
  }

  return {
    sessao: function () { return chamar('sessao.php'); },
    entrar: function (email, senha) {
      return chamar('login.php', { corpo: { email: email, senha: senha } });
    },
    sair: function () { return chamar('sessao.php', { method: 'POST' }); },
    sincronizar: function (carga) { return chamar('sync.php', { corpo: carga }); },
    instalacao: function () { return chamar('instalar.php'); },
    instalar: function (dados) { return chamar('instalar.php', { corpo: dados }); },
    publico: function (token) {
      return chamar('publico.php?t=' + encodeURIComponent(token), { method: 'GET' });
    }
  };
})();
