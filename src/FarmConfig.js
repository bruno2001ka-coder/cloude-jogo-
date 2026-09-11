// Fonte única das medidas e coordenadas da fazenda principal.
// ZERO imports de propósito: Terrain, WorldGenerator, Poles e testes podem ler estes números
// sem dependência circular.
const cx=-86,cz=-50,meiaLarg=13,meiaProf=11;
const casaX=cx-meiaLarg+5,casaZ=cz-meiaProf+5;
const porteiraX=cx+meiaLarg,porteiraZ=cz;
const portaVao=2.35,porteiraVao=3.4;

export const FAZENDA_CONFIG=Object.freeze({
  cx,cz,meiaLarg,meiaProf,
  casa:Object.freeze({
    x:casaX,z:casaZ,
    largura:6,profundidade:5,altura:3.2,
    baseLargura:6.3,baseProfundidade:5.3,baseAltura:.3,
    portaVao,
    portaFrenteZ:casaZ+2.53,
  }),
  porteira:Object.freeze({
    x:porteiraX,z:porteiraZ,vao:porteiraVao,
  }),
  acesso:Object.freeze({
    a:Object.freeze({x:porteiraX-.8,z:porteiraZ}),
    b:Object.freeze({x:casaX,z:casaZ+2.75}),
    raio:1.9,
  }),
  servico:Object.freeze({
    cocho:Object.freeze({x:casaX+4.5,z:casaZ,largura:2.1,profundidade:.7}),
    barril:Object.freeze({x:casaX+4.3,z:casaZ-1.2,raio:.4}),
    // Área já existente ao lado da casa reservada para circulação/serviço. Não cria piso nem construção:
    // apenas impede a roça de nascer atravessando cocho, barril e ponto de compra.
    limpeza:Object.freeze({x:casaX+4.85,z:casaZ-.6,meiaX:1.7,meiaZ:1.5}),
  }),
  // O ponto de compra fica ao lado externo do cocho, sem entrar no objeto, sem disputar a porta e
  // sem ocupar o corredor principal. Não existe construção nova aqui: é apenas a coordenada de ação.
  polo:Object.freeze({x:casaX+6,z:casaZ}),
  // Platôs locais: a construção e a soleira da porteira assentam niveladas. A faixa entre inner/outer
  // faz a transição suave para o relevo original, sem degrau artificial.
  nivelamentoCasa:Object.freeze({innerX:4.8,innerZ:4.3,outerX:6.5,outerZ:6.0}),
  nivelamentoPorteira:Object.freeze({innerX:1.35,innerZ:2.15,outerX:2.8,outerZ:3.6}),
});
