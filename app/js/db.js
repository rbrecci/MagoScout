// Armazenamento local. O app sempre grava aqui primeiro e responde na tela na
// hora; a sincronização com o servidor lê desta mesma base. Sem rede, nada se
// perde.
//
// Tudo é chaveado por UUID gerado no cliente, igual ao banco do servidor: é o
// que permite criar jogador e partida dentro do ginásio, offline, e subir
// depois sem risco de duplicar.

var DB = (function () {
  'use strict';

  var NOME = 'magoscout';
  var VERSAO = 3;
  var conexao = null;

  function abrir() {
    if (conexao) { return Promise.resolve(conexao); }
    return new Promise(function (ok, falha) {
      var req = indexedDB.open(NOME, VERSAO);

      req.onupgradeneeded = function (e) {
        var db = e.target.result;

        // A versão 1 usava id numérico do servidor e índice em `partida_id`.
        // Nem keyPath de loja nem keyPath de índice mudam no lugar, e um
        // índice velho apontando para campo que não existe mais devolve lista
        // vazia sem erro nenhum. Por isso as lojas são derrubadas e refeitas:
        // os registros da v1 referenciam ids que não existem mais de qualquer
        // forma.
        ['jogador', 'partida', 'evento', 'passagem', 'convocacao'].forEach(function (loja) {
          if (db.objectStoreNames.contains(loja)) { db.deleteObjectStore(loja); }
        });

        db.createObjectStore('jogador', { keyPath: 'uuid' });
        db.createObjectStore('partida', { keyPath: 'uuid' });
        db.createObjectStore('convocacao', { keyPath: 'partida_uuid' });
        db.createObjectStore('evento', { keyPath: 'uuid' })
          .createIndex('partida', 'partida_uuid');
        db.createObjectStore('passagem', { keyPath: 'uuid' })
          .createIndex('partida', 'partida_uuid');
      };

      req.onsuccess = function (e) { conexao = e.target.result; ok(conexao); };
      req.onerror = function (e) { falha(e.target.error); };
    });
  }

  function transacao(loja, modo, acao) {
    return abrir().then(function (db) {
      return new Promise(function (ok, falha) {
        var tx = db.transaction(loja, modo);
        var req = acao(tx.objectStore(loja));
        tx.oncomplete = function () { ok(req && req.result); };
        tx.onerror = function () { falha(tx.error); };
        tx.onabort = function () { falha(tx.error); };
      });
    });
  }

  function guardar(loja, registro) {
    return transacao(loja, 'readwrite', function (s) { return s.put(registro); });
  }

  function obter(loja, chave) {
    return transacao(loja, 'readonly', function (s) { return s.get(chave); });
  }

  function remover(loja, chave) {
    return transacao(loja, 'readwrite', function (s) { return s.delete(chave); });
  }

  function todos(loja) {
    return transacao(loja, 'readonly', function (s) { return s.getAll(); });
  }

  function porPartida(loja, partidaUuid) {
    return transacao(loja, 'readonly', function (s) {
      return s.index('partida').getAll(partidaUuid);
    });
  }

  function limpar(loja) {
    return transacao(loja, 'readwrite', function (s) { return s.clear(); });
  }

  function uuid() {
    if (crypto.randomUUID) { return crypto.randomUUID(); }
    // Fallback para navegador antigo: mesma forma, mesma garantia prática.
    var b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = [].map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  return {
    guardar: guardar,
    obter: obter,
    remover: remover,
    todos: todos,
    porPartida: porPartida,
    limpar: limpar,
    uuid: uuid
  };
})();
