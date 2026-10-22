import { sfx } from '../audio/mechanicalSfx';
import {
  ActiveGameId,
  CHAOS_MUTATORS,
  ChaosMutatorId,
  TournamentMatchState
} from '../types';

const PLAYABLE_GAMES: ActiveGameId[] = [
  'BASH_BOT',
  'HEX_CRUSH',
  'HOT_CORE',
  'VOLT_CROWN',
  'TURBO_PUTT'
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

  public startTournament(onSwitchGame: (gameId: ActiveGameId) => void): void {
    // Shuffle games to generate 5 distinct rounds
    const shuffledGames = [...PLAYABLE_GAMES].sort(() => Math.random() - 0.5);
    // If fewer than 5, repeat some to guarantee 5 rounds
    while (shuffledGames.length < 5) {
      shuffledGames.push(PLAYABLE_GAMES[Math.floor(Math.random() * PLAYABLE_GAMES.length)]);
    }
    const gameSeq = shuffledGames.slice(0, 5);

    // Shuffle mutators
    const shuffledMutators = [...AVAILABLE_MUTATORS].sort(() => Math.random() - 0.5);
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
    this.intermissionTimer = 0;
    this.nextRouletteTick = 0;

    sfx.playCartridgeClick();
    onSwitchGame(gameSeq[0]);
  }

  public step(dt: number, onSwitchGame: (gameId: ActiveGameId) => void): void {
    if (!this.state.active) return;

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

    if (winnerId !== null && typeof this.state.scores[winnerId] === 'number') {
      this.state.scores[winnerId] += 3; // +3 points for 1st place!
    }

    // Check if tournament has completed 5 rounds
    if (this.state.roundIndex + 1 >= this.state.totalRounds) {
      this.state.isFinished = true;
      let highestScore = -1;
      let champ: number | null = null;
      this.state.scores.forEach((sc, idx) => {
        if (sc > highestScore) {
          highestScore = sc;
          champ = idx;
        }
      });
      this.state.champId = champ;
      sfx.playCartridgeClick();
      return;
    }

    // Queue next round after brief 3.2s results celebration
    this.pendingNextRound = true;
    this.intermissionTimer = 3.2;
  }

  private advanceToNextRound(onSwitchGame: (gameId: ActiveGameId) => void): void {
    this.state.roundIndex++;
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

  public stopTournament(): void {
    this.state.active = false;
    this.state.isFinished = false;
    this.state.rouletteSpinning = false;
    this.pendingNextRound = false;
  }

  public getSnapshot(): TournamentMatchState {
    return {
      ...this.state,
      gameSequence: [...this.state.gameSequence],
      mutators: [...this.state.mutators],
      scores: [...this.state.scores]
    };
  }

  public applySnapshot(snap: TournamentMatchState): void {
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
}
