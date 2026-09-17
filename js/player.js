"use strict";
/* ============ 玩家：创建 / 移动 / 视角 / 手动射击触发 / 喷气 / 拾取 / 撤离 ============ */
function newPlayer(startGun){
  return{x:8,z:8,yaw:Math.PI*0.25,pitch:0,flyZ:0,
    hp:200,maxHp:200,iT:0,walk:0,stepT:0,
    dmgMult:1,cdMult:1,proj:1,pierce:0,rangeMult:1,speedMult:1,crit:0,regen:0,
    killHeal:0,shieldMax:0,shield:0,shieldT:0,up:{},
    gun:startGun||'ak',owned:{ak:true,pistol:true},fireT:0,muzzle:0,recoil:0,switchT:0,vehicleKind:null,invincT:0,
    jet:false,fuel:0,fuelMax:0};
}
function grantGuns(){
  for(const gid of GUNLIST){
    if(level>=GUNS[gid].unlock&&!player.owned[gid]){
      player.owned[gid]=true;
      addFeed(`🔓 解锁 ${GUNS[gid].name}（按 ${GUNS[gid].slot}）`,'#f4d98a');
    }
  }
}
function eyeY(){
  const lift=player.vehicleKind==='heli'?12:(player.vehicleKind==='tank'?2.4:0);   // 载具视角高度
  return terrainH(player.x,player.z)+1.62+player.flyZ+lift;
}
function switchGun(gid){
  const p=player;
  if(!p.owned[gid]||gid===p.gun||state!=='play')return;
  p.gun=gid;p.switchT=0.4;p.fireT=Math.max(p.fireT,0.3);
  sfx.sw();
  addFeed(`切换 ${GUNS[gid].name}`,'rgba(232,228,218,0.7)');
}
/* R 键：在已拥有的武器里循环切换 */
function cycleGun(){
  const p=player;
  if(state!=='play')return;
  const owned=GUNLIST.filter(g=>p.owned[g]);
  if(owned.length<2)return;
  const cur=owned.indexOf(p.gun);
  switchGun(owned[(cur+1)%owned.length]);
}
function tryMoveXZ(nx,nz){
  const p=player,r=0.45;
  for(const o of nearObstacles(p.x,p.z)){
    const d=dist2D(p.x,p.z,o.x,o.z);
    if(d<o.r+r){
      const k=(o.r+r-d)/Math.max(0.01,d);
      nx+=(p.x-o.x)*k*0.2;nz+=(p.z-o.z)*k*0.2;
    }
  }
  p.x=nx;p.z=nz;
}
function updatePlayer(dt){
  const p=player;
  // ==== 自由视角 ====
  const sens=0.0024;
  p.yaw-=mouseDX*sens;
  p.pitch=clamp(p.pitch-mouseDY*sens,-1.25,1.25);
  mouseDX=0;mouseDY=0;
  const turn=2.6*dt;
  if(keys.has('arrowleft'))p.yaw+=turn;
  if(keys.has('arrowright'))p.yaw-=turn;
  if(keys.has('arrowup'))p.pitch=clamp(p.pitch+1.6*dt,-1.25,1.25);
  if(keys.has('arrowdown'))p.pitch=clamp(p.pitch-1.6*dt,-1.25,1.25);
  // ==== 移动 ====
  let fw=0,st=0;
  if(keys.has('w'))fw+=1;
  if(keys.has('s'))fw-=1;
  if(keys.has('a'))st-=1;
  if(keys.has('d'))st+=1;
  const sprint=keys.has('shift');
  const moving=fw||st;
  const dx=-Math.sin(p.yaw),dz=-Math.cos(p.yaw);
  if(moving){
    const l=Math.hypot(fw,st);fw/=l;st/=l;
    let sp;
    if(p.vehicleKind==='tank')sp=7.5;                       // 坦克：慢但硬
    else if(p.vehicleKind==='heli')sp=13;                   // 直升机：快速机动
    else sp=(sprint?9.2:6.2)*p.speedMult;
    const gh0=terrainH(p.x,p.z);
    const swimming=!p.vehicleKind&&gh0<WATER_Y+0.3;
    if(swimming){
      sp*=0.72;                                        // 游泳比走路慢但不至于爬行
      // 爬坡助力：朝岸（前方地势更高）游时加速，保证总能离开水域
      const ah=terrainH(p.x+(dx*fw-dz*st)*1.4,p.z+(dz*fw+dx*st)*1.4);
      if(ah>gh0)sp*=1.45;
      p.walk+=dt*5;                                    // 游泳划水节奏
    }else if(!p.vehicleKind)p.walk+=dt*(sprint?11:8);
    if(p.flyZ>0.5&&p.vehicleKind!=='heli')sp*=1.15;
    tryMoveXZ(p.x+(dx*fw-dz*st)*sp*dt,p.z+(dz*fw+dx*st)*sp*dt);
    p.stepT-=dt;
    if(p.stepT<=0&&p.flyZ<0.3&&!swimming){p.stepT=sprint?0.28:0.38;sfx.step();}
  }
  // ==== 喷气飞天 ====
  const wantFly=p.jet&&keys.has(' ');
  if(wantFly&&p.fuel>0){
    p.flyZ=Math.min(p.flyZ+5.5*dt,8.5);
    p.fuel=Math.max(0,p.fuel-dt);
    const gy=terrainH(p.x,p.z);
    if(Math.random()<0.9)spawnP(p.x+rnd(-0.3,0.3),gy+0.3,p.z+rnd(-0.3,0.3),rnd(-0.5,0.5),rnd(-3,-1.5),rnd(-0.5,0.5),0.35,1,0.6,0.25);
    if(Math.random()<dt*9)sfx.jet();
  }else{
    p.flyZ=Math.max(0,p.flyZ-6*dt);
    if(p.flyZ===0&&p.fuel<p.fuelMax)p.fuel=Math.min(p.fuelMax,p.fuel+dt*0.85);
  }
  p.iT=Math.max(0,p.iT-dt);
  p.muzzle=Math.max(0,p.muzzle-dt);
  p.recoil=Math.max(0,p.recoil-dt*4);
  p.switchT=Math.max(0,p.switchT-dt);
  p.fireT-=dt;
  if(p.regen>0&&p.hp<p.maxHp)p.hp=Math.min(p.maxHp,p.hp+p.regen*dt);
  // ==== 手动射击：E / 左键（半自动枪点射） ====
  const held=keys.has('e')||mouseFire;
  if(!held)fireLatch=false;
  const G=GUNS[p.gun];
  curTarget=aimAssistTarget();
  if(held&&p.fireT<=0&&p.switchT<=0&&(G.auto||!fireLatch)){
    fireLatch=true;
    if(p.vehicleKind){                           // 乘坐载具：载具武器
      p.fireT=0.01;
      vehicleFire();
    }else{
      p.fireT=G.cd*p.cdMult;
      fireWeapon();
    }
  }
  // 无敌星计时
  if(p.invincT>0){p.invincT-=dt;if(p.invincT<=0)addFeed('无敌结束','#e8e4da');}
  // ==== 护甲恢复 ====
  if(p.shieldMax>0&&p.shield<p.shieldMax){p.shieldT+=dt;if(p.shieldT>=10){p.shieldT=0;p.shield++;addFeed('🛡 防弹衣修复完毕','#a8b6c2');}}
  // ==== 拾取 ====
  for(const pk of pickups){
    pk.t+=dt;
    pk.mesh.rotation.y+=dt*2;
    pk.mesh.position.y=terrainH(pk.x,pk.z)+0.45+Math.sin(pk.t*3)*0.1;
    const dd=dist2D(p.x,p.z,pk.x,pk.z);
    if(dd<6){const k=3*dt/Math.max(0.5,dd);pk.x+=(p.x-pk.x)*k;pk.z+=(p.z-pk.z)*k;}
    if(dd<0.9){
      pk.dead=true;sfx.pick();scene.remove(pk.mesh);
      p.hp=Math.min(p.maxHp,p.hp+35);addFeed('+35 生命','#9fd48a');
    }
  }
  pickups=pickups.filter(pk=>!pk.dead);
  // ==== 撤离判定 ====
  if(beacon&&extractReady){
    const d=dist2D(p.x,p.z,beacon.x,beacon.z);
    if(d<4&&p.flyZ<1){extractT+=dt;if(extractT>=1.6)levelClear();}
    else extractT=Math.max(0,extractT-dt*2);
  }
}

