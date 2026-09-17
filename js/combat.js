"use strict";
/* ============ 战斗：视线 / 准星辅助 / 射击（hitscan+RPG）/ 伤害与击杀 ============ */
function losClear(x0,y0,z0,x1,y1,z1){
  const d=Math.sqrt((x1-x0)**2+(y1-y0)**2+(z1-z0)**2);
  const steps=Math.ceil(d/4);
  for(let i=1;i<steps;i++){
    const t=i/steps;
    const gx=x0+(x1-x0)*t,gz=z0+(z1-z0)*t,gy=y0+(y1-y0)*t;
    // 掠射容差：距离越远容差越大（小丘不挡枪线）
    if(terrainH(gx,gz)>gy+1.2+t*1.8)return false;
  }
  return true;
}
/* 准星 5° 内敌人（红准星 + 弹道微吸附） */
function aimAssistTarget(){
  const p=player;
  const dir={x:-Math.sin(p.yaw)*Math.cos(p.pitch),y:Math.sin(p.pitch),z:-Math.cos(p.yaw)*Math.cos(p.pitch)};
  const eye=eyeY();
  let best=null,bestAng=player.vehicleKind==='heli'?0.21:0.09;   // 直升机俯射放宽到 ~12°
  const rng=GUNS[p.gun].rng*p.rangeMult;
  for(const e of enemies){
    if(e.dead)continue;
    const ex=e.x-p.x,ez=e.z-p.z;
    const d=Math.sqrt(ex*ex+ez*ez);
    if(d>rng)continue;
    const ey=e.mdl.group.position.y+0.95*e.mdl.group.scale.x-eye;
    const dl=Math.sqrt(ex*ex+ey*ey+ez*ez);
    const dot=(ex*dir.x+ey*dir.y+ez*dir.z)/Math.max(0.001,dl);
    if(dot<0.996)continue;
    const ang=Math.acos(Math.min(1,dot));
    if(ang<bestAng&&losClear(p.x,eye,p.z,e.x,eye+ey,e.z)){
      bestAng=ang;best=e;
    }
  }
  return best;
}
/* 手动开火（无限弹药） */
function fireWeapon(){
  const p=player,G=GUNS[p.gun];
  shotsFired++;
  const eye=eyeY();
  // 基础弹道 + 5° 辅助吸附（75%：准星内的敌人基本都能咬住）
  let dir={x:-Math.sin(p.yaw)*Math.cos(p.pitch),y:Math.sin(p.pitch),z:-Math.cos(p.yaw)*Math.cos(p.pitch)};
  const assist=aimAssistTarget();
  if(assist){
    const tx=assist.x-p.x,tz=assist.z-p.z;
    const ty=assist.mdl.group.position.y+0.95*assist.mdl.group.scale.x-eye;
    const tl=Math.sqrt(tx*tx+ty*ty+tz*tz);
    dir={x:lerp(dir.x,tx/tl,0.75),y:lerp(dir.y,ty/tl,0.75),z:lerp(dir.z,tz/tl,0.75)};
    const dl=Math.sqrt(dir.x**2+dir.y**2+dir.z**2);
    dir.x/=dl;dir.y/=dl;dir.z/=dl;
  }
  const n=G.pellets>1?1:p.proj;
  const extra=G.pellets>1?(p.proj-1)*2:0;
  for(let pi=0;pi<n;pi++){
    const total=G.pellets+extra;
    for(let i=0;i<total;i++){
      // 散布：正交基上圆盘随机偏转
      let fx=dir.x,fy=dir.y,fz=dir.z;
      if(G.spread>0){
        const bx=-fz,bz=fx;                        // 侧向基
        const bl=Math.hypot(bx,bz)||1;
        const ux=bx/bl,uz=bz/bl;
        const vx=fy*uz,vz=-fy*ux;                  // 上向（dir×side）
        const a1=rnd(0,TAU),a2=Math.sqrt(Math.random())*G.spread;
        const ox=Math.cos(a1)*a2,oy=Math.sin(a1)*a2;
        let sx=fx+ux*ox+vx*oy,sy=fy+oy,sz=fz+uz*ox+vz*oy;
        const sl=Math.hypot(sx,sy,sz);fx=sx/sl;fy=sy/sl;fz=sz/sl;
      }
      if(G.rocket){
        const m=new THREE.Group();
        const body=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.5,8),new THREE.MeshLambertMaterial({color:0x5c6454}));
        body.rotation.x=Math.PI/2;m.add(body);
        const tip=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.22,8),new THREE.MeshLambertMaterial({color:0x8a2f22}));
        tip.rotation.x=-Math.PI/2;tip.position.z=-0.34;m.add(tip);
        m.position.set(p.x+fx*0.8,eye,p.z+fz*0.8);
        scene.add(m);
        rockets.push({mesh:m,x:p.x+fx*0.8,y:eye,z:p.z+fz*0.8,vx:fx*26,vy:fy*26,vz:fz*26,t:0,dmg:G.dmg*p.dmgMult});
      }else hitscan({x:p.x,y:eye-0.12,z:p.z},{x:fx,y:fy,z:fz},G,p);
    }
  }
  p.muzzle=0.055;p.recoil=Math.min(1,p.recoil+G.kick*0.16);
  shake=Math.max(shake,G.kick*0.05);
  sfx[G.snd]();
  // 枪声惊动：周围敌人进入警戒（火箭/爆炸更远）
  alertEnemies(p.x,p.z,G.rocket?60:40);
}
function hitscan(origin,dir,G,p){
  const cand=[];
  const rng=G.rng*p.rangeMult;
  // 水平单位向量（dir 含俯仰分量，投影必须用纯水平方向归一化，否则俯仰越大偏差越大）
  const hl=Math.hypot(dir.x,dir.z)||1;
  const hx=dir.x/hl,hz=dir.z/hl;
  const pathScale=hl;                       // 弹道水平速度分量占比（换算弹道距离↔水平距离）
  // 射线-圆柱相交（含身体高度判定）
  for(const e of enemies){
    if(e.dead)continue;
    const ex=e.x-origin.x,ez=e.z-origin.z;
    const projH=ex*hx+ez*hz;                       // 水平距离
    const proj0=projH/pathScale;                   // 对应弹道长度
    if(projH<0.1||proj0>rng)continue;              // 射程按弹道长度判定
    const px2=origin.x+hx*projH,pz2=origin.z+hz*projH;
    const rr=(e.type==='boss'?1.2:e.type==='h'?0.74:0.6);
    if((px2-e.x)**2+(pz2-e.z)**2>=rr*rr)continue;
    const proj=projH/pathScale;                    // 弹道长度（含垂直分量）
    const hitY=origin.y+dir.y*proj;
    // 以模型实时位置为基准（含离地误差），命中区覆盖全身并留容差
    const base=e.mdl.group.position.y,sc=e.mdl.group.scale.x;
    const yLo=base-0.1*sc,yHi=base+(e.type==='boss'?2.2:1.85)*sc;
    if(hitY<yLo-0.45||hitY>yHi+0.5)continue;
    cand.push([proj,e]);
  }
  cand.sort((a,b)=>a[0]-b[0]);
  // 命中者逐一验证：与视线判定完全同一标准（losClear），杜绝"看得见打不着"
  let pierced=0;
  for(const[d,e]of cand){
    const aimY=e.mdl.group.position.y+0.95*e.mdl.group.scale.x;
    if(!losClear(origin.x,origin.y,origin.z,e.x,aimY,e.z))continue;   // 被地形挡 → 试下一个
    let dmg=G.dmg*p.dmgMult*(1-Math.min(0.65,(d/rng)*G.falloff));
    const crit=Math.random()<p.crit;
    if(crit)dmg*=2.5;
    const hitP={x:origin.x+dir.x*d,y:origin.y+dir.y*d,z:origin.z+dir.z*d};
    spawnTracer({x:origin.x+dir.x*0.6,y:origin.y,z:origin.z+dir.z*0.6},hitP,0xffd98a);
    damageEnemy(e,dmg,crit);
    if(pierced<G.pierce+p.pierce){pierced++;continue;}
    return;
  }
  // 全部未命中：曳光打到地形挡点或射程尽头
  let endD=rng;
  for(let s=2;s<rng;s+=2){
    const gx=origin.x+dir.x*s,gz=origin.z+dir.z*s,gy=origin.y+dir.y*s;
    if(terrainH(gx,gz)>gy+0.5){endD=s;break;}
  }
  const end={x:origin.x+dir.x*endD,y:origin.y+dir.y*endD,z:origin.z+dir.z*endD};
  spawnTracer({x:origin.x+dir.x*0.6,y:origin.y,z:origin.z+dir.z*0.6},end,0xffd98a);
  if(endD<rng)for(let i=0;i<3;i++)spawnP(end.x,end.y,end.z,rnd(-1,1),rnd(0.5,2),rnd(-1,1),0.3,0.65,0.6,0.5);
}
function damageEnemy(e,dmg,crit){
  if(e.dead)return;
  e.hp-=dmg;e.flash=0.1;e.lastHitT=tGlobal;
  const my=e.mdl.group.position.y;                     // 模型实时高度（泅渡时在水面而非湖底）
  if(!e.alert){e.alert=true;addFloat3D(e.x,my+2.4,e.z,'!','#ff5040',20);alertEnemies(e.x,e.z,18);}  // 中弹必惊动并呼救
  addFloat3D(e.x,my+2.1,e.z,''+Math.round(dmg),crit?'#ffd24a':'#fff',crit?19:14);
  const ey=my+1.1;
  for(let i=0;i<(crit?6:3);i++)spawnP(e.x,ey,e.z,rnd(-2,2),rnd(0.5,2.5),rnd(-2,2),0.4,0.55,0.08,0.06);
  hitMark=0.14;hitCrit=crit;
  crit?sfx.crit():sfx.hit();
  if(e.hp<=0)killEnemy(e);
}
function killEnemy(e){
  e.dead=true;kills++;sfx.kill();
  const gy=terrainH(e.x,e.z);
  e.mdl.group.rotation.order='YXZ';
  corpses.push({mdl:e.mdl,t:0,gy,fallDir:Math.random()<0.5?1:-1});
  const blood=new THREE.Mesh(new THREE.PlaneGeometry(2.2,2.2),
    new THREE.MeshBasicMaterial({map:bloodTex,transparent:true,opacity:0,depthWrite:false}));
  blood.rotation.x=-Math.PI/2;blood.rotation.z=rnd(0,TAU);
  blood.position.set(e.x,gy+0.03,e.z);
  scene.add(blood);
  corpses[corpses.length-1].blood=blood;
  if(corpses.length>12){
    const c=corpses.shift();
    scene.remove(c.mdl.group);scene.remove(c.blood);
  }
  for(let i=0;i<10;i++)spawnP(e.x,gy+1,e.z,rnd(-3,3),rnd(1,3),rnd(-3,3),0.6,0.5,0.07,0.05);
  streakN++;streakT=4;
  if(streakN===2){popupMsg('双杀!');sfx.streak(2);}
  else if(streakN===3){popupMsg('三连杀!');sfx.streak(3);}
  else if(streakN>=4){popupMsg(streakN>=6?'杀神降临!!':'四连超凡!');sfx.streak(4);}
  addFeed(`击杀 ${({b:'步兵',g:'枪手',h:'重甲兵',boss:'BOSS'})[e.type]} +100`,'#9fd48a');
  if(player.killHeal>0&&player.hp<player.maxHp)player.hp=Math.min(player.maxHp,player.hp+player.killHeal);
  if(e.type==='boss')levelClear();
  else if(Math.random()<0.28)pickups.push(makePickup(e.x,e.z,'med'));
}
function hurtPlayer(dmg){
  const p=player;
  if(p.iT>0||p.invincT>0)return;               // 无敌星期间完全免伤
  if(p.vehicleKind&&damageVehicle(dmg))return;  // 乘坐载具：先扣载具耐久
  if(p.shield>=1){p.shield--;p.iT=0.9;sfx.shield();shake=Math.max(shake,0.5);return;}
  p.hp-=dmg;p.iT=0.55;vigHit=0.65;shake=Math.max(shake,0.7);sfx.hurt();
  if(p.hp<=0){p.hp=0;die();}
}
