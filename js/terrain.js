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
const geoCache=[];
function getPlane(){
  if(geoCache.length)return geoCache.pop();
  const g=new THREE.PlaneGeometry(CHUNK,CHUNK,SEG,SEG);
  g.rotateX(-Math.PI/2);
  return g;
}
function chunkKey(cx,cz){return cx+'_'+cz;}

/* 草丛几何（双交叉面片） */
function grassGeo(){
  const g=new THREE.BufferGeometry();
  const v=new Float32Array([
    -0.22,0,0, 0.22,0,0, -0.14,0.42,0,
    0.22,0,0, 0.14,0.42,0, -0.14,0.42,0,
    0,0,-0.22, 0,0,0.22, 0,0.42,-0.14,
    0,0,0.22, 0,0.42,0.14, 0,0.42,-0.14,
  ]);
  g.setAttribute('position',new THREE.BufferAttribute(v,3));
  g.computeVertexNormals();
  return g;
}
const GRASS_GEO=grassGeo();

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
/* 云杉树冠几何：三层锥叠出宝塔轮廓 */
function makeSpruceGeo(){
  const tiers=[[1.32,1.7,0.9],[0.98,1.55,1.85],[0.62,1.45,2.75]];
  const chunks=[];let total=0;
  for(const t of tiers){
    const g=new THREE.ConeGeometry(t[0],t[1],8).toNonIndexed();
    g.translate(0,t[2],0);
    chunks.push(g.attributes.position.array);total+=g.attributes.position.count;
  }
  const pos=new Float32Array(total*3);
  let o=0;
  for(const a of chunks)for(let i=0;i<a.length;i++)pos[o++]=a[i];
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  geo.computeVertexNormals();
  return geo;
}
function plantTrees(group,obstacles,ox,oz,w,treeN,rng){
  const snow=w.snow>0.45,dead=w.scorched>0.45;
  const spots=[];
  for(let i=0;i<treeN*3&&spots.length<treeN;i++){
    const lx=rng()*CHUNK,lz=rng()*CHUNK;
    const wx=ox+lx,wz=oz+lz;
    const h=terrainH(wx,wz);
    if(h<WATER_Y+0.6)continue;
    spots.push({x:wx,h,z:wz,sc:0.75+rng()*0.55,rot:rng()*TAU,
      sx:0.85+rng()*0.3,sz:0.85+rng()*0.3,cv:0.86+rng()*0.26});
  }
  if(!spots.length)return;
  const d=new THREE.Object3D(),col=new THREE.Color();
  const trunk=new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.13,0.21,2.4,6),
    stdMat(dead?0x453a2c:0x54402c,0.95),spots.length);
  let canopyGeo,canopyMat;
  if(snow){canopyGeo=makeSpruceGeo();canopyMat=stdMat(0x2e4a34,0.92);}
  else if(dead){canopyGeo=new THREE.ConeGeometry(0.6,1.8,7);canopyMat=stdMat(0x4a4034,0.95);}
  else{canopyGeo=makeLeafCanopyGeo();
    canopyMat=new THREE.MeshStandardMaterial({color:0x3f6a34,roughness:0.93,metalness:0,envMapIntensity:0.35,vertexColors:true});}
  const canopy=new THREE.InstancedMesh(canopyGeo,canopyMat,spots.length);
  spots.forEach((s,i)=>{
    d.rotation.set(rng()*0.05,s.rot,rng()*0.05);
    d.position.set(s.x,s.h+1.15*s.sc,s.z);
    d.scale.set(s.sc,s.sc,s.sc);
    d.updateMatrix();trunk.setMatrixAt(i,d.matrix);
    d.rotation.set(0,s.rot,0);
    if(snow){                                   // 云杉：塔锥从干中段起叠
      d.position.set(s.x,s.h+1.3*s.sc,s.z);d.scale.set(s.sc*s.sx,s.sc,s.sc*s.sz);
    }else if(dead){                             // 焦土枯树：稀疏尖冠
      d.position.set(s.x,s.h+2.7*s.sc,s.z);d.scale.set(s.sc*0.9,s.sc*0.9,s.sc*0.9);
    }else{                                      // 阔叶：多瓣冠咬在干顶
      d.position.set(s.x,s.h+2.55*s.sc,s.z);
      d.scale.set(s.sc*s.sx,s.sc*1.12,s.sc*s.sz);
    }
    d.updateMatrix();canopy.setMatrixAt(i,d.matrix);
    canopy.setColorAt(i,col.setRGB(s.cv,s.cv,s.cv));
    obstacles.push({x:s.x,z:s.z,r:0.45*s.sc});
  });
  trunk.instanceMatrix.needsUpdate=true;
  canopy.instanceMatrix.needsUpdate=true;
  if(canopy.instanceColor)canopy.instanceColor.needsUpdate=true;
  for(const im of[trunk,canopy]){
    im.castShadow=true;im.frustumCulled=false;
    group.add(im);
  }
}

