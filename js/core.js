"use strict";
/* ============ 画布与尺寸适配 ============ */
const RW=960,RH=540;
/* 测试模式（?test=1）：最早期捕获未处理异常，供 tests/runner 读取；生产环境零开销 */
if(new URLSearchParams(location.search).get('test')==='1'){
  window.__errs=[];
  addEventListener('error',e=>window.__errs.push(String(e.message||e.type)));
  addEventListener('unhandledrejection',()=>window.__errs.push('unhandledrejection'));
}
const glcv=document.getElementById('gl'),hud=document.getElementById('hud'),ctx=hud.getContext('2d');
function fit(){
  const s=Math.min(innerWidth/RW,innerHeight/RH)*0.985;
  document.getElementById('wrap').style.width=RW*s+'px';
  document.getElementById('wrap').style.height=RH*s+'px';
  glcv.style.width=hud.style.width=RW*s+'px';
  glcv.style.height=hud.style.height=RH*s+'px';
}
addEventListener('resize',fit);fit();
