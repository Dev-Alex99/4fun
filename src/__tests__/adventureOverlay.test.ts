import { afterEach, describe, expect, it, vi } from 'vitest';
import indexHtml from '../../index.html?raw';
import { CargoCrewEngine } from '../game/cargoCrewEngine';
import { ChainPanicEngine } from '../game/chainPanicEngine';
import { VoltCrownEngine } from '../game/voltCrownEngine';
import { MultiplayerRoomManager } from '../net/multiplayerRoom';

vi.mock('peerjs', () => ({ default: class {
  disconnected = false;
  destroyed = false;
  on() { return this; }
  destroy() { this.destroyed = true; }
} }));
afterEach(() => { window.dispatchEvent(new Event('pagehide')); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Adventure results and local rewards in the full app', () => {
  it('seals background results before the HUD runs, preserves them, and exposes earned rewards once', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0)); vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tp04_pilot_name', 'ALEX');
    document.body.innerHTML = indexHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)![1];
    const context = new Proxy({ measureText: () => ({ width: 48 }) }, {
      get(target, key) { return key in target ? target[key as keyof typeof target] : () => {}; }, set() { return true; }
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    let room!: MultiplayerRoomManager, cargo!: CargoCrewEngine, chain!: ChainPanicEngine, volt!: VoltCrownEngine;
    const host = MultiplayerRoomManager.prototype.hostRoom;
    vi.spyOn(MultiplayerRoomManager.prototype, 'hostRoom').mockImplementation(function (this: MultiplayerRoomManager, ...args) { room = this; return host.apply(this, args); });
    const route = CargoCrewEngine.prototype.startRoute;
    vi.spyOn(CargoCrewEngine.prototype, 'startRoute').mockImplementation(function (this: CargoCrewEngine) { cargo = this; return route.call(this); });
    const campaign = ChainPanicEngine.prototype.startCampaign;
    vi.spyOn(ChainPanicEngine.prototype, 'startCampaign').mockImplementation(function (this: ChainPanicEngine, ...args) { chain = this; return campaign.apply(this, args); });
    const resetVolt = VoltCrownEngine.prototype.resetChampionship;
    vi.spyOn(VoltCrownEngine.prototype, 'resetChampionship').mockImplementation(function (this: VoltCrownEngine) { volt = this; return resetVolt.call(this); });
    await import('../main');
    const click = (id: string) => document.getElementById(id)!.click();
    const refresh = () => room.pushToast('Prueba de resultados');
    document.querySelector<HTMLButtonElement>('[data-launch="CARGO_CREW"]')!.click();
    cargo.stageIndex = 2; cargo.stageTimes = [10, 10, 10]; cargo.elapsedSeconds = 30; cargo.status = 'ROUTE_COMPLETE';
    cargo.matchStats.forEach(stats => { stats.deliveries = 3; });
    vi.advanceTimersByTime(40);
    expect(room.sessionResult?.gameId).toBe('CARGO_CREW');
    const sealed = room.sessionResult?.id;
    vi.advanceTimersByTime(5000);
    expect(room.sessionResult?.id).toBe(sealed);
    expect(cargo.status).toBe('ROUTE_COMPLETE');
    refresh();
    expect(document.getElementById('sessionResultOverlay')!.classList.contains('hidden')).toBe(false);
    for (let i = 0; i < 5; i++) refresh();
    expect(JSON.parse(localStorage.getItem('tp04_progress_v1')!).played).toBe(1);
    click('sessionResultExit'); click('startChainCampaignBtn');
    chain.campaign.completed = true; chain.campaign.sectorTimes = [50, 50, 50, 50, 50, 50];
    chain.campaign.elapsedSeconds = 300; chain.campaign.rescues[0] = 3; chain.levelIndex = 5; chain.status = 'CAMPAIGN_COMPLETE';
    vi.advanceTimersByTime(40); refresh();
    expect(document.getElementById('sessionResultBody')!.textContent).toContain('SECTOR 6');
    expect(document.getElementById('sessionResultBody')!.textContent).toContain('3 rescates');
    click('sessionResultExit');
    expect(room.activeGame).toBe('HUB');
    document.querySelector<HTMLButtonElement>('[data-launch="VOLT_CROWN"]')!.click(); click('voltModeBtn');
    expect(room.activeGame).toBe('VOLT_CROWN');
    expect(room.sessionResult).toBeNull();
    expect(document.getElementById('sessionResultOverlay')!.classList.contains('hidden')).toBe(true);
    volt.lastWinnerId = 0; volt.teamScores[0] = 100; volt.players[0].score = volt.players[2].score = 100; volt.status = 'MATCH_OVER'; volt.statusTimer = 4.2;
    vi.advanceTimersByTime(40); refresh();
    expect(room.sessionResult?.gameId).toBe('VOLT_CROWN');
    vi.advanceTimersByTime(5000);
    expect(volt.status).toBe('MATCH_OVER');
    expect(document.getElementById('sessionResultTitle')!.textContent).toContain('EQUIPO A');
    click('sessionResultExit'); click('hubOpenWorkshopBtn');
    const skins = [...document.querySelectorAll<HTMLButtonElement>('#workshopSkinsRow button')];
    expect(skins.find(button => button.textContent?.includes('OPERADOR'))?.disabled).toBe(false);
    expect(skins.find(button => button.textContent?.includes('RESCATISTA'))?.disabled).toBe(false);
    expect(skins.find(button => button.textContent?.includes('CAMPEÓN'))?.disabled).toBe(false);
    expect(skins.find(button => button.textContent?.includes('ACERO PULIDO'))?.disabled).toBe(true);
    expect(JSON.parse(localStorage.getItem('tp04_progress_v1')!).played).toBe(3);
  });
});
