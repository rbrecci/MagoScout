// Relatório do jogo em imagem, o formato que o Raul pediu para mandar no
// grupo. Não é PDF e não é Excel: é um PNG que se vê na conversa sem baixar
// nada.
//
// Desenha no mesmo módulo de gráfico da tela, só que num canvas de 1080×1350
// (4:5, o retrato que o WhatsApp não corta) e com a escala maior.

var Relatorio = (function () {
  'use strict';

  var L = 1080;
  var A = 1350;
  var E = 2.2;
  var MARGEM = 64;

  function cabecalho(ctx, res, c) {
    var p = res.partida;
    Grafico.texto(ctx, 'MagoScout', MARGEM, 92, c.azul, 44, 'left', 800);
    Grafico.texto(ctx, [
      Dados.dataCurta(p.data),
      p.campeonato || p.tipo,
      p.periodos + ' × ' + p.minutosPeriodo + ' min'
    ].join('  ·  '), L - MARGEM, 92, c.fraco, 26, 'right', 600);

    ctx.strokeStyle = c.linha;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(MARGEM, 124);
    ctx.lineTo(L - MARGEM, 124);
    ctx.stroke();

    Grafico.texto(ctx, p.adversario ? 'contra ' + p.adversario : 'sem adversário anotado',
      L / 2, 196, c.fraco, 32, 'center', 600);
    Grafico.texto(ctx, res.golsPro + '  ×  ' + res.golsContra, L / 2, 316, c.ink, 118, 'center', 800);
  }

  function blocoPeriodos(ctx, res, c) {
    var t = res.time;
    var per = res.periodos;
    Grafico.texto(ctx, '1º CONTRA 2º TEMPO', MARGEM, 420, c.fraco, 24, 'left', 800);

    var series = per.map(function (n, i) {
      return { rotulo: n + 'º tempo', cor: i === 0 ? c.azul : c.ouro };
    });

    Grafico.barras(ctx, { x: MARGEM, y: 452, w: L - MARGEM * 2, h: 250 }, {
      escala: E,
      formato: 'pct',
      max: 100,
      series: series,
      grupos: [
        { rotulo: 'Finalização', valores: per.map(function (n) { return t.aproveitamento.finalizacao[n]; }) },
        { rotulo: 'Passe', valores: per.map(function (n) { return t.aproveitamento.passe[n]; }) },
        { rotulo: 'Drible', valores: per.map(function (n) { return t.aproveitamento.drible[n]; }) }
      ]
    });

    Grafico.legenda(ctx, MARGEM, 736, series, E);

    // Os números que a barra não conta: gols e volume. Em linha própria, porque ao
    // lado da legenda eles se atropelavam assim que o placar passava de um
    // dígito.
    var linha = per.map(function (n) {
      return n + 'º: ' + t.acoes[n] + ' ações · ' + t.tipos.gol[n] + ' gol' +
        (t.tipos.gol[n] === 1 ? '' : 's') + ' · ' + t.tipos.gol_sofrido[n] + ' sofrido' +
        (t.tipos.gol_sofrido[n] === 1 ? '' : 's');
    }).join('        ');
    Grafico.texto(ctx, linha, MARGEM, 782, c.fraco, 22, 'left', 600);
  }

  function blocoJogadores(ctx, res, c) {
    Grafico.texto(ctx, 'AÇÕES POR MINUTO EM QUADRA', MARGEM, 830, c.fraco, 24, 'left', 800);

    var metrica = Estatisticas.metricaPor('acoes_min');
    var itens = res.jogadores.filter(function (f) { return f.participou; })
      .map(function (f) {
        return {
          rotulo: f.jogador.nome.split(' ')[0] + (f.jogador.numero === null ? '' : ' ' + f.jogador.numero),
          valor: metrica.valor(f, 'total')
        };
      })
      .sort(function (a, b) { return (b.valor || 0) - (a.valor || 0); })
      // Seis cabem sem encostar no rodapé; quem ficou de fora aparece na tela,
      // que é onde se olha o elenco inteiro.
      .slice(0, 6);

    var mediaTime = Estatisticas.referenciaDoTime(res, metrica, 'total');

    Grafico.barrasH(ctx, { x: MARGEM, y: 890, w: L - MARGEM * 2, h: Math.max(120, itens.length * 52) }, {
      escala: E,
      formato: 'taxa',
      larguraRotulo: 210,
      itens: itens,
      referencia: mediaTime ? { valor: mediaTime, rotulo: 'média do time ' + mediaTime.toFixed(1) } : null
    });
  }

  function rodape(ctx, res, c) {
    var jogaram = res.jogadores.filter(function (f) { return f.participou; }).length;
    Grafico.texto(ctx,
      res.time.acoes.total + ' ações registradas · ' + jogaram + ' jogadores · ' +
      Estatisticas.mmss(res.time.segundos.total) + ' de tempo somado em quadra',
      L / 2, A - 78, c.fraco, 23, 'center', 600);
    ctx.save();
    ctx.globalAlpha = 0.55;
    Grafico.texto(ctx, 'gerado no MagoScout', L / 2, A - 44, c.fraco, 21, 'center', 700);
    ctx.restore();
  }

  function desenhar(res) {
    var c = Grafico.cores();
    var canvas = document.createElement('canvas');
    canvas.width = L;
    canvas.height = A;
    var ctx = canvas.getContext('2d');

    var fundo = ctx.createLinearGradient(0, 0, L * 0.4, A);
    fundo.addColorStop(0, c.card);
    fundo.addColorStop(0.55, c.escuro);
    fundo.addColorStop(1, c.escuro);
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, L, A);

    cabecalho(ctx, res, c);
    blocoPeriodos(ctx, res, c);
    blocoJogadores(ctx, res, c);
    rodape(ctx, res, c);

    return canvas;
  }

  function nomeArquivo(p) {
    var quem = (p.adversario || 'jogo').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return 'MagoScout-' + quem + '-' + p.data + '.png';
  }

  // Compartilhar quando o aparelho souber (celular), baixar quando não souber
  // (computador). Quem decide para onde vai a imagem é sempre o Raul, na
  // bandeja do próprio sistema.
  function exportar(res) {
    var canvas = desenhar(res);
    var nome = nomeArquivo(res.partida);
    return new Promise(function (ok, falha) {
      canvas.toBlob(function (blob) {
        if (!blob) { falha(new Error('canvas vazio')); return; }
        var arquivo = null;
        try { arquivo = new File([blob], nome, { type: 'image/png' }); } catch (e) { arquivo = null; }

        if (arquivo && navigator.canShare && navigator.canShare({ files: [arquivo] })) {
          navigator.share({ files: [arquivo] })
            .then(function () { ok('compartilhado'); })
            .catch(function () { ok('cancelado'); });
          return;
        }

        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = nome;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        ok('baixado');
      }, 'image/png');
    });
  }

  return { desenhar: desenhar, exportar: exportar, nomeArquivo: nomeArquivo };
})();
