import { describe, expect, it } from 'vitest';
import { TournamentManager } from '../game/tournamentManager';
import { defaultTournamentOptions, TOURNAMENT_GAMES, validTournamentOptions } from '../game/tournamentRules';
import { validAction, validSnapshot } from '../net/protocol';
import { ArenaEngine } from '../game/arenaEngine';
import { readyTournamentRound } from './tournamentTestUtils';
import { emptyMatchStats } from '../game/matchResults';

const noChaos = { totalRounds: 3 as const, games: ['HEX_CRUSH' as const], mutatorsEnabled: false };

describe('Tournament preparation and configurable cups', () => {
  it('aggregates confirmed feats once per round and keeps the best streak for the complete cup', () => {
    const manager = new TournamentManager();
    manager.startTournament(() => {}, noChaos);
    const stats = Array.from({ length: 4 }, emptyMatchStats);
    Object.assign(stats[0], { parries: 4, perfectParries: 2, bestStreak: 3 });
    for (let round = 0; round < 3; round++) {
      readyTournamentRound(manager);
      manager.recordRoundWinner(0, stats);
      manager.recordRoundWinner(0, stats);
      manager.step(3.3, () => {});
    }
    expect(manager.state.matchStats[0].parries).toBe(12);
    expect(manager.state.matchStats[0].perfectParries).toBe(6);
    expect(manager.state.matchStats[0].bestStreak).toBe(3);
    const snapshot = manager.getSnapshot();
    const client = new TournamentManager(); client.applySnapshot(snapshot);
    snapshot.matchStats[0].perfectParries = 99;
    expect(client.state.matchStats[0].perfectParries).toBe(6);
    expect(manager.state.matchStats[0].perfectParries).toBe(6);
  });
  it.each([3, 5, 7] as const)('finishes exactly %i rounds, then preserves the playlist and resets scores for a rematch', totalRounds => {
    const manager = new TournamentManager();
    manager.startTournament(() => {}, { ...defaultTournamentOptions(), totalRounds });
    const games = [...manager.state.gameSequence], mutators = [...manager.state.mutators];
    expect(games).toHaveLength(totalRounds);
    expect(new Set(games.slice(0, 6)).size).toBe(Math.min(totalRounds, 6));
    for (let i = 0; i < totalRounds; i++) {
      readyTournamentRound(manager);
      manager.recordRoundWinner(2);
      manager.step(3.3, () => {});
    }
    expect(manager.state.isFinished).toBe(true);
    expect(manager.state.roundIndex).toBe(totalRounds - 1);
    expect(manager.state.scores[2]).toBe(totalRounds * 3);
    const oldPreparationId = manager.state.preparationId;
    manager.startTournament(() => {}, undefined, true);
    expect(manager.state.gameSequence).toEqual(games);
    expect(manager.state.mutators).toEqual(mutators);
    expect(manager.state.totalRounds).toBe(totalRounds);
    expect(manager.state.scores).toEqual([0, 0, 0, 0]);
    expect(manager.state.readySlots).toEqual([]);
    expect(manager.state.preparationId).toBeGreaterThan(oldPreparationId);
    expect(manager.state.preparing).toBe(true);
  });

  it('waits for every human, rejects early results, and keeps the full countdown after duplicate confirmations', () => {
    const manager = new TournamentManager();
    manager.startTournament(() => {}, noChaos);
    manager.syncParticipants([0, 2]);
    manager.recordRoundWinner(0);
    manager.step(100, () => {});
    expect(manager.state.scores).toEqual([0, 0, 0, 0]);
    expect(manager.state.preparing).toBe(true);
    expect(manager.markReady(1, manager.state.preparationId)).toBe(false); // a bot
    expect(manager.markReady(0, manager.state.preparationId)).toBe(true);
    manager.step(10, () => {});
    expect(manager.state.countdown).toBe(0);
    expect(manager.markReady(2, manager.state.preparationId)).toBe(true);
    manager.step(1, () => {});
    expect(manager.markReady(2, manager.state.preparationId)).toBe(false);
    manager.syncParticipants([0, 2]);
    expect(manager.state.countdown).toBe(2);
    manager.step(1.99, () => {});
    expect(manager.isPaused).toBe(true);
    manager.step(0.02, () => {});
    expect(manager.isPaused).toBe(false);
    manager.recordRoundWinner(0);
    expect(manager.state.scores[0]).toBe(3);
  });

  it('resets readiness every round and ignores delayed confirmations from previous rounds and cups', () => {
    const manager = new TournamentManager();
    manager.startTournament(() => {}, noChaos);
    const firstId = manager.state.preparationId;
    readyTournamentRound(manager);
    manager.recordRoundWinner(0);
    manager.step(3.3, () => {});
    expect(manager.state.preparing).toBe(true);
    expect(manager.state.readySlots).toEqual([]);
    expect(manager.markReady(0, firstId)).toBe(false);
    const nextId = manager.state.preparationId;
    manager.stopTournament();
    manager.startTournament(() => {}, noChaos);
    expect(manager.markReady(0, nextId)).toBe(false);
  });

  it('cancels the countdown for arrivals and restarts it when a pending player leaves', () => {
    const manager = new TournamentManager();
    manager.startTournament(() => {}, noChaos);
    manager.markReady(0, manager.state.preparationId);
    manager.step(1, () => {});
    manager.syncParticipants([0, 1]);
    expect(manager.state.countdown).toBe(0);
    manager.step(10, () => {});
    expect(manager.isPaused).toBe(true);
    manager.syncParticipants([0]);
    expect(manager.state.countdown).toBe(3);
    manager.step(3.01, () => {});
    expect(manager.isPaused).toBe(false);
  });

  it('requires reconfirmation when a ready player loses their connection', () => {
    const manager = new TournamentManager();
    manager.startTournament(() => {}, noChaos);
    manager.syncParticipants([0, 1]);
    manager.markReady(0, manager.state.preparationId);
    manager.markReady(1, manager.state.preparationId);
    manager.clearReady(1);
    expect(manager.state.countdown).toBe(0);
    manager.step(10, () => {});
    expect(manager.state.preparing).toBe(true);
    manager.markReady(1, manager.state.preparationId);
    expect(manager.state.countdown).toBe(3);
  });

  it('uses only selected games, supports a single-game cup and completely disables mutators', () => {
    const manager = new TournamentManager();
    manager.startTournament(() => {}, { ...noChaos, totalRounds: 7 });
    expect(manager.state.gameSequence).toEqual(Array(7).fill('HEX_CRUSH'));
    expect(manager.state.mutators).toEqual(Array(7).fill('NONE'));
    expect(manager.state.rouletteSpinning).toBe(false);
    readyTournamentRound(manager);
    manager.recordRoundWinner(0);
    manager.step(3.3, () => {});
    expect(manager.state.rouletteSpinning).toBe(false);
    expect(manager.state.preparing).toBe(true);
  });

  it('copies readiness and settings in snapshots so peers cannot mutate each other', () => {
    const manager = new TournamentManager(), client = new TournamentManager();
    manager.startTournament(() => {}, noChaos);
    manager.markReady(0, manager.state.preparationId);
    const snap = manager.getSnapshot();
    client.applySnapshot(snap);
    expect(client.isPaused).toBe(true);
    expect(client.state.countdown).toBe(3);
    snap.readySlots.length = 0;
    snap.options.games.push('HOT_CORE');
    expect(manager.state.readySlots).toEqual([0]);
    expect(client.state.readySlots).toEqual([0]);
    expect(client.state.options.games).toEqual(['HEX_CRUSH']);
  });

  it('rejects invalid options and forged readiness snapshots at the protocol boundary', () => {
    for (const options of [
      { ...noChaos, games: [] }, { ...noChaos, games: ['HUB'] }, { ...noChaos, games: ['CHAIN_PANIC'] },
      { ...noChaos, games: ['HEX_CRUSH', 'HEX_CRUSH'] }, { ...noChaos, totalRounds: 99 },
      { ...noChaos, mutatorsEnabled: 'yes' }
    ]) {
      expect(validTournamentOptions(options)).toBe(false);
      expect(validAction({ kind: 'START_TOURNAMENT', tournamentOptions: options })).toBe(false);
    }
    expect(TOURNAMENT_GAMES).toHaveLength(6);
    const tournament = new TournamentManager();
    tournament.startTournament(() => {}, noChaos);
    const snapshot = { ...new ArenaEngine().getSnapshot(), activeGame: 'BASH_BOT', stateSeq: 1, snapshotSeq: 1,
      hostEpoch: 'host-epoch', tournamentState: tournament.getSnapshot() };
    expect(validSnapshot(snapshot)).toBe(true);
    for (const patch of [{ readySlots: [1] }, { readySlots: [0, 0] }, { requiredSlots: [4] },
      { preparing: 'yes' }, { countdown: -1 }, { countdown: 10 }, { preparationId: NaN }]) {
      expect(validSnapshot({ ...snapshot, tournamentState: { ...snapshot.tournamentState, ...patch } })).toBe(false);
    }
  });
});
