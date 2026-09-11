// Dados puros do protótipo. Sem Three.js/DOM para os testes de regressão poderem validar o layout.
export const FARM_PROTOTYPE={
  id:'fazenda-prototipo-sudoeste-v1',
  origin:{x:-175,z:-160},
  spawn:{x:-137,z:-154},
  bounds:{minX:-217,maxX:-136,minZ:-194,maxZ:-124},
  gate:{x:-146,z:-154,width:4.4},
  house:{x:-188,z:-146,w:16,d:11},
  barn:{x:-164,z:-181,w:14,d:10},
  crop:[
    {x:-209,z:-185},{x:-192,z:-191},{x:-179,z:-184},
    {x:-181,z:-171},{x:-197,z:-165},{x:-211,z:-173},
  ],
  // Divisas predominantemente retas com chanfros curtos: propriedade irregular sem transformar
  // cada lado inteiro em centenas de AABBs diagonais.
  property:[
    {x:-210,z:-188},{x:-180,z:-188},{x:-174,z:-193},{x:-146,z:-193},
    {x:-146,z:-156.2},{x:-146,z:-151.8},{x:-146,z:-130},{x:-180,z:-130},
    {x:-185,z:-125},{x:-212,z:-125},{x:-212,z:-143},{x:-216,z:-148},{x:-216,z:-178},
  ],
  pasture:[
    {x:-180,z:-156},{x:-178,z:-158},{x:-165,z:-158},{x:-162,z:-158},
    {x:-146,z:-158},{x:-146,z:-133},{x:-151,z:-128},{x:-173,z:-128},{x:-180,z:-134},
  ],
  animalSpawns:[
    {id:'vaca-1',type:'cow',x:-157,z:-143},
    {id:'vaca-2',type:'cow',x:-164,z:-139},
    {id:'galinha-1',type:'chicken',x:-153,z:-150},
  ],
};

export function pointInPolygon(x,z,polygon){
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if(((a.z>z)!==(b.z>z))&&(x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x))inside=!inside;
  }
  return inside;
}

export function validateFarmPrototypeConfig(config=FARM_PROTOTYPE){
  const errors=[];
  if(!config.id)errors.push('ID ausente');
  if(config.house.w<1||config.house.d<1)errors.push('Sede sem footprint valido');
  const houseBarnDistance=Math.hypot(config.house.x-config.barn.x,config.house.z-config.barn.z);
  if(houseBarnDistance<15)errors.push('Sede e galpao separados por menos de 15 m');
  const ids=new Set();
  for(const animal of config.animalSpawns){
    if(ids.has(animal.id))errors.push(`Animal duplicado: ${animal.id}`);ids.add(animal.id);
    if(!pointInPolygon(animal.x,animal.z,config.pasture))errors.push(`Animal fora do pasto: ${animal.id}`);
  }
  return{ok:errors.length===0,errors,houseBarnDistance};
}