function buildChunk(cx,cz){
  const g=getPlane();
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
    im.castShadow=shadow;im.frustumCulled=false;
    group.add(im);
    return im;
  };
  const w=biomeW(ox+CHUNK/2,oz+CHUNK/2);
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
    new THREE.MeshStandardMaterial({color:w.scorched>0.4?0x5a4a30:0x527a38,side:THREE.DoubleSide,roughness:0.9,metalness:0,envMapIntensity:0.35}),
    Math.min(620,Math.round(620*grassDens)),
    (d,x,h,z,s,r)=>{
      if(terrainH(x,z)<WATER_Y+0.5)return false;
      d.position.set(x,h+0.02,z);d.rotation.set(0,r()*TAU,0);
      const sc=0.7+s*1.1;d.scale.set(sc,sc,sc);
      return true;
    },false);
  if(cactus)put(
    new THREE.CylinderGeometry(0.22,0.28,2.2,6),
    stdMat(0x4a7a3a,0.85),
    Math.round(14*w.desert),
    (d,x,h,z,s)=>{
      d.position.set(x,h+1,z);d.rotation.set(0,0,0);
      const sc=0.7+s*0.8;d.scale.set(sc,sc,sc);return true;
    });
  // 焦土废墟
  if(w.scorched>0.4)put(
    new THREE.BoxGeometry(4,2.6,0.6),
    stdMat(0x6e6a60,0.78,0.1,0.5),
    2+Math.round(3*w.scorched),
    (d,x,h,z,s,r,ob)=>{
      if(h<WATER_Y+1.5)return false;
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
      if(h<WATER_Y+1)  return false;
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
      d.position.set(x,h+0.55,z);d.rotation.set(0,r()*TAU,r()*0.05);
      const sc=0.8+s*0.6;d.scale.set(sc,sc,sc);
      ob.push({x,z,r:0.95*sc});return true;
    });
  // 油桶
  put(new THREE.CylinderGeometry(0.42,0.42,1.1,10),
    stdMat(0x5a6350,0.45,0.6,0.8),
    1+Math.round(rng()*2),
    (d,x,h,z,s,r,ob)=>{
      d.position.set(x,h+0.55,z);d.rotation.set(0,0,r()*0.15-0.07);
      const sc=0.85+s*0.4;d.scale.set(sc,sc,sc);
      ob.push({x,z,r:0.6*sc});return true;
    });
  // 帐篷
  put(new THREE.CylinderGeometry(0.02,1.5,1.7,4),
    stdMat(0x64604a,0.95,0,0.35),
    rng()<0.6?1:0,
    (d,x,h,z,s,r,ob)=>{
      d.position.set(x,h+0.83,z);d.rotation.set(0,r()*TAU,0);
      ob.push({x,z,r:1.5});return true;
    });
  // 围栏（矮墙障碍）
  put(new THREE.BoxGeometry(3.4,0.9,0.14),
    stdMat(0x64583c,0.88,0,0.4),
    rng()<0.7?1+Math.round(rng()*2):0,
    (d,x,h,z,s,r,ob)=>{
      d.position.set(x,h+0.42,z);d.rotation.set(0,r()*TAU,0);
      ob.push({x,z,r:1.7});return true;
    });
  // 电线杆
  put(new THREE.CylinderGeometry(0.09,0.13,6.5,6),
    stdMat(0x4e4432,0.88,0,0.4),
    rng()<0.5?1:0,
    (d,x,h,z,s,r,ob)=>{
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
      geoCache.push(c.mesh.geometry);
      c.group.children.forEach(im=>{im.geometry.dispose();im.material.dispose();});
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
