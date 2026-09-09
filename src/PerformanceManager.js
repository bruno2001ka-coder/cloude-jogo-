import{renderer,composer,camera,noCelular,scene}from'./core.js';

// Gerenciador adaptativo de qualidade para celular.
// Nao mexe em fisica, IA, save ou regras de gameplay: so reduz custo de renderizacao quando o FPS cai.
if(noCelular){
  const PERFIS=[
    {nome:'baixo',pixelRatio:.75,sombras:false,far:145,fachadas:false},
    {nome:'medio',pixelRatio:.88,sombras:true,far:165,fachadas:true},
    {nome:'alto',pixelRatio:1,sombras:true,far:185,fachadas:true},
  ];
  const memoria=navigator.deviceMemory||0,cpus=navigator.hardwareConcurrency||0;
  let nivel=(memoria&&memoria<=2)||(cpus&&cpus<=4)?0:((memoria&&memoria<=4)||(cpus&&cpus<=6)?1:2);
  let ultimoNivel=-1,ultimoAjuste=0,amostrasBoas=0,frames=0,janelaInicio=performance.now();

  function aliviarSombrasEInstancias(){
    scene.traverse(o=>{
      if(!o||!o.isMesh)return;
      if(o.isInstancedMesh&&o.name?.startsWith('fachada-')){
        o.castShadow=false;o.receiveShadow=false;o.frustumCulled=true;
      }
      const geo=o.geometry;
      if(!geo)return;
      if(!geo.boundingSphere)try{geo.computeBoundingSphere()}catch(e){}
      const r=geo.boundingSphere?.radius??999;
      // Detalhe miudo e personagens segmentados nao precisam abrir outra passada no shadow map.
      if(r<.65)o.castShadow=false;
      // Terreno/chao grande nao precisa projetar sombra sobre ele mesmo; continua RECEBENDO sombra.
      if(geo.type==='PlaneGeometry'&&r>12)o.castShadow=false;
    });
  }

  function aplicarNivel(forcar=false){
    if(!forcar&&nivel===ultimoNivel)return;
    const p=PERFIS[nivel];
    renderer.setPixelRatio(p.pixelRatio);
    if(composer.setPixelRatio)composer.setPixelRatio(p.pixelRatio);
    renderer.setSize(innerWidth,innerHeight,false);
    composer.setSize(innerWidth,innerHeight);
    renderer.shadowMap.enabled=p.sombras;
    camera.far=p.far;camera.updateProjectionMatrix();
    const detalhes=scene.getObjectByName('favela-fachadas-detalhadas');
    if(detalhes)detalhes.visible=p.fachadas;
    ultimoNivel=nivel;ultimoAjuste=performance.now();
    console.info('[performance] qualidade=%s pixelRatio=%s sombras=%s far=%sm',p.nome,p.pixelRatio,p.sombras,p.far);
  }

  // Objetos carregam em ondas; reaplica a limpeza depois dos GLTFs e decoracoes entrarem.
  aliviarSombrasEInstancias();
  setTimeout(aliviarSombrasEInstancias,3500);
  setTimeout(aliviarSombrasEInstancias,9000);
  aplicarNivel(true);

  function medir(){
    requestAnimationFrame(medir);frames++;
    const agora=performance.now(),decorrido=agora-janelaInicio;
    if(decorrido<4000)return;
    if(document.hidden){frames=0;janelaInicio=agora;return}
    const fps=frames*1000/decorrido;frames=0;janelaInicio=agora;
    if(agora-ultimoAjuste<8000)return;

    if(fps<34&&nivel>0){nivel--;amostrasBoas=0;aplicarNivel();return}
    if(fps>52&&nivel<2){
      amostrasBoas++;
      if(amostrasBoas>=2){nivel++;amostrasBoas=0;aplicarNivel()}
    }else amostrasBoas=0;
  }
  requestAnimationFrame(medir);

  // Debug opcional no console: window.__quintalQualidade()
  window.__quintalQualidade=()=>({nivel,...PERFIS[nivel]});
}
