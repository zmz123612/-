"use strict";
/* ============ 3D 模型：写实士兵 / 真枪模型 / 尸体贴花 ============ */

/* ================= 程序纹理工厂 ================= */
/* 数码迷彩贴图（4 色块马赛克，军装质感） */
function camoTexture(base,cols){
  const c=document.createElement('canvas');c.width=c.height=64;
  const g=c.getContext('2d');
  g.fillStyle=base;g.fillRect(0,0,64,64);
  const rng=mulberry(cols.length*997+13);
  const px=4;
  for(let y=0;y<64;y+=px)for(let x=0;x<64;x+=px){
    if(rng()<0.42){
      g.fillStyle=cols[(rng()*cols.length)|0];
      g.fillRect(x,y,px,px);
    }
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.magFilter=THREE.NearestFilter;
  return t;
}
/* 脸部贴图（眉/眼/鼻/嘴/下颌阴影） */
function faceTexture(){
  const c=document.createElement('canvas');c.width=64;c.height=64;
  const g=c.getContext('2d');
  g.fillStyle='#c9a57e';g.fillRect(0,0,64,64);
  const sh=g.createLinearGradient(0,0,0,64);
  sh.addColorStop(0,'rgba(0,0,0,0)');sh.addColorStop(1,'rgba(60,30,10,0.25)');
  g.fillStyle=sh;g.fillRect(0,0,64,64);
  g.fillStyle='#fff';
  g.beginPath();g.ellipse(20,26,5,3.4,0,0,TAU);g.fill();
  g.beginPath();g.ellipse(44,26,5,3.4,0,0,TAU);g.fill();
  g.fillStyle='#2a1e12';
  g.beginPath();g.arc(21,26,2.1,0,TAU);g.fill();
  g.beginPath();g.arc(43,26,2.1,0,TAU);g.fill();
  g.strokeStyle='#3a2a18';g.lineWidth=2.4;
  g.beginPath();g.moveTo(14,19);g.lineTo(26,21);g.stroke();
  g.beginPath();g.moveTo(50,19);g.lineTo(38,21);g.stroke();
  g.strokeStyle='rgba(80,45,20,0.55)';g.lineWidth=1.6;
  g.beginPath();g.moveTo(32,30);g.lineTo(31,38);g.stroke();
  g.strokeStyle='#7a4a3a';g.lineWidth=2.2;
  g.beginPath();g.moveTo(26,45);g.quadraticCurveTo(32,47.5,38,45);g.stroke();
  return new THREE.CanvasTexture(c);
}
/* 木纹贴图（枪托/护木：纵向条纹+节疤） */
function woodTexture(){
  const c=document.createElement('canvas');c.width=64;c.height=64;
  const g=c.getContext('2d');
  g.fillStyle='#6a4a28';g.fillRect(0,0,64,64);
  const rng=mulberry(555);
  for(let i=0;i<26;i++){
    const y=rng()*64;
    g.strokeStyle=`rgba(${40+rng()*50|0},${26+rng()*30|0},12,${0.25+rng()*0.4})`;
    g.lineWidth=0.6+rng()*1.8;
    g.beginPath();g.moveTo(0,y);
    for(let x=0;x<=64;x+=8)g.lineTo(x,y+Math.sin(x*0.15+i)*2.2);
    g.stroke();
  }
  for(let i=0;i<4;i++){                     // 节疤
    const x=rng()*64,y=rng()*64;
    const gr=g.createRadialGradient(x,y,1,x,y,4+rng()*3);
    gr.addColorStop(0,'rgba(30,18,8,0.8)');gr.addColorStop(1,'rgba(30,18,8,0)');
    g.fillStyle=gr;g.beginPath();g.arc(x,y,7,0,TAU);g.fill();
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
}
/* 金属磨砂贴图（枪身：细拉丝+划痕） */
function metalTexture(){
  const c=document.createElement('canvas');c.width=64;c.height=64;
  const g=c.getContext('2d');
  g.fillStyle='#3a3d36';g.fillRect(0,0,64,64);
  const rng=mulberry(777);
  for(let i=0;i<200;i++){                   // 磨砂颗粒
    const v=45+rng()*40|0;
    g.fillStyle=`rgba(${v},${v+3},${v-2},${0.3+rng()*0.4})`;
    g.fillRect(rng()*64,rng()*64,1,1);
  }
  for(let i=0;i<9;i++){                     // 使用划痕
    g.strokeStyle=`rgba(120,124,112,${0.14+rng()*0.2})`;
    g.lineWidth=0.6;
    const y=rng()*64;
    g.beginPath();g.moveTo(rng()*30,y);g.lineTo(34+rng()*30,y+rng()*4-2);g.stroke();
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
}
const CAMO={
  b:camoTexture('#6d6047',['#5a5138','#7c7250','#4c4a34']),
  g:camoTexture('#4e5a48',['#3e4a3a','#5c6850','#39422f']),
  h:camoTexture('#5c5240',['#4a4232','#6a5f46','#3e3a2a']),
  boss:camoTexture('#4c2a20',['#3a2018','#5e3626','#301a12']),
};
const FACE_TEX=faceTexture();
const WOOD_TEX=woodTexture();
const METAL_TEX=metalTexture();

/* ================= 材质与几何工具 ================= */
const M={
  cloth:c=>new THREE.MeshStandardMaterial({map:CAMO[c],roughness:0.94,metalness:0,envMapIntensity:0.28}),
  clothDark:c=>new THREE.MeshStandardMaterial({map:CAMO[c],color:0x8a8a8a,roughness:0.92,envMapIntensity:0.25}),
  vest:c=>new THREE.MeshStandardMaterial({map:CAMO[c],color:0x777777,roughness:0.85,envMapIntensity:0.3}),
  helm:c=>new THREE.MeshStandardMaterial({color:{b:0x4c483a,g:0x3a4034,h:0x443e30,boss:0x2e1c14}[c],roughness:0.55,metalness:0.3,envMapIntensity:0.55}),
  face:()=>new THREE.MeshStandardMaterial({map:FACE_TEX,roughness:0.65,envMapIntensity:0.35}),
  skin:()=>new THREE.MeshStandardMaterial({color:0xc9a57e,roughness:0.7,envMapIntensity:0.35}),
  dark:()=>new THREE.MeshStandardMaterial({color:0x241f16,roughness:0.8,metalness:0.05,envMapIntensity:0.35}),
  gun:()=>new THREE.MeshStandardMaterial({map:METAL_TEX,roughness:0.42,metalness:0.62,envMapIntensity:0.75}),
  wood:()=>new THREE.MeshStandardMaterial({map:WOOD_TEX,roughness:0.7,metalness:0,envMapIntensity:0.5}),
  band:()=>new THREE.MeshStandardMaterial({color:0xb03028,roughness:0.7,envMapIntensity:0.4}),
};
/* 胶囊体（r128 无 CapsuleGeometry：圆柱+两半球） */
function capsuleMesh(r,len,mat,seg=8){
  const g=new THREE.Group();
  const cyl=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,seg),mat);
  g.add(cyl);
  const top=new THREE.Mesh(new THREE.SphereGeometry(r,seg,6),mat);
  top.position.y=len/2;g.add(top);
  const bot=new THREE.Mesh(new THREE.SphereGeometry(r,seg,6),mat);
  bot.position.y=-len/2;g.add(bot);
  return g;
}

/* ================= 真实步枪模型（第三人称手持，AK 轮廓） =================
   结构：枪管 / 导气管 / 准星柱 / 机匣 / 拉机柄 / 弹匣（前倾弧） / 握把 / 木护木 / 枪托
   全长 ~0.85m，比例按真 AK-47 */
function buildRifle(){
  const r=new THREE.Group();
  const gun=M.gun(),wood=M.wood();
  const add=(geo,mat,x,y,z,rx=0,ry=0,rz=0,parent=r)=>{
    const m=new THREE.Mesh(geo,mat);
    m.position.set(x,y,z);m.rotation.set(rx,ry,rz);
    parent.add(m);return m;
  };
  // 枪管（细长，前端）
  add(new THREE.CylinderGeometry(0.012,0.012,0.30,8),gun,0,0.02,-0.42,Math.PI/2);
  // 枪口消焰器（阶梯圆柱）
  add(new THREE.CylinderGeometry(0.017,0.017,0.045,8),gun,0,0.02,-0.585,Math.PI/2);
  // 导气管（枪管上方，AK 特征）
  add(new THREE.CylinderGeometry(0.009,0.009,0.22,6),gun,0,0.055,-0.38,Math.PI/2);
  // 导气箍
  add(new THREE.BoxGeometry(0.02,0.03,0.035),gun,0,0.045,-0.31);
  // 准星柱 + 护耳
  add(new THREE.CylinderGeometry(0.006,0.006,0.05,6),gun,0,0.055,-0.55);
  add(new THREE.BoxGeometry(0.02,0.016,0.008),gun,-0.011,0.075,-0.55);
  add(new THREE.BoxGeometry(0.02,0.016,0.008),gun,0.011,0.075,-0.55);
  // 机匣（主体）
  add(new THREE.BoxGeometry(0.042,0.062,0.24),gun,0,0.025,-0.18);
  // 机匣盖（略高一线）
  add(new THREE.BoxGeometry(0.04,0.016,0.22),gun,0,0.062,-0.18);
  // 拉机柄（右侧突出）
  add(new THREE.BoxGeometry(0.014,0.01,0.02),gun,0.028,0.045,-0.13);
  // 照门
  add(new THREE.BoxGeometry(0.026,0.014,0.012),gun,0,0.072,-0.075);
  // 木护木（枪管下方两侧，AK 特征）
  add(new THREE.BoxGeometry(0.05,0.038,0.16),wood,0,0.005,-0.34);
  // 弹匣（前倾弧形：三段箱拼出弯曲）
  add(new THREE.BoxGeometry(0.03,0.055,0.062),gun,0,-0.048,-0.20,0.30);
  add(new THREE.BoxGeometry(0.03,0.05,0.058),gun,0,-0.093,-0.175,0.55);
  add(new THREE.BoxGeometry(0.03,0.035,0.05),gun,0,-0.125,-0.145,0.8);
  // 扳机护圈
  add(new THREE.BoxGeometry(0.024,0.006,0.055),gun,0,-0.045,-0.115);
  add(new THREE.BoxGeometry(0.006,0.028,0.006),gun,-0.012,-0.032,-0.095);
  add(new THREE.BoxGeometry(0.006,0.028,0.006),gun,0.012,-0.032,-0.095);
  // 握把（后倾）
  add(new THREE.BoxGeometry(0.03,0.06,0.038),wood,0,-0.055,-0.085,-0.35);
  // 枪托（木质，下弯连接）
  add(new THREE.BoxGeometry(0.032,0.05,0.13),wood,0,-0.005,0.02);
  add(new THREE.BoxGeometry(0.036,0.062,0.14),wood,0,-0.03,0.14,-0.06);
  add(new THREE.BoxGeometry(0.04,0.075,0.02),wood,0,-0.033,0.215,-0.06);   // 托底板
  return r;
}

/* ================= 写实士兵 ================= */
function makeSoldier(t){
  const g=new THREE.Group();
  const boss=t==='boss',heavy=t==='h';
  const sc=boss?2.0:heavy?1.32:1;
  const cloth=M.cloth(t),clothDark=M.clothDark(t),vestM=M.vest(t),helmM=M.helm(t);
  const faceM=M.face(),skinM=M.skin(),darkM=M.dark(),bandM=M.band();
  const mats=[cloth,vestM,helmM];
  // ---- 躯干（胶囊胸腹 + 战术背心） ----
  const torso=new THREE.Group();torso.position.y=0.98;g.add(torso);
  const chest=capsuleMesh(0.19,0.3,cloth);
  chest.scale.set(1.25,1,0.72);
  chest.position.y=0.3;torso.add(chest);
  const belt=new THREE.Mesh(new THREE.CylinderGeometry(0.21,0.21,0.07,10),darkM);
  belt.scale.set(1.22,1,0.74);belt.position.y=0.05;torso.add(belt);
  const vest=capsuleMesh(0.205,0.24,vestM);
  vest.scale.set(1.24,1,0.76);vest.position.y=0.3;torso.add(vest);
  for(let i=-1;i<=1;i++){
    const p=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.13,0.05),darkM);
    p.position.set(i*0.14,0.24,0.15);torso.add(p);
  }
  const pack=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.38,0.14),vestM);
  pack.position.set(0,0.3,-0.2);torso.add(pack);
  const roll=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.3,8),darkM);
  roll.rotation.z=Math.PI/2;roll.position.set(0,0.44,-0.2);torso.add(roll);
  const canteen=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.055,0.14,8),darkM);
  canteen.position.set(0.19,0.12,-0.17);torso.add(canteen);
  // ---- 头部（脸贴图 + 钢盔 + 护目镜） ----
  const head=new THREE.Group();head.position.y=0.66;torso.add(head);
  const face=new THREE.Mesh(new THREE.SphereGeometry(0.145,14,12),faceM);
  face.scale.set(0.9,1.02,0.92);head.add(face);
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.028,0.07,6),skinM);
  nose.rotation.x=Math.PI/2;nose.position.set(0,-0.01,0.145);head.add(nose);
  const jaw=new THREE.Mesh(new THREE.SphereGeometry(0.1,10,8),skinM);
  jaw.scale.set(0.95,0.7,0.9);jaw.position.set(0,-0.09,0.02);head.add(jaw);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.07,0.1,8),skinM);
  neck.position.y=-0.17;head.add(neck);
  const helm=new THREE.Mesh(new THREE.SphereGeometry(0.172,14,10,0,TAU,0,Math.PI*0.55),helmM);
  helm.position.y=0.025;head.add(helm);
  const brim=new THREE.Mesh(new THREE.TorusGeometry(0.15,0.024,8,16),helmM);
  brim.rotation.x=Math.PI/2;brim.position.y=0.02;head.add(brim);
  const goggleBand=new THREE.Mesh(new THREE.TorusGeometry(0.148,0.022,6,16),darkM);
  goggleBand.rotation.x=Math.PI/2;goggleBand.position.y=0.045;head.add(goggleBand);
  const goggles=new THREE.Mesh(new THREE.BoxGeometry(0.23,0.06,0.05),new THREE.MeshStandardMaterial({color:0x14170f,roughness:0.25,metalness:0.45,envMapIntensity:0.85}));
  goggles.position.set(0,0.045,0.12);head.add(goggles);
  // ---- 步枪（真实 AK 模型，双手前伸） ----
  const rifle=buildRifle();
  rifle.position.set(0.09,0.3,0.2);rifle.rotation.y=-0.08;
  torso.add(rifle);
  const flash=new THREE.Sprite(new THREE.SpriteMaterial({map:texGlowWarm,transparent:true,depthWrite:false}));
  flash.scale.set(0.001,0.001,1);flash.position.set(0,0.02,-0.62);rifle.add(flash);
  rifle.userData.flash=flash;
  rifle.userData.flashT=0;
  // ---- 手臂（上臂/前臂胶囊 + 手套，持枪姿态） ----
  const mkArm=(side)=>{
    const sh=new THREE.Group();sh.position.set(side*0.26,0.5,0);torso.add(sh);
    const up=capsuleMesh(0.055,0.2,cloth);up.rotation.x=Math.PI/2;up.position.z=0.12;sh.add(up);
    const band=new THREE.Mesh(new THREE.CylinderGeometry(0.062,0.062,0.05,8),bandM);
    band.rotation.x=Math.PI/2;band.position.z=0.12;if(side<0)sh.add(band);
    const el=new THREE.Group();el.position.z=0.24;sh.add(el);
    const fo=capsuleMesh(0.047,0.18,cloth);fo.rotation.x=Math.PI/2;fo.position.z=0.1;el.add(fo);
    const hand=new THREE.Mesh(new THREE.SphereGeometry(0.052,8,6),darkM);
    hand.scale.set(0.9,0.85,1.25);hand.position.z=0.23;el.add(hand);
    sh.rotation.y=-side*0.55;sh.rotation.x=-0.15;
    el.rotation.y=side*0.8;
  };
  mkArm(-1);mkArm(1);
  // ---- 腿（大腿/小腿胶囊 + 军靴） ----
  const mkLeg=(side)=>{
    const hip=new THREE.Group();hip.position.set(side*0.115,0.98,0);g.add(hip);
    const th=capsuleMesh(0.078,0.28,clothDark);th.position.y=-0.22;hip.add(th);
    const knee=new THREE.Group();knee.position.y=-0.46;hip.add(knee);
    const shin=capsuleMesh(0.062,0.26,clothDark);shin.position.y=-0.2;knee.add(shin);
    const bootG=new THREE.Group();bootG.position.y=-0.42;knee.add(bootG);
    const boot=new THREE.Mesh(new THREE.BoxGeometry(0.13,0.1,0.26),darkM);
    boot.position.z=0.05;bootG.add(boot);
    const toe=new THREE.Mesh(new THREE.SphereGeometry(0.065,8,6),darkM);
    toe.scale.set(1,0.8,1.1);toe.position.set(0,-0.02,0.16);bootG.add(toe);
    return{hip,knee};
  };
  const legL=mkLeg(-1),legR=mkLeg(1);
  if(heavy){                                     // 重甲：胸板+护膝+肩甲
    const plate=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.42,0.34),helmM);
    plate.position.y=0.3;torso.add(plate);
    for(const s2 of[-1,1]){
      const pad=new THREE.Mesh(new THREE.SphereGeometry(0.13,10,8),helmM);
      pad.position.set(s2*0.31,0.52,0);torso.add(pad);
      const kneepad=new THREE.Mesh(new THREE.SphereGeometry(0.075,8,6),helmM);
      kneepad.position.set(0,-0.02,0.06);
      (s2<0?legL:legR).knee.add(kneepad);
    }
  }
  if(boss){                                      // BOSS：红眼+巨型肩甲+防毒面具
    for(const s2 of[-1,1]){
      const pad=new THREE.Mesh(new THREE.BoxGeometry(0.46,0.3,0.46),helmM);
      pad.position.set(s2*0.48,0.56,0);torso.add(pad);
    }
    const eye=new THREE.Sprite(new THREE.SpriteMaterial({map:texGlowRed,transparent:true,depthWrite:false}));
    eye.scale.set(0.5,0.26,1);eye.position.set(0,0.045,0.15);head.add(eye);
    const mask=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.1,0.09,10),darkM);
    mask.rotation.x=Math.PI/2;mask.position.set(0,-0.07,0.13);head.add(mask);
    rifle.scale.setScalar(1.5);
  }
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  g.scale.setScalar(sc);
  return{group:g,legL,legR,torso,rifle,mats};
}

