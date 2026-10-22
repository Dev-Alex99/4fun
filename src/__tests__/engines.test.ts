import { describe, expect, it } from 'vitest';
import { ArenaEngine, COURT_CENTER_X, COURT_RX } from '../game/arenaEngine';
import { CHAIN_LEVELS, ChainPanicEngine } from '../game/chainPanicEngine';
import { HOT_CORE_ARENAS, HotCoreEngine } from '../game/hotCoreEngine';
import { VOLT_CROWN_ARENAS, VoltCrownEngine } from '../game/voltCrownEngine';
import { HEX_CRUSH_ARENAS, HexCrushEngine } from '../game/hexCrushEngine';
import { RICOCHET_ARENAS, RicochetEngine } from '../game/ricochetEngine';
import { TournamentManager } from '../game/tournamentManager';
import { PUTT_HOLES, PuttWarEngine } from '../game/puttWarEngine';
import { MultiplayerRoomManager } from '../net/multiplayerRoom';
import { ProceduralChiptuneEngine } from '../audio/chiptuneBgm';
import { TouchGamepad } from '../input/touchGamepad';
import { RobotWorkshopManager, ROBOT_HATS, ROBOT_VISORS, ROBOT_SKINS } from '../game/robotWorkshop';
import { ClientInputPacket } from '../types';

const dummyInput: ClientInputPacket = {
  slotId: 0,
  name: 'ALEX',
  moveX: 0,
  moveY: 0,
  aimAngle: 0,
  parryPressed: false,
  chargingParry: false,
  dashPressed: false,
  emotePressed: 0,
  clientBallDist: 999
};

describe('ArenaEngine (01 // BASH-BOT)', () => {
  it('evaluates bot parry decision only ONCE per ball pass (preventing 60fps per-frame god-mode)', () => {
    const engine = new ArenaEngine();
    const bot = engine.players[1];
    const ball = engine.balls[0];

    ball.targetId = bot.id;
    ball.passId = 42;
    // Place ball within trigger distance
    ball.x = bot.x + 20;
    ball.y = bot.y;

    // Force bot to miss on this pass
    bot.botEvaluatedPassId = 42;
    bot.botWillParry = false;
    bot.botTriggerDist = 60;

    // Step 10 frames: bot must NOT re-roll botWillParry on subsequent frames of the same passId
    for (let i = 0; i < 10; i++) {
      engine.step(0.016, dummyInput);
      if (ball.passId === 42) {
        expect(bot.botWillParry).toBe(false);
      }
    }
  });

  it('disables all bots when botDifficulty is set to OFF and allows solo wall rally', () => {
    const engine = new ArenaEngine();
    engine.botDifficulty = 'OFF';
    engine.spawnRound();

    expect(engine.players[0].alive).toBe(true);
    expect(engine.players[1].alive).toBe(false);
    expect(engine.players[2].alive).toBe(false);
    expect(engine.players[3].alive).toBe(false);

    // Simulate human hitting ball and ball bouncing off outer arena wall
    const ball = engine.balls[0];
    ball.ownerId = 0;
    ball.x = COURT_CENTER_X + COURT_RX + 20;
    engine.step(0.016, dummyInput);

    // Wall bounce resets ownerId so solo player can parry again
    expect(ball.ownerId).toBe(-1);
  });

  it('executes Feint / Amago Curvo shot when feintPrimed is active', () => {
    const engine = new ArenaEngine();
    const human = engine.players[0];
    const ball = engine.balls[0];

    human.feintPrimed = true;
    human.parryTimer = 0.2;
    ball.ownerId = 1;
    ball.speed = 500;
    ball.x = human.x + 15;
    ball.y = human.y;

    engine.step(0.016, dummyInput);

    expect(ball.isFeint).toBe(true);
    expect(ball.speed).toBeLessThan(500);
    expect(Math.abs(ball.curveSpin)).toBeGreaterThan(2.0);
  });

  it('rolls back a lethal K.O. when a remote player parry packet arrives within the 280ms lag-compensation window', () => {
    const engine = new ArenaEngine();
    const remotePlayer = engine.players[1];
    remotePlayer.isBot = false;
    remotePlayer.alive = false;
    remotePlayer.lastKOAt = performance.now() - 60; // Knocked out 60ms ago on Host

    engine.applyRemoteInput({
      ...dummyInput,
      slotId: 1,
      name: 'CARLOS',
      parryPressed: true,
      clientBallDist: 38 // Ball was within parry reach on Carlos's screen!
    });

    expect(remotePlayer.alive).toBe(true);
    expect(engine.balls[0].ownerId).toBe(1);
  });
});

