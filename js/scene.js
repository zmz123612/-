"use strict";
/* ============ Three.js 场景：渲染器 / 相机 / 光照 / 天空 / 云 / 水 ============ */
const renderer=new THREE.WebGLRenderer({canvas:glcv,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.setSize(RW,RH,false);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;     // 电影级色调
renderer.toneMappingExposure=0.95;
renderer.outputEncoding=THREE.LinearEncoding;          // gamma 校正交给后期管线的 GammaCorrectionShader（避免双重提亮）
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(72,RW/RH,0.1,700);
camera.rotation.order='YXZ';
scene.add(camera);
const hemi=new THREE.HemisphereLight(0xcfe8ff,0x54503c,0.4);scene.add(hemi);   // 环境贴图承担部分环境光
const sun=new THREE.DirectionalLight(0xfff2d8,1.05);
sun.castShadow=true;
sun.shadow.mapSize.set(1536,1536);
sun.shadow.camera.left=-60;sun.shadow.camera.right=60;
sun.shadow.camera.top=60;sun.shadow.camera.bottom=-60;
sun.shadow.camera.near=10;sun.shadow.camera.far=260;
sun.shadow.bias=-0.0015;
scene.add(sun);scene.add(sun.target);
scene.fog=new THREE.Fog(0x9db98a,55,185);

/* ---- 天空穹顶（顶点渐变） ---- */
const skyGeo=new THREE.SphereGeometry(560,20,14);
{const pos=skyGeo.attributes.position,cols=new Float32Array(pos.count*3);
 skyGeo.setAttribute('color',new THREE.BufferAttribute(cols,3));}
const skyMat=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false});
const skyDome=new THREE.Mesh(skyGeo,skyMat);skyDome.renderOrder=-10;scene.add(skyDome);
function paintSky(top,hor){
  const pos=skyGeo.attributes.position,col=skyGeo.attributes.color;
  for(let i=0;i<pos.count;i++){
    const y=pos.getY(i)/560;
    const t=clamp((y+0.15)/0.75,0,1);
    col.setXYZ(i,lerp(hor[0],top[0],t),lerp(hor[1],top[1],t),lerp(hor[2],top[2],t));
  }
  col.needsUpdate=true;
}
paintSky([0.45,0.62,0.80],[0.42,0.48,0.38]);   // 初始天空色：菜单态不跑 updateCamera，防止顶点色全 0 呈黑天

/* ---- 发光贴图与太阳光晕 ---- */
function glowTex(inner,outer){
  const c=document.createElement('canvas');c.width=c.height=64;
  const g=c.getContext('2d');
  const gr=g.createRadialGradient(32,32,2,32,32,30);
  gr.addColorStop(0,inner);gr.addColorStop(1,outer);
  g.fillStyle=gr;g.fillRect(0,0,64,64);
  return new THREE.CanvasTexture(c);
}
const texGlowWarm=glowTex('rgba(255,240,190,1)','rgba(255,140,40,0)');
const texGlowRed=glowTex('rgba(255,120,80,1)','rgba(255,40,20,0)');
const texGlowGreen=glowTex('rgba(160,255,150,1)','rgba(60,255,90,0)');
const texSun=glowTex('rgba(255,252,235,1)','rgba(255,220,150,0)');
const sunSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texSun,transparent:true,opacity:0.95,fog:false,depthWrite:false}));
sunSprite.scale.set(120,120,1);scene.add(sunSprite);
const sunHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:texSun,transparent:true,opacity:0.28,fog:false,depthWrite:false}));
sunHalo.scale.set(340,340,1);scene.add(sunHalo);

