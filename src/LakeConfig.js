// Fonte unica do lago: zero imports para Terrain, Player e visual poderem usar sem ciclo.
// Esta configuracao tambem e usada pela escavacao real e pela fisica de agua do jogador.
export const LAGO_PEIXES={
  x:-113,z:-50,
  raioX:5.4,raioZ:3.8,
  nivelAgua:.10,
  profundidade:1.25,
};

const SUAVE=t=>t*t*(3-2*t);
export function coordenadaLago(x,z){
  const dx=(x-LAGO_PEIXES.x)/LAGO_PEIXES.raioX;
  const dz=(z-LAGO_PEIXES.z)/LAGO_PEIXES.raioZ;
  return Math.hypot(dx,dz);
}
export function estaNaAgua(x,z){return coordenadaLago(x,z)<.91}

// Escavacao real: esta funcao altera a ALTURA DO TERRENO, nao desenha uma casca por cima.
// Centro quase plano, talude submerso, linha d'agua e uma borda curta acima do nivel da agua.
// Fora de 1,24 raios volta exatamente para o relevo original, sem degrau.
export function deformarTerrenoLago(base,x,z){
  const q=coordenadaLago(x,z);
  if(q>=1.24)return base;
  const agua=LAGO_PEIXES.nivelAgua;
  const fundo=agua-LAGO_PEIXES.profundidade;
  if(q<=.56){
    const t=SUAVE(q/.56);
    return fundo+.09*t;
  }
  if(q<=.90){
    const t=SUAVE((q-.56)/.34);
    return (fundo+.09)*(1-t)+(agua-.07)*t;
  }
  if(q<=1.02){
    const t=SUAVE((q-.90)/.12);
    return (agua-.07)*(1-t)+(agua+.15)*t;
  }
  const t=SUAVE((q-1.02)/.22);
  return (agua+.15)*(1-t)+base*t;
}