describe('ChainPanicEngine (02 // CHAIN-PANIC)', () => {
  it('loads all 6 industrial sectors without errors', () => {
    const engine = new ChainPanicEngine();
    expect(CHAIN_LEVELS.length).toBe(6);

    for (let i = 0; i < CHAIN_LEVELS.length; i++) {
      engine.loadLevel(i);
      expect(engine.levelIndex).toBe(i);
      expect(() => engine.step(0.016, dummyInput)).not.toThrow();
    }
  });

  it('rescues a dangling teammate when [E] Cable Yank is triggered', () => {
    const engine = new ChainPanicEngine();
    const p0 = engine.players[0];
    const p1 = engine.players[1];

    p1.isDangling = true;
    p1.x = p0.x + 60;
    p1.y = p0.y;
    p1.vz = 0;

    engine.triggerCableYank(p0);
    expect(p1.vz).toBeGreaterThan(100);
    expect(p1.vx).toBeLessThan(0);
  });

  it('removes bots and latches switches when botsEnabled is false (SIN BOTS)', () => {
    const engine = new ChainPanicEngine();
    engine.syncPlayerIdentities(
      [
        { name: 'ALEX', isBot: false },
        { name: 'LEO', isBot: true },
        { name: 'MAX', isBot: true },
        { name: 'NICO', isBot: true }
      ],
      false
    );

    const active = engine.getActivePlayers();
    expect(active.length).toBe(1);
    expect(active[0].name).toBe('ALEX');

    // Step on switch 0 then walk away -> switch 0 must stay latched for solo player!
    const sw0 = engine.switches[0];
    active[0].x = sw0.x;
    active[0].y = sw0.y;
    engine.step(0.016, dummyInput);
    expect(sw0.pressed).toBe(true);

    active[0].x = 100;
    active[0].y = 260;
    engine.step(0.016, dummyInput);
    expect(sw0.pressed).toBe(true);
  });
});

describe('PuttWarEngine (03 // TURBO-PUTT)', () => {
  it('loads all 6 combat mini-golf holes without errors', () => {
    const engine = new PuttWarEngine();
    expect(PUTT_HOLES.length).toBe(6);

    for (let i = 0; i < PUTT_HOLES.length; i++) {
      engine.loadHole(i);
      expect(engine.holeIndex).toBe(i);
      expect(() => engine.step(0.016, dummyInput)).not.toThrow();
    }
  });

  it('executes putt, lobs Worms proximity mine, and blasts rival balls on detonation', () => {
    const engine = new PuttWarEngine();
    const p0 = engine.players[0];
    const p1 = engine.players[1];

    engine.executePutt(p0, 0.75, 0);
    expect(p0.strokes).toBe(1);
    expect(p0.vx).toBeGreaterThan(200);

    // Place rival p1 near p0 and lob a bomb
    p1.x = p0.x + 28;
    p1.y = p0.y;
    p1.vx = 0;
    p1.vy = 0;

    engine.lobBombOrWeapon(p0);
    expect(engine.bombs.length).toBe(1);

    // Force bomb timer to expire and step physics
    engine.bombs[0].timer = 0.01;
    engine.step(0.02, dummyInput);

    expect(engine.bombs.length).toBe(0);
    expect(Math.hypot(p1.vx, p1.vy)).toBeGreaterThan(150);
  });

  it('awards points and starts Hurry-Up countdown when a ball sinks into the cup', () => {
    const engine = new PuttWarEngine();
    const p0 = engine.players[0];

    p0.x = engine.cupX + 2;
    p0.y = engine.cupY;
    p0.vx = 20;
    p0.vy = 0;
    p0.strokes = 2;

    engine.step(0.016, dummyInput);

    expect(p0.sunkInCup).toBe(true);
    expect(p0.totalPoints).toBeGreaterThanOrEqual(3);
    expect(engine.hurryActive).toBe(true);
  });
});

