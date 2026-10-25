const assert=require('node:assert/strict');
require('../games/sekai-saikyo-no-onna/engine.js');
const results=[];
function fight(){const m=X1Duel.createGame(()=>.8);m.reset();for(let i=0;i<40;i++)m.tick(.04);assert.equal(m.game.phase,'fight');return m;}
function quiet(m){m.game.aiWait=100;m.game.rival.stun=100;}
let m=fight();quiet(m);m.game.player.x=100;m.game.rival.x=134;
for(let i=0;i<5;i++)m.tick(.04,{punch:true});
assert.equal(m.game.rival.hp,95.5);for(let i=0;i<3;i++)m.tick(.04,{punch:true});assert.equal(m.game.rival.hp,95.5);
results.push('Punch connects once during its active window');
m=fight();quiet(m);m.game.player.x=100;m.game.rival.x=150;
for(let i=0;i<6;i++)m.tick(.04,{punch:true});assert.equal(m.game.rival.hp,100);
m=fight();quiet(m);m.game.player.x=100;m.game.rival.x=150;
for(let i=0;i<6;i++)m.tick(.04,{kick:true});assert.equal(m.game.rival.hp,93);
results.push('Kick reaches farther than punch and causes 7 damage');
m=fight();quiet(m);m.game.player.x=100;m.game.rival.x=133;m.game.rival.y=100;
for(let i=0;i<5;i++)m.tick(.04,{punch:true});assert.equal(m.game.rival.hp,100);
results.push('Attack cannot hit vertically separated fighters');
m=fight();quiet(m);m.tick(.04,{jump:true});assert(m.game.player.vy<0);
for(let i=0;i<12;i++)m.tick(.04);assert(m.game.player.y<140);
for(let i=0;i<30;i++)m.tick(.04);assert.equal(m.game.player.y,m.floor);
results.push('Jump takes off, rises and lands');
m=fight();quiet(m);m.game.player.x=26;for(let i=0;i<40;i++)m.tick(.04,{left:true});assert.equal(m.game.player.x,26);
results.push('Arena boundaries constrain movement');
m=fight();quiet(m);m.game.player.x=100;m.game.rival.x=126;
for(let i=0;i<8;i++)m.tick(.04,{right:true});assert(m.game.rival.x-m.game.player.x>=23);
results.push('Grounded fighters cannot overlap');
function nextFight(m){for(let i=0;i<110&&m.game.phase!=='fight';i++)m.tick(.04);assert.equal(m.game.phase,'fight');}
function ko(m,win=true){(win?m.game.rival:m.game.player).hp=0;m.tick(.01);}
m=fight();quiet(m);m.game.player.x=100;m.game.rival.x=134;m.game.rival.hp=4.5;
for(let i=0;i<5;i++)m.tick(.04,{punch:true});assert.equal(m.game.phase,'roundover');assert.equal(m.game.rival.hp,0);assert.equal(m.game.wins,1);
const x=m.game.player.x;m.tick(.04,{right:true});assert.equal(m.game.player.x,x);
nextFight(m);assert.equal(m.game.round,2);assert.equal(m.game.player.hp,100);assert.equal(m.game.rival.hp,100);assert.equal(m.game.time,60);assert.equal(m.game.nextChance,8);
ko(m);assert.equal(m.game.phase,'roundover');assert.equal(m.game.wins,2);nextFight(m);assert.equal(m.game.round,3);ko(m,false);assert.equal(m.game.phase,'won');assert.equal(m.game.wins,2);assert.equal(m.game.losses,1);
const snapshot=JSON.stringify({...m.game,events:[]});m.tick(.04,{right:true});assert.equal(JSON.stringify({...m.game,events:[]}),snapshot);
results.push('All three rounds play, health/time reset, 2-1 result and terminal freeze');
m=fight();ko(m,false);nextFight(m);ko(m,false);nextFight(m);ko(m,true);assert.equal(m.game.phase,'lost');
m=fight();quiet(m);m.game.time=.01;m.game.player.hp=50;m.game.rival.hp=70;m.tick(.04);assert.equal(m.game.roundResult,'lost');
m=fight();quiet(m);for(let r=1;r<=3;r++){m.game.time=0;m.tick(.01);assert.equal(m.game.roundResult,'draw');if(r<3)nextFight(m);}assert.equal(m.game.phase,'draw');
m.reset();assert.equal(m.game.round,1);assert.equal(m.game.wins,0);assert.equal(m.game.losses,0);assert.equal(m.game.player.hp,100);assert.equal(m.game.special,null);
results.push('Loss, timeout, drawn rounds and match retry reset');
function chance(){const m=fight();quiet(m);m.game.age=7.99;m.tick(.02);assert.ok(m.game.special);return m;}
m=chance();assert.equal(m.game.nextChance,8);const time=m.game.time;const aiX=m.game.rival.x;
for(let i=0;i<25;i++)m.tick(.04);assert.equal(m.game.time,time);assert.equal(m.game.rival.x,aiX);m.tick(.01,{special:true});assert.equal(m.game.rival.hp,30);assert.equal(m.game.player.hp,100);assert.equal(m.game.specialResult,'success');assert.equal(m.game.nextChance,24);
results.push('Visible chance freezes fight/time; timed success deals 70 maximum HP');
for(const when of [.2,1.5]){m=chance();m.game.special.elapsed=when;m.tick(.01,{special:true});assert.equal(m.game.player.hp,70);assert.equal(m.game.rival.hp,100);assert.equal(m.game.specialResult,'failure');}
m=chance();for(let i=0;i<51;i++)m.tick(.04);assert.equal(m.game.player.hp,70);assert.equal(m.game.special,null);
results.push('Early press, late press and timeout each cost 30 maximum HP');
m=chance();m.game.special.elapsed=1;m.game.rival.hp=40;m.tick(.01,{special:true});assert.equal(m.game.rival.hp,0);assert.equal(m.game.phase,'roundover');
m=chance();m.game.player.hp=20;m.tick(.01,{special:true});assert.equal(m.game.player.hp,0);assert.equal(m.game.phase,'roundover');assert.equal(m.game.roundResult,'lost');
results.push('Special success and failure can end a round; HP never goes negative');
m=chance();m.game.specialHeld=true;m.game.special.elapsed=1;m.tick(.01,{special:true});assert.ok(m.game.special);assert.equal(m.game.rival.hp,100);m.tick(.01,{special:false});m.tick(.01,{special:true});assert.equal(m.game.rival.hp,30);
m=fight();quiet(m);m.tick(.01,{special:true});assert.equal(m.game.player.hp,100);assert.equal(m.game.rival.hp,100);
results.push('Holding button cannot trigger special; fresh press required; no damage outside chance');
m=chance();m.game.special.elapsed=.9;m.tick(0,{special:true});assert.equal(m.game.rival.hp,30);
m=chance();m.game.special.elapsed=1.35;m.tick(0,{special:true});assert.equal(m.game.rival.hp,30);
m=chance();m.game.special.elapsed=.899;m.tick(0,{special:true});assert.equal(m.game.player.hp,70);
m=chance();m.game.special.elapsed=1.351;m.tick(0,{special:true});assert.equal(m.game.player.hp,70);
results.push('Timing window includes endpoints, rejects immediately outside them');
m=chance();m.tick(.01,{special:true});m.game.age=23.99;m.tick(.02);assert.ok(m.game.special);m.tick(.01,{special:true});m.game.age=39.99;m.tick(.02);assert.ok(m.game.special);m.tick(.01,{special:true});assert.equal(m.game.nextChance,Infinity);assert.equal(m.game.player.hp,10);
results.push('Scheduled chances at 8, 24 and 40 seconds resolve once each');
m=fight();let attacked=false,approached=false;for(let i=0;i<250;i++){m.tick(.04);attacked ||= m.game.player.hp<100;approached ||= m.game.rival.x<236;}assert(attacked);assert(approached);
results.push('Opponent still approaches and lands attacks');
assert.equal(m.moves.punch.damage,4.5);assert.equal(m.moves.kick.damage,7);
for(const attack of ['punch','kick']){
  m=fight();m.game.aiWait=100;m.game.player.x=100;m.game.rival.x=attack==='punch'?134:150;
  m.game.rival.action=attack;m.game.rival.attackTime=m.moves[attack].start-.02;
  m.tick(.04,{guard:true});
  assert.equal(m.game.player.hp,100);assert.equal(m.game.player.stun,0);assert(m.game.player.guarding);assert(m.game.player.blockFlash>0);assert(m.game.events.includes('block'));assert(m.game.rival.connected);
  m.tick(.01,{guard:true});assert.equal(m.game.player.hp,100);assert(!m.game.events.includes('block'));
  m.game.rival.action=attack;m.game.rival.connected=false;m.game.rival.attackTime=m.moves[attack].start-.02;
  m.tick(.04);assert.equal(m.game.player.hp,100-m.moves[attack].damage);assert(!m.game.player.guarding);
}
results.push('Guard blocks punch/kick without chip damage; release restores halved incoming damage');
m=fight();quiet(m);const guardX=m.game.player.x;m.tick(.04,{guard:true,right:true,punch:true,kick:true,jump:true});assert.equal(m.game.player.x,guardX);assert.equal(m.game.player.action,null);assert.equal(m.game.player.vy,0);
m.tick(.04,{right:true,kick:true});assert(m.game.player.x>guardX);assert.equal(m.game.player.action,'kick');
results.push('Guard prevents movement/attacks/jumps; release immediately restores controls');
m=fight();m.game.aiWait=100;m.game.player.x=100;m.game.rival.x=134;m.game.player.action='kick';m.game.player.attackTime=0;m.game.rival.action='punch';m.game.rival.attackTime=.08;m.tick(.04,{guard:true});assert(!m.game.player.guarding);assert.equal(m.game.player.hp,95.5);
m=fight();quiet(m);m.game.player.y=m.floor-40;m.game.player.vy=-50;m.tick(.04,{guard:true});assert(!m.game.player.guarding);
m=fight();quiet(m);m.game.player.stun=.3;m.tick(.04,{guard:true});assert(!m.game.player.guarding);
results.push('Guard cannot cancel an attack, work in the air, or bypass hit stun');
m=chance();m.game.player.guarding=true;m.game.rival.guarding=true;m.game.special.elapsed=1;m.tick(.01,{guard:true,special:true});assert.equal(m.game.rival.hp,30);
m=chance();m.game.player.guarding=true;m.tick(.01,{guard:true,special:true});assert.equal(m.game.player.hp,70);assert(!m.game.player.guarding);
m=chance();for(let i=0;i<51;i++)m.tick(.04,{guard:true});assert.equal(m.game.player.hp,70);
results.push('Neither successful special nor its failure/timeout penalty can be guarded');
for(const aggressive of [false,true]){
  m=fight();m.game.player.x=100;m.game.rival.x=134;
  for(let i=0;i<250&&m.game.phase==='fight'&&!m.game.special;i++)m.tick(.04,aggressive?{kick:true,right:m.game.rival.x-m.game.player.x>48}:{});
  assert.equal(m.game.phase,'fight');assert(m.game.special);assert(m.game.player.hp>0);assert(m.game.rival.hp>0);
}
results.push('Active opponents survive to the first special chance with and without player attacks');
m=fight();for(let i=0;i<250&&!m.game.special;i++)m.tick(.04,{guard:true});assert(m.game.special);assert.equal(m.game.player.hp,100);
results.push('Holding guard safely reaches the first special chance');
console.log(results.map(s=>'PASS: '+s).join('\n'));
