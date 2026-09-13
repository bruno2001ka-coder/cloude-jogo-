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
  // Layout REAL da fazenda visível: os três currais abaixo são os mesmos de AnimalPens.js.
  // Mantê-los aqui impede outro gerador de plantar/posicionar objetos dentro deles sem perceber.
  currais:Object.freeze({
    vaca:Object.freeze({
      tipo:'vaca',nome:'Vacas',icone:'🐄',cx:-85.5,cz:-55.2,w:7.0,d:6.8,
      spawn:Object.freeze([Object.freeze([-87,-56.2]),Object.freeze([-84.3,-54.2])]),
    }),
    porco:Object.freeze({
      tipo:'porco',nome:'Porcos',icone:'🐖',cx:-85.5,cz:-45.5,w:7.0,d:6.2,
      spawn:Object.freeze([Object.freeze([-87,-46.2]),Object.freeze([-84.2,-44.8])]),
    }),
    galinha:Object.freeze({
      tipo:'galinha',nome:'Galinhas',icone:'🐔',cx:-77.1,cz:-55.0,w:5.8,d:6.4,
      spawn:Object.freeze([Object.freeze([-78.4,-56]),Object.freeze([-76.5,-54.2]),Object.freeze([-75.5,-56.1])]),
    }),
  }),
  // Campo de plantio calculado na faixa noroeste que sobra DEPOIS de reservar casa, corredor e currais.
  // Distâncias mínimas: 2 m do curral dos porcos, 2 m da cerca externa e 4,35 m da casa.
  cultivo:Object.freeze({
    minX:-97,maxX:-91,
    minZ:-49,maxZ:-41,
    espacamentoLinha:1.5,segmento:1.2,
  }),
  // Fallback do WorldGenerator caso o módulo de currais não carregue. No jogo normal, AnimalPens
  // assume o movimento e prende cada espécie no seu próprio curral.
  animais:Object.freeze({
    minX:-89,maxX:-74.2,
    minZ:-58.6,maxZ:-42.4,
    margem:.65,
  }),
  servico:Object.freeze({
    // A faixa entre a parede leste da casa e o curral das vacas tem 2 m. O cocho anterior
    // media 2,1 m e invadia 55 cm o curral; agora cabe com folga e continua acessível.
    cocho:Object.freeze({x:casaX+4.0,z:casaZ,largura:1.0,profundidade:.7}),
    barril:Object.freeze({x:casaX+3.8,z:casaZ-1.2,raio:.25}),
    // Área já existente ao lado da casa reservada para circulação/serviço. Não cria piso nem construção:
    // apenas impede a roça de nascer atravessando cocho, barril e ponto de compra.
    limpeza:Object.freeze({x:casaX+4.0,z:casaZ-.6,meiaX:1.7,meiaZ:1.5}),
  }),
  // O ponto de compra fica ao lado externo do cocho, sem entrar no objeto, sem disputar a porta e
  // sem ocupar o corredor principal. Não existe construção nova aqui: é apenas a coordenada de ação.
  // O ponto de serviço fica no pátio lateral, fora do curral das vacas e afastado da porta frontal.
  polo:Object.freeze({x:casaX+4.5,z:casaZ-2.0}),
  // Platôs locais: a construção e a soleira da porteira assentam niveladas. A faixa entre inner/outer
  // faz a transição suave para o relevo original, sem degrau artificial.
  nivelamentoCasa:Object.freeze({innerX:4.8,innerZ:4.3,outerX:6.5,outerZ:6.0}),
  nivelamentoPorteira:Object.freeze({innerX:1.35,innerZ:2.15,outerX:2.8,outerZ:3.6}),
});