describe('MultiplayerRoomManager Anti-Freeze Watchdog & Moderation', () => {
  it('only steps authoritative physics on the Host so Clients never spawn local bots or reset rounds', () => {
    const arena = new ArenaEngine();
    const chain = new ChainPanicEngine();
    const net = new MultiplayerRoomManager(arena, chain, () => {});

    expect(net.shouldStepLocally()).toBe(true);

    // When connected as a Client, shouldStepLocally MUST be false so local bot AI never runs
    net.isHost = false;
    expect(net.shouldStepLocally()).toBe(false);
  });

  it('allows Host to kick & ban a remote player slot and reset it to a bot', () => {
    const arena = new ArenaEngine();
    const chain = new ChainPanicEngine();
    const net = new MultiplayerRoomManager(arena, chain, () => {});

    // Simulate a remote player in slot 1
    arena.players[1].isBot = false;
    arena.players[1].peerId = 'P-GRIEFER';
    arena.players[1].name = 'TROLL';

    const kicked = net.kickPlayerSlot(1);
    expect(kicked).toBe(true);
    expect(net.bannedPeerIds.has('P-GRIEFER')).toBe(true);
    expect(arena.players[1].isBot).toBe(true);
  });

  it('tracks peer join & leave cleanly and notifies all players with toasts', () => {
    const arena = new ArenaEngine();
    const chain = new ChainPanicEngine();
    const net = new MultiplayerRoomManager(arena, chain, () => {});

    // Simulate incoming JOIN_CLAIM from friend P-FRIEND1
    (net as unknown as { handleEnvelope: (env: unknown, reply: () => void) => void }).handleEnvelope(
      {
        sender: 'P-FRIEND1',
        type: 'JOIN_CLAIM',
        payload: { peerId: 'P-FRIEND1', name: 'MATEO' }
      },
      () => {}
    );

    expect(arena.players[1].isBot).toBe(false);
    expect(arena.players[1].name).toBe('MATEO');
    expect(net.toasts.some((t) => t.text.includes('MATEO SE UNIÓ'))).toBe(true);

    // Simulate P-FRIEND1 leaving the room (PEER_LEAVE)
    (net as unknown as { handleEnvelope: (env: unknown, reply: () => void) => void }).handleEnvelope(
      {
        sender: 'P-FRIEND1',
        type: 'PEER_LEAVE',
        payload: { peerId: 'P-FRIEND1' }
      },
      () => {}
    );

    expect(arena.players[1].isBot).toBe(true);
    expect(net.toasts.some((t) => t.text.includes('MATEO SALIÓ'))).toBe(true);
  });

  it('synchronizes GAME_SWITCH and ROOM_ACTION across Host and Friends even if Host tab is hidden', () => {
    // Setup Host instance
    const hostArena = new ArenaEngine();
    const hostChain = new ChainPanicEngine();
    const hostPutt = new PuttWarEngine();
    const hostNet = new MultiplayerRoomManager(hostArena, hostChain, () => {}, hostPutt);

    // Setup Friend (Client) instance
    const clientArena = new ArenaEngine();
    const clientChain = new ChainPanicEngine();
    const clientPutt = new PuttWarEngine();
    const clientNet = new MultiplayerRoomManager(clientArena, clientChain, () => {}, clientPutt);

    // Wire virtual transport between Host and Client
    const hostBus = {
      postMessage: (env: unknown) => {
        clientNet.handleEnvelope(env as Parameters<typeof clientNet.handleEnvelope>[0], (reply) => {
          hostNet.handleEnvelope(reply, () => {});
        });
      }
    };
    const clientBus = {
      postMessage: (env: unknown) => {
        hostNet.handleEnvelope(env as Parameters<typeof hostNet.handleEnvelope>[0], (reply) => {
          clientNet.handleEnvelope(reply, () => {});
        });
      }
    };

    (hostNet as unknown as { localBus: typeof hostBus }).localBus = hostBus;
    (clientNet as unknown as { localBus: typeof clientBus }).localBus = clientBus;

    // 1. Simulate Host tab being hidden in background (e.g. pasting link on Discord) when Friend joins!
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    clientBus.postMessage({
      sender: clientNet.localPeerId,
      type: 'JOIN_CLAIM',
      payload: { peerId: clientNet.localPeerId, name: 'SOFIA' }
    });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });

    // Friend must be connected in Slot 1!
    expect(clientNet.isHost).toBe(false);
    expect(clientNet.localSlotId).toBe(1);
    expect(hostArena.players[1].name).toBe('SOFIA');
    expect(hostArena.players[1].isBot).toBe(false);

    // 2. Host clicks "JUGAR BASH-BOT" -> Client must immediately enter BASH_BOT!
    hostNet.switchGame('BASH_BOT');
    expect(hostNet.activeGame).toBe('BASH_BOT');
    expect(clientNet.activeGame).toBe('BASH_BOT');

    // 3. Friend (Client) clicks "JUGAR TURBO-PUTT" -> Host AND Client must both enter TURBO_PUTT!
    clientNet.switchGame('TURBO_PUTT');
    expect(hostNet.activeGame).toBe('TURBO_PUTT');
    expect(clientNet.activeGame).toBe('TURBO_PUTT');

    // 4. Host or Client changes Bot Difficulty to OFF and advances to Hole 3 -> Both sync!
    hostNet.sendOrApplyRoomAction({ kind: 'BOT_DIFF', botDifficulty: 'OFF' });
    expect(hostArena.botDifficulty).toBe('OFF');
    expect(clientArena.botDifficulty).toBe('OFF');

    // Verify bots are completely hidden on BOTH Host and Friend screens across all 3 games!
    expect(hostArena.players.filter((p) => p.alive).length).toBe(2);
    expect(clientArena.players.filter((p) => p.alive).length).toBe(2);
    expect(clientChain.getActivePlayers().length).toBe(2);
    expect(clientPutt.getActivePlayers().length).toBe(2);

    clientNet.sendOrApplyRoomAction({ kind: 'LOAD_STAGE', holeIndex: 3 });
    expect(hostPutt.holeIndex).toBe(3);
    expect(clientPutt.holeIndex).toBe(3);

    // 5. Verify a stray WORLD_SNAP or background tab with activeGame: 'HUB' NEVER kicks Client back to HUB!
    clientNet.handleEnvelope(
      {
        sender: hostNet.localPeerId,
        type: 'WORLD_SNAP',
        payload: { ...hostArena.getSnapshot(), activeGame: 'HUB' }
      },
      () => {}
    );
    expect(clientNet.activeGame).toBe('TURBO_PUTT');

    // Also verify packets from a rogue/duplicate tab sender are strictly ignored
    clientNet.handleEnvelope(
      {
        sender: 'P-ROGUE-TAB-99',
        type: 'GAME_SWITCH',
        payload: { activeGame: 'HUB', botDifficulty: 'NORMAL', levelIndex: 0, holeIndex: 0 }
      },
      () => {}
    );
    expect(clientNet.activeGame).toBe('TURBO_PUTT');
  });
});

