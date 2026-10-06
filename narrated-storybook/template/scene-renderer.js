/* Narrated storybook renderer: deterministic Canvas 2D picture-book art.
   Every pixel is a pure function of (scene, local time, scene duration), so HyperFrames can seek anywhere.
   No Math.random, no Date.now: use rand(i) for stable pseudo-random placement.

   File layout:
     1. ENGINE (reusable): drawing primitives, layered jungle backdrop and foreground, the cat, small creatures, text.
     2. SCENES (PER-VIDEO): one painter per story beat, keyed by the "draw" field of config.json scenes.
   Text strings come from config.json via window.STORY (injected into index.html by scripts/assemble.mjs). */
(() => {
const W=1920,H=1080,TAU=Math.PI*2;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=v=>{v=clamp(v);return v*v*(3-2*v)};
const lerp=(a,b,v)=>a+(b-a)*v;
const rand=i=>{let x=Math.sin(i*127.1+91.7)*43758.5453;return x-Math.floor(x)};
const STORY=()=>window.STORY||{text:{}};

/* ===================== 1. ENGINE (reusable) ===================== */
class StoryRenderer {
 constructor(canvas){this.c=canvas.getContext('2d');this.t=0;this.u=0;}
 path(d,fill,stroke,width=2){const c=this.c,p=new Path2D(d);if(fill){c.fillStyle=fill;c.fill(p)}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke(p)}}
 oval(x,y,rx,ry,fill,angle=0){const c=this.c;c.beginPath();c.ellipse(x,y,rx,ry,angle,0,TAU);c.fillStyle=fill;c.fill()}
 line(d,color,width=2){this.path(d,null,color,width)}
 group(x,y,s,r,fn){const c=this.c;c.save();c.translate(x,y);c.rotate(r);c.scale(s,s);fn();c.restore()}
 gradient(x,y,r,inner,outer){let g=this.c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,inner);g.addColorStop(1,outer);return g}
 // Crescent moon: clip away the "bite" instead of painting a dark disc over a full moon (the disc showed against the sky).
 crescent(x,y,r,biteX,biteY,biteR,fill){const c=this.c;c.save();const p=new Path2D();p.rect(0,0,W,H);p.arc(biteX,biteY,biteR,0,TAU);c.clip(p,'evenodd');this.oval(x,y,r,r,fill);c.restore()}
 leaf(x,y,size,rot,color,vein=true){this.group(x,y,size,rot,()=>{this.path('M 0 0 C -49 -43 -44 -110 0 -165 C 47 -111 44 -45 0 0 Z',color);if(vein){this.line('M 0 -5 Q 6 -74 0 -151','#b6d59055',1.8);for(let i=1;i<6;i++){const yy=-i*23;this.line(`M 0 ${yy} l ${-25+Math.abs(i-3)*4} -22 M 0 ${yy} l ${25-Math.abs(i-3)*4} -22`,'#bddb9a33',1.1)}}})}
 fern(x,y,s,colour='#3b8261',seed=0){this.group(x,y,s,Math.sin(this.t*.65+seed)*.035,()=>{this.line('M 0 0 Q -20 -130 15 -270',colour,4);for(let i=0;i<10;i++){let yy=-i*25,ss=(1-i*.078);this.leaf(-2,yy,ss*.44,-.93,colour,false);this.leaf(0,yy,ss*.46,1.03,colour,false)}})}
 monstera(x,y,s,r,colour){this.group(x,y,s,r,()=>{this.path('M 0 0 C -90 -25 -119 -145 -72 -208 Q -28 -240 0 -198 Q 43 -253 89 -207 C 126 -122 80 -39 0 0',colour);this.line('M 0 -8 L 0 -196','#9ccf9455',3);for(let i=0;i<4;i++){let yy=-55-i*36;this.line(`M -14 ${yy} L -65 ${yy-21} M 14 ${yy} L 70 ${yy-33}`,'#102f3055',9)}})}
 // mood: 'day' | 'rain' | 'night'. skyBack is painted before the ridges and trunks, skyFront after the trunks.
 backdrop(mood,u,skyBack,skyFront){const c=this.c,t=this.t;let night=mood==='night',rain=mood==='rain';
 let g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,night?'#111d35':rain?'#234c58':'#427c69');g.addColorStop(.55,night?'#27495a':rain?'#638e86':'#b6cfa0');g.addColorStop(1,night?'#183a3b':'#497963');c.fillStyle=g;c.fillRect(0,0,W,H);
 c.fillStyle=this.gradient(1370,250,750,night?'#7598af44':'#fff4bd99',night?'#28445700':'#e9e7ad00');c.fillRect(0,0,W,H);
 if(skyBack)skyBack(this,u,t);
 // distant ridges and three parallax layers of trunks and canopy
 this.path('M 0 640 Q 210 370 520 600 Q 860 380 1120 570 Q 1530 340 1920 560 L 1920 1080 L 0 1080 Z',night?'#21434c':'#739e80');
 for(let layer=0;layer<3;layer++){
  const col=night?['#294957','#224651','#173e40'][layer]:rain?['#628d82','#487567','#335e50'][layer]:['#7da890','#578d72','#316e54'][layer];
  for(let i=0;i<10;i++){let x=i*235-170+rand(i+layer*20)*170-(u*45)*(layer+1);let ww=28+layer*22+rand(i+31)*35;c.fillStyle=col;c.fillRect(x,-50,ww,1000);this.path(`M ${x+ww/2} 470 Q ${x-70} 300 ${x-190} 210 L ${x-174} 193 Q ${x-44} 252 ${x+ww} 394 Z`,col);for(let k=0;k<3;k++)this.oval(x-60+k*130,90+rand(i*7+k)*100,140+layer*20,120,col)}
 }
 if(skyFront)skyFront(this,u,t);
 if(!night&&!rain){c.save();c.globalAlpha=.075;c.fillStyle='#fff7c9';for(let j=0;j<5;j++){c.beginPath();c.moveTo(1130+j*95,-20);c.lineTo(1320+j*155,H);c.lineTo(1070+j*110,H);c.lineTo(1075+j*95,-20);c.fill()}c.restore()}
 this.path('M 0 836 Q 430 704 880 840 Q 1350 712 1920 843 L 1920 1080 L 0 1080 Z',night?'#163c3b':'#3b6c4b');
 this.path('M 0 975 Q 520 754 1150 864 T 1920 840 L 1920 1080 L 0 1080 Z',night?'#254b47':'#9ba778');
 for(let i=0;i<26;i++){let x=rand(i+120)*W,y=860+rand(i+190)*190;this.oval(x,y,8+rand(i)*20,2,night?'#62907b22':'#d9daa044',-.2)}
 // midground understory frames rather than covers the hero
 for(let i=0;i<9;i++){let x=i*260-80;this.fern(x,900+rand(i)*60,.6+rand(i+80)*.55,night?'#326552':'#438264',i)}
 for(let i=0;i<15;i++){let x=(rand(i+90)*2050+Math.sin(t*.2+i)*20)%W,y=rand(i+100)*730;this.oval(x,y,1.3,1.3,night?'#bccda055':'#ffffcf66')}
 }
 foreground(mood){let night=mood==='night';const c=this.c;
 for(let j=0;j<2;j++)this.group(j?1920:0,1090,j?-1:1,0,()=>{this.fern(110,0,1.55,night?'#102e32':'#163e35',5);this.monstera(10,35,1.7,.45,night?'#0f2930':'#123a2f');this.monstera(200,65,1.05,-.4,night?'#17433e':'#20533d');this.leaf(335,20,1.15,-.65,night?'#1c4c43':'#285d43')});
 c.fillStyle=this.gradient(960,500,1150,'#00151b00','#00151b80');c.fillRect(0,0,W,H);
 // dangling vines and a canopy fringe
 for(let i=0;i<7;i++){let x=i*320-80;let end=160+rand(i)*125;this.line(`M ${x} -20 Q ${x+70} ${end*.4} ${x+25+Math.sin(this.t*.4+i)*8} ${end}`,night?'#143b37':'#1e5140',5);if(x<100||x>1100)this.leaf(x+28,end,.45,.5,night?'#1c483d':'#327553')}
 }
 paw(x,y,phase,near=true,walk=true,tuck=0){this.group(x,y,1,walk?Math.sin(phase)*.28:tuck,()=>{this.path('M -16 -5 Q -24 32 -13 77 Q -31 97 -13 104 L 22 104 Q 32 96 15 86 L 17 34 L 17 0 Z',near?'#d88446':'#a86036');this.path('M -16 85 Q -26 102 -9 105 L 23 104 Q 32 95 15 87 Z',near?'#ffe0ae':'#d8b787');if(near)this.line('M 1 96 L 1 104 M 11 96 L 11 103','#b88359',1.5)})}
 // The hero: amber tabby with cream muzzle, green eyes and a coral neckerchief. opts: walk, jump, scared, rotate, head (tilt).
 cat(x,y,s,t,opts={}){const c=this.c,walk=opts.walk!==false,cycle=t*7,bodybob=walk?Math.abs(Math.sin(cycle))*4:Math.sin(t*2)*2;
 this.group(x,y+bodybob,s,opts.rotate||0,()=>{
  if(!opts.jump)this.oval(-8,10,162,19,'#0b302847');
  c.save();c.translate(-110,-110);c.rotate(Math.sin(t*1.8)*.13+(opts.scared?-.4:0));this.line('M 0 0 C -102 -22 -104 -154 -47 -166 C -18 -176 -18 -127 -45 -133','#aa6539',31);this.line('M 0 -5 C -87 -29 -90 -144 -47 -151','#e4a363',20);for(let i=0;i<3;i++)this.line(`M ${-72-i*3} ${-45-i*29} l -15 -5`,'#985a35',9);c.restore();
  this.paw(-80,-102,cycle+Math.PI,false,walk,opts.jump?.8:0);this.paw(64,-105,cycle,false,walk,opts.jump?-.9:0);
  let body=c.createLinearGradient(0,-225,0,0);body.addColorStop(0,'#edac68');body.addColorStop(.5,'#d98a4c');body.addColorStop(1,'#b96939');
  this.oval(-13,-143,130,72,body,-.08);this.oval(80,-129,49,73,'#f5c785',-.14);
  for(let i=0;i<3;i++)this.path(`M ${-75+i*39} -203 Q ${-60+i*39} -169 ${-66+i*39} -150 Q ${-43+i*39} -164 ${-46+i*39} -201 Z`,'#a55b36');
  this.paw(-91,-101,cycle,true,walk,opts.jump?.8:0);this.paw(71,-99,cycle+Math.PI,true,walk,opts.jump?-.9:0);
  this.group(96,-230,1,opts.head||Math.sin(t*1.1)*.025,()=>{
   this.path('M -61 -24 L -76 -101 Q -70 -113 -57 -106 L -14 -64 M 31 -64 L 74 -107 Q 88 -105 85 -90 L 78 -14 Z','#c17743');
   this.path('M -54 -49 L -63 -90 L -28 -62 M 47 -62 L 72 -91 L 68 -43 Z','#ddaa98');
   let face=c.createLinearGradient(0,-72,0,60);face.addColorStop(0,'#f2b872');face.addColorStop(.7,'#df9453');face.addColorStop(1,'#f5c689');this.oval(3,-5,83,76,face);
   this.path('M -38 -74 L -26 -41 L -13 -71 M -7 -80 L 0 -44 L 10 -78 M 22 -73 L 29 -42 L 42 -69','#a66037');
   this.path('M -75 -16 L -51 -8 L -72 0 M 79 -18 L 59 -10 L 78 -3','#ae6238');
   let blink=opts.sleep?0:(Math.sin(t*.9)> .992?.08:1);let wide=opts.scared?1.15:1;
   for(let i=0;i<2;i++)this.group(-27+i*63,-9,1,0,()=>{if(blink<.2){this.line('M -18 0 Q 0 13 19 0','#513e2f',4)}else{this.oval(0,0,23,27*blink*wide,'#fff2cb');this.oval(5,1,13,22*blink*wide,'#88ac6b');this.oval(7,1,6,20*blink*wide,'#263c33');this.oval(10,-8,5,6,'#fffbe7');this.oval(3,5,2,2,'#fffbe7')}});
   this.oval(-13,32,30,23,'#ffe6bc');this.oval(23,32,30,23,'#ffe6bc');this.path('M -5 19 Q 5 12 16 20 L 6 30 Z','#ae6259');this.line('M 6 30 L 6 40 Q -2 47 -10 40 M 6 40 Q 16 49 24 40','#7a4a39',2);
   for(let i=0;i<3;i++){this.line(`M -32 ${28+i*9} L -92 ${18+i*16}`,'#513f34aa',1.8);this.line(`M 43 ${28+i*9} L 99 ${15+i*17}`,'#513f34aa',1.8)}
  });
  this.path('M 39 -175 Q 95 -151 143 -181 L 144 -161 Q 95 -132 40 -155 Z','#cf675a');this.path('M 80 -150 L 123 -149 L 106 -99 L 80 -120 Z','#ef9880');this.line('M 96 -145 L 105 -111','#b9544d',2);
 })}
 sleepingCat(x,y,s,t){this.group(x,y,s,0,()=>{this.oval(0,0,170,25,'#071c2c66');this.oval(0,-65,144,81,'#d88c54');for(let i=0;i<4;i++)this.path(`M ${-90+i*37} -121 q 20 25 10 43 q 25 -20 16 -53 Z`,'#a66643');this.group(86,-94,1,.16,()=>{this.path('M -65 -21 L -63 -90 L -18 -57 M 22 -55 L 76 -86 L 75 -17 Z','#de9a64');this.oval(3,-5,79,62,'#efb777');this.oval(0,23,48,25,'#ffe4b6');this.line('M -43 -5 q 17 18 32 0 M 21 -5 q 16 18 31 -1','#59432f',4);this.path('M -3 17 L 10 17 L 5 25 Z','#ac695c');this.line('M 5 25 L 5 31','#865c48',2);this.line('M -38 20 L -81 12 M -39 31 L -87 33 M 43 19 L 83 10 M 45 31 L 88 34','#796046',2)});this.line('M -111 -49 Q -148 19 -50 29 Q 48 39 80 0','#edb579',34);this.path('M 70 -45 L 119 -34 L 93 -10 Z','#d9786b');this.oval(-65,-50+Math.sin(t*1.8)*2,25,38,'#eaa668',-.4)})}
 butterfly(x,y,s,t){this.group(x,y,s,Math.sin(t*2)*.1,()=>{let flap=.25+.75*Math.abs(Math.sin(t*11));this.group(0,0,flap,0,()=>{this.oval(-22,-17,25,33,'#4cbfdd',-.35);this.oval(22,-17,25,33,'#71d5e4',.35);this.oval(-18,17,19,21,'#387da9');this.oval(18,17,19,21,'#4da2c4');this.oval(-22,-24,8,14,'#b1edf0',-.3);this.oval(22,-24,8,14,'#d1ffff',.3)});this.line('M 0 29 L 0 -34','#203d4c',5);this.line('M 0 -29 Q -12 -48 -17 -44 M 0 -29 Q 11 -48 16 -44','#203d4c',2)})}
 frog(x,y,s,t){this.group(x,y,s,0,()=>{this.oval(0,3,63,9,'#0a302e33');this.oval(-37,-10,29,16,'#51885b',-.2);this.oval(37,-10,29,16,'#51885b',.2);this.oval(0,-23,46,31,'#84b563');this.oval(0,-10,33,16,'#cbdd96');for(let i=0;i<2;i++){this.oval(-25+i*50,-47,20,21,'#85b769');this.oval(-25+i*50,-48,13,14,'#f8efb3');this.oval(-22+i*50,-48,6,10,'#24443b');this.oval(-20+i*50,-52,2.5,3,'#fffce0')}this.line('M -18 -18 Q 0 -4 18 -18','#3e6944',2)})}
 river(u,night=false){this.path('M 850 600 Q 1120 668 1200 786 Q 1440 840 1920 858 L 1920 1080 L 280 1080 Q 975 861 950 780 Q 1030 685 850 600 Z',night?'#326778':'#5daeb0');for(let i=0;i<45;i++){let y=660+i*10,x=920+Math.sin(i*.12)*120+rand(i+111)*650;let width=30+rand(i)*85;this.line(`M ${x+Math.sin(this.t*1.5+i)*12} ${y} l ${width} -2`,night?'#a4d4c433':'#d4f7e966',2)}if(!night){this.path('M 1480 816 Q 1710 772 1920 840 L 1920 1080 L 1380 1080 Q 1450 941 1480 816 Z','#91a475');for(let i=0;i<3;i++){this.oval(766+i*258,879-i*14,98,28,'#426a64');this.oval(759+i*258,867-i*14,94,22,'#9fb1a0');this.oval(737+i*258,860-i*14,55,12,'#c0cbb0')}}}
 // Text is painted last (after the foreground) so vines and leaves never cut through letters.
 title(title,sub,x,y,alpha=1){const c=this.c;c.save();c.globalAlpha=alpha;c.textAlign='left';c.shadowColor='#102d3470';c.shadowBlur=16;c.fillStyle='#fff4d5';c.font='700 78px StorySerif';c.fillText(title,x,y);c.shadowBlur=0;c.font='24px sans-serif';c.fillStyle='#d8e6c5';c.fillText(sub,x+3,y+49);c.restore()}
 chapter(n,title){const c=this.c;c.save();c.globalAlpha=.88;c.textAlign='left';c.fillStyle='#ecf0d5';c.font='18px sans-serif';c.fillText(`${String(n).padStart(2,'0')}   /   ${title.toUpperCase()}`,145,107);c.restore()}
 draw(key,time,duration,index=0,chapterTitle=''){
  const scene=SCENES[key];if(!scene)throw new Error(`No scene painter named "${key}" in scene-renderer.js`);
  const c=this.c;this.t=time;this.u=clamp(time/duration);const u=this.u,t=time;
  c.clearRect(0,0,W,H);
  this.backdrop(scene.mood,u,scene.skyBack,scene.skyFront);
  scene.paint(this,u,t);
  this.foreground(scene.mood);
  if(scene.text)scene.text(this,u,t,{n:index+1,chapter:chapterTitle,story:STORY()});
  // Film opens and ends on artwork; transitions are editorial cuts, not blank cards.
 }
}

