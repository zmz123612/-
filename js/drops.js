"use strict";
/* ============ 福利包系统：空投补给 / 增益（回血·无敌·分身）/ 载具（坦克·直升机） ============ */

/* ---- 福利包定义 ---- */
const DROPS={
  heal:  {name:'医疗包', color:0x7fd47f, icon:'❤', weight:30, desc:'+80 生命'},
  invinc:{name:'无敌星', color:0xffd24a, icon:'★', weight:18, desc:'无敌 3 秒'},
  clone: {name:'分身器', color:0x7ecbff, icon:'👥', weight:22, desc:'召唤战友 60 秒'},
  tank:  {name:'坦克',   color:0x8a8a78, icon:'🚗', weight:15, desc:'按 T 乘坐坦克'},
  heli:  {name:'直升机', color:0x6a8ab0, icon:'✈', weight:15, desc:'按 T 乘坐直升机'},
};
let airdrops=[];         // 场景中的空投包
let dropTimer=14;        // 首个包 14 秒后到
let clones=[];           // 分身战友
let vehicle=null;        // 当前乘坐的载具 {kind:'tank'|'heli', ...}

/* ---- 空投生成（降落伞下落 → 落地待拾取） ---- */
function makeAirdrop(kind,x,z){
  const cfg=DROPS[kind];
  const g=new THREE.Group();
  // 箱体
  const box=new THREE.Mesh(new THREE.BoxGeometry(1.1,0.9,1.1),
    new THREE.MeshStandardMaterial({color:cfg.color,roughness:0.55,metalness:0.1,envMapIntensity:0.5}));
  box.castShadow=true;g.add(box);
  const lid=new THREE.Mesh(new THREE.BoxGeometry(1.16,0.16,1.16),
    new THREE.MeshStandardMaterial({color:0x3c3a30,roughness:0.6}));
  lid.position.y=0.52;g.add(lid);
  // 降落伞（下落时显示）
  const chute=new THREE.Mesh(new THREE.SphereGeometry(1.5,12,8,0,TAU,0,Math.PI*0.5),
    new THREE.MeshStandardMaterial({color:0xd8d2be,roughness:0.9,side:THREE.DoubleSide}));
  chute.position.y=2.2;g.add(chute);
  const lines=new THREE.Mesh(new THREE.ConeGeometry(1.45,2.2,8,1,true),
    new THREE.MeshBasicMaterial({color:0x666055,wireframe:true}));
  lines.position.y=1.2;g.add(lines);
  // 落地光柱 + 图标辉光
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,26,10,1,true),
    new THREE.MeshBasicMaterial({color:cfg.color,transparent:true,opacity:0.25,side:THREE.DoubleSide,depthWrite:false}));
  beam.position.y=13;g.add(beam);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex('rgba(255,255,255,1)',`rgba(${(cfg.color>>16&255)},${(cfg.color>>8&255)},${(cfg.color&255)},0)`),transparent:true,opacity:0.85,depthWrite:false}));
  glow.scale.set(2.4,2.4,1);glow.position.y=1.4;g.add(glow);
  const gy=terrainH(x,z);
  g.position.set(x,gy+30,z);
  scene.add(g);
  airdrops.push({kind,mesh:g,box,chute,beam,glow,x,z,y:gy+30,groundY:gy,falling:true,t:0,dead:false});
  addFeed(`📦 空投：${cfg.name}（${cfg.desc}）`, '#'+cfg.color.toString(16).padStart(6,'0'));
}
/* 周期性在玩家附近投包 */
function updateAirdropSpawner(dt){
  dropTimer-=dt;
  if(dropTimer<=0&&airdrops.length<3){
    dropTimer=rnd(22,34);
    // 加权随机
    const pool=[];
    for(const k in DROPS)pool.push(...Array(Math.round(DROPS[k].weight/2)).fill(k));
    const kind=pool[(Math.random()*pool.length)|0];
    for(let i=0;i<30;i++){
      const a=rnd(0,TAU),r=rnd(14,34);
      const x=player.x+Math.cos(a)*r,z=player.z+Math.sin(a)*r;
      if(terrainH(x,z)>WATER_Y+0.8){makeAirdrop(kind,x,z);break;}
    }
  }
  // 下落与拾取
  for(const d of airdrops){
    d.t+=dt;
    if(d.falling){
      d.y-=6.5*dt;
      if(d.y<=d.groundY){d.y=d.groundY;d.falling=false;d.chute.visible=false;d.mesh.children.forEach(c=>{if(c.geometry&&c.geometry.type==='ConeGeometry')c.visible=false;});}
      d.mesh.position.y=d.y;
    }else{
      d.mesh.position.y=d.groundY+Math.sin(d.t*2.4)*0.08;
      d.glow.material.rotation+=dt;
      // 拾取判定：走近 1.6m
      if(!player.vehicleKind&&dist2D(player.x,player.z,d.x,d.z)<1.9&&!d.falling){
        d.dead=true;scene.remove(d.mesh);
        applyDrop(d.kind);
      }
    }
  }
  airdrops=airdrops.filter(d=>!d.dead);
  updateClones(dt);
  updateVehicle(dt);
}
/* ---- 增益应用 ---- */
function applyDrop(kind){
  const p=player,cfg=DROPS[kind];
  sfx.pick();sfx.up();
  if(kind==='heal'){
    p.hp=Math.min(p.maxHp,p.hp+80);
    addFeed('❤ 医疗包：+80 生命','#9fd48a');
    popupMsg('❤ +80 生命');
  }else if(kind==='invinc'){
    p.iT=Math.max(p.iT,3);
    p.invincT=3;
    addFeed('★ 无敌星：无敌 3 秒','#ffd24a');
    popupMsg('★ 无敌 3 秒!');
  }else if(kind==='clone'){
    spawnClone();
    addFeed('👥 分身器：战友支援 60 秒','#7ecbff');
    popupMsg('👥 战友参战!');
  }else if(kind==='tank'){
    spawnVehicle('tank');
  }else if(kind==='heli'){
    spawnVehicle('heli');
  }
  for(let i=0;i<16;i++)spawnP(p.x,terrainH(p.x,p.z)+1,p.z,rnd(-3,3),rnd(0.5,3),rnd(-3,3),0.6,(cfg.color>>16&255)/255,(cfg.color>>8&255)/255,(cfg.color&255)/255);
}
/* ---- 分身战友：跟随玩家、自动索敌开火，60 秒 ---- */
function spawnClone(){
  const mdl=makeSoldier('b');
  // 蓝色涂装标识友军
  for(const m of mdl.mats)m.color=new THREE.Color(0x4a6a8a);
  scene.add(mdl.group);
  clones.push({mdl,x:player.x+1.2,z:player.z+0.8,hp:120,fireT:0,t:0,life:60,dead:false});
  addFloat3D(player.x,terrainH(player.x,player.z)+2.4,player.z,'战友参战!','#7ecbff',18);
}
function updateClones(dt){
  for(const c of clones){
    c.t+=dt;c.life-=dt;
    if(c.life<=0){c.dead=true;scene.remove(c.mdl.group);
      for(let i=0;i<10;i++)spawnP(c.x,terrainH(c.x,c.z)+1,c.z,rnd(-2,2),rnd(0.5,2.5),rnd(-2,2),0.5,0.5,0.8,1);continue;}
    // 跟随玩家（保持 2~3m 距离）
    const d=dist2D(c.x,c.z,player.x,player.z);
    if(d>2.6){
      const a=Math.atan2(player.z-c.z,player.x-c.x)+Math.sin(c.t*2)*0.3;
      c.x+=Math.cos(a)*5.5*dt;c.z+=Math.sin(a)*5.5*dt;
    }
    const ty=Math.max(terrainH(c.x,c.z),WATER_Y-1.05);   // 战友入水同样浮到水面
    c.mdl.group.position.set(c.x,lerp(c.mdl.group.position.y,ty,clamp(8*dt,0,1)),c.z);
    // 索敌开火（最近警戒敌人 35m 内）
    let tgt=null,bd=35;
    for(const e of enemies){
      if(e.dead)continue;
      const dd=dist2D(c.x,c.z,e.x,e.z);
      if(dd<bd&&losClear(c.x,ty+1.5,c.z,e.x,ty+1,e.z)){bd=dd;tgt=e;}
    }
    if(tgt){
      const face=Math.atan2(tgt.x-c.x,tgt.z-c.z);
      c.mdl.group.rotation.y=lerp(c.mdl.group.rotation.y,face+Math.PI,clamp(8*dt,0,1));
      c.fireT-=dt;
      if(c.fireT<=0){
        c.fireT=0.16;
        c.mdl.rifle.userData.flashT=0.05;
        sfx.eshot(0.6);
        const ey=terrainH(tgt.x,tgt.z)+1.1;
        spawnTracer({x:c.x,y:ty+1.35,z:c.z},{x:tgt.x,y:ey,z:tgt.z},0xaad4ff);
        damageEnemy(tgt,14,false);
      }
    }else{
      const face=Math.atan2(player.x-c.x,player.z-c.z);
      c.mdl.group.rotation.y=lerp(c.mdl.group.rotation.y,face+Math.PI,clamp(6*dt,0,1));
    }
    // 走路动画
    const sw=d>2.6?Math.sin(c.t*7)*0.5:0;
    c.mdl.legL.hip.rotation.x=sw;c.mdl.legR.hip.rotation.x=-sw;
    // 剩余时间提示
    if(c.life<10&&Math.floor(c.life*2)!==Math.floor((c.life+dt)*2))
      addFloat3D(c.x,ty+2.4,c.z,Math.ceil(c.life)+'s','rgba(126,203,255,0.7)',12);
    // 受击闪红
    const em=c.mdl.rifle.userData.flashT>0?0.35:0;
    for(const m of c.mdl.mats)m.emissive.setRGB(em,em*0.6,em*0.3);
    if(c.mdl.rifle.userData.flashT>0)c.mdl.rifle.userData.flashT-=dt;
    else c.mdl.rifle.userData.flash.scale.set(0.001,0.001,1);
  }
  clones=clones.filter(c=>!c.dead);
}
/* ---- 载具：坦克 / 直升机 ---- */
function spawnVehicle(kind){
  if(vehicle){scene.remove(vehicle.mesh);vehicle=null;}
  const g=new THREE.Group();
  const armor=()=>new THREE.MeshStandardMaterial({color:kind==='tank'?0x6a6a54:0x5a6a4c,roughness:0.6,metalness:0.35,envMapIntensity:0.6});
  const dark=()=>new THREE.MeshStandardMaterial({color:0x2e2e26,roughness:0.7,metalness:0.3});
  let muzzleRef=null,turretRef=null,rotorRef=null,tailRotorRef=null;
  let hiddenWhenRidden=[];   // 第一人称乘坐时隐藏的部件（车体/机身等大面遮挡物），下车恢复
  if(kind==='tank'){
    // 车体+履带+炮塔+炮管
    const hull=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.9,4.2),armor());
    hull.position.y=1.0;hull.castShadow=true;g.add(hull);
    const slope=new THREE.Mesh(new THREE.BoxGeometry(2.5,0.5,1.2),armor());
    slope.position.set(0,0.75,2.2);slope.rotation.x=-0.5;g.add(slope);
    for(const s of[-1,1]){
      const track=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.8,4.4),dark());
      track.position.set(s*1.45,0.5,0);track.castShadow=true;g.add(track);
      for(let i=0;i<5;i++){
        const wheel=new THREE.Mesh(new THREE.CylinderGeometry(0.36,0.36,0.74,10),dark());
        wheel.rotation.z=Math.PI/2;wheel.position.set(s*1.45,0.42,-1.7+i*0.85);g.add(wheel);
      }
    }
    const turret=new THREE.Group();turret.position.y=1.7;g.add(turret);
    const dome=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.7,2.0),armor());
    dome.castShadow=true;turret.add(dome);
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.16,3.2,10),dark());
    barrel.rotation.x=Math.PI/2;barrel.position.set(0,0.1,2.4);turret.add(barrel);
    const brake=new THREE.Mesh(new THREE.CylinderGeometry(0.19,0.19,0.5,10),dark());
    brake.rotation.x=Math.PI/2;brake.position.set(0,0.1,4.05);turret.add(brake);
    const hatch=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.32,0.16,10),dark());
    hatch.position.set(-0.4,0.42,-0.3);turret.add(hatch);
    muzzleRef=brake;turretRef=turret;
    // 第一人称驾驶时隐藏车体/履带/炮塔壳（近距大面遮挡视线），保留炮管作瞄准参照
    hiddenWhenRidden=[hull,slope,dome,hatch];
    g.children.forEach(c=>{if(c!==turret)hiddenWhenRidden.push(c);});   // 履带+负重轮（g 顶层除炮塔外全收）
  }else{
    // 机身+尾梁+旋翼+滑橇
    const bodyGeo=THREE.CapsuleGeometry?new THREE.CapsuleGeometry(0.9,2.2,6,10):new THREE.SphereGeometry(1.1,10,8);
    const body=new THREE.Mesh(bodyGeo,armor());
    body.rotation.x=Math.PI/2;body.scale.set(1,1,0.75);body.position.y=1.4;body.castShadow=true;g.add(body);
    const cockpit=new THREE.Mesh(new THREE.SphereGeometry(0.75,10,8),
      new THREE.MeshStandardMaterial({color:0x3a4a5c,roughness:0.2,metalness:0.5,envMapIntensity:0.9}));
    cockpit.position.set(0,1.55,1.5);cockpit.scale.set(0.9,0.8,1.1);g.add(cockpit);
    const tailBoom=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.28,3.4,8),armor());
    tailBoom.rotation.x=Math.PI/2;tailBoom.position.set(0,1.7,-2.8);g.add(tailBoom);
    const tailFin=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.9,0.7),armor());
    tailFin.position.set(0,2.1,-4.3);g.add(tailFin);
    const tailRotor=new THREE.Mesh(new THREE.BoxGeometry(0.08,1.6,0.16),dark());
    tailRotor.position.set(0.16,2.1,-4.3);g.add(tailRotor);
    tailRotorRef=tailRotor;
    const mast=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.5,8),dark());
    mast.position.set(0,2.6,0.3);g.add(mast);
    const rotor=new THREE.Group();rotor.position.set(0,2.85,0.3);g.add(rotor);
    for(let i=0;i<4;i++){
      const blade=new THREE.Mesh(new THREE.BoxGeometry(7.2,0.06,0.42),dark());
      blade.rotation.y=i*Math.PI/2;rotor.add(blade);
    }
    rotorRef=rotor;
    for(const s of[-1,1]){
      const skid=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,3.4,6),dark());
      skid.rotation.x=Math.PI/2;skid.position.set(s*0.9,0.15,0.2);g.add(skid);
      const strut=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.9,6),dark());
      strut.position.set(s*0.9,0.6,0.4);g.add(strut);
      const strut2=strut.clone();strut2.position.z=-0.8;g.add(strut2);
    }
    // 机炮吊舱
    const gun=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,1.1,8),dark());
    gun.rotation.x=Math.PI/2;gun.position.set(0.25,1.0,1.6);g.add(gun);
    muzzleRef=gun;
    // 第一人称乘坐：机身/座舱罩/旋翼/滑橇会包围相机（背面剔除产生"机身消失、旋翼分离悬浮"错觉），全部隐藏；
    // 保留尾梁/尾桨（回头看有机体延续感）与机炮吊舱（右下瞄准参照）
    g.children.forEach(c=>{if(c!==tailBoom&&c!==tailFin&&c!==tailRotor&&c!==gun)hiddenWhenRidden.push(c);});
  }
  // 光环标识
  const ring=new THREE.Mesh(new THREE.TorusGeometry(2.6,0.08,6,24),
    new THREE.MeshBasicMaterial({color:kind==='tank'?0xc9a23a:0x7ecbff,transparent:true,opacity:0.75}));
  ring.rotation.x=Math.PI/2;ring.position.y=0.15;g.add(ring);
  const x=player.x+Math.cos(player.yaw+Math.PI)*5,z=player.z+Math.sin(player.yaw+Math.PI)*5;
  g.position.set(x,terrainH(x,z),z);
  scene.add(g);
  vehicle={kind,mesh:g,x,z,hp:kind==='tank'?800:500,maxHp:kind==='tank'?800:500,
    yaw:player.yaw,turretYaw:0,alt:0,fireT:0,rotorSpin:0,dead:false,
    muzzleRef,turretRef,rotorRef,tailRotorRef,ring,hiddenWhenRidden};
  addFeed(`${kind==='tank'?'🚗 坦克':'✈ 直升机'} 已抵达 · 走近按 T 乘坐`,'#c9a23a');
  popupMsg(kind==='tank'?'🚗 坦克待命 · 按 T 乘坐':'✈ 直升机待命 · 按 T 乘坐');
}
/* 第一人称乘坐 ⇄ 第三人称待命：切换车体/机身部件可见性（防大面遮挡/背面剔除错觉） */
function setRiddenHidden(v,riding){
  if(v&&v.hiddenWhenRidden)for(const o of v.hiddenWhenRidden)o.visible=!riding;
}
/* 乘坐 / 离开 */
function tryToggleVehicle(){
  if(!vehicle)return;
  const p=player;
  if(p.vehicleKind){    // 下车：找侧向安全落点（避水/避坡），找不到再回退原方向
    p.vehicleKind=null;
    setRiddenHidden(vehicle,false);                    // 恢复整机可见（第三人称看待命载具）
    let ex=null;
    for(let i=0;i<8;i++){
      const a=vehicle.yaw+Math.PI/2+i*Math.PI/4;
      const x=vehicle.x+Math.cos(a)*3.2,z=vehicle.z+Math.sin(a)*3.2;
      if(terrainH(x,z)>WATER_Y+0.4){ex=[x,z];break;}
    }
    if(ex){p.x=ex[0];p.z=ex[1];}
    else{p.x=vehicle.x+Math.cos(vehicle.yaw+Math.PI/2)*3;p.z=vehicle.z+Math.sin(vehicle.yaw+Math.PI/2)*3;}
    p.flyZ=0;p.iT=1.2;
    vehicle.alt=0;
    addFeed('已离开载具','#e8e4da');
    sfx.sw();
    return;
  }
  if(dist2D(p.x,p.z,vehicle.x,vehicle.z)<5){
    p.vehicleKind=vehicle.kind;
    p.flyZ=0;
    setRiddenHidden(vehicle,true);                     // 隐藏车体/机身：第一人称座舱视野干净
    addFeed(vehicle.kind==='tank'?'🚗 驾驶坦克 · E开炮 · 行驶碾压敌军 / T下车':'✈ 驾驶直升机 · 自动升空 · E射击 / T下机','#f4d98a');
    popupMsg(vehicle.kind==='tank'?'🚗 坦克战!':'✈ 空中打击!');
    sfx.up();
  }
}
/* 载具更新：跟随驾驶 / 旋翼 / 悬浮 / AI 兜底待命动画 */
function updateVehicle(dt){
  if(!vehicle||vehicle.dead)return;
  const v=vehicle,p=player;
  v.fireT=Math.max(0,v.fireT-dt);                     // 武器冷却计时（此前漏减，导致坦克/直升机打一发就哑火）
  v.rotorSpin+=dt*(v.kind==='heli'?(p.vehicleKind==='heli'?22:6):0);
  if(v.rotorRef){v.rotorRef.rotation.y=v.rotorSpin;}
  if(v.tailRotorRef){v.tailRotorRef.rotation.x=v.rotorSpin*1.4;}
  if(p.vehicleKind===v.kind){
    // 载具跟随玩家输入：位置由玩家移动驱动
    const ox=v.x,oz=v.z;
    v.x=p.x;v.z=p.z;v.yaw=p.yaw;
    if(v.kind==='heli')v.alt=Math.min(12,v.alt+6*dt);      // 直线爬升到 12m
    else{
      v.alt=lerp(v.alt,0,clamp(2*dt,0,1));
      // 坦克碾压：行驶中履带范围内直接压垮（节流判定防每帧刷屏）
      v.crushT=Math.max(0,(v.crushT||0)-dt);
      const spd=Math.hypot(v.x-ox,v.z-oz)/Math.max(dt,1e-4);
      if(spd>0.6&&v.crushT<=0){v.crushT=0.15;tankCrush(v);}
    }
  }else{
    v.alt=Math.max(0,v.alt-5*dt);                            // 无人驾驶缓降
  }
  const gy=terrainH(v.x,v.z);
  v.mesh.position.set(v.x,gy+v.alt+ (v.kind==='heli'?Math.sin(tGlobal*2.2)*0.15:0),v.z);
  v.mesh.rotation.y=v.yaw+Math.PI;
  // 坦克车身随地形俯仰
  if(v.kind==='tank'){
    const ahead=terrainH(v.x-Math.sin(v.yaw)*2,v.z-Math.cos(v.yaw)*2);
    const back=terrainH(v.x+Math.sin(v.yaw)*2,v.z+Math.cos(v.yaw)*2);
    v.mesh.rotation.x=lerp(v.mesh.rotation.x,Math.atan2(back-ahead,4)*0.7,clamp(5*dt,0,1));
    // 炮塔朝玩家视线方向
    if(v.turretRef)v.turretRef.rotation.y=lerp(v.turretRef.rotation.y,angDiff(v.yaw+Math.PI,p.yaw+Math.PI),clamp(6*dt,0,1));
  }
  if(v.kind==='heli'&&p.vehicleKind!=='heli'){
    // 待命旋翼慢转
  }
  // 载具光环脉动
  v.ring.material.opacity=0.55+0.25*Math.sin(tGlobal*3);
}
/* 坦克碾压判定：车体履带椭圆范围内压垮敌人（普通秒杀 / BOSS 持续受创） */
function tankCrush(v){
  const s=Math.sin(v.yaw),c=Math.cos(v.yaw);
  let crushed=0;
  for(const e of enemies){
    if(e.dead)continue;
    const dx=e.x-v.x,dz=e.z-v.z;
    const lz=-(dx*s+dz*c);                    // 车体前后（车头为正，与 mesh 朝向一致）
    const lx=dz*s-dx*c;                       // 车体左右
    if((lx/1.85)**2+(lz/2.35)**2>=1)continue; // 履带覆盖范围（车宽2.6+履带 / 车长4.2）
    if(e.type==='boss')damageEnemy(e,45,false);
    else{damageEnemy(e,e.hp,false);crushed++;}
  }
  if(crushed>0){
    shake=Math.max(shake,0.4);                // 颠簸感
    addFeed(`🚗 碾压 ${crushed} 名敌军`,'#c9a23a');
  }
}
/* 载具武器：坦克主炮（爆炸弹） / 直升机机炮（速射） */
function vehicleFire(){
  const v=vehicle,p=player;
  if(!v||v.fireT>0)return;
  if(v.kind==='tank'){
    v.fireT=1.6;
    // 开火瞬间炮塔对齐视线再取炮口世界坐标：炮弹起点、弹道与准星三者一致
    if(v.turretRef)v.turretRef.rotation.y=angDiff(v.yaw+Math.PI,p.yaw+Math.PI);
    v.mesh.updateMatrixWorld(true);
    const mz=v.muzzleRef.getWorldPosition(new THREE.Vector3());
    // 炮口朝玩家视线：俯角用完整 pitch（此前 *0.5 导致上下瞄准偏离准星）
    const cp=Math.cos(p.pitch);
    const dir={x:-Math.sin(p.yaw)*cp,y:Math.sin(p.pitch),z:-Math.cos(p.yaw)*cp};
    const dl=Math.hypot(dir.x,dir.y,dir.z);dir.x/=dl;dir.y/=dl;dir.z/=dl;
    // 炮弹（发光球，直线飞行，命中/落地爆炸）
    const shell=new THREE.Mesh(new THREE.SphereGeometry(0.22,8,6),
      new THREE.MeshBasicMaterial({color:0xffb46a}));
    shell.position.copy(mz);scene.add(shell);
    rockets.push({mesh:shell,x:mz.x,y:mz.y,z:mz.z,vx:dir.x*38,vy:dir.y*38,vz:dir.z*38,t:0,dmg:260});
    v.muzzleRef.getWorldPosition; 
    for(let i=0;i<10;i++)spawnP(mz.x,mz.y,mz.z,rnd(-3,3),rnd(0,2),rnd(-3,3),0.35,1,0.7,0.4);
    shake=Math.max(shake,0.9);sfx.boom();
  }else{
    v.fireT=0.09;
    const mz=v.muzzleRef.getWorldPosition(new THREE.Vector3());
    // 机炮：朝准星方向速射；优先 12° 锥内敌人（含自动对地吸附）
    let dir={x:-Math.sin(p.yaw)*Math.cos(p.pitch),y:Math.sin(p.pitch),z:-Math.cos(p.yaw)*Math.cos(p.pitch)};
    // 准星射线从相机出发；机炮吊舱在相机前下方，把起点平移到炮口再瞄准同一点，避免视差
    const aimDist=60;
    const aim={x:camera.position.x+dir.x*aimDist,y:camera.position.y+dir.y*aimDist,z:camera.position.z+dir.z*aimDist};
    dir={x:aim.x-mz.x,y:aim.y-mz.y,z:aim.z-mz.z};
    let tgt=null,bestAng=0.24;                       // ~14° 锥（空对地更宽）
    const gunRng=80;
    for(const e of enemies){
      if(e.dead)continue;
      const tx=e.x-mz.x,ty=terrainH(e.x,e.z)+1.1-mz.y,tz=e.z-mz.z;
      const tl=Math.sqrt(tx*tx+ty*ty+tz*tz);
      if(tl>gunRng)continue;
      const dot=(tx*dir.x+ty*dir.y+tz*dir.z)/tl;
      const ang=Math.acos(Math.min(1,Math.max(-1,dot)));
      if(ang<bestAng&&losClear(mz.x,mz.y,mz.z,e.x,terrainH(e.x,e.z)+1.1,e.z)){bestAng=ang;tgt=e;}
    }
    if(tgt){
      const tx=tgt.x-mz.x,ty=terrainH(tgt.x,tgt.z)+1.1-mz.y,tz=tgt.z-mz.z;
      const tl=Math.sqrt(tx*tx+ty*ty+tz*tz);
      dir={x:lerp(dir.x,tx/tl,0.85),y:lerp(dir.y,ty/tl,0.85),z:lerp(dir.z,tz/tl,0.85)};
    }
    const dl=Math.hypot(dir.x,dir.y,dir.z);dir.x/=dl;dir.y/=dl;dir.z/=dl;
    spawnTracer({x:mz.x,y:mz.y,z:mz.z},{x:mz.x+dir.x*40,y:mz.y+dir.y*40,z:mz.z+dir.z*40},0xaad4ff);
    hitscan({x:mz.x,y:mz.y,z:mz.z},dir,{dmg:16,cd:0.1,rng:80,spread:0.012,pellets:1,pierce:1,falloff:0.3,rocket:false},p);
    for(let i=0;i<2;i++)spawnP(mz.x,mz.y,mz.z,rnd(-1,1),rnd(0,1),rnd(-1,1),0.15,1,0.85,0.5);
    sfx.smg();
  }
}
/* 敌人对载具的仇恨转移（乘坐时被打先扣载具血） */
function damageVehicle(dmg){
  const v=vehicle;
  if(!v||v.dead)return false;
  if(player.vehicleKind!==v.kind)return false;   // 未乘坐不吸伤
  v.hp-=dmg;
  v.mesh.children[0].material.emissive?.setRGB?.(0.3,0,0);
  setTimeout(()=>{if(v&&!v.dead)v.mesh.children[0].material.emissive?.setRGB?.(0,0,0);},90);
  addFeed(`载具耐久 ${Math.max(0,Math.round(v.hp))}`,'#e0a03c');
  if(v.hp<=0){
    v.dead=true;
    boomAt(v.x,terrainH(v.x,v.z)+1,v.z,0,8);
    scene.remove(v.mesh);
    if(player.vehicleKind===v.kind){     // 强制下车+自伤
      player.vehicleKind=null;player.flyZ=0;player.iT=1.5;
      hurtPlayer(30);
      addFeed('⚠ 载具被击毁!','#d64545');
    }
    vehicle=null;
  }
  return true;
}
/* 清场 */
function clearDropEnts(){
  for(const d of airdrops)scene.remove(d.mesh);
  airdrops=[];
  for(const c of clones)scene.remove(c.mdl.group);
  clones=[];
  if(vehicle){scene.remove(vehicle.mesh);vehicle=null;}
  player.vehicleKind=null;
}
