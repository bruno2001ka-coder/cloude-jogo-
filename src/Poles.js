// ===== POLOS ECONÔMICOS: as 4 coordenadas (X, Z) que estruturam a navegação do mapa =====
// Dado puro, ZERO imports de propósito: WorldGenerator (constrói os prédios), Economy (ações do painel)
// e UI (radar) precisam dos mesmos números. Qualquer outra colocação criaria dependência circular.
//
// Critério de disposição (Level Design): quadrilátero em torno do bairro (x ∈ [-36, 35], z ∈ [-42, -4]),
// com nenhum trecho menor que 60 m — o jogador é obrigado a atravessar o bairro, que é exatamente onde
// o helicóptero patrulha. Perímetro do circuito completo ≈ 311 m.
//
//                  Fazenda  Sementes  Armas  Receptador
//   Fazenda           —       100      156      168
//   Sementes        100        —        68       67
//   Armas           156       68        —        76
//   Receptador      168       67       76        —
export const POLOS={
  // Oeste — insumo barato, mas longe: terra e vaso na fonte.
  fazenda:{x:-94,z:-53,raio:5.5,rotulo:'Depósito Rural',cor:'#c8a24a'},
  // Centro/Norte — o mercadinho que já existia no bairro: caro, porém seguro e no caminho.
  sementes:{x:0,z:-18,raio:4.5,rotulo:'Mercado de Sementes',cor:'#5ec2ff'},
  // Nordeste — munição e colete: o polo que sustenta o sistema de combate.
  // `predio` é onde o barracão é construído; (x,z) é o BALCÃO, onde o jogador para pra comprar. Os dois
  // precisam ser separados: com o ponto de interação no centro do prédio ele cai dentro da parede e vira
  // uma célula bloqueada — o jogador esbarra na loja em vez de conseguir usá-la.
  armas:{x:60,z:-46,predio:{x:60,z:-50},raio:5,rotulo:'Loja de Armas',cor:'#ff9d3b'},
  // Sudeste — semente rara e escoamento dos pacotes.
  receptador:{x:50,z:30,raio:4.5,rotulo:'Receptador',cor:'#ff5e5e'},
};

// Tabela de preços num lugar só, pra Economy e para o painel de ações não divergirem.
// O preço mora aqui e o balanceamento de combate mora em Weapons.js: a loja (Economy) e o catálogo
// (Weapons) precisam do mesmo número, e Poles é o único módulo que os dois importam sem fechar ciclo.
// `qtd` é o tamanho do pacote de munição — cartucho de escopeta vale mais que bala de pistola.
export const PRECOS={
  fazendaTerra:6,fazendaVaso:8,
  // Diária da roça: a rede de segurança contra ficar sem saída. R$25 a cada 45 s dá R$33/min,
  // contra R$80-120 por ciclo de plantio (2-3 pacotes a R$40, custando R$48) — nunca compensa
  // mais que plantar, então é piso e não atalho.
  fazendaDiaria:25,fazendaDiariaEspera:45,
  // Cada insumo tem UM ponto de venda: vaso e terra na fazenda, semente no mercado. Os preços de
  // vaso/terra no mercado e de semente no receptador saíram junto com os botões — preço sem loja
  // que o use é a próxima coisa a divergir sem ninguém notar.
  mercadoSemente:34,
  armas:{
    pistola:{arma:0,municao:35,qtd:12},// arma:0 — já vem com o jogador, nunca aparece à venda
    rifle:{arma:420,municao:60,qtd:15},
    escopeta:{arma:520,municao:70,qtd:8},
    metralhadora:{arma:780,municao:95,qtd:40},
  },
  armasColete:70,
  receptadorPacote:40,
};
