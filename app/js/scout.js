// Tela de scout. Um toque registra; nada espera rede.

var Scout = (function () {
  'use strict';

  var estado = {
    partida: null,
    periodo: 1,
    // O cronômetro não conta tiques: guarda o acumulado até a última pausa
    // (`base`) e o instante em que voltou a correr (`desde`). Assim ele
    // sobrevive à tela do celular apagando, ao app ir para segundo plano e a
    // fechar e reabrir no intervalo.
    base: 0,
    desde: null,
    minutosPeriodo: 20,
    periodos: 2,
    jogadores: [],
    emQuadra: [],
    eventos: [],
    passagens: []
  };

  var MAX_EM_QUADRA = 5;
  var relogio = null;
  var avisoTimer = null;
  var el = {};

  // ------------------------------------------------ tempo

  function agora() { return new Date().toISOString().slice(0, 19).replace('T', ' '); }

  function segundos() {
    return estado.base + (estado.desde ? Math.floor((Date.now() - estado.desde) / 1000) : 0);
  }

  function rodando() { return estado.desde !== null; }

  function mmss(s) {
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }

  function salvarPartida() {
    var p = estado.partida;
    p.periodo = estado.periodo;
    p.base = estado.base;
    p.desde = estado.desde;
    return Dados.salvarPartida(p);
  }

  // ------------------------------------------------ consultas

  function jogadorPor(uuid) {
    for (var i = 0; i < estado.jogadores.length; i++) {
      if (estado.jogadores[i].uuid === uuid) { return estado.jogadores[i]; }
    }
    return null;
  }

  function ativos() {
    return estado.eventos.filter(function (e) { return !e.anulado; });
  }

  function contarTipo(codigo) {
    return ativos().filter(function (e) { return e.tipo === codigo; }).length;
  }

  function contarDoJogador(uuid) {
    return ativos().filter(function (e) { return e.jogador_uuid === uuid; }).length;
  }

  function contarDoJogadorTipo(uuid, codigo) {
    return ativos().filter(function (e) {
      return e.jogador_uuid === uuid && e.tipo === codigo;
    }).length;
  }

  function tempoEmQuadra(uuid) {
    var total = 0;
    var atual = segundos();
    estado.passagens.forEach(function (p) {
      if (p.jogador_uuid !== uuid) { return; }
      var fim = p.saiu === null ? atual : p.saiu;
      // Nunca negativo: se o cronômetro voltou atrás, a passagem aberta vale
      // zero em vez de descontar tempo de outra.
      total += Math.max(0, fim - p.entrou);
    });
    return total;
  }

  // ------------------------------------------------ registro

  function registrar(codigo, jogadorUuid) {
    var evento = {
      uuid: DB.uuid(),
      partida_uuid: estado.partida.uuid,
      jogador_uuid: jogadorUuid || null,
      tipo: codigo,
      periodo: estado.periodo,
      segundo: segundos(),
      anulado: 0,
      criado_em: agora(),
      sincronizado: 0
    };
    estado.eventos.push(evento);
    DB.guardar('evento', evento);

    var tipo = tipoPor(codigo);
    var quem = jogadorUuid ? jogadorPor(jogadorUuid) : null;
    avisar((quem ? primeiroNome(quem) + ': ' : '') + tipo.rotulo, true);
    render();
  }

  function desfazer() {
    var lista = ativos();
    if (!lista.length) { return; }
    var ultimo = lista[lista.length - 1];
    ultimo.anulado = 1;
    ultimo.sincronizado = 0;
    DB.guardar('evento', ultimo);
    avisar('Desfeito: ' + tipoPor(ultimo.tipo).rotulo, false);
    render();
  }

  function primeiroNome(j) { return j.nome.split(' ')[0]; }

  // ------------------------------------------------ quadra

  function entrarEmQuadra(uuid) {
    estado.emQuadra.push(uuid);
    var p = {
      uuid: DB.uuid(),
      partida_uuid: estado.partida.uuid,
      jogador_uuid: uuid,
      periodo: estado.periodo,
      entrou: segundos(),
      saiu: null,
      criado_em: agora(),
      sincronizado: 0
    };
    estado.passagens.push(p);
    DB.guardar('passagem', p);
  }

  function sairDaQuadra(uuid) {
    estado.emQuadra = estado.emQuadra.filter(function (x) { return x !== uuid; });
    for (var i = estado.passagens.length - 1; i >= 0; i--) {
      var p = estado.passagens[i];
      if (p.jogador_uuid === uuid && p.saiu === null) {
        p.saiu = segundos();
        p.sincronizado = 0;
        DB.guardar('passagem', p);
        break;
      }
    }
  }

  // ------------------------------------------------ relógio

  function alternarRelogio() {
    if (rodando()) {
      pararRelogio();
    } else {
      estado.desde = Date.now();
      relogio = setInterval(tique, 1000);
    }
    salvarPartida();
    render();
  }

  function pararRelogio() {
    if (rodando()) { estado.base = segundos(); }
    estado.desde = null;
    if (relogio) { clearInterval(relogio); relogio = null; }
  }

  function tique() {
    if (segundos() >= estado.minutosPeriodo * 60) {
      pararRelogio();
      salvarPartida();
      avisar('Fim do ' + estado.periodo + 'º tempo', false);
      render();
      return;
    }
    renderTopo();
    renderTempos();
  }

  function trocarPeriodo() {
    if (estado.periodo >= estado.periodos) { return; }
    pararRelogio();
    // Fecha as passagens do período que acabou e reabre para quem continua: o
    // tempo em quadra é contado por período.
    var seguem = estado.emQuadra.slice();
    seguem.forEach(sairDaQuadra);
    estado.periodo++;
    estado.base = 0;
    estado.desde = null;
    seguem.forEach(entrarEmQuadra);
    salvarPartida();
    avisar(estado.periodo + 'º tempo', false);
    render();
  }

  // ------------------------------------------------ painel

  function abrirPainel(titulo, subtitulo, conteudo) {
    el.painelTitulo.childNodes[0].nodeValue = titulo;
    el.painelSub.textContent = subtitulo || '';
    el.painelCorpo.innerHTML = '';
    el.painelCorpo.appendChild(conteudo);
    el.painel.hidden = false;
  }

  function fecharPainel() { el.painel.hidden = true; }

  function painelDoJogador(uuid) {
    var j = jogadorPor(uuid);
    var caixa = document.createElement('div');

    var grade = document.createElement('div');
    grade.className = 'acoes';
    tiposDoJogador(j.posicao).forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'acao ' + t.natureza + (t.codigo === 'gol' ? ' destaque' : '');
      b.innerHTML = '<span class="sigla">' + t.sigla + '</span><span class="txt">' + t.rotulo + '</span>';
      b.addEventListener('click', function () {
        registrar(t.codigo, uuid);
        fecharPainel();
      });
      grade.appendChild(b);
    });

    var sair = document.createElement('button');
    sair.type = 'button';
    sair.className = 'bt-secundario';
    sair.textContent = 'Tirar de quadra';
    sair.addEventListener('click', function () {
      sairDaQuadra(uuid);
      fecharPainel();
      render();
    });

    caixa.appendChild(grade);
    caixa.appendChild(sair);

    abrirPainel(
      j.nome,
      '#' + (j.numero === null ? '--' : j.numero) + ' · ' + j.posicao + ' · ' + mmss(tempoEmQuadra(uuid)) + ' em quadra',
      caixa
    );
  }

  function painelDeEntrada(uuid) {
    var j = jogadorPor(uuid);

    if (estado.emQuadra.length < MAX_EM_QUADRA) {
      entrarEmQuadra(uuid);
      render();
      return;
    }

    var lista = document.createElement('div');
    lista.className = 'lista-troca';
    estado.emQuadra.forEach(function (saiUuid) {
      var s = jogadorPor(saiUuid);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'opcao-troca';
      b.innerHTML = '<span class="camisa">' + (s.numero === null ? '--' : s.numero) + '</span><span></span>';
      b.lastChild.textContent = s.nome;
      b.addEventListener('click', function () {
        sairDaQuadra(saiUuid);
        entrarEmQuadra(uuid);
        fecharPainel();
        avisar(primeiroNome(j) + ' entrou', false);
        render();
      });
      lista.appendChild(b);
    });

    abrirPainel('Quem sai?', j.nome + ' entra no lugar de', lista);
  }

  function painelDaPartida() {
    var p = estado.partida;
    var caixa = document.createElement('div');

    var info = document.createElement('p');
    info.className = 'dica';
    info.textContent = [
      p.adversario || 'sem adversário anotado',
      Dados.dataCurta(p.data),
      p.campeonato || p.tipo,
      p.periodos + ' × ' + p.minutosPeriodo + ' min'
    ].join(' · ');
    caixa.appendChild(info);

    if (estado.periodo < estado.periodos) {
      var bt = document.createElement('button');
      bt.type = 'button';
      bt.className = 'bt-principal';
      bt.textContent = 'Ir para o ' + (estado.periodo + 1) + 'º tempo';
      bt.addEventListener('click', function () {
        trocarPeriodo();
        fecharPainel();
      });
      caixa.appendChild(bt);
    }

    var encerrar = document.createElement('button');
    encerrar.type = 'button';
    encerrar.className = 'bt-secundario bt-perigo';
    encerrar.textContent = 'Encerrar a partida';
    encerrar.addEventListener('click', function () {
      if (!confirm('Encerrar a partida? Os números ficam salvos no histórico.')) { return; }
      pararRelogio();
      estado.emQuadra.slice().forEach(sairDaQuadra);
      salvarPartida().then(function () {
        return Dados.encerrar(p.uuid);
      }).then(function () {
        location.href = 'index.html';
      });
    });
    caixa.appendChild(encerrar);

    abrirPainel('Partida', estado.periodo + 'º tempo · ' + ativos().length + ' ações registradas', caixa);
  }

  // ------------------------------------------------ aviso

  function avisar(texto, comDesfazer) {
    el.avisoTexto.textContent = texto;
    el.avisoBotao.hidden = !comDesfazer;
    el.aviso.classList.add('aparece');
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(function () {
      el.aviso.classList.remove('aparece');
    }, comDesfazer ? 2600 : 1800);
  }

  // ------------------------------------------------ render

  function renderTopo() {
    el.golsPro.textContent = contarTipo('gol');
    el.golsContra.textContent = contarTipo('gol_sofrido');
    el.tempo.textContent = mmss(segundos());
    el.periodo.textContent = estado.periodo + 'º tempo · ' + estado.minutosPeriodo + ' min';
    el.relogio.classList.toggle('parado', !rodando());
    el.play.textContent = rodando() ? '❚❚' : '▶';
    el.play.classList.toggle('rodando', rodando());
    el.play.setAttribute('aria-label', rodando() ? 'Pausar cronômetro' : 'Iniciar cronômetro');
  }

  function resumoDoJogador(uuid) {
    var n = contarDoJogador(uuid);
    return mmss(tempoEmQuadra(uuid)) + ' · ' + n + (n === 1 ? ' ação' : ' ações');
  }

  // Chamada a cada segundo: mexe só no texto, não reconstrói os cards. Trocar
  // o DOM inteiro a cada tique cancelaria o toque que estivesse em curso.
  function renderTempos() {
    var cards = el.quadra.querySelectorAll('.jogador[data-jogador]');
    for (var i = 0; i < cards.length; i++) {
      var sub = cards[i].querySelector('.sub');
      if (sub) { sub.textContent = resumoDoJogador(cards[i].dataset.jogador); }
    }
  }

  function renderQuadra() {
    el.quadra.innerHTML = '';

    if (!estado.emQuadra.length) {
      var vazio = document.createElement('p');
      vazio.className = 'vazio';
      vazio.textContent = 'Toque nos jogadores do banco para montar a quadra.';
      el.quadra.appendChild(vazio);
      return;
    }

    // Goleiro sempre no topo: posição fixa na tela, para o dedo achar sem ler.
    var ordem = estado.emQuadra.slice().sort(function (a, b) {
      var ga = jogadorPor(a).posicao === 'goleiro' ? 0 : 1;
      var gb = jogadorPor(b).posicao === 'goleiro' ? 0 : 1;
      return ga - gb;
    });

    ordem.forEach(function (uuid) {
      var j = jogadorPor(uuid);
      var card = document.createElement('div');
      card.className = 'jogador' + (j.posicao === 'goleiro' ? ' goleiro' : '');
      card.dataset.jogador = uuid;

      var ident = document.createElement('button');
      ident.type = 'button';
      ident.className = 'identidade';
      ident.innerHTML =
        '<span class="camisa">' + (j.numero === null ? '--' : j.numero) + '</span>' +
        '<span><span class="nome"></span><span class="sub">' + resumoDoJogador(uuid) + '</span></span>';
      ident.querySelector('.nome').textContent = j.nome;
      ident.addEventListener('click', function () { painelDoJogador(uuid); });
      card.appendChild(ident);

      ATALHOS.forEach(function (codigo) {
        var t = tipoPor(codigo);
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'atalho ' + (t.natureza === 'positiva' ? 'certo' : 'errado');
        b.innerHTML = t.sigla + '<b>' + contarDoJogadorTipo(uuid, codigo) + '</b>';
        b.setAttribute('aria-label', t.rotulo + ' de ' + j.nome);
        b.addEventListener('click', function () { registrar(codigo, uuid); });
        card.appendChild(b);
      });

      el.quadra.appendChild(card);
    });
  }

  function renderBanco() {
    el.reservas.innerHTML = '';
    var fora = estado.jogadores.filter(function (j) {
      return estado.emQuadra.indexOf(j.uuid) === -1;
    });

    if (!fora.length) {
      var p = document.createElement('span');
      p.className = 'reserva';
      p.textContent = 'Ninguém no banco';
      el.reservas.appendChild(p);
      return;
    }

    fora.forEach(function (j) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'reserva';
      b.innerHTML = '<span>' + (j.numero === null ? '--' : j.numero) + '</span>';
      b.appendChild(document.createTextNode(primeiroNome(j)));
      b.addEventListener('click', function () { painelDeEntrada(j.uuid); });
      el.reservas.appendChild(b);
    });
  }

  function render() {
    renderTopo();
    renderQuadra();
    renderBanco();
    el.desfazer.disabled = ativos().length === 0;
  }

  // ------------------------------------------------ início

  function montarBotoesDoTime() {
    tiposDoTime().forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'bt-time';
      b.innerHTML = t.sigla + '<small>' + t.rotulo.split(' ')[1] + '</small>';
      b.setAttribute('aria-label', t.rotulo);
      b.addEventListener('click', function () { registrar(t.codigo, null); });
      el.rodape.insertBefore(b, el.desfazer);
    });
  }

  function iniciar() {
    el = {
      golsPro: document.getElementById('gols-pro'),
      golsContra: document.getElementById('gols-contra'),
      placar: document.getElementById('placar'),
      tempo: document.getElementById('tempo'),
      periodo: document.getElementById('periodo'),
      relogio: document.getElementById('relogio'),
      play: document.getElementById('play'),
      quadra: document.getElementById('quadra'),
      reservas: document.getElementById('reservas'),
      rodape: document.getElementById('rodape'),
      desfazer: document.getElementById('desfazer'),
      painel: document.getElementById('painel'),
      painelTitulo: document.getElementById('painel-titulo'),
      painelSub: document.getElementById('painel-sub'),
      painelCorpo: document.getElementById('painel-corpo'),
      aviso: document.getElementById('aviso'),
      avisoTexto: document.getElementById('aviso-texto'),
      avisoBotao: document.getElementById('aviso-desfazer')
    };

    var id = Dados.ativaId();
    if (!id) { location.replace('index.html'); return; }

    Dados.partida(id).then(function (p) {
      if (!p) { location.replace('index.html'); return null; }

      estado.partida = p;
      estado.periodo = p.periodo || 1;
      estado.base = p.base || 0;
      estado.desde = p.desde || null;
      estado.periodos = p.periodos;
      estado.minutosPeriodo = p.minutosPeriodo;

      return Promise.all([
        Dados.convocados(p.uuid),
        DB.porPartida('evento', p.uuid),
        DB.porPartida('passagem', p.uuid)
      ]);
    }).then(function (r) {
      if (!r) { return; }

      estado.jogadores = r[0];
      estado.eventos = r[1] || [];
      estado.passagens = r[2] || [];

      estado.passagens.forEach(function (p) {
        if (p.periodo === estado.periodo && p.saiu === null &&
            estado.emQuadra.indexOf(p.jogador_uuid) === -1) {
          estado.emQuadra.push(p.jogador_uuid);
        }
      });

      // Se o app foi fechado com o cronômetro correndo, o tempo continuou
      // correndo junto: o jogo não para porque o celular travou.
      if (rodando()) { relogio = setInterval(tique, 1000); }

      montarBotoesDoTime();

      el.play.addEventListener('click', alternarRelogio);
      el.desfazer.addEventListener('click', desfazer);
      el.periodo.addEventListener('click', trocarPeriodo);
      el.placar.addEventListener('click', painelDaPartida);
      el.avisoBotao.addEventListener('click', function () {
        desfazer();
        el.aviso.classList.remove('aparece');
      });
      document.getElementById('fechar-painel').addEventListener('click', fecharPainel);
      el.painel.addEventListener('click', function (e) {
        if (e.target === el.painel) { fecharPainel(); }
      });

      render();
    }).catch(function (err) {
      console.error('falha abrindo a partida', err);
    });
  }

  return {
    iniciar: iniciar,
    estado: estado,
    registrar: registrar,
    desfazer: desfazer
  };
})();
