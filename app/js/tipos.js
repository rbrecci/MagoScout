// Catálogo de ações. Espelha a tabela `tipo_evento` do banco.
// Ao mexer aqui, mexa no schema.sql também: são a mesma lista em dois lugares
// porque a tela precisa funcionar offline, sem consultar o servidor.

var TIPOS = [
  { codigo: 'gol',                 rotulo: 'Gol',                sigla: 'GOL', escopo: 'jogador', soGoleiro: false, par: null,                 natureza: 'positiva' },
  { codigo: 'finalizacao_certa',   rotulo: 'Finalização certa',  sigla: 'FC',  escopo: 'jogador', soGoleiro: false, par: 'finalizacao_errada', natureza: 'positiva' },
  { codigo: 'finalizacao_errada',  rotulo: 'Finalização errada', sigla: 'FE',  escopo: 'jogador', soGoleiro: false, par: 'finalizacao_certa',  natureza: 'negativa' },
  { codigo: 'drible_certo',        rotulo: 'Drible certo',       sigla: 'DC',  escopo: 'jogador', soGoleiro: false, par: 'drible_errado',      natureza: 'positiva' },
  { codigo: 'drible_errado',       rotulo: 'Drible errado',      sigla: 'DE',  escopo: 'jogador', soGoleiro: false, par: 'drible_certo',       natureza: 'negativa' },
  { codigo: 'passe_certo',         rotulo: 'Passe certo',        sigla: 'PC',  escopo: 'jogador', soGoleiro: false, par: 'passe_errado',       natureza: 'positiva' },
  { codigo: 'passe_errado',        rotulo: 'Passe errado',       sigla: 'PE',  escopo: 'jogador', soGoleiro: false, par: 'passe_certo',        natureza: 'negativa' },
  { codigo: 'bola_roubada',        rotulo: 'Bola roubada',       sigla: 'BR',  escopo: 'jogador', soGoleiro: false, par: null,                 natureza: 'positiva' },
  { codigo: 'falta_cometida',      rotulo: 'Falta cometida',     sigla: 'F',   escopo: 'jogador', soGoleiro: false, par: null,                 natureza: 'negativa' },
  { codigo: 'falta_sofrida',       rotulo: 'Falta sofrida',      sigla: 'FS',  escopo: 'jogador', soGoleiro: false, par: null,                 natureza: 'neutra'   },
  { codigo: 'cartao_amarelo',      rotulo: 'Cartão amarelo',     sigla: 'CA',  escopo: 'jogador', soGoleiro: false, par: null,                 natureza: 'negativa' },
  { codigo: 'cartao_vermelho',     rotulo: 'Cartão vermelho',    sigla: 'CV',  escopo: 'jogador', soGoleiro: false, par: null,                 natureza: 'negativa' },
  { codigo: 'defesa',              rotulo: 'Defesa',             sigla: 'D',   escopo: 'jogador', soGoleiro: true,  par: null,                 natureza: 'positiva' },
  { codigo: 'gol_sofrido',         rotulo: 'Gol sofrido',        sigla: 'GS',  escopo: 'jogador', soGoleiro: true,  par: null,                 natureza: 'negativa' },
  { codigo: 'reposicao_certa',     rotulo: 'Reposição certa',    sigla: 'RC',  escopo: 'jogador', soGoleiro: true,  par: 'reposicao_errada',   natureza: 'positiva' },
  { codigo: 'reposicao_errada',    rotulo: 'Reposição errada',   sigla: 'RE',  escopo: 'jogador', soGoleiro: true,  par: 'reposicao_certa',    natureza: 'negativa' },
  { codigo: 'lateral_ofensivo',    rotulo: 'Lateral ofensivo',   sigla: 'LO',  escopo: 'time',    soGoleiro: false, par: null,                 natureza: 'neutra'   },
  { codigo: 'lateral_defensivo',   rotulo: 'Lateral defensivo',  sigla: 'LD',  escopo: 'time',    soGoleiro: false, par: null,                 natureza: 'neutra'   },
  { codigo: 'escanteio_ofensivo',  rotulo: 'Escanteio ofensivo', sigla: 'EO',  escopo: 'time',    soGoleiro: false, par: null,                 natureza: 'neutra'   },
  { codigo: 'escanteio_defensivo', rotulo: 'Escanteio defensivo',sigla: 'ED',  escopo: 'time',    soGoleiro: false, par: null,                 natureza: 'neutra'   }
];

// As duas ações de maior volume num jogo de futsal. Ficam direto no card do
// jogador, a um toque; o resto exige abrir o painel.
var ATALHOS = ['passe_certo', 'passe_errado'];

function tipoPor(codigo) {
  for (var i = 0; i < TIPOS.length; i++) {
    if (TIPOS[i].codigo === codigo) { return TIPOS[i]; }
  }
  return null;
}

// Ações que aparecem no painel de um jogador, conforme a posição.
function tiposDoJogador(posicao) {
  return TIPOS.filter(function (t) {
    if (t.escopo !== 'jogador') { return false; }
    // O goleiro joga com o pé o tempo todo no futsal: ele usa as ações de
    // linha também, mais as exclusivas dele.
    return posicao === 'goleiro' ? true : !t.soGoleiro;
  });
}

function tiposDoTime() {
  return TIPOS.filter(function (t) { return t.escopo === 'time'; });
}
