import { afterEach, describe, expect, it, vi } from 'vitest';
import { PARTY_GAMES, newVote, resolveVote, validVote } from '../game/partyVote';
import { challengeFromCode, newChallengeCode, readChallengeRecords, recordChallenge, validChallenge } from '../game/sharedChallenge';
import { PracticeSession } from '../game/practiceSession';
import { CargoCrewEngine, CARGO_ROUTES, cargoStageMedal } from '../game/cargoCrewEngine';
import { shareUrl } from '../ui/sharePanel';
import { validPreferences } from '../game/playPreferences';
import type { ClientInputPacket } from '../types';

const idle: ClientInputPacket = { slotId: 0, name: 'ALEX', moveX: 0, moveY: 0, aimAngle: 0,
  parryPressed: false, chargingParry: false, dashPressed: false, yankPressed: false, emotePressed: 0, clientBallDist: 999 };
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('Interactive practice with actual engines', () => {
  for (const game of PARTY_GAMES) it(`completes ${game} through inputs and confirmed game actions`, () => {
    const s = new PracticeSession(game); let rescuePressed = false;
    try {
      for (let tick = 0; tick < 2400 && !s.complete; tick++) {
        const input = { ...idle, actionSeq: tick + 1 };
        if (s.task === 0 && game !== 'TURBO_PUTT' && game !== 'CARGO_CREW') input.moveX = 1;
        else if (game === 'CARGO_CREW') {
          if (s.task === 1) input.parryPressed = true;
          if (s.task === 2) input.moveX = 1;
          if (s.task === 3) input.yankPressed = true;
        } else if (game === 'TURBO_PUTT') {
          if (s.task === 0) input.chargingParry = true;
          if (s.task === 2) input.dashPressed = true;
        } else if (game === 'BASH_BOT' || game === 'RICOCHET_1') {
          const p = s.engine.players[0], ball = game === 'BASH_BOT' ? s.arena.balls[0] : s.ricochet.bullets[0];
          if (s.task === 1 && ball && Math.hypot(ball.x - p.x, ball.y - p.y) < 62) input.parryPressed = true;
          if (s.task === 2) input.dashPressed = true;
        } else if (game === 'CHAIN_PANIC') {
          if (s.task === 1) input.parryPressed = true;
          if (s.task === 2) { input.anchorHeld = true; input.yankPressed = !rescuePressed; rescuePressed = true; }
        } else {
          if (s.task === 1) input.parryPressed = true;
          if (s.task === 2) input.dashPressed = true;
          if (s.task === 3) input.yankPressed = true;
        }
        s.step(1 / 60, input);
      }
      expect(s.complete, `stuck on task ${s.task}: ${JSON.stringify(s.engine.players[0])}`).toBe(true);
      expect(s.seconds).toBeGreaterThan(0);
    } finally { s.dispose(); }
  });
  it('keeps its game state isolated and cannot complete a parry task by waiting', () => {
    const a = new PracticeSession('BASH_BOT'), b = new PracticeSession('BASH_BOT');
    try {
      for (let i = 0; i < 30; i++) a.step(1 / 60, { ...idle, moveX: 1 });
      expect(a.task).toBe(1);
      for (let i = 0; i < 300; i++) a.step(1 / 60, idle);
      expect(a.task).toBe(1); expect(b.task).toBe(0); expect(b.seconds).toBe(0);
      expect(a.arena.matchStats[0].parries).toBe(0);
    } finally { a.dispose(); b.dispose(); }
  });
  it('leaves time to read and still allows the putt pulse after a successful cup', () => {
    const hex = new PracticeSession('HEX_CRUSH'), putt = new PracticeSession('TURBO_PUTT');
    try {
      for (let tick = 0; tick < 6000; tick++) { hex.step(1 / 60, idle); putt.step(1 / 60, idle); }
      expect(hex.task).toBe(0); expect(hex.hex.players[0].alive).toBe(true); expect(hex.hex.players[0].fallTimer).toBe(0);
      expect(putt.putt.status).toBe('PLAYING'); expect(putt.task).toBe(0);
      for (let tick = 0; tick < 60 && putt.task === 0; tick++) putt.step(1 / 60, { ...idle, chargingParry: true });
      putt.step(1 / 60, idle); expect(putt.task).toBe(2);
      putt.putt.players[0].sunkInCup = true; putt.putt.status = 'HOLE_COMPLETE';
      putt.step(1 / 60, { ...idle, dashPressed: true }); expect(putt.complete).toBe(true);
    } finally { hex.dispose(); putt.dispose(); }
  });
});

