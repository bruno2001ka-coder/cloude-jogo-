// ===== CONFIGURAÇÕES CENTRALIZADAS DO JOGO =====
// Este arquivo centraliza todos os valores numéricos e constantes do jogo para facilitar
// balanceamento, manutenção e personalização. Magic numbers espalhados pelo código foram
// movidos para cá como parte da refatoração de arquitetura.

// ===== CONFIGURAÇÕES DO JOGADOR =====
export const JOGADOR = {
  ALTURA: 0.9,           // Altura total do personagem em metros
  ESCALA: 0.9,           // Fator de escala do modelo 3D
  VELOCIDADE_ANDAR: 4.5, // Velocidade de movimento (m/s)
  VELOCIDADE_CORRIDA: 7.2,
};

// ===== ZONAS DE ACERTO (frações da altura do jogador) =====
// Usado tanto para o jogador quanto para policiais - mantém consistência no combate
export const ZONAS_ACERTO = {
  CABECA_MIN: 0.657,     // Início da zona da cabeça (65.7% da altura)
  CABECA_MAX: 0.9,       // Topo da cabeça
  TRONCO_MIN: 0.313,     // Início do tronco (31.3% da altura)
  TRONCO_MAX: 0.657,     // Topo do tronco
  MULTIPLICADOR_CABECA: 2.0,   // Dano crítico na cabeça
  MULTIPLICADOR_TRONCO: 1.0,   // Dano normal no tronco
  MULTIPLICADOR_MEMBEROS: 0.6, // Dano reduzido em membros
};

// ===== ALTURAS DE COMBATE (derivadas da altura do jogador) =====
export const COMBATE = {
  ALT_TORSO: JOGADOR.ALTURA * 0.485,  // Centro do tronco para mira da IA
  ALT_OLHO: JOGADOR.ALTURA * 0.80,    // Altura dos olhos
  ALT_CANO: JOGADOR.ALTURA * 0.52,    // Altura do cano da arma
  VEL_REF: 4.5,         // Velocidade de referência para cálculo de precisão
  LEAD_FATOR: 0.62,     // Quanto da antecipação perfeita a IA acerta
  LEAD_RUIDO: 0.28,     // Ruído na antecipação
  MIRA_CHEIA: 1.4,      // Tempo (s) para mira assentar completamente
  MIRA_FRIA: 2.2,       // Multiplicador de erro quando começa a mirar
  TEMPO_REACAO_MIN: 0.28, // Tempo mínimo de reação da IA (s)
  TEMPO_REACAO_MAX: 0.70, // Tempo máximo de reação da IA (s)
};

// ===== FAIXAS DE DISTÂNCIA DE COMBATE =====
// Erro base da IA por faixa de distância
export const FAIXAS_DISTANCIA = [
  { ate: 4,   erro: 0.012 },  // Encostado: quase não erra
  { ate: 9,   erro: 0.034 },  // Média: acerta bem mas erra o suficiente
  { ate: 14,  erro: 0.048 },  // Longa: pressão real, ameaça baixa
  { ate: 1e9, erro: 0.085 },  // Muito longa
];

// ===== SISTEMA DE POLÍCIA =====
export const POLICIA = {
  PAPEL_DURACAO: 5,        // Duração mínima de um papel (s)
  DIR_COBERTURA: 10,       // Número de direções testadas para cobertura
  RAIOS_COBERTURA: [2.2, 4, 6], // Distâncias testadas para encontrar cobertura
  PASSO_SAIDA: 1.3,        // Distância do passo ao sair da cobertura
  PROCURADO_MAX: 5,        // Nível máximo de procurado
  DECAY_PROCURADO: 0.008,  // Taxa de decaimento do nível procurado por segundo
};

// ===== PAPÉIS DA EQUIPE POLICIAL =====
export const PAPEL_POLICIA = {
  PRESSAO: 'pressao',
  AVANCO: 'avanco',
  FLANCO: 'flanco',
  COBERTURA: 'cobertura',
};

