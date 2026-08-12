// Camada de dados do app. As telas falam com este arquivo, não com o DB
// direto, para que trocar o armazenamento (ou plugar a sincronização) não
// espalhe mudança por todas as telas.

var Dados = (function () {
  'use strict';

  var CHAVE_ATIVA = 'magoscout.partida_ativa';

  function agora() { return new Date().toISOString().slice(0, 19).replace('T', ' '); }

  function hoje() {
    var d = new Date();
    return d.getFullYear() + '-' +
      ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
      ('0' + d.getDate()).slice(-2);
  }

  // ---------------------------------------------------------- elenco

  var ORDEM_POSICAO = { goleiro: 0, fixo: 1, ala: 2, pivo: 3 };

  function ordenarElenco(lista) {
    return lista.sort(function (a, b) {
      var pa = ORDEM_POSICAO[a.posicao], pb = ORDEM_POSICAO[b.posicao];
      if (pa !== pb) { return pa - pb; }
      return (a.numero || 999) - (b.numero || 999);
    });
  }

  function jogadores() {
    return DB.todos('jogador').then(ordenarElenco);
  }

  function jogadoresAtivos() {
    return jogadores().then(function (l) {
      return l.filter(function (j) { return j.ativo !== 0; });
    });
  }

  function salvarJogador(dados) {
    var j = {
      uuid: dados.uuid || DB.uuid(),
      numero: dados.numero === '' || dados.numero === null ? null : Number(dados.numero),
      nome: String(dados.nome).trim(),
      posicao: dados.posicao,
      ativo: dados.ativo === undefined ? 1 : dados.ativo,
      criado_em: dados.criado_em || agora(),
      sincronizado: 0
    };
    return DB.guardar('jogador', j).then(function () { return j; });
  }

  // Sair do elenco é virar inativo, não sumir. Dois motivos: os eventos das
  // partidas antigas continuam apontando para ele, e apagar de um celular não
  // teria como apagar do outro — o registro precisa existir para poder viajar
  // dizendo "este aqui saiu".
  function removerJogador(uuid) {
    return DB.obter('jogador', uuid).then(function (j) {
      if (!j) { return null; }
      j.ativo = 0;
      j.sincronizado = 0;
      return DB.guardar('jogador', j);
    });
  }

  // ---------------------------------------------------------- partidas

  function partidas() {
    return DB.todos('partida').then(function (l) {
      return l.sort(function (a, b) {
        if (a.data !== b.data) { return a.data < b.data ? 1 : -1; }
        return a.criado_em < b.criado_em ? 1 : -1;
      });
    });
  }

  function partida(uuid) {
    return DB.obter('partida', uuid);
  }

  function salvarPartida(dados) {
    var p = {
      uuid: dados.uuid || DB.uuid(),
      adversario: (dados.adversario || '').trim() || null,
      data: dados.data || hoje(),
      campeonato: (dados.campeonato || '').trim() || null,
      tipo: dados.tipo || 'oficial',
      periodos: Number(dados.periodos) || 2,
      minutosPeriodo: Number(dados.minutosPeriodo) || 20,
      status: dados.status || 'em_andamento',
      // Estado do cronômetro, para a partida sobreviver a fechar o app.
      periodo: dados.periodo || 1,
      base: dados.base || 0,
      desde: dados.desde === undefined ? null : dados.desde,
      criado_em: dados.criado_em || agora(),
      atualizado_em: agora(),
      sincronizado: 0
    };
    return DB.guardar('partida', p).then(function () { return p; });
  }

  function encerrar(uuid) {
    return partida(uuid).then(function (p) {
      if (!p) { return null; }
      p.status = 'encerrada';
      p.desde = null;
      p.atualizado_em = agora();
      p.sincronizado = 0;
      return DB.guardar('partida', p).then(function () {
        if (ativaId() === uuid) { limparAtiva(); }
        return p;
      });
    });
  }

  // ---------------------------------------------------------- convocação

  function salvarConvocacao(partidaUuid, listaUuids) {
    return DB.guardar('convocacao', {
      partida_uuid: partidaUuid,
      jogadores: listaUuids,
      sincronizado: 0
    });
  }

  function convocacao(partidaUuid) {
    return DB.obter('convocacao', partidaUuid).then(function (c) {
      return c ? c.jogadores : [];
    });
  }

  // Elenco da partida, na ordem da tela: goleiro primeiro.
  function convocados(partidaUuid) {
    return Promise.all([convocacao(partidaUuid), jogadores()]).then(function (r) {
      var escolhidos = r[0], todos = r[1];
      return ordenarElenco(todos.filter(function (j) {
        return escolhidos.indexOf(j.uuid) > -1;
      }));
    });
  }

  // ---------------------------------------------------------- carga completa

  // Partida com tudo que a análise precisa. Existe para as telas não repetirem
  // a mesma sequência de três consultas.
  function carregarPartida(uuid) {
    return partida(uuid).then(function (p) {
      if (!p) { return null; }
      return Promise.all([
        convocados(p.uuid),
        DB.porPartida('evento', p.uuid),
        DB.porPartida('passagem', p.uuid)
      ]).then(function (r) {
        return { partida: p, jogadores: r[0], eventos: r[1] || [], passagens: r[2] || [] };
      });
    });
  }

  // Do jogo mais antigo para o mais novo: quem olha evolução lê da esquerda
  // para a direita.
  function carregarHistorico() {
    return partidas().then(function (lista) {
      var antigas = lista.slice().reverse();
      return Promise.all(antigas.map(function (p) { return carregarPartida(p.uuid); }));
    }).then(function (pacotes) {
      return pacotes.filter(function (x) { return !!x; });
    });
  }

  // ---------------------------------------------------------- sincronização

  var LOJAS_SYNC = ['jogador', 'partida', 'convocacao', 'evento', 'passagem'];

  function naoSincronizados(loja) {
    return DB.todos(loja).then(function (l) {
      return l.filter(function (r) { return r.sincronizado === 0; });
    });
  }

  // Tudo que nasceu ou mudou no aparelho e ainda não subiu.
  function pendentes() {
    return Promise.all(LOJAS_SYNC.map(naoSincronizados)).then(function (r) {
      return {
        jogadores: r[0],
        partidas: r[1],
        convocacoes: r[2],
        eventos: r[3],
        passagens: r[4]
      };
    });
  }

  function contarPendentes() {
    return pendentes().then(function (p) {
      return p.jogadores.length + p.partidas.length + p.convocacoes.length +
        p.eventos.length + p.passagens.length;
    });
  }

  function marcarEnviados(enviados) {
    var tarefas = [];
    function marcar(loja, lista) {
      lista.forEach(function (r) {
        // Releitura antes de marcar: entre montar o lote e a resposta chegar, o
        // mesmo registro pode ter mudado de novo (um undo, por exemplo). Marcar
        // o objeto do lote como sincronizado apagaria essa mudança.
        var chave = loja === 'convocacao' ? r.partida_uuid : r.uuid;
        tarefas.push(DB.obter(loja, chave).then(function (atual) {
          if (!atual || atual.sincronizado === 1) { return null; }
          if (loja === 'evento' && atual.anulado !== r.anulado) { return null; }
          if (loja === 'passagem' && atual.saiu !== r.saiu) { return null; }
          atual.sincronizado = 1;
          return DB.guardar(loja, atual);
        }));
      });
    }
    marcar('jogador', enviados.jogadores);
    marcar('partida', enviados.partidas);
    marcar('convocacao', enviados.convocacoes);
    marcar('evento', enviados.eventos);
    marcar('passagem', enviados.passagens);
    return Promise.all(tarefas);
  }

  function num(v, alternativa) {
    return v === null || v === undefined || v === '' ? alternativa : Number(v);
  }

  // Traduz o que veio do servidor para o formato local e grava. Chega marcado
  // como sincronizado: não faz sentido devolver ao servidor o que veio dele.
  function aplicarRemotos(n) {
    var tarefas = [];

    (n.jogadores || []).forEach(function (j) {
      tarefas.push(DB.guardar('jogador', {
        uuid: j.uuid,
        numero: j.numero === null || j.numero === undefined ? null : Number(j.numero),
        nome: j.nome,
        posicao: j.posicao,
        ativo: num(j.ativo, 1),
        criado_em: j.criado_em,
        sincronizado: 1
      }));
    });

    (n.partidas || []).forEach(function (p) {
      // O estado do cronômetro (período corrente, base, desde) é do aparelho
      // que está apitando o jogo, não do servidor: só um scout registra por
      // vez. Se a partida já existe aqui, o relógio local fica como está.
      tarefas.push(DB.obter('partida', p.uuid).then(function (local) {
        return DB.guardar('partida', {
          uuid: p.uuid,
          adversario: p.adversario,
          data: p.data,
          campeonato: p.campeonato,
          tipo: p.tipo,
          periodos: num(p.periodos, 2),
          minutosPeriodo: num(p.minutosPeriodo, 20),
          gols_pro: p.gols_pro === null || p.gols_pro === undefined ? null : Number(p.gols_pro),
          gols_contra: p.gols_contra === null || p.gols_contra === undefined ? null : Number(p.gols_contra),
          status: p.status,
          periodo: local ? local.periodo : 1,
          base: local ? local.base : 0,
          desde: local ? local.desde : null,
          criado_em: p.criado_em,
          atualizado_em: p.atualizado_em,
          sincronizado: 1
        });
      }));
    });

    (n.convocacoes || []).forEach(function (c) {
      tarefas.push(DB.guardar('convocacao', {
        partida_uuid: c.partida_uuid,
        jogadores: c.jogadores || [],
        sincronizado: 1
      }));
    });

    (n.eventos || []).forEach(function (e) {
      tarefas.push(DB.guardar('evento', {
        uuid: e.uuid,
        partida_uuid: e.partida_uuid,
        jogador_uuid: e.jogador_uuid || null,
        tipo: e.tipo,
        periodo: num(e.periodo, 1),
        segundo: num(e.segundo, 0),
        anulado: num(e.anulado, 0),
        criado_em: e.criado_em,
        sincronizado: 1
      }));
    });

    (n.passagens || []).forEach(function (p) {
      tarefas.push(DB.guardar('passagem', {
        uuid: p.uuid,
        partida_uuid: p.partida_uuid,
        jogador_uuid: p.jogador_uuid,
        periodo: num(p.periodo, 1),
        entrou: num(p.entrou, 0),
        saiu: p.saiu === null || p.saiu === undefined ? null : Number(p.saiu),
        criado_em: p.criado_em,
        sincronizado: 1
      }));
    });

    return Promise.all(tarefas).then(function (t) { return t.length; });
  }

  // ---------------------------------------------------------- partida aberta

  function ativaId() {
    try { return localStorage.getItem(CHAVE_ATIVA); } catch (e) { return null; }
  }

  function definirAtiva(uuid) {
    try { localStorage.setItem(CHAVE_ATIVA, uuid); } catch (e) {}
  }

  function limparAtiva() {
    try { localStorage.removeItem(CHAVE_ATIVA); } catch (e) {}
  }

  // ---------------------------------------------------------- rótulos

  function rotuloPartida(p) {
    var quem = p.adversario ? 'contra ' + p.adversario : 'sem adversário anotado';
    return quem;
  }

  function dataCurta(iso) {
    var p = String(iso).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] : iso;
  }

  return {
    hoje: hoje,
    agora: agora,
    jogadores: jogadores,
    jogadoresAtivos: jogadoresAtivos,
    salvarJogador: salvarJogador,
    removerJogador: removerJogador,
    partidas: partidas,
    partida: partida,
    salvarPartida: salvarPartida,
    encerrar: encerrar,
    salvarConvocacao: salvarConvocacao,
    convocacao: convocacao,
    convocados: convocados,
    carregarPartida: carregarPartida,
    carregarHistorico: carregarHistorico,
    pendentes: pendentes,
    contarPendentes: contarPendentes,
    marcarEnviados: marcarEnviados,
    aplicarRemotos: aplicarRemotos,
    ativaId: ativaId,
    definirAtiva: definirAtiva,
    limparAtiva: limparAtiva,
    rotuloPartida: rotuloPartida,
    dataCurta: dataCurta
  };
})();
