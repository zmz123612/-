"use strict";
/* ============ 世界定义：噪声实例 / 地貌 / 地形高度与颜色 ============ */
const WORLD_SEED=1337;
const nT=makeNoise(WORLD_SEED+11),nM=makeNoise(WORLD_SEED+77),nH=makeNoise(WORLD_SEED+31),nH2=makeNoise(WORLD_SEED+53),nD=makeNoise(WORLD_SEED+97);

const BIOMES={
  plains:  {name:'草原',  col:[0.29,0.38,0.19], fog:[0.42,0.48,0.38], sky:[0.45,0.62,0.80], amp:1.8, tree:0.0030,rock:0.0012,grass:0.9},
  forest:  {name:'森林',  col:[0.17,0.27,0.14], fog:[0.36,0.44,0.34], sky:[0.42,0.58,0.75], amp:2.4, tree:0.0260,rock:0.0016,grass:0.7},
  desert:  {name:'沙漠',  col:[0.66,0.56,0.36], fog:[0.55,0.48,0.36], sky:[0.62,0.68,0.72], amp:1.4, tree:0.0016,rock:0.0030,grass:0.05},
  snow:    {name:'雪原',  col:[0.80,0.84,0.88], fog:[0.56,0.62,0.70], sky:[0.55,0.66,0.80], amp:2.8, tree:0.0045,rock:0.0022,grass:0.02},
  scorched:{name:'焦土',  col:[0.23,0.20,0.18], fog:[0.30,0.26,0.24], sky:[0.38,0.30,0.28], amp:2.6, tree:0.0020,rock:0.0038,grass:0.15},
};
const WATER_Y=-2.2;

/* 温度/湿度双轴 → 地貌权重（平滑混合） */
function biomeW(x,z){
  const t=fbm(nT,x*0.0011,z*0.0011,3)*0.5+0.5;
  const m=fbm(nM,x*0.0013+77,z*0.0013,3)*0.5+0.5;
  let wS=smooth(0.40,0.30,t);
  let wD=smooth(0.60,0.70,t)*(1-smooth(0.48,0.56,m));
  let wX=smooth(0.30,0.20,m)*smooth(0.42,0.50,t)*(1-wS);
  let wF=smooth(0.60,0.72,m)*(1-wS)*(1-wD);
  let wP=Math.max(0,1-wS-wD-wX-wF);
  const s=wS+wD+wX+wF+wP;
  return{snow:wS/s,desert:wD/s,scorched:wX/s,forest:wF/s,plains:wP/s};
}
function biomeAt(x,z){
  const w=biomeW(x,z);
  let bk='plains',bv=w.plains;
  if(w.forest>bv){bv=w.forest;bk='forest';}
  if(w.desert>bv){bv=w.desert;bk='desert';}
  if(w.scorched>bv){bv=w.scorched;bk='scorched';}
  if(w.snow>bv){bv=w.snow;bk='snow';}
  return bk;
}
/* 地形高度：地貌基础起伏 + 远处山脉 + 细节 */
function terrainH(x,z){
  const w=biomeW(x,z);
  const mtn=smooth(0.44,0.9,fbm(nH,x*0.0032+31,z*0.0032,4)*0.5+0.5);
  let amp=BIOMES.plains.amp*w.plains+BIOMES.forest.amp*w.forest+BIOMES.desert.amp*w.desert+BIOMES.snow.amp*w.snow+BIOMES.scorched.amp*w.scorched;
  amp+=mtn*42;
  return fbm(nH2,x*0.012,z*0.012,4)*amp+fbm(nD,x*0.05,z*0.05,2)*0.45+fbm(nD,x*0.16,z*0.16,2)*0.14;  // 末项：微地垄起伏
}
/* 地面颜色：地貌混合 + 湖岸沙滩 + 水下 + 高山岩石/雪顶 + 坡面露岩 + 细纹理 */
function groundColor(x,z,h){
  const w=biomeW(x,z);
  let r=0,g=0,b=0;
  for(const k of['plains','forest','desert','snow','scorched']){
    const B=BIOMES[k],ww=w[k];
    r+=B.col[0]*ww;g+=B.col[1]*ww;b+=B.col[2]*ww;
  }
  const sand=smooth(WATER_Y+1.6,WATER_Y+0.3,h);
  r=lerp(r,0.58,sand);g=lerp(g,0.51,sand);b=lerp(b,0.36,sand);
  if(h<WATER_Y){const d=smooth(WATER_Y,WATER_Y-3,h);r=lerp(r,0.16,d);g=lerp(g,0.24,d);b=lerp(b,0.3,d);}
  if(h>18){const rk=smooth(18,30,h);r=lerp(r,0.29,rk);g=lerp(g,0.27,rk);b=lerp(b,0.26,rk);}
  if(h>44){const sn=smooth(44,56,h);r=lerp(r,0.72,sn);g=lerp(g,0.75,sn);b=lerp(b,0.79,sn);}
  // 坡面露岩
  const e=0.6;
  const hx=terrainH(x+e,z)-terrainH(x-e,z),hz=terrainH(x,z+e)-terrainH(x,z-e);
  const slope=Math.min(1,Math.hypot(hx,hz)/(2*e)*0.9);
  const sl=smooth(0.45,0.9,slope);
  r=lerp(r,0.3,sl);g=lerp(g,0.27,sl);b=lerp(b,0.25,sl);
  const nz=fbm(nD,x*0.35,z*0.35,2)*0.05;
  return[clamp(r+nz,0,1),clamp(g+nz,0,1),clamp(b+nz,0,1)];
}
