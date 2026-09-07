// Limites compartilhados do mundo jogável. Manter os números aqui evita que terreno,
// jogador, drone, câmera e broadphase de colisão discordem quando o mapa cresce.
//
// O bairro detalhado continua concentrado no centro; o terreno maior dá espaço para expansão
// futura sem obrigar o renderizador a duplicar casas, NPCs ou colisores neste commit.
export const MAP_HALF_SIZE=260;
export const MAP_SIZE=MAP_HALF_SIZE*2;
// A barreira fica fora do terreno; esta margem mínima só preserva a hitbox na quina.
export const MAP_EDGE_MARGIN=.12;
export const PLAYER_LIMIT=MAP_HALF_SIZE-MAP_EDGE_MARGIN;

// A grade de colisão cobre o terreno e uma pequena folga. A célula é mantida em 2 m porque
// ela já foi medida como o melhor ponto entre custo de consulta e número de baldes.
export const COLLISION_CELL_SIZE=2;
export const COLLISION_HALF_SIZE=MAP_HALF_SIZE+16;
export const COLLISION_GRID_DIM=Math.ceil(COLLISION_HALF_SIZE*2/COLLISION_CELL_SIZE);
export const COLLISION_GRID_OFFSET=COLLISION_GRID_DIM/2;
