// A ponte entre os números e a IA. Monta o resumo do jogo, pede o texto ao
// servidor e guarda o que voltou.
//
// O resumo é montado aqui, e não no PHP, porque quem sabe somar evento é o
// `estatisticas.js`: o servidor recebe número pronto e só escreve o prompt.
// Também é aqui que o resumo encolhe. Mandar a partida inteira seria pagar
// token por evento de lateral; o que vai é o que um treinador leria.

var IA = (function () {
  'use strict';

  function chaveDe(tipo, partidaUuid) { return tipo + '|' + partidaUuid; }

  function guardada(tipo, partidaUuid) {
    return DB.obter('analise_ia', chaveDe(tipo, partidaUuid)).catch(function () { return null; });
  }

  function salvar(tipo, partidaUuid, dados) {
    return DB.guardar('analise_ia', {
      chave: chaveDe(tipo, partidaUuid),
      partida_uuid: partidaUuid,
      tipo: tipo,
      texto: dados.texto,
      modelo: dados.modelo,
      quando: dados.quando,
      truncado: !!dados.truncado
    }).catch(function () {
      // Cache que não gravou não é motivo para esconder o texto que já chegou.
      return null;
    });
  }

  function minutos(segundos) {
    return Math.round((segundos / 60) * 10) / 10;
  }

  function rotuloPeriodo(p, quantos) {
    if (quantos === 2) { return p === 1 ? '1o tempo' : '2o tempo'; }
    return 'periodo ' + p;
  }

  // Um balde vira objeto legível. Sem os índices numéricos crus, que a IA lê
  // como número solto e confunde com valor.
  function plano(balde, periodos) {
    var o = { total: balde.total };
    periodos.forEach(function (p) {
      o[rotuloPeriodo(p, periodos.length)] = balde[p];
    });
    return o;
  }

  function taxas(aprov, periodos) {
    var o = {};
    Object.keys(aprov).forEach(function (k) {
      if (aprov[k].total === null) { return; }  // não tentou: fora do resumo
      o[k] = plano(aprov[k], periodos);
    });
    return o;
  }

  // Só os tipos que aconteceram. Zero em 14 das 20 ações é ruído que empurra o
  // texto para longe do que importa.
  function acoesPorTipo(fonte, periodos) {
    var o = {};
    TIPOS.forEach(function (t) {
      var b = fonte.tipos[t.codigo];
      if (b && b.total > 0) { o[t.rotulo] = plano(b, periodos); }
    });
    return o;
  }

  function resumoDoJogo(res) {
    var per = res.periodos;
    var p = res.partida;

    var jogadores = res.jogadores.filter(function (f) { return f.participou; })
      .map(function (f) {
        var min = minutos(f.segundos.total);
        // O balde de segundos vira balde de minutos varrendo os períodos que a
        // partida tem. Fixar 1 e 2 na mão funcionaria hoje e sumiria com o
        // terceiro tempo no dia em que alguém configurar a partida com ele.
        var emMinutos = { total: min };
        per.forEach(function (p) { emMinutos[p] = minutos(f.segundos[p] || 0); });

        return {
          nome: f.jogador.nome,
          numero: f.jogador.numero,
          posicao: f.jogador.posicao,
          minutos_em_quadra: min,
          minutos_por_periodo: plano(emMinutos, per),
          acoes: plano(f.acoes, per),
          acoes_por_minuto: min ? Math.round((f.acoes.total / min) * 100) / 100 : null,
          aproveitamento_pct: taxas(f.aproveitamento, per),
          acoes_detalhadas: acoesPorTipo(f, per)
        };
      });

    var naoEntraram = res.jogadores.filter(function (f) { return !f.participou; })
      .map(function (f) { return f.jogador.nome; });

    return {
      partida: {
        adversario: p.adversario || 'adversário não informado',
        data: p.data || null,
        tipo: p.tipo || null,
        campeonato: p.campeonato || null,
        placar: res.golsPro + ' x ' + res.golsContra,
        periodos: per.length,
        minutos_por_periodo: p.minutosPeriodo || 20
      },
      time: {
        acoes_totais: plano(res.time.acoes, per),
        acoes_de_jogador: plano(res.time.acoesJogadores, per),
        minutos_somados_do_elenco: minutos(res.time.segundos.total),
        aproveitamento_pct: taxas(res.time.aproveitamento, per),
        acoes_detalhadas: acoesPorTipo(res.time, per)
      },
      jogadores: jogadores,
      relacionados_que_nao_entraram: naoEntraram,
      legenda: {
        aproveitamento_pct: 'percentual; ausente significa que não houve tentativa, não zero',
        acoes_totais: 'inclui lateral e escanteio, que não têm dono',
        acoes_de_jogador: 'exclui lateral e escanteio; é a régua justa por minuto'
      }
    };
  }

  // `forcar` existe para o botão "gerar de novo": sem ele, o texto guardado
  // ganha, e é o que se quer em quase toda abertura da tela.
  function analiseDoJogo(res, forcar) {
    var uuid = res.partida.uuid;

    return guardada('jogo', uuid).then(function (cache) {
      if (cache && !forcar) {
        cache.doCache = true;
        return cache;
      }
      if (!navigator.onLine) {
        var semRede = new Error('sem conexão agora. A análise da IA precisa de internet para nascer, mas depois de gerada fica salva no aparelho.');
        semRede.semRede = true;
        throw semRede;
      }
      return Api.analiseIa('jogo', resumoDoJogo(res)).then(function (r) {
        return salvar('jogo', uuid, r).then(function () {
          r.doCache = false;
          return r;
        });
      });
    });
  }

  // ------------------------------------------------ o texto na tela

  // Markdown do tamanho exato do que os prompts pedem: título, lista, parágrafo
  // e negrito. Nada aqui usa innerHTML: o texto vem de fora do app, e montar nó
  // a nó é o que garante que uma resposta estranha vire texto estranho na tela,
  // e não marcação executada.
  function comNegrito(alvo, texto) {
    texto.split(/\*\*/).forEach(function (parte, i) {
      if (parte === '') { return; }
      if (i % 2 === 1) {
        var forte = document.createElement('strong');
        forte.textContent = parte;
        alvo.appendChild(forte);
      } else {
        alvo.appendChild(document.createTextNode(parte));
      }
    });
  }

  function render(alvo, texto) {
    alvo.innerHTML = '';
    var lista = null;

    texto.split('\n').forEach(function (bruta) {
      var linha = bruta.trim();

      if (linha === '') { lista = null; return; }

      if (linha.indexOf('#') === 0) {
        lista = null;
        var h = document.createElement('h3');
        h.textContent = linha.replace(/^#+\s*/, '');
        alvo.appendChild(h);
        return;
      }

      if (/^[-*]\s+/.test(linha)) {
        if (!lista) {
          lista = document.createElement('ul');
          alvo.appendChild(lista);
        }
        var li = document.createElement('li');
        comNegrito(li, linha.replace(/^[-*]\s+/, ''));
        lista.appendChild(li);
        return;
      }

      lista = null;
      var p = document.createElement('p');
      comNegrito(p, linha);
      alvo.appendChild(p);
    });
  }

  // ------------------------------------------------ quem está caindo

  // As métricas que dizem alguma coisa sobre rendimento ao longo da temporada.
  // Gol e falta ficam de fora de propósito: são soma, e soma por jogo oscila
  // demais para virar tendência com o punhado de jogos que um time amador tem.
  var METRICAS_TENDENCIA = ['acoes_min', 'passe', 'finalizacao', 'drible'];

  // No time entram faltas e roubadas, que no jogador seriam soma solta demais
  // para virar tendência mas no coletivo dizem se o time está pressionando bem
  // ou saindo no tranco. É o tipo de coisa que vira treino da semana.
  var METRICAS_TIME = METRICAS_TENDENCIA.concat(['faltas', 'roubadas_min']);

  var RECENTES = 3;

  // Partida com quase nada registrado não é partida ruim, é partida não
  // escoutada: o scout foi aberto e largado, ou o jogo acabou antes de começar.
  // E ela não entra na conta como um ponto fraco qualquer, ela detona a série
  // inteira: com poucos minutos rodados, tudo que é "por minuto" estoura (um
  // jogo de 3 ações apareceu como 12 ações por minuto contra 1,5 dos outros) e
  // todo percentual vira 100%, porque a única tentativa registrada deu certo.
  // Um jogo desses arrastava a média dos recentes para o triplo da real.
  var MINIMO_ACOES_NO_JOGO = 30;

  function jogosUteis(jogos) {
    return jogos.filter(function (j) { return j.time.acoes.total >= MINIMO_ACOES_NO_JOGO; });
  }

  // Abaixo disto não existe "antes e depois": com 3 jogos, os 3 recentes comem
  // a temporada inteira e não sobra com o que comparar. Oferecer o botão assim
  // seria oferecer um palpite com cara de análise.
  var MINIMO_JOGOS = RECENTES + 1;

  function arredondar(v, casas) {
    if (v === null || v === undefined) { return null; }
    var f = Math.pow(10, casas === undefined ? 2 : casas);
    return Math.round(v * f) / f;
  }

  // A conta toda sai do estatisticas.js. Aqui só se separa o começo do fim da
  // temporada: a IA recebe as duas médias prontas e escreve sobre elas, em vez
  // de tentar fazer média de cabeça, que é onde modelo de linguagem erra.
  function tendencia(valores) {
    var jogados = valores.filter(function (v) { return v !== null && v !== undefined; });
    if (jogados.length < 2) { return null; }

    var recentes = jogados.slice(-RECENTES);
    var anteriores = jogados.slice(0, -RECENTES);

    var mediaRecente = Estatisticas.media(recentes);
    var mediaAnterior = anteriores.length ? Estatisticas.media(anteriores) : null;

    return {
      por_jogo: valores.map(function (v) { return arredondar(v); }),
      media_geral: arredondar(Estatisticas.media(jogados)),
      media_dos_ultimos: arredondar(mediaRecente),
      media_dos_anteriores: arredondar(mediaAnterior),
      diferenca: mediaAnterior === null ? null : arredondar(mediaRecente - mediaAnterior),
      variacao_tipica: arredondar(Estatisticas.desvio(jogados))
    };
  }

  // Serve o time e o jogador com o mesmo código: `serie` com uuid nulo devolve a
  // referência do time. Uma implementação só, senão os dois blocos do resumo
  // podem discordar entre si por engano de digitação.
  function tendenciasDe(jogos, uuid, metricas) {
    var porMetrica = {};
    var quedaNoJogo = {};

    metricas.forEach(function (m) {
      function valores(periodo) {
        return Estatisticas.serie(jogos, uuid, m, periodo).map(function (p) { return p.valor; });
      }

      var t = tendencia(valores('total'));
      if (t) { porMetrica[m.rotulo] = t; }

      // A segunda regularidade que o Raul pediu: constância dentro do jogo.
      var primeiro = Estatisticas.media(valores(1));
      var segundo = Estatisticas.media(valores(2));
      if (primeiro !== null && segundo !== null) {
        quedaNoJogo[m.rotulo] = arredondar(segundo - primeiro);
      }
    });

    return { tendencias: porMetrica, media_do_2o_menos_1o_tempo: quedaNoJogo };
  }

  function resumoDeRendimento(todos) {
    var jogos = jogosUteis(todos);
    var ignorados = todos.length - jogos.length;
    var metricas = METRICAS_TENDENCIA.map(function (c) { return Estatisticas.metricaPor(c); });
    var doTime = METRICAS_TIME.map(function (c) { return Estatisticas.metricaPor(c); });
    var temporada = Estatisticas.temporada(jogos);

    var jogadores = temporada.jogadores.filter(function (f) { return f.participou; })
      .map(function (f) {
        var uuid = f.jogador.uuid;
        var t = tendenciasDe(jogos, uuid, metricas);
        var minutos = Estatisticas.serie(jogos, uuid, Estatisticas.metricaPor('minutos'), 'total');

        return {
          nome: f.jogador.nome,
          numero: f.jogador.numero,
          posicao: f.jogador.posicao,
          jogos_em_que_entrou: minutos.filter(function (p) { return p.participou; }).length,
          minutos_por_jogo: minutos.map(function (p) {
            return p.valor === null ? null : arredondar(p.valor / 60, 1);
          }),
          tendencias: t.tendencias,
          media_do_2o_menos_1o_tempo: t.media_do_2o_menos_1o_tempo
        };
      });

    return {
      jogos_na_ordem: jogos.map(function (j) {
        return {
          adversario: j.partida.adversario || 'sem adversário anotado',
          data: j.partida.data || null,
          placar: j.golsPro + ' x ' + j.golsContra
        };
      }),
      quantos_jogos: jogos.length,
      quantos_contam_como_recentes: RECENTES,
      jogos_deixados_de_fora_por_falta_de_registro: ignorados,
      time: tendenciasDe(jogos, null, doTime),
      jogadores: jogadores,
      legenda: {
        time: 'o número do time por jogo; em métrica de soma é o total dividido por quem esteve em quadra, para poder ficar ao lado do número de um jogador',
        por_jogo: 'um valor por jogo, do mais antigo para o mais novo; null é jogo em que não entrou, não é zero',
        media_dos_ultimos: 'média dos últimos ' + RECENTES + ' jogos em que entrou',
        media_dos_anteriores: 'média de todos os jogos anteriores a esses',
        diferenca: 'media_dos_ultimos menos media_dos_anteriores; negativo é queda',
        variacao_tipica: 'desvio padrão do jogador nessa métrica; é o quanto ele normalmente oscila',
        media_do_2o_menos_1o_tempo: 'negativo significa que ele rende menos no segundo tempo',
        'Ações por minuto': 'volume de participação; não diz se foi certo ou errado',
        'Passe certo %': 'percentual; ausente significa que não houve tentativa'
      }
    };
  }

  // Suba isto sempre que o resumo mudar de conteúdo ou de regra. O texto
  // guardado envelhece de dois jeitos: por jogo novo, que a contagem pega, e por
  // mudança aqui dentro, que a contagem NÃO pega. Foi o que aconteceu quando o
  // filtro de partida sem registro entrou: mesma chave, dados diferentes, texto
  // velho preso na tela para sempre.
  var VERSAO_RESUMO = 2;

  // A chave fica aqui, e não em quem chama, porque duas telas precisam chegar
  // exatamente à mesma: a inicial monta a partir da lista leve de partidas, sem
  // carregar evento nenhum, só para saber se já existe texto guardado.
  function referenciaRendimento(uuidMaisRecente, quantos) {
    return (uuidMaisRecente || 'vazio') + '+' + quantos + '+v' + VERSAO_RESUMO;
  }

  // Os dois modos que leem a temporada inteira partem do mesmo resumo e do
  // mesmo cache; o que muda é o prompt, lá no servidor. Uma função só, para não
  // existir a chance de um deles mandar um resumo diferente do outro.
  function analiseDaTemporada(tipo, jogos, forcar) {
    var ultimo = jogos.length ? jogos[jogos.length - 1].partida.uuid : null;
    var referencia = referenciaRendimento(ultimo, jogos.length);

    return guardada(tipo, referencia).then(function (cache) {
      if (cache && !forcar) {
        cache.doCache = true;
        return cache;
      }

      // A trava da tela conta as partidas da lista, sem abrir os eventos. Só
      // aqui dá para saber quantas foram mesmo escoutadas, e é aqui que a
      // contagem que vale é conferida.
      var uteis = jogosUteis(jogos).length;
      if (uteis < MINIMO_JOGOS) {
        var poucos = new Error('só ' + uteis + (uteis === 1 ? ' jogo tem' : ' jogos têm') +
          ' registro suficiente para comparar (mínimo de ' + MINIMO_JOGOS + '). ' +
          'Partida com pouquíssimas ações fica de fora porque distorce a média.');
        poucos.poucosJogos = true;
        throw poucos;
      }

      if (!navigator.onLine) {
        var semRede = new Error('sem conexão agora. Esta leitura precisa de internet para nascer, mas depois de gerada fica salva no aparelho.');
        semRede.semRede = true;
        throw semRede;
      }
      return Api.analiseIa(tipo, resumoDeRendimento(jogos)).then(function (r) {
        return salvar(tipo, referencia, r).then(function () {
          r.doCache = false;
          return r;
        });
      });
    });
  }

  return {
    analiseDoJogo: analiseDoJogo,
    analiseDaTemporada: analiseDaTemporada,
    guardada: guardada,
    render: render,
    resumoDoJogo: resumoDoJogo,
    resumoDeRendimento: resumoDeRendimento,
    referenciaRendimento: referenciaRendimento,
    RECENTES: RECENTES,
    MINIMO_JOGOS: MINIMO_JOGOS
  };
})();
