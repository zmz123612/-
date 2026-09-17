"use strict";
/* ============ 武器与升级数据（无限弹药） ============ */
const GUNS={
  ak:     {name:'AK-47', cn:'步枪',  slot:1,dmg:24, cd:0.105,rng:70, spread:0.010,pellets:1,pierce:0,falloff:0.45,unlock:1, kick:1.4,snd:'ak',     auto:true},
  pistol: {name:'M1911', cn:'手枪',  slot:2,dmg:34, cd:0.24, rng:45, spread:0.007,pellets:1,pierce:0,falloff:0.4, unlock:1, kick:1.0,snd:'pistol',auto:true},
  smg:    {name:'MP40',  cn:'冲锋枪',slot:3,dmg:16, cd:0.068,rng:40, spread:0.017,pellets:1,pierce:0,falloff:0.7, unlock:3, kick:0.7,snd:'smg',    auto:true},
  shotgun:{name:'M1897', cn:'霰弹枪',slot:4,dmg:15, cd:0.75, rng:26, spread:0.045,pellets:8,pierce:0,falloff:1.5, unlock:4, kick:4.0,snd:'shotgun',auto:false},
  sniper: {name:'Kar98k',cn:'狙击枪',slot:5,dmg:150,cd:1.05, rng:160,spread:0.001,pellets:1,pierce:3,falloff:0.08,unlock:5,kick:4.5,snd:'sniper', auto:false},
  rpg:    {name:'RPG-7', cn:'火箭筒',slot:6,dmg:150,cd:1.7,  rng:120,spread:0.004,pellets:1,pierce:0,falloff:0,   unlock:7,kick:4.5,snd:'rpgFire',auto:false,rocket:true},
};
const GUNLIST=Object.keys(GUNS).sort((a,b)=>GUNS[a].slot-GUNS[b].slot);

const UPS=[
 {id:'dmg',   e:'⚔️',n:'穿甲燃烧弹',d:'武器伤害 +25%',              max:5,ap:p=>p.dmgMult*=1.25},
 {id:'rate',  e:'⏩',n:'快速机匣',  d:'射速 +15%',                 max:5,ap:p=>p.cdMult/=1.15},
 {id:'multi', e:'🔀',n:'双联枪管',  d:'每次射击 +1 发（霰弹枪+2粒）',max:2,ap:p=>p.proj++},
 {id:'pierce',e:'🎯',n:'钨芯穿甲',  d:'子弹额外穿透 1 名敌人',      max:2,ap:p=>p.pierce++},
 {id:'range', e:'🔭',n:'枪管加长',  d:'武器射程 +30%',             max:3,ap:p=>p.rangeMult*=1.3},
 {id:'boot',  e:'👟',n:'行军靴',    d:'移动速度 +12%',             max:3,ap:p=>p.speedMult*=1.12},
 {id:'hp',    e:'❤️',n:'强健体魄',  d:'生命上限 +50 并治疗 50',     max:4,ap:p=>{p.maxHp+=50;p.hp=Math.min(p.maxHp,p.hp+50);}},
 {id:'regen', e:'💚',n:'战场恢复',  d:'每秒自动回复 1 生命',        max:3,ap:p=>p.regen+=1},
 {id:'leech', e:'🩸',n:'战地急救',  d:'每击杀回复 2 生命',          max:3,ap:p=>p.killHeal+=2},
 {id:'crit',  e:'💥',n:'致命打击',  d:'暴击率 +10%（2.5倍伤害）',   max:4,ap:p=>p.crit+=0.10},
 {id:'shield',e:'🛡️',n:'防弹衣',    d:'护甲+1（格挡一次伤害，10秒恢复）',max:2,ap:p=>{p.shieldMax++;p.shield++;}},
 {id:'jet',   e:'🦅',n:'喷气背包',  d:'获得/强化飞天：按住 SPACE 升空',max:3,ap:p=>{p.jet=true;p.fuelMax+=2.2;p.fuel=p.fuelMax;}},
];
const HEAL_UP={id:'heal',e:'🍎',n:'战地口粮',d:'立刻回复 50 生命',max:99,ap:p=>p.hp=Math.min(p.maxHp,p.hp+50)};
