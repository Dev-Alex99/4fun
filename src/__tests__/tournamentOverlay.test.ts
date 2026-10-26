import { afterEach, describe, expect, it, vi } from 'vitest';
import indexHtml from '../../index.html?raw';
import { TournamentManager } from '../game/tournamentManager';
import { MultiplayerRoomManager } from '../net/multiplayerRoom';
import { touchGamepad } from '../input/touchGamepad';

vi.mock('peerjs', () => ({ default: class {
  disconnected = false;
  destroyed = false;
  on() { return this; }
  destroy() { this.destroyed = true; }
} }));

afterEach(() => { window.dispatchEvent(new Event('pagehide')); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Tournament UI journey', () => {
  it('configures, explains, readies and completes a cup, then replays or cancels without leaving the room', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('tp04_pilot_name', 'ALEX');
    const body = indexHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)!;
    document.body.innerHTML = body[1];
    const context = new Proxy({ measureText: () => ({ width: 48 }) }, {
      get(target, key) { return key in target ? target[key as keyof typeof target] : () => {}; },
      set() { return true; }
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    let tournament!: TournamentManager, room!: MultiplayerRoomManager;
    const start = TournamentManager.prototype.startTournament;
    vi.spyOn(TournamentManager.prototype, 'startTournament').mockImplementation(function (this: TournamentManager, ...args) {
      tournament = this;
      return start.apply(this, args);
    });
    const action = MultiplayerRoomManager.prototype.sendOrApplyRoomAction;
    vi.spyOn(MultiplayerRoomManager.prototype, 'sendOrApplyRoomAction').mockImplementation(function (this: MultiplayerRoomManager, ...args) {
      room = this;
      return action.apply(this, args);
    });
    await import('../main');
    const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
    const refresh = () => room.pushToast('Actualizando prueba');
    const visible = (id: string) => !element(id).classList.contains('hidden');

    element<HTMLSelectElement>('tourneyRoundsSelect').value = '3';
    element<HTMLInputElement>('tourneyMutatorsInput').checked = false;
    const choices = [...document.querySelectorAll<HTMLInputElement>('[data-tournament-game]')];
    choices.forEach(input => { input.checked = false; });
    element('tourneySettings').dispatchEvent(new Event('change', { bubbles: true }));
    expect(element<HTMLButtonElement>('hubStartTournamentBtn').disabled).toBe(true);
    choices.find(input => input.dataset.tournamentGame === 'HEX_CRUSH')!.checked = true;
    element('tourneySettings').dispatchEvent(new Event('change', { bubbles: true }));
    element('hubStartTournamentBtn').click();
    const roomCode = room.roomCode;
    expect(tournament.state.totalRounds).toBe(3);
    expect(tournament.state.gameSequence).toEqual(['HEX_CRUSH', 'HEX_CRUSH', 'HEX_CRUSH']);
    expect(visible('tourneyPreparationView')).toBe(true);
    expect(visible('tourneyRouletteView')).toBe(false);
    expect(element('tourneyObjective').textContent).toContain('último en pie');
    expect(element('tourneyReadyRoster').children).toHaveLength(1); // bots are automatic
    const readyButton = element<HTMLButtonElement>('tourneyReadyBtn');
    expect(document.activeElement).toBe(readyButton);
    touchGamepad.enabled = false; refresh();
    expect(element('tourneyControls').textContent).toContain('WASD');
    touchGamepad.enabled = true; refresh();
    expect(element('tourneyControls').textContent).toContain('JOYSTICK');
    expect(visible('virtualGamepad')).toBe(false);
    const controls = [...element('tourneyControls').children];
    refresh();
    expect([...element('tourneyControls').children]).toEqual(controls); // HUD refresh preserves content
    readyButton.click();
    expect(readyButton.disabled).toBe(true);
    expect(element('tourneyReadyStatus').textContent).toContain('Empezamos en 3');

    for (let round = 0; round < 3; round++) {
      if (round > 0) readyButton.click();
      tournament.step(3.01, game => room.switchGame(game, true)); refresh();
      expect(visible('tournamentOverlay')).toBe(false);
      expect(visible('virtualGamepad')).toBe(true);
      tournament.recordRoundWinner(round === 1 ? 1 : 0); refresh();
      if (round < 2) {
        expect(visible('tourneyStandingsView')).toBe(true);
        tournament.step(3.3, game => room.switchGame(game, true)); refresh();
        expect(visible('tourneyPreparationView')).toBe(true);
        expect(readyButton.disabled).toBe(false);
      }
    }
    expect(visible('tourneyPodiumView')).toBe(true);
    expect(element('tourneyModalEyebrow').textContent).toContain('3 RONDAS');
    expect(element('tourneyFinalLeaderboard').children).toHaveLength(4);
    expect(element('tourneyChampName').textContent).toContain('ALEX');
    const playlist = [...tournament.state.gameSequence];
    element('tourneyRestartBtn').click();
    expect(tournament.state.gameSequence).toEqual(playlist);
    expect(tournament.state.scores).toEqual([0, 0, 0, 0]);
    expect(visible('tourneyPreparationView')).toBe(true);
    element('tourneyCancelBtn').click();
    expect(room.activeGame).toBe('HUB');
    expect(room.roomCode).toBe(roomCode);
    expect(visible('tournamentOverlay')).toBe(false);
    expect(visible('hubOverlay')).toBe(true);
    expect(visible('virtualGamepad')).toBe(false);
    expect(touchGamepad.enabled).toBe(true);
  });
});