/* ---- 云 ---- */
function cloudTex(){
  const c=document.createElement('canvas');c.width=c.height=160;
  const g=c.getContext('2d');
  /* 每个软圆必须完整落在画布内（x∈[r,160-r]）：圆一旦被画布边缘裁切，
     Sprite 就会显出矩形硬边——天空中"灰色长板/格栅板"的真身 */
  for(let i=0;i<14;i++){
    const r=16+Math.random()*24;
    const x=r+2+Math.random()*(160-2*r-4),y=r+2+Math.random()*(160-2*r-4);
    const gr=g.createRadialGradient(x,y,2,x,y,r);
    gr.addColorStop(0,'rgba(255,255,255,0.5)');
    gr.addColorStop(0.65,'rgba(255,255,255,0.26)');
    gr.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();
  }
  return new THREE.CanvasTexture(c);
}
const clouds=[];
{const ct=cloudTex();
 for(let i=0;i<10;i++){
   const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:ct,transparent:true,opacity:0.5,fog:false,depthWrite:false}));
   sp.scale.set(90+rnd(0,60),36+rnd(0,20),1);   // 比例压到 ~2.5:1 并缩小：更像云团、不像平板
   sp.position.set(rnd(-400,400),rnd(95,155),rnd(-400,400));
   sp.userData.v=rnd(1.2,3);
   scene.add(sp);clouds.push(sp);
 }}

/* ---- 湖面（PBR：环境反射 + 流动波纹法线） ---- */
const waterMat=new THREE.MeshStandardMaterial({color:0x33608a,transparent:true,opacity:0.82,roughness:0.18,metalness:0.15});
const waterNormal=makeNormalTex(160,1.5,177);
waterNormal.repeat.set(70,70);
waterMat.normalMap=waterNormal;
waterMat.normalScale=new THREE.Vector2(0.4,0.4);
const water=new THREE.Mesh(new THREE.PlaneGeometry(900,900),waterMat);
water.rotation.x=-Math.PI/2;water.position.y=WATER_Y;scene.add(water);

/* ---- 环境光照：程序天空渐变 → PMREM 环境贴图（PBR 材质的全局环境反射/漫射） ---- */
function makeEnvTexture(){
  const c=document.createElement('canvas');c.width=256;c.height=128;
  const g=c.getContext('2d');
  const gr=g.createLinearGradient(0,0,0,128);
  gr.addColorStop(0,'#7fa8d8');     // 天顶
  gr.addColorStop(0.48,'#c8d4c2');  // 地平线
  gr.addColorStop(0.52,'#8a8468');  // 地面
  gr.addColorStop(1,'#565040');     // 地底
  g.fillStyle=gr;g.fillRect(0,0,256,128);
  const t=new THREE.CanvasTexture(c);
  t.mapping=THREE.EquirectangularReflectionMapping;
  return t;
}
const pmrem=new THREE.PMREMGenerator(renderer);
const envRT=pmrem.fromEquirectangular(makeEnvTexture());
scene.environment=envRT.texture;

/* ---- 后期合成管线：渲染 → SSAO 环境光遮蔽 → Bloom 泛光 → Gamma → FXAA ---- */
let USE_SSAO=true;
let composer=null,ssaoPass=null;
function buildComposer(){
  composer=new THREE.EffectComposer(renderer);
  composer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  composer.setSize(RW,RH);
  composer.addPass(new THREE.RenderPass(scene,camera));
  if(USE_SSAO&&THREE.SSAOPass){
    ssaoPass=new THREE.SSAOPass(scene,camera,RW,RH);
    ssaoPass.kernelRadius=6;
    ssaoPass.minDistance=0.0008;
    ssaoPass.maxDistance=0.09;
    composer.addPass(ssaoPass);
  }
  const bloom=new THREE.UnrealBloomPass(new THREE.Vector2(RW,RH),0.30,0.6,0.85);
  composer.addPass(bloom);
  composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
  const fxaa=new THREE.ShaderPass(THREE.FXAAShader);
  const pr=renderer.getPixelRatio();
  fxaa.material.uniforms['resolution'].value.set(1/(RW*pr),1/(RH*pr));
  composer.addPass(fxaa);
}
buildComposer();
window.__ssao=v=>{USE_SSAO=v;buildComposer();return USE_SSAO;};

/* ---- 世界坐标 → 屏幕投影 ---- */
function projectToScreen(x,y,z){
  const v=new THREE.Vector3(x,y,z).project(camera);
  if(v.z>1)return null;
  return{x:(v.x*0.5+0.5)*RW,y:(-v.y*0.5+0.5)*RH};
}
