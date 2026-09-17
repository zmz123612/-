"use strict";
/* ============ 关卡：定义 / 生成 / 波次 / 突围信标 / 流程状态机 ============ */
const LEVELS=[
 {type:'waves',  name:'边境哨所',  waves:['b4','b5','b4g2']},
 {type:'waves',  name:'补给线巡逻',waves:['b4g1','b5g2','b4g4']},
 {type:'extract',name:'深敌后突围'},
 {type:'waves',  name:'高地争夺',  waves:['b5g2','g4b3','h1b5','g4b5']},
 {type:'boss',   name:'指挥官 · 铁鬃',v:1},
 {type:'extract',name:'夜色撤离'},
 {type:'waves',  name:'焦土推进',  waves:['h2b3','g4b4','h2g4','h2b6g2']},
 {type:'waves',  name:'要塞强攻',  waves:['b7g4','h3g4','b8g5','h3b6g3']},
 {type:'extract',name:'斩首撤离'},
 {type:'boss',   name:'军阀 · 铁鬃（狂暴）',v:2},
];
function parseWave(w){
  const out=[];const re=/([bgh])(\d+)/g;let m;
  while((m=re.exec(w)))out.push([m[1],+m[2]]);
  return out;
}
function extractQuota(){return 8+2*level;}
function clearLevelEnts(){
  for(const e of enemies)if(!e.dead)scene.remove(e.mdl.group);
  enemies=[];
  for(const c of corpses){scene.remove(c.mdl.group);scene.remove(c.blood);}
  corpses=[];
  for(const pk of pickups)scene.remove(pk.mesh);
  pickups=[];
  for(const r of rockets)scene.remove(r.mesh);
  rockets=[];
  for(const o of orbs)scene.remove(o.mesh);
  orbs=[];
  if(beacon){scene.remove(beacon.group);beacon=null;}
  clearDropEnts();
  dropTimer=14;
  floats.length=0;
}
/* 金角螺旋找陆地出生点：候选中选周边水域最少的（避免落在湖岸边） */
function nearestLandXZ(cx,cz){
  const waterRatio=(x,z)=>{
    let w=0,n=0;
    for(let dx=-24;dx<=24;dx+=6)for(let dz=-24;dz<=24;dz+=6){n++;if(terrainH(x+dx,z+dz)<WATER_Y)w++;}
    return w/n;
  };
  let best=null,bestR=1;
  for(let i=0;i<900;i++){
    const a=i*2.399963,r=3+3*Math.pow(i,0.6);
    const x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;
    if(terrainH(x,z)<=WATER_Y+1.5)continue;
    const wr=waterRatio(x,z);
    if(wr<bestR){bestR=wr;best=[x,z];if(wr===0)break;}
  }
  return best||[cx,cz];
}
/* 每关空投到 700m 外新战区 */
function relocate(){
  for(let i=0;i<30;i++){
    const a=rnd(0,TAU),r=650+rnd(0,250);
    const x=player.x+Math.cos(a)*r,z=player.z+Math.sin(a)*r;
    if(terrainH(x,z)>WATER_Y+1.5){player.x=x;player.z=z;return;}
  }
}
function setupLevel(first){
  clearLevelEnts();
  waveIdx=0;interT=0;addT=0;streakN=0;
  extractReady=false;extractT=0;
  if(!first)relocate();
  player.flyZ=0;player.switchT=0;player.iT=1.2;
  updateChunks(player.x,player.z,49);
  const L=LEVELS[level-1];
  if(L.type==='waves')waves=L.waves.slice();
  else if(L.type==='boss'){
    spawnAround('boss',30,42);
    sfx.boss();popupMsg('⚠ BOSS 出现');
  }
  grantGuns();
}
function spawnWave(){
  if(waveIdx>=waves.length)return;
  for(const[t,c]of parseWave(waves[waveIdx]))
    for(let i=0;i<c;i++)spawnAround(t,24,48);
  waveIdx++;
  popupMsg(`第 ${waveIdx} / ${waves.length} 波来袭`);
}
function makeBeacon(){
  const g=new THREE.Group();
  const pillar=new THREE.Mesh(new THREE.CylinderGeometry(1,1,60,12,1,true),
    new THREE.MeshBasicMaterial({color:0x50e050,transparent:true,opacity:0.3,side:THREE.DoubleSide,depthWrite:false}));
  pillar.position.y=30;g.add(pillar);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(3.4,0.25,8,32),
    new THREE.MeshBasicMaterial({color:0x50e050,transparent:true,opacity:0.8}));
  ring.rotation.x=Math.PI/2;ring.position.y=0.4;g.add(ring);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:texGlowGreen,transparent:true,depthWrite:false}));
  glow.scale.set(10,10,1);glow.position.y=2;g.add(glow);
  const a=rnd(0,TAU),r=110+rnd(0,40);
  let bx=player.x+Math.cos(a)*r,bz=player.z+Math.sin(a)*r;
  for(let i=0;i<20;i++){
    if(terrainH(bx,bz)>WATER_Y+0.8)break;
    bx=player.x+Math.cos(a+i)*r;bz=player.z+Math.sin(a+i)*r;
  }
  g.position.set(bx,terrainH(bx,bz),bz);
  scene.add(g);
  beacon={group:g,x:bx,z:bz};
}
function levelClear(){
  if(state!=='play')return;
  state='clear';clearT=0;sfx.clear();
  unlockedLv=Math.max(unlockedLv,Math.min(LEVELS.length,level+1));best=Math.max(best,level);
  localStorage.setItem('cw_unlocked',unlockedLv);localStorage.setItem('cw_best',best);
  if(document.exitPointerLock)document.exitPointerLock();
}
function die(){
  state='dead';stT=0;best=Math.max(best,level);localStorage.setItem('cw_best',best);
  shake=2;
  if(document.exitPointerLock)document.exitPointerLock();
}
function startRun(lv){
  level=lv;player=newPlayer(loadSel);kills=0;tGame=0;shotsFired=0;
  [player.x,player.z]=nearestLandXZ(8,8);   // 固定种子下 (8,8) 是湖底，螺旋找最近陆地出生
  setupLevel(true);
  state='brief';stT=0;sfx.up();
  if(document.exitPointerLock)document.exitPointerLock();
}
function retryLevel(){
  player.hp=player.maxHp;                    // 重试回满血（修复死后0血开局）
  player.shield=player.shieldMax;
  player.iT=1.5;
  setupLevel(false);state='brief';stT=0;
}
function nextLevel(){
  level++;player.hp=Math.min(player.maxHp,player.hp+50);
  setupLevel(false);state='brief';stT=0;
}
function rollUpgrades(){
  const pool=UPS.filter(u=>(player.up[u.id]||0)<u.max);
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  upChoices=pool.slice(0,3);
  while(upChoices.length<3)upChoices.push(HEAL_UP);
}
function pickUpgrade(i){
  const u=upChoices[i];if(!u)return;
  u.ap(player);player.up[u.id]=(player.up[u.id]||0)+1;
  sfx.up();nextLevel();
}
/* ---- 波次 / 突围 / BOSS 关卡节奏 ---- */
function updateWaves(dt){
  const L=LEVELS[level-1];
  if(L.type==='waves'){
    if(waveIdx<waves.length){
      if(enemies.length===0){interT+=dt;if(interT>1.2){interT=0;spawnWave();}}
    }else if(enemies.length===0)levelClear();
  }else if(L.type==='extract'){
    addT+=dt;
    const cap=extractReady?3+level:7;
    if(enemies.length<cap&&addT>(extractReady?5:4)){
      addT=0;
      spawnAround(Math.random()<0.6?'b':'g',26,45);
    }
    if(!extractReady&&kills>=extractQuota()){
      extractReady=true;makeBeacon();
      popupMsg('✅ 撤离信标已激活 · 前往绿色光柱');
      for(let i=0;i<3;i++)addFeed('🟢 撤离信标激活：跟随绿色光柱','#9fd48a');
    }
  }else if(L.type==='boss'){
    addT+=dt;
    if(addT>11&&enemies.filter(e=>e.type!=='boss').length<4){addT=0;spawnAround('b',26,40);}
  }
}
