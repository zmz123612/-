"use strict";
/* ============ 通用工具 / 数学 / 随机 / 噪声 ============ */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const dist2D=(ax,az,bx,bz)=>{const dx=ax-bx,dz=az-bz;return Math.sqrt(dx*dx+dz*dz);};
const rnd=(a,b)=>a+Math.random()*(b-a);
const TAU=Math.PI*2;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function mulberry(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function angDiff(a,b){let d=(b-a)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d;}

/* Simplex 噪声（带种子） */
function makeNoise(seed){
  const r=mulberry(seed),perm=new Uint8Array(512),p=new Uint8Array(256);
  for(let i=0;i<256;i++)p[i]=i;
  for(let i=255;i>0;i--){const j=(r()*(i+1))|0;[p[i],p[j]]=[p[j],p[i]];}
  for(let i=0;i<512;i++)perm[i]=p[i&255];
  const G=[[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
  const F2=0.5*(Math.sqrt(3)-1),G2=(3-Math.sqrt(3))/6;
  return function(xin,yin){
    let n0=0,n1=0,n2=0;
    const s2=(xin+yin)*F2,i=Math.floor(xin+s2),j=Math.floor(yin+s2);
    const t=(i+j)*G2,x0=xin-(i-t),y0=yin-(j-t);
    let i1,j1;if(x0>y0){i1=1;j1=0;}else{i1=0;j1=1;}
    const x1=x0-i1+G2,y1=y0-j1+G2,x2=x0-1+2*G2,y2=y0-1+2*G2;
    const ii=i&255,jj=j&255;
    let t0=0.5-x0*x0-y0*y0;
    if(t0>0){t0*=t0;const g=G[perm[ii+perm[jj]]&7];n0=t0*t0*(g[0]*x0+g[1]*y0);}
    let t1=0.5-x1*x1-y1*y1;
    if(t1>0){t1*=t1;const g=G[perm[ii+i1+perm[jj+j1]]&7];n1=t1*t1*(g[0]*x1+g[1]*y1);}
    let t2=0.5-x2*x2-y2*y2;
    if(t2>0){t2*=t2;const g=G[perm[ii+1+perm[jj+1]]&7];n2=t2*t2*(g[0]*x2+g[1]*y2);}
    return 70*(n0+n1+n2);
  };
}
function fbm(n,x,y,oct){let a=0,f=1,w=0.5,s=0;for(let i=0;i<oct;i++){a+=n(x*f,y*f)*w;s+=w;f*=2.03;w*=0.5;}return a/s;}

/* ============ 可平铺纹理工厂（周期化值噪声 → 无缝细节/法线贴图） ============ */
/* 周期值噪声：格点哈希按周期 P 取模 → 整图无缝平铺 */
function makeTileNoise(seed){
  const hash=(x,y,P)=>{
    x=((x%P)+P)%P;y=((y%P)+P)%P;
    let h=(x*374761393+y*668265263+seed*69069)|0;
    h=((h^(h>>>13))*1274126177)|0;
    return ((h^(h>>>16))>>>0)/4294967295;
  };
  return function(x,y,P){
    const xi=Math.floor(x),yi=Math.floor(y);
    const xf=x-xi,yf=y-yi;
    const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
    const a=hash(xi,yi,P),b=hash(xi+1,yi,P),c=hash(xi,yi+1,P),d=hash(xi+1,yi+1,P);
    return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
  };
}
/* 周期 fbm：x,y∈[0,P)，每倍频程格点密度×2 保持周期 */
function tileFbm(n,x,y,oct,P){
  let a=0,w=0.5,f=1,s=0;
  for(let i=0;i<oct;i++){
    a+=n(x*f,y*f,P*f)*w;s+=w;f*=2;w*=0.5;
  }
  return a/s;
}
/* 地面细节贴图（灰度、多尺度：大斑驳+团块+细颗粒），乘顶点色后呈地貌泥草质感 */
function makeDetailTex(size=256){
  const n1=makeTileNoise(71),n2=makeTileNoise(72),n3=makeTileNoise(73);
  const P=8;                                        // 基础周期：8 格/图
  const c=document.createElement('canvas');c.width=c.height=size;
  const g=c.getContext('2d');
  const img=g.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size*P,v=y/size*P;
    let val=0.52
      +(tileFbm(n1,u,v,4,P)-0.5)*0.30              // 大尺度斑驳
      +(tileFbm(n2,u*3,v*3,3,P*3)-0.5)*0.22        // 中尺度团块
      +(tileFbm(n3,u*6,v*6,2,P*6)-0.5)*0.10;       // 细颗粒
    const q=clamp(val,0,1)*255|0;
    const o=(y*size+x)*4;
    img.data[o]=q;img.data[o+1]=q;img.data[o+2]=q;img.data[o+3]=255;
  }
  g.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.anisotropy=4;
  return t;
}
/* 地面法线贴图（同源周期噪声 → 高度场 → Sobel 法线）：阳光下呈现微起伏明暗 */
function makeNormalTex(size=192,strength=2.2,seed=91){
  const n=makeTileNoise(seed);
  const P=8;
  const H=new Float32Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size*P,v=y/size*P;
    H[y*size+x]=tileFbm(n,u,v,5,P);
  }
  const Hs=(x,y)=>H[(((y%size)+size)%size)*size+(((x%size)+size)%size)];
  const c=document.createElement('canvas');c.width=c.height=size;
  const g=c.getContext('2d');
  const img=g.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const dx=(Hs(x+1,y)-Hs(x-1,y))*strength;
    const dy=(Hs(x,y+1)-Hs(x,y-1))*strength;
    const len=Math.sqrt(dx*dx+dy*dy+1);
    const o=(y*size+x)*4;
    img.data[o]=((-dx/len)*0.5+0.5)*255;
    img.data[o+1]=((-dy/len)*0.5+0.5)*255;
    img.data[o+2]=(1/len*0.5+0.5)*255;
    img.data[o+3]=255;
  }
  g.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
}
