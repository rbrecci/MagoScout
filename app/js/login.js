// Entrada da comissão. Também é a tela de primeiro acesso: enquanto não existe
// usuário nenhum, ela oferece criar a conta em vez de pedir senha.

(function () {
  'use strict';

  var el = {
    titulo: document.getElementById('titulo'),
    subtitulo: document.getElementById('subtitulo'),
    formLogin: document.getElementById('form-login'),
    formInstalar: document.getElementById('form-instalar'),
    logado: document.getElementById('logado'),
    quem: document.getElementById('quem'),
    recado: document.getElementById('recado'),
    btEntrar: document.getElementById('bt-entrar'),
    btInstalar: document.getElementById('bt-instalar'),
    btSair: document.getElementById('bt-sair')
  };

  function dizer(texto) { el.recado.textContent = texto || ''; }

  function mostrar(qual, subtitulo) {
    el.formLogin.hidden = qual !== 'login';
    el.formInstalar.hidden = qual !== 'instalar';
    el.logado.hidden = qual !== 'logado';
    el.subtitulo.textContent = subtitulo;
  }

  function abrir() {
    Api.sessao().then(function (s) {
      if (s.logado) {
        mostrar('logado', 'conectado');
        el.quem.textContent = s.usuario.nome + ' · ' + s.time.nome;
        dizer('');
        return null;
      }
      return Api.instalacao().then(function (i) {
        if (!i.banco) {
          mostrar('nada', 'servidor sem banco');
          dizer('O servidor respondeu, mas não conseguiu falar com o MySQL. ' +
            'Confira as credenciais em api/config.php.');
          return;
        }
        if (!i.instalado) {
          mostrar('instalar', 'primeiro acesso');
          document.getElementById('time').value = i.time_padrao || '';
          dizer('');
          return;
        }
        mostrar('login', 'entre para sincronizar');
        dizer('');
      });
    }).catch(function (err) {
      mostrar('nada', 'sem servidor');
      // Isto é esperado no ginásio: o app inteiro funciona sem servidor, e a
      // tela precisa dizer isso sem parecer um defeito.
      dizer('Não deu para falar com o servidor agora. O app continua funcionando ' +
        'offline; a sincronização espera a rede voltar. (' + err.message + ')');
    });
  }

  el.formLogin.addEventListener('submit', function (e) {
    e.preventDefault();
    el.btEntrar.disabled = true;
    el.btEntrar.textContent = 'Entrando…';
    Api.entrar(document.getElementById('email').value.trim(),
      document.getElementById('senha').value).then(function () {
      // Carimbo velho de outra conta traria histórico incompleto: começa do zero.
      Sync.esquecerCarimbo();
      return Sync.agora().then(function () { location.href = 'index.html'; });
    }).catch(function (err) {
      dizer(err.message);
      el.btEntrar.disabled = false;
      el.btEntrar.textContent = 'Entrar';
    });
  });

  el.formInstalar.addEventListener('submit', function (e) {
    e.preventDefault();
    el.btInstalar.disabled = true;
    el.btInstalar.textContent = 'Criando…';
    Api.instalar({
      time: document.getElementById('time').value.trim(),
      nome: document.getElementById('nome').value.trim(),
      email: document.getElementById('email-novo').value.trim(),
      senha: document.getElementById('senha-nova').value
    }).then(function () {
      return Api.entrar(document.getElementById('email-novo').value.trim(),
        document.getElementById('senha-nova').value);
    }).then(function () {
      Sync.esquecerCarimbo();
      return Sync.agora();
    }).then(function () {
      location.href = 'index.html';
    }).catch(function (err) {
      dizer(err.message);
      el.btInstalar.disabled = false;
      el.btInstalar.textContent = 'Criar a conta';
    });
  });

  el.btSair.addEventListener('click', function () {
    if (!confirm('Sair da conta? O que ainda não subiu continua guardado neste aparelho.')) { return; }
    Api.sair().then(function () {
      Sync.esquecerCarimbo();
      abrir();
    }).catch(function (err) { dizer(err.message); });
  });

  abrir();
})();
