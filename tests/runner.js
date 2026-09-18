"use strict";
/* 自动化 + 边界测试运行器：iframe 加载 index.html?test=1，通过 window.__test 受控接口驱动断言 */
(function(){
  const frame=document.getElementById('game'),sum=document.getElementById('sum'),
        cases=document.getElementById('cases'),done=document.getElementById('done');
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const results=[];
  function record(name,ok,detail){
    results.push({name,ok,detail:detail||''});
    const div=document.createElement('div');
    div.className='case '+(ok?'pass':'fail');
    div.innerHTML=`<b>${ok?'✔':'✘'} ${name}</b>${detail?`<div class="detail">${detail}</div>`:''}`;
    cases.appendChild(div);
  }
  function assert(name,fn){
    try{const d=fn();record(name,true,d);}
    catch(e){record(name,false,e.message);}
  }
  function waitFor(cond,timeout=15000,interval=150){
    const t0=Date.now();
    return new Promise((res,rej)=>{
      const tick=()=>{
        let v;try{v=cond();}catch(e){return rej(e);}
        if(v)return res(v);
        if(Date.now()-t0>timeout)return rej(new Error('等待超时'));
        setTimeout(tick,interval);
      };
      tick();
    });
  }
  async function run(){
    results.length=0;cases.innerHTML='';done.dataset.ok='0';done.textContent='';
    sum.textContent='启动游戏中…';
    frame.src='../index.html?test=1&v=14&t='+Date.now();
    let T;
    try{T=await waitFor(()=>frame.contentWindow&&frame.contentWindow.__test&&frame.contentWindow.__dbg().state==='title');}
    catch(e){sum.textContent='❌ 游戏未能启动';record('启动',false,String(e));return finish();}
    const g=()=>frame.contentWindow,t=()=>g().__test;
    sum.textContent='运行中…';
    await sleep(600);

    /* A. 启动健康 */
    assert('A1 启动无未捕获异常',()=>{const e=t().errs();if(e.length)throw new Error(e.join(' | '));return 'errors=0';});
    assert('A2 标题态区块就绪',()=>{const n=t().dbg().chunks;if(n<49)throw new Error('chunks='+n);return 'chunks='+n;});
    assert('A3 共享植被几何就绪',()=>{const s=t().sharedAlive();for(const k in s)if(!s[k])throw new Error(k+' 丢失');return 'ok';});

    /* B. 进入战斗 */
    t().start();await sleep(300);t().step(4);
    assert('B1 开局状态合法',()=>{const d=t().dbg();if(d.state!=='play')throw new Error('state='+d.state);return d.state;});
    assert('B2 玩家数值有限',()=>{const p=t().playerState();if(!p.finite)throw new Error(JSON.stringify(p));return `(${p.x.toFixed(0)},${p.z.toFixed(0)}) hp=${p.hp}`;});

    /* C. 边界：地形极值 / 极端视角 / 长距离流式 */
    assert('C1 地形高度在极远坐标有限',()=>{
      const pts=[[-1e4,-1e4],[1e4,1e4],[0,0],[5e3,-5e3]];
      const hs=pts.map(p=>t().terrainH(p[0],p[1]));
      if(hs.some(h=>!Number.isFinite(h)))throw new Error(JSON.stringify(hs));
      return hs.map(h=>h.toFixed(1)).join(', ');});
    assert('C2 极端 yaw/pitch 相机有限',()=>{
      t().setLook(123.4,1.25);const a=t().cameraState();
      t().setLook(-98.7,-1.25);const b=t().cameraState();
      for(const v of[a.x,a.y,a.z,b.x,b.y,b.z])if(!Number.isFinite(v))throw new Error('NaN camera');
      t().setLook(0,0);return 'ok';});
    {
      const c0=t().chunkCount();
      t().movePlayer(260,260);await sleep(300);t().step(2);await sleep(400);t().step(2);
      const c1=t().chunkCount();
      assert('C3 远距离流式加载',()=>{if(c1<49)throw new Error('chunks='+c1);return `${c0} → ${c1}`;});
      assert('C4 卸载后共享几何仍存活',()=>{const s=t().sharedAlive();for(const k in s)if(!s[k])throw new Error(k+' 被误释放');return 'ok';});
      assert('C5 流式移动后无异常',()=>{const e=t().errs();if(e.length)throw new Error(e.join(' | '));return 'errors=0';});
    }

    /* D. 坦克：座舱锚点 / 开火对齐 / 退出 */
    {
      t().spawnVehicle('tank');await sleep(150);t().step(2);
      const okIn=t().enterVehicle();t().step(6);
      assert('D1 乘坐坦克成功',()=>{if(!okIn||t().playerState().vehicleKind!=='tank')throw new Error('enter failed');return 'ok';});
      const gy=t().terrainH(t().playerState().x,t().playerState().z);
      const cam=t().cameraState();
      assert('D2 坦克视点=炮塔舱口（非漂浮/埋地）',()=>{
        const expect=Math.max(gy,-2.6)+2.35;
        if(Math.abs(cam.y-expect)>0.8)throw new Error(`cam.y=${cam.y.toFixed(2)} expect≈${expect.toFixed(2)}`);
        return `cam.y=${cam.y.toFixed(2)}`;});
      const r0=t().rockets(),f=t().fireVehicle(3);
      assert('D3 坦克连点仅出一发（冷却生效）',()=>{if(f.rocketsFired!==1)throw new Error('rockets='+f.rocketsFired);return 'rockets=1';});
      t().step(36);                                   // 1.8s 固定步进：冷却必须走完
      const f2=t().fireVehicle(1);
      assert('D4 冷却后可再次开火',()=>{if(f2.rocketsFired<1)throw new Error('no fire');return 'rockets='+(t().rockets()-r0);});
      t().setLook(0.6,-0.6);const cam2=t().cameraState();
      assert('D5 车内转动视角相机有限',()=>{if(![cam2.x,cam2.y,cam2.z].every(Number.isFinite))throw new Error('NaN');t().setLook(0,0);return 'ok';});
      const okOut=t().exitVehicle();t().step(2);
      assert('D6 下车后无残留状态',()=>{
        if(!okOut)throw new Error('exit failed');
        const p=t().playerState();
        if(p.vehicleKind)throw new Error('vehicleKind 残留');
        if(p.flyZ!==0)throw new Error('flyZ='+p.flyZ);
        if(t().terrainH(p.x,p.z)<=-2.2)throw new Error('落在水中');
        return 'ok';});
    }

    /* E. 直升机：爬升联动 / 机炮 / 摧毁保护 */
    {
      t().spawnVehicle('heli');await sleep(150);t().step(2);
      const okIn=t().enterVehicle();t().step(60);     // 3s 步进：爬升到 12m
      assert('E1 乘坐直升机成功',()=>{if(!okIn||t().playerState().vehicleKind!=='heli')throw new Error('enter failed');return 'ok';});
      const v=t().vehicleState(),gy=t().terrainH(v.x,v.z),cam=t().cameraState();
      assert('E2 自动爬升至 ~12m',()=>{if(v.alt<9)throw new Error('alt='+v.alt.toFixed(1));return 'alt='+v.alt.toFixed(1);});
      assert('E3 视点随爬升联动（座舱内，非旋翼上方）',()=>{
        const expect=Math.max(gy,-2.6)+1.62+0.85+v.alt;
        if(Math.abs(cam.y-expect)>1.2)throw new Error(`cam.y=${cam.y.toFixed(2)} expect≈${expect.toFixed(2)}`);
        return `cam.y=${cam.y.toFixed(2)}`;});
      const f=t().fireVehicle(3);
      assert('E4 机炮速射（冷却 0.09s，连点可打出）',()=>{if(f.fireT<=0)throw new Error('fireT='+f.fireT);return 'fireT='+f.fireT.toFixed(2);});
      const hp0=t().playerState().hp;
      const absorbed=t().damageVehicle(99999);t().step(4);
      assert('E5 载具被毁强制下车且不残留',()=>{
        if(!absorbed)throw new Error('未吸收伤害');
        if(t().vehicleState()!==null)throw new Error('vehicle 残留');
        const p=t().playerState();
        if(p.vehicleKind)throw new Error('vehicleKind 残留');
        if(p.flyZ!==0)throw new Error('flyZ 残留');
        return `hp ${hp0}（爆炸自伤被下车无敌帧豁免，属既有保护设计）`;});
    }

    /* F. 收尾 */
    assert('F1 全程无未捕获异常',()=>{const e=t().errs();if(e.length)throw new Error(e.join(' | '));return 'errors=0';});
    finish();
  }
  function finish(){
    const pass=results.filter(r=>r.ok).length;
    const okAll=pass===results.length;
    sum.textContent=okAll?`✔ 全部通过 ${pass}/${results.length}`:`✘ 失败 ${results.length-pass} 项（${pass}/${results.length} 通过）`;
    sum.style.color=okAll?'#8fe08a':'#f0a0a0';
    done.dataset.ok=okAll?'1':'0';
    done.textContent='DONE';
    window.__TEST_RESULTS={pass,total:results.length,okAll,results};
  }
  document.getElementById('run').addEventListener('click',run);
  run();
})();
