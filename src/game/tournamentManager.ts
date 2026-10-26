import { sfx } from '../audio/mechanicalSfx';
import {
  ActiveGameId,
  BotDifficulty,
  CHAOS_MUTATORS,
  ChaosMutatorId,
  TournamentMatchState,
  TournamentOptions
} from '../types';
import type { MatchStats } from '../types';
import { emptyMatchStats } from './matchResults';
import { defaultTournamentOptions, validTournamentOptions } from './tournamentRules';

const AVAILABLE_MUTATORS: ChaosMutatorId[] = [
  'SUPER_SPEED',
  'BOUNCY_BUMPERS',
  'MOON_GRAVITY',
  'BOMB_RAIN',
  'GHOST_PULSE',
  'NONE'
];

export class TournamentManager {
  public state: TournamentMatchState = {
    active: false,
    roundIndex: 0,
    totalRounds: 5,
    gameSequence: [],
    mutators: [],
    currentMutator: 'NONE',
    scores: [0, 0, 0, 0],
    rouletteSpinning: false,
    rouletteDisplayId: 'NONE',
    rouletteTimer: 0,
    isFinished: false,
    champId: null,
    options: defaultTournamentOptions(),
    preparing: false,
    preparationId: 0,
    requiredSlots: [0],
    readySlots: [],
    countdown: 0,
    matchStats: Array.from({ length: 4 }, emptyMatchStats)
  };

  private nextRouletteTick = 0;
  private intermissionTimer = 0;
  private pendingNextRound = false;
  private roundWinners: Array<number | null> = [];
  private roundStartedAtMs = 0;
  private nextPreparationId = 0;

  public startTournament(
    onSwitchGame: (gameId: ActiveGameId) => void,
    options: TournamentOptions = defaultTournamentOptions(),
    replaySame = false
  ): void {
    const previous = this.state;
    if (replaySame && previous.isFinished) options = previous.options;
    if (!validTournamentOptions(options)) return;
    const settings = { ...options, games: [...options.games] };
    const gameSeq: ActiveGameId[] = [];
    const mutatorSeq: ChaosMutatorId[] = [];
    // Exhaust each shuffled bag before repeating, including in seven-round tournaments.
    while (gameSeq.length < settings.totalRounds) {
      const bag = this.shuffle(settings.games);
      if (bag.length > 1 && bag[0] === gameSeq.at(-1)) [bag[0], bag[1]] = [bag[1], bag[0]];
      gameSeq.push(...bag);
    }
    gameSeq.length = settings.totalRounds;
    while (mutatorSeq.length < settings.totalRounds) mutatorSeq.push(...this.shuffle(AVAILABLE_MUTATORS));
    mutatorSeq.length = settings.totalRounds;
    if (!settings.mutatorsEnabled) mutatorSeq.fill('NONE');
    if (replaySame && previous.isFinished) {
      gameSeq.splice(0, gameSeq.length, ...previous.gameSequence);
      mutatorSeq.splice(0, mutatorSeq.length, ...previous.mutators);
    }

    this.state = {
      active: true,
      roundIndex: 0,
      totalRounds: settings.totalRounds,
      gameSequence: gameSeq,
      mutators: mutatorSeq,
      currentMutator: mutatorSeq[0] || 'NONE',
      scores: [0, 0, 0, 0],
      rouletteSpinning: settings.mutatorsEnabled,
      rouletteDisplayId: 'NONE',
      rouletteTimer: 2.2,
      isFinished: false,
      champId: null,
      options: settings,
      preparing: true,
      preparationId: ++this.nextPreparationId,
      requiredSlots: [0],
      readySlots: [],
      countdown: 0,
      matchStats: Array.from({ length: 4 }, emptyMatchStats)
    };

    this.pendingNextRound = false;
    this.roundWinners = [];
    this.intermissionTimer = 0;
    this.nextRouletteTick = 0;
    this.roundStartedAtMs = performance.now();

    sfx.playCartridgeClick();
    onSwitchGame(gameSeq[0]);
  }

