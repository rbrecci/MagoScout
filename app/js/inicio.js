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
