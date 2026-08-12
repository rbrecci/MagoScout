// Desenho dos gráficos, em canvas 2D puro.
//
// Sem biblioteca: o app é offline-first e roda em hospedagem grátis, então
// depender de um arquivo de 200 KB para desenhar três formas geométricas sairia
// caro nos dois lados. O ganho real é outro: a mesma função que desenha na
// tela desenha o relatório em imagem, que é canvas de qualquer jeito. Basta
// trocar o contexto e a escala.

var Grafico = (function () {
  'use strict';

  var paleta = null;

  function cores() {
    if (paleta) { return paleta; }
    var raiz = getComputedStyle(document.documentElement);
    function ler(nome, alternativa) {
      var v = raiz.getPropertyValue('--' + nome).trim();
      return v || alternativa;
    }
    paleta = {
      ink: ler('ink', '#EAF3FB'),
      fraco: ler('ink-fraco', '#9FBCD6'),
      linha: ler('linha', '#1E4467'),
      azul: ler('azul', '#2E9BE0'),
      card: ler('card', '#12304C'),
      cardAlto: ler('card-alto', '#1A4067'),
      certo: ler('certo', '#3FB984'),
      errado: ler('errado', '#E2685C'),
      ouro: ler('ouro', '#F2C14E'),
      escuro: ler('azul-escuro', '#061A2B')
    };
    return paleta;
  }

  var FONTE = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  function fonte(ctx, tamanho, peso) {
    ctx.font = (peso || 600) + ' ' + tamanho + 'px ' + FONTE;
  }

  // O canvas da tela precisa da densidade do aparelho para o texto não sair
  // borrado; o do relatório já nasce grande e não usa isso.
  function preparar(canvas, largura, altura) {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(largura * dpr);
    canvas.height = Math.round(altura * dpr);
    canvas.style.width = largura + 'px';
    canvas.style.height = altura + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, largura, altura);
    return ctx;
  }

  function retangulo(ctx, x, y, w, h, raio) {
    var r = Math.min(raio, Math.abs(w) / 2, Math.abs(h) / 2);
    if (h <= 0 || w <= 0) { return; }
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
    ctx.fill();
  }

  function texto(ctx, s, x, y, cor, tamanho, alinhamento, peso) {
    fonte(ctx, tamanho, peso);
    ctx.fillStyle = cor;
    ctx.textAlign = alinhamento || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(s, x, y);
  }

  function corta(ctx, s, larguraMax) {
    if (ctx.measureText(s).width <= larguraMax) { return s; }
    var corte = s;
    while (corte.length > 1 && ctx.measureText(corte + '…').width > larguraMax) {
      corte = corte.slice(0, -1);
    }
    return corte + '…';
  }

  function maiorValor(listas, minimo) {
    var m = minimo || 0;
    listas.forEach(function (l) {
      l.forEach(function (v) { if (v !== null && v !== undefined && v > m) { m = v; } });
    });
    return m;
  }

  function fmt(v, formato) {
    if (v === null || v === undefined) { return '-'; }
    if (formato === 'pct') { return Math.round(v) + '%'; }
    if (formato === 'taxa') { return v.toFixed(1); }
    if (formato === 'tempo') {
      var m = Math.floor(v / 60);
      return m + "'";
    }
    return String(Math.round(v * 10) / 10);
  }

  // ------------------------------------------------ barras agrupadas

  // opcoes: { grupos: [{rotulo, valores:[]}], series: [{rotulo, cor}],
  //           formato, max, escala }
  function barras(ctx, area, opcoes) {
    var c = cores();
    var e = opcoes.escala || 1;
    var series = opcoes.series;
    var grupos = opcoes.grupos;
    var formato = opcoes.formato;

    var alturaValor = 15 * e;
    var alturaRotulo = 17 * e;
    var base = area.y + area.h - alturaRotulo;
    var alturaPlot = area.h - alturaRotulo - alturaValor;
    var max = opcoes.max || maiorValor(grupos.map(function (g) { return g.valores; }), 0) * 1.18 || 1;

    ctx.strokeStyle = c.linha;
    ctx.lineWidth = Math.max(1, e * 0.8);
    ctx.beginPath();
    ctx.moveTo(area.x, base + 0.5);
    ctx.lineTo(area.x + area.w, base + 0.5);
    ctx.stroke();

    var larguraGrupo = area.w / grupos.length;
    var vao = 4 * e;
    var larguraBarra = Math.min(30 * e, (larguraGrupo - 14 * e - vao * (series.length - 1)) / series.length);

    grupos.forEach(function (g, i) {
      var centro = area.x + larguraGrupo * i + larguraGrupo / 2;
      var largoTotal = larguraBarra * series.length + vao * (series.length - 1);
      var inicio = centro - largoTotal / 2;

      series.forEach(function (s, k) {
        var v = g.valores[k];
        var x = inicio + k * (larguraBarra + vao);
        if (v === null || v === undefined) {
          texto(ctx, '-', x + larguraBarra / 2, base - 4 * e, c.fraco, 11 * e, 'center');
          return;
        }
        var altura = Math.max(2 * e, (Math.min(v, max) / max) * alturaPlot);
        ctx.fillStyle = s.cor;
        retangulo(ctx, x, base - altura, larguraBarra, altura, 4 * e);
        texto(ctx, fmt(v, formato), x + larguraBarra / 2, base - altura - 5 * e, c.ink, 11.5 * e, 'center', 700);
      });

      fonte(ctx, 11.5 * e, 600);
      texto(ctx, corta(ctx, g.rotulo, larguraGrupo - 4 * e), centro, base + 13 * e, c.fraco, 11.5 * e, 'center');
    });
  }

  // ------------------------------------------------ barras horizontais

  // Para comparar jogadores entre si com o time inteiro à vista: a linha
  // tracejada é a média, e ela é o assunto da tela.
  // opcoes: { itens: [{rotulo, valor, destaque}], referencia: {valor, rotulo},
  //           formato, escala, larguraRotulo }
  function barrasH(ctx, area, opcoes) {
    var c = cores();
    var e = opcoes.escala || 1;
    var itens = opcoes.itens;
    if (!itens.length) { return; }

    var larguraRotulo = opcoes.larguraRotulo || 86 * e;
    var larguraValor = 40 * e;
    var x0 = area.x + larguraRotulo;
    var largura = area.w - larguraRotulo - larguraValor;
    var alturaLinha = area.h / itens.length;
    var alturaBarra = Math.min(20 * e, alturaLinha - 8 * e);

    var valores = itens.map(function (i) { return i.valor; });
    if (opcoes.referencia) { valores.push(opcoes.referencia.valor); }
    var max = maiorValor([valores], 0) * 1.12 || 1;

    itens.forEach(function (item, i) {
      var meio = area.y + alturaLinha * i + alturaLinha / 2;
      fonte(ctx, 12 * e, 600);
      texto(ctx, corta(ctx, item.rotulo, larguraRotulo - 8 * e), area.x, meio + 4 * e,
        item.destaque ? c.ink : c.fraco, 12 * e, 'left', item.destaque ? 800 : 600);

      ctx.fillStyle = c.cardAlto;
      retangulo(ctx, x0, meio - alturaBarra / 2, largura, alturaBarra, alturaBarra / 2);

      if (item.valor !== null && item.valor !== undefined) {
        var w = Math.max(alturaBarra, (Math.min(item.valor, max) / max) * largura);
        ctx.fillStyle = item.destaque ? c.ouro : c.azul;
        retangulo(ctx, x0, meio - alturaBarra / 2, w, alturaBarra, alturaBarra / 2);
      }
      texto(ctx, fmt(item.valor, opcoes.formato), area.x + area.w, meio + 4 * e, c.ink, 12 * e, 'right', 700);
    });

    if (opcoes.referencia && opcoes.referencia.valor) {
      var xr = x0 + (Math.min(opcoes.referencia.valor, max) / max) * largura;
      ctx.save();
      ctx.strokeStyle = c.errado;
      ctx.lineWidth = Math.max(1, 1.4 * e);
      ctx.setLineDash([4 * e, 4 * e]);
      ctx.beginPath();
      ctx.moveTo(xr, area.y);
      ctx.lineTo(xr, area.y + area.h);
      ctx.stroke();
      ctx.restore();
      texto(ctx, opcoes.referencia.rotulo, xr, area.y - 4 * e, c.errado, 10.5 * e,
        xr > area.x + area.w * 0.7 ? 'right' : 'left', 700);
    }
  }

  // ------------------------------------------------ linha

  // opcoes: { rotulos: [], series: [{rotulo, cor, valores: [], tracejada}],
  //           formato, max, escala }
  function linha(ctx, area, opcoes) {
    var c = cores();
    var e = opcoes.escala || 1;
    var eixoY = 32 * e;
    var alturaRotulo = 16 * e;
    var x0 = area.x + eixoY;
    var largura = area.w - eixoY;
    var topo = area.y + 6 * e;
    var base = area.y + area.h - alturaRotulo;
    var alturaPlot = base - topo;

    var max = opcoes.max ||
      maiorValor(opcoes.series.map(function (s) { return s.valores; }), 0) * 1.15 || 1;

    // Três linhas de grade: o suficiente para ler a altura sem virar papel
    // quadriculado.
    [0, 0.5, 1].forEach(function (f) {
      var y = base - alturaPlot * f;
      ctx.strokeStyle = c.linha;
      ctx.lineWidth = Math.max(1, e * 0.8);
      ctx.beginPath();
      ctx.moveTo(x0, y + 0.5);
      ctx.lineTo(x0 + largura, y + 0.5);
      ctx.stroke();
      texto(ctx, fmt(max * f, opcoes.formato), x0 - 5 * e, y + 4 * e, c.fraco, 10 * e, 'right');
    });

    var n = opcoes.rotulos.length;
    var passo = n > 1 ? largura / (n - 1) : 0;
    var xDe = function (i) { return n > 1 ? x0 + passo * i : x0 + largura / 2; };
    var yDe = function (v) { return base - (Math.min(v, max) / max) * alturaPlot; };

    opcoes.series.forEach(function (s) {
      ctx.save();
      ctx.strokeStyle = s.cor;
      ctx.lineWidth = Math.max(1.5, 2.2 * e);
      if (s.tracejada) { ctx.setLineDash([5 * e, 4 * e]); ctx.lineWidth = Math.max(1, 1.6 * e); }
      ctx.beginPath();
      var caneta = false;
      s.valores.forEach(function (v, i) {
        if (v === null || v === undefined) { caneta = false; return; }
        if (caneta) { ctx.lineTo(xDe(i), yDe(v)); } else { ctx.moveTo(xDe(i), yDe(v)); caneta = true; }
      });
      ctx.stroke();
      ctx.restore();

      if (s.tracejada) { return; }
      s.valores.forEach(function (v, i) {
        if (v === null || v === undefined) { return; }
        ctx.fillStyle = s.cor;
        ctx.beginPath();
        ctx.arc(xDe(i), yDe(v), 3.4 * e, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    fonte(ctx, 10 * e, 600);
    var pulo = Math.ceil(n / Math.max(1, Math.floor(largura / (34 * e))));
    opcoes.rotulos.forEach(function (r, i) {
      if (i % pulo !== 0 && i !== n - 1) { return; }
      texto(ctx, r, xDe(i), base + 12 * e, c.fraco, 10 * e, 'center');
    });
  }

  // ------------------------------------------------ legenda

  function legenda(ctx, x, y, series, escala) {
    var c = cores();
    var e = escala || 1;
    var cursor = x;
    series.forEach(function (s) {
      ctx.fillStyle = s.cor;
      retangulo(ctx, cursor, y - 8 * e, 10 * e, 10 * e, 3 * e);
      fonte(ctx, 11 * e, 600);
      texto(ctx, s.rotulo, cursor + 14 * e, y, c.fraco, 11 * e);
      cursor += 14 * e + ctx.measureText(s.rotulo).width + 14 * e;
    });
  }

  return {
    cores: cores,
    preparar: preparar,
    barras: barras,
    barrasH: barrasH,
    linha: linha,
    legenda: legenda,
    texto: texto,
    retangulo: retangulo,
    corta: corta,
    fmt: fmt
  };
})();
