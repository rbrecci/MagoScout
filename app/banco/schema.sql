-- MagoScout — schema
-- MySQL 5.7+ / MariaDB 10.4+, InnoDB, utf8mb4.
--
-- Dois princípios mandam neste desenho:
--
-- 1. Nada de coluna-contador. Cada toque de botão vira uma linha em `evento`,
--    e todo número que o app mostra é agregação em cima disso.
-- 2. Tudo que pode nascer no celular sem rede tem chave UUID gerada no
--    cliente: jogador, partida, convocação, evento e passagem. Só time e
--    usuário usam AUTO_INCREMENT, porque só são criados online.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------- time

DROP TABLE IF EXISTS time_futsal;
CREATE TABLE time_futsal (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    nome          VARCHAR(80)  NOT NULL,
    escudo        VARCHAR(255) NULL,
    -- Token do link público somente-leitura dos jogadores. Longo e aleatório:
    -- é o único obstáculo de acesso, já que essa tela não tem senha.
    token_publico CHAR(32)     NOT NULL,
    criado_em     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_token (token_publico)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------- comissão

DROP TABLE IF EXISTS usuario;
CREATE TABLE usuario (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    time_id    INT UNSIGNED NOT NULL,
    nome       VARCHAR(80)  NOT NULL,
    email      VARCHAR(120) NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    criado_em  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_email (email),
    KEY ix_time (time_id),
    CONSTRAINT fk_usuario_time FOREIGN KEY (time_id) REFERENCES time_futsal (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------- elenco

DROP TABLE IF EXISTS jogador;
CREATE TABLE jogador (
    uuid      CHAR(36)     NOT NULL PRIMARY KEY,
    time_id   INT UNSIGNED NOT NULL,
    numero    SMALLINT UNSIGNED NULL,
    nome      VARCHAR(80)  NOT NULL,
    posicao   ENUM ('goleiro', 'fixo', 'ala', 'pivo') NOT NULL,
    -- Jogador que sai do elenco não é apagado: os eventos dele continuam
    -- valendo no histórico das partidas antigas.
    ativo     TINYINT(1)   NOT NULL DEFAULT 1,
    criado_em DATETIME     NOT NULL,
    -- Carimbo do servidor. É o relógio da sincronização: o celular pergunta
    -- "o que mudou depois de tal instante" e compara com este campo, nunca com
    -- o relógio local — dois aparelhos nunca concordam sobre que horas são.
    recebido_em DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY ix_time_ativo (time_id, ativo),
    KEY ix_recebido (time_id, recebido_em),
    CONSTRAINT fk_jogador_time FOREIGN KEY (time_id) REFERENCES time_futsal (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------- partida

DROP TABLE IF EXISTS partida;
CREATE TABLE partida (
    uuid            CHAR(36)     NOT NULL PRIMARY KEY,
    time_id         INT UNSIGNED NOT NULL,
    adversario      VARCHAR(80)  NULL,
    data            DATE         NOT NULL,
    campeonato      VARCHAR(80)  NULL,
    tipo            ENUM ('oficial', 'amistoso', 'treino') NOT NULL DEFAULT 'oficial',
    -- Configurável: o Raul pediu poder rodar 2x18 ou 2x16.
    periodos        TINYINT UNSIGNED NOT NULL DEFAULT 2,
    minutos_periodo TINYINT UNSIGNED NOT NULL DEFAULT 20,
    -- O placar sai dos eventos (gol / gol_sofrido). Estas colunas só existem
    -- para permitir correção manual quando o scout perde um lance.
    gols_pro        SMALLINT UNSIGNED NULL,
    gols_contra     SMALLINT UNSIGNED NULL,
    status          ENUM ('rascunho', 'em_andamento', 'encerrada') NOT NULL DEFAULT 'rascunho',
    criado_em       DATETIME     NOT NULL,
    atualizado_em   DATETIME     NOT NULL,
    recebido_em     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY ix_time_data (time_id, data),
    KEY ix_recebido (time_id, recebido_em),
    CONSTRAINT fk_partida_time FOREIGN KEY (time_id) REFERENCES time_futsal (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Relação de convocados: o elenco é montado por jogo.
DROP TABLE IF EXISTS convocacao;
CREATE TABLE convocacao (
    partida_uuid CHAR(36) NOT NULL,
    jogador_uuid CHAR(36) NOT NULL,
    recebido_em  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (partida_uuid, jogador_uuid),
    KEY ix_jogador (jogador_uuid),
    KEY ix_recebido (recebido_em),
    CONSTRAINT fk_conv_partida FOREIGN KEY (partida_uuid) REFERENCES partida (uuid) ON DELETE CASCADE,
    CONSTRAINT fk_conv_jogador FOREIGN KEY (jogador_uuid) REFERENCES jogador (uuid) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------- catálogo de ações

-- Tabela em vez de ENUM: adicionar uma ação nova vira INSERT, não migração.
DROP TABLE IF EXISTS tipo_evento;
CREATE TABLE tipo_evento (
    codigo     VARCHAR(24) NOT NULL PRIMARY KEY,
    rotulo     VARCHAR(40) NOT NULL,
    sigla      VARCHAR(4)  NOT NULL,
    escopo     ENUM ('jogador', 'time') NOT NULL,
    -- Restringe o botão ao goleiro (defesa, gol sofrido, reposição).
    so_goleiro TINYINT(1)  NOT NULL DEFAULT 0,
    -- Contraparte para o cálculo de aproveitamento: certo x errado.
    par        VARCHAR(24) NULL,
    natureza   ENUM ('positiva', 'negativa', 'neutra') NOT NULL,
    ordem      SMALLINT UNSIGNED NOT NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

INSERT INTO tipo_evento (codigo, rotulo, sigla, escopo, so_goleiro, par, natureza, ordem) VALUES
    ('gol',                 'Gol',                'GOL', 'jogador', 0, NULL,                 'positiva', 10),
    ('finalizacao_certa',   'Finalização certa',  'FC',  'jogador', 0, 'finalizacao_errada', 'positiva', 20),
    ('finalizacao_errada',  'Finalização errada', 'FE',  'jogador', 0, 'finalizacao_certa',  'negativa', 30),
    ('drible_certo',        'Drible certo',       'DC',  'jogador', 0, 'drible_errado',      'positiva', 40),
    ('drible_errado',       'Drible errado',      'DE',  'jogador', 0, 'drible_certo',       'negativa', 50),
    ('passe_certo',         'Passe certo',        'PC',  'jogador', 0, 'passe_errado',       'positiva', 60),
    ('passe_errado',        'Passe errado',       'PE',  'jogador', 0, 'passe_certo',        'negativa', 70),
    ('bola_roubada',        'Bola roubada',       'BR',  'jogador', 0, NULL,                 'positiva', 80),
    ('falta_cometida',      'Falta cometida',     'F',   'jogador', 0, NULL,                 'negativa', 90),
    ('falta_sofrida',       'Falta sofrida',      'FS',  'jogador', 0, NULL,                 'neutra',  100),
    ('cartao_amarelo',      'Cartão amarelo',     'CA',  'jogador', 0, NULL,                 'negativa',110),
    ('cartao_vermelho',     'Cartão vermelho',    'CV',  'jogador', 0, NULL,                 'negativa',120),
    ('defesa',              'Defesa',             'D',   'jogador', 1, NULL,                 'positiva',130),
    ('gol_sofrido',         'Gol sofrido',        'GS',  'jogador', 1, NULL,                 'negativa',140),
    ('reposicao_certa',     'Reposição certa',    'RC',  'jogador', 1, 'reposicao_errada',   'positiva',150),
    ('reposicao_errada',    'Reposição errada',   'RE',  'jogador', 1, 'reposicao_certa',    'negativa',160),
    ('lateral_ofensivo',    'Lateral ofensivo',   'LO',  'time',    0, NULL,                 'neutra',  170),
    ('lateral_defensivo',   'Lateral defensivo',  'LD',  'time',    0, NULL,                 'neutra',  180),
    ('escanteio_ofensivo',  'Escanteio ofensivo', 'EO',  'time',    0, NULL,                 'neutra',  190),
    ('escanteio_defensivo', 'Escanteio defensivo','ED',  'time',    0, NULL,                 'neutra',  200);

-- ---------------------------------------------------------------- eventos

DROP TABLE IF EXISTS evento;
CREATE TABLE evento (
    -- Gerado no celular. É o que torna o reenvio idempotente: subir a mesma
    -- fila duas vezes não duplica nada.
    uuid         CHAR(36)     NOT NULL PRIMARY KEY,
    partida_uuid CHAR(36)     NOT NULL,
    jogador_uuid CHAR(36)     NULL,
    tipo         VARCHAR(24)  NOT NULL,
    periodo      TINYINT UNSIGNED NOT NULL,
    -- Segundo dentro do período. É daqui que sai o gráfico temporal e o
    -- recorte de 1º contra 2º tempo.
    segundo      INT UNSIGNED NOT NULL,
    -- Undo não apaga: marca. Assim o evento anulado ainda sincroniza e some
    -- em todos os aparelhos.
    anulado      TINYINT(1)   NOT NULL DEFAULT 0,
    criado_por   INT UNSIGNED NULL,
    criado_em    DATETIME     NOT NULL,
    -- ON UPDATE porque o undo altera a linha: o outro aparelho precisa receber
    -- a anulação, não só a criação.
    recebido_em  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY ix_partida_jogador (partida_uuid, jogador_uuid, anulado),
    KEY ix_partida_tipo (partida_uuid, tipo, anulado),
    KEY ix_partida_periodo (partida_uuid, periodo, segundo),
    KEY ix_recebido (recebido_em),
    CONSTRAINT fk_evento_partida FOREIGN KEY (partida_uuid) REFERENCES partida (uuid) ON DELETE CASCADE,
    CONSTRAINT fk_evento_jogador FOREIGN KEY (jogador_uuid) REFERENCES jogador (uuid) ON DELETE SET NULL,
    CONSTRAINT fk_evento_tipo FOREIGN KEY (tipo) REFERENCES tipo_evento (codigo)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------- tempo em quadra

-- Uma linha por passagem do jogador pela quadra. Tempo jogado é a soma de
-- (saiu - entrou), e é o que sustenta a comparação por minuto que o Raul pediu.
DROP TABLE IF EXISTS passagem;
CREATE TABLE passagem (
    uuid         CHAR(36)     NOT NULL PRIMARY KEY,
    partida_uuid CHAR(36)     NOT NULL,
    jogador_uuid CHAR(36)     NOT NULL,
    periodo      TINYINT UNSIGNED NOT NULL,
    entrou       INT UNSIGNED NOT NULL,
    -- NULL = ainda está em quadra.
    saiu         INT UNSIGNED NULL,
    criado_em    DATETIME     NOT NULL,
    recebido_em  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY ix_partida (partida_uuid, periodo),
    KEY ix_jogador (jogador_uuid),
    KEY ix_recebido (recebido_em),
    CONSTRAINT fk_passagem_partida FOREIGN KEY (partida_uuid) REFERENCES partida (uuid) ON DELETE CASCADE,
    CONSTRAINT fk_passagem_jogador FOREIGN KEY (jogador_uuid) REFERENCES jogador (uuid) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
