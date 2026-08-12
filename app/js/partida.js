// Criação da partida e relação dos convocados.

(function () {
  'use strict';

  var POSICOES = { goleiro: 'Goleiro', fixo: 'Fixo', ala: 'Ala', pivo: 'Pivô' };
  var MINIMO = 5;

  var elenco = document.getElementById('elenco');
  var qtd = document.getElementById('qtd-convocados');
  var btComecar = document.getElementById('comecar');
  var campoData = document.getElementById('data');

  var escolhidos = [];

  campoData.value = Dados.hoje();

  function atualizarRodape() {
    var n = escolhidos.length;
    qtd.textContent = n ? '(' + n + ')' : '';

    if (n < MINIMO) {
      btComecar.disabled = true;
      btComecar.textContent = 'Relacione pelo menos ' + MINIMO;
      return;
    }
    btComecar.disabled = false;
    btComecar.textContent = 'Começar o jogo com ' + n;
  }

  function render() {
    return Dados.jogadoresAtivos().then(function (jogadores) {
      elenco.innerHTML = '';

      if (!jogadores.length) {
        var p = document.createElement('p');
        p.className = 'nada';
        p.innerHTML = 'Nenhum jogador cadastrado ainda.<br><a href="elenco.html" style="color:var(--azul)">Cadastrar o elenco primeiro</a>';
        elenco.appendChild(p);
        return;
      }

      jogadores.forEach(function (j) {
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'item-lista' + (j.posicao === 'goleiro' ? ' goleiro' : '');

        var marca = document.createElement('span');
        marca.className = 'marca-sel';
        marca.textContent = '✓';

        var camisa = document.createElement('span');
        camisa.className = 'camisa';
        camisa.textContent = j.numero === null ? '--' : j.numero;

        var corpo = document.createElement('span');
        corpo.className = 'corpo';
        corpo.innerHTML = '<span class="titulo"></span><span class="apoio">' + POSICOES[j.posicao] + '</span>';
        corpo.querySelector('.titulo').textContent = j.nome;

        item.appendChild(marca);
        item.appendChild(camisa);
        item.appendChild(corpo);

        item.addEventListener('click', function () {
          var i = escolhidos.indexOf(j.uuid);
          if (i > -1) {
            escolhidos.splice(i, 1);
            item.classList.remove('marcado');
            item.setAttribute('aria-pressed', 'false');
          } else {
            escolhidos.push(j.uuid);
            item.classList.add('marcado');
            item.setAttribute('aria-pressed', 'true');
          }
          atualizarRodape();
        });

        item.setAttribute('aria-pressed', 'false');
        elenco.appendChild(item);
      });

      atualizarRodape();
    });
  }

  btComecar.addEventListener('click', function () {
    if (escolhidos.length < MINIMO) { return; }

    // Sem goleiro relacionado, os botões de defesa, gol sofrido e reposição
    // não aparecem para ninguém. Avisa, mas não impede: um treino de linha
    // pode ser sem goleiro mesmo.
    var semGoleiro = elenco.querySelectorAll('.item-lista.marcado.goleiro').length === 0;
    if (semGoleiro && !confirm('Nenhum goleiro na relação. As ações de goleiro (defesa, gol sofrido, reposição) não vão aparecer. Seguir assim?')) {
      return;
    }

    btComecar.disabled = true;

    Dados.salvarPartida({
      adversario: document.getElementById('adversario').value,
      data: campoData.value,
      campeonato: document.getElementById('campeonato').value,
      tipo: document.getElementById('tipo').value,
      periodos: document.getElementById('periodos').value,
      minutosPeriodo: document.getElementById('minutos').value,
      status: 'em_andamento'
    }).then(function (p) {
      return Dados.salvarConvocacao(p.uuid, escolhidos).then(function () {
        Dados.definirAtiva(p.uuid);
        location.href = 'scout.html';
      });
    }).catch(function (err) {
      console.error(err);
      btComecar.disabled = false;
      alert('Não consegui salvar a partida. Tente de novo.');
    });
  });

  render();
})();
