// Evolução de um jogador, jogo a jogo. Abre pela ficha dele na análise de uma
// partida, com ?j=<uuid>.
//
// Responde as duas perguntas que sobraram da fase 2: como ele está em relação à
// média do time, e como ele está em relação a ele mesmo, que é o que o Raul
// chama de regularidade.

(function () {
  'use strict';

  var jogador = null;
  var jogos = [];        // só os jogos em que ele foi relacionado
  var metrica = null;
  var periodo = 'total';
  var redesenho = null;
  var el = {};

  // ------------------------------------------------ formatação

  function fmt(v) {
    if (v === null || v === undefined) { return '-'; }
    if (metrica.formato === 'tempo') { return Estatisticas.mmss(v); }
    return Grafico.fmt(v, metrica.formato);
  }

  function rotuloJogo(jogo) {
    var p = jogo.partida;
    return (p.adversario || 'sem nome').split(' ')[0];
  }

  function nomeRecorte() {
    return periodo === 'total' ? 'no jogo' : 'no ' + periodo + 'º tempo';
  }

  // ------------------------------------------------ séries

  function serieJogador() {
    return Estatisticas.serie(jogos, jogador.uuid, metrica, periodo).map(function (p) { return p.valor; });
  }

  function serieTime() {
    return Estatisticas.serie(jogos, null, metrica, periodo).map(function (p) { return p.valor; });
  }

  // ------------------------------------------------ gráfico

  function desenhar() {
    if (!jogos.length) { el.molduraLinha.hidden = true; return; }
    el.molduraLinha.hidden = false;

    var c = Grafico.cores();
    var estilo = getComputedStyle(el.molduraLinha);
    var largura = Math.max(240, el.molduraLinha.clientWidth -
      parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight));
    var altura = 210;
    var ctx = Grafico.preparar(el.gLinha, largura, altura);

    var series = [
      { rotulo: jogador.nome.split(' ')[0], cor: c.azul, valores: serieJogador() },
      { rotulo: 'média do time', cor: c.fraco, valores: serieTime(), tracejada: true }
    ];

    Grafico.linha(ctx, { x: 0, y: 0, w: largura, h: altura - 22 }, {
      rotulos: jogos.map(rotuloJogo),
      series: series,
      formato: metrica.formato,
      max: metrica.max
    });
    Grafico.legenda(ctx, 0, altura - 2, series, 1);
  }

  // ------------------------------------------------ números

  function tile(valor, rotulo) {
    var d = document.createElement('div');
    d.className = 'tile';
    var v = document.createElement('span');
    v.className = 'valor';
    v.textContent = valor;
    var r = document.createElement('span');
    r.className = 'rotulo';
    r.textContent = rotulo;
    d.appendChild(v);
    d.appendChild(r);
    return d;
  }

  function renderTiles() {
    var dele = serieJogador();
    var doTime = serieTime();
    var jogou = dele.filter(function (v) { return v !== null; }).length;

    el.tiles.innerHTML = '';
    el.tiles.appendChild(tile(fmt(Estatisticas.media(dele)), 'média dele ' + nomeRecorte()));
    el.tiles.appendChild(tile(fmt(Estatisticas.media(doTime)), 'média do time'));
    el.tiles.appendChild(tile(jogou + ' de ' + jogos.length, 'jogos com número'));

    var d = Estatisticas.desvio(dele);
    el.tiles.appendChild(tile(d === null ? '-' : '±' + fmt(d), 'variação típica'));
  }

  // Regularidade para o Raul são duas coisas, e as duas ficam aqui: a variação
  // entre jogos e a queda (ou não) do 1º para o 2º tempo.
  function renderRegularidade() {
    el.regularidade.innerHTML = '';

    var dele = serieJogador();
    var valores = dele.filter(function (v) { return v !== null; });
    var linhas = [];

    if (valores.length < 2) {
      var p = document.createElement('p');
      p.className = 'nada';
      p.textContent = 'Um jogo só não mostra regularidade. Volte depois da próxima partida.';
      el.regularidade.appendChild(p);
      return;
    }

    var m = Estatisticas.media(valores);
    var d = Estatisticas.desvio(valores);
    linhas.push(['Entre jogos', fmt(m) + '  ±' + fmt(d)]);
    linhas.push(['Melhor jogo', fmt(Math.max.apply(null, valores))]);
    linhas.push(['Pior jogo', fmt(Math.min.apply(null, valores))]);

    // Do 1º para o 2º tempo: média da diferença jogo a jogo, não a diferença
    // das médias. Assim um jogo em que ele não entrou no 2º tempo não puxa a
    // conta para baixo.
    var difs = [];
    jogos.forEach(function (jogo) {
      var f = Estatisticas.ficha(jogo, jogador.uuid);
      if (!f || !f.participou) { return; }
      var a = metrica.valor(f, 1);
      var b = metrica.valor(f, 2);
      if (a === null || b === null || a === undefined || b === undefined) { return; }
      difs.push(b - a);
    });
    var dif = Estatisticas.media(difs);
    if (dif === null) {
      linhas.push(['Do 1º para o 2º tempo', '-']);
    } else {
      // Sinal só quando a diferença sobrevive ao arredondamento: "+0.0" não
      // quer dizer nada.
      var corpo = fmt(Math.abs(dif));
      var sinal = corpo === fmt(0) ? '' : (dif > 0 ? '+' : '-');
      linhas.push(['Do 1º para o 2º tempo', sinal + corpo]);
    }

    linhas.forEach(function (l) {
      var div = document.createElement('div');
      div.className = 'linha-comp';
      var r = document.createElement('span');
      r.className = 'r';
      r.textContent = l[0];
      var v = document.createElement('span');
      v.className = 'v larga';
      v.textContent = l[1];
      div.appendChild(r);
      div.appendChild(v);
      el.regularidade.appendChild(div);
    });
  }

  function renderJogos() {
    el.jogos.innerHTML = '';
    if (!jogos.length) {
      var vazio = document.createElement('p');
      vazio.className = 'nada';
      vazio.textContent = 'Este jogador ainda não foi relacionado para nenhuma partida.';
      el.jogos.appendChild(vazio);
      return;
    }

    var cab = document.createElement('div');
    cab.className = 'linha-comp cabecalho';
    cab.appendChild(document.createElement('span'));
    ['1º', '2º', 'jogo'].forEach(function (t) {
      var s = document.createElement('span');
      s.className = 'v';
      s.textContent = t;
      cab.appendChild(s);
    });
    el.jogos.appendChild(cab);

    // Do mais recente para o mais antigo: a lista é para consulta, o gráfico é
    // para a evolução.
    jogos.slice().reverse().forEach(function (jogo) {
      var f = Estatisticas.ficha(jogo, jogador.uuid);
      var a = document.createElement('a');
      a.className = 'linha-comp';
      a.href = 'analise.html?p=' + encodeURIComponent(jogo.partida.uuid);

      var r = document.createElement('span');
      r.className = 'r';
      r.textContent = (jogo.partida.adversario || 'Sem adversário') + ' · ' +
        Dados.dataCurta(jogo.partida.data);
      a.appendChild(r);

      [1, 2, 'total'].forEach(function (c) {
        var s = document.createElement('span');
        s.className = 'v';
        s.textContent = (f && f.participou) ? fmt(metrica.valor(f, c)) : '-';
        a.appendChild(s);
      });
      el.jogos.appendChild(a);
    });
  }

  function renderTudo() {
    desenhar();
    renderTiles();
    renderRegularidade();
    renderJogos();
  }

  // ------------------------------------------------ controles

  function renderFiltro() {
    el.filtro.innerHTML = '';
    [{ chave: 'total', rotulo: 'Jogo todo' }, { chave: 1, rotulo: '1º tempo' }, { chave: 2, rotulo: '2º tempo' }]
      .forEach(function (o) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'segmento' + (o.chave === periodo ? ' ativo' : '');
        b.textContent = o.rotulo;
        b.setAttribute('aria-pressed', o.chave === periodo ? 'true' : 'false');
        b.addEventListener('click', function () {
          periodo = o.chave;
          renderFiltro();
          renderTudo();
        });
        el.filtro.appendChild(b);
      });
  }

  function renderMetricas() {
    Estatisticas.METRICAS.forEach(function (m) {
      var o = document.createElement('option');
      o.value = m.chave;
      o.textContent = m.rotulo;
      el.metrica.appendChild(o);
    });
    el.metrica.value = metrica.chave;
    el.metrica.addEventListener('change', function () {
      metrica = Estatisticas.metricaPor(el.metrica.value);
      renderTudo();
    });
  }

  // ------------------------------------------------ início

  function iniciar() {
    el = {
      titulo: document.getElementById('titulo'),
      subtitulo: document.getElementById('subtitulo'),
      metrica: document.getElementById('metrica'),
      filtro: document.getElementById('filtro'),
      molduraLinha: document.getElementById('moldura-linha'),
      gLinha: document.getElementById('g-linha'),
      tiles: document.getElementById('tiles'),
      regularidade: document.getElementById('regularidade'),
      jogos: document.getElementById('jogos'),
      nota: document.getElementById('rodape-nota')
    };

    window.addEventListener('resize', function () {
      clearTimeout(redesenho);
      redesenho = setTimeout(desenhar, 150);
    });

    var uuid = new URLSearchParams(location.search).get('j');
    if (!uuid) { location.replace('index.html'); return; }

    metrica = Estatisticas.metricaPor('acoes_min');

    Promise.all([DB.obter('jogador', uuid), Dados.carregarHistorico()]).then(function (r) {
      jogador = r[0];
      if (!jogador) { location.replace('index.html'); return; }

      jogos = r[1].map(function (pacote) {
        return Estatisticas.calcular(pacote.partida, pacote.eventos, pacote.passagens, pacote.jogadores);
      }).filter(function (jogo) {
        return !!Estatisticas.ficha(jogo, uuid);
      });

      el.titulo.childNodes[0].nodeValue = jogador.nome;
      el.subtitulo.textContent = '#' + (jogador.numero === null ? '--' : jogador.numero) +
        ' · ' + jogador.posicao + ' · ' + jogos.length +
        (jogos.length === 1 ? ' jogo' : ' jogos');
      el.nota.textContent = 'Buraco na linha é jogo em que ele não entrou em quadra, ' +
        'não é zero. Variação típica menor quer dizer mais constante.';

      renderMetricas();
      renderFiltro();
      renderTudo();
    }).catch(function (err) {
      console.error('falha abrindo a evolução do jogador', err);
    });
  }

  iniciar();
})();
