// A fila de sincronização.
//
// Regra que organiza tudo: o app nunca espera a rede. Grava local, marca o
// registro como pendente e, quando houver rede e sessão, sobe. O servidor
// devolve o que os outros aparelhos escreveram desde o último carimbo dele.

var Sync = (function () {
  'use strict';

  var CHAVE_DESDE = 'magoscout.sync_desde';
  var CHAVE_QUANDO = 'magoscout.sync_quando';
  var emAndamento = null;
  var ouvintes = [];

  function ler(chave) {
    try { return localStorage.getItem(chave); } catch (e) { return null; }
  }

  function gravar(chave, valor) {
    try { localStorage.setItem(chave, valor); } catch (e) {}
  }

  function avisar(estado) {
    ouvintes.forEach(function (f) {
      try { f(estado); } catch (e) { console.error('ouvinte de sync falhou', e); }
    });
    return estado;
  }

  function aoMudar(f) { ouvintes.push(f); }

  function ultimaVez() { return ler(CHAVE_QUANDO); }

  function esquecerCarimbo() {
    try { localStorage.removeItem(CHAVE_DESDE); localStorage.removeItem(CHAVE_QUANDO); } catch (e) {}
  }

  // Uma sincronização por vez: duas em paralelo subiriam o mesmo lote duas
  // vezes. Não quebraria nada (o UUID protege), mas gastaria dados do Raul à
  // toa.
  function agora(silencioso) {
    if (emAndamento) { return emAndamento; }

    if (!navigator.onLine) {
      return Promise.resolve(avisar({ estado: 'offline' }));
    }

    avisar({ estado: 'sincronizando' });

    emAndamento = Dados.pendentes().then(function (fila) {
      return Api.sincronizar({
        desde: ler(CHAVE_DESDE),
        jogadores: fila.jogadores,
        partidas: fila.partidas,
        convocacoes: fila.convocacoes,
        eventos: fila.eventos,
        passagens: fila.passagens
      }).then(function (resposta) {
        return Dados.marcarEnviados(fila)
          .then(function () { return Dados.aplicarRemotos(resposta.novidades || {}); })
          .then(function (quantos) {
            gravar(CHAVE_DESDE, resposta.agora);
            gravar(CHAVE_QUANDO, new Date().toISOString());
            return avisar({
              estado: 'ok',
              enviados: resposta.aceitos,
              recebidos: quantos,
              quando: ler(CHAVE_QUANDO)
            });
          });
      });
    }).catch(function (err) {
      if (err.codigo === 401) {
        return avisar({ estado: 'sem-sessao' });
      }
      if (!silencioso) { console.error('falha na sincronização', err); }
      return avisar({ estado: 'falhou', mensagem: err.message });
    }).then(function (estado) {
      emAndamento = null;
      return estado;
    });

    return emAndamento;
  }

  // Chamada pelas telas que têm o que subir. Não faz nada se não houver sessão
  // — o app inteiro funciona sem servidor, essa é a premissa desde a fase 1.
  function seDerCerto() {
    return Api.sessao().then(function (s) {
      if (!s.logado) { return avisar({ estado: 'sem-sessao' }); }
      return agora(true);
    }).catch(function () {
      return avisar({ estado: 'offline' });
    });
  }

  window.addEventListener('online', function () { seDerCerto(); });

  return {
    agora: agora,
    seDerCerto: seDerCerto,
    aoMudar: aoMudar,
    ultimaVez: ultimaVez,
    esquecerCarimbo: esquecerCarimbo
  };
})();
