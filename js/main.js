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

/* ---- 页面不可见/失焦自动暂停（省 CPU） ---- */
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&state==='play'){state='pause';if(document.exitPointerLock)document.exitPointerLock();}
});
addEventListener('blur',()=>{if(state==='play'){state='pause';if(document.exitPointerLock)document.exitPointerLock();}});

let last=performance.now();
let menuAcc=0;
function frame(now){
  requestAnimationFrame(frame);
  let dt=(now-last)/1000;last=now;
  if(dt<=0)return;
  dt=Math.min(0.05,dt);
  tGlobal+=dt;
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
