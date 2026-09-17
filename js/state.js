"use strict";
/* ============ 全局可变状态 + 通用小助手（击杀播报/提示/浮动数字） ============ */
let state='title',stT=0,level=1;
let unlockedLv=+(localStorage.getItem('cw_unlocked')||1);
let best=+(localStorage.getItem('cw_best')||0);
let player=null,enemies=[],pickups=[],corpses=[],rockets=[],orbs=[];
let kills=0,tGame=0,shotsFired=0,shake=0,clearT=0,vigHit=0,vigDir=0,hitMark=0,hitCrit=false;
let killFeed=[],streakN=0,streakT=0,popupText='',popupT=0;
let buttons=[],upChoices=[];
let tGlobal=0,radarT=0;
let waves=[],waveIdx=0,interT=0,addT=0;
let extractReady=false,extractT=0,beacon=null;
let curTarget=null;
let loadSel='ak';
/* 浮动伤害数字（3D 世界坐标 → 屏幕投影绘制） */
const floats=[];

function addFeed(txt,color){killFeed.push({txt,color:color||'#e8e4da',t:0});if(killFeed.length>5)killFeed.shift();}
function popupMsg(txt){popupText=txt;popupT=2.2;}
function addFloat3D(x,y,z,txt,color,size){floats.push({x,y,z,txt,color,t:0,size:size||14});}
