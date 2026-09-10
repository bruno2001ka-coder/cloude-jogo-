from pathlib import Path

p=Path('src/NobleDistrict.js')
s=p.read_text()

# 1) Asphalt/ribbon winding: faces must point upward.
old="const a=i*row+j,b=a+1,c=a+row+1,d=a+row;idx.push(a,d,b,b,d,c);"
new="const a=i*row+j,b=a+1,c=a+row+1,d=a+row;idx.push(a,b,d,b,c,d);"
assert old in s, 'road winding marker missing'
s=s.replace(old,new,1)

# 2) Side streets were crossing the lot field.
old="infraestruturaVia(avenidaNobre,6.4,true);\ninfraestruturaVia(topoCJ,5.4,false);\ninfraestruturaVia(alamedaOeste,5.1,false);\ninfraestruturaVia(alamedaLeste,5.1,false);"
new="infraestruturaVia(avenidaNobre,6.4,true);\ninfraestruturaVia(topoCJ,5.4,false);"
assert old in s, 'road infrastructure marker missing'
s=s.replace(old,new,1)

marker="function endereco(curva,u,lado,dist=9.5){\n  const p=curva.getPointAt(u),t=curva.getTangentAt(u).normalize(),nx=-t.z*lado,nz=t.x*lado,cx=p.x+nx*dist,cz=p.z+nz*dist;\n  return{cx,cz,giro:Math.atan2(-nx,-nz),p,t,nx,nz};\n}\n"
planner='''function endereco(curva,u,lado,dist=9.5){
  const p=curva.getPointAt(u),t=curva.getTangentAt(u).normalize(),nx=-t.z*lado,nz=t.x*lado,cx=p.x+nx*dist,cz=p.z+nz*dist;
  return{cx,cz,giro:Math.atan2(-nx,-nz),p,t,nx,nz};
}

// ===== PLANEJAMENTO GEOMETRICO: RUA PRIMEIRO, LOTE DEPOIS =====
const VIAS_PLANEJADAS=[
  {nome:'avenida',curva:avenidaNobre,reserva:5.0},
  {nome:'acesso-cj',curva:topoCJ,reserva:4.4},
];
const lotesPlanejados=[{cx:31.3,cz:71.7,giro:0,w:12,d:10,nome:'CJ'}];
function distanciaPontoRetangulo(px,pz,r){
  const dx=px-r.cx,dz=pz-r.cz,c=Math.cos(r.giro),sn=Math.sin(r.giro);
  const lx=dx*c-dz*sn,lz=dx*sn+dz*c,qx=Math.abs(lx)-r.w/2,qz=Math.abs(lz)-r.d/2;
  if(qx<=0&&qz<=0)return Math.max(qx,qz);
  return Math.hypot(Math.max(0,qx),Math.max(0,qz));
}
function projecaoLote(r,ex,ez){
  const c=Math.cos(r.giro),sn=Math.sin(r.giro);
  return Math.abs(c*ex-sn*ez)*r.w/2+Math.abs(sn*ex+c*ez)*r.d/2;
}
function lotesSeTocam(a,b,folga=.8){
  const dx=b.cx-a.cx,dz=b.cz-a.cz;
  for(const r of[a,b]){
    const c=Math.cos(r.giro),sn=Math.sin(r.giro),eixos=[[c,-sn],[sn,c]];
    for(const[ex,ez]of eixos)
      if(Math.abs(dx*ex+dz*ez)>projecaoLote(a,ex,ez)+projecaoLote(b,ex,ez)+folga)return false;
  }
  return true;
}
function corredorLivre(lote){
  for(const via of VIAS_PLANEJADAS){
    const n=Math.max(20,Math.ceil(via.curva.getLength()/.35));
    for(let i=0;i<=n;i++){
      const p=via.curva.getPointAt(i/n);
      if(distanciaPontoRetangulo(p.x,p.z,lote)<via.reserva)return false;
    }
  }
  return true;
}
function reservarLote(lote){
  if(!corredorLivre(lote)){console.warn('[bairro-nobre] lote rejeitado por invadir via:',lote.nome);return false}
  for(const outro of lotesPlanejados)if(lotesSeTocam(lote,outro,.8)){
    console.warn('[bairro-nobre] lote rejeitado por sobreposicao:',lote.nome,'x',outro.nome);return false;
  }
  lotesPlanejados.push(lote);return true;
}
'''
assert marker in s, 'endereco marker missing'
s=s.replace(marker,planner,1)

