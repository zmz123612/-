"use strict";
/* ============ 敌人：生成 / AI（追击/走位/BOSS 冲锋弹幕）/ 模型动画 ============ */
const EDEF={
  b:{hp:62, speed:3.0, dmg:12},
  g:{hp:56, speed:2.4, dmg:9, rng:30},
  h:{hp:250,speed:2.0, dmg:24},
};
function makeEnemy(t,x,z){
  const hpS=1+0.2*(level-1);
  const isBoss=t==='boss';
  const hp=isBoss?(LEVELS[level-1].v===1?2600:5200):(t==='h'?EDEF.h.hp*hpS:EDEF[t].hp*hpS);
  const mdl=makeSoldier(t);
  scene.add(mdl.group);
  return{type:t,x,z,hp,maxHp:hp,
    speed:isBoss?(LEVELS[level-1].v===1?3.4:4.2):EDEF[t].speed*(1+0.03*level),
    dmg:(isBoss?30:EDEF[t].dmg)*(1+0.05*(level-1)),
    mdl,flash:0,t:rnd(0,9),shootT:rnd(0.5,1.8),hitT:0,dead:false,
    phase:1,minionT:8,chargeT:2.5,dashVX:0,dashVZ:0,dashing:0,lastHitT:0,
    // 警戒系统：出生在岗哨巡逻，被发现/听到枪声才进攻
    alert:isBoss,detectR:{b:16,g:22,h:13,boss:40}[t],
    spawnX:x,spawnZ:z,patrolT:rnd(0.5,3),patrolA:rnd(0,TAU),patrolWalk:true};
}
/* 声响/呼喊传播：半径内所有未警戒敌人进入战斗 */
function alertEnemies(x,z,r){
  let n=0;
  for(const e of enemies){
    if(e.dead||e.alert)continue;
    if(dist2D(e.x,e.z,x,z)<r){e.alert=true;addFloat3D(e.x,terrainH(e.x,e.z)+2.4,e.z,'!','#ff5040',20);n++;}
  }
  return n;
}
function spawnAt(t,x,z){
  const e=makeEnemy(t,x,z);
  enemies.push(e);
  for(let i=0;i<8;i++)spawnP(x,terrainH(x,z)+1,z,rnd(-2,2),rnd(1,3),rnd(-2,2),0.5,1,0.8,0.4);
  return e;
}
function spawnAround(t,minR,maxR){
  for(let i=0;i<40;i++){
    const a=rnd(0,TAU),r=rnd(minR,maxR);
    const x=player.x+Math.cos(a)*r,z=player.z+Math.sin(a)*r;
    if(terrainH(x,z)>WATER_Y+0.4)return spawnAt(t,x,z);
  }
  return spawnAt(t,player.x+minR,player.z);
}
function makePickup(x,z,kind){
  const mat=new THREE.MeshStandardMaterial({color:0xdad6cc,roughness:0.7,metalness:0.05,envMapIntensity:0.4});
  const m=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.34,0.34),mat);
  m.position.set(x,terrainH(x,z)+0.4,z);
  m.castShadow=true;
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:texGlowGreen,transparent:true,opacity:0.5,depthWrite:false}));
  glow.scale.set(1.6,1.6,1);m.add(glow);
  scene.add(m);
  return{x,z,kind,mesh:m,t:0,dead:false};
}
function enemyFire(e){
  const p=player;
  e.mdl.rifle.userData.flashT=0.06;
  const gy=terrainH(e.x,e.z)+1.35*e.mdl.group.scale.x;
  const eye=eyeY();
  let acc=p.flyZ>2?0.4:1;
  if(terrainH(p.x,p.z)<WATER_Y+0.3)acc*=0.5;   // 游泳中的目标只露头，更难命中
  sfx.eshot(clamp(1.6-dist2D(e.x,e.z,p.x,p.z)/30,0.25,1));
  const yaw2=Math.atan2(-(p.x-e.x),-(p.z-e.z));
  const dir={x:-Math.sin(yaw2),y:(eye-gy)/Math.max(1,dist2D(e.x,e.z,p.x,p.z)),z:-Math.cos(yaw2)};
  spawnTracer({x:e.x,y:gy,z:e.z},{x:p.x+dir.x*2,y:eye,z:p.z+dir.z*2},0xffab5e);
  if(Math.random()<0.5*acc)hurtPlayer(e.dmg);
  if(Math.random()<acc)vigDir=yaw2;
}
function updateEnemy(e,dt){
  e.t+=dt;e.flash=Math.max(0,e.flash-dt);e.hitT=Math.max(0,e.hitT-dt);
  const p=player;
  const d=dist2D(e.x,e.z,p.x,p.z);
  const gy=terrainH(e.x,e.z);
  const eye=eyeY();
  let see=losClear(e.x,gy+1.4,e.z,p.x,eye,p.z);
  // ==== 警戒判定：进入视野距离才被发现；飞行/潜行影响感知 ====
  if(!e.alert){
    let det=e.detectR;
    if(p.flyZ>2)det*=0.7;                                  // 飞在高处不易被察觉
    if(see&&d<det){
      e.alert=true;
      addFloat3D(e.x,gy+2.4,e.z,'!','#ff5040',20);
      alertEnemies(e.x,e.z,14);                            // 呼喊附近同伴
    }
  }
  let mvx=0,mvz=0,moving=false,spd=e.speed;
  if(!e.alert){
    // ==== 巡逻态：在岗哨附近踱步，不主动接近玩家 ====
    e.patrolT-=dt;
    if(e.patrolT<=0){e.patrolT=rnd(2.5,6);e.patrolA=rnd(0,TAU);e.patrolWalk=Math.random()<0.72;}
    if(e.patrolWalk){
      const tx=e.spawnX+Math.cos(e.patrolA)*4.5,tz=e.spawnZ+Math.sin(e.patrolA)*4.5;
      const dd=dist2D(e.x,e.z,tx,tz);
      if(dd>0.6){mvx=(tx-e.x)/dd;mvz=(tz-e.z)/dd;moving=true;}
    }
    spd=e.speed*0.35;
  }else if(e.type==='boss'){
    if(e.hp<e.maxHp*0.5&&e.phase===1){e.phase=2;e.speed*=1.3;popupMsg('⚠ BOSS 进入狂暴!');sfx.boss();}
    if(e.phase===2){e.minionT-=dt;if(e.minionT<=0){e.minionT=7;spawnAround('b',18,30);spawnAround('b',18,30);}}
    e.chargeT-=dt;
    if(e.dashing>0){
      e.dashing-=dt;
      e.x+=e.dashVX*dt;e.z+=e.dashVZ*dt;
      for(let i=0;i<2;i++)spawnP(e.x,gy+0.5,e.z,rnd(-2,2),rnd(1,3),rnd(-2,2),0.4,0.5,0.45,0.4);
      if(d<2.2&&p.flyZ<1.5&&e.hitT<=0){e.hitT=1;hurtPlayer(e.dmg);shake=Math.max(shake,1);}
      if(e.dashing<=0)e.chargeT=e.phase===2?2.6:3.4;
    }else if(e.chargeT<=0&&see){
      const dd=Math.max(0.1,d);
      e.dashVX=(p.x-e.x)/dd*16;e.dashVZ=(p.z-e.z)/dd*16;
      e.dashing=0.8;sfx.boss();
    }else{
      if(d>3){mvx=(p.x-e.x)/d;mvz=(p.z-e.z)/d;moving=true;}
      else if(d<2.2&&p.flyZ<1.5&&e.hitT<=0){e.hitT=1;hurtPlayer(e.dmg);shake=Math.max(shake,0.9);}
      e.shootT-=dt;
      if(e.shootT<=0&&see){
        e.shootT=e.phase===2?1.1:1.6;
        const n=e.phase===2?7:5;
        const base=Math.atan2(-(p.x-e.x),-(p.z-e.z));
        for(let i=0;i<n;i++){
          const a=base+(i-(n-1)/2)*0.2;
          const m=new THREE.Mesh(new THREE.SphereGeometry(0.22,8,6),
            new THREE.MeshBasicMaterial({color:0xff8a3c}));
          const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:texGlowWarm,transparent:true,depthWrite:false}));
          glow.scale.set(1.4,1.4,1);m.add(glow);
          m.position.set(e.x,gy+1.6,e.z);
          scene.add(m);
          orbs.push({mesh:m,x:e.x,y:gy+1.6,z:e.z,vx:-Math.sin(a)*11,vz:-Math.cos(a)*11,t:0,dmg:e.dmg*0.5});
        }
        e.mdl.rifle.userData.flashT=0.08;sfx.eshot(1);
      }
    }
  }else if(e.type==='g'){
    // 枪手：保持距离 + 横向走位 + 射击（仅警戒后）
    if(see){
      const want=17;
      let mv=0;
      if(d>want+3)mv=1;else if(d<want-4)mv=-1;
      if(mv!==0){mvx=(p.x-e.x)/d*mv;mvz=(p.z-e.z)/d*mv;moving=true;}
      else{mvx=-(p.z-e.z)/d;mvz=(p.x-e.x)/d;moving=true;}
      e.shootT-=dt;
      if(e.shootT<=0&&d<EDEF.g.rng){e.shootT=1.7*rnd(0.85,1.15);enemyFire(e);}
    }else{mvx=(p.x-e.x)/d*0.5;mvz=(p.z-e.z)/d*0.5;moving=true;}
  }else{
    // 步兵/重甲：追击近战
    if(d>1.6){const wob=Math.sin(e.t*2.3)*0.4;
      const a=Math.atan2(p.z-e.z,p.x-e.x)+wob;
      mvx=Math.cos(a);mvz=Math.sin(a);moving=true;}
    else if(p.flyZ<1.5&&e.hitT<=0){e.hitT=0.95;hurtPlayer(e.dmg);}
  }
  if(moving){
    let nx=e.x+mvx*spd*dt,nz=e.z+mvz*spd*dt;
    for(const o of nearObstacles(e.x,e.z)){
      const od=dist2D(nx,nz,o.x,o.z);
      if(od<o.r+0.4){const k=(o.r+0.4-od)/Math.max(0.01,od);nx+=(nx-o.x)*k;nz+=(nz-o.z)*k;}
    }
    e.x=nx;e.z=nz;
  }
  // 敌人间排斥 + 不与玩家重叠
  for(const o of enemies){
    if(o===e||o.dead)continue;
    const dd=dist2D(e.x,e.z,o.x,o.z),min=1.3;
    if(dd<min&&dd>0.01){
      const k=(min-dd)*0.5/Math.max(0.01,dd);
      e.x+=(e.x-o.x)*k;e.z+=(e.z-o.z)*k;
    }
  }
  {const dd=dist2D(e.x,e.z,p.x,p.z),min=0.95;
    if(dd<min&&dd>0.01){
      const k=(min-dd)/Math.max(0.01,dd);
      e.x+=(e.x-p.x)*k;e.z+=(e.z-p.z)*k;
    }
  }
  // ---- 模型动画 ----
  const g=e.mdl.group;
  const ty=terrainH(e.x,e.z);
  g.position.set(e.x,lerp(g.position.y||ty,ty,clamp(10*dt,0,1)),e.z);
  // 面向：战斗看玩家 / 巡逻看行走方向
  let face=Math.atan2(p.x-e.x,p.z-e.z);
  if(!e.alert&&moving)face=Math.atan2(mvx,mvz);
  g.rotation.y=lerp(g.rotation.y,face+Math.PI,clamp(8*dt,0,1));
  // 曲膝走路
  const sw=moving?Math.sin(e.t*(e.alert?7:4))*(e.alert?0.6:0.3):0;
  e.mdl.legL.hip.rotation.x=sw;e.mdl.legR.hip.rotation.x=-sw;
  e.mdl.legL.knee.rotation.x=Math.max(0.06,-sw)*0.9+0.1;
  e.mdl.legR.knee.rotation.x=Math.max(0.06,sw)*0.9+0.1;
  // 躯干微倾
  e.mdl.torso.rotation.x=e.alert&&moving?0.08:0.02;
  // 受击/开火泛光 + 警戒红色描边（便于发现）
  const em=e.flash>0?0.55:(e.mdl.rifle.userData.flashT>0?0.4:0);
  const ar=e.alert?0.16:0;
  for(const m of e.mdl.mats)m.emissive.setRGB(Math.max(em,ar),Math.max(em*0.85,ar*0.15),Math.max(em*0.7,ar*0.15));
  if(e.mdl.rifle.userData.flashT>0){
    e.mdl.rifle.userData.flashT-=dt;
    const f=e.mdl.rifle.userData.flash;
    f.scale.set(0.9+rnd(0,0.3),0.9+rnd(0,0.3),1);
  }else e.mdl.rifle.userData.flash.scale.set(0.001,0.001,1);
}
/* ---- 敌方投射物（BOSS 能量球 / RPG 火箭共用推进） ---- */
function updateProjectiles(dt){
  for(const r of rockets){
    r.t+=dt;
    r.x+=r.vx*dt;r.y+=r.vy*dt;r.z+=r.vz*dt;
    r.mesh.position.set(r.x,r.y,r.z);
    r.mesh.rotation.y=Math.atan2(-r.vx,-r.vz)+Math.PI;
    spawnP(r.x,r.y,r.z,rnd(-0.5,0.5),rnd(-0.2,0.6),rnd(-0.5,0.5),0.35,0.9,0.6,0.35);
    let boom=terrainH(r.x,r.z)>r.y;
    for(const e of enemies)if(!e.dead&&dist2D(r.x,r.z,e.x,e.z)<1.0){boom=true;break;}
    if(dist2D(r.x,r.z,player.x,player.z)<0.8)boom=true;
    if(boom){r.dead=true;scene.remove(r.mesh);boomAt(r.x,r.y,r.z,r.dmg,7);}
    if(r.t>6){r.dead=true;scene.remove(r.mesh);}
  }
  rockets=rockets.filter(r=>!r.dead);
  for(const o of orbs){
    o.t+=dt;
    o.x+=o.vx*dt;o.z+=o.vz*dt;
    o.mesh.position.set(o.x,o.y,o.z);
    if(terrainH(o.x,o.z)>o.y){o.dead=true;scene.remove(o.mesh);continue;}
    if(dist2D(o.x,o.z,player.x,player.z)<0.8&&player.flyZ<2){
      o.dead=true;scene.remove(o.mesh);hurtPlayer(o.dmg);
      vigDir=Math.atan2(-(o.x-player.x),-(o.z-player.z));
    }
    if(o.t>4.5){o.dead=true;scene.remove(o.mesh);}
  }
  orbs=orbs.filter(o=>!o.dead);
}
