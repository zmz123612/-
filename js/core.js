"use strict";
/* ============ 画布与尺寸适配 ============ */
const RW=960,RH=540;
const glcv=document.getElementById('gl'),hud=document.getElementById('hud'),ctx=hud.getContext('2d');
function fit(){
  const s=Math.min(innerWidth/RW,innerHeight/RH)*0.985;
  document.getElementById('wrap').style.width=RW*s+'px';
  document.getElementById('wrap').style.height=RH*s+'px';
  glcv.style.width=hud.style.width=RW*s+'px';
  glcv.style.height=hud.style.height=RH*s+'px';
}
addEventListener('resize',fit);fit();
