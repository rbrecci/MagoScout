// A página que os jogadores abrem. Somente leitura, sem conta e sem senha.
//
// Não usa IndexedDB: lê direto do servidor pelo token da URL. Quem abre isto é
// o atleta no celular dele, não o Raul. Nada aqui grava nada.
//
// O ranking tem botão de trocar o critério de propósito. A tela não responde
// "quem é o melhor", responde "quem mais faz isso": nenhuma métrica é a
// padrão privilegiada, a primeira é só a primeira, e a troca fica à vista.

(function () {
  'use strict';

  var dados = null;
  var jogos = [];
  var temporada = null;
  var criterio = null;

  var el = {
    titulo: document.getElementById('titulo'),
    subtitulo: document.getElementById('subtitulo'),
    criterio: document.getElementById('criterio'),
    ranking: document.getElementById('ranking'),
    jogos: document.getElementById('jogos'),
    rodape: document.getElementById('rodape'),
    painel: document.getElementById('painel'),
    painelTitulo: document.getElementById('painel-titulo'),
    painelSub: document.getElementById('painel-sub'),
    painelCorpo: document.getElementById('painel-corpo')
  };

  // A página pública não carrega o módulo de gráfico: formata sozinha.
  function texto(v, formato) {
    if (v === null || v === undefined) { return '-'; }
    if (formato === 'pct') { return Math.round(v) + '%'; }
    if (formato === 'taxa') { return v.toFixed(1); }
    if (formato === 'tempo') { return Estatisticas.mmss(v); }
    return String(Math.round(v * 10) / 10);
  }

  // ------------------------------------------------ montagem dos jogos

  function montarJogos(d) {
    var porPartida = {};
    (d.convocacoes || []).forEach(function (c) { porPartida[c.partida_uuid] = c.jogadores || []; });

    var eventos = {};
    (d.eventos || []).forEach(function (e) {
      (eventos[e.partida_uuid] = eventos[e.partida_uuid] || []).push({
        uuid: e.uuid, partida_uuid: e.partida_uuid, jogador_uuid: e.jogador_uuid,
        tipo: e.tipo, periodo: Number(e.periodo), segundo: Number(e.segundo),
        anulado: Number(e.anulado || 0)
      });
    });

    var passagens = {};
    (d.passagens || []).forEach(function (p) {
      (passagens[p.partida_uuid] = passagens[p.partida_uuid] || []).push({
        uuid: p.uuid, partida_uuid: p.partida_uuid, jogador_uuid: p.jogador_uuid,
        periodo: Number(p.periodo), entrou: Number(p.entrou),
        saiu: p.saiu === null || p.saiu === undefined ? null : Number(p.saiu)
      });
    });

    var elenco = {};
    (d.jogadores || []).forEach(function (j) {
      elenco[j.uuid] = {
        uuid: j.uuid,
        nome: j.nome,
        numero: j.numero === null || j.numero === undefined ? null : Number(j.numero),
        posicao: j.posicao
      };
    });

    var ORDEM = { goleiro: 0, fixo: 1, ala: 2, pivo: 3 };

    return (d.partidas || []).map(function (p) {
      var partida = {
        uuid: p.uuid,
        adversario: p.adversario,
        data: p.data,
        campeonato: p.campeonato,
        tipo: p.tipo,
        periodos: Number(p.periodos),
        minutosPeriodo: Number(p.minutosPeriodo),
        gols_pro: p.gols_pro === null || p.gols_pro === undefined ? null : Number(p.gols_pro),
        gols_contra: p.gols_contra === null || p.gols_contra === undefined ? null : Number(p.gols_contra),
        status: p.status,
        // Partida encerrada: o relógio parou no fim do último período.
        periodo: Number(p.periodos),
        base: Number(p.minutosPeriodo) * 60,
        desde: null
      };
      var convocados = (porPartida[p.uuid] || []).map(function (u) { return elenco[u]; })
        .filter(Boolean)
        .sort(function (a, b) {
          if (ORDEM[a.posicao] !== ORDEM[b.posicao]) { return ORDEM[a.posicao] - ORDEM[b.posicao]; }
          return (a.numero || 999) - (b.numero || 999);
        });
      return Estatisticas.calcular(partida, eventos[p.uuid] || [], passagens[p.uuid] || [], convocados);
    });
  }

  // ------------------------------------------------ ranking

  function renderCriterios() {
    Estatisticas.METRICAS.forEach(function (m) {
      var o = document.createElement('option');
      o.value = m.chave;
      o.textContent = m.rotulo;
      el.criterio.appendChild(o);
    });
    el.criterio.value = criterio.chave;
    el.criterio.addEventListener('change', function () {
      criterio = Estatisticas.metricaPor(el.criterio.value);
      renderRanking();
    });
  }

  function renderRanking() {
    el.ranking.innerHTML = '';
    var lista = temporada.jogadores.filter(function (f) { return f.participou; })
      .map(function (f) { return { ficha: f, valor: criterio.valor(f, 'total') }; })
      .sort(function (a, b) {
        var x = a.valor === null ? -Infinity : a.valor;
        var y = b.valor === null ? -Infinity : b.valor;
        return y - x;
      });

    if (!lista.length) {
      var vazio = document.createElement('p');
      vazio.className = 'nada';
      vazio.textContent = 'Ainda não há jogo encerrado para mostrar.';
      el.ranking.appendChild(vazio);
      return;
    }

    lista.forEach(function (item, i) {
      var j = item.ficha.jogador;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'item-lista' + (j.posicao === 'goleiro' ? ' goleiro' : '');
      b.setAttribute('aria-label', 'Números de ' + j.nome);

      var posicao = document.createElement('span');
      posicao.className = 'camisa';
      posicao.textContent = i + 1;

      var corpo = document.createElement('div');
      corpo.className = 'corpo';
      var titulo = document.createElement('span');
      titulo.className = 'titulo';
      titulo.textContent = j.nome;
      var apoio = document.createElement('span');
      apoio.className = 'apoio';
      apoio.textContent = '#' + (j.numero === null ? '--' : j.numero) + ' · ' + j.posicao +
        ' · ' + item.ficha.jogos + (item.ficha.jogos === 1 ? ' jogo' : ' jogos');
      corpo.appendChild(titulo);
      corpo.appendChild(apoio);

      var valor = document.createElement('span');
      valor.className = 'valor-rank';
      valor.textContent = texto(item.valor, criterio.formato);

      b.appendChild(posicao);
      b.appendChild(corpo);
      b.appendChild(valor);
      b.addEventListener('click', function () { abrirJogador(item.ficha); });
      el.ranking.appendChild(b);
    });
  }

  // ------------------------------------------------ ficha do jogador

  function linha(rotulo, valor, destaque) {
    var div = document.createElement('div');
    div.className = 'linha-comp' + (destaque ? ' destaque' : '');
    var r = document.createElement('span');
    r.className = 'r';
    r.textContent = rotulo;
    var v = document.createElement('span');
    v.className = 'v larga';
    v.textContent = valor;
    div.appendChild(r);
    div.appendChild(v);
    return div;
  }

  function abrirJogador(ficha) {
    var j = ficha.jogador;
    var caixa = document.createElement('div');
    var tabela = document.createElement('div');
    tabela.className = 'comparativo';

    tabela.appendChild(linha('Jogos', String(ficha.jogos), true));
    tabela.appendChild(linha('Tempo em quadra', Estatisticas.mmss(ficha.segundos.total), true));

    TIPOS.forEach(function (t) {
      if (t.escopo !== 'jogador' || !ficha.tipos[t.codigo].total) { return; }
      tabela.appendChild(linha(t.rotulo, String(ficha.tipos[t.codigo].total)));
    });

    [
      { rotulo: 'Finalização %', chave: 'finalizacao' },
      { rotulo: 'Drible %', chave: 'drible' },
      { rotulo: 'Passe %', chave: 'passe' },
      { rotulo: 'Reposição %', chave: 'reposicao' }
    ].filter(function (t) { return ficha.aproveitamento[t.chave].total !== null; })
      .forEach(function (t) {
        tabela.appendChild(linha(t.rotulo, texto(ficha.aproveitamento[t.chave].total, 'pct'), true));
      });

    var porMin = Estatisticas.metricaPor('acoes_min');
    tabela.appendChild(linha('Ações por minuto', texto(porMin.valor(ficha, 'total'), 'taxa'), true));

    caixa.appendChild(tabela);

    var comparacao = document.createElement('p');
    comparacao.className = 'dica';
    comparacao.style.marginTop = '12px';
    var doTime = Estatisticas.referenciaDoTime(temporada, criterio, 'total');
    comparacao.textContent = criterio.rotulo + ': ' +
      texto(criterio.valor(ficha, 'total'), criterio.formato) +
      '  ·  média do time: ' + texto(doTime, criterio.formato);
    caixa.appendChild(comparacao);

    el.painelTitulo.childNodes[0].nodeValue = j.nome;
    el.painelSub.textContent = '#' + (j.numero === null ? '--' : j.numero) + ' · ' + j.posicao;
    el.painelCorpo.innerHTML = '';
    el.painelCorpo.appendChild(caixa);
    el.painel.hidden = false;
  }

  // ------------------------------------------------ jogos

  function dataCurta(iso) {
    var p = String(iso).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] : iso;
  }

  function renderJogos() {
    el.jogos.innerHTML = '';
    if (!jogos.length) {
      var vazio = document.createElement('p');
      vazio.className = 'nada';
      vazio.textContent = 'Nenhum jogo encerrado ainda.';
      el.jogos.appendChild(vazio);
      return;
    }

    jogos.forEach(function (jogo) {
      var p = jogo.partida;
      var item = document.createElement('div');
      item.className = 'item-lista';

      var corpo = document.createElement('div');
      corpo.className = 'corpo';
      var titulo = document.createElement('span');
      titulo.className = 'titulo';
      titulo.textContent = p.adversario || 'Sem adversário anotado';
      var apoio = document.createElement('span');
      apoio.className = 'apoio';
      apoio.textContent = dataCurta(p.data) + (p.campeonato ? ' · ' + p.campeonato : '');
      corpo.appendChild(titulo);
      corpo.appendChild(apoio);

      var placar = document.createElement('span');
      placar.className = 'placar';
      placar.style.fontSize = '20px';
      placar.textContent = jogo.golsPro + ' - ' + jogo.golsContra;

      item.appendChild(corpo);
      item.appendChild(placar);
      el.jogos.appendChild(item);
    });
  }

  // ------------------------------------------------ início

  function iniciar() {
    document.getElementById('fechar-painel').addEventListener('click', function () {
      el.painel.hidden = true;
    });
    el.painel.addEventListener('click', function (e) {
      if (e.target === el.painel) { el.painel.hidden = true; }
    });

    var token = new URLSearchParams(location.search).get('t');
    if (!token) {
      el.subtitulo.textContent = 'link incompleto';
      return;
    }

    criterio = Estatisticas.metricaPor('acoes_min');

    Api.publico(token).then(function (d) {
      dados = d;
      el.titulo.textContent = d.time.nome;
      jogos = montarJogos(d);
      temporada = Estatisticas.temporada(jogos);

      el.subtitulo.textContent = jogos.length
        ? jogos.length + (jogos.length === 1 ? ' jogo' : ' jogos') + ' · ' +
          temporada.jogadores.filter(function (f) { return f.participou; }).length + ' jogadores'
        : 'ainda sem jogo encerrado';

      renderCriterios();
      renderRanking();
      renderJogos();
      el.rodape.textContent = 'Somente leitura. Os números saem do scout da comissão ' +
        'técnica e cobrem os últimos jogos encerrados.';
    }).catch(function (err) {
      el.subtitulo.textContent = 'link inválido ou fora do ar';
      el.rodape.textContent = err.message;
      console.error('falha abrindo o link público', err);
    });
  }

  iniciar();
})();