describe('HotCoreEngine (04 // HOT-CORE)', () => {
  it('throws the unstable nuclear core as a projectile and reflects it when target has Reflector Parry Shield active', () => {
    const engine = new HotCoreEngine();
    expect(HOT_CORE_ARENAS.length).toBeGreaterThanOrEqual(4);

    const p0 = engine.players[0];
    const p1 = engine.players[1];

    // Give core to P0 aimed directly at P1
    engine.core.holderId = 0;
    p0.x = 150;
    p0.y = 250;
    p1.x = 245;
    p1.y = 250;
    p1.passImmunityTimer = 0;
    p0.aimAngle = 0;

    // P0 throws core
    engine.triggerThrowOrShield(p0, 0);
    expect(engine.core.holderId).toBeNull();
    expect(engine.core.vx).toBeGreaterThan(500);

    // P1 activates Reflector Parry Shield right as core approaches
    const fuseBeforeParry = engine.core.fuseTimer;
    engine.triggerThrowOrShield(p1);
    expect(p1.shieldTimer).toBeGreaterThan(0);

    // Core is immediately reflected back toward P0 (vx < 0) and fuse overclocked (-1.15s)
    expect(engine.core.holderId).toBeNull();
    expect(engine.core.vx).toBeLessThan(0);
    expect(engine.core.fuseTimer).toBeLessThan(fuseBeforeParry - 0.5);

    // Stepping forward carries the reflected core right back into P0!
    engine.step(0.04, dummyInput);
    expect(engine.core.holderId).toBe(0);
  });

  it('passes the nuclear core on physical tackle collision and detonates when fuseTimer reaches 0', () => {
    const engine = new HotCoreEngine();
    const p0 = engine.players[0];
    const p1 = engine.players[1];

    engine.core.holderId = 0;
    p0.passImmunityTimer = 0;
    p1.passImmunityTimer = 0;
    p0.x = 400;
    p0.y = 250;
    p1.x = 420;
    p1.y = 250;
    p0.vx = 250;

    engine.step(0.03, dummyInput);
    expect(engine.core.holderId).toBe(1);

    // Force fuse expiration on P1
    engine.core.fuseTimer = 0.01;
    engine.step(0.05, dummyInput);
    expect(p1.alive).toBe(false);
  });
});