/* ---- 相机 / 太阳 / 天空 / 环境色 / 视图模型动画 ---- */
function updateCamera(dt){
  const p=player;
  const gh=terrainH(p.x,p.z);
  const swimming=gh<WATER_Y+0.3;
  const groundY=Math.max(gh,WATER_Y-0.4);
  // 走路摆动 / 游泳起伏
  const bobAmt=swimming
    ?Math.sin(p.walk)*0.06+Math.sin(tGlobal*1.8)*0.05
    :Math.sin(p.walk)*0.05*(p.flyZ<0.3?1:0.3);
  const vLift=p.vehicleKind==='heli'?12:(p.vehicleKind==='tank'?2.4:0);   // 载具相机升高
  camera.position.set(p.x,groundY+1.62+p.flyZ+vLift+bobAmt,p.z);
  camera.rotation.set(p.pitch,p.yaw,0);
  if(shake>0){
    camera.rotation.x+=rnd(-shake,shake)*0.03;
    camera.rotation.y+=rnd(-shake,shake)*0.03;
  }
  const sx=p.x+60,sz=p.z+40;
  sun.position.set(sx,90,sz);
  sun.target.position.set(p.x,0,p.z);
  sunSprite.position.set(sx,110,sz);
  sunHalo.position.set(sx,110,sz);
  skyDome.position.set(p.x,0,p.z);
  water.position.x=Math.round(p.x/10)*10;
  water.position.z=Math.round(p.z/10)*10;
  // 环境色调随地貌
  const w=biomeW(p.x,p.z);
  let fr=0,fg=0,fb=0,skr=0,skg=0,skb=0;
  for(const k of['plains','forest','desert','snow','scorched']){
    const B=BIOMES[k],ww=w[k];
    fr+=B.fog[0]*ww;fg+=B.fog[1]*ww;fb+=B.fog[2]*ww;
    skr+=B.sky[0]*ww;skg+=B.sky[1]*ww;skb+=B.sky[2]*ww;
  }
  scene.fog.color.setRGB(fr,fg,fb);
  paintSky([skr*0.95,skg*0.95,skb*1.05],[fr,fg,fb]);
  hemi.color.setRGB(0.8+skr*0.2,0.8+skg*0.2,0.85+skb*0.15);
  // 视图模型
  for(const gid in vmGuns)vmGuns[gid].visible=(gid===p.gun&&state!=='dead'&&!p.vehicleKind);
  const vm2=vmGuns[p.gun];
  if(vm2){
    const swDown=p.switchT>0?p.switchT/0.4:0;
    const bob=Math.sin(p.walk)*0.012;
    vm2.position.set(0,-swDown*0.5+bob,-p.recoil*0.09);
    vm2.rotation.set(p.recoil*0.14+swDown*0.4,0,swDown*0.4);
    const fl=vm2.userData.flash;
    if(p.muzzle>0){fl.scale.set(0.5+rnd(0,0.2),0.5+rnd(0,0.2),1);fl.material.rotation=rnd(0,TAU);}
    else fl.scale.set(0.001,0.001,1);
  }
  muzzleLight.intensity=p.muzzle>0?2.4:0;
  for(const c of clouds){
    c.position.x+=c.userData.v*dt;
    if(c.position.x>p.x+420)c.position.x=p.x-420;
  }
}
