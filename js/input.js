"use strict";
/* ============ 输入：键盘 / 自由视角（指针锁定+拖动+方向键）/ 鼠标射击 ============ */
const keys=new Set();
let locked=false,dragLook=false,lastMX=0,lastMY=0,mouseDX=0,mouseDY=0,mouseFire=false,fireLatch=false;
let mx=0,my=0;
addEventListener('keydown',e=>{
  audio();
  const k=e.key.toLowerCase();
  if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
  // 先记 held 再入集：onKey 内 pauseGame() 会清空 keys，若后置 add 会把当前键加回去，
  // 造成"暂停后第一次按 P 被去重吞掉"的卡死假象
  const wasHeld=keys.has(k);
  keys.add(k);
  if(!wasHeld)onKey(k);
});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
hud.addEventListener('contextmenu',e=>e.preventDefault());
hud.addEventListener('mousedown',e=>{
  audio();
  const r=hud.getBoundingClientRect();
  const cx=(e.clientX-r.left)*RW/r.width,cy=(e.clientY-r.top)*RH/r.height;
  if(state==='play'){
    if(e.button===0){
      if(!locked&&hud.requestPointerLock)hud.requestPointerLock();
      if(locked)mouseFire=true;                 // 锁定后：左键开火
      else{dragLook=true;lastMX=e.clientX;lastMY=e.clientY;}  // 未锁定：按住拖动转视角（E 开火）
    }
  }else onClick(cx,cy);
});
addEventListener('mouseup',()=>{dragLook=false;mouseFire=false;});
addEventListener('mousemove',e=>{
  const r=hud.getBoundingClientRect();
  mx=(e.clientX-r.left)*RW/r.width;my=(e.clientY-r.top)*RH/r.height;
  if(locked){mouseDX+=e.movementX;mouseDY+=e.movementY;}
  else if(dragLook&&state==='play'){mouseDX+=e.clientX-lastMX;mouseDY+=e.clientY-lastMY;lastMX=e.clientX;lastMY=e.clientY;}
});
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===hud;if(locked)dragLook=false;else mouseFire=false;});
document.addEventListener('pointerlockerror',()=>{locked=false;});

/* ---- 按键路由（由 levels.js 提供状态机回调） ---- */
function onKey(k){
  if(k==='m'){muted=!muted;localStorage.setItem('cw_mute',muted?'1':'0');}
  // F：快速"收起"——全屏中→退出全屏（画面整个收走，最接近最小化）；非全屏→暂停+画布收缩
  if(k==='f'&&(state==='play'||state==='pause')){
    if(document.fullscreenElement){
      // 全屏中：退出全屏（真实用户按键允许此操作）+ 暂停 → 桌面重现，等效窗口收起
      document.exitFullscreen().catch(()=>{});
      pauseGame();
      return;
    }
    if(document.exitPointerLock)document.exitPointerLock();
    pauseGame();
    if(blurCanvas())return;                     // 非全屏：暂停 + 画布收缩动效 + 失焦
  }
  // G：全屏开关（进入全屏后 F 即可一键收起）
  if(k==='g'){
    if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
    else{
      const el=document.documentElement;
      const req=el.requestFullscreen||el.webkitRequestFullscreen;
      if(req)req.call(el).catch(()=>{addFeed('浏览器拒绝了全屏请求','#e0a03c');});
    }
  }
  if(state==='title'&&(k==='enter'||k===' ')){state='loadout';stT=0;sfx.ui();}
  else if(state==='loadout'){
    const idx=['1','2','3','4','5','6'].indexOf(k);
    if(idx>=0&&GUNLIST[idx]){loadSel=GUNLIST[idx];sfx.sw();}
    if(k==='enter')startRun(1);
    if(k==='escape')state='title';
  }
  else if(state==='brief'&&k==='enter')state='play';
  else if(state==='upgrade'&&['1','2','3'].includes(k))pickUpgrade(+k-1);
  else if(state==='dead'&&k==='enter')retryLevel();
  else if(state==='play'){
    if(k==='p')pauseGame();
    else if(k==='r')cycleGun();
    else if(k==='t')tryToggleVehicle();
    else{
      const idx=['1','2','3','4','5','6'].indexOf(k);
      if(idx>=0&&GUNLIST[idx])switchGun(GUNLIST[idx]);
    }
  }
  else if(state==='pause'&&(k==='p'||k==='enter'))resumeGame();
  else if(state==='pause'&&canvasCollapsed)state='play';   // F 收起后：任意键直接回战斗
  else if(state==='select'&&k==='escape')state='title';
}
function onClick(x,y){
  for(let i=buttons.length-1;i>=0;i--){
    const b=buttons[i];
    if(x>b.x&&x<b.x+b.w&&y>b.y&&y<b.y+b.h){sfx.ui();b.cb();return;}
  }
}
/* F 键"最小化"：让真实窗口失焦（等效切走窗口），并给画布一个收起动效。
   浏览器安全策略不允许脚本真正最小化 OS 窗口，这是最接近的合规行为。 */
let canvasCollapsed=false;
function blurCanvas(){
  const wrap=document.getElementById('wrap');
  if(!wrap)return false;
  if(canvasCollapsed)return false;
  canvasCollapsed=true;
  wrap.style.transition='opacity .18s ease, transform .18s ease';
  wrap.style.opacity='0.12';
  wrap.style.transform='scale(0.9)';
  // 尝试把焦点丢给地址栏以外的东西：window.blur() 在多数浏览器会让出窗口焦点
  try{window.blur();}catch(e){}
  // 鼠标点击或按任意键：一步恢复画面并直接回到战斗（不用再按 P）
  const restore=()=>{
    wrap.style.opacity='';
    wrap.style.transform='';
    canvasCollapsed=false;
    if(state==='pause'){state='play';player&&(player.iT=Math.max(player.iT||0,0.8));}   // 恢复瞬间短暂无敌
    addFeed('继续战斗','#9fd48a');
    removeEventListener('keydown',anyKeyRestore,true);
    wrap.removeEventListener('mousedown',restore);
  };
  const anyKeyRestore=(e)=>{
    // P/M 走正常路由（P 本身就是继续）；其余键一步恢复+回战斗
    if(!['p','m'].includes(e.key.toLowerCase()))restore();
  };
  addEventListener('keydown',anyKeyRestore,true);
  wrap.addEventListener('mousedown',restore);
  return true;
}