describe('VoltCrownEngine (05 // VOLT-CROWN)', () => {
  it('accumulates battery charge while holding the crown and triggers Volt Overcharge at 15s', () => {
    const engine = new VoltCrownEngine();
    expect(VOLT_CROWN_ARENAS.length).toBeGreaterThanOrEqual(4);

    const p0 = engine.players[0];
    p0.x = 500;
    p0.y = 258;
    p0.immunityTimer = 0;

    // Step near crown to claim it
    engine.crown.x = 500;
    engine.crown.y = 258;
    engine.step(0.04, dummyInput);
    expect(engine.crown.holderId).toBe(0);

    // Charge over time
    const initialScore = p0.score;
    engine.step(1.0, dummyInput);
    expect(p0.score).toBeGreaterThan(initialScore);

    // Fast-forward holdStreak to trigger 15s Volt Overcharge
    p0.holdStreak = 14.98;
    const scoreBeforeNova = p0.score;
    engine.step(0.05, dummyInput);
    expect(p0.score).toBeGreaterThanOrEqual(scoreBeforeNova + 14);
    expect(p0.holdStreak).toBeLessThan(1.0); // Reset after nova!
  });

  it('drops the crown when hunter shoots King with Shock Taser Bolt', () => {
    const engine = new VoltCrownEngine();
    const king = engine.players[0];
    const hunter = engine.players[1];
    hunter.isBot = false;

    engine.crown.holderId = 0;
    king.x = 340;
    king.y = 120;
    hunter.x = 220;
    hunter.y = 120;
    hunter.aimAngle = 0; // aimed directly right at King

    // Hunter shoots taser bolt
    engine.triggerTaserOrDefend(hunter, 0);
    expect(engine.projectiles.length).toBe(1);

    // Step until projectile reaches king
    for (let i = 0; i < 6; i++) {
      engine.step(0.04, dummyInput);
    }

    // King must have dropped the crown and entered stun
    expect(engine.crown.holderId).toBeNull();
    expect(king.stunTimer).toBeGreaterThan(0);
  });

  it('reflects incoming taser bolt when King activates Magnetic Deflect Shield', () => {
    const engine = new VoltCrownEngine();
    const king = engine.players[0];
    const hunter = engine.players[1];
    hunter.isBot = false;

    engine.crown.holderId = 0;
    king.x = 320;
    king.y = 120;
    hunter.x = 240;
    hunter.y = 120;
    hunter.aimAngle = 0;

    // Hunter fires
    engine.triggerTaserOrDefend(hunter, 0);
    const proj = engine.projectiles[0];
    expect(proj).toBeDefined();

    // King activates Deflect Shield right as bolt arrives
    engine.triggerTaserOrDefend(king);
    expect(king.shieldTimer).toBeGreaterThan(0);
    expect(proj.isReflected).toBe(true);
    expect(proj.vx).toBeLessThan(0); // reflected back towards hunter!
  });

  it('ejects player and grants trapImmunityTimer when hitting active hazard so player never gets trapped', () => {
    const engine = new VoltCrownEngine();
    const p0 = engine.players[0];
    const crusher = engine.traps.find((t) => t.type === 'CRUSHER')!;
    expect(crusher).toBeDefined();

    // Activate crusher and place player inside it
    crusher.active = true;
    p0.x = crusher.x + crusher.w * 0.5;
    p0.y = crusher.y + crusher.h * 0.5;
    p0.trapImmunityTimer = 0;

    engine.step(0.016, dummyInput);

    // Player should have been stunned, given immunity, and ejected
    expect(p0.stunTimer).toBeGreaterThan(0);
    expect(p0.trapImmunityTimer).toBeGreaterThan(0.9);
    // Position or velocity should have shifted outward
    expect(Math.hypot(p0.vx, p0.vy)).toBeGreaterThan(200);

    // On next frame, player with immunity should NOT trigger another collision or spawn more debris
    const partsCount = engine.looseParts.length;
    engine.step(0.016, dummyInput);
    expect(engine.looseParts.length).toBe(partsCount); // No new debris while immune!
  });

  it('decays loose parts over time and enforces maximum capacity to prevent memory leaks', () => {
    const engine = new VoltCrownEngine();
    // Disable bots so they don't walk into crushers during simulation
    engine.players.forEach((p) => (p.isBot = false));

    // Simulate multiple hits generating debris
    for (let i = 0; i < 40; i++) {
      (engine as unknown as { spawnDebris: (x: number, y: number, c: string) => void }).spawnDebris(200, 200, '#FF4F00');
    }
    // Strict cap must prevent array from blowing up
    expect(engine.looseParts.length).toBeLessThanOrEqual(28);

    // Step engine 4 seconds - all looseParts should decay and be removed
    for (let s = 0; s < 250; s++) {
      engine.step(0.02, dummyInput);
    }
    expect(engine.looseParts.length).toBe(0);
  });
});

