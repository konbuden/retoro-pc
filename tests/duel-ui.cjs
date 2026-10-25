const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const noop=()=>{},elements=new Map(),listeners=new Map(),drawn=[],colors=[];let nextFrame,model;
const context=new Proxy({},{get:(_,key)=>key==='fillText'?(t)=>drawn.push(t):noop,set:(_,key,v)=>{if(key==='fillStyle')colors.push(v);return true;}});
function element(id){if(!elements.has(id))elements.set(id,{textContent:'',classList:{remove:noop,add:noop,toggle:noop},setAttribute:noop,setPointerCapture:noop,addEventListener:(event,fn)=>listeners.set(id+':'+event,fn),getContext:()=>context});return elements.get(id);}
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
console.log('PASS: renamed title, distinct colors, V/touch special input, no key repeat, round screens, blur pause, selector integration');
