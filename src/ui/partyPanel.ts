import { PARTY_GAMES, type PlayableGame } from '../game/partyVote';
import { GAME_INSTRUCTIONS } from '../game/gameInstructions';
import { challengeFromCode, newChallengeCode, readChallengeRecords, recordChallenge } from '../game/sharedChallenge';
import { CHAOS_MUTATORS } from '../types';
import type { MultiplayerRoomManager } from '../net/multiplayerRoom';
import { SharePanel, shareUrl } from './sharePanel';

export class PartyPanel {
  private code = document.getElementById('challengeCodeInput') as HTMLInputElement;
  private games = document.getElementById('challengeGameSelect') as HTMLSelectElement;
  private lastVote = ''; private lastChallenge = ''; private lastRecord = '';
  constructor(private room: MultiplayerRoomManager, private share: SharePanel) {
    for (const game of PARTY_GAMES) this.games.add(new Option(GAME_INSTRUCTIONS[game].title, game));
    this.code.value = new URLSearchParams(location.search).get('challenge')?.trim().toUpperCase() ?? '';
    document.getElementById('openInviteBtn')!.addEventListener('click', () => this.invite());
    document.getElementById('startGameVoteBtn')!.addEventListener('click', () => room.startGameVote());
    document.getElementById('finishGameVoteBtn')!.addEventListener('click', () => room.finishGameVote());
    document.getElementById('playVoteWinnerBtn')!.addEventListener('click', () => { if (room.gameVote.winner) room.switchGame(room.gameVote.winner); });
    document.getElementById('gameVoteChoices')!.addEventListener('click', e => {
      const game = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-vote-game]')?.dataset.voteGame as PlayableGame;
      if (PARTY_GAMES.includes(game)) room.submitGameVote(game);
    });
    document.getElementById('generateChallengeBtn')!.addEventListener('click', () => {
      this.code.value = newChallengeCode(this.games.value as PlayableGame); this.preview();
    });
    this.code.addEventListener('input', () => { this.code.value = this.code.value.toUpperCase(); this.preview(); });
    document.getElementById('startChallengeBtn')!.addEventListener('click', () => room.sendOrApplyRoomAction({ kind: 'START_CHALLENGE', challengeCode: this.code.value.trim() }));
    document.getElementById('shareChallengeBtn')!.addEventListener('click', () => {
      const challenge = challengeFromCode(this.code.value.trim()); if (!challenge) return;
      const records = readChallengeRecords().filter(r => r.code === challenge.code && r.won).sort((a, b) => a.seconds - b.seconds);
      const best = records[0];
      this.share.open(shareUrl(location.href, { challenge: challenge.code }), `RETO ${challenge.code}`,
        `${GAME_INSTRUCTIONS[challenge.game].title}. Mismo escenario y reglas.${best ? ` Mi equipo de ${best.humans}: ${best.seconds.toFixed(1)} s.` : 'Intenta superar el reto con tu grupo.'}`);
    });
    if (this.code.value) { (document.getElementById('partyPanel') as HTMLDetailsElement).open = true; (document.getElementById('playExtras') as HTMLDetailsElement).open = true; }
    this.preview();
  }
  public invite(): void {
    this.share.open(shareUrl(location.href, { room: this.room.roomCode }), `SALA #${this.room.roomCode}`,
      'Escanea el QR o abre el enlace para unirte. El anfitrión debe mantener su dispositivo activo.');
  }
  private preview(): void {
    const challenge = challengeFromCode(this.code.value.trim());
    const input = this.code.value.trim();
    document.getElementById('challengePreview')!.textContent = challenge ? `${GAME_INSTRUCTIONS[challenge.game].title} · escenario/ruta ${challenge.stage + 1} · ${CHAOS_MUTATORS[challenge.mutator].name} · bots normales` :
      input ? 'Código inválido. Usa un código de reto completo, por ejemplo 1A-ABCD1234.' : 'Crea un código o pega el que te hayan compartido.';
    (document.getElementById('startChallengeBtn') as HTMLButtonElement).disabled = !challenge || !this.room.isHost || this.room.tournamentManager?.state.active === true;
    (document.getElementById('shareChallengeBtn') as HTMLButtonElement).disabled = !challenge;
    this.showRecords();
  }
  private showRecords(): void {
    const records = readChallengeRecords().filter(r => r.code === this.code.value.trim());
    const sizes = [...new Set(records.map(r => r.humans))];
    document.getElementById('challengeRecords')!.textContent = sizes.map(size => {
      const matching = records.filter(r => r.humans === size), wins = matching.filter(r => r.won);
      const c = challengeFromCode(this.code.value.trim());
      const best = wins.sort((a, b) => c?.game === 'TURBO_PUTT' ? a.score - b.score || a.seconds - b.seconds : a.seconds - b.seconds)[0];
      return `${size} humano(s): ${matching.length} intentos${best ? ` · mejor victoria ${best.seconds.toFixed(1)} s${c?.game === 'TURBO_PUTT' ? ` / ${best.score} golpes` : ''}` : ' · sin victoria aún'}`;
    }).join(' · ');
  }
  public sync(): void {
    const room = this.room, vote = room.gameVote, humans = room.humanPlayers;
    const status = document.getElementById('gameVoteStatus')!;
    status.textContent = vote.open ? `${humans.filter(p => vote.ballots[p.id]).length}/${humans.length} votos. Puedes cambiar el tuyo hasta cerrar; al votar todos se elige el juego. Los empates rotan entre juegos.` :
      vote.winner ? `Elegido: ${GAME_INSTRUCTIONS[vote.winner].title}. El anfitrión inicia la partida.` : 'Voten desde el Hub para elegir el siguiente juego sin cambiar de sala.';
    (document.getElementById('startGameVoteBtn') as HTMLButtonElement).disabled = !room.isHost || room.activeGame !== 'HUB' || vote.open || room.tournamentManager?.state.active === true;
    document.getElementById('finishGameVoteBtn')!.classList.toggle('hidden', !room.isHost || !vote.open);
    document.getElementById('playVoteWinnerBtn')!.classList.toggle('hidden', !room.isHost || !vote.winner || vote.open || room.activeGame !== 'HUB');
    const key = JSON.stringify([vote, room.localSlotId, room.isSynchronized, humans.map(p => p.id)]);
    if (key !== this.lastVote) {
      this.lastVote = key;
      document.getElementById('gameVoteChoices')!.innerHTML = vote.open ? PARTY_GAMES.map(game => `<button class="keycap-btn" data-vote-game="${game}" aria-pressed="${vote.ballots[room.localSlotId] === game}" ${room.isSynchronized ? '' : 'disabled'}>${GAME_INSTRUCTIONS[game].title} · ${humans.filter(p => vote.ballots[p.id] === game).length}</button>`).join('') : '';
    }
    if (room.challenge?.code && this.lastChallenge !== room.challenge.code) {
      this.lastChallenge = room.challenge.code; this.code.value = room.challenge.code; this.preview();
    }
    const result = room.sessionResult;
    if (result && room.challenge && this.lastRecord !== result.id) {
      this.lastRecord = result.id;
      const player = result.players.find(p => p.slot === room.localSlotId);
      if (player && room.challenge.eligible !== false) recordChallenge({ id: result.id, code: room.challenge.code,
        humans: result.players.filter(p => !p.isBot).length, won: result.winnerSlots.includes(player.slot), seconds: result.durationSeconds, score: player.score });
      this.showRecords();
    }
    (document.getElementById('startChallengeBtn') as HTMLButtonElement).disabled = !challengeFromCode(this.code.value.trim()) || !room.isHost || room.tournamentManager?.state.active === true;
  }
}
