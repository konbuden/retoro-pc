/* Browser recreation model. See RECONSTRUCTION.md for source evidence and estimates. */
(function (root) {
  'use strict';
  const FLOOR = 164, LEFT = 26, RIGHT = 294;
  const MOVES = {
    punch: { duration: .34, start: .09, end: .19, reach: 39, damage: 4.5 },
    kick: { duration: .52, start: .16, end: .29, reach: 55, damage: 7 }
  };
  function fighter(x, facing) {
    return { x, y: FLOOR, vy: 0, facing, hp: 100, action: null, attackTime: 0,
      connected: false, cooldown: 0, stun: 0, flash: 0, walk: 0, guarding: false, blockFlash: 0 };
  }
  function createGame(random = Math.random) {
    const game = { phase: 'ready', player: fighter(84, 1), rival: fighter(236, -1),
      time: 60, countdown: 1.4, aiWait: .6, events: [], hits: 0, age: 0,
      round:1, wins:0, losses:0, roundResult:null, intermission:0, special:null, nextChance:8,
      specialHeld:false, specialFlash:0, specialResult:null };
    function reset() {
      Object.assign(game, { phase: 'countdown', player: fighter(84, 1), rival: fighter(236, -1),
        time: 60, countdown: 1.4, aiWait: .6, events: [], hits: 0, age: 0,
        round:1, wins:0, losses:0, roundResult:null, intermission:0, special:null, nextChance:8,
        specialHeld:false, specialFlash:0, specialResult:null });
    }
    function jump(actor) {
      if (actor.y >= FLOOR && actor.stun <= 0) { actor.vy = -205; game.events.push('jump'); }
    }
    function attack(actor, name) {
      if (actor.action || actor.cooldown > 0 || actor.stun > 0) return;
      actor.action = name; actor.attackTime = 0; actor.connected = false;
    }
    function advance(actor, dt) {
      actor.cooldown = Math.max(0, actor.cooldown - dt);
      actor.stun = Math.max(0, actor.stun - dt); actor.flash = Math.max(0, actor.flash - dt);
      actor.blockFlash = Math.max(0, actor.blockFlash - dt);
      if (actor.y < FLOOR || actor.vy < 0) {
        actor.vy += 560 * dt; actor.y = Math.min(FLOOR, actor.y + actor.vy * dt);
        if (actor.y >= FLOOR) actor.vy = 0;
      }
      if (actor.action) {
        actor.attackTime += dt;
        if (actor.attackTime > MOVES[actor.action].duration) {
          actor.action = null; actor.cooldown = .12;
        }
      }
    }
    function connect(attacker, defender) {
      if (!attacker.action || attacker.connected || attacker.stun > 0) return;
      const move = MOVES[attacker.action];
      const inFront = (defender.x - attacker.x) * attacker.facing > 0;
      if (attacker.attackTime >= move.start && attacker.attackTime <= move.end &&
          inFront && Math.abs(attacker.x - defender.x) < move.reach &&
          Math.abs(attacker.y - defender.y) < 29) {
        attacker.connected = true;
        if (defender.guarding) {
          defender.blockFlash = .2;
          game.events.push('block');
          return;
        }
        defender.hp = Math.max(0, defender.hp - move.damage);
        defender.flash = .16; defender.stun = .2;
        defender.x = Math.max(LEFT, Math.min(RIGHT, defender.x + attacker.facing * 6));
        if (attacker === game.player) game.hits++;
        game.events.push(attacker.action);
      }
    }
    function finish() {
      let result=null;
      if (game.player.hp<=0 && game.rival.hp<=0) result='draw';
      else if (game.player.hp<=0) result='lost';
      else if (game.rival.hp<=0) result='won';
      else if(game.time<=0) result=game.player.hp===game.rival.hp?'draw':game.player.hp>game.rival.hp?'won':'lost';
      if(!result)return;
      game.roundResult=result;if(result==='won')game.wins++;if(result==='lost')game.losses++;
      game.special=null;game.events.push('end');
      if(game.round===3)game.phase=game.wins===game.losses?'draw':game.wins>game.losses?'won':'lost';
      else {game.phase='roundover';game.intermission=2.5;}
    }
    function nextRound(){
      Object.assign(game,{round:game.round+1,phase:'countdown',player:fighter(84,1),rival:fighter(236,-1),
        time:60,countdown:1.4,aiWait:.6,age:0,nextChance:8,special:null,specialFlash:0,specialResult:null,roundResult:null});
    }
    function resolveSpecial(success){
      game.special=null;game.nextChance=game.nextChance<40?game.nextChance+16:Infinity;game.specialResult=success?'success':'failure';game.specialFlash=.8;
      const victim=success?game.rival:game.player;
      victim.hp=Math.max(0,victim.hp-(success?70:30));victim.flash=.6;victim.stun=.6;victim.guarding=false;
      game.player.action=game.rival.action=null;
      game.events.push(success?'special':'miss');finish();
    }
    function tick(dt, input = {}) {
      dt = Math.max(0, Math.min(dt, .04)); game.events = [];
      const pressed=!!input.special&&!game.specialHeld;game.specialHeld=!!input.special;
      game.specialFlash=Math.max(0,game.specialFlash-dt);
      if(game.phase==='roundover'){game.intermission-=dt;if(game.intermission<=0)nextRound();return;}
      if (game.phase === 'countdown') {
        game.countdown -= dt; if (game.countdown <= 0) { game.phase = 'fight'; game.events.push('go'); }
        return;
      }
      if (game.phase !== 'fight') return;
      finish();if(game.phase!=='fight')return;
      if(game.special){
        game.special.elapsed+=dt;
        if(pressed)resolveSpecial(game.special.elapsed>=.9&&game.special.elapsed<=1.35);
        else if(game.special.elapsed>=2)resolveSpecial(false);
        return;
      }
      game.time = Math.max(0, game.time - dt); game.age += dt;
      if(game.age>=game.nextChance){game.special={elapsed:0};game.events.push('chance');return;}
      const a = game.player, b = game.rival;
      a.facing = b.x >= a.x ? 1 : -1; b.facing = -a.facing;
      advance(a, dt); advance(b, dt);
      // Guard is held on the ground, after the current attack or hit stun ends.
      a.guarding = !!input.guard && a.y >= FLOOR && a.vy === 0 && a.stun <= 0 && !a.action;
      const move = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (a.stun <= 0 && !a.action && !a.guarding) {
        a.x = Math.max(LEFT, Math.min(RIGHT, a.x + move * 78 * dt));
        a.walk += Math.abs(move) * dt * 9;
      }
      if (!a.guarding) {
        if (input.jump) jump(a);
        if (input.kick) attack(a, 'kick'); else if (input.punch) attack(a, 'punch');
      }
      const distance = Math.abs(b.x - a.x);
      game.aiWait -= dt;
      if (b.stun <= 0 && !b.action) {
        const direction = distance > 43 ? b.facing : distance < 25 ? -b.facing : 0;
        b.x = Math.max(LEFT, Math.min(RIGHT, b.x + direction * 62 * dt));
        b.walk += Math.abs(direction) * dt * 8;
        if (game.aiWait <= 0) {
          if (distance < 58) attack(b, distance < 38 && random() > .55 ? 'punch' : 'kick');
          if (random() < .18) jump(b);
          game.aiWait = .36 + random() * .42;
        }
      }
      // Grounded fighters cannot walk through each other; jumping can cross over.
      if (Math.abs(a.x - b.x) < 23 && Math.abs(a.y - b.y) < 25) {
        const middle = Math.max(LEFT + 11.5, Math.min(RIGHT - 11.5, (a.x + b.x) / 2));
        a.x = middle - a.facing * 11.5; b.x = middle + a.facing * 11.5;
      }
      connect(a, b); connect(b, a); finish();
    }
    return { game, reset, tick, moves: MOVES, floor: FLOOR };
  }
  root.X1Duel = { createGame };
})(globalThis);
