// Agregação dos eventos de uma partida. Não toca em tela nem em banco: recebe
// as listas e devolve números. A tela de análise, os gráficos da fase 3 e o
// relatório em imagem leem daqui, para os três nunca discordarem entre si.

var Estatisticas = (function () {
  'use strict';

  // ------------------------------------------------ baldes por período

  // Cada número guarda um valor por período mais o total, para o recorte
  // 1º/2º tempo sair de graça em qualquer métrica.
  function balde(nPeriodos) {
    var b = { total: 0 };
    for (var i = 1; i <= nPeriodos; i++) { b[i] = 0; }
    return b;
  }

  function inc(b, periodo, quanto) {
    var q = quanto === undefined ? 1 : quanto;
    if (b[periodo] === undefined) { b[periodo] = 0; }
    b[periodo] += q;
    b.total += q;
  }

  function somar(a, b, nPeriodos) {
    var r = balde(nPeriodos);
    r.total = a.total + b.total;
    for (var i = 1; i <= nPeriodos; i++) { r[i] = a[i] + b[i]; }
    return r;
  }

  // ------------------------------------------------ percentuais

  // null quando não houve tentativa: 0% e "não tentou" são coisas diferentes
  // na conversa com o jogador.
  function pct(certos, errados) {
    var soma = certos + errados;
    return soma === 0 ? null : Math.round((certos * 100) / soma);
  }

  function taxa(nPeriodos, acertos, erros) {
    var r = { total: pct(acertos.total, erros.total) };
    for (var i = 1; i <= nPeriodos; i++) { r[i] = pct(acertos[i], erros[i]); }
    return r;
  }

  function aproveitamentos(tipos, nPeriodos) {
    return {
      finalizacao: taxa(nPeriodos, somar(tipos.gol, tipos.finalizacao_certa, nPeriodos), tipos.finalizacao_errada),
      drible: taxa(nPeriodos, tipos.drible_certo, tipos.drible_errado),
      passe: taxa(nPeriodos, tipos.passe_certo, tipos.passe_errado),
      reposicao: taxa(nPeriodos, tipos.reposicao_certa, tipos.reposicao_errada)
    };
  }

  // Tudo que o Raul compara é por minuto jogado — foi a decisão dele.
  function porMinuto(quantidade, segundos) {
    if (!segundos) { return null; }
    return (quantidade * 60) / segundos;
  }

  // ------------------------------------------------ tempo

  function relogioAtual(partida) {
    var base = partida.base || 0;
    return partida.desde ? base + Math.floor((Date.now() - partida.desde) / 1000) : base;
  }

  // Passagem sem `saiu` é passagem que ficou aberta — o app foi fechado no meio
  // do período, ou o período virou sem substituição. O fim é o relógio que se
  // conhece: o cronômetro da partida, se for o período corrente; senão a
  // duração cheia do período.
  function fimDoPeriodo(partida, periodo) {
    if (periodo === (partida.periodo || 1)) { return relogioAtual(partida); }
    return (partida.minutosPeriodo || 20) * 60;
  }

  function mmss(s) {
    var m = Math.floor(s / 60);
    var r = Math.floor(s % 60);
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }

  // ------------------------------------------------ agregação

  function novaFicha(jogador, nPeriodos) {
    var ficha = {
      jogador: jogador,
      segundos: balde(nPeriodos),
      acoes: balde(nPeriodos),
      tipos: {}
    };
    TIPOS.forEach(function (t) { ficha.tipos[t.codigo] = balde(nPeriodos); });
    return ficha;
  }

  function calcular(partida, eventos, passagens, jogadores) {
    var nP = partida.periodos || 2;
    var periodos = [];
    for (var i = 1; i <= nP; i++) { periodos.push(i); }

    var fichas = {};
    var ordem = [];
    jogadores.forEach(function (j) {
      fichas[j.uuid] = novaFicha(j, nP);
      ordem.push(j.uuid);
    });

    // `acoes` é tudo que foi registrado na partida; `acoesJogadores` deixa de
    // fora lateral e escanteio, que não têm dono. A régua de "por minuto" tem
    // que ser a segunda, senão o time parece mais produtivo que qualquer um
    // dos seus jogadores.
    var time = { acoes: balde(nP), acoesJogadores: balde(nP), tipos: {} };
    TIPOS.forEach(function (t) { time.tipos[t.codigo] = balde(nP); });

    eventos.forEach(function (e) {
      if (e.anulado) { return; }
      var per = e.periodo || 1;

      if (!time.tipos[e.tipo]) { time.tipos[e.tipo] = balde(nP); }
      inc(time.tipos[e.tipo], per);
      inc(time.acoes, per);

      var f = fichas[e.jogador_uuid];
      if (!f) { return; }
      inc(time.acoesJogadores, per);
      if (!f.tipos[e.tipo]) { f.tipos[e.tipo] = balde(nP); }
      inc(f.tipos[e.tipo], per);
      inc(f.acoes, per);
    });

    passagens.forEach(function (p) {
      var f = fichas[p.jogador_uuid];
      if (!f) { return; }
      var per = p.periodo || 1;
      var fim = (p.saiu === null || p.saiu === undefined) ? fimDoPeriodo(partida, per) : p.saiu;
      inc(f.segundos, per, Math.max(0, fim - p.entrou));
    });

    var lista = ordem.map(function (u) { return fichas[u]; });
    lista.forEach(function (f) {
      f.aproveitamento = aproveitamentos(f.tipos, nP);
      f.participou = f.segundos.total > 0 || f.acoes.total > 0;
    });

    // Quem não entrou vai para o fim: continua na lista (foi relacionado), mas
    // não empurra para baixo quem jogou.
    var ordenada = lista.filter(function (f) { return f.participou; })
      .concat(lista.filter(function (f) { return !f.participou; }));

    time.aproveitamento = aproveitamentos(time.tipos, nP);
    time.segundos = balde(nP);
    lista.forEach(function (f) {
      periodos.forEach(function (per) { time.segundos[per] += f.segundos[per]; });
      time.segundos.total += f.segundos.total;
    });

    return {
      partida: partida,
      periodos: periodos,
      time: time,
      jogadores: ordenada,
      // Placar corrigido na mão vence o contado, como na tela inicial.
      golsPro: partida.gols_pro === null || partida.gols_pro === undefined
        ? time.tipos.gol.total : partida.gols_pro,
      golsContra: partida.gols_contra === null || partida.gols_contra === undefined
        ? time.tipos.gol_sofrido.total : partida.gols_contra
    };
  }

  // ------------------------------------------------ métricas

  // Catálogo do que dá para comparar. Ficha de jogador e resumo do time têm o
  // mesmo formato de propósito, então a mesma métrica lê os dois — é o que
  // permite pôr jogador e média do time no mesmo gráfico.
  var METRICAS = [
    { chave: 'acoes_min', rotulo: 'Ações por minuto', formato: 'taxa',
      valor: function (f, p) { return porMinuto((f.acoesJogadores || f.acoes)[p], f.segundos[p]); } },
    { chave: 'passe', rotulo: 'Passe certo %', formato: 'pct', max: 100,
      valor: function (f, p) { return f.aproveitamento.passe[p]; } },
    { chave: 'finalizacao', rotulo: 'Finalização %', formato: 'pct', max: 100,
      valor: function (f, p) { return f.aproveitamento.finalizacao[p]; } },
    { chave: 'drible', rotulo: 'Drible %', formato: 'pct', max: 100,
      valor: function (f, p) { return f.aproveitamento.drible[p]; } },
    { chave: 'gols', rotulo: 'Gols', formato: 'n', agregado: 'soma',
      valor: function (f, p) { return f.tipos.gol[p]; } },
    { chave: 'roubadas_min', rotulo: 'Bolas roubadas por minuto', formato: 'taxa',
      valor: function (f, p) { return porMinuto(f.tipos.bola_roubada[p], f.segundos[p]); } },
    { chave: 'faltas', rotulo: 'Faltas cometidas', formato: 'n', agregado: 'soma',
      valor: function (f, p) { return f.tipos.falta_cometida[p]; } },
    { chave: 'minutos', rotulo: 'Minutos em quadra', formato: 'tempo', agregado: 'soma',
      valor: function (f, p) { return f.segundos[p]; } }
  ];

  function metricaPor(chave) {
    for (var i = 0; i < METRICAS.length; i++) {
      if (METRICAS[i].chave === chave) { return METRICAS[i]; }
    }
    return METRICAS[0];
  }

  function ficha(jogo, jogadorUuid) {
    for (var i = 0; i < jogo.jogadores.length; i++) {
      if (jogo.jogadores[i].jogador.uuid === jogadorUuid) { return jogo.jogadores[i]; }
    }
    return null;
  }

  // O número do time só é comparável com o de um jogador quando é taxa: 74% de
  // passe do time se põe ao lado dos 68% dele. Em métrica de soma (gols,
  // faltas, minutos) o time é o total do elenco, e comparar um jogador com o
  // total dos seis é comparar coisa nenhuma — a referência justa é o total
  // dividido por quem esteve em quadra.
  function referenciaDoTime(jogo, metrica, periodo) {
    var v = metrica.valor(jogo.time, periodo || 'total');
    if (v === null || v === undefined) { return null; }
    if (metrica.agregado !== 'soma') { return v; }
    var quantos = jogo.jogadores.filter(function (f) { return f.participou; }).length;
    return quantos ? v / quantos : null;
  }

  // ------------------------------------------------ vários jogos

  // Um ponto por jogo, na ordem em que a lista chegar. Jogo em que o sujeito
  // não entrou vale null: buraco na linha, não zero — zero seria dizer que ele
  // jogou mal.
  function serie(jogos, jogadorUuid, metrica, periodo) {
    var p = periodo || 'total';
    return jogos.map(function (jogo) {
      if (!jogadorUuid) {
        return {
          jogo: jogo,
          participou: jogo.time.acoes.total > 0,
          valor: jogo.time.acoes.total > 0 ? referenciaDoTime(jogo, metrica, p) : null
        };
      }
      var f = ficha(jogo, jogadorUuid);
      var participou = !!(f && f.participou);
      return {
        jogo: jogo,
        participou: participou,
        valor: participou ? metrica.valor(f, p) : null
      };
    });
  }

  // Soma de vários jogos no mesmo formato de um jogo só. É o que faz o ranking
  // e a ficha de temporada usarem exatamente as mesmas métricas da análise de
  // uma partida, sem uma segunda implementação para discordar da primeira.
  function temporada(jogos) {
    var nP = 2;
    jogos.forEach(function (j) { nP = Math.max(nP, j.periodos.length); });

    function acumular(destino, origem) {
      for (var i = 1; i <= nP; i++) { destino[i] += (origem[i] || 0); }
      destino.total += origem.total;
    }

    var time = {
      acoes: balde(nP), acoesJogadores: balde(nP), segundos: balde(nP), tipos: {}, jogos: jogos.length
    };
    TIPOS.forEach(function (t) { time.tipos[t.codigo] = balde(nP); });

    var fichas = {};
    var ordem = [];

    jogos.forEach(function (jogo) {
      acumular(time.acoes, jogo.time.acoes);
      acumular(time.acoesJogadores, jogo.time.acoesJogadores || jogo.time.acoes);
      acumular(time.segundos, jogo.time.segundos);
      TIPOS.forEach(function (t) { acumular(time.tipos[t.codigo], jogo.time.tipos[t.codigo]); });

      jogo.jogadores.forEach(function (f) {
        var alvo = fichas[f.jogador.uuid];
        if (!alvo) {
          alvo = novaFicha(f.jogador, nP);
          alvo.jogos = 0;
          fichas[f.jogador.uuid] = alvo;
          ordem.push(f.jogador.uuid);
        }
        // O jogador mais recente manda no nome e no número: ele pode ter
        // trocado de camisa no meio da temporada.
        alvo.jogador = f.jogador;
        acumular(alvo.acoes, f.acoes);
        acumular(alvo.segundos, f.segundos);
        TIPOS.forEach(function (t) { acumular(alvo.tipos[t.codigo], f.tipos[t.codigo]); });
        if (f.participou) { alvo.jogos++; }
      });
    });

    var lista = ordem.map(function (u) { return fichas[u]; });
    lista.forEach(function (f) {
      f.aproveitamento = aproveitamentos(f.tipos, nP);
      f.participou = f.jogos > 0;
    });
    time.aproveitamento = aproveitamentos(time.tipos, nP);

    var periodos = [];
    for (var i = 1; i <= nP; i++) { periodos.push(i); }

    return { periodos: periodos, time: time, jogadores: lista, jogos: jogos.length };
  }

  function media(valores) {
    var v = valores.filter(function (x) { return x !== null && x !== undefined; });
    if (!v.length) { return null; }
    var s = 0;
    v.forEach(function (x) { s += x; });
    return s / v.length;
  }

  // Regularidade, para o Raul, são duas coisas: constância entre jogos e do 1º
  // para o 2º tempo. Isto resolve a primeira — quanto o número costuma variar
  // em torno da própria média. Menor é mais constante.
  function desvio(valores) {
    var v = valores.filter(function (x) { return x !== null && x !== undefined; });
    if (v.length < 2) { return null; }
    var m = media(v);
    var soma = 0;
    v.forEach(function (x) { soma += (x - m) * (x - m); });
    return Math.sqrt(soma / v.length);
  }

  return {
    calcular: calcular,
    pct: pct,
    porMinuto: porMinuto,
    mmss: mmss,
    METRICAS: METRICAS,
    metricaPor: metricaPor,
    ficha: ficha,
    referenciaDoTime: referenciaDoTime,
    temporada: temporada,
    serie: serie,
    media: media,
    desvio: desvio
  };
})();