  public step(dt: number, onSwitchGame: (gameId: ActiveGameId) => void): void {
    if (!this.state.active) return;
    this.state.elapsedSeconds = (this.state.elapsedSeconds ?? 0) + dt;

    // Handle Intermission between rounds
    if (this.pendingNextRound) {
      this.intermissionTimer -= dt;
      if (this.intermissionTimer <= 0) {
        this.pendingNextRound = false;
        this.advanceToNextRound(onSwitchGame);
      }
      return;
    }

    // Handle Mutator Roulette Slot Animation
    if (this.state.rouletteSpinning) {
      this.state.rouletteTimer -= dt;
      this.nextRouletteTick -= dt;

      if (this.nextRouletteTick <= 0) {
        this.nextRouletteTick = 0.08;
        const randomMutator =
          AVAILABLE_MUTATORS[Math.floor(Math.random() * AVAILABLE_MUTATORS.length)];
        this.state.rouletteDisplayId = randomMutator;
        sfx.playCartridgeClick();
      }

      if (this.state.rouletteTimer <= 0) {
        this.state.rouletteSpinning = false;
        this.state.rouletteDisplayId = this.state.currentMutator;
        sfx.playPinballBumper();
      }
      return;
    }

    if (this.state.preparing && this.state.countdown > 0) {
      this.state.countdown = Math.max(0, this.state.countdown - dt);
      if (this.state.countdown === 0) {
        this.state.preparing = false;
        this.roundStartedAtMs = performance.now();
      }
    }
  }

  /** Host supplies humans only: bots never hold up a round. New arrivals must confirm too. */
  public syncParticipants(slots: number[]): void {
    this.state.requiredSlots = [...new Set(slots)].filter(id => Number.isInteger(id) && id >= 0 && id < 4);
    this.state.readySlots = this.state.readySlots.filter(id => this.state.requiredSlots.includes(id));
    if (!this.state.active || !this.state.preparing) return;
    const allReady = this.state.requiredSlots.length > 0 && this.state.requiredSlots.every(id => this.state.readySlots.includes(id));
    if (!allReady) this.state.countdown = 0;
    else if (this.state.countdown === 0) this.state.countdown = 3;
  }

  public markReady(slot: number, preparationId: number): boolean {
    if (!this.state.active || !this.state.preparing || this.state.rouletteSpinning ||
        preparationId !== this.state.preparationId || !this.state.requiredSlots.includes(slot) || this.state.readySlots.includes(slot)) return false;
    this.state.readySlots.push(slot);
    this.syncParticipants(this.state.requiredSlots);
    return true;
  }

  public clearReady(slot: number): void {
    this.state.readySlots = this.state.readySlots.filter(id => id !== slot);
    this.syncParticipants(this.state.requiredSlots);
  }

  public recordRoundWinner(winnerId: number | null, stats?: readonly MatchStats[]): void {
    if (!this.state.active || this.isPaused) return;
    if (winnerId !== null && (!Number.isInteger(winnerId) || winnerId < 0 || winnerId >= this.state.scores.length)) return;
    this.roundWinners.push(winnerId);
    stats?.forEach((round, slot) => {
      const total = this.state.matchStats[slot];
      if (!total) return;
      for (const key of ['parries', 'perfectParries', 'rescues', 'crownSeconds', 'deliveries'] as const) total[key] += round[key];
      total.bestStreak = Math.max(total.bestStreak, round.bestStreak);
    });

    if (winnerId !== null && typeof this.state.scores[winnerId] === 'number') {
      this.state.scores[winnerId] += 3; // +3 points for 1st place!
    }

    // Complete the configured number of rounds.
    if (this.state.roundIndex + 1 >= this.state.totalRounds) {
      this.state.isFinished = true;
      const highestScore = Math.max(...this.state.scores);
      // Explicit, slot-neutral tiebreak: most recent round win among the tied leaders.
      // A tournament with no awarded points has no champion.
      this.state.champId = highestScore > 0
        ? [...this.roundWinners].reverse().find((id) => id !== null && this.state.scores[id] === highestScore) ?? null
        : null;
      sfx.playCartridgeClick();
      return;
    }

    // Queue next round after brief 3.2s results celebration
    this.pendingNextRound = true;
    this.intermissionTimer = 3.2;
  }