/* ---- 尸体贴花 ---- */
const bloodTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;
  const g=c.getContext('2d');
  for(let i=0;i<7;i++){
    g.fillStyle=`rgba(110,14,10,${0.35+Math.random()*0.3})`;
    g.beginPath();g.ellipse(32+rnd(-10,10),32+rnd(-10,10),rnd(5,15),rnd(4,10),rnd(0,3),0,TAU);g.fill();
  }return new THREE.CanvasTexture(c);})();

/* ================= 第一人称枪械视图模型（真实轮廓 + 材质贴图） ================= */
const vm=new THREE.Group();
camera.add(vm);
vm.position.set(0.34,-0.32,-0.55);
const vmGuns={};
function buildVM(gid){
  const g=new THREE.Group();
  const metal=()=>new THREE.MeshStandardMaterial({map:METAL_TEX,roughness:0.42,metalness:0.62,envMapIntensity:0.8});
  const metal2=()=>new THREE.MeshStandardMaterial({map:METAL_TEX,color:0x8a8a8a,roughness:0.55,metalness:0.5,envMapIntensity:0.7});
  const wood=()=>new THREE.MeshStandardMaterial({map:WOOD_TEX,roughness:0.7,metalness:0,envMapIntensity:0.55});
  const box=(w,h,d,m)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  const cyl=(r1,r2,l,m)=>{const c=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,l,10),m);c.rotation.x=Math.PI/2;return c;};
  let muzzleZ=-0.68;
  if(gid==='pistol'){
    const slide=box(0.052,0.062,0.30,metal());slide.position.set(0,0.03,-0.16);g.add(slide);
    const serr=box(0.054,0.02,0.02,metal2());serr.position.set(0,0.032,-0.28);g.add(serr);
    const frame=box(0.048,0.045,0.2,metal2());frame.position.set(0,-0.015,-0.12);g.add(frame);
    const grip=box(0.048,0.13,0.068,metal2());grip.position.set(0,-0.085,0.0);grip.rotation.x=0.25;g.add(grip);
    const guard=box(0.012,0.01,0.05,metal2());guard.position.set(0,-0.045,-0.09);g.add(guard);
    const siteF=box(0.008,0.014,0.01,metal());siteF.position.set(0,0.068,-0.29);g.add(siteF);
    const siteR=box(0.024,0.012,0.01,metal());siteR.position.set(0,0.066,-0.04);g.add(siteR);
    muzzleZ=-0.33;
  }else if(gid==='rpg'){
    const tube=cyl(0.055,0.055,0.95,metal2());tube.position.set(0,0.02,-0.3);g.add(tube);
    const flare=cyl(0.075,0.058,0.1,metal());flare.position.set(0,0.02,-0.82);g.add(flare);   // 喇叭口
    const warhead=new THREE.Mesh(new THREE.ConeGeometry(0.085,0.24,10),new THREE.MeshStandardMaterial({map:METAL_TEX,color:0xa06a4a,roughness:0.4,metalness:0.5,envMapIntensity:0.8}));
    warhead.rotation.x=-Math.PI/2;warhead.position.set(0,0.02,-0.97);g.add(warhead);
    const sight=box(0.015,0.06,0.03,metal());sight.position.set(0,0.1,-0.15);g.add(sight);
    const grip=box(0.045,0.12,0.06,wood());grip.position.set(0,-0.1,-0.1);g.add(grip);
    const grip2=box(0.04,0.1,0.05,wood());grip2.position.set(0,-0.09,-0.42);g.add(grip2);
    muzzleZ=-1.05;
  }else if(gid==='ak'){
    // 真实 AK-47 第一人称
    const barrel=cyl(0.013,0.013,0.36,metal());barrel.position.set(0,0.045,-0.62);g.add(barrel);
    const brake=cyl(0.018,0.018,0.05,metal());brake.position.set(0,0.045,-0.81);g.add(brake);
    const gasTube=cyl(0.011,0.011,0.26,metal());gasTube.position.set(0,0.088,-0.52);g.add(gasTube);  // 导气管
    const gasBlock=box(0.026,0.036,0.04,metal());gasBlock.position.set(0,0.082,-0.4);g.add(gasBlock);
    const fsight=cyl(0.008,0.008,0.055,metal());fsight.position.set(0,0.095,-0.75);g.add(fsight);    // 准星柱
    const fEarL=box(0.016,0.018,0.008,metal());fEarL.position.set(-0.014,0.115,-0.75);g.add(fEarL);  // 护耳
    const fEarR=box(0.016,0.018,0.008,metal());fEarR.position.set(0.014,0.115,-0.75);g.add(fEarR);
    const body=box(0.052,0.075,0.3,metal());body.position.set(0,0.03,-0.22);g.add(body);            // 机匣
    const cover=box(0.05,0.022,0.27,metal2());cover.position.set(0,0.082,-0.22);g.add(cover);       // 机匣盖
    const bolt=box(0.018,0.012,0.03,metal2());bolt.position.set(0.034,0.07,-0.16);g.add(bolt);      // 拉机柄
    const rsight=box(0.03,0.016,0.014,metal());rsight.position.set(0,0.1,-0.1);g.add(rsight);       // 照门
    const handguardU=box(0.056,0.032,0.19,wood());handguardU.position.set(0,0.052,-0.42);g.add(handguardU); // 上护木
    const handguardL=box(0.052,0.04,0.17,wood());handguardL.position.set(0,0.005,-0.42);g.add(handguardL); // 下护木
    const mag=box(0.036,0.2,0.075,metal2());mag.position.set(0,-0.1,-0.3);mag.rotation.x=0.42;g.add(mag);  // 前倾弧弹匣
    const mag2=box(0.034,0.13,0.065,metal2());mag2.position.set(0,-0.21,-0.245);mag2.rotation.x=0.75;g.add(mag2);
    const grip=box(0.034,0.09,0.045,wood());grip.position.set(0,-0.075,-0.1);grip.rotation.x=-0.3;g.add(grip);
    const stock=box(0.036,0.06,0.16,wood());stock.position.set(0,0.0,0.06);g.add(stock);
    const stock2=box(0.042,0.075,0.16,wood());stock2.position.set(0,-0.02,0.2);stock2.rotation.x=-0.05;g.add(stock2);
    const hand=box(0.075,0.075,0.11,new THREE.MeshStandardMaterial({color:0x8a6a4a,roughness:0.7,envMapIntensity:0.5}));
    hand.position.set(0.01,-0.055,-0.42);g.add(hand);
    muzzleZ=-0.86;
  }else if(gid==='smg'){
    const barrel=cyl(0.014,0.014,0.2,metal());barrel.position.set(0,0.035,-0.4);g.add(barrel);
    const body=box(0.055,0.07,0.34,metal());body.position.set(0,0.025,-0.16);g.add(body);
    const mag=box(0.032,0.2,0.055,metal2());mag.position.set(0,-0.11,-0.16);g.add(mag);   // MP40 直弹匣
    const grip=box(0.032,0.09,0.042,metal2());grip.position.set(0,-0.07,-0.02);grip.rotation.x=-0.15;g.add(grip);
    const stock=box(0.014,0.05,0.3,metal());stock.position.set(0,0.01,0.12);g.add(stock); // 折叠枪托杆
    const stockPlate=box(0.02,0.07,0.015,metal());stockPlate.position.set(0,0,0.26);g.add(stockPlate);
    const fsight=box(0.024,0.02,0.012,metal());fsight.position.set(0,0.075,-0.47);g.add(fsight);
    const rsight=box(0.026,0.018,0.012,metal());rsight.position.set(0,0.072,-0.02);g.add(rsight);
    const hand=box(0.075,0.075,0.11,new THREE.MeshStandardMaterial({color:0x8a6a4a,roughness:0.7,envMapIntensity:0.5}));
    hand.position.set(0.01,-0.04,-0.36);g.add(hand);
    muzzleZ=-0.52;
  }else if(gid==='shotgun'){
    const barrel=cyl(0.016,0.016,0.42,metal());barrel.position.set(0,0.05,-0.52);g.add(barrel);
    const tube=cyl(0.014,0.014,0.3,metal2());tube.position.set(0,0.008,-0.44);g.add(tube);   // 弹仓管
    const body=box(0.05,0.07,0.16,metal());body.position.set(0,0.03,-0.2);g.add(body);
    const pump=box(0.055,0.05,0.13,wood());pump.position.set(0,-0.005,-0.42);g.add(pump);    // 木泵动护木
    const grip=box(0.034,0.085,0.042,wood());grip.position.set(0,-0.07,-0.08);grip.rotation.x=-0.25;g.add(grip);
    const stock=box(0.038,0.065,0.2,wood());stock.position.set(0,-0.01,0.12);stock.rotation.x=-0.06;g.add(stock);
    const bead=box(0.01,0.012,0.01,metal());bead.position.set(0,0.075,-0.7);g.add(bead);     // 珠准星
    const hand=box(0.075,0.075,0.11,new THREE.MeshStandardMaterial({color:0x8a6a4a,roughness:0.7,envMapIntensity:0.5}));
    hand.position.set(0.01,-0.045,-0.42);g.add(hand);
    muzzleZ=-0.74;
  }else{   // sniper Kar98k
    const barrel=cyl(0.014,0.014,0.5,metal());barrel.position.set(0,0.04,-0.62);g.add(barrel);
    const body=box(0.05,0.075,0.36,wood());body.position.set(0,0.02,-0.2);g.add(body);       // 全枪身木制
    const scope=cyl(0.03,0.03,0.2,metal2());scope.position.set(0,0.115,-0.18);g.add(scope);
    const scopeF=cyl(0.036,0.03,0.04,metal2());scopeF.position.set(0,0.115,-0.3);g.add(scopeF); // 物镜罩
    const mountL=box(0.014,0.04,0.03,metal());mountL.position.set(-0.024,0.085,-0.14);g.add(mountL);
    const mountR=box(0.014,0.04,0.03,metal());mountR.position.set(0.024,0.085,-0.14);g.add(mountR);
    const bolt=new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.008,0.07,8),metal());
    bolt.rotation.z=Math.PI/2;bolt.rotation.y=0.5;bolt.position.set(0.045,0.06,-0.05);g.add(bolt); // 弯曲拉栓
    const boltKnob=new THREE.Mesh(new THREE.SphereGeometry(0.014,8,6),metal());
    boltKnob.position.set(0.075,0.06,-0.03);g.add(boltKnob);
    const mag=box(0.04,0.045,0.07,metal2());mag.position.set(0,-0.045,-0.18);g.add(mag);
    const stock=box(0.042,0.07,0.22,wood());stock.position.set(0,-0.015,0.1);stock.rotation.x=-0.08;g.add(stock);
    const hand=box(0.075,0.075,0.11,new THREE.MeshStandardMaterial({color:0x8a6a4a,roughness:0.7,envMapIntensity:0.5}));
    hand.position.set(0.01,-0.04,-0.4);g.add(hand);
    muzzleZ=-0.88;
  }
  const muzzleFlash=new THREE.Sprite(new THREE.SpriteMaterial({map:texGlowWarm,transparent:true,depthWrite:false}));
  muzzleFlash.scale.set(0.001,0.001,1);
  muzzleFlash.position.set(0,0.045,muzzleZ);
  g.add(muzzleFlash);
  g.userData.flash=muzzleFlash;
  g.visible=false;
  vm.add(g);
  return g;
}
for(const gid of GUNLIST)vmGuns[gid]=buildVM(gid);
const muzzleLight=new THREE.PointLight(0xffc878,0,9);
camera.add(muzzleLight);
muzzleLight.position.set(0.3,-0.2,-1);