describe('HexCrushEngine (06 // HEX-CRUSH)', () => {
  it('initializes 4 players and generates hex tiles across all 3 sectors', () => {
    const engine = new HexCrushEngine();
    expect(engine.players.length).toBe(4);
    expect(engine.tiles.length).toBeGreaterThan(40);

    // Test loading each sector
    for (let i = 0; i < HEX_CRUSH_ARENAS.length; i++) {
      engine.loadArena(i);
      expect(engine.arenaTitle).toBe(HEX_CRUSH_ARENAS[i].title);
      expect(engine.tiles.length).toBeGreaterThan(30);
    }
  });

  it('triggers Seismic Hammer Slam, spawns directional shockwave, and cracks tiles', () => {
    const engine = new HexCrushEngine();
    const p0 = engine.players[0];
    p0.x = 400;
    p0.y = 250;
    p0.z = 0;
    p0.aimAngle = 0; // aimed right

    engine.triggerHammerSlam(p0, 0);

    expect(engine.shockwaves.length).toBe(1);
    expect(engine.shockwaves[0].vx).toBeGreaterThan(0);
    expect(p0.hammerCooldown).toBeGreaterThan(0);

    // Step engine to let shockwave propagate and damage tiles
    for (let i = 0; i < 5; i++) {
      engine.step(0.03, dummyInput);
    }

    // Some tiles in trajectory should be damaged
    const damagedTiles = engine.tiles.filter((t) => t.health < t.maxHealth);
    expect(damagedTiles.length).toBeGreaterThan(0);
  });

  it('performs Rocket Jump on ground and Ground Pound while in the air with radial shockwave', () => {
    const engine = new HexCrushEngine();
    const p0 = engine.players[0];
    p0.z = 0;
    p0.jumpCooldown = 0;

    // First press on ground triggers Rocket Jump!
    engine.triggerJumpOrPound(p0);
    expect(p0.vz).toBeGreaterThan(300);
    expect(p0.z).toBeGreaterThan(0);

    // Advance physics to reach mid-air
    engine.step(0.08, dummyInput);
    expect(p0.z).toBeGreaterThan(10);

    // Second press while airborne triggers Ground Pound!
    engine.triggerJumpOrPound(p0);
    expect(p0.isGroundPounding).toBe(true);
    expect(p0.vz).toBeLessThan(-600);

    // Step until landing
    while (p0.z > 0) {
      engine.step(0.02, dummyInput);
    }

    expect(p0.z).toBe(0);
    expect(p0.isGroundPounding).toBe(false);
  });

  it('deploys emergency cyan nanotile bridge under player when triggered', () => {
    const engine = new HexCrushEngine();
    const p0 = engine.players[0];
    p0.x = 450;
    p0.y = 250;
    p0.bridgeCooldown = 0;

    engine.triggerEmergencyNanobridge(p0);
    expect(p0.bridgeCooldown).toBeGreaterThan(5);

    const bridgeTiles = engine.tiles.filter((t) => t.type === 'BRIDGE');
    expect(bridgeTiles.length).toBeGreaterThan(0);
    expect(bridgeTiles[0].health).toBe(2);
  });

  it('eliminates player who steps into empty void abyss and awards round win to survivor', () => {
    const engine = new HexCrushEngine();
    // Disable bots to test pure survivor elimination
    engine.players.forEach((p) => (p.isBot = false));

    // Place player 1 out in the deep empty void far from any tiles
    const p1 = engine.players[1];
    p1.x = 105;
    p1.y = 80;
    p1.z = 0;

    // Step engine to detect footing
    engine.step(0.016, dummyInput);
    expect(p1.fallTimer).toBeGreaterThan(0);

    // Advance past fallTimer duration
    for (let s = 0; s < 50; s++) {
      engine.step(0.02, dummyInput);
    }
    expect(p1.alive).toBe(false);

    // Now eliminate players 2 and 3 so only player 0 remains
    engine.players[2].alive = false;
    engine.players[3].alive = false;

    // Step to trigger round end
    engine.step(0.016, dummyInput);
    expect(engine.status).toBe('ROUND_OVER');
    expect(engine.roundWinnerId).toBe(0);
    expect(engine.players[0].score).toBe(1);
  });
});

