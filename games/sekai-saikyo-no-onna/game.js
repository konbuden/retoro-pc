(() => {
  'use strict';
  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
  const status = document.getElementById('status'), startButton = document.getElementById('start');
  const soundButton = document.getElementById('sound');
  const model = X1Duel.createGame(), state = model.game;
  const queued = new Set();
  const keys = new Set(), touches = Object.fromEntries(['left','right','punch','kick','jump','guard','special'].map(k => [k,new Set()]));
  const bindings = {ArrowLeft:'left',Numpad4:'left',Digit4:'left',ArrowRight:'right',Numpad6:'right',Digit6:'right',
    Numpad1:'punch',Digit1:'punch',KeyZ:'punch',Numpad2:'kick',Digit2:'kick',KeyX:'kick',
    Numpad3:'jump',Digit3:'jump',KeyC:'jump',KeyD:'guard',Digit0:'guard',Numpad0:'guard',KeyV:'special',Digit5:'special',Numpad5:'special'};
  let previous = 0, paused = false, lastPhase = 'ready', audio = null, soundEnabled = true;
  const soundNodes = new Set();
  function soundLabel() {
    soundButton.textContent = !soundEnabled ? 'SOUND OFF' : audio?.state === 'running' ? 'SOUND ON ♪' : 'SOUND 待機 ♪';
    soundButton.setAttribute('aria-pressed', String(soundEnabled));
  }
  function stopSound() {
    for (const node of soundNodes) { try { node.stop(); } catch (_) {} node.disconnect(); }
    soundNodes.clear();
  }
  async function unlockSound() {
    if (!soundEnabled || document.hidden) return;
    try {
      const AudioEngine = window.AudioContext || window.webkitAudioContext;
      if (!AudioEngine) { soundButton.disabled = true; soundButton.textContent = 'SOUND 非対応'; return; }
      if (!audio) {
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) {}
        audio = new AudioEngine();
        audio.addEventListener('statechange', soundLabel);
      }
      const resumed = audio.resume();
      const source = audio.createBufferSource(); source.buffer = audio.createBuffer(1,1,audio.sampleRate);
      source.connect(audio.destination); source.onended = () => source.disconnect(); source.start(0);
      await resumed; soundLabel();
    } catch (_) { soundButton.textContent = 'SOUND 再試行 ♪'; }
  }
  function tone(frequency, duration = .07) {
    if (!soundEnabled || !audio || audio.state !== 'running' || document.hidden || paused) return;
    const oscillator = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
    oscillator.type = 'square'; oscillator.frequency.setValueAtTime(frequency,now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency*.6,now+duration);
    gain.gain.setValueAtTime(.045,now); gain.gain.exponentialRampToValueAtTime(.001,now+duration);
    oscillator.connect(gain); gain.connect(audio.destination); soundNodes.add(oscillator);
    oscillator.onended=()=>{soundNodes.delete(oscillator);oscillator.disconnect();gain.disconnect();};
    oscillator.start(now); oscillator.stop(now+duration);
  }
  soundButton.addEventListener('click', () => {
    soundEnabled = !(soundEnabled && audio?.state === 'running');
    if (soundEnabled) { unlockSound().then(()=>tone(660,.08)); } else stopSound();
    soundLabel();
  });
  function clearInput() {
    keys.clear();queued.clear();
    for (const [name, ids] of Object.entries(touches)) { ids.clear(); document.getElementById(name).classList.remove('active'); }
  }
  function start() {
    clearInput(); stopSound(); paused=false; previous=0; model.reset();
    unlockSound(); startButton.textContent='RESTART ↻'; announce();
  }
  startButton.addEventListener('click',start);
  for (const [name, ids] of Object.entries(touches)) {
    const button=document.getElementById(name);
    button.addEventListener('pointerdown',event=>{
      event.preventDefault();button.setPointerCapture(event.pointerId);ids.add(event.pointerId);
      button.classList.add('active');if(['punch','kick','jump','special'].includes(name))queued.add(name);unlockSound();
    });
    const release=event=>{
      ids.delete(event.pointerId);button.classList.toggle('active',ids.size>0);
      if(event.type==='pointerup')unlockSound();
    };
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,release);
  }
  window.addEventListener('keydown',event=>{
    if (bindings[event.code]) { event.preventDefault();if(bindings[event.code]!=='special')keys.add(bindings[event.code]);if(!event.repeat&&['punch','kick','jump','special'].includes(bindings[event.code]))queued.add(bindings[event.code]);unlockSound(); }
    else if (event.code==='Enter' && !event.repeat && !['fight','countdown','roundover'].includes(state.phase)) {
      event.preventDefault();start();
    }
  });
  window.addEventListener('keyup',event=>keys.delete(bindings[event.code]));
  function suspend() { paused=true;previous=0;clearInput();stopSound();announce(); }
  function resume() { if(!document.hidden){paused=false;previous=0;announce();} }
  window.addEventListener('blur',suspend);window.addEventListener('focus',resume);
  document.addEventListener('visibilitychange',()=>document.hidden?suspend():resume());
  function announce() {
    status.textContent=paused && ['fight','countdown','roundover'].includes(state.phase)?'PAUSED — 対戦を一時停止':
      ({ready:'READY — 対戦待機',countdown:'READY — 構えて！',fight:'FIGHT — 間合いを測れ',roundover:`ROUND ${state.round} — ${state.roundResult==='won'?'勝利':state.roundResult==='lost'?'敗北':'引き分け'} / 次のラウンドへ`,
        won:'YOU WIN — 勝利！',lost:'YOU LOSE — 再挑戦できます',draw:'DRAW — 引き分け'})[state.phase];
    if(['won','lost','draw'].includes(state.phase))startButton.textContent='RETRY ▶';
  }
  function text(value,x,y,color='#fff',size=8,align='left') {
    ctx.fillStyle=color;ctx.font=`${size}px monospace`;ctx.textAlign=align;ctx.fillText(value,x,y);
  }
  // Reconstructed pixel silhouettes, not extracted from the partly illegible DATA rows.
  function makeSprite(female,pose) {
    const surface=document.createElement('canvas');surface.width=36;surface.height=40;
    const c=surface.getContext('2d');c.fillStyle=female?'#ff9b54':'#71c8ff';
    const rect=(x,y,w,h)=>c.fillRect(x,y,w,h);
    function limb(points,width=3) {
      for(let i=1;i<points.length;i++) {
        const [x1,y1]=points[i-1],[x2,y2]=points[i],steps=Math.max(Math.abs(x2-x1),Math.abs(y2-y1));
        for(let n=0;n<=steps;n++){const f=steps?n/steps:0;rect(Math.round(x1+(x2-x1)*f)-1,Math.round(y1+(y2-y1)*f)-1,width,width);}
      }
    }
    // Profile head, tied hair, loose trousers and a dark sash.
    rect(11,3,7,7);rect(17,6,3,2);rect(10,2,7,3);
    if(female){rect(7,3,4,4);rect(6,6,3,9);rect(10,0,5,3);}else{rect(9,1,6,3);rect(6,4,5,2);}
    rect(13,10,3,2);rect(10,12,8,11);rect(8,15,12,5);
    c.fillStyle='#061409';rect(17,5,1,1);rect(10,21,8,2);rect(10,3,5,2);c.fillStyle=female?'#ff9b54':'#71c8ff';
    const arms=pose==='punch'?[[[10,14],[6,18],[12,19]],[[17,14],[25,14],[32,13]]]:
      pose==='kick'?[[[10,14],[6,19],[13,19]],[[17,14],[22,11],[25,12]]]:
      pose==='hurt'?[[[10,14],[5,9],[4,5]],[[17,14],[24,12],[27,9]]]:
      pose==='guard'?[[[10,14],[19,16],[22,6]],[[17,14],[25,13],[24,5]]]:
      [[[10,14],[6,20],[12,20]],[[17,14],[23,11],[26,12]]];
    arms.forEach(points=>limb(points));
    if(pose==='kick') {
      limb([[14,24],[23,22],[31,16]],4);rect(30,13,5,4);
      limb([[11,24],[9,31],[10,37]],4);rect(8,37,8,3);
    } else if(pose==='jump') {
      limb([[11,24],[6,29],[10,33]],4);limb([[17,24],[24,27],[23,31]],4);rect(9,32,6,3);rect(22,30,7,3);
    } else if(pose==='walk1') {
      limb([[11,24],[6,29],[4,36]],4);limb([[17,24],[21,31],[25,36]],4);rect(3,37,8,3);rect(23,37,8,3);
    } else if(pose==='walk2') {
      limb([[11,24],[13,30],[20,36]],4);limb([[17,24],[14,31],[10,36]],4);rect(19,37,8,3);rect(8,37,8,3);
    } else {
      limb([[11,24],[7,30],[5,36]],4);limb([[17,24],[21,30],[20,36]],4);rect(4,37,8,3);rect(19,37,8,3);
    }
    return surface;
  }
  const sprites={};
  for(const female of [false,true])for(const pose of ['stance','walk1','walk2','punch','kick','jump','hurt','guard'])
    sprites[`${female}-${pose}`]=makeSprite(female,pose);
  function drawFighter(actor,female) {
    const pose=actor.flash>0?'hurt':actor.guarding?'guard':actor.action || (actor.y<model.floor?'jump':
      Math.floor(actor.walk)%3===1?'walk1':Math.floor(actor.walk)%3===2?'walk2':'stance');
    ctx.save();ctx.translate(Math.round(actor.x),Math.round(actor.y));ctx.scale(actor.facing,1);
    if(actor.hp<=0){ctx.rotate(-Math.PI/2);ctx.drawImage(sprites[`${female}-hurt`],-22,-30,72,80);}
    else {if(actor.flash>0)ctx.globalAlpha=.65;ctx.drawImage(sprites[`${female}-${pose}`],-28,-80,72,80);}
    if(actor.guarding){
      ctx.strokeStyle=actor.blockFlash>0?'#ffffff':'#71c8ff';ctx.lineWidth=actor.blockFlash>0?3:1;
      ctx.strokeRect(28,-66,5,43);ctx.lineWidth=1;
    }
    ctx.restore();
    if(actor.guarding)text(actor.blockFlash>0?'BLOCK!':'GUARD',actor.x,actor.y-84,'#71c8ff',7,'center');
  }
  function chanceDisplay(){
    const next=state.nextChance,seconds=Math.ceil(Math.max(0,next-state.age)*10-1e-8)/10;
    const green=!!state.special&&state.special.elapsed>=.9&&state.special.elapsed<=1.35;
    let heading,detail,progress=0,urgent=false;
    if(['won','lost','draw'].includes(state.phase)){
      heading='対戦終了';detail='RETRYで新しい3ラウンドを開始';
    }else if(state.phase==='roundover'){
      heading='ラウンド終了';detail='次のラウンドは開始8秒後に最初のチャンス';
    }else if(state.special){
      const t=state.special.elapsed;
      heading=green?'今！ 必殺／V／5を1回押す！':t<.9?'緑で押すまで '+(Math.ceil((.9-t)*10)/10).toFixed(1)+' 秒':'タイミング終了';
      detail=green?'成功で相手に70HP！ 必殺技は防御不可':t<.9?'まだ押さずに待とう。早押しは自分に30HP':'遅押し・時間切れは自分に30HP';
      progress=Math.min(1,t/2);urgent=true;
    }else if(!Number.isFinite(next)){
      heading='このラウンドの必殺チャンスは終了';detail='通常攻撃と防御で決着をつけよう';progress=1;
    }else{
      heading='必殺チャンスまで '+seconds.toFixed(1)+' 秒';
      detail=state.phase==='fight'?'黄色の予告 → 緑の間に必殺／V／5を1回':'ラウンド開始と同時にカウントダウン';
      progress=Math.max(0,Math.min(1,(state.age-(next===8?0:next-16))/(next===8?8:16)));
      urgent=state.phase==='fight'&&seconds<=3;
    }
    if(paused){heading='一時停止 — '+heading;detail='復帰するまでカウントダウンも停止';}
    const setText=(id,value)=>{const element=document.getElementById(id);if(element.textContent!==value)element.textContent=value;};
    setText('chance-clock',heading);setText('chance-detail',detail);
    document.getElementById('chance-progress').value=progress;
    document.getElementById('chance-panel').classList.toggle('soon',urgent&&!paused);
    document.getElementById('chance-panel').classList.toggle('now',green&&!paused);
    document.getElementById('special').classList.toggle('chance',green&&!paused);
    setText('special-hint',state.special?heading:`ROUND ${state.round}/3 — ${state.wins}勝 ${state.losses}敗 / 必殺技は上のカウントダウンを見て準備`);
    return {heading,urgent,green};
  }
  function draw() {
    const chance=chanceDisplay();
    ctx.imageSmoothingEnabled=false;ctx.fillStyle='#020b05';ctx.fillRect(0,0,320,200);
    // Monochrome-style X1 stage inspired by the magazine's screen captures.
    ctx.fillStyle='#0b2514';ctx.fillRect(0,43,320,120);
    ctx.fillStyle='#11341e';
    for(let x=0;x<320;x+=12){ctx.fillRect(x,81+Math.round(Math.sin(x/23)*9),12,83);}
    ctx.fillStyle='#071b0e';ctx.fillRect(0,122,320,42);
    ctx.strokeStyle='#315f38';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(0,164.5);ctx.lineTo(320,164.5);ctx.stroke();
    ctx.fillStyle='#22472c';ctx.fillRect(0,165,320,15);
    ctx.fillStyle='#0a1e10';for(let row=0;row<3;row++)for(let x=0;x<320;x+=16)ctx.fillRect(x+(row%2)*8,165+row*5,15,4);
    text('YOU',8,12,'#71c8ff');text('RIVAL',312,12,'#ff9b54',8,'right');
    text(String(Math.ceil(state.time)).padStart(2,'0'),160,22,'#fff389',16,'center');
    ctx.fillStyle='#173623';ctx.fillRect(8,18,112,7);ctx.fillRect(200,18,112,7);
    ctx.fillStyle='#71c8ff';ctx.fillRect(8,18,112*state.player.hp/100,7);
    ctx.fillStyle='#ff9b54';ctx.fillRect(312-112*state.rival.hp/100,18,112*state.rival.hp/100,7);
    text('HP '+state.player.hp,8,36,'#b9cfb7',7);text('HP '+state.rival.hp,312,36,'#b9cfb7',7,'right');
    text('R'+state.round+'/3  '+state.wins+'-'+state.losses,160,35,'#fff389',7,'center');
    ctx.fillStyle='#08141f';ctx.fillRect(0,42,320,20);
    text(chance.heading,160,55,chance.green?'#45ffe3':chance.urgent?'#fff389':'#cbdde8',9,'center');
    drawFighter(state.player,false);drawFighter(state.rival,true);
    text('Z/X:ATTACK C:JUMP D/0:GUARD V:BIG',160,191,'#b9cfb7',8,'center');
    if(state.specialFlash>0){
      ctx.fillStyle=state.specialResult==='success'?'#ffe38955':'#ff557755';ctx.fillRect(0,43,320,121);
      if(state.specialResult==='success'){
        ctx.strokeStyle='#fff389';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(state.player.x,state.player.y-42);
        for(let i=1;i<=8;i++)ctx.lineTo(state.player.x+(state.rival.x-state.player.x)*i/8,state.rival.y-42+(i%2?8:-8));
        ctx.stroke();ctx.lineWidth=1;
      }
      text(state.specialResult==='success'?'BREAKDOWN!  -70 HP':'MISS!  YOU -30 HP',160,77,'#fff389',12,'center');
    }
    if(state.special&&state.phase==='fight'&&!paused){
      const t=state.special.elapsed,green=t>=.9&&t<=1.35;
      ctx.fillStyle='#06101cf5';ctx.fillRect(34,48,252,83);ctx.strokeStyle=green?'#45ffe3':'#fff389';ctx.strokeRect(34.5,48.5,251,82);
      text(green?'NOW! PRESS V / 5':'SPECIAL CHANCE!',160,65,green?'#45ffe3':'#fff389',12,'center');
      text('GREEN = -70 HP / MISS = YOU -30 HP',160,80,'#e7f5ff',7,'center');
      ctx.fillStyle='#3c4658';ctx.fillRect(50,90,220,10);ctx.fillStyle='#45b58e';ctx.fillRect(50+220*.9/2,90,220*.45/2,10);
      ctx.fillStyle='#fff';ctx.fillRect(50+Math.min(t/2,1)*218,87,2,16);
      text('WAIT ... GREEN ... PRESS ONCE',160,118,'#fff389',8,'center');
    }
    if(state.phase!=='fight' || paused) {
      const result=['won','lost','draw'].includes(state.phase);
      ctx.fillStyle='#020b05e8';ctx.fillRect(37,51,246,50);ctx.strokeStyle='#4d7654';ctx.strokeRect(37.5,51.5,245,49);
      const heading=paused?'PAUSED':({ready:'BREAKDOWN',countdown:'ROUND '+state.round+' / 3',roundover:state.roundResult==='won'?'ROUND WIN':state.roundResult==='lost'?'ROUND LOST':'ROUND DRAW',won:'YOU WIN!',lost:'YOU LOSE',draw:'DRAW'})[state.phase];
      text(heading,160,73,result?'#fff389':'#eaffdf',16,'center');
      text(paused?'RETURN TO CONTINUE':result?'SCORE '+state.wins+' - '+state.losses+' / PRESS RETRY':state.phase==='roundover'?'NEXT ROUND IN '+Math.ceil(state.intermission):state.phase==='ready'?'PRESS START TO FIGHT':'GET READY...',160,91,'#b9cfb7',8,'center');
    }
  }
  function frame(now) {
    const dt=previous?Math.min((now-previous)/1000,.04):0;previous=now;
    if(!paused && !document.hidden) {
      const input=Object.fromEntries(Object.entries(touches).map(([name,ids])=>[name,name==='special'?queued.has(name):ids.size>0||keys.has(name)||queued.has(name)]));
      model.tick(dt,input);queued.clear();
      for(const event of state.events)tone({punch:180,kick:110,jump:440,block:320,go:740,end:250,chance:880,special:1320,miss:90}[event],['end','special','miss'].includes(event)?.3:.065);
      if(state.phase!==lastPhase){announce();lastPhase=state.phase;}
    }
    draw();requestAnimationFrame(frame);
  }
  soundLabel();draw();requestAnimationFrame(frame);
})();
