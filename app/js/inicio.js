// Tela inicial: retomar o jogo aberto, criar partida, ver o histórico.

(function () {
  'use strict';

  var TIPOS_PARTIDA = { oficial: 'Oficial', amistoso: 'Amistoso', treino: 'Treino' };

  var caixaAtiva = document.getElementById('ativa');
  var historico = document.getElementById('historico');
  var assinatura = document.getElementById('assinatura');

  var sync = {
    estado: document.getElementById('sync-estado'),
    detalhe: document.getElementById('sync-detalhe'),
    botao: document.getElementById('sync-agora'),
    entrar: document.getElementById('sync-entrar'),
    area: document.getElementById('area-publica'),
    link: document.getElementById('link-publico'),
    copiar: document.getElementById('copiar-link')
  };

  function placar(p, eventos) {
    var pro = 0, contra = 0;
    eventos.forEach(function (e) {
      if (e.anulado) { return; }
      if (e.tipo === 'gol') { pro++; }
      if (e.tipo === 'gol_sofrido') { contra++; }
    });
    return (p.gols_pro === null || p.gols_pro === undefined ? pro : p.gols_pro) +
      ' - ' +
      (p.gols_contra === null || p.gols_contra === undefined ? contra : p.gols_contra);
  }

  function render() {
    Promise.all([Dados.partidas(), Dados.jogadores()]).then(function (r) {
      var partidas = r[0];
      var elenco = r[1];

      assinatura.textContent = elenco.length
        ? elenco.length + (elenco.length === 1 ? ' jogador no elenco' : ' jogadores no elenco')
        : 'Comece cadastrando o elenco';

      var ativaId = Dados.ativaId();
      var ativa = partidas.filter(function (p) {
        return p.uuid === ativaId && p.status === 'em_andamento';
      })[0];

      caixaAtiva.innerHTML = '';
      if (ativa) {
        var a = document.createElement('a');
        a.className = 'continuar';
        a.href = 'scout.html';
        a.innerHTML = '<strong>Continuar o jogo</strong><span>' +
          Dados.rotuloPartida(ativa) + ' · ' + ativa.periodo + 'º tempo</span>';
        caixaAtiva.appendChild(a);
      }

      iniciarIa(partidas);

      historico.innerHTML = '';
      if (!partidas.length) {
        var vazio = document.createElement('p');
        vazio.className = 'nada';
        vazio.textContent = 'Nenhuma partida registrada ainda.';
        historico.appendChild(vazio);
        return;
      }

      partidas.forEach(function (p) {
        DB.porPartida('evento', p.uuid).then(function (eventos) {
          var item = document.createElement('a');
          item.className = 'item-lista';
          item.href = 'analise.html?p=' + encodeURIComponent(p.uuid);

          var corpo = document.createElement('div');
          corpo.className = 'corpo';
          var titulo = document.createElement('span');
          titulo.className = 'titulo';
          titulo.textContent = p.adversario || 'Sem adversário anotado';
          var apoio = document.createElement('span');
          apoio.className = 'apoio';
          apoio.textContent = Dados.dataCurta(p.data) + ' · ' + TIPOS_PARTIDA[p.tipo] +
            ' · ' + eventos.filter(function (e) { return !e.anulado; }).length + ' ações';
          corpo.appendChild(titulo);
          corpo.appendChild(apoio);

          var marcador = document.createElement('span');
          marcador.className = 'placar';
          marcador.style.fontSize = '20px';
          marcador.textContent = placar(p, eventos);

          var selo = document.createElement('span');
          selo.className = 'selo-status' + (p.status === 'em_andamento' ? ' andamento' : '');
          selo.textContent = p.status === 'em_andamento' ? 'agora' : 'fim';

          item.appendChild(corpo);
          item.appendChild(marcador);
          item.appendChild(selo);
          historico.appendChild(item);
        });
      });
    });
  }

  // ------------------------------------------------ quem está caindo

  var ia = {
    secao: document.getElementById('secao-ia'),
    modos: document.getElementById('ia-modos'),
    texto: document.getElementById('ia-texto'),
    estado: document.getElementById('ia-estado'),
    botao: document.getElementById('bt-ia')
  };

  // Os dois modos leem a mesma temporada e custam uma chamada cada, então cada
  // um guarda o seu texto e trocar de aba nunca dispara geração sozinha.
  var MODOS = [
    {
      chave: 'rendimento',
      rotulo: 'Quem está caindo',
      acao: 'Ler quem está caindo',
      nota: 'Queda menor que a variação típica do jogador é oscilação, não queda.'
    },
    {
      chave: 'treino',
      rotulo: 'O que treinar',
      acao: 'Sugerir o treino da semana',
      nota: 'A IA não sabe quantos treinos você tem na semana nem que material existe: ela aponta o que os números pedem, a agenda é sua.'
    }
  ];

  var modo = MODOS[0];
  var jogosEmCache = null;

  function modoPor(chave) {
    return MODOS.filter(function (m) { return m.chave === chave; })[0] || MODOS[0];
  }

  function estadoIa(mensagem, falhou) {
    ia.estado.textContent = mensagem || '';
    ia.estado.className = 'ia-estado' + (falhou ? ' falhou' : '');
  }

  function vazio() {
    ia.texto.innerHTML = '';
    ia.botao.textContent = modo.acao;
    estadoIa('');
  }

  function mostrarIa(r) {
    IA.render(ia.texto, r.texto);
    ia.botao.textContent = 'Ler de novo';

    if (r.truncado) {
      estadoIa('O texto acima ficou pela metade: a IA atingiu o limite de tamanho. Toque em ler de novo.', true);
      return;
    }

    estadoIa(r.doCache
      ? 'Gerada em ' + Dados.dataCurta(String(r.quando).slice(0, 10)) + ' e guardada no aparelho.'
      : 'Escrita agora por ' + r.modelo + '. ' + modo.nota);
  }

  function pedirIa(forcar) {
    var pedido = modo.chave;
    ia.botao.disabled = true;
    estadoIa('Lendo a temporada inteira…');

    // Só aqui o histórico completo é carregado. Na abertura da tela ele custaria
    // todos os eventos de todos os jogos para, quase sempre, nada. Uma vez lido,
    // fica: o segundo modo não paga o carregamento de novo.
    var carregou = jogosEmCache
      ? Promise.resolve(jogosEmCache)
      : Dados.carregarHistorico().then(function (pacotes) {
          jogosEmCache = pacotes.map(function (p) {
            return Estatisticas.calcular(p.partida, p.eventos, p.passagens, p.jogadores);
          });
          return jogosEmCache;
        });

    carregou.then(function (jogos) {
      return IA.analiseDaTemporada(pedido, jogos, forcar);
    }).then(function (r) {
      // Trocar de aba enquanto a IA escrevia não pode fazer o texto de um modo
      // cair na tela do outro.
      if (pedido !== modo.chave) { return; }
      mostrarIa(r);
    }).catch(function (err) {
      console.error('falha na leitura da temporada', err);
      if (err.codigo === 501) {
        ia.secao.hidden = true;
        return;
      }
      estadoIa(err.codigo === 401
        ? 'Precisa entrar na conta da comissão para usar a IA.'
        : (err.message || 'Não deu para ler a temporada agora.'), true);
    }).then(function () {
      ia.botao.disabled = false;
    });
  }

  // `render()` roda de novo a cada sincronização. Sem esta trava, o listener
  // entraria mais de uma vez no mesmo botão e um toque viraria duas chamadas
  // pagas à IA.
  var iaLigada = false;

  function iniciarIa(partidas) {
    if (!partidas.length || iaLigada) { return; }
    iaLigada = true;
    ia.secao.hidden = false;

    if (partidas.length < IA.MINIMO_JOGOS) {
      ia.botao.hidden = true;
      estadoIa('Com ' + partidas.length + (partidas.length === 1 ? ' jogo' : ' jogos') +
        ' ainda não dá para falar em tendência: falta com o que comparar. ' +
        'A partir de ' + IA.MINIMO_JOGOS + ' jogos esta seção liga sozinha.');
      return;
    }

    ia.botao.hidden = false;
    ia.botao.addEventListener('click', function () {
      pedirIa(ia.texto.childNodes.length > 0);
    });

    // A lista leve basta para achar o texto guardado: a chave é o jogo mais
    // recente mais a contagem, e nenhum evento precisa sair do banco para isso.
    var referencia = IA.referenciaRendimento(partidas[0].uuid, partidas.length);

    function abrir(escolhido) {
      modo = escolhido;
      renderModos();
      vazio();
      IA.guardada(modo.chave, referencia).then(function (cache) {
        // De volta do banco tarde demais: o dedo já trocou de aba.
        if (!cache || modo !== escolhido) { return; }
        cache.doCache = true;
        mostrarIa(cache);
      });
    }

    function renderModos() {
      ia.modos.innerHTML = '';
      MODOS.forEach(function (m) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'segmento' + (m === modo ? ' ativo' : '');
        b.textContent = m.rotulo;
        b.setAttribute('aria-pressed', m === modo ? 'true' : 'false');
        b.addEventListener('click', function () {
          if (m === modo) { return; }
          abrir(m);
        });
        ia.modos.appendChild(b);
      });
    }

    abrir(modoPor('rendimento'));
  }

  // ------------------------------------------------ sincronização

  function quandoCurto(iso) {
    if (!iso) { return 'ainda não sincronizou'; }
    var d = new Date(iso);
    var minutos = Math.round((Date.now() - d.getTime()) / 60000);
    if (minutos < 1) { return 'agora mesmo'; }
    if (minutos < 60) { return 'há ' + minutos + ' min'; }
    return 'às ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  function pintar(titulo, detalhe, classe) {
    sync.estado.textContent = titulo;
    sync.estado.className = 'estado ponto' + (classe ? ' ' + classe : '');
    sync.detalhe.textContent = detalhe;
  }

  function contarEDizer(titulo, classe, complemento) {
    return Dados.contarPendentes().then(function (n) {
      var fila = n === 0 ? 'nada na fila' :
        n + (n === 1 ? ' registro esperando' : ' registros esperando');
      pintar(titulo, complemento ? fila + ' · ' + complemento : fila, classe);
      return n;
    });
  }

  function mostrarEstado(estado) {
    if (estado.estado === 'ok') {
      contarEDizer('Sincronizado', '', quandoCurto(Sync.ultimaVez()));
      render();
      return;
    }
    if (estado.estado === 'sincronizando') {
      pintar('Sincronizando…', 'subindo a fila', 'espera');
      return;
    }
    if (estado.estado === 'sem-sessao') {
      sync.botao.hidden = true;
      sync.entrar.hidden = false;
      contarEDizer('Só neste aparelho', 'longe', 'entre para usar em outro celular');
      return;
    }
    if (estado.estado === 'offline') {
      contarEDizer('Sem rede', 'espera', 'sobe sozinho quando a rede voltar');
      return;
    }
    contarEDizer('Não deu para sincronizar', 'espera', estado.mensagem || '');
  }

  function prepararSync() {
    Sync.aoMudar(mostrarEstado);

    sync.botao.addEventListener('click', function () {
      sync.botao.disabled = true;
      Sync.agora().then(function () { sync.botao.disabled = false; });
    });

    sync.copiar.addEventListener('click', function () {
      sync.link.select();
      var copiado = false;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(sync.link.value);
        copiado = true;
      } else {
        try { copiado = document.execCommand('copy'); } catch (e) { copiado = false; }
      }
      sync.copiar.textContent = copiado ? 'Copiado' : 'Selecione e copie';
      setTimeout(function () { sync.copiar.textContent = 'Copiar'; }, 2200);
    });

    Api.sessao().then(function (s) {
      if (!s.logado) {
        sync.entrar.hidden = false;
        contarEDizer('Só neste aparelho', 'longe', 'entre para usar em outro celular');
        return;
      }
      sync.botao.hidden = false;
      sync.area.hidden = false;
      sync.link.value = location.href.replace(/[^/]*$/, '') +
        'publico.html?t=' + s.time.token_publico;
      contarEDizer('Conectado como ' + s.usuario.nome, '', quandoCurto(Sync.ultimaVez()));
      return Sync.agora(true);
    }).catch(function () {
      sync.entrar.hidden = false;
      contarEDizer('Sem servidor', 'longe', 'o app segue funcionando offline');
    });
  }

  render();
  prepararSync();
})();