  /** Solo BASH with bots OFF is a 30-second survival challenge inside tournaments. */
  public evaluateSoloBashRound(
    gameId: ActiveGameId,
    botDifficulty: BotDifficulty,
    players: ReadonlyArray<{ id: number; isBot: boolean; alive: boolean; lastKOAt?: number }>,
    roundTimer: number,
    stats?: readonly MatchStats[]
  ): boolean {
    if (!this.state.active || this.isPaused
      || gameId !== 'BASH_BOT' || botDifficulty !== 'OFF') return false;
    const humans = players.filter((player) => !player.isBot);
    if (humans.length !== 1) return false;
    const solo = humans[0];
    // Arena immediately respawns its last player in normal practice. lastKOAt is written
    // by the host collision code and survives that respawn, so the first real KO is observable.
    const knockedOutThisRound = solo.lastKOAt !== undefined && solo.lastKOAt >= this.roundStartedAtMs;
    if (!solo.alive || knockedOutThisRound) {
      this.recordRoundWinner(null, stats);
      return true;
    }
    if (Number.isFinite(roundTimer) && roundTimer >= 30) {
      this.recordRoundWinner(solo.id, stats);
      return true;
    }
    return false;
  }

  private advanceToNextRound(onSwitchGame: (gameId: ActiveGameId) => void): void {
    this.state.roundIndex++;
    this.roundStartedAtMs = performance.now();
    const nextGame = this.state.gameSequence[this.state.roundIndex] || 'BASH_BOT';
    const nextMutator = this.state.mutators[this.state.roundIndex] || 'NONE';

    this.state.currentMutator = nextMutator;
    this.state.rouletteSpinning = this.state.options.mutatorsEnabled;
    this.state.rouletteTimer = 2.2;
    this.state.rouletteDisplayId = 'NONE';
    this.nextRouletteTick = 0;
    this.state.preparing = true;
    this.state.preparationId = ++this.nextPreparationId;
    this.state.readySlots = [];
    this.state.countdown = 0;

    sfx.playCartridgeClick();
    onSwitchGame(nextGame);
  }

  private shuffle<T>(values: readonly T[]): T[] {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  public stopTournament(): void {
    this.state.active = false;
    this.state.isFinished = false;
    this.state.rouletteSpinning = false;
    this.state.preparing = false;
    this.state.readySlots = [];
    this.state.countdown = 0;
    this.pendingNextRound = false;
  }

  public getSnapshot(): TournamentMatchState {
    return {
      ...this.state,
      pendingNextRound: this.pendingNextRound,
      gameSequence: [...this.state.gameSequence],
      mutators: [...this.state.mutators],
      scores: [...this.state.scores],
      options: { ...this.state.options, games: [...this.state.options.games] },
      requiredSlots: [...this.state.requiredSlots],
      readySlots: [...this.state.readySlots],
      matchStats: this.state.matchStats.map(stats => ({ ...stats }))
    };
  }

  public applySnapshot(snap: TournamentMatchState): void {
    this.pendingNextRound = Boolean(snap.pendingNextRound);
    this.state = {
      ...snap,
      gameSequence: [...snap.gameSequence],
      mutators: [...snap.mutators],
      scores: [...snap.scores],
      options: { ...snap.options, games: [...snap.options.games] },
      requiredSlots: [...snap.requiredSlots],
      readySlots: [...snap.readySlots],
      matchStats: snap.matchStats.map(stats => ({ ...stats }))
    };
  }

  public getCurrentMutatorDef() {
    return CHAOS_MUTATORS[this.state.currentMutator] || CHAOS_MUTATORS['NONE'];
  }

  public get isIntermission(): boolean {
    return this.pendingNextRound;
  }

  public get isPaused(): boolean {
    return this.state.active && (this.state.rouletteSpinning || this.state.preparing || this.pendingNextRound || this.state.isFinished);
  }
}