/* ===================== 2. SCENES (PER-VIDEO) =====================
   Replace these painters for a new story. Each entry:
     mood:     'day' | 'rain' | 'night' (backdrop and foreground palette)
     skyBack:  optional (j,u,t) painted before the ridges and trunks
     skyFront: optional (j,u,t) painted after the trunks (moons, big shapes that must stay visible)
     paint:    (j,u,t) the characters and props; u is scene progress 0..1, t is seconds into the scene
     text:     optional (j,u,t,{n,chapter,story}) painted after the foreground
   j is the StoryRenderer, so j.cat(...), j.frog(...), j.c (the 2D context) are all available. */
const SCENES={
 dawn:{mood:'day',
  paint(j,u,t){j.cat(lerp(470,1080,ease(u)),830,1.12,t);j.butterfly(1220+u*150,550+Math.sin(t*1.3)*45,.5,t)},
  text(j,u,t,{story}){const c=j.c,a=1-ease((u-.73)/.2),tx=story.text||{};j.title(tx.titleLine1||'','',170,245,a);c.save();c.globalAlpha=a;c.fillStyle='#fff2cb';c.font='700 89px StorySerif';c.fillText(tx.titleLine2||'',170,351);c.font='24px sans-serif';c.fillStyle='#e5efd2';c.fillText(tx.tagline||'',173,403);c.restore()}},
 butterfly:{mood:'day',
  paint(j,u,t){let startle=Math.sin(clamp((u-.50)/.24)*Math.PI);j.cat(700-65*startle,885-85*startle,1.66,t,{walk:false,scared:startle>.25,head:-.06-startle*.09});let fp=clamp((u-.45)/.34);j.frog(1230+fp*155,848-Math.sin(fp*Math.PI)*180,1.32,t);j.butterfly(1170+Math.sin(u*4)*220,320+Math.sin(t*1.8)*60,1.1,t)},
  text(j,u,t,{n,chapter}){j.chapter(n,chapter)}},
 river:{mood:'day',
  paint(j,u,t){const c=j.c;j.river(u);let jump=clamp((u-.34)/.40);let xx=lerp(575,1390,ease(jump));let yy=855-Math.sin(jump*Math.PI)*210;j.cat(xx,yy,1.04,t,{walk:jump===0||jump===1,jump:jump>0&&jump<1,rotate:Math.sin(jump*TAU)*.11,head:-.08});if(u>.70){let rr=(u-.70)*270;c.save();c.globalAlpha=1-clamp((u-.70)/.28);for(let i=0;i<8;i++)j.oval(1340+Math.cos(i)*rr,910+Math.sin(i)*rr*.22,3,3,'#d6faf0');c.restore()}},
  text(j,u,t,{n,chapter}){j.chapter(n,chapter)}},
 rain:{mood:'rain',
  paint(j,u,t){const c=j.c,sway=Math.sin(t)*.025;
   // The stalk rises behind her back, left of her head, and the canopy is painted after her, so nothing crosses her face.
   j.group(1020,500,1,sway,()=>j.line('M -40 400 Q -130 120 0 -85','#456544',15));
   j.cat(965,900,1.35,t,{walk:false,head:-.1});
   j.group(1020,500,1,sway,()=>{j.path('M -445 -14 Q -240 -253 10 -222 Q 271 -227 460 -28 Q 175 -89 0 0 Q -228 -90 -445 -14 Z','#518565');for(let i=-3;i<=3;i++)j.line(`M 0 -217 Q ${i*67} -90 ${i*130} -30`,'#abc48977',3)});
   for(let i=0;i<170;i++){let x=(rand(i+81)*2100-t*130)%2100,y=(rand(i+91)*1400+t*630)%1300-130;if(x>660&&x<1390&&y>520&&y<970)continue;j.line(`M ${x} ${y} l -12 37`,'#c7e6e955',2)}
   if(u<.15){c.fillStyle=`rgba(225,239,226,${Math.max(0,Math.sin(u*100))*.16})`;c.fillRect(0,0,W,H)}
   for(let i=0;i<10;i++){let rr=(t*.9+rand(i))%1;c.save();c.globalAlpha=(1-rr)*.45;c.strokeStyle='#c6dad1';c.lineWidth=2;c.beginPath();c.ellipse(300+i*153,940+rand(i)*60,rr*35,rr*8,0,0,TAU);c.stroke();c.restore()}},
  text(j,u,t,{n,chapter}){j.chapter(n,chapter)}},
 fireflies:{mood:'night',
  paint(j,u,t){const c=j.c;j.cat(865,912,1.42,t,{walk:false,head:-.12+Math.sin(t*.6)*.07});for(let i=0;i<44;i++){let a=t*.28+i,x=300+rand(i+410)*1370+Math.sin(a)*35,y=210+rand(i+215)*630+Math.cos(a*1.3)*24;let alpha=.3+.7*Math.pow(Math.sin(t*1.7+i),2);c.save();c.globalAlpha=alpha;c.fillStyle=j.gradient(x,y,29,'#e4eda475','#e4efa000');c.fillRect(x-30,y-30,60,60);j.oval(x,y,2.6,3,'#f2f5b1');c.restore()}},
  text(j,u,t,{n,chapter}){j.chapter(n,chapter)}},
 home:{mood:'night',
  skyBack(j,u,t){for(let i=0;i<65;i++){let x=rand(i+780)*W,y=rand(i+235)*600;j.oval(x,y,1.2+rand(i)*1.5,1.2+rand(i)*1.5,`rgba(233,239,193,${.25+.5*Math.abs(Math.sin(t*.7+i))})`)}},
  skyFront(j){j.crescent(1430,380,62,1454,358,57,'#efeac2')},
  paint(j,u,t){j.river(u,true);j.path('M 0 846 Q 440 756 948 882 Q 1066 970 1090 1080 L 0 1080 Z','#456451');j.sleepingCat(710,917,1.35,t);for(let i=0;i<16;i++){let x=230+rand(i+21)*1550+Math.sin(t+i)*15,y=430+rand(i+90)*410;j.oval(x,y,2,2,`rgba(220,235,155,${.3+.5*Math.abs(Math.sin(t+i))})`)}},
  text(j,u,t,{n,chapter,story}){const tx=story.text||{};j.title(tx.closing||'',tx.closingSub||'',190,300,ease((u-.04)/.2));j.chapter(n,chapter)}},
};

window.StoryRenderer=StoryRenderer;
window.StoryScenes=SCENES;
})();