// Distâncias que cada papel quer manter do jogador
export const DIST_PAPEL = {
  pressao: 11,
  avanco: 3.5,
  flanco: 8,
  cobertura: 9,
};

// ===== ECONOMIA E PLANTIO =====
export const ECONOMIA = {
  DINHEIRO_INICIAL: 10000,  // Saldo inicial para testes
  TEMPO_ESTAGIO_PLANTA: 22, // Segundos por estágio de crescimento da planta
  ALCANCE_MIRA_PLANTIO: 14, // Alcance máximo da mira de plantio (m)
  LOTES_ENTREGA: [1, 2, 3, 5, 7, 10, 12, 15, 20], // Tamanhos de lote para entrega
  MAX_PLANTAS: 40,          // Limite máximo de plantas simultâneas
};

// ===== SAVE SYSTEM =====
export const SAVE_CONFIG = {
  VERSAO: 1,                // Versão atual do formato de save
  INTERVALO_AUTOSAVE: 5,    // Intervalo entre saves automáticos (s)
  CHAVE_A: 'quintal3d.save.a',
  CHAVE_B: 'quintal3d.save.b',
};

// ===== CONFIGURAÇÕES DE ÁUDIO =====
export const AUDIO = {
  VOLUME_GERAL: 0.7,
  VOLUME_TIRO: 0.8,
  VOLUME_PASSOS: 0.4,
  VOLUME_AMBIENTE: 0.5,
  DISTANCIA_MAX_SOM: 50,    // Distância máxima para ouvir sons (m)
};

// ===== PERFORMANCE =====
export const PERFORMANCE = {
  MAX_POLICIAIS: 8,         // Número máximo de policiais simultâneos
  MAX_NPCS: 12,             // Número máximo de NPCs civis
  MAX_BALAS: 100,           // Número máximo de projéteis ativos
  FPS_ALVO: 60,             // FPS alvo para cálculos de delta time
};

// ===== INTERFACE DO USUÁRIO =====
export const UI = {
  TEMPO_TOAST: 3000,        // Duração de notificações toast (ms)
  OPACIDADE_MIRA: 0.85,
  COR_MIRA_VALIDA: '#33ff55',
  COR_MIRA_INVALIDA: '#ff3333',
};

// ===== FÍSICA E COLISÃO =====
export const FISICA = {
  GRAVIDADE: -9.81,         // Aceleração da gravidade (m/s²)
  ATRITO_CHAO: 0.92,        // Fator de atrito no chão
  RAIO_COLISAO_JOGADOR: 0.35, // Raio do cilindro de colisão do jogador
};

// ===== ARSENAL (valores base) =====
// Valores completos estão em Weapons.js, estes são os modificadores globais
export const ARMAS_CONFIG = {
  PISTOLA: { dano: 34, cooldown: 0.28, alcance: 120, projeteis: 1, dispersao: 0 },
  RIFLE: { dano: 50, cooldown: 0.45, alcance: 160, projeteis: 1, dispersao: 0.5 },
  ESCOPETA: { dano: 14, cooldown: 0.85, alcance: 40, projeteis: 6, dispersao: 5 },
  METRALHADORA: { dano: 20, cooldown: 0.11, alcance: 90, projeteis: 1, dispersao: 2.2 },
};

// Helper function para validar números dentro de faixas
export function clamp(valor, min, max) {
  return Math.min(max, Math.max(min, valor));
}

// Helper para validar inteiros
export function inteiro(valor, padrao = 0, min = 0, max = 1e9) {
  const n = Math.floor(Number(valor));
  return Number.isFinite(n) ? clamp(n, min, max) : padrao;
}

// Helper para validar números decimais
export function numero(valor, padrao = 0, min = -1e6, max = 1e6) {
  const n = Number(valor);
  return Number.isFinite(n) ? clamp(n, min, max) : padrao;
}

// Helper para validar booleanos
export function booleano(valor) {
  return valor === true;
}