old='''function criarCasaLuxo(curva,u,lado,idx){
  const e=endereco(curva,u,lado,9.25+(idx%2)*.5),w=6.35+(idx%3)*.45,d=5.15+(idx%2)*.55,dois=idx%4!==1;
  const loteW=w+2.05,loteD=d+2.65,{cota,min}=cotaPlana(e.cx,e.cz,e.giro,loteW,loteD),g=new THREE.Group();
'''
new='''function criarCasaLuxo(curva,u,lado,idx,dist){
  const e=endereco(curva,u,lado,dist),w=5.7+(idx%3)*.3,d=4.7+(idx%2)*.35,dois=idx%4!==1;
  const loteW=w+1.5,loteD=d+1.9;
  if(!reservarLote({cx:e.cx,cz:e.cz,giro:e.giro,w:loteW,d:loteD,nome:`casa-${idx}`}))return false;
  const{cota,min}=cotaPlana(e.cx,e.cz,e.giro,loteW,loteD),g=new THREE.Group();
'''
assert old in s, 'house function marker missing'
s=s.replace(old,new,1)

old="  caixaRotacionada(e.cx,e.cz,e.giro,w,d,cota-.35,cota+altura+.48,'casa-bairro-nobre');\n}\n\nconst us=[.12,.22,.32,.43,.55,.67,.78];let casaId=0;\nfor(const u of us)for(const lado of[-1,1]){\n  // Reserva a lateral oeste do miolo para a praca.\n  if(u===.55&&lado===-1)continue;criarCasaLuxo(avenidaNobre,u,lado,casaId++);\n}\nfor(const[curva,base]of[[alamedaOeste,40],[alamedaLeste,50]])for(const lado of[-1,1])criarCasaLuxo(curva,.63,lado,base+lado+2);"
new='''  caixaRotacionada(e.cx,e.cz,e.giro,w,d,cota-.35,cota+altura+.48,'casa-bairro-nobre');
  return true;
}

const SITES_CASA=[
  [.55,-1,9.3],[.40,1,9.3],[.14,1,9.3],[.65,-1,9.3],
  [.33,1,12.9],[.40,1,17.1],[.26,-1,14.7],[.59,-1,17.7],
  [.47,1,18.3],[.66,-1,17.7],[.68,-1,17.7],[.33,1,20.7],
  [.23,-1,22.5],[.40,1,24.9]
];
let casaId=0;
for(let idx=0;idx<SITES_CASA.length;idx++){
  const[u,lado,dist]=SITES_CASA[idx];
  if(criarCasaLuxo(avenidaNobre,u,lado,idx,dist))casaId++;
}'''
assert old in s, 'house loop marker missing'
s=s.replace(old,new,1)

old='''function criarPredio(u,lado,id){
  const e=endereco(avenidaNobre,u,lado,10.2),w=7.4,d=6.0,{cota,min}=cotaPlana(e.cx,e.cz,e.giro,8.5,7.0),g=new THREE.Group();
'''
new='''function criarPredio(u,lado,id,dist){
  const e=endereco(avenidaNobre,u,lado,dist),w=7.4,d=6.0;
  if(!reservarLote({cx:e.cx,cz:e.cz,giro:e.giro,w:8.5,d:7.0,nome:`predio-${id}`}))return false;
  const{cota,min}=cotaPlana(e.cx,e.cz,e.giro,8.5,7.0),g=new THREE.Group();
'''
assert old in s, 'building function marker missing'
s=s.replace(old,new,1)
old="criarPredio(.88,-1,0);criarPredio(.88,1,1);"
new="criarPredio(.96,-1,0,18.0);criarPredio(.96,1,1,10.5);"
assert old in s, 'building calls marker missing'
s=s.replace(old,new,1)

old='''function criarPraca(){
  const e=endereco(avenidaNobre,.55,-1,11.2),W=8.6,D=6.6,{cota,min}=cotaPlana(e.cx,e.cz,e.giro,W,D),g=new THREE.Group();g.position.set(e.cx,cota,e.cz);g.rotation.y=e.giro;bairro.add(g);
'''
new='''function criarPraca(){
  const e=endereco(avenidaNobre,.48275862068965514,1,10.5),W=8.6,D=6.6;
  if(!reservarLote({cx:e.cx,cz:e.cz,giro:e.giro,w:W,d:D,nome:'praca'}))return;
  const{cota,min}=cotaPlana(e.cx,e.cz,e.giro,W,D),g=new THREE.Group();g.position.set(e.cx,cota,e.cz);g.rotation.y=e.giro;bairro.add(g);
'''
assert old in s, 'plaza marker missing'
s=s.replace(old,new,1)

old="console.info('[bairro-nobre] %s | casas=%d predios=2 postes=%d arvores=%d | ligacao favela=(31,1.2)',BAIRRO_NOBRE.nome,casaId+4,postes.length,arvN);"
new="console.info('[bairro-nobre] %s | casas=%d predios=2 lotes-validados=%d postes=%d arvores=%d | corredor viario protegido',BAIRRO_NOBRE.nome,casaId,lotesPlanejados.length,postes.length,arvN);"
assert old in s, 'audit log marker missing'
s=s.replace(old,new,1)

p.write_text(s)
