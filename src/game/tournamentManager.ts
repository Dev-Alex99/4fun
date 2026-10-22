import { sfx } from '../audio/mechanicalSfx';
import {
  ActiveGameId,
  BotDifficulty,
  CHAOS_MUTATORS,
  ChaosMutatorId,
  TournamentMatchState
} from '../types';

const PLAYABLE_GAMES: ActiveGameId[] = [
  'BASH_BOT',
  'HEX_CRUSH',
  'HOT_CORE',
  'VOLT_CROWN',
  'TURBO_PUTT',
  'RICOCHET_1'
];

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
    champId: null
  };

  private nextRouletteTick = 0;
  private intermissionTimer = 0;
  private pendingNextRound = false;
  private roundWinners: Array<number | null> = [];
  private roundStartedAtMs = 0;

  public startTournament(onSwitchGame: (gameId: ActiveGameId) => void): void {
    // Shuffle games to generate 5 distinct rounds
    const shuffledGames = this.shuffle(PLAYABLE_GAMES);
    // If fewer than 5, repeat some to guarantee 5 rounds
    while (shuffledGames.length < 5) {
      shuffledGames.push(PLAYABLE_GAMES[Math.floor(Math.random() * PLAYABLE_GAMES.length)]);
    }
    const gameSeq = shuffledGames.slice(0, 5);

    // Shuffle mutators
    const shuffledMutators = this.shuffle(AVAILABLE_MUTATORS);
    const mutatorSeq = shuffledMutators.slice(0, 5);

    this.state = {
      active: true,
      roundIndex: 0,
      totalRounds: 5,
      gameSequence: gameSeq,
      mutators: mutatorSeq,
      currentMutator: mutatorSeq[0] || 'NONE',
      scores: [0, 0, 0, 0],
      rouletteSpinning: true,
      rouletteDisplayId: 'NONE',
      rouletteTimer: 2.2,
      isFinished: false,
      champId: null
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
    }
  }

  public recordRoundWinner(winnerId: number | null): void {
    if (!this.state.active || this.pendingNextRound || this.state.isFinished) return;
    if (winnerId !== null && (!Number.isInteger(winnerId) || winnerId < 0 || winnerId >= this.state.scores.length)) return;
    this.roundWinners.push(winnerId);

    if (winnerId !== null && typeof this.state.scores[winnerId] === 'number') {
      this.state.scores[winnerId] += 3; // +3 points for 1st place!
    }

    // Check if tournament has completed 5 rounds
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
    roundTimer: number
  ): boolean {
    if (!this.state.active || this.state.rouletteSpinning || this.pendingNextRound || this.state.isFinished
      || gameId !== 'BASH_BOT' || botDifficulty !== 'OFF') return false;
    const humans = players.filter((player) => !player.isBot);
    if (humans.length !== 1) return false;
    const solo = humans[0];
    // Arena immediately respawns its last player in normal practice. lastKOAt is written
    // by the host collision code and survives that respawn, so the first real KO is observable.
    const knockedOutThisRound = solo.lastKOAt !== undefined && solo.lastKOAt >= this.roundStartedAtMs;
    if (!solo.alive || knockedOutThisRound) {
      this.recordRoundWinner(null);
      return true;
    }
    if (Number.isFinite(roundTimer) && roundTimer >= 30) {
      this.recordRoundWinner(solo.id);
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
    this.state.rouletteSpinning = true;
    this.state.rouletteTimer = 2.2;
    this.state.rouletteDisplayId = 'NONE';
    this.nextRouletteTick = 0;

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
    this.pendingNextRound = false;
  }

  public getSnapshot(): TournamentMatchState {
    return {
      ...this.state,
      pendingNextRound: this.pendingNextRound,
      gameSequence: [...this.state.gameSequence],
      mutators: [...this.state.mutators],
      scores: [...this.state.scores]
    };
  }

  public applySnapshot(snap: TournamentMatchState): void {
    this.pendingNextRound = Boolean(snap.pendingNextRound);
    this.state = {
      ...snap,
      gameSequence: [...snap.gameSequence],
      mutators: [...snap.mutators],
      scores: [...snap.scores]
    };
  }

  public getCurrentMutatorDef() {
    return CHAOS_MUTATORS[this.state.currentMutator] || CHAOS_MUTATORS['NONE'];
  }

  public get isIntermission(): boolean {
    return this.pendingNextRound;
  }
}
