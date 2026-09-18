"use strict";
/* ============ 无限区块地形：流式加载 / 植被岩石 / 人造道具 ============ */
const CHUNK=52,SEG=34,VIEW=3;
const chunks=new Map();
/* 地面材质：多尺度细节贴图（斑驳+团块+颗粒，无缝平铺）+ 法线贴图（微起伏明暗） */
const detailTex=makeDetailTex(256);
detailTex.repeat.set(7,7);
const groundNormal=makeNormalTex(192,2.2,91);
groundNormal.repeat.set(26,26);                     // 与颜色图错开重复度，避免图案感
const terraMat=new THREE.MeshStandardMaterial({
  vertexColors:true,map:detailTex,
  normalMap:groundNormal,normalScale:new THREE.Vector2(0.55,0.55),
  roughness:0.96,metalness:0,envMapIntensity:0.35});
/* 岩石几何：细分二十面体 + 顶点位移（棱角分明的天然石） */
const rockGeo=(()=>{
  const geo=new THREE.IcosahedronGeometry(1,1);
  const pos=geo.attributes.position;
  const rr=mulberry(99);
  for(let i=0;i<pos.count;i++){
    const s=0.72+rr()*0.55;
    pos.setXYZ(i,pos.getX(i)*s,pos.getY(i)*(0.55+rr()*0.35),pos.getZ(i)*s);
  }
  geo.computeVertexNormals();
  return geo;
})();
/* PBR 标准材质工厂：粗糙度 r / 金属度 m / 环境强度 e */
const stdMat=(c,r=0.9,m=0,e=0.45)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m,envMapIntensity:e});
function chunkKey(cx,cz){return cx+'_'+cz;}

