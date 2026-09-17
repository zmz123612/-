"use strict";
/* ============ 音效（WebAudio 合成） ============ */
let AC=null,muted=localStorage.getItem('cw_mute')==='1';
function audio(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(AC&&AC.state==='suspended')AC.resume();}
function tone(f0,f1,dur,type,vol,delay=0){
  if(muted||!AC)return;
  const t=AC.currentTime+delay,o=AC.createOscillator(),g=AC.createGain();
  o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(f1,1),t+dur);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+dur+0.02);
}
function noiseS(dur,vol,delay=0,hp=0){
  if(muted||!AC)return;
  const t=AC.currentTime+delay,n=AC.createBufferSource(),b=AC.createBuffer(1,Math.max(1,AC.sampleRate*dur|0),AC.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
  n.buffer=b;const g=AC.createGain();g.gain.value=vol;
  if(hp>0){const f=AC.createBiquadFilter();f.type='highpass';f.frequency.value=hp;n.connect(f);f.connect(g);}else n.connect(g);
  g.connect(AC.destination);n.start(t);
}
const sfx={
  ak(){tone(300,90,0.08,'sawtooth',0.09);noiseS(0.06,0.12,0,700);},
  pistol(){tone(820,240,0.07,'square',0.06);noiseS(0.045,0.06,0,1800);},
  smg(){tone(560,200,0.045,'square',0.045);noiseS(0.03,0.05,0,1500);},
  shotgun(){noiseS(0.26,0.24,0,250);tone(150,50,0.22,'sawtooth',0.12);},
  sniper(){tone(230,40,0.34,'sawtooth',0.15);noiseS(0.24,0.15,0,450);},
  rpgFire(){noiseS(0.5,0.14,0,350);tone(280,850,0.4,'sawtooth',0.055);},
  boom(){tone(105,26,0.6,'sine',0.38);noiseS(0.55,0.3,0,70);noiseS(0.45,0.15,0.13,500);tone(66,22,0.8,'triangle',0.22,0.05);},
  hit(){tone(1150,900,0.035,'square',0.045);},
  crit(){tone(1500,1100,0.05,'square',0.06);tone(800,500,0.06,'triangle',0.045,0.02);},
  kill(){noiseS(0.14,0.11,0,180);tone(190,55,0.13,'sawtooth',0.055);},
  hurt(){tone(170,60,0.25,'sawtooth',0.14);noiseS(0.14,0.09,0,250);},
  pick(){tone(520,880,0.1,'sine',0.09);},
  empty(){tone(1300,1100,0.04,'square',0.045);},
  shield(){tone(850,1300,0.16,'sine',0.08);},
  clear(){[523,659,784,1047].forEach((f,i)=>tone(f,f,0.18,'triangle',0.1,i*0.12));},
  up(){[392,523,659].forEach((f,i)=>tone(f,f,0.13,'sine',0.09,i*0.09));},
  boss(){tone(85,45,0.6,'sawtooth',0.15);noiseS(0.35,0.09);},
  jet(){tone(150,300,0.09,'sawtooth',0.03);},
  step(){noiseS(0.05,0.022,0,150);},
  eshot(v){tone(330,190,0.07,'square',0.026*v);},
  sw(){tone(640,320,0.07,'square',0.055);},
  ui(){tone(700,900,0.05,'sine',0.055);},
  streak(n){for(let i=0;i<n;i++)tone(600+i*160,600+i*160,0.07,'square',0.055,i*0.05);},
};
