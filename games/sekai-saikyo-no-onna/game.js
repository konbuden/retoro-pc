(() => {
  'use strict';
  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
  const status = document.getElementById('status'), startButton = document.getElementById('start');
  const soundButton = document.getElementById('sound');
  const model = X1Duel.createGame(), state = model.game;
  const queued = new Set();
  const keys = new Set(), touches = Object.fromEntries(['left','right','punch','kick','jump'].map(k => [k,new Set()]));
  const bindings = {ArrowLeft:'left',Numpad4:'left',Digit4:'left',ArrowRight:'right',Numpad6:'right',Digit6:'right',
    Numpad1:'punch',Digit1:'punch',KeyZ:'punch',Numpad2:'kick',Digit2:'kick',KeyX:'kick',
    Numpad3:'jump',Digit3:'jump',KeyC:'jump'};
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
      button.classList.add('active');if(['punch','kick','jump'].includes(name))queued.add(name);unlockSound();
    });
    const release=event=>{
      ids.delete(event.pointerId);button.classList.toggle('active',ids.size>0);
      if(event.type==='pointerup')unlockSound();
    };
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,release);
  }
  window.addEventListener('keydown',event=>{
    if (bindings[event.code]) { event.preventDefault();keys.add(bindings[event.code]);if(['punch','kick','jump'].includes(bindings[event.code]))queued.add(bindings[event.code]);unlockSound(); }
    else if (event.code==='Enter' && !event.repeat && !['fight','countdown'].includes(state.phase)) {
      event.preventDefault();start();
    }
  });
  window.addEventListener('keyup',event=>keys.delete(bindings[event.code]));
  function suspend() { paused=true;previous=0;clearInput();stopSound();announce(); }
  function resume() { if(!document.hidden){paused=false;previous=0;announce();} }
  window.addEventListener('blur',suspend);window.addEventListener('focus',resume);
  document.addEventListener('visibilitychange',()=>document.hidden?suspend():resume());
  function announce() {
    status.textContent=paused && ['fight','countdown'].includes(state.phase)?'PAUSED — 対戦を一時停止':
      ({ready:'READY — 対戦待機',countdown:'READY — 構えて！',fight:'FIGHT — 間合いを測れ',
        won:'YOU WIN — 勝利！',lost:'YOU LOSE — 再挑戦できます',draw:'DRAW — 引き分け'})[state.phase];
    if(['won','lost','draw'].includes(state.phase))startButton.textContent='RETRY ▶';
  }
  function text(value,x,y,color='#fff',size=8,align='left') {
    ctx.fillStyle=color;ctx.font=`${size}px monospace`;ctx.textAlign=align;ctx.fillText(value,x,y);
  }
  // Reconstructed pixel silhouettes, not extracted from the partly illegible DATA rows.
  function makeSprite(female,pose) {
    const surface=document.createElement('canvas');surface.width=36;surface.height=40;
    const c=surface.getContext('2d');c.fillStyle='#eaffdf';
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
    c.fillStyle='#061409';rect(17,5,1,1);rect(10,21,8,2);rect(10,3,5,2);c.fillStyle='#eaffdf';
    const arms=pose==='punch'?[[[10,14],[6,18],[12,19]],[[17,14],[25,14],[32,13]]]:
      pose==='kick'?[[[10,14],[6,19],[13,19]],[[17,14],[22,11],[25,12]]]:
      pose==='hurt'?[[[10,14],[5,9],[4,5]],[[17,14],[24,12],[27,9]]]:
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
  for(const female of [false,true])for(const pose of ['stance','walk1','walk2','punch','kick','jump','hurt'])
    sprites[`${female}-${pose}`]=makeSprite(female,pose);
  function drawFighter(actor,female) {
    const pose=actor.flash>0?'hurt':actor.action || (actor.y<model.floor?'jump':
      Math.floor(actor.walk)%3===1?'walk1':Math.floor(actor.walk)%3===2?'walk2':'stance');
    ctx.save();ctx.translate(Math.round(actor.x),Math.round(actor.y));ctx.scale(actor.facing,1);
    if(actor.hp<=0){ctx.rotate(-Math.PI/2);ctx.drawImage(sprites[`${female}-hurt`],-22,-30,72,80);}
    else {if(actor.flash>0)ctx.globalAlpha=.65;ctx.drawImage(sprites[`${female}-${pose}`],-28,-80,72,80);}
    ctx.restore();
  }
  function draw() {
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
    text('YOU',8,12,'#45ffe3');text('SAIKYO',312,12,'#ffb5d0',8,'right');
    text(String(Math.ceil(state.time)).padStart(2,'0'),160,22,'#fff389',16,'center');
    ctx.fillStyle='#173623';ctx.fillRect(8,18,112,7);ctx.fillRect(200,18,112,7);
    ctx.fillStyle='#45ffe3';ctx.fillRect(8,18,112*state.player.hp/100,7);
    ctx.fillStyle='#ffb5d0';ctx.fillRect(312-112*state.rival.hp/100,18,112*state.rival.hp/100,7);
    text('HP '+state.player.hp,8,36,'#b9cfb7',7);text('HP '+state.rival.hp,312,36,'#b9cfb7',7,'right');
    drawFighter(state.player,false);drawFighter(state.rival,true);
    text('4 6:MOVE  1:PUNCH  2:KICK  3:JUMP',160,191,'#b9cfb7',8,'center');
    if(state.phase!=='fight' || paused) {
      const result=['won','lost','draw'].includes(state.phase);
      ctx.fillStyle='#020b05e8';ctx.fillRect(37,51,246,50);ctx.strokeStyle='#4d7654';ctx.strokeRect(37.5,51.5,245,49);
      const heading=paused?'PAUSED':({ready:'X1 KUNG-FU',countdown:'READY',won:'YOU WIN!',lost:'YOU LOSE',draw:'DRAW'})[state.phase];
      text(heading,160,73,result?'#fff389':'#eaffdf',16,'center');
      text(paused?'RETURN TO CONTINUE':result?'PRESS RETRY TO FIGHT':state.phase==='ready'?'PRESS START TO FIGHT':'GET READY...',160,91,'#b9cfb7',8,'center');
    }
  }
  function frame(now) {
    const dt=previous?Math.min((now-previous)/1000,.04):0;previous=now;
    if(!paused && !document.hidden) {
      const input=Object.fromEntries(Object.entries(touches).map(([name,ids])=>[name,ids.size>0||keys.has(name)||queued.has(name)]));
      model.tick(dt,input);queued.clear();
      for(const event of state.events)tone({punch:180,kick:110,jump:440,go:740,end:250}[event],event==='end'?.16:.065);
      if(state.phase!==lastPhase){announce();lastPhase=state.phase;}
    }
    draw();requestAnimationFrame(frame);
  }
  soundLabel();draw();requestAnimationFrame(frame);
})();
