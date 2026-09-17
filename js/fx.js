"use strict";
/* ============ 特效：曳光池 / GPU 粒子 / 爆炸光 / 爆炸 ============ */
const tracerPool=[];
{const geo=new THREE.BoxGeometry(0.03,0.03,1);
 for(let i=0;i<50;i++){
   const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xffd98a,transparent:true}));
   m.visible=false;scene.add(m);tracerPool.push({mesh:m,life:0});
 }}
function spawnTracer(a,b,color){
  const t=tracerPool.find(t=>t.life<=0);
  if(!t)return;
  t.life=0.07;
  t.mesh.visible=true;
  t.mesh.material.color.setHex(color||0xffd98a);
  t.mesh.material.opacity=0.95;
  t.mesh.position.set((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);
  t.mesh.lookAt(b.x,b.y,b.z);
  t.mesh.scale.set(1,1,Math.max(0.1,Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2)));
}

const PMAX=800;
const pGeo=new THREE.BufferGeometry();
const pPos=new Float32Array(PMAX*3),pCol=new Float32Array(PMAX*3);
pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));
pGeo.setAttribute('color',new THREE.BufferAttribute(pCol,3));
const points=new THREE.Points(pGeo,new THREE.PointsMaterial({size:0.22,vertexColors:true,transparent:true,opacity:0.95,depthWrite:false}));
points.frustumCulled=false;scene.add(points);
const pData=[];
function spawnP(x,y,z,vx,vy,vz,life,r,g,b){
  if(pData.length>=PMAX)pData.shift();
  pData.push({x,y,z,vx,vy,vz,t:0,life,r,g,b});
}
function updateParticles(dt){
  let n=0;
  for(let i=0;i<pData.length;i++){
    const p=pData[i];
    p.t+=dt;
    if(p.t>=p.life)continue;
    p.vy-=5*dt;
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
    const gh=terrainH(p.x,p.z);
    if(p.y<gh+0.05){p.y=gh+0.05;p.vy=0;p.vx*=0.85;p.vz*=0.85;}
    const k=1-p.t/p.life;
    pPos[n*3]=p.x;pPos[n*3+1]=p.y;pPos[n*3+2]=p.z;
    pCol[n*3]=p.r*k;pCol[n*3+1]=p.g*k;pCol[n*3+2]=p.b*k;
    pData[n]=p;n++;
  }
  pData.length=n;
  pGeo.setDrawRange(0,n);
  pGeo.attributes.position.needsUpdate=true;
  pGeo.attributes.color.needsUpdate=true;
}

const boomLights=[];
for(let i=0;i<3;i++){
  const l=new THREE.PointLight(0xff9a50,0,26);
  scene.add(l);boomLights.push({l,t:9});
}
function boomAt(x,y,z,dmg,radius){
  sfx.boom();shake=Math.max(shake,1.4);
  alertEnemies(x,z,90);                          // 爆炸声传得更远
  for(const e of enemies){
    if(e.dead)continue;
    const d=dist2D(e.x,e.z,x,z);
    if(d<radius)damageEnemy(e,dmg*(1-Math.max(0,d-radius*0.3)/radius),false);
  }
  const pd=dist2D(player.x,player.z,x,z);
  if(pd<radius*0.7&&player.flyZ<1.5)hurtPlayer(14);
  for(let i=0;i<30;i++)spawnP(x,y+0.4,z,rnd(-6,6),rnd(1,8),rnd(-6,6),rnd(0.3,0.7),1,rnd(0.5,0.8),0.2);
  for(let i=0;i<14;i++)spawnP(x+rnd(-0.5,0.5),y+rnd(0.2,1),z+rnd(-0.5,0.5),rnd(-1,1),rnd(1.5,3.5),rnd(-1,1),rnd(0.9,1.7),0.28,0.26,0.24);
  const bl=boomLights.find(b=>b.t>0.5)||boomLights[0];
  bl.t=0;bl.l.position.set(x,y+1.2,z);bl.l.intensity=7;
}

/* ---- 特效帧更新（含尸体倒地/血渍/浮字/屏幕效果） ---- */
function updateFX(dt){
  updateParticles(dt);
  for(const t of tracerPool){
    if(t.life>0){
      t.life-=dt;
      t.mesh.material.opacity=Math.max(0,t.life/0.07)*0.95;
      if(t.life<=0)t.mesh.visible=false;
    }
  }
  for(const bl of boomLights){
    if(bl.t<0.5){bl.t+=dt;bl.l.intensity*=Math.pow(0.02,dt);}
    else bl.l.intensity=0;
  }
  for(const c of corpses){
    c.t+=dt;
    // 倒地动画（前 0.45s）+ 血渍淡入
    const k=Math.min(1,c.t/0.45);
    c.mdl.group.rotation.x=-k*Math.PI/2*0.96;
    c.mdl.group.rotation.z=c.fallDir*k*0.3;
    c.mdl.group.position.y=c.gy+0.15*k;
    c.blood.material.opacity=Math.min(0.8,c.t*2);
    if(c.t>10){c.mdl.group.position.y-=dt*0.3;c.blood.material.opacity=Math.max(0,0.8-(c.t-10)*0.2);}
    if(c.t>16){scene.remove(c.mdl.group);scene.remove(c.blood);c.gone=true;}
  }
  for(let i=corpses.length-1;i>=0;i--)if(corpses[i].gone)corpses.splice(i,1);
  for(const f of floats){f.t+=dt;f.y+=dt*0.8;}
  for(let i=floats.length-1;i>=0;i--)if(floats[i].t>0.9)floats.splice(i,1);
  shake=Math.max(0,shake-3.4*dt);
  vigHit=Math.max(0,vigHit-dt*1.4);
  if(vigHit<=0)vigDir=0;
  hitMark=Math.max(0,hitMark-dt);
  for(const k of killFeed)k.t+=dt;
  killFeed=killFeed.filter(k=>k.t<4);
  popupT=Math.max(0,popupT-dt);
  streakT-=dt;if(streakT<=0)streakN=0;
  water.position.y=WATER_Y+Math.sin(tGlobal*0.7)*0.05;
  // 波纹流动（偏移 UV 制造涟漪）
  waterNormal.offset.x=tGlobal*0.008;
  waterNormal.offset.y=tGlobal*0.011;
  tGame+=dt;
}