describe('Voting, shared challenges and comfortable controls', () => {
  it('uses only human ballots and rotates tied results predictably', () => {
    const vote = { ...newVote(1), open: true, ballots: ['BASH_BOT', 'CHAIN_PANIC', 'CHAIN_PANIC', null] } as ReturnType<typeof newVote>;
    expect(resolveVote(vote, [0, 1])).toBe('BASH_BOT');
    expect(resolveVote({ ...vote, id: 2 }, [0, 1])).toBe('CHAIN_PANIC');
    expect(validVote({ ...vote, ballots: ['HUB'] })).toBe(false);
    expect(resolveVote(newVote(1), [0])).toBe(null);
  });
  it('makes shareable versioned configurations for all eight games and rejects altered descriptors', () => {
    for (const game of PARTY_GAMES) {
      const code = newChallengeCode(game), config = challengeFromCode(code)!;
      expect(config.game).toBe(game); expect(challengeFromCode(code)).toEqual(config);
      expect(validChallenge(config)).toBe(true); expect(validChallenge({ ...config, seed: config.seed + 1 })).toBe(false);
      expect(config.stage).toBeGreaterThanOrEqual(0);
    }
    expect(challengeFromCode('2A-AAAA')).toBe(null);
    expect(challengeFromCode('<script>')).toBe(null);
  });
  it('deduplicates local challenge records and drops malformed storage', () => {
    const record = { id: 'test-1', code: '1A-AAAA', humans: 2, won: true, seconds: 30, score: 5 };
    recordChallenge(record); recordChallenge(record);
    expect(readChallengeRecords()).toHaveLength(1);
    recordChallenge({ ...record, id: 'bad', seconds: NaN }); expect(readChallengeRecords()).toHaveLength(1);
    localStorage.setItem('tp04_challenge_records', JSON.stringify([{ ...record, humans: 9 }, null]));
    expect(readChallengeRecords()).toEqual([]);
  });
  it('shares either an invitation or a challenge without stale session parameters', () => {
    const base = 'https://example.com/play?room=OLD&join=1&debug=private&challenge=1A-AAAA#secret';
    expect(shareUrl(base, { room: 'ABCD' })).toBe('https://example.com/play?room=ABCD&join=1');
    expect(shareUrl(base, { challenge: '1B-BBBB' })).toBe('https://example.com/play?challenge=1B-BBBB');
    expect(validPreferences({ effectsVolume: 0, musicVolume: 100, reducedMotion: true, reducedFlashes: true, controlScale: 1.15 })).toBe(true);
    expect(validPreferences({ effectsVolume: NaN })).toBe(false);
  });
});

describe('Additional cargo routes and delivery goals', () => {
  for (let route = 0; route < 3; route++) it(`finishes cargo route ${route + 1} with movement, helpers and locks`, () => {
    const e = new CargoCrewEngine(); e.setRoute(route);
    for (let tick = 0; tick < 16000 && e.status !== 'ROUTE_COMPLETE'; tick++) {
      const dy = 260 - e.battery.y, p = e.players[0];
      if (e.status === 'PLAYING' && !p.gripping && Math.hypot(p.x - e.battery.x, p.y - e.battery.y) < 86) e.triggerGrip(p);
      let moveX = Math.abs(dy) > 35 ? 0 : 1, moveY = Math.abs(dy) > 8 ? Math.max(-1, Math.min(1, dy / 30)) : 0;
      // After a fall, return through the central corridor and retrieve the cable.
      if (!p.gripping && Math.hypot(p.x - e.battery.x, p.y - e.battery.y) > 84) {
        if (Math.abs(p.y - 260) > 12 && p.x < 530) { moveX = 0; moveY = Math.sign(260 - p.y); }
        else if (Math.abs(p.x - (e.battery.x - 40)) > 12) { moveX = Math.sign(e.battery.x - 40 - p.x); moveY = 0; }
        else { moveX = 0; moveY = Math.sign(e.battery.y - p.y); }
      }
      e.step(1 / 60, { ...idle, moveX, moveY });
    }
    expect(e.status, JSON.stringify({stage:e.stageIndex,battery:e.battery,players:e.players.map(p=>({x:p.x,y:p.y,gripping:p.gripping})),retries:e.retries,integrity:e.integrity})).toBe('ROUTE_COMPLETE'); expect(e.stageDamage).toHaveLength(3); expect(e.stageRepairs).toHaveLength(3);
    const client = new CargoCrewEngine(); client.applySnapshot(e.getSnapshot());
    expect(client.routeIndex).toBe(route); expect(client.definition).toBe(CARGO_ROUTES[route][2]);
    expect(client.stageDamage).toEqual(e.stageDamage);
  });
  it('gives gold only to fast undamaged deliveries', () => {
    expect(cargoStageMedal(89, 0)).toBe('ORO'); expect(cargoStageMedal(89, 12)).toBe('PLATA'); expect(cargoStageMedal(151, 0)).toBe('BRONCE');
  });
});
