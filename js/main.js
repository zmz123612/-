"use strict";
/* ============ 主循环：状态机调度 + 帧率监控自适应画质 ============ */
updateChunks(8,8,49);       // 标题背景地形
refreshRadar();

/* ---- 自适应画质：连续低帧自动降档（优先关 SSAO → 降分辨率 → 关阴影） ---- */
const perf={t:0,frames:0,fps:60,level:0,cool:6,shown:0};
function perfTick(dt){
  perf.t+=dt;perf.frames++;
  if(perf.t>=2){
    perf.fps=Math.round(perf.frames/perf.t);
    perf.t=0;perf.frames=0;
    perf.cool=Math.max(0,perf.cool-1);
    if(perf.fps<42&&perf.cool===0){
      if(perf.level===0){
        if(window.__ssao)window.__ssao(false);
        perf.level=1;popupMsg('⚡ 已自动关闭 SSAO 提升流畅度');
      }else if(perf.level===1){
        renderer.setPixelRatio(1);
        composer.setPixelRatio(1);composer.setSize(RW*0.8,RH*0.8);
        hud.style.width='';fit();
        perf.level=2;popupMsg('⚡ 已自动降低渲染分辨率');
      }else if(perf.level===2){
        renderer.shadowMap.enabled=false;sun.castShadow=false;
        scene.traverse(o=>{if(o.isMesh)o.material&&(o.material.needsUpdate=true);});
        perf.level=3;popupMsg('⚡ 已自动关闭阴影');
      }
      perf.cool=8;   // 降档后冷却，避免抖动
    }
  }
}

/* ---- 页面不可见/失焦自动暂停（省 CPU）；测试模式下豁免，iframe 内窗口拿不到焦点会立即假暂停 ---- */
const TEST_MODE=new URLSearchParams(location.search).get('test')==='1';
/* 统一暂停/恢复入口：进暂停清空按键与鼠标状态（失焦时松键会丢 keyup，残留按键会卡死后续输入） */
function pauseGame(){
  if(state!=='play')return;
  state='pause';
  keys.clear();
  mouseFire=false;dragLook=false;fireLatch=false;
  if(document.exitPointerLock)document.exitPointerLock();
}
function resumeGame(){
  if(state!=='pause')return;
  state='play';stT=0;
  keys.clear();
  player&&(player.iT=Math.max(player.iT||0,0.5));   // 恢复瞬间短暂无敌，防暂停界面挨打
}
if(!TEST_MODE){
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();});
  addEventListener('blur',()=>pauseGame());
}

