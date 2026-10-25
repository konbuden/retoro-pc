const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const noop=()=>{},elements=new Map(),listeners=new Map(),drawn=[],colors=[];let nextFrame,model;
const context=new Proxy({},{get:(_,key)=>key==='fillText'?(t)=>drawn.push(t):noop,set:(_,key,v)=>{if(key==='fillStyle')colors.push(v);return true;}});
function element(id){if(!elements.has(id)){const classes=new Set();elements.set(id,{textContent:'',classes,classList:{remove:(c)=>classes.delete(c),add:(c)=>classes.add(c),toggle:(c,on)=>{if(on)classes.add(c);else classes.delete(c);}},setAttribute:noop,setPointerCapture:noop,addEventListener:(event,fn)=>listeners.set(id+':'+event,fn),getContext:()=>context});}return elements.get(id);}
const sandbox={console,Math,Set,Map,navigator:{},document:{hidden:false,getElementById:element,createElement:()=>({getContext:()=>context}),addEventListener:(event,fn)=>listeners.set('document:'+event,fn)},window:{addEventListener:(event,fn)=>listeners.set('window:'+event,fn)},requestAnimationFrame:fn=>nextFrame=fn};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('games/sekai-saikyo-no-onna/engine.js','utf8'),sandbox);
const create=sandbox.X1Duel.createGame;sandbox.X1Duel.createGame=()=>{model=create(()=>.8);return model;};
vm.runInContext(fs.readFileSync('games/sekai-saikyo-no-onna/game.js','utf8'),sandbox);
function event(key,data={}){listeners.get(key)({preventDefault:noop,...data});}
let now=100;function frame(){now+=16;nextFrame(now);}
assert(drawn.includes('BREAKDOWN'));assert(colors.includes('#71c8ff'));assert(colors.includes('#ff9b54'));
event('start:click');model.game.phase='fight';model.game.special={elapsed:1};event('window:keydown',{code:'KeyV',repeat:false});frame();assert.equal(model.game.rival.hp,30);
model.game.special={elapsed:1};event('window:keydown',{code:'KeyV',repeat:true});frame();assert(model.game.special);assert.equal(model.game.rival.hp,30);
event('window:keyup',{code:'KeyV'});event('special:pointerdown',{pointerId:1});frame();assert.equal(model.game.rival.hp,0);assert.equal(model.game.phase,'roundover');assert(drawn.includes('ROUND WIN'));
frame();assert.equal(model.game.player.hp,100);event('special:pointerup',{pointerId:1});
model.game.phase='fight';model.game.special={elapsed:.2};model.game.rival.hp=100;event('special:pointerdown',{pointerId:2});frame();assert.equal(model.game.player.hp,70);
model.game.special={elapsed:1};event('window:blur');const paused=model.game.special.elapsed;frame();assert.equal(model.game.special.elapsed,paused);assert(drawn.includes('PAUSED'));event('window:focus');frame();frame();assert(model.game.special.elapsed>paused);
for(const phase of ['ready','countdown','roundover','won','lost','draw']){model.game.phase=phase;frame();}
const html=fs.readFileSync('games/sekai-saikyo-no-onna/index.html','utf8');assert(html.includes('<title>ブレーキダウン'));assert(html.includes('id="special"'));assert(html.includes('id="special-hint"'));
assert(fs.readFileSync('games/index.html','utf8').includes('<h2>ブレーキダウン</h2>'));
event('start:click');model.game.phase='fight';model.game.aiWait=100;frame();
assert.equal(elements.get('chance-clock').textContent,'必殺チャンスまで 8.0 秒');assert(drawn.includes('必殺チャンスまで 8.0 秒'));
model.game.age=5.5;frame();assert.match(elements.get('chance-clock').textContent,/2.5 秒/);assert(elements.get('chance-panel').classes.has('soon'));assert(elements.get('chance-progress').value>.68);
const countdown=elements.get('chance-clock').textContent,progress=elements.get('chance-progress').value;
event('window:blur');frame();frame();assert.equal(elements.get('chance-clock').textContent,'一時停止 — '+countdown);assert.equal(elements.get('chance-progress').value,progress);event('window:focus');frame();
for(const code of ['KeyD','Digit0','Numpad0']){
  event('window:keydown',{code,repeat:false});event('window:keydown',{code:'ArrowRight',repeat:false});const x=model.game.player.x;frame();assert(model.game.player.guarding);assert.equal(model.game.player.x,x);assert(drawn.includes('GUARD'));
  event('window:keyup',{code});frame();assert(!model.game.player.guarding);assert(model.game.player.x>x);event('window:keyup',{code:'ArrowRight'});
}
for(const release of ['pointerup','pointercancel','lostpointercapture']){
  event('guard:pointerdown',{pointerId:10});frame();assert(model.game.player.guarding);event('guard:'+release,{pointerId:10});frame();assert(!model.game.player.guarding);
}
event('guard:pointerdown',{pointerId:11});frame();event('window:blur');frame();event('window:focus');frame();frame();assert(!model.game.player.guarding);
model.game.age=8;model.game.special={elapsed:1};model.game.rival.hp=100;frame();assert(elements.get('chance-panel').classes.has('now'));assert(elements.get('special').classes.has('chance'));assert.match(elements.get('chance-clock').textContent,/今！/);
event('window:keydown',{code:'KeyV',repeat:false});frame();assert.equal(model.game.rival.hp,30);assert.equal(elements.get('chance-clock').textContent,'必殺チャンスまで 16.0 秒');assert(!elements.get('chance-panel').classes.has('now'));
model.game.nextChance=Infinity;frame();assert.match(elements.get('chance-clock').textContent,/チャンスは終了/);assert(!/NaN|Infinity/.test(elements.get('chance-clock').textContent));
event('start:click');frame();assert.match(elements.get('chance-clock').textContent,/8.0 秒/);assert.equal(model.game.player.guarding,false);
assert(html.includes('id="guard"'));assert(html.includes('id="chance-progress"'));
console.log('PASS: renamed title, colors, V/touch input, repeat protection, rounds, pause and selector');
console.log('PASS: D/0 and touch guard/release/cancel, blur clears guard, countdown/bar/3-second warning, green prompt, next chance, pause and reset');
