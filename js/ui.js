"use strict";
/* ============ 菜单 / 界面：标题 / 选关 / 装备 / 简报 / 结算 / 升级 ============ */
function button(x,y,w,h,label,cb,accent){
  const hov=mx>x&&mx<x+w&&my>y&&my<y+h;
  buttons.push({x,y,w,h,cb});
  ctx.fillStyle=hov?(accent||'#8a9a30'):(accent||'#6e7c26');
  ctx.beginPath();ctx.roundRect(x,y,w,h,6);ctx.fill();
  ctx.fillStyle='rgba(0,0,0,0.3)';ctx.beginPath();ctx.roundRect(x,y+h-5,w,5,6);ctx.fill();
  ctx.strokeStyle='rgba(244,217,138,0.3)';ctx.lineWidth=1;
  ctx.beginPath();ctx.roundRect(x,y,w,h,6);ctx.stroke();
  ctx.fillStyle='#f5f2e8';ctx.font='bold 17px sans-serif';ctx.textAlign='center';
  ctx.fillText(label,x+w/2,y+h/2+6);
}
function veil(a){ctx.fillStyle=`rgba(5,8,5,${a})`;ctx.fillRect(0,0,RW,RH);}
function wrapText(txt,x,y,maxW,lh){
  let line='',yy=y;
  for(const ch of txt){
    if(ctx.measureText(line+ch).width>maxW){ctx.fillText(line,x,yy);line=ch;yy+=lh;}
    else line+=ch;
  }
  ctx.fillText(line,x,yy);
}
/* 标题背景：轨道巡航相机 */
let orbitA=0;
function updateMenuCam(dt){
  orbitA+=dt*0.06;
  const cx=Math.cos(orbitA)*30,cz=Math.sin(orbitA)*30;
  const gy=terrainH(8+cx,8+cz);
  camera.position.set(8+cx,Math.max(gy,WATER_Y)+7,8+cz);
  camera.lookAt(8,Math.max(terrainH(8,8),WATER_Y)+1,8);
  sun.position.set(68,90,48);sun.target.position.set(8,0,8);
  sunSprite.position.set(68,110,48);sunHalo.position.set(68,110,48);
  skyDome.position.set(camera.position.x,0,camera.position.z);
  water.position.x=8;water.position.z=8;
  updateChunks(8,8,1);
}
function drawTitle(){
  updateMenuCam(0.016);
  veil(0.3);
  ctx.textAlign='center';
  ctx.font='bold 54px sans-serif';
  ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillText('穿 越 行 动 2',RW/2+3,140+3);
  ctx.fillStyle='#e8c860';ctx.fillText('穿 越 行 动 2',RW/2,140);
  ctx.font='bold 16px sans-serif';ctx.fillStyle='rgba(240,236,224,0.55)';
  ctx.fillText('C R O S S  O P S  ·  无 限 战 场',RW/2,166);
  ctx.font='14px sans-serif';ctx.fillStyle='rgba(232,228,218,0.75)';
  ctx.fillText('开放世界 · 无限地形 · 五种地貌 · 无限弹药 · E/左键手动射击 · 武器成长 · 喷气飞天',RW/2,196);
  buttons=[];
  button(RW/2-120,370,240,52,'开 始 战 役 (Enter)',()=>{state='loadout';stT=0;},'#3f7a2e');
  button(RW/2-120,434,240,44,'选 择 关 卡',()=>{state='select';stT=0;});
  button(RW/2-120,490,240,34,'⛶ 全屏游戏 (G)',()=>{
    const el=document.documentElement;
    const req=el.requestFullscreen||el.webkitRequestFullscreen;
    if(req)req.call(el).catch(()=>{});
  });
  ctx.textAlign='center';ctx.font='12px sans-serif';ctx.fillStyle='rgba(232,228,218,0.6)';
  ctx.fillText('WASD 移动 · 鼠标自由视角 · Shift 疾跑 · E/左键 射击 · R 换枪 · F 收起',RW/2,536);
  ctx.fillStyle='rgba(232,228,218,0.4)';
  ctx.fillText(best>0?`最高纪录：第 ${best} 关${best>=LEVELS.length?'（通关！）':''}`:'新兵报到',RW/2,224);
}
function drawLoadout(){
  updateMenuCam(0.016);
  veil(0.55);
  ctx.textAlign='center';
  ctx.font='bold 28px sans-serif';ctx.fillStyle='#e8c860';
  ctx.fillText('装 备 选 择',RW/2,60);
  ctx.font='12px sans-serif';ctx.fillStyle='rgba(232,228,218,0.55)';
  ctx.fillText('选择初始武器 · 战斗中按 R 或 1-6 切换 · 无限弹药 · 高级武器随关卡解锁',RW/2,82);
  buttons=[];
  const cw=142,chh=190,gap=10,x0=RW/2-(6*cw+5*gap)/2,y=120;
  for(let i=0;i<6;i++){
    const gid=GUNLIST[i],G=GUNS[gid],x=x0+i*(cw+gap);
    const sel=loadSel===gid,hov=mx>x&&mx<x+cw&&my>y&&my<y+chh;
    ctx.fillStyle=sel?'rgba(110,90,38,0.95)':hov?'rgba(40,50,36,0.95)':'rgba(14,18,12,0.92)';
    ctx.strokeStyle=sel?'#f4d98a':'rgba(200,190,160,0.2)';ctx.lineWidth=sel?3:1.5;
    ctx.beginPath();ctx.roundRect(x,y,cw,chh,10);ctx.fill();ctx.stroke();
    ctx.textAlign='center';
    ctx.font='bold 17px sans-serif';ctx.fillStyle=sel?'#f4d98a':'#e8e4da';
    ctx.fillText(G.name,x+cw/2,y+38);
    ctx.font='11px sans-serif';ctx.fillStyle='rgba(232,228,218,0.55)';
    ctx.fillText(G.cn+' · '+(G.auto?'全自动':'半自动'),x+cw/2,y+56);
    ctx.fillStyle='rgba(232,228,218,0.8)';ctx.font='11px sans-serif';
    ctx.fillText(`伤害 ${G.dmg}${G.pellets>1?'×'+G.pellets:''}`,x+cw/2,y+84);
    ctx.fillText(`射速 ${G.cd<=0.12?'快':G.cd<=0.3?'中':'慢'} · 射程 ${G.rng}m`,x+cw/2,y+100);
    ctx.fillText('弹药 ∞',x+cw/2,y+116);
    if(G.rocket)ctx.fillText('爆炸范围伤害',x+cw/2,y+132);
    else if(G.pierce)ctx.fillText(`穿透 ${G.pierce} 人`,x+cw/2,y+132);
    if(sel){ctx.fillStyle='#f4d98a';ctx.font='bold 13px sans-serif';ctx.fillText('✓ 已装备',x+cw/2,y+chh-14);}
    else{ctx.fillStyle='rgba(232,228,218,0.35)';ctx.font='11px sans-serif';ctx.fillText(`按 ${i+1}`,x+cw/2,y+chh-14);}
    buttons.push({x,y,w:cw,h:chh,cb:()=>{loadSel=gid;sfx.sw();}});
  }
  button(RW/2-115,336,230,50,'出 击 (Enter)',()=>startRun(1),'#3f7a2e');
  button(RW/2-115,400,230,40,'返 回 (Esc)',()=>{state='title';});
  ctx.textAlign='center';ctx.font='12px sans-serif';ctx.fillStyle='rgba(159,212,138,0.75)';
  ctx.fillText('◉ E 或 鼠标左键 手动射击 · 无限弹药 · 准星 5° 内微辅助吸附',RW/2,478);
}
function drawSelect(){
  updateMenuCam(0.016);
  veil(0.5);
  ctx.textAlign='center';
  ctx.font='bold 34px sans-serif';ctx.fillStyle='#e8c860';
  ctx.fillText('选 择 关 卡',RW/2,90);
  ctx.font='13px sans-serif';ctx.fillStyle='rgba(232,228,218,0.6)';
  ctx.fillText(`已解锁 ${unlockedLv} / ${LEVELS.length} 关`,RW/2,114);
  buttons=[];
  for(let i=0;i<LEVELS.length;i++){
    const col=i%5,row=Math.floor(i/5);
    const x=RW/2-5*104/2+col*104+8,y=160+row*118;
    const ok=i<unlockedLv,L=LEVELS[i];
    ctx.fillStyle=ok?'rgba(63,122,46,0.9)':'rgba(40,46,38,0.8)';
    ctx.beginPath();ctx.roundRect(x,y,88,86,8);ctx.fill();
    ctx.textAlign='center';
    ctx.font='bold 26px sans-serif';ctx.fillStyle=ok?'#f0ece0':'rgba(200,200,190,0.3)';
    ctx.fillText(i+1,x+44,y+38);
    ctx.font='11px sans-serif';
    ctx.fillText(L.type==='extract'?'突围':L.type==='boss'?'BOSS':'歼灭',x+44,y+58);
    ctx.font='12px sans-serif';ctx.fillText({extract:'🚁',boss:'☠️',waves:'🎯'}[L.type],x+44,y+78);
    if(ok)buttons.push({x,y,w:88,h:86,cb:()=>{state='loadout';stT=0;}});
  }
  button(RW/2-70,420,140,44,'返 回 (Esc)',()=>{state='title';});
}
function drawBrief(){
  updateCamera(0.016);
  veil(0.6);
  ctx.fillStyle='rgba(10,14,10,0.88)';
  ctx.strokeStyle='rgba(159,212,138,0.25)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.roundRect(RW/2-290,140,580,250,10);ctx.fill();ctx.stroke();
  ctx.textAlign='center';
  const L=LEVELS[level-1];
  ctx.font='bold 15px sans-serif';ctx.fillStyle='rgba(232,228,218,0.55)';
  ctx.fillText(`MISSION ${level} / ${LEVELS.length} · 地形：${BIOMES[biomeAt(player.x,player.z)].name}`,RW/2,184);
  ctx.font='bold 32px sans-serif';ctx.fillStyle='#e8c860';
  ctx.fillText(L.name,RW/2,226);
  ctx.font='14px sans-serif';ctx.fillStyle='#c9d6bc';
  const obj=L.type==='extract'?`击杀 ${extractQuota()} 名敌人 → 激活绿色信标 → 抵达光柱撤离`:
           L.type==='boss'?'击败敌方指挥官 · 小心冲锋与扇形弹幕':'歼灭所有波次的敌军';
  wrapText(obj,RW/2,266,520,24);
  ctx.font='11px sans-serif';ctx.fillStyle='rgba(232,228,218,0.45)';
  ctx.fillText('自由视角：点击锁定鼠标（或按住拖动/方向键） · E/左键 射击 · R 换枪 · 无限弹药 · Enter 进入战斗',RW/2,381);
  buttons=[];
  button(RW/2-95,318,190,46,'进 入 战 斗 (Enter)',()=>{state='play';stT=0;},'#3f7a2e');
}
function drawClear(){
  updateCamera(0.016);
  veil(0.28);
  ctx.textAlign='center';
  ctx.font='bold 42px sans-serif';
  ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillText('任务完成',RW/2+2,RH/2+2);
  ctx.fillStyle='#9fd48a';ctx.fillText('任务完成',RW/2,RH/2);
  ctx.font='13px sans-serif';ctx.fillStyle='rgba(232,228,218,0.8)';
  ctx.fillText(`击杀 ${kills} · 射出 ${shotsFired} 发 · +50 生命`,RW/2,RH/2+34);
}
function drawUpgrade(){
  updateCamera(0.016);
  veil(0.6);
  ctx.textAlign='center';
  ctx.font='bold 26px sans-serif';ctx.fillStyle='#e8c860';
  ctx.fillText('战 地 补 给',RW/2,100);
  ctx.font='12px sans-serif';ctx.fillStyle='rgba(232,228,218,0.55)';
  ctx.fillText('选择一项强化（点击或按 1 / 2 / 3）',RW/2,122);
  buttons=[];
  const cw=232,chh=248,gap=32,x0=RW/2-(3*cw+2*gap)/2,y=158;
  for(let i=0;i<upChoices.length;i++){
    const u=upChoices[i],x=x0+i*(cw+gap);
    const hov=mx>x&&mx<x+cw&&my>y&&my<y+chh;
    const cur=player.up[u.id]||0;
    ctx.fillStyle=hov?'rgba(63,122,46,0.95)':'rgba(12,16,10,0.94)';
    ctx.strokeStyle=hov?'#f4d98a':'rgba(200,190,160,0.2)';ctx.lineWidth=hov?3:2;
    ctx.beginPath();ctx.roundRect(x,y,cw,chh,12);ctx.fill();ctx.stroke();
    ctx.textAlign='center';
    ctx.font='48px sans-serif';ctx.fillText(u.e,x+cw/2,y+82);
    ctx.font='bold 20px sans-serif';ctx.fillStyle='#f0ece0';ctx.fillText(u.n,x+cw/2,y+126);
    ctx.font='12px sans-serif';ctx.fillStyle='rgba(232,228,218,0.78)';
    wrapText(u.d,x+cw/2,y+152,cw-32,18);
    ctx.font='11px sans-serif';ctx.fillStyle='#e8c860';
    ctx.fillText(cur>0?`已有 ${cur} / ${u.max}`:'新获得！',x+cw/2,y+chh-14);
    ctx.fillStyle='rgba(232,228,218,0.35)';ctx.fillText(`[${i+1}]`,x+cw/2,y+26);
    buttons.push({x,y,w:cw,h:chh,cb:()=>pickUpgrade(i)});
  }
}
function drawDead(){
  updateCamera(0.016);
  veil(0.66);
  ctx.textAlign='center';
  ctx.font='bold 50px sans-serif';
  ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillText('阵 亡',RW/2+2,RH/2-50+2);
  ctx.fillStyle='#d64545';ctx.fillText('阵 亡',RW/2,RH/2-50);
  ctx.font='13px sans-serif';ctx.fillStyle='rgba(232,228,218,0.8)';
  ctx.fillText(`倒在第 ${level} 关 · 击杀 ${kills} · 武器与强化保留`,RW/2,RH/2-8);
  buttons=[];
  button(RW/2-230,RH/2+42,215,50,'重整旗鼓 (Enter)',()=>retryLevel(),'#3f7a2e');
  button(RW/2+15,RH/2+42,215,50,'返回主菜单',()=>{state='title';});
}
function drawWin(){
  updateMenuCam(0.016);
  veil(0.4);
  ctx.textAlign='center';
  ctx.font='bold 44px sans-serif';
  ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillText('🏆 战 役 胜 利 🏆',RW/2+2,192);
  ctx.fillStyle='#e8c860';ctx.fillText('🏆 战 役 胜 利 🏆',RW/2,190);
  ctx.font='13px sans-serif';ctx.fillStyle='rgba(232,228,218,0.75)';
  ctx.fillText('敌军全线溃退 · 你穿越了整片大陆',RW/2,224);
  ctx.font='15px sans-serif';ctx.fillStyle='#f0ece0';
  ctx.fillText(`总击杀 ${kills} · 射出 ${shotsFired} 发 · 用时 ${Math.floor(tGame/60)} 分 ${Math.floor(tGame%60)} 秒`,RW/2,258);
  buttons=[];
  button(RW/2-115,330,230,50,'再 战 一 局',()=>{state='loadout';stT=0;},'#3f7a2e');
  button(RW/2-115,394,230,44,'返回主菜单',()=>{state='title';});
}
function drawPause(){
  updateCamera(0.016);
  veil(0.58);
  ctx.textAlign='center';
  ctx.font='bold 38px sans-serif';ctx.fillStyle='#f0ece0';
  ctx.fillText('暂 停',RW/2,RH/2-52);
  button(RW/2-80,RH/2-14,160,44,'▶ 继续游戏',()=>resumeGame(),'#5a7a3a');
  ctx.font='12px sans-serif';ctx.fillStyle='rgba(232,228,218,0.6)';
  ctx.fillText('P / Enter / 点按钮 继续 · M 音效 · E/左键 射击 · R/1-6 换枪',RW/2,RH/2+58);
  ctx.fillText('G 全屏开关 · 全屏中按 F = 一键收起游戏',RW/2,RH/2+80);
}