describe('TournamentManager (Party Tournament Mode & Chaos Mutators)', () => {
  it('generates a 5-round playlist with mutators and spins roulette', () => {
    const tm = new TournamentManager();
    const switchedGames: string[] = [];

    tm.startTournament((g) => switchedGames.push(g));

    expect(tm.state.active).toBe(true);
    expect(tm.state.roundIndex).toBe(0);
    expect(tm.state.totalRounds).toBe(5);
    expect(tm.state.gameSequence.length).toBe(5);
    expect(tm.state.mutators.length).toBe(5);
    expect(tm.state.rouletteSpinning).toBe(true);
    expect(switchedGames.length).toBe(1);

    // Step through the roulette animation
    for (let i = 0; i < 30; i++) {
      tm.step(0.1, (g) => switchedGames.push(g));
    }

    // Roulette should finish and lock on active mutator
    expect(tm.state.rouletteSpinning).toBe(false);
    expect(tm.state.rouletteDisplayId).toBe(tm.state.currentMutator);
    expect(tm.getCurrentMutatorDef()).toBeDefined();
  });

  it('accumulates scores across rounds and crowns the Grand Champion after 5 rounds', () => {
    const tm = new TournamentManager();
    const switched: string[] = [];
    tm.startTournament((g) => switched.push(g));

    // Fast-forward roulette
    for (let i = 0; i < 30; i++) tm.step(0.1, (g) => switched.push(g));

    // Player 0 wins Round 1
    tm.recordRoundWinner(0);
    expect(tm.state.scores[0]).toBe(3);

    // Fast-forward intermission to Round 2
    for (let i = 0; i < 40; i++) tm.step(0.1, (g) => switched.push(g));
    expect(tm.state.roundIndex).toBe(1);

    // Player 1 wins Round 2
    tm.recordRoundWinner(1);
    expect(tm.state.scores[1]).toBe(3);

    // Fast-forward intermission to Round 3
    for (let i = 0; i < 40; i++) tm.step(0.1, (g) => switched.push(g));
    expect(tm.state.roundIndex).toBe(2);

    // Player 0 wins Round 3
    tm.recordRoundWinner(0);
    expect(tm.state.scores[0]).toBe(6);

    // Fast-forward to Round 4
    for (let i = 0; i < 40; i++) tm.step(0.1, (g) => switched.push(g));
    expect(tm.state.roundIndex).toBe(3);

    // Player 2 wins Round 4
    tm.recordRoundWinner(2);

    // Fast-forward to Round 5 (Final)
    for (let i = 0; i < 40; i++) tm.step(0.1, (g) => switched.push(g));
    expect(tm.state.roundIndex).toBe(4);

    // Player 0 wins Round 5
    tm.recordRoundWinner(0);
    expect(tm.state.scores[0]).toBe(9);

    // Tournament should be finished and Player 0 crowned Champion!
    expect(tm.state.isFinished).toBe(true);
    expect(tm.state.champId).toBe(0);
  });

  it('handles snapshot synchronization between host and client', () => {
    const host = new TournamentManager();
    const client = new TournamentManager();

    host.startTournament(() => {});
    host.recordRoundWinner(1);

    const snap = host.getSnapshot();
    client.applySnapshot(snap);

    expect(client.state.active).toBe(true);
    expect(client.state.scores[1]).toBe(3);
    expect(client.state.gameSequence).toEqual(host.state.gameSequence);
  });
});

describe('ProceduralChiptuneEngine (Web Audio BGM)', () => {
  it('initializes in HUB mode and toggles state cleanly without crashing in non-audio environments', () => {
    const bgmEngine = new ProceduralChiptuneEngine();
    expect(bgmEngine.currentTrack).toBe('HUB');
    
    // Toggle on
    const enabled = bgmEngine.toggle();
    expect(bgmEngine.enabled).toBe(enabled);

    // Switch track to BATTLE
    bgmEngine.setTrack('BATTLE');
    expect(bgmEngine.currentTrack).toBe('BATTLE');

    // Switch track back to HUB
    bgmEngine.setTrack('HUB');
    expect(bgmEngine.currentTrack).toBe('HUB');

    // Toggle off
    bgmEngine.toggle();
    expect(bgmEngine.enabled).toBe(false);
  });
});

describe('TouchGamepad (Virtual Mobile Controller)', () => {
  it('manages enabled state and resets coordinates correctly', () => {
    const pad = new TouchGamepad();
    expect(pad.moveX).toBe(0);
    expect(pad.moveY).toBe(0);
    expect(pad.isHoldingA).toBe(false);

    pad.show();
    expect(pad.enabled).toBe(true);

    pad.hide();
    expect(pad.enabled).toBe(false);
    expect(pad.moveX).toBe(0);
    expect(pad.moveY).toBe(0);

    const toggled = pad.toggle();
    expect(toggled).toBe(true);
    expect(pad.enabled).toBe(true);
  });

  it('triggers registered action button callbacks', () => {
    const pad = new TouchGamepad();
    let pressedA = false;
    let releasedA = false;
    let pressedB = false;

    pad.callbacks = {
      onPressA: () => { pressedA = true; },
      onReleaseA: () => { releasedA = true; },
      onPressB: () => { pressedB = true; }
    };

    pad.callbacks.onPressA?.();
    expect(pressedA).toBe(true);

    pad.callbacks.onReleaseA?.();
    expect(releasedA).toBe(true);

    pad.callbacks.onPressB?.();
    expect(pressedB).toBe(true);
  });
});

