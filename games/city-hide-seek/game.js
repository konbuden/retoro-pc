(() => {
  'use strict';
  const canvas=document.getElementById('game'), ctx=canvas.getContext('2d');
  const status=document.getElementById('status'), effect=document.getElementById('effect'), startButton=document.getElementById('start');
  const W=320,H=200,T=10,R=3, rows=18,cols=32;
  const buildings=[];
  for(let y=4;y<17;y+=5)for(let x=4;x<30;x+=6)buildings.push({x:x*T,y:y*T,w:30,h:30,kind:['bakery','hospital','store','home','cafe'][(buildings.length+Math.floor(y/5))%5]});
  const keys=new Set(), touch={up:new Set(),down:new Set(),left:new Set(),right:new Set()};
  const dirs={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
  const codes={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
  let player,oni,items,mode='ready',elapsed=0,blind=0,boost=0,previous=0,route=[],repath=0,target=null,lastSeen=null,respawn=0,focused=true;
  const music=(()=>{
    let audio=null,master=null,enabled=true,next=0,step=0,current='',voices=new Set();
    const button=document.getElementById('bgm'),label=document.getElementById('music-state');
    const tracks={
      normal:{tempo:112,notes:[69,0,72,76,74,0,72,67,69,0,72,79,76,74,72,0],bass:[45,48,43,40]},
      chase:{tempo:148,notes:[69,70,76,70,69,70,77,76,69,70,76,79,77,76,70,0],bass:[45,46,45,40]},
      blind:{tempo:92,notes:[76,0,79,0,74,0,72,0,76,0,81,79,74,0,72,0],bass:[48,43,45,43]},
      boost:{tempo:176,notes:[72,76,79,84,79,76,74,79,72,76,81,84,83,79,76,74],bass:[48,45,41,43]},
      both:{tempo:168,notes:[76,79,84,88,86,84,79,76,74,79,83,86,84,79,76,0],bass:[48,43,45,43]}
    };
    function stop(){for(const v of voices){try{v.stop();}catch(_){}}voices.clear();current='';next=0;}
    function unlock(){
      if(!enabled)return;
      try{
        const AC=window.AudioContext||window.webkitAudioContext;
        if(!AC){label.textContent='このブラウザは音声非対応';return;}
        if(!audio){audio=new AC();master=audio.createGain();master.gain.value=.16;master.connect(audio.destination);audio.onstatechange=()=>{if(audio.state!=='running'){stop();label.textContent='音声を再開するにはBGMボタン';}};}
        if(audio.state!=='running')audio.resume().catch(()=>{label.textContent='音声を再開するにはBGMボタン';});
      }catch(_){label.textContent='音声を再開するにはBGMボタン';}
    }
    function note(midi,time,duration,volume,type){
      if(!midi)return;
      const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=440*2**((midi-69)/12);
      g.gain.setValueAtTime(0,time);g.gain.linearRampToValueAtTime(volume,time+.008);g.gain.exponentialRampToValueAtTime(.001,time+duration);
      o.connect(g);g.connect(master);voices.add(o);o.onended=()=>{voices.delete(o);o.disconnect();g.disconnect();};o.start(time);o.stop(time+duration+.01);
    }
    function tick(){
      if(!enabled||mode!=='playing'||document.hidden||!focused){if(current)stop();return;}
      if(!audio||audio.state!=='running')return;
      const name=blind>0&&boost>0?'both':boost>0?'boost':blind>0?'blind':visible()?'chase':'normal';
      if(name!==current){stop();current=name;step=0;next=audio.currentTime+.02;}
      const t=tracks[name],beat=60/t.tempo/2;
      label.textContent={normal:'BGM：放課後のかくれんぼ',chase:'BGM：鬼が来た！',blind:'BGM：こっそり目隠し',boost:'BGM：全速力ダッシュ',both:'BGM：目隠し ＋ ダッシュ'}[name];
      if(next<audio.currentTime)next=audio.currentTime+.01;
      while(next<audio.currentTime+.12){note(t.notes[step%16],next,beat*.75,.28,name==='blind'?'triangle':'square');if(step%4===0)note(t.bass[Math.floor(step/4)%4],next,beat*2.8,.32,'triangle');step++;next+=beat;}
    }
    button.addEventListener('click',()=>{
      if(enabled&&(!audio||audio.state!=='running')){unlock();return;}
      enabled=!enabled;button.textContent=enabled?'BGM ON ♪':'BGM OFF';button.setAttribute('aria-pressed',String(enabled));
      if(enabled)unlock();else{stop();label.textContent='BGM：オフ';}
    });
    for(const e of ['pointerdown','keydown'])document.addEventListener(e,()=>{if(mode==='playing')unlock();});
    window.addEventListener('pagehide',stop);
    return {unlock,tick,stop};
  })();
  function free(x,y,r=R){return x>=r&&x<=W-r&&y>=22+r&&y<=H-r&&!buildings.some(b=>x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h);}
  function reset(){player={x:25,y:185};oni={x:295,y:25};items=[{x:25,y:105,type:'B'},{x:185,y:185,type:'S'},{x:145,y:35,type:'S'},{x:305,y:135,type:'B'}];elapsed=blind=boost=respawn=0;route=[];target=lastSeen=null;repath=0;}
  function clear(){keys.clear();for(const [name,set] of Object.entries(touch)){set.clear();document.getElementById(name).classList.remove('active');}}
  function start(){clear();reset();mode='playing';status.textContent='PLAYING — 建物を使って逃げよう';startButton.textContent='RESTART ↻';previous=0;music.unlock();}
  function finish(win){mode=win?'win':'over';clear();status.textContent=win?'YOU WIN — 60秒逃げ切った！':'GAME OVER — 鬼につかまった！';startButton.textContent='RETRY ▶';music.stop();}
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
  function pixels(pattern,p,palette){
    const x=Math.round(p.x)-4,y=Math.round(p.y)-7;
    pattern.forEach((row,j)=>[...row].forEach((c,i)=>{if(palette[c]){ctx.fillStyle=palette[c];ctx.fillRect(x+i,y+j,1,1);}}));
  }
  function person(p,isOni){
    ctx.fillStyle='#0006';ctx.fillRect(Math.round(p.x)-4,Math.round(p.y)+4,9,2);
    const step=Math.floor(elapsed*10)%2;
    if(isOni){
      pixels(['.Y.....Y.','.YYHHHYY.','..HHHHH..','.RRRRRRR.','.RKRKRKR.','.RWRRRWR.','..RWWW R.'.replace(' ',''),'..RKKKR..','...PPP...','..PPPPP..','...P.P...'],p,{Y:'#ffe89a',H:'#292039',R:'#ed5860',K:'#3b172a',W:'#fff4d7',P:'#9673c5'});
      if(blind>0){ctx.fillStyle='#e8edff';ctx.fillRect(Math.round(p.x)-3,Math.round(p.y)-3,7,2);}
    }else{
      pixels(['...YYY...','..YYYYY..','.YYYYYYY.','..HSSSH..','..SKSKS..','...SSS...','..BTTTB..','.SBT TBS.'.replace(' ',''),'..BTTTB..','...NNN...',step?'...N.N...':'..N...N..'],p,{Y:'#ffe27a',H:'#49362b',S:'#ffd0a3',K:'#362925',B:'#e76059',T:boost>0?'#fff39a':'#63e9dc',N:'#344a7c'});
      if(boost>0){ctx.fillStyle='#fff389';ctx.fillRect(p.x-8,p.y+2,2,1);ctx.fillRect(p.x-7,p.y-1,2,1);}
    }
  }
  function building(b){
    const colors={bakery:['#c77e50','#ffce82'],hospital:['#b8d6db','#eef9ed'],store:['#547b83','#f4f3d0'],home:['#866989','#e7b5b1'],cafe:['#688a68','#e1d1a1']};
    const [roof,wall]=colors[b.kind],x=b.x,y=b.y;
    ctx.fillStyle='#09121b88';ctx.fillRect(x+3,y+3,30,30);
    ctx.fillStyle=wall;ctx.fillRect(x,y,30,30);ctx.fillStyle=roof;ctx.fillRect(x,y,30,14);
    ctx.fillStyle='#ffffff35';ctx.fillRect(x+2,y+2,26,2);
    if(b.kind==='home'){
      ctx.fillStyle='#674369';for(let i=0;i<4;i++)ctx.fillRect(x+2,y+5+i*2,26,1);
    }else if(b.kind==='hospital'){
      ctx.fillStyle='#fff';ctx.fillRect(x+10,y+3,10,9);ctx.fillStyle='#e65463';ctx.fillRect(x+14,y+4,2,7);ctx.fillRect(x+12,y+6,6,2);
    }else if(b.kind==='bakery'){
      ctx.fillStyle='#ffda87';ctx.fillRect(x+10,y+5,11,5);ctx.fillRect(x+12,y+3,7,2);ctx.fillStyle='#a65d37';ctx.fillRect(x+13,y+5,1,3);ctx.fillRect(x+17,y+5,1,3);
    }else if(b.kind==='store'){
      for(let i=0;i<3;i++){ctx.fillStyle=['#57bda1','#fff8e1','#ed8465'][i];ctx.fillRect(x,y+4+i*3,30,3);}
    }else{
      ctx.fillStyle='#fff3ce';ctx.fillRect(x+12,y+5,7,5);ctx.strokeStyle='#fff3ce';ctx.strokeRect(x+19,y+6,2,3);
    }
    ctx.fillStyle='#243b52';ctx.fillRect(x+3,y+23,7,5);ctx.fillRect(x+20,y+23,7,5);ctx.fillRect(x+13,y+22,5,8);
    ctx.fillStyle='#a4e2df';ctx.fillRect(x+4,y+24,5,2);ctx.fillRect(x+21,y+24,5,2);
    ctx.fillStyle='#172331';ctx.fillRect(x+1,y+14,28,7);
    ctx.fillStyle='#fff5da';ctx.font='6px sans-serif';ctx.textAlign='center';ctx.fillText({bakery:'パン屋',hospital:'病院',store:'コンビニ',home:'自宅',cafe:'喫茶店'}[b.kind],x+15,y+20);ctx.textAlign='left';
  }
  function draw(){
    ctx.fillStyle='#172638';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#364455';for(let x=15;x<W;x+=60)for(let y=25;y<H;y+=14)ctx.fillRect(x,y,1,5);
    for(const b of buildings)building(b);
    for(const i of items)if(!i.used){ctx.fillStyle=i.type==='B'?'#c39aff':'#fff389';ctx.fillRect(i.x-4,i.y-5,9,10);text(i.type,i.x-2,i.y+2,'#09101a',8);}
    person(player,false);person(oni,true);
    ctx.fillStyle='#050c17';ctx.fillRect(0,0,W,20);text('TIME '+String(Math.ceil(60-elapsed)).padStart(2,'0'),6,12,'#45ffe3');text('YOU',89,12,'#45ffe3');text('ONI',122,12,'#ff518d');text(blind>0?'BLIND':visible()?'CHASE':'SEARCH',165,12,'#fff389');text('ESCAPE 60s',254,12);
    ctx.fillStyle='#45ffe3';ctx.fillRect(0,18,W*(1-elapsed/60),2);
    if(mode!=='playing'){ctx.fillStyle='#020611ed';ctx.fillRect(26,65,268,77);ctx.strokeStyle=mode==='over'?'#ff518d':'#45ffe3';ctx.strokeRect(26.5,65.5,267,76);ctx.textAlign='center';ctx.font='bold 16px monospace';ctx.fillStyle=mode==='over'?'#ff518d':'#45ffe3';ctx.fillText(mode==='ready'?'CITY HIDE & SEEK':mode==='win'?'YOU ESCAPED!':'CAUGHT!',160,89);ctx.font='8px monospace';ctx.fillStyle='#e7f5ff';ctx.fillText(mode==='ready'?'SURVIVE THE CITY FOR 60 SECONDS':'SURVIVED '+elapsed.toFixed(1)+' / 60.0 SECONDS',160,110);ctx.fillStyle='#fff389';ctx.fillText(mode==='ready'?'PRESS START / ENTER':'PRESS RETRY / ENTER',160,130);}
  }
  for(const name of Object.keys(touch)){const b=document.getElementById(name);b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);touch[name].add(e.pointerId);b.classList.add('active');});const release=e=>{touch[name].delete(e.pointerId);b.classList.toggle('active',touch[name].size>0);};for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,release);}
  window.addEventListener('keydown',e=>{if(codes[e.code]){e.preventDefault();keys.add(codes[e.code]);}if(e.code==='Enter'&&!e.repeat&&mode!=='playing'){e.preventDefault();start();}});
  window.addEventListener('keyup',e=>{if(codes[e.code])keys.delete(codes[e.code]);});
  window.addEventListener('blur',()=>{focused=false;clear();previous=0;music.stop();});window.addEventListener('focus',()=>{focused=true;previous=0;});
  document.addEventListener('visibilitychange',()=>{clear();previous=0;if(document.hidden)music.stop();});startButton.addEventListener('click',start);
  function frame(now){const dt=previous?Math.min((now-previous)/1000,.04):0;previous=now;if(!document.hidden&&focused)update(dt);music.tick();draw();requestAnimationFrame(frame);}
  reset();draw();requestAnimationFrame(frame);
})();
