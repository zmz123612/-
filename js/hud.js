"use strict";
/* ============ HUD：准星 / 状态条 / 雷达 / 撤离指示 / 击杀流 / 浮动伤害 ============ */
const radarMap=document.createElement('canvas');radarMap.width=radarMap.height=72;
const radarCtx=radarMap.getContext('2d');
function refreshRadar(){
  if(!player)return;
  const n=72,cell=1.6;   // 覆盖 ±57m
  const img=radarCtx.createImageData(n,n);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const wx=player.x+(i-n/2)*cell,wz=player.z+(j-n/2)*cell;
    const h=terrainH(wx,wz);
    let c;
    if(h<WATER_Y)c=[38,74,110];
    else c=groundColor(wx,wz,h).map(v=>Math.round(v*200));
    const o=(j*n+i)*4;
    img.data[o]=c[0];img.data[o+1]=c[1];img.data[o+2]=c[2];img.data[o+3]=235;
  }
  radarCtx.putImageData(img,0,0);
}
function drawRadar(){
  const R=62,cx2=84,cy2=84;
  ctx.save();
  ctx.beginPath();ctx.arc(cx2,cy2,R,0,TAU);ctx.clip();
  ctx.fillStyle='#0a0e0a';ctx.fillRect(cx2-R,cy2-R,R*2,R*2);
  ctx.save();
  ctx.translate(cx2,cy2);
  ctx.rotate(-player.yaw+Math.PI);
  ctx.drawImage(radarMap,-R,-R,R*2,R*2);
  ctx.restore();
  const scale=R/57;
  const rot=player.yaw;
  const blip=(wx,wz,color,size)=>{
    const dx=wx-player.x,dz=wz-player.z;
    const d=Math.hypot(dx,dz);
    if(d>57)return;
    const rx2=dx*Math.cos(rot)-dz*Math.sin(rot);
    const ry2=dx*Math.sin(rot)+dz*Math.cos(rot);
    ctx.fillStyle=color;
    ctx.globalAlpha=d>48?0.4:1;
    ctx.beginPath();ctx.arc(cx2-rx2*scale,cy2+ry2*scale,size,0,TAU);ctx.fill();
    ctx.globalAlpha=1;
  };
  for(const e of enemies)if(!e.dead)blip(e.x,e.z,e.type==='boss'?'#ff5030':(e.alert?(tGlobal%0.8<0.5?'#ff5030':'#ff8a70'):'rgba(232,200,96,0.75)'),e.type==='boss'?4:2.4);
  if(beacon&&extractReady)blip(beacon.x,beacon.z,'#7dff7d',4);
  for(const pk of pickups)blip(pk.x,pk.z,'rgba(120,255,140,0.9)',2);
  ctx.restore();
  ctx.strokeStyle='rgba(159,212,138,0.4)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(cx2,cy2,R,0,TAU);ctx.stroke();
  ctx.fillStyle='#f0ece0';
  ctx.beginPath();
  ctx.moveTo(cx2,cy2-7);ctx.lineTo(cx2-5,cy2+5);ctx.lineTo(cx2,cy2+2);ctx.lineTo(cx2+5,cy2+5);
  ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(159,212,138,0.7)';ctx.font='9px sans-serif';ctx.textAlign='center';
  ctx.fillText('RADAR',cx2,cy2+R+11);
}
function drawHUD(){
  const p=player,G=GUNS[p.gun];
  // 准星（锁敌变红 / 后座扩张）
  const cx=RW/2,cy=RH/2;
  const gap=7+p.recoil*22;
  const col=curTarget?'rgba(255,80,60,0.95)':'rgba(240,240,235,0.9)';
  ctx.strokeStyle=col;ctx.lineWidth=2;
  for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
    ctx.beginPath();
    ctx.moveTo(cx+dx*gap,cy+dy*gap);
    ctx.lineTo(cx+dx*(gap+9),cy+dy*(gap+9));
    ctx.stroke();
  }
  ctx.fillStyle=col;ctx.fillRect(cx-1.5,cy-1.5,3,3);
  if(hitMark>0){
    ctx.strokeStyle=hitCrit?'rgba(255,210,74,0.95)':'rgba(255,255,255,0.9)';
    ctx.lineWidth=2.4;
    for(const[sx,sy]of[[1,1],[-1,1],[1,-1],[-1,-1]]){
      ctx.beginPath();ctx.moveTo(cx+sx*6,cy+sy*6);ctx.lineTo(cx+sx*13,cy+sy*13);ctx.stroke();
    }
  }
  // 左下：生命 / 护甲 / 燃料
  ctx.fillStyle='rgba(8,10,8,0.6)';ctx.beginPath();ctx.roundRect(16,RH-84,250,66,6);ctx.fill();
  ctx.textAlign='left';ctx.font='bold 12px sans-serif';
  ctx.fillStyle='#2c1c18';ctx.fillRect(46,RH-72,204,13);
  const hr=clamp(p.hp/p.maxHp,0,1);
  ctx.fillStyle=hr>0.35?'#7fae5a':'#d64545';ctx.fillRect(46,RH-72,204*hr,13);
  ctx.fillStyle='#e8e4da';ctx.fillText(`❤ ${Math.ceil(p.hp)} / ${p.maxHp}`,48,RH-60);
  if(p.shieldMax>0)for(let i=0;i<p.shieldMax;i++){
    ctx.font='13px sans-serif';
    ctx.fillStyle=i<p.shield?'#a8b6c2':'rgba(168,182,194,0.25)';
    ctx.fillText('▣',150+i*20,RH-60);
  }
  if(p.jet){
    ctx.fillStyle='#3a3428';ctx.fillRect(46,RH-44,204,8);
    ctx.fillStyle=p.fuel>0?'#e0913c':'#5c4a30';
    ctx.fillRect(46,RH-44,204*(p.fuel/p.fuelMax||0),8);
    ctx.fillStyle='rgba(240,238,228,0.95)';ctx.font='bold 10px sans-serif';
    ctx.fillText('JET 燃料 (SPACE)',46,RH-47);
  }
  // 右下：武器（无限弹药）
  ctx.fillStyle='rgba(8,10,8,0.6)';ctx.beginPath();ctx.roundRect(RW-236,RH-84,220,66,6);ctx.fill();
  ctx.textAlign='right';
  ctx.font='bold 14px sans-serif';ctx.fillStyle='#c9a23a';
  ctx.fillText(`${G.name} · ${G.cn}`,RW-26,RH-58);
  ctx.font='bold 30px sans-serif';ctx.fillStyle='#f0ece0';
  ctx.fillText('∞',RW-72,RH-26);
  ctx.font='bold 13px sans-serif';ctx.fillStyle='rgba(245,243,235,0.9)';
  ctx.fillText('无限弹药',RW-26,RH-26);
  ctx.font='bold 11px sans-serif';ctx.fillStyle='rgba(245,243,235,0.85)';
  ctx.fillText((G.auto?'按住 E/左键 连发':'点按 E/左键 发射')+' · R 换枪 · F 小化',RW-26,RH-86);
  // 顶部中间：任务与地貌
  ctx.textAlign='center';
  ctx.font='bold 15px sans-serif';ctx.fillStyle='#e8e4da';
  const L=LEVELS[level-1];
  ctx.fillText(`第 ${level} 关 · ${L.name}`,RW/2,24);
  ctx.font='bold 12px sans-serif';
  {
    const bk=biomeAt(p.x,p.z);
    let obj='';
    if(L.type==='waves'){
      const left=enemies.length+waves.slice(waveIdx).reduce((s,w)=>s+parseWave(w).reduce((a,c)=>a+c[1],0),0);
      obj=`歼灭敌军 · 剩余 ${left}${waveIdx>0?` · 第 ${waveIdx}/${waves.length} 波`:''}`;
    }else if(L.type==='extract'){
      obj=!extractReady?`再击杀 ${extractQuota()-kills} 人激活信标`:
        beacon?(extractT>0?`撤离中 ${extractT.toFixed(1)}s`:`前往绿色光柱 · ${Math.round(dist2D(p.x,p.z,beacon.x,beacon.z))}m`):'';
    }
    const line=`${obj} ｜ 地形：${BIOMES[bk].name} · 坐标 ${Math.round(p.x)},${Math.round(p.z)}`;
    ctx.lineWidth=2.5;ctx.strokeStyle='rgba(0,0,0,0.75)';
    ctx.strokeText(line,RW/2,42);
    ctx.fillStyle='rgba(240,238,228,0.95)';
    ctx.fillText(line,RW/2,42);
  }
  // BOSS 血条
  const boss=enemies.find(e=>e.type==='boss');
  if(boss){
    const bw=430,bx=RW/2-bw/2,by=56;
    ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(bx-3,by-3,bw+6,17);
    ctx.fillStyle='#4a1c16';ctx.fillRect(bx,by,bw,11);
    ctx.fillStyle=boss.phase===2?'#e0743c':'#c0392b';
    ctx.fillRect(bx,by,bw*clamp(boss.hp/boss.maxHp,0,1),11);
    ctx.fillStyle='#fff';ctx.font='bold 10px sans-serif';
    ctx.fillText('☠ '+L.name+(boss.phase===2?' 【狂暴】':''),RW/2,by+9);
  }
  // 击杀信息流
  ctx.textAlign='right';ctx.font='12px sans-serif';
  killFeed.forEach((k,i)=>{
    ctx.globalAlpha=clamp(1-(k.t-3)/1,0,1);
    ctx.fillStyle='rgba(8,10,8,0.5)';
    const w2=ctx.measureText(k.txt).width+16;
    ctx.beginPath();ctx.roundRect(RW-16-w2,54+i*22,w2,19,4);ctx.fill();
    ctx.fillStyle=k.color;ctx.fillText(k.txt,RW-24,67+i*22);
  });
  ctx.globalAlpha=1;
  drawRadar();
  // 撤离方向指示
  if(beacon&&extractReady){
    const s=projectToScreen(beacon.x,terrainH(beacon.x,beacon.z)+2,beacon.z);
    if(s&&s.x>30&&s.x<RW-30&&s.y>60&&s.y<RH-90){
      ctx.fillStyle='rgba(120,255,120,0.9)';
      ctx.font='bold 13px sans-serif';ctx.textAlign='center';
      ctx.fillText('▼ 撤离点',s.x,s.y-14);
    }else{
      const ang=Math.atan2(beacon.x-p.x,-(beacon.z-p.z));
      const rel=angDiff(p.yaw,ang);
      ctx.save();ctx.translate(clamp(RW/2-Math.sin(rel)*380,30,RW-30),70);ctx.rotate(-rel);
      ctx.fillStyle='rgba(120,255,120,0.85)';
      ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-8,-8);ctx.lineTo(-8,8);ctx.closePath();ctx.fill();
      ctx.restore();
      ctx.fillStyle='rgba(120,255,120,0.8)';ctx.font='bold 11px sans-serif';ctx.textAlign='center';
      ctx.fillText(`${Math.round(dist2D(p.x,p.z,beacon.x,beacon.z))}m`,clamp(RW/2-Math.sin(rel)*380,30,RW-30),98);
    }
  }
  // 连杀 / 提示
  if(popupT>0){
    ctx.textAlign='center';ctx.font='bold 26px sans-serif';
    ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillText(popupText,RW/2+2,RH*0.28+2);
    ctx.fillStyle='#f4d98a';ctx.fillText(popupText,RW/2,RH*0.28);
  }
  ctx.textAlign='right';ctx.font='bold 11px sans-serif';
  ctx.lineWidth=2.5;ctx.strokeStyle='rgba(0,0,0,0.7)';
  ctx.strokeText(`击杀 ${kills}`,RW-16,36);
  ctx.fillStyle='rgba(232,228,218,0.92)';
  ctx.fillText(`击杀 ${kills}`,RW-16,36);
  // 操作提示（前期）
  if(!locked&&tGame<25){
    ctx.textAlign='center';ctx.font='bold 14px sans-serif';
    const a=0.75+0.25*Math.sin(tGlobal*4);
    ctx.lineWidth=3;ctx.strokeStyle=`rgba(0,0,0,${0.8*a})`;
    ctx.strokeText('点击画面锁定鼠标自由视角 · E/左键 射击 · R 换枪（无限弹药）',RW/2,RH-100);
    ctx.fillStyle=`rgba(250,225,150,${a})`;
    ctx.fillText('点击画面锁定鼠标自由视角 · E/左键 射击 · R 换枪（无限弹药）',RW/2,RH-100);
  }
  // 受击红屏 + 方向指示
  if(vigHit>0){
    const g2=ctx.createRadialGradient(RW/2,RH/2,RH*0.3,RW/2,RH/2,RH*0.8);
    g2.addColorStop(0,'rgba(150,10,0,0)');g2.addColorStop(1,`rgba(150,10,0,${vigHit*0.7})`);
    ctx.fillStyle=g2;ctx.fillRect(0,0,RW,RH);
    if(vigDir){
      ctx.save();ctx.translate(RW/2,RH/2);ctx.rotate(vigDir-p.yaw+Math.PI);
      ctx.strokeStyle=`rgba(255,60,40,${vigHit})`;ctx.lineWidth=5;
      ctx.beginPath();ctx.arc(0,0,90,-0.5,0.5);ctx.stroke();ctx.restore();
    }
  }
  // 低血量脉冲
  if(p.hp<p.maxHp*0.28){
    const pulse=0.12+0.1*Math.sin(tGlobal*6);
    const g2=ctx.createRadialGradient(RW/2,RH/2,RH*0.25,RW/2,RH/2,RH*0.75);
    g2.addColorStop(0,'rgba(120,0,0,0)');g2.addColorStop(1,`rgba(120,0,0,${pulse})`);
    ctx.fillStyle=g2;ctx.fillRect(0,0,RW,RH);
  }
  // 敌人血条 + 状态标记（受击后短暂显示 / 警戒常显）
  for(const e of enemies){
    if(e.dead)continue;
    const engaged=e.alert||e.type==='boss';
    const showBar=e.type==='boss'||engaged&&(tGlobal-e.lastHitT<4||dist2D(e.x,e.z,player.x,player.z)<e.detectR+6);
    const s=projectToScreen(e.x,terrainH(e.x,e.z)+2.3*e.mdl.group.scale.x,e.z);
    // 头顶状态标记：警戒红❗ / 未发现黄❓（限中近距离，避免满屏标记）
    if(s&&s.x>-40&&s.x<RW+40&&s.y>40&&s.y<RH-40){
      const d2=dist2D(e.x,e.z,player.x,player.z);
      if(d2<75){
        ctx.textAlign='center';ctx.font='bold 17px sans-serif';
        ctx.fillStyle='rgba(0,0,0,0.5)';
        ctx.fillText(engaged?'❗':'❓',s.x+1,s.y-11);
        ctx.fillStyle=engaged?'#ff5040':'#e8c860';
        ctx.fillText(engaged?'❗':'❓',s.x,s.y-12);
      }
    }
    if(!showBar)continue;
    if(!s||s.x<0||s.x>RW||s.y<0||s.y>RH)continue;
    const bw2=e.type==='boss'?60:34;
    ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(s.x-bw2/2,s.y-6,bw2,4);
    ctx.fillStyle=e.hp/e.maxHp>0.35?'#c9a23a':'#d64545';
    ctx.fillRect(s.x-bw2/2,s.y-6,bw2*clamp(e.hp/e.maxHp,0,1),4);
  }
  // 屏幕边缘箭头：警戒中的敌人不在屏内时指示方向（最多3个最近）
  {
    const edge=[];
    for(const e of enemies){
      if(e.dead||!e.alert)continue;
      const d2=dist2D(e.x,e.z,player.x,player.z);
      if(d2>70)continue;
      const s=projectToScreen(e.x,terrainH(e.x,e.z)+1.2,e.z);
      if(s&&s.x>50&&s.x<RW-50&&s.y>50&&s.y<RH-50)continue;   // 在屏内
      edge.push({e,d2});
    }
    edge.sort((a,b)=>a.d2-b.d2);
    for(let i=0;i<Math.min(3,edge.length);i++){
      const e=edge[i].e;
      const ang=Math.atan2(e.x-player.x,-(e.z-player.z));
      const rel=angDiff(player.yaw,ang);
      const ex=clamp(RW/2-Math.sin(rel)*(RW/2-46),46,RW-46);
      const ey=RH/2-Math.cos(rel)*(RH/2-46);
      ctx.save();ctx.translate(ex,ey);ctx.rotate(-rel);
      ctx.fillStyle='rgba(255,80,60,0.9)';
      ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(-7,-8);ctx.lineTo(-7,8);ctx.closePath();ctx.fill();
      ctx.restore();
      ctx.fillStyle='rgba(255,120,100,0.8)';ctx.font='bold 10px sans-serif';ctx.textAlign='center';
      ctx.fillText(Math.round(edge[i].d2)+'m',ex,ey+22);
    }
  }
  // 载具血条与乘坐提示
  if(vehicle){
    const v=vehicle;
    ctx.fillStyle='rgba(8,10,8,0.6)';ctx.beginPath();ctx.roundRect(RW/2-110,64,220,26,6);ctx.fill();
    ctx.fillStyle='#2c2418';ctx.fillRect(RW/2-102,70,204,9);
    ctx.fillStyle=v.hp/v.maxHp>0.35?(v.kind==='tank'?'#c9a23a':'#7ecbff'):'#d64545';
    ctx.fillRect(RW/2-102,70,204*clamp(v.hp/v.maxHp,0,1),9);
    ctx.textAlign='center';ctx.font='bold 11px sans-serif';ctx.fillStyle='#f0ece0';
    ctx.fillText(`${v.kind==='tank'?'🚗 坦克':'✈ 直升机'} 耐久 ${Math.max(0,Math.round(v.hp))}${p.vehicleKind?' · E '+(v.kind==='tank'?'开炮':'射击')+' · T 下车':' · 走近按 T 乘坐'}`,RW/2,86);
  }
  if(p.invincT>0){
    ctx.textAlign='center';ctx.font='bold 20px sans-serif';
    ctx.fillStyle=`rgba(255,210,74,${0.6+0.4*Math.sin(tGlobal*8)})`;
    ctx.fillText(`★ 无敌 ${p.invincT.toFixed(1)}s`,RW/2,RH*0.36);
  }
  // 游泳提示：水色滤镜 + 状态文字（不会溺水，游向岸边即可）
  if(terrainH(p.x,p.z)<WATER_Y+0.3){
    const g3=ctx.createRadialGradient(RW/2,RH/2,RH*0.3,RW/2,RH/2,RH*0.8);
    g3.addColorStop(0,'rgba(30,80,140,0)');
    g3.addColorStop(1,'rgba(30,80,140,0.25)');
    ctx.fillStyle=g3;ctx.fillRect(0,0,RW,RH);
    ctx.textAlign='center';ctx.font='bold 14px sans-serif';
    ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,0.85)';
    ctx.strokeText('🏊 游泳中 · 不会溺水 · 游向岸边即可',RW/2,RH-116);
    ctx.fillStyle='#bfe3ff';
    ctx.fillText('🏊 游泳中 · 不会溺水 · 游向岸边即可',RW/2,RH-116);
  }
  // 浮动伤害数字
  ctx.textAlign='center';
  for(const f of floats){
    const s=projectToScreen(f.x,f.y,f.z);
    if(!s)continue;
    ctx.globalAlpha=clamp(1-(f.t-0.5)/0.4,0,1);
    ctx.font=`bold ${f.size}px sans-serif`;
    ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillText(f.txt,s.x+1,s.y+1);
    ctx.fillStyle=f.color;ctx.fillText(f.txt,s.x,s.y);
  }
  ctx.globalAlpha=1;
}
