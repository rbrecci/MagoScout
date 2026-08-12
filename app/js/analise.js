// Análise de uma partida. Abre pelo histórico com ?p=<uuid>.
// A pergunta que esta tela responde primeiro é 1º contra 2º tempo — foi a
// primeira coisa que o Raul pediu para ver depois do jogo.

(function () {
  'use strict';

  var TIPOS_PARTIDA = { oficial: 'Oficial', amistoso: 'Amistoso', treino: 'Treino' };

  var res = null;
  var recorte = 'total';
  var metrica = null;
  var redesenho = null;
  var el = {};

  // ------------------------------------------------ formatação

  function fmtPct(v) { return v === null ? '—' : v + '%'; }
  function fmtMin(v) { return v === null ? '—' : v.toFixed(1); }
  function mmss(s) { return Estatisticas.mmss(s); }

  function nomeRecorte(r) {
    return r === 'total' ? 'jogo todo' : r + 'º tempo';
  }

  // ------------------------------------------------ comparativo do time

  // "Melhor quando maior" só serve para pintar a variação; nada aqui julga o
  // jogador sozinho, é leitura de tempo contra tempo.
  var LINHAS = [
    { rotulo: 'Ações',         tipo: 'n',   maiorMelhor: true,  calc: function (t, p) { return t.acoes[p]; } },
    { rotulo: 'Gols',          tipo: 'n',   maiorMelhor: true,  calc: function (t, p) { return t.tipos.gol[p]; } },
    { rotulo: 'Gols sofridos', tipo: 'n',   maiorMelhor: false, calc: function (t, p) { return t.tipos.gol_sofrido[p]; } },
    { rotulo: 'Finalização',   tipo: 'pct', maiorMelhor: true,  calc: function (t, p) { return t.aproveitamento.finalizacao[p]; } },
    { rotulo: 'Passe',         tipo: 'pct', maiorMelhor: true,  calc: function (t, p) { return t.aproveitamento.passe[p]; } },
    { rotulo: 'Drible',        tipo: 'pct', maiorMelhor: true,  calc: function (t, p) { return t.aproveitamento.drible[p]; } },
    { rotulo: 'Bolas roubadas',tipo: 'n',   maiorMelhor: true,  calc: function (t, p) { return t.tipos.bola_roubada[p]; } },
    { rotulo: 'Faltas',        tipo: 'n',   maiorMelhor: false, calc: function (t, p) { return t.tipos.falta_cometida[p]; } }
  ];

  function celula(valor, tipo) {
    var s = document.createElement('span');
    s.className = 'v';
    s.textContent = valor === null || valor === undefined
      ? '—'
      : (tipo === 'pct' ? valor + '%' : String(valor));
    return s;
  }

  function chipVariacao(linha, a, b) {
    var chip = document.createElement('span');
    chip.className = 'delta';
    if (a === null || b === null || a === undefined || b === undefined) {
      chip.textContent = '—';
      chip.classList.add('igual');
      return chip;
    }
    var d = b - a;
    if (d === 0) {
      chip.textContent = '=';
      chip.classList.add('igual');
      return chip;
    }
    var melhorou = linha.maiorMelhor ? d > 0 : d < 0;
    chip.classList.add(melhorou ? 'subiu' : 'caiu');
    chip.textContent = (d > 0 ? '+' : '−') + Math.abs(d) + (linha.tipo === 'pct' ? '%' : '');
    return chip;
  }

  function renderComparativo() {
    var t = res.time;
    var periodos = res.periodos;
    el.comparativo.innerHTML = '';

    if (!t.acoes.total) {
      var nada = document.createElement('p');
      nada.className = 'nada';
      nada.textContent = 'Nenhuma ação foi registrada nesta partida.';
      el.comparativo.appendChild(nada);
      return;
    }

    var cabecalho = document.createElement('div');
    cabecalho.className = 'linha-comp cabecalho';
    cabecalho.appendChild(document.createElement('span'));
    periodos.forEach(function (p) {
      var c = document.createElement('span');
      c.className = 'v';
      c.textContent = p + 'º';
      cabecalho.appendChild(c);
    });
    if (periodos.length === 2) {
      var d = document.createElement('span');
      d.className = 'v';
      d.textContent = 'var.';
      cabecalho.appendChild(d);
    }
    el.comparativo.appendChild(cabecalho);

    LINHAS.forEach(function (linha) {
      var div = document.createElement('div');
      div.className = 'linha-comp';
      var r = document.createElement('span');
      r.className = 'r';
      r.textContent = linha.rotulo;
      div.appendChild(r);
      periodos.forEach(function (p) {
        div.appendChild(celula(linha.calc(t, p), linha.tipo));
      });
      if (periodos.length === 2) {
        div.appendChild(chipVariacao(linha, linha.calc(t, periodos[0]), linha.calc(t, periodos[1])));
      }
      el.comparativo.appendChild(div);
    });
  }

  // ------------------------------------------------ filtro de período

  function renderFiltro() {
    el.filtro.innerHTML = '';
    var opcoes = [{ chave: 'total', rotulo: 'Jogo todo' }];
    res.periodos.forEach(function (p) {
      opcoes.push({ chave: p, rotulo: p + 'º tempo' });
    });

    opcoes.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'segmento' + (o.chave === recorte ? ' ativo' : '');
      b.textContent = o.rotulo;
      b.setAttribute('aria-pressed', o.chave === recorte ? 'true' : 'false');
      b.addEventListener('click', function () {
        recorte = o.chave;
        renderFiltro();
        renderTiles();
        renderJogadores();
        graficoJogadores();
      });
      el.filtro.appendChild(b);
    });
  }

  // ------------------------------------------------ números do time

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
    var t = res.time;
    var p = recorte;
    el.tiles.innerHTML = '';
    el.tiles.appendChild(tile(t.acoes[p], 'ações no ' + nomeRecorte(p)));
    el.tiles.appendChild(tile(fmtPct(t.aproveitamento.finalizacao[p]), 'finalização'));
    el.tiles.appendChild(tile(fmtPct(t.aproveitamento.passe[p]), 'passe'));
    el.tiles.appendChild(tile(fmtPct(t.aproveitamento.drible[p]), 'drible'));
    el.tiles.appendChild(tile(t.tipos.bola_roubada[p], 'bolas roubadas'));
    el.tiles.appendChild(tile(t.tipos.falta_cometida[p], 'faltas cometidas'));
    el.tiles.appendChild(tile(
      t.tipos.escanteio_ofensivo[p] + ' / ' + t.tipos.escanteio_defensivo[p],
      'escanteios of/def'));
    el.tiles.appendChild(tile(
      t.tipos.lateral_ofensivo[p] + ' / ' + t.tipos.lateral_defensivo[p],
      'laterais of/def'));
  }

  // ------------------------------------------------ gráficos

  function larguraUtil(moldura) {
    var estilo = getComputedStyle(moldura);
    return Math.max(240, moldura.clientWidth -
      parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight));
  }

  function graficoPeriodos() {
    var t = res.time;
    var per = res.periodos;
    if (!t.acoes.total) { el.molduraPeriodos.hidden = true; return; }
    el.molduraPeriodos.hidden = false;

    var c = Grafico.cores();
    var largura = larguraUtil(el.molduraPeriodos);
    var altura = 200;
    var ctx = Grafico.preparar(el.gPeriodos, largura, altura);
    var series = per.map(function (n, i) {
      return { rotulo: n + 'º tempo', cor: i === 0 ? c.azul : c.ouro };
    });

    Grafico.barras(ctx, { x: 0, y: 0, w: largura, h: altura - 24 }, {
      formato: 'pct',
      max: 100,
      series: series,
      grupos: [
        { rotulo: 'Finalização', valores: per.map(function (n) { return t.aproveitamento.finalizacao[n]; }) },
        { rotulo: 'Passe', valores: per.map(function (n) { return t.aproveitamento.passe[n]; }) },
        { rotulo: 'Drible', valores: per.map(function (n) { return t.aproveitamento.drible[n]; }) }
      ]
    });
    Grafico.legenda(ctx, 0, altura - 4, series, 1);
  }

  function graficoJogadores() {
    var p = recorte;
    var itens = res.jogadores
      .filter(function (f) { return f.segundos[p] > 0 || f.acoes[p] > 0; })
      .map(function (f) {
        return {
          rotulo: f.jogador.nome.split(' ')[0] + (f.jogador.numero === null ? '' : ' ' + f.jogador.numero),
          valor: metrica.valor(f, p)
        };
      })
      .sort(function (a, b) { return (b.valor === null ? -1 : b.valor) - (a.valor === null ? -1 : a.valor); });

    if (!itens.length) { el.molduraJogadores.hidden = true; return; }
    el.molduraJogadores.hidden = false;

    var largura = larguraUtil(el.molduraJogadores);
    var altura = itens.length * 34 + 26;
    var ctx = Grafico.preparar(el.gJogadores, largura, altura);
    var mediaTime = Estatisticas.referenciaDoTime(res, metrica, p);

    Grafico.barrasH(ctx, { x: 0, y: 20, w: largura, h: altura - 24 }, {
      formato: metrica.formato,
      itens: itens,
      referencia: mediaTime ? {
        valor: mediaTime,
        rotulo: 'time ' + Grafico.fmt(mediaTime, metrica.formato)
      } : null
    });
  }

  // A média do time é por jogador em quadra, não por jogo: é com ela que a
  // barra de cada um tem que ser comparada.
  function desenharGraficos() {
    if (!res) { return; }
    graficoPeriodos();
    graficoJogadores();
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
      graficoJogadores();
    });
  }

  // ------------------------------------------------ lista de jogadores

  function taxasResumo(f) {
    var p = recorte;
    var ehGoleiro = f.jogador.posicao === 'goleiro';
    var partes = [
      'FIN ' + fmtPct(f.aproveitamento.finalizacao[p]),
      'DRB ' + fmtPct(f.aproveitamento.drible[p]),
      'PAS ' + fmtPct(f.aproveitamento.passe[p])
    ];
    if (ehGoleiro) {
      partes = [
        'DEF ' + f.tipos.defesa[p],
        'GS ' + f.tipos.gol_sofrido[p],
        'REP ' + fmtPct(f.aproveitamento.reposicao[p]),
        'PAS ' + fmtPct(f.aproveitamento.passe[p])
      ];
    }
    return partes.join(' · ');
  }

  function renderJogadores() {
    var p = recorte;
    el.jogadores.innerHTML = '';

    if (!res.jogadores.length) {
      var vazio = document.createElement('p');
      vazio.className = 'nada';
      vazio.textContent = 'Nenhum jogador foi relacionado para esta partida.';
      el.jogadores.appendChild(vazio);
      return;
    }

    res.jogadores.forEach(function (f) {
      var j = f.jogador;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'item-lista' + (j.posicao === 'goleiro' ? ' goleiro' : '') +
        (f.segundos[p] || f.acoes[p] ? '' : ' apagado');

      var camisa = document.createElement('span');
      camisa.className = 'camisa';
      camisa.textContent = j.numero === null ? '--' : j.numero;

      var corpo = document.createElement('div');
      corpo.className = 'corpo';

      var titulo = document.createElement('span');
      titulo.className = 'titulo';
      titulo.textContent = j.nome;

      var apoio = document.createElement('span');
      apoio.className = 'apoio';
      apoio.textContent = mmss(f.segundos[p]) + ' em quadra · ' + f.acoes[p] +
        (f.acoes[p] === 1 ? ' ação' : ' ações') +
        ' · ' + fmtMin(Estatisticas.porMinuto(f.acoes[p], f.segundos[p])) + '/min';

      var taxas = document.createElement('span');
      taxas.className = 'taxas';
      taxas.textContent = taxasResumo(f);

      corpo.appendChild(titulo);
      corpo.appendChild(apoio);
      corpo.appendChild(taxas);

      var seta = document.createElement('span');
      seta.className = 'seta';
      seta.textContent = '›';

      b.appendChild(camisa);
      b.appendChild(corpo);
      b.appendChild(seta);
      b.setAttribute('aria-label', 'Números de ' + j.nome);
      b.addEventListener('click', function () { abrirJogador(f); });
      el.jogadores.appendChild(b);
    });
  }

  // ------------------------------------------------ detalhe do jogador

  function linhaDetalhe(rotulo, valores, destaque) {
    var div = document.createElement('div');
    div.className = 'linha-comp' + (destaque ? ' destaque' : '');
    var r = document.createElement('span');
    r.className = 'r';
    r.textContent = rotulo;
    div.appendChild(r);
    valores.forEach(function (v) {
      var s = document.createElement('span');
      s.className = 'v';
      s.textContent = v;
      div.appendChild(s);
    });
    return div;
  }

  function abrirJogador(f) {
    var j = f.jogador;
    var periodos = res.periodos;
    var colunas = periodos.concat(['total']);
    var caixa = document.createElement('div');

    var tabela = document.createElement('div');
    tabela.className = 'comparativo';

    var cab = document.createElement('div');
    cab.className = 'linha-comp cabecalho';
    cab.appendChild(document.createElement('span'));
    colunas.forEach(function (c) {
      var s = document.createElement('span');
      s.className = 'v';
      s.textContent = c === 'total' ? 'jogo' : c + 'º';
      cab.appendChild(s);
    });
    tabela.appendChild(cab);

    tabela.appendChild(linhaDetalhe('Tempo em quadra', colunas.map(function (c) {
      return mmss(f.segundos[c]);
    }), true));

    var registrou = false;
    TIPOS.forEach(function (t) {
      if (t.escopo !== 'jogador' || !f.tipos[t.codigo].total) { return; }
      registrou = true;
      tabela.appendChild(linhaDetalhe(t.rotulo, colunas.map(function (c) {
        return String(f.tipos[t.codigo][c]);
      })));
    });

    if (!registrou) {
      var nada = document.createElement('p');
      nada.className = 'nada';
      nada.textContent = 'Nenhuma ação registrada para este jogador.';
      tabela.appendChild(nada);
    }

    tabela.appendChild(linhaDetalhe('Ações por minuto', colunas.map(function (c) {
      return fmtMin(Estatisticas.porMinuto(f.acoes[c], f.segundos[c]));
    }), true));

    // Só entra a taxa de quem tentou: linha de "—" em todo lugar é ruído na
    // conversa com o jogador.
    var taxas = [
      { rotulo: 'Finalização', chave: 'finalizacao' },
      { rotulo: 'Drible', chave: 'drible' },
      { rotulo: 'Passe', chave: 'passe' },
      { rotulo: 'Reposição', chave: 'reposicao' }
    ].filter(function (t) { return f.aproveitamento[t.chave].total !== null; });

    taxas.forEach(function (t) {
      tabela.appendChild(linhaDetalhe(t.rotulo + ' %', colunas.map(function (c) {
        return fmtPct(f.aproveitamento[t.chave][c]);
      }), true));
    });

    caixa.appendChild(tabela);

    var media = document.createElement('p');
    media.className = 'dica';
    media.style.marginTop = '12px';
    var porMin = Estatisticas.metricaPor('acoes_min');
    var mediaTime = Estatisticas.referenciaDoTime(res, porMin, 'total');
    var doJogador = porMin.valor(f, 'total');
    media.textContent = (doJogador === null || mediaTime === null)
      ? 'Sem tempo em quadra para comparar com o time.'
      : 'Média do time no jogo: ' + fmtMin(mediaTime) + ' ações por minuto. ' +
        j.nome.split(' ')[0] + ': ' + fmtMin(doJogador) + '.';
    caixa.appendChild(media);

    var evolucao = document.createElement('a');
    evolucao.className = 'bt-secundario bloco-centrado';
    evolucao.href = 'jogador.html?j=' + encodeURIComponent(j.uuid);
    evolucao.textContent = 'Evolução jogo a jogo';
    caixa.appendChild(evolucao);

    el.painelTitulo.childNodes[0].nodeValue = j.nome;
    el.painelSub.textContent = '#' + (j.numero === null ? '--' : j.numero) + ' · ' +
      j.posicao + ' · ' + mmss(f.segundos.total) + ' no jogo';
    el.painelCorpo.innerHTML = '';
    el.painelCorpo.appendChild(caixa);
    el.painel.hidden = false;
  }

  function fecharPainel() { el.painel.hidden = true; }

  // ------------------------------------------------ cabeçalho

  function renderCabecalho() {
    var p = res.partida;
    el.titulo.childNodes[0].nodeValue = p.adversario || 'Sem adversário anotado';
    el.subtitulo.textContent = [
      Dados.dataCurta(p.data),
      p.campeonato || TIPOS_PARTIDA[p.tipo] || p.tipo,
      p.periodos + ' × ' + p.minutosPeriodo + ' min'
    ].join(' · ');

    el.golsPro.textContent = res.golsPro;
    el.golsContra.textContent = res.golsContra;

    var emAndamento = p.status === 'em_andamento';
    el.resumo.textContent = (emAndamento ? 'Em andamento · ' : '') +
      res.time.acoes.total + ' ações registradas · ' +
      res.jogadores.filter(function (f) { return f.participou; }).length + ' jogadores em quadra';

    el.nota.textContent = 'Aproveitamento de finalização conta o gol como acerto. ' +
      'Tudo comparado por minuto jogado.';
  }

  // ------------------------------------------------ início

  function iniciar() {
    el = {
      titulo: document.getElementById('titulo'),
      subtitulo: document.getElementById('subtitulo'),
      golsPro: document.getElementById('gols-pro'),
      golsContra: document.getElementById('gols-contra'),
      resumo: document.getElementById('resumo-jogo'),
      comparativo: document.getElementById('comparativo'),
      filtro: document.getElementById('filtro'),
      tiles: document.getElementById('tiles'),
      jogadores: document.getElementById('jogadores'),
      metrica: document.getElementById('metrica'),
      molduraPeriodos: document.getElementById('moldura-periodos'),
      molduraJogadores: document.getElementById('moldura-jogadores'),
      gPeriodos: document.getElementById('g-periodos'),
      gJogadores: document.getElementById('g-jogadores'),
      relatorio: document.getElementById('bt-relatorio'),
      nota: document.getElementById('rodape-nota'),
      painel: document.getElementById('painel'),
      painelTitulo: document.getElementById('painel-titulo'),
      painelSub: document.getElementById('painel-sub'),
      painelCorpo: document.getElementById('painel-corpo')
    };

    document.getElementById('fechar-painel').addEventListener('click', fecharPainel);
    el.painel.addEventListener('click', function (e) {
      if (e.target === el.painel) { fecharPainel(); }
    });

    // Canvas não se redimensiona sozinho: quem gira o celular no vestiário
    // precisa ver o gráfico inteiro, não um pedaço esticado.
    window.addEventListener('resize', function () {
      clearTimeout(redesenho);
      redesenho = setTimeout(desenharGraficos, 150);
    });

    el.relatorio.addEventListener('click', function () {
      if (!res) { return; }
      el.relatorio.disabled = true;
      el.relatorio.textContent = 'Gerando…';
      Relatorio.exportar(res).then(function (destino) {
        el.relatorio.textContent = destino === 'baixado'
          ? 'Imagem salva' : 'Gerar imagem do jogo';
        el.relatorio.disabled = false;
      }).catch(function (err) {
        console.error('falha gerando a imagem', err);
        el.relatorio.textContent = 'Não deu para gerar a imagem';
        el.relatorio.disabled = false;
      });
    });

    var uuid = new URLSearchParams(location.search).get('p');
    if (!uuid) { location.replace('index.html'); return; }

    metrica = Estatisticas.metricaPor('acoes_min');

    Dados.carregarPartida(uuid).then(function (pacote) {
      if (!pacote) { location.replace('index.html'); return; }
      res = Estatisticas.calcular(pacote.partida, pacote.eventos, pacote.passagens, pacote.jogadores);
      renderCabecalho();
      renderComparativo();
      renderFiltro();
      renderTiles();
      renderMetricas();
      renderJogadores();
      desenharGraficos();
    }).catch(function (err) {
      console.error('falha abrindo a análise', err);
    });
  }

  iniciar();
})();
