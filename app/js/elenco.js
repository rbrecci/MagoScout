// Cadastro do elenco. Tudo local: dá para cadastrar no ônibus, sem rede.

(function () {
  'use strict';

  var POSICOES = { goleiro: 'Goleiro', fixo: 'Fixo', ala: 'Ala', pivo: 'Pivô' };

  var form = document.getElementById('form');
  var campoNumero = document.getElementById('numero');
  var campoNome = document.getElementById('nome');
  var campoPosicao = document.getElementById('posicao');
  var btSalvar = document.getElementById('salvar');
  var btCancelar = document.getElementById('cancelar');
  var tituloForm = document.getElementById('titulo-form');
  var lista = document.getElementById('lista');
  var contagem = document.getElementById('contagem');
  var aviso = document.getElementById('aviso');
  var avisoTexto = document.getElementById('aviso-texto');
  var avisoDesfazer = document.getElementById('aviso-desfazer');

  var editando = null;
  var apagado = null;
  var avisoTimer = null;

  function avisar(texto, comDesfazer) {
    avisoTexto.textContent = texto;
    avisoDesfazer.hidden = !comDesfazer;
    aviso.classList.add('aparece');
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(function () {
      aviso.classList.remove('aparece');
      apagado = null;
    }, comDesfazer ? 5000 : 2000);
  }

  function limparForm() {
    editando = null;
    form.reset();
    campoPosicao.value = 'ala';
    tituloForm.textContent = 'Novo jogador';
    btSalvar.textContent = 'Adicionar ao elenco';
    btCancelar.hidden = true;
  }

  function editar(j) {
    editando = j;
    campoNumero.value = j.numero === null ? '' : j.numero;
    campoNome.value = j.nome;
    campoPosicao.value = j.posicao;
    tituloForm.textContent = 'Editando ' + j.nome;
    btSalvar.textContent = 'Salvar alteração';
    btCancelar.hidden = false;
    campoNome.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function render() {
    // Só os ativos: quem saiu do elenco continua no banco por causa do
    // histórico, mas não é mais assunto desta tela.
    return Dados.jogadoresAtivos().then(function (jogadores) {
      lista.innerHTML = '';
      contagem.textContent = jogadores.length
        ? jogadores.length + (jogadores.length === 1 ? ' jogador' : ' jogadores')
        : 'nenhum jogador';

      if (!jogadores.length) {
        var p = document.createElement('p');
        p.className = 'nada';
        p.textContent = 'O elenco está vazio. Cadastre o primeiro jogador aí em cima.';
        lista.appendChild(p);
        return;
      }

      jogadores.forEach(function (j) {
        var item = document.createElement('div');
        item.className = 'item-lista' + (j.posicao === 'goleiro' ? ' goleiro' : '');

        var camisa = document.createElement('span');
        camisa.className = 'camisa';
        camisa.textContent = j.numero === null ? '--' : j.numero;

        var corpo = document.createElement('div');
        corpo.className = 'corpo';
        corpo.innerHTML = '<span class="titulo"></span><span class="apoio">' + POSICOES[j.posicao] + '</span>';
        corpo.querySelector('.titulo').textContent = j.nome;

        var acoes = document.createElement('div');
        acoes.className = 'acoes-item';

        var btEditar = document.createElement('button');
        btEditar.type = 'button';
        btEditar.className = 'bt-icone';
        btEditar.textContent = '✎';
        btEditar.setAttribute('aria-label', 'Editar ' + j.nome);
        btEditar.addEventListener('click', function () { editar(j); });

        var btApagar = document.createElement('button');
        btApagar.type = 'button';
        btApagar.className = 'bt-icone';
        btApagar.textContent = '🗑';
        btApagar.setAttribute('aria-label', 'Tirar ' + j.nome + ' do elenco');
        btApagar.addEventListener('click', function () {
          apagado = j;
          Dados.removerJogador(j.uuid).then(function () {
            if (editando && editando.uuid === j.uuid) { limparForm(); }
            avisar(j.nome.split(' ')[0] + ' saiu do elenco', true);
            render();
          });
        });

        acoes.appendChild(btEditar);
        acoes.appendChild(btApagar);

        item.appendChild(camisa);
        item.appendChild(corpo);
        item.appendChild(acoes);
        lista.appendChild(item);
      });
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var nome = campoNome.value.trim();
    if (!nome) { return; }

    Dados.salvarJogador({
      uuid: editando ? editando.uuid : null,
      criado_em: editando ? editando.criado_em : null,
      numero: campoNumero.value,
      nome: nome,
      posicao: campoPosicao.value
    }).then(function (j) {
      avisar(editando ? 'Alteração salva' : j.nome.split(' ')[0] + ' entrou no elenco', false);
      limparForm();
      render();
      campoNumero.focus();
    });
  });

  btCancelar.addEventListener('click', limparForm);

  avisoDesfazer.addEventListener('click', function () {
    if (!apagado) { return; }
    Dados.salvarJogador(apagado).then(function () {
      apagado = null;
      aviso.classList.remove('aparece');
      render();
    });
  });

  render();
})();
