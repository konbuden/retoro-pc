/* Browser recreation model. See RECONSTRUCTION.md for source evidence and estimates. */
(function (root) {
  'use strict';
  const FLOOR = 164, LEFT = 26, RIGHT = 294;
  const MOVES = {
    punch: { duration: .34, start: .09, end: .19, reach: 39, damage: 9 },
    kick: { duration: .52, start: .16, end: .29, reach: 55, damage: 14 }
  };
  function fighter(x, facing) {
    return { x, y: FLOOR, vy: 0, facing, hp: 100, action: null, attackTime: 0,
      connected: false, cooldown: 0, stun: 0, flash: 0, walk: 0 };
  }
  function createGame(random = Math.random) {
    const game = { phase: 'ready', player: fighter(84, 1), rival: fighter(236, -1),
      time: 60, countdown: 1.4, aiWait: .6, events: [], hits: 0, age: 0 };
    function reset() {
      Object.assign(game, { phase: 'countdown', player: fighter(84, 1), rival: fighter(236, -1),
        time: 60, countdown: 1.4, aiWait: .6, events: [], hits: 0, age: 0 });
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
        defender.hp = Math.max(0, defender.hp - move.damage);
        defender.flash = .16; defender.stun = .2;
        defender.x = Math.max(LEFT, Math.min(RIGHT, defender.x + attacker.facing * 6));
        if (attacker === game.player) game.hits++;
        game.events.push(attacker.action);
      }
    }
    function finish() {
      if (game.player.hp <= 0 && game.rival.hp <= 0) game.phase = 'draw';
      else if (game.player.hp <= 0) game.phase = 'lost';
      else if (game.rival.hp <= 0) game.phase = 'won';
      else if (game.time <= 0) game.phase = game.player.hp === game.rival.hp ? 'draw' :
        game.player.hp > game.rival.hp ? 'won' : 'lost';
      if (game.phase !== 'fight') game.events.push('end');
    }
    function tick(dt, input = {}) {
      dt = Math.max(0, Math.min(dt, .04)); game.events = [];
      if (game.phase === 'countdown') {
        game.countdown -= dt; if (game.countdown <= 0) { game.phase = 'fight'; game.events.push('go'); }
        return;
      }
      if (game.phase !== 'fight') return;
      game.time = Math.max(0, game.time - dt); game.age += dt;
      const a = game.player, b = game.rival;
      a.facing = b.x >= a.x ? 1 : -1; b.facing = -a.facing;
      advance(a, dt); advance(b, dt);
      const move = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (a.stun <= 0 && !a.action) {
        a.x = Math.max(LEFT, Math.min(RIGHT, a.x + move * 78 * dt));
        a.walk += Math.abs(move) * dt * 9;
      }
      if (input.jump) jump(a);
      if (input.kick) attack(a, 'kick'); else if (input.punch) attack(a, 'punch');
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