let last=performance.now();
let menuAcc=0;
function frame(now){
  requestAnimationFrame(frame);
  let dt=(now-last)/1000;last=now;
  if(dt<=0)return;
  dt=Math.min(0.05,dt);
  tGlobal+=dt;
  updateVegetationWind(tGlobal);
  perfTick(dt);
  // 菜单类界面 30fps 足够（省一半渲染开销）；暂停页几乎静止，10fps
  const menuStates=['title','select','loadout','upgrade','win','pause'];
  if(menuStates.includes(state)){
    menuAcc+=dt;
    const cap=state==='pause'?0.1:1/30;
    if(menuAcc<cap)return;
    dt=menuAcc;menuAcc=0;
  }
  try{tick(dt);}catch(err){console.error(err);}
  composer.render();       // 后期合成管线（SSAO/Bloom/Gamma/FXAA）
}
requestAnimationFrame(frame);
function tick(dt){
  stT+=dt;
  radarT-=dt;
  if(state==='brief'){if(stT>3.4)state='play';}
  else if(state==='play'){
    updatePlayer(dt);
    updateChunks(player.x,player.z,2);
    if(radarT<=0){refreshRadar();radarT=0.35;}
    for(const e of enemies)if(!e.dead)updateEnemy(e,dt);
    enemies=enemies.filter(e=>!e.dead);
    updateProjectiles(dt);
    updateWaves(dt);
    updateAirdropSpawner(dt);
    updateFX(dt);
    updateCamera(dt);
  }
  else if(state==='clear'){
    clearT+=dt;updateFX(dt);updateCamera(dt);
    if(clearT>1.5){
      if(level>=LEVELS.length)state='win';
      else{rollUpgrades();state='upgrade';}
    }
  }
  else if(state==='dead'){updateFX(dt);updateCamera(dt);}
  ctx.clearRect(0,0,RW,RH);
  buttons=[];
  switch(state){
    case 'title':drawTitle();break;
    case 'select':drawSelect();break;
    case 'loadout':drawLoadout();break;
    case 'brief':drawBrief();break;
    case 'play':drawHUD();break;
    case 'clear':drawClear();break;
    case 'upgrade':drawUpgrade();break;
    case 'dead':drawDead();break;
    case 'win':drawWin();break;
    case 'pause':drawPause();break;
  }
}
requestAnimationFrame(frame);
/* 调试接口 */
window.__dbg=()=>({state,level,hp:player&&Math.round(player.hp),enemies:enemies.length,kills,shots:shotsFired,
  gun:player&&player.gun,
  pos:player?{x:Math.round(player.x),z:Math.round(player.z)}:null,
  biome:player?biomeAt(player.x,player.z):biomeAt(8,8),
  yaw:player&&+player.yaw.toFixed(2),pitch:player&&+player.pitch.toFixed(2),
  flyZ:player&&+player.flyZ.toFixed(1),chunks:chunks.size,locked});

/* ---- 自动化测试接口（仅 ?test=1 挂载，生产不可见） ---- */
if(new URLSearchParams(location.search).get('test')==='1'){
  const finite=v=>Number.isFinite(v);
  window.__test={
    errs:()=>window.__errs.slice(),
    start(){startRun(1);state='play';stT=9;},
    dbg:()=>window.__dbg(),
    terrainH:(x,z)=>terrainH(x,z),
    cameraState:()=>({x:camera.position.x,y:camera.position.y,z:camera.position.z}),
    playerState:()=>({x:player.x,z:player.z,flyZ:player.flyZ,vehicleKind:player.vehicleKind,hp:player.hp,finite:finite(player.x)&&finite(player.z)&&finite(player.hp)}),
    setLook(yaw,pitch){player.yaw=yaw;player.pitch=pitch;updateCamera(0.016);},
    step(n=1,dt=0.05){for(let i=0;i<n;i++)tick(dt);},   // 确定性步进：免疫后台标签 rAF 节流
    movePlayer(dx,dz){player.x+=dx;player.z+=dz;updateChunks(player.x,player.z,49);updateCamera(0.016);},
    chunkCount:()=>chunks.size,
    rockets:()=>rockets.length,
    sharedAlive:()=>({grass:!!GRASS_GEO.attributes.position,rock:!!rockGeo.attributes.position,
      trunk:!!TREE_TRUNK_GEO.attributes.position,leaf:!!LEAF_CANOPY_GEO.attributes.position,
      spruce:!!SPRUCE_CANOPY_GEO.attributes.position}),
    spawnVehicle(kind){spawnVehicle(kind);},
    vehicleState(){if(!vehicle)return null;return{kind:vehicle.kind,hp:vehicle.hp,fireT:vehicle.fireT,
      alt:vehicle.alt,x:vehicle.x,z:vehicle.z,dead:vehicle.dead};},
    enterVehicle(){if(!vehicle)return false;player.x=vehicle.x;player.z=vehicle.z;tryToggleVehicle();return player.vehicleKind===vehicle.kind;},
    exitVehicle(){tryToggleVehicle();return player&&!player.vehicleKind;},
    fireVehicle(n=1){const r0=rockets.length;let lastFireT=-1;
      for(let i=0;i<n;i++){vehicleFire();if(vehicle)lastFireT=vehicle.fireT;}
      return{rocketsFired:rockets.length-r0,fireT:lastFireT};},
    damageVehicle(d){return damageVehicle(d);},
  };
}