/* 草丛几何：三组交叉弯曲叶片，避免重复矩形卡片感 */
function grassGeo(){
  const g=new THREE.BufferGeometry();
  const pos=[],uv=[],idx=[];
  const blades=[
    {a:0,b:0.06,lean:0.09,w:0.18,h:0.52},
    {a:Math.PI*0.5,b:-0.04,lean:-0.07,w:0.16,h:0.44},
    {a:Math.PI*0.25,b:0.02,lean:0.12,w:0.12,h:0.38},
  ];
  for(const blade of blades){
    const c=Math.cos(blade.a),s=Math.sin(blade.a),base=pos.length/3;
    const point=(x,y,z)=>{const rx=x*c-z*s,rz=x*s+z*c;pos.push(rx,y,rz);};
    point(-blade.w,0,0);point(blade.w,0,0);
    point(blade.w*0.72,blade.h*0.58,blade.b+blade.lean*0.5);
    point(blade.lean,blade.h,blade.b+blade.lean);
    point(-blade.w*0.72,blade.h*0.58,blade.b+blade.lean*0.5);
    uv.push(0,0,1,0,0.86,0.58,0.5,1,0.14,0.58);
    idx.push(base,base+1,base+2,base,base+2,base+3,base,base+3,base+4);
  }
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx);g.computeVertexNormals();
  return g;
}
function grassTexture(){
  const c=document.createElement('canvas');c.width=c.height=64;
  const x=c.getContext('2d');
  const gr=x.createLinearGradient(0,64,0,0);
  gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(0.62,'rgba(215,255,200,0.9)');gr.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=gr;x.beginPath();x.moveTo(5,64);x.quadraticCurveTo(30,30,28,4);x.quadraticCurveTo(34,30,59,64);x.closePath();x.fill();
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;return t;
}
const GRASS_GEO=grassGeo();
const GRASS_TEX=grassTexture();
const SHARED_GEOMETRIES=new Set([GRASS_GEO,rockGeo]);
const SHARED_MATERIALS=new Set();
const windMaterials=[];
function createGrassMaterial(color){
  const m=new THREE.MeshStandardMaterial({map:GRASS_TEX,color,alphaTest:0.42,side:THREE.DoubleSide,roughness:0.88,metalness:0,envMapIntensity:0.35,depthWrite:true});
  m.userData.windUniform={value:0};
  m.onBeforeCompile=shader=>{
    shader.uniforms.uWindTime=m.userData.windUniform;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uWindTime;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float bladeMask=smoothstep(0.04,0.48,position.y);
      float phase=uWindTime*1.35+instanceMatrix[3].x*0.13+instanceMatrix[3].z*0.11;
      transformed.x+=sin(phase+position.y*3.2)*0.045*bladeMask;
      transformed.z+=cos(phase*0.83+position.y*2.4)*0.03*bladeMask;`);
  };
  windMaterials.push(m);SHARED_MATERIALS.add(m);return m;
}
function updateVegetationWind(time){
  for(let i=windMaterials.length-1;i>=0;i--){
    const m=windMaterials[i];
    if(!m||!m.userData.windUniform){windMaterials.splice(i,1);continue;}
    m.userData.windUniform.value=time;
  }
}

/* 树木：树位只随机一次，主干/树冠共用同一列表（永不分离）；高度互相咬合、随树缩放 */
/* 阔叶树冠几何：5 个错位球瓣合并 + 顶点径向扰动 + 底部渐暗顶点色（体积感/破对称"蛋"） */
function makeLeafCanopyGeo(){
  const rng=mulberry(4242);
  const parts=[[0,0.16,0,1.0],[0.56,-0.03,0.2,0.72],[-0.52,-0.07,0.24,0.66],[0.14,0.04,-0.56,0.68],[-0.06,0.58,0.05,0.56]];
  const chunks=[];let total=0;
  for(const p of parts){
    const g=new THREE.SphereGeometry(p[3],9,7).toNonIndexed();
    const pa=g.attributes.position;
    for(let i=0;i<pa.count;i++){                 // 每瓣顶点径向随机扰动 → 凹凸轮廓
      const d=1+(rng()-0.5)*0.24;
      pa.setXYZ(i,pa.getX(i)*d,pa.getY(i)*d,pa.getZ(i)*d);
    }
    g.translate(p[0],p[1],p[2]);
    chunks.push(pa.array);total+=pa.count;
  }
  const pos=new Float32Array(total*3),col=new Float32Array(total*3);
  let o=0;
  for(const a of chunks)for(let i=0;i<a.length;i++)pos[o++]=a[i];
  for(let i=0;i<total;i++){
    const sh=0.58+0.42*smooth(-0.85,0.9,pos[i*3+1]);   // 冠底阴影 → 冠顶受光
    col[i*3]=sh;col[i*3+1]=sh;col[i*3+2]=sh;
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  geo.computeVertexNormals();
  return geo;
}
/* 云杉树冠几何：三层错位锥体共享于所有区块 */
function makeSpruceGeo(){
  const tiers=[[1.32,1.7,0.9],[0.98,1.55,1.85],[0.62,1.45,2.75]];
  const chunks=[];let total=0;
  for(const t of tiers){
    const g=new THREE.ConeGeometry(t[0],t[1],8).toNonIndexed();
    g.translate(0,t[2],0);chunks.push(g.attributes.position.array);total+=g.attributes.position.count;
  }
  const pos=new Float32Array(total*3);let o=0;
  for(const a of chunks)for(let i=0;i<a.length;i++)pos[o++]=a[i];
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.computeVertexNormals();return geo;
}
/* 给无顶点色的几何补白色 color 属性：r128 实例颜色依赖 USE_COLOR 管线，缺失会渲染成黑 */
function withWhiteVertexColors(geo){
  const n=geo.attributes.position.count;
  const col=new Float32Array(n*3).fill(1);
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  return geo;
}
const TREE_TRUNK_GEO=withWhiteVertexColors(new THREE.CylinderGeometry(0.13,0.21,2.4,7));
const LEAF_CANOPY_GEO=makeLeafCanopyGeo();
const SPRUCE_CANOPY_GEO=withWhiteVertexColors(makeSpruceGeo());
const DEAD_CANOPY_GEO=withWhiteVertexColors(new THREE.ConeGeometry(0.6,1.8,7));
for(const geo of[TREE_TRUNK_GEO,LEAF_CANOPY_GEO,SPRUCE_CANOPY_GEO,DEAD_CANOPY_GEO])SHARED_GEOMETRIES.add(geo);
const TREE_TRUNK_MAT=new THREE.MeshStandardMaterial({color:0x54402c,roughness:0.94,metalness:0,envMapIntensity:0.32,vertexColors:true});
const TREE_LEAF_MAT=new THREE.MeshStandardMaterial({color:0x3f6a34,roughness:0.93,metalness:0,envMapIntensity:0.35,vertexColors:true});
const TREE_SPRUCE_MAT=new THREE.MeshStandardMaterial({color:0x2e4a34,roughness:0.92,metalness:0,envMapIntensity:0.35,vertexColors:true});
const TREE_DEAD_MAT=new THREE.MeshStandardMaterial({color:0x4a4034,roughness:0.95,metalness:0,envMapIntensity:0.3,vertexColors:true});
for(const mat of[TREE_TRUNK_MAT,TREE_LEAF_MAT,TREE_SPRUCE_MAT,TREE_DEAD_MAT])SHARED_MATERIALS.add(mat);
const GRASS_MAT_GREEN=createGrassMaterial(0x527a38);
const GRASS_MAT_DRY=createGrassMaterial(0x5a4a30);
/* 焦土废墟：主墙+垂直断墙+残墩合并成一组（单片 4×2.6 薄板远看像"悬空长方形板"） */
const RUIN_GEO=(()=>{
  const parts=[
    [4.0,2.3,0.5, 0,1.15,0],        // 主墙
    [0.5,1.4,1.7, -1.75,0.7,0.85],  // 垂直断墙（矮一截=被炸断）
    [0.9,0.7,0.5, 1.6,0.35,-0.35],  // 残墩
  ];
  const ps=[],ns=[];let total=0;
  for(const p of parts){
    const b=new THREE.BoxGeometry(p[0],p[1],p[2]).toNonIndexed();
    b.translate(p[3],p[4],p[5]);
    ps.push(b.attributes.position.array);ns.push(b.attributes.normal.array);
    total+=b.attributes.position.count;
  }
  const pos=new Float32Array(total*3),nor=new Float32Array(total*3);let o=0;
  for(const a of ps)for(let i=0;i<a.length;i++)pos[o++]=a[i];
  o=0;for(const a of ns)for(let i=0;i<a.length;i++)nor[o++]=a[i];
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  geo.setAttribute('normal',new THREE.BufferAttribute(nor,3));
  return geo;
})();
const RUIN_MAT=new THREE.MeshStandardMaterial({color:0x6e6a60,roughness:0.78,metalness:0.1,envMapIntensity:0.5});
SHARED_GEOMETRIES.add(RUIN_GEO);SHARED_MATERIALS.add(RUIN_MAT);

/* 树木：局部采样地貌、坡度与间距；实例几何/材质跨区块共享，避免森林边缘突变和 GPU 重复占用 */
function treeSpeciesAt(x,z,rng){
  const w=biomeW(x,z);
  if(w.snow>0.38&&w.snow>=w.forest&&w.snow>=w.plains)return'spruce';
  if(w.scorched>0.34||w.desert>0.52)return'dead';
  return'broadleaf';
}
function plantTrees(group,obstacles,ox,oz,w,treeN,rng){
  const spots=[];
  for(let i=0;i<treeN*5&&spots.length<treeN;i++){
    const wx=ox+rng()*CHUNK,wz=oz+rng()*CHUNK;
    const h=terrainH(wx,wz);
    if(h<WATER_Y+0.6)continue;
    const e=0.8;
    const slope=Math.hypot(terrainH(wx+e,wz)-terrainH(wx-e,wz),terrainH(wx,wz+e)-terrainH(wx,wz-e))/(2*e);
    if(slope>1.45)continue;
    const sc=0.75+rng()*0.55;
    if(spots.some(s=>dist2D(s.x,s.z,wx,wz)<1.6*sc+1.1))continue;
    spots.push({x:wx,h,z:wz,sc,rot:rng()*TAU,sx:0.85+rng()*0.3,sz:0.85+rng()*0.3,
      lean:(rng()-0.5)*0.08,kind:treeSpeciesAt(wx,wz,rng),hue:rng()});
  }
  if(!spots.length)return;
  const d=new THREE.Object3D(),trunkCol=new THREE.Color(),leafCol=new THREE.Color();
  const trunk=new THREE.InstancedMesh(TREE_TRUNK_GEO,TREE_TRUNK_MAT,spots.length);
  const groups={broadleaf:[],spruce:[],dead:[]};
  spots.forEach(s=>groups[s.kind].push(s));
  const canopies={};
  for(const kind of['broadleaf','spruce','dead']){
    const list=groups[kind];if(!list.length)continue;
    const geo=kind==='broadleaf'?LEAF_CANOPY_GEO:kind==='spruce'?SPRUCE_CANOPY_GEO:DEAD_CANOPY_GEO;
    const mat=kind==='broadleaf'?TREE_LEAF_MAT:kind==='spruce'?TREE_SPRUCE_MAT:TREE_DEAD_MAT;
    canopies[kind]=new THREE.InstancedMesh(geo,mat,list.length);
  }
  spots.forEach((s,i)=>{
    d.rotation.set(s.lean,s.rot,rng()*0.04);
    d.position.set(s.x,s.h+1.15*s.sc,s.z);d.scale.set(s.sc,s.sc,s.sc);d.updateMatrix();trunk.setMatrixAt(i,d.matrix);
    const trunkLight=s.kind==='dead'?0.27:0.32+s.hue*0.12;
    trunkCol.setHSL(s.kind==='dead'?0.08:0.075,0.28,trunkLight);trunk.setColorAt(i,trunkCol);
    d.rotation.set(0,s.rot,s.lean*0.5);
    if(s.kind==='spruce'){
      d.position.set(s.x,s.h+1.3*s.sc,s.z);d.scale.set(s.sc*s.sx,s.sc,s.sc*s.sz);
    }else if(s.kind==='dead'){
      d.position.set(s.x,s.h+2.7*s.sc,s.z);d.scale.set(s.sc*0.9,s.sc*0.9,s.sc*0.9);
    }else{
      d.position.set(s.x,s.h+2.55*s.sc,s.z);d.scale.set(s.sc*s.sx,s.sc*1.12,s.sc*s.sz);
    }
    d.updateMatrix();
    const list=groups[s.kind],idx=list.indexOf(s);canopies[s.kind].setMatrixAt(idx,d.matrix);
    if(s.kind==='spruce')leafCol.setHSL(0.31+s.hue*0.035,0.34,0.22+s.hue*0.08);
    else if(s.kind==='dead')leafCol.setHSL(0.08+s.hue*0.04,0.25,0.22+s.hue*0.08);
    else leafCol.setHSL(0.25+s.hue*0.07,0.42,0.25+s.hue*0.1);
    canopies[s.kind].setColorAt(idx,leafCol);
    obstacles.push({x:s.x,z:s.z,r:0.45*s.sc});
  });
  trunk.instanceMatrix.needsUpdate=true;if(trunk.instanceColor)trunk.instanceColor.needsUpdate=true;
  trunk.frustumCulled=false;trunk.castShadow=true;group.add(trunk);
  for(const kind of['broadleaf','spruce','dead']){
    const im=canopies[kind];if(!im)continue;
    im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;
    im.frustumCulled=false;im.castShadow=true;group.add(im);
  }
}

function buildChunk(cx,cz){
  const g=new THREE.PlaneGeometry(CHUNK,CHUNK,SEG,SEG);
  g.rotateX(-Math.PI/2);
  const pos=g.attributes.position;
  const ox=cx*CHUNK,oz=cz*CHUNK;
  const cols=new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i++){
    const wx=pos.getX(i)+ox+CHUNK/2,wz=pos.getZ(i)+oz+CHUNK/2;
    const h=terrainH(wx,wz);
    pos.setY(i,h);
    const c=groundColor(wx,wz,h);
    // 顶点明暗抖动：大尺度斑驳 + 细碎颗粒，打破均匀色块
    const jit=1+fbm(nD,wx*0.9,wz*0.9,2)*0.12+fbm(nH2,wx*0.18,wz*0.18,2)*0.08;
    cols[i*3]=clamp(c[0]*jit,0,1);cols[i*3+1]=clamp(c[1]*jit,0,1);cols[i*3+2]=clamp(c[2]*jit,0,1);
  }
  g.setAttribute('color',new THREE.BufferAttribute(cols,3));
  g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,terraMat);
  mesh.position.set(ox+CHUNK/2,0,oz+CHUNK/2);
  mesh.receiveShadow=true;
  scene.add(mesh);
  const group=new THREE.Group();
  const rng=mulberry(cx*731+cz*911+WORLD_SEED);
  const obstacles=[];
  const put=(geo,mat,n,fn,shadow=true)=>{
    if(n<=0)return null;
    const im=new THREE.InstancedMesh(geo,mat,n);
    const dummy=new THREE.Object3D();
    let c2=0;
    for(let i=0;i<n*3&&c2<n;i++){
      const lx=rng()*CHUNK,lz=rng()*CHUNK;
      const wx=ox+lx,wz=oz+lz;
      const h=terrainH(wx,wz);
      if(h<WATER_Y+0.6)continue;
      const s=rng();
      if(!fn(dummy,wx,h,wz,s,rng,obstacles))continue;
      dummy.updateMatrix();
      im.setMatrixAt(c2++,dummy.matrix);
    }
    im.count=c2;
    im.instanceMatrix.needsUpdate=true;
    im.castShadow=shadow;im.frustumCulled=false;   // r128 无法按实例包围球剔除；由 updateChunkVisibility 按区块整组显隐
    group.add(im);
    return im;
  };
  const w=biomeW(ox+CHUNK/2,oz+CHUNK/2);
  /* 人造/大件道具坡度检测：中心点采样会让宽道具在坡地半埋/悬空（视觉穿模） */
  const slopeAt=(x,z)=>Math.hypot(terrainH(x+1.2,z)-terrainH(x-1.2,z),terrainH(x,z+1.2)-terrainH(x,z-1.2))/2.4;
  /* 棱线检测：位置比四周 12m 环带平均高出 1.2m 以上=山脊/坡顶，背景是天空——
     立式板状物（废墟/围栏/电线杆/帐篷）在这里远看就是"天空中的长方形"，一律不生成 */
  const onRidge=(x,z)=>{
    const h=terrainH(x,z);let sum=0;
    for(let a=0;a<TAU;a+=Math.PI/4)sum+=terrainH(x+Math.cos(a)*12,z+Math.sin(a)*12);
    return h-sum/8>1.2;
  };
  const treeN=Math.round(2700*(BIOMES.forest.tree*w.forest+BIOMES.plains.tree*w.plains+BIOMES.snow.tree*w.snow*0.9+BIOMES.desert.tree*w.desert+BIOMES.scorched.tree*w.scorched));
  const rockN=Math.round(2700*(BIOMES.plains.rock*w.plains+BIOMES.desert.rock*w.desert+BIOMES.snow.rock*w.snow+BIOMES.scorched.rock*w.scorched+BIOMES.forest.rock*w.forest));
  const cactus=w.desert>0.45;
  if(treeN>0)plantTrees(group,obstacles,ox,oz,w,treeN,rng);
  if(rockN>0)put(
    rockGeo,
    new THREE.MeshStandardMaterial({color:0x8a857c,roughness:0.82,metalness:0.05,envMapIntensity:0.5,flatShading:true}),
    rockN,
    (d,x,h,z,s,r,ob)=>{
      d.position.set(x,h+0.25,z);
      d.rotation.set(r()*3,r()*3,r()*3);
      const sc=0.5+s*1.8;d.scale.set(sc,sc*(0.6+s*0.4),sc);
      if(sc>1.1)ob.push({x,z,r:sc*0.8});
      return true;
    });
  // 草丛
  const grassDens=BIOMES.plains.grass*w.plains+BIOMES.forest.grass*w.forest+BIOMES.scorched.grass*w.scorched;
  if(grassDens>0.15)put(
    GRASS_GEO,
    w.scorched>0.4?GRASS_MAT_DRY:GRASS_MAT_GREEN,
    Math.min(620,Math.round(620*grassDens)),
    (d,x,h,z,s,r)=>{
      const local=biomeW(x,z);
      if(local.desert>0.58||local.snow>0.65||terrainH(x,z)<WATER_Y+0.5)return false;
      d.position.set(x,h+0.02,z);d.rotation.set(0,r()*TAU,0);
      const sc=0.7+s*1.1;d.scale.set(sc,sc,sc);return true;
    },false);
  if(cactus)put(
    new THREE.CylinderGeometry(0.22,0.28,2.2,6),
    stdMat(0x4a7a3a,0.85),
    Math.round(14*w.desert),
    (d,x,h,z,s)=>{
      d.position.set(x,h+1,z);d.rotation.set(0,0,0);
      const sc=0.7+s*0.8;d.scale.set(sc,sc,sc);return true;
    });
  // 焦土废墟（断墙组）：低地缓坡且非棱线——山脊上的立墙远看像悬空板
  if(w.scorched>0.4)put(
    RUIN_GEO,
    RUIN_MAT,
    2+Math.round(3*w.scorched),
    (d,x,h,z,s,r,ob)=>{
      if(h<WATER_Y+1.5||h>16||slopeAt(x,z)>0.35||onRidge(x,z))return false;
      d.position.set(x,h+1.2,z);d.rotation.set(0,r()*TAU,0);
      const sc=0.7+s*0.8;d.scale.set(sc,sc,sc);
      ob.push({x,z,r:2.4*sc});return true;
    });
  // ---- 地面覆盖 ----
  // 草原小花（黄花点缀）
  if(w.plains>0.4)put(
    new THREE.IcosahedronGeometry(0.05,0),
    stdMat(0xd8b84c,0.85,0,0.35),
    Math.round(36*w.plains),
    (d,x,h,z,s,r)=>{
      if(terrainH(x,z)<WATER_Y+0.5)return false;
      d.position.set(x,h+0.16+s*0.08,z);d.rotation.set(0,r()*TAU,0);
      const sc=0.7+s*0.8;d.scale.set(sc,sc,sc);return true;
    },false);
  // 森林倒木
  if(w.forest>0.45)put(
    new THREE.CylinderGeometry(0.16,0.21,2.6,7),
    stdMat(0x54402a,0.95,0,0.3),
    1+Math.round(2*w.forest),
    (d,x,h,z,s,r,ob)=>{
      if(h<WATER_Y+1||slopeAt(x,z)>0.65)return false;
      d.position.set(x,h+0.18,z);d.rotation.set(Math.PI/2,r()*TAU,0);
      const sc=0.7+s*0.8;d.scale.set(sc,sc,sc);
      ob.push({x,z,r:1.2*sc});return true;
    });
  // 沙漠旱灌木
  if(w.desert>0.45)put(
    new THREE.IcosahedronGeometry(0.3,0),
    stdMat(0x6a5a38,0.95,0,0.3),
    Math.round(10*w.desert),
    (d,x,h,z,s,r)=>{
      d.position.set(x,h+0.1,z);d.rotation.set(r()*3,r()*3,r()*3);
      d.scale.set(1+s,0.5+s*0.3,1+s);return true;
    },false);
  // 碎石（全地貌散布）
  put(
    rockGeo,
    stdMat(0x7c7668,0.85,0.05,0.5),
    7+Math.round(10*rng()),
    (d,x,h,z,s,r)=>{
      d.position.set(x,h+0.05,z);d.rotation.set(r()*3,r()*3,r()*3);
      const sc=0.12+s*0.2;d.scale.set(sc,sc*0.7,sc);return true;
    },false);
  // ---- 人造物 ----
  // 木箱
  put(new THREE.BoxGeometry(1.1,1.1,1.1),
    stdMat(0x7a5c34,0.85,0,0.4),
    2+Math.round(rng()*3),
    (d,x,h,z,s,r,ob)=>{
      if(slopeAt(x,z)>0.5)return false;
      d.position.set(x,h+0.55,z);d.rotation.set(0,r()*TAU,r()*0.05);
      const sc=0.8+s*0.6;d.scale.set(sc,sc,sc);
      ob.push({x,z,r:0.95*sc});return true;
    });
  // 油桶
  put(new THREE.CylinderGeometry(0.42,0.42,1.1,10),
    stdMat(0x5a6350,0.45,0.6,0.8),
    1+Math.round(rng()*2),
    (d,x,h,z,s,r,ob)=>{
      if(slopeAt(x,z)>0.5)return false;
      d.position.set(x,h+0.55,z);d.rotation.set(0,0,r()*0.15-0.07);
      const sc=0.85+s*0.4;d.scale.set(sc,sc,sc);
      ob.push({x,z,r:0.6*sc});return true;
    });
  // 帐篷
  put(new THREE.CylinderGeometry(0.02,1.5,1.7,4),
    stdMat(0x64604a,0.95,0,0.35),
    rng()<0.6?1:0,
    (d,x,h,z,s,r,ob)=>{
      if(slopeAt(x,z)>0.42||onRidge(x,z))return false;
      d.position.set(x,h+0.78,z);d.rotation.set(0,r()*TAU,0);
      ob.push({x,z,r:1.5});return true;
    });
  // 围栏（矮墙障碍）
  put(new THREE.BoxGeometry(3.4,0.9,0.14),
    stdMat(0x64583c,0.88,0,0.4),
    rng()<0.7?1+Math.round(rng()*2):0,
    (d,x,h,z,s,r,ob)=>{
      if(slopeAt(x,z)>0.3||onRidge(x,z))return false;   // 3.4m 宽横板：坡最严 + 不上棱线
      d.position.set(x,h+0.42,z);d.rotation.set(0,r()*TAU,0);
      // 顺坡对齐：沿围栏方向采样两端，绕局部 X 轴倾斜贴合坡面
      const yaw=d.rotation.y;
      const h1=terrainH(x-Math.sin(yaw)*1.7,z-Math.cos(yaw)*1.7),h2=terrainH(x+Math.sin(yaw)*1.7,z+Math.cos(yaw)*1.7);
      d.rotation.x=Math.atan2(h2-h1,3.4);
      ob.push({x,z,r:1.7});return true;
    });
  // 电线杆
  put(new THREE.CylinderGeometry(0.09,0.13,6.5,6),
    stdMat(0x4e4432,0.88,0,0.4),
    rng()<0.5?1:0,
    (d,x,h,z,s,r,ob)=>{
      if(slopeAt(x,z)>0.6||onRidge(x,z))return false;
      d.position.set(x,h+3.2,z);d.rotation.set(r()*0.05,0,r()*0.05);
      ob.push({x,z,r:0.3});return true;
    });
  scene.add(group);
  return{mesh,group,obstacles,cx,cz};
}
function updateChunks(px,pz,budget){
  const ccx=Math.floor(px/CHUNK),ccz=Math.floor(pz/CHUNK);
  let made=0;
  for(let r=0;r<=VIEW&&made<budget;r++){
    for(let dx=-r;dx<=r&&made<budget;dx++)for(let dz=-r;dz<=r&&made<budget;dz++){
      if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;
      const k=chunkKey(ccx+dx,ccz+dz);
      if(!chunks.has(k)){
        chunks.set(k,buildChunk(ccx+dx,ccz+dz));
        made++;
      }
    }
  }
  for(const[k,c]of chunks){
    if(Math.max(Math.abs(c.cx-ccx),Math.abs(c.cz-ccz))>VIEW+1){
      scene.remove(c.mesh);scene.remove(c.group);
      c.mesh.geometry.dispose();
      // 共享几何/材质（树干树冠、草、岩石）跨区块存活，绝不能随单个区块释放
      c.group.children.forEach(im=>{
        if(!SHARED_GEOMETRIES.has(im.geometry))im.geometry.dispose();
        if(!SHARED_MATERIALS.has(im.material))im.material.dispose();
      });
      chunks.delete(k);
    }
  }
}
function nearObstacles(x,z){
  const ccx=Math.floor(x/CHUNK),ccz=Math.floor(z/CHUNK),out=[];
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
    const c=chunks.get(chunkKey(ccx+dx,ccz+dz));
    if(c)for(const o of c.obstacles)out.push(o);
  }
  return out;
}
