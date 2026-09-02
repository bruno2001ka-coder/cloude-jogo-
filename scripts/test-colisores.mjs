const FATIAS_CASA=4;
function fatiarRetangulo(cx,cz,w,d,giro){
  const c=Math.cos(giro),sn=Math.sin(giro);
  const cantos=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]]
    .map(([lx,lz])=>({x:cx+lx*c+lz*sn,z:cz-lx*sn+lz*c}));
  const xs=cantos.map(p=>p.x),x0=Math.min(...xs),x1=Math.max(...xs);
  const fatias=[];
  for(let i=0;i<FATIAS_CASA;i++){
    const a=x0+(x1-x0)*i/FATIAS_CASA,b=x0+(x1-x0)*(i+1)/FATIAS_CASA;
    let minZ=Infinity,maxZ=-Infinity;
    const anota=z=>{if(z<minZ)minZ=z;if(z>maxZ)maxZ=z};
    for(const p of cantos)if(p.x>=a-1e-9&&p.x<=b+1e-9)anota(p.z);
    for(let k=0;k<4;k++){
      const p=cantos[k],q=cantos[(k+1)%4];
      if(p.x===q.x)continue;
      for(const xf of[a,b]){
        const t=(xf-p.x)/(q.x-p.x);
        if(t>=0&&t<=1)anota(p.z+(q.z-p.z)*t);
      }
    }
    if(minZ<=maxZ)fatias.push({x0:a,x1:b,z0:minZ,z1:maxZ});
  }
  return fatias;
}
function check(w,d,giro){
  const f=fatiarRetangulo(0,0,w,d,giro);
  if(f.length!==4)throw new Error(`Esperadas 4 fatias, obtidas ${f.length}`);
  for(const b of f){
    if(!(b.x1>b.x0&&b.z1>b.z0))throw new Error('Fatia degenerada');
  }
  const minX=Math.min(...f.map(b=>b.x0)),maxX=Math.max(...f.map(b=>b.x1));
  const minZ=Math.min(...f.map(b=>b.z0)),maxZ=Math.max(...f.map(b=>b.z1));
  const W=Math.abs(Math.cos(giro))*w+Math.abs(Math.sin(giro))*d;
  const D=Math.abs(Math.sin(giro))*w+Math.abs(Math.cos(giro))*d;
  const eps=1e-9;
  if(Math.abs((maxX-minX)-W)>eps||Math.abs((maxZ-minZ)-D)>eps)throw new Error('AABB das fatias não cobre o retângulo');
  return {fatias:f.length,W,D};
}
console.log(JSON.stringify({alinhada:check(3.3,3.9,0),girada22_5:check(4.5,3.9,Math.PI/8)},null,2));
