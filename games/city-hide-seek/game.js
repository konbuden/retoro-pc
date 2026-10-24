(() => {
  'use strict';
  const canvas=document.getElementById('game'), ctx=canvas.getContext('2d');
  const status=document.getElementById('status'), effect=document.getElementById('effect'), startButton=document.getElementById('start');
  const W=320,H=200,T=10,R=3, rows=18,cols=32;
  const buildings=[];
  for(let y=4;y<17;y+=5)for(let x=4;x<30;x+=6)buildings.push({x:x*T,y:y*T,w:30,h:30});
  const keys=new Set(), touch={up:new Set(),down:new Set(),left:new Set(),right:new Set()};
  const dirs={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
  const codes={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
  let player,oni,items,mode='ready',elapsed=0,blind=0,boost=0,previous=0,route=[],repath=0,target=null,lastSeen=null,respawn=0,focused=true;
  function free(x,y,r=R){return x>=r&&x<=W-r&&y>=22+r&&y<=H-r&&!buildings.some(b=>x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h);}
  function reset(){player={x:25,y:185};oni={x:295,y:25};items=[{x:25,y:105,type:'B'},{x:185,y:185,type:'S'},{x:145,y:35,type:'S'},{x:305,y:135,type:'B'}];elapsed=blind=boost=respawn=0;route=[];target=lastSeen=null;repath=0;}
  function clear(){keys.clear();for(const [name,set] of Object.entries(touch)){set.clear();document.getElementById(name).classList.remove('active');}}
  function start(){clear();reset();mode='playing';status.textContent='PLAYING — 建物を使って逃げよう';startButton.textContent='RESTART ↻';previous=0;}
  function finish(win){mode=win?'win':'over';clear();status.textContent=win?'YOU WIN — 60秒逃げ切った！':'GAME OVER — 鬼につかまった！';startButton.textContent='RETRY ▶';}
  function cell(p){return {x:Math.floor(p.x/T),y:Math.floor(p.y/T)};}
  function path(from,to){
    const s=cell(from),g=cell(to),id=p=>p.y*cols+p.x;
    const queue=[s], seen=new Set([id(s)]), parent=new Map();
    for(let i=0;i<queue.length;i++){
      const p=queue[i];if(id(p)===id(g)){const out=[];let k=id(p);while(k!==id(s)){out.unshift({x:(k%cols)*T+5,y:Math.floor(k/cols)*T+5});k=parent.get(k);}return out;}
      for(const [dx,dy] of Object.values(dirs)){const n={x:p.x+dx,y:p.y+dy},k=id(n);if(n.x<0||n.x>=cols||n.y<2||n.y>=20||seen.has(k)||!free(n.x*T+5,n.y*T+5))continue;seen.add(k);parent.set(k,id(p));queue.push(n);}
    }return [];
  }
  function visible(){const d=Math.hypot(player.x-oni.x,player.y-oni.y);if(blind>0||d>112)return false;for(let i=0;i<=d;i+=2)if(!free(oni.x+(player.x-oni.x)*i/Math.max(d,1),oni.y+(player.y-oni.y)*i/Math.max(d,1),0))return false;return true;}
  function randomPoint(){let p;do{p={x:Math.floor(Math.random()*cols)*T+5,y:(2+Math.floor(Math.random()*rows))*T+5};}while(!free(p.x,p.y));return p;}
  function move(p,dx,dy){if(free(p.x+dx,p.y))p.x+=dx;if(free(p.x,p.y+dy))p.y+=dy;}
  function update(dt){
    if(mode!=='playing')return;
    blind=Math.max(0,blind-dt);boost=Math.max(0,boost-dt);
    let dx=0,dy=0;for(const [name,d] of Object.entries(dirs))if(keys.has(name)||touch[name].size){dx+=d[0];dy+=d[1];}
    const len=Math.hypot(dx,dy)||1,speed=boost>0?76:48;
    move(player,dx/len*speed*dt,dy/len*speed*dt);
    for(const item of items){if(!item.used&&Math.hypot(player.x-item.x,player.y-item.y)<8){item.used=true;if(item.type==='B')blind=5;else boost=4;}}
    const sees=visible();if(sees)lastSeen={...player};
    repath-=dt;
    if(repath<=0){
      if(lastSeen){target={...lastSeen};if(!sees&&Math.hypot(oni.x-target.x,oni.y-target.y)<8){lastSeen=null;target=null;}}
      if(!target||(!lastSeen&&Math.hypot(oni.x-target.x,oni.y-target.y)<8))target=randomPoint();
      route=path(oni,target);repath=.22;
    }
    let travel=(blind>0?22:sees?46:34)*dt;
    while(route.length&&travel>0){const p=route[0],dist=Math.hypot(p.x-oni.x,p.y-oni.y);if(dist<=travel){move(oni,p.x-oni.x,p.y-oni.y);route.shift();travel-=dist;}else{move(oni,(p.x-oni.x)/dist*travel,(p.y-oni.y)/dist*travel);travel=0;}}
    // A final direct step makes contact possible within the destination tile.
    if(sees&&!route.length){const d=Math.hypot(player.x-oni.x,player.y-oni.y);if(d>0)move(oni,(player.x-oni.x)/d*travel,(player.y-oni.y)/d*travel);}
    if(Math.hypot(player.x-oni.x,player.y-oni.y)<R*2){finish(false);return;}
    elapsed=Math.min(60,elapsed+dt);if(elapsed>=60){finish(true);return;}
    respawn+=dt;if(respawn>=10){respawn=0;const used=items.find(i=>i.used);if(used)Object.assign(used,randomPoint(),{used:false});}
    effect.textContent=[blind>0?'目隠し '+blind.toFixed(1)+'秒':'',boost>0?'加速 '+boost.toFixed(1)+'秒':''].filter(Boolean).join(' / ')||(sees?'鬼に見つかった！ 曲がり角へ！':'建物で視線を切って隠れよう');
  }
  function text(t,x,y,color='#e7f5ff',size=8){ctx.fillStyle=color;ctx.font=`${size}px monospace`;ctx.textAlign='left';ctx.fillText(t,x,y);}
  function person(p,color){ctx.fillStyle='#0008';ctx.fillRect(Math.round(p.x)-3,Math.round(p.y)+3,8,2);ctx.fillStyle=color;ctx.fillRect(Math.round(p.x)-2,Math.round(p.y)-4,4,3);ctx.fillRect(Math.round(p.x)-3,Math.round(p.y),6,4);ctx.fillStyle='#fff';ctx.fillRect(Math.round(p.x),Math.round(p.y)-3,1,1);}
  function draw(){
    ctx.fillStyle='#172638';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#364455';for(let x=15;x<W;x+=60)for(let y=25;y<H;y+=14)ctx.fillRect(x,y,1,5);
    for(const b of buildings){ctx.fillStyle='#090e18';ctx.fillRect(b.x+3,b.y+3,b.w,b.h);ctx.fillStyle='#293a59';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.fillStyle='#4b6381';ctx.fillRect(b.x,b.y,b.w,2);ctx.fillStyle='#1a2941';ctx.fillRect(b.x+5,b.y+6,b.w-10,b.h-12);ctx.fillStyle='#fff389';for(let x=b.x+5;x<b.x+b.w-3;x+=8)ctx.fillRect(x,b.y+b.h-5,3,2);}
    for(const i of items)if(!i.used){ctx.fillStyle=i.type==='B'?'#c39aff':'#fff389';ctx.fillRect(i.x-4,i.y-5,9,10);text(i.type,i.x-2,i.y+2,'#09101a',8);}
    person(player,'#45ffe3');person(oni,blind>0?'#a693c7':'#ff518d');if(blind>0){ctx.fillStyle='#fff';ctx.fillRect(Math.round(oni.x)-3,Math.round(oni.y)-3,6,2);}
    ctx.fillStyle='#050c17';ctx.fillRect(0,0,W,20);text('TIME '+String(Math.ceil(60-elapsed)).padStart(2,'0'),6,12,'#45ffe3');text('YOU',89,12,'#45ffe3');text('ONI',122,12,'#ff518d');text(blind>0?'BLIND':visible()?'CHASE':'SEARCH',165,12,'#fff389');text('ESCAPE 60s',254,12);
    ctx.fillStyle='#45ffe3';ctx.fillRect(0,18,W*(1-elapsed/60),2);
    if(mode!=='playing'){ctx.fillStyle='#020611ed';ctx.fillRect(26,65,268,77);ctx.strokeStyle=mode==='over'?'#ff518d':'#45ffe3';ctx.strokeRect(26.5,65.5,267,76);ctx.textAlign='center';ctx.font='bold 16px monospace';ctx.fillStyle=mode==='over'?'#ff518d':'#45ffe3';ctx.fillText(mode==='ready'?'CITY HIDE & SEEK':mode==='win'?'YOU ESCAPED!':'CAUGHT!',160,89);ctx.font='8px monospace';ctx.fillStyle='#e7f5ff';ctx.fillText(mode==='ready'?'SURVIVE THE CITY FOR 60 SECONDS':'SURVIVED '+elapsed.toFixed(1)+' / 60.0 SECONDS',160,110);ctx.fillStyle='#fff389';ctx.fillText(mode==='ready'?'PRESS START / ENTER':'PRESS RETRY / ENTER',160,130);}
  }
  for(const name of Object.keys(touch)){const b=document.getElementById(name);b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);touch[name].add(e.pointerId);b.classList.add('active');});const release=e=>{touch[name].delete(e.pointerId);b.classList.toggle('active',touch[name].size>0);};for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,release);}
  window.addEventListener('keydown',e=>{if(codes[e.code]){e.preventDefault();keys.add(codes[e.code]);}if(e.code==='Enter'&&!e.repeat&&mode!=='playing'){e.preventDefault();start();}});
  window.addEventListener('keyup',e=>{if(codes[e.code])keys.delete(codes[e.code]);});
  window.addEventListener('blur',()=>{focused=false;clear();previous=0;});window.addEventListener('focus',()=>{focused=true;previous=0;});
  document.addEventListener('visibilitychange',()=>{clear();previous=0;});startButton.addEventListener('click',start);
  function frame(now){const dt=previous?Math.min((now-previous)/1000,.04):0;previous=now;if(!document.hidden&&focused)update(dt);draw();requestAnimationFrame(frame);}
  reset();draw();requestAnimationFrame(frame);
})();