describe('RobotWorkshopManager (Cosmetics & Garage)', () => {
  it('contains valid catalog configurations for hats, visors, and skins', () => {
    expect(ROBOT_HATS.length).toBeGreaterThanOrEqual(6);
    expect(ROBOT_VISORS.length).toBeGreaterThanOrEqual(6);
    expect(ROBOT_SKINS.length).toBeGreaterThanOrEqual(4);

    expect(ROBOT_HATS.some((h) => h.id === 'CROWN')).toBe(true);
    expect(ROBOT_VISORS.some((v) => v.id === 'CYAN')).toBe(true);
    expect(ROBOT_SKINS.some((s) => s.id === 'STEALTH')).toBe(true);
  });

  it('updates and persists cosmetics cleanly', () => {
    const workshop = new RobotWorkshopManager();
    expect(workshop.cosmetics).toBeDefined();

    workshop.saveCosmetics({ hat: 'CROWN', visor: 'MAGENTA', skin: 'STEALTH' });
    expect(workshop.cosmetics.hat).toBe('CROWN');
    expect(workshop.cosmetics.visor).toBe('MAGENTA');
    expect(workshop.cosmetics.skin).toBe('STEALTH');

    const color = workshop.getVisorColor('MAGENTA');
    expect(color).toBe('#ff007f');

    const skinColors = workshop.getSkinColors('STEALTH', '#ffffff', '#aaaaaa');
    expect(skinColors.body).toBe('#27272a');
    expect(skinColors.shade).toBe('#18181b');
  });
});

describe('RicochetEngine (07 // RICOCHET-1)', () => {
  it('initializes 4 players in distinct corners with lives and 1 heavy plasma bullet', () => {
    const engine = new RicochetEngine();
    expect(engine.players.length).toBe(4);
    expect(engine.bullets.length).toBe(1);
    expect(engine.mirrors.length).toBeGreaterThan(0);
    expect(RICOCHET_ARENAS.length).toBe(3);

    const p0 = engine.players[0];
    expect(p0.lives).toBe(3);
    expect(p0.alive).toBe(true);
    expect(p0.score).toBe(0);
  });

  it('cycles arenas cleanly with different mirror configurations', () => {
    const engine = new RicochetEngine();
    expect(engine.arenaIndex).toBe(0);

    engine.loadArena(1);
    expect(engine.arenaIndex).toBe(1);
    expect(engine.mirrors.some((m) => m.moveRangeY > 0)).toBe(true);

    engine.loadArena(2);
    expect(engine.arenaIndex).toBe(2);
  });

  it('reflects bullet and applies supercharge when parried', () => {
    const engine = new RicochetEngine();
    const p0 = engine.players[0];
    const bullet = engine.bullets[0];

    // Place bullet right next to p0
    bullet.x = p0.x + 20;
    bullet.y = p0.y;
    bullet.vx = -300;
    bullet.vy = 0;

    // Trigger parry towards right (aimAngle = 0)
    p0.parryTimer = 0.2;
    p0.aimAngle = 0;

    engine.step(0.016, dummyInput);

    expect(bullet.ownerId).toBe(p0.id);
    expect(bullet.isSupercharged).toBe(true);
    expect(bullet.vx).toBeGreaterThan(0);
  });

  it('allows players to slide-dodge under incoming bullets', () => {
    const engine = new RicochetEngine();
    const p0 = engine.players[0];
    const bullet = engine.bullets[0];

    bullet.x = p0.x + 5;
    bullet.y = p0.y;
    bullet.vx = -300;
    bullet.vy = 0;
    bullet.ownerId = 1; // Enemy bullet
    bullet.bounceCount = 1;

    // Put p0 in slide
    p0.slideTimer = 0.25;

    engine.step(0.016, dummyInput);

    // p0 should NOT be KO'd because they ducked in a slide!
    expect(p0.alive).toBe(true);
    expect(p0.lives).toBe(3);
  });

  it('handles snapshot generation and synchronization between host and client', () => {
    const host = new RicochetEngine();
    const client = new RicochetEngine();

    host.players[0].score = 4;
    host.bullets[0].isSupercharged = true;

    const snap = host.getSnapshot();
    client.applySnapshot(snap);

    expect(client.players[0].score).toBe(4);
    expect(client.bullets[0].isSupercharged).toBe(true);
  });
});

