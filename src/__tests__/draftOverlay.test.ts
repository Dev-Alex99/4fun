import { beforeEach, describe, expect, it, vi } from 'vitest';
import indexHtml from '../../index.html?raw';
import { ArenaEngine } from '../game/arenaEngine';

describe('BASH-BOT upgrade draft overlay', () => {
  beforeEach(() => {
    // Parse and mount the exact production index.html body
    const bodyMatch = indexHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    document.body.innerHTML = bodyMatch ? bodyMatch[1] : indexHtml;

    // Mock 2D Canvas Context with all methods used by CourtRenderer & ChainPanicRenderer
    const mockCtx = {
      setTransform: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      arc: vi.fn(),
      arcTo: vi.fn(),
      ellipse: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      clip: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      setLineDash: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      measureText: () => ({ width: 48 })
    };

    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx as unknown as CanvasRenderingContext2D) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  it('keeps the same card elements across HUD refreshes so a normal click installs the mod', async () => {
    // Capture the app's arena engine: main.ts does not export it.
    const engines: ArenaEngine[] = [];
    const spawn = ArenaEngine.prototype.spawnRound;
    vi.spyOn(ArenaEngine.prototype, 'spawnRound').mockImplementation(function (this: ArenaEngine) {
      if (!engines.includes(this)) engines.push(this);
      return spawn.call(this);
    });
    await import('../main');
    document.querySelector<HTMLButtonElement>('[data-launch="BASH_BOT"]')!.click();
    const arena = engines[0];
    expect(arena).toBeDefined();
    const refreshHud = () => (arena as unknown as { onPhaseChange: () => void }).onPhaseChange();

    arena.phase = 'CARD_DRAFT';
    arena.draftOptions = ['heavy_paddle', 'gyro_spin', 'pneumatic_dash'];
    refreshHud();
    const overlay = document.getElementById('draftOverlay')!;
    const cards = () => [...document.querySelectorAll<HTMLButtonElement>('#draftCardsGrid button')];
    expect(overlay.classList.contains('hidden')).toBe(false);
    const first = cards();
    expect(first).toHaveLength(3);

    // The HUD refreshes every 100 ms. Rebuilding the cards in between mousedown and mouseup
    // swallowed the click and restarted hover/press styles (the reported flicker).
    for (let i = 0; i < 5; i++) refreshHud();
    expect(cards()).toEqual(first);
    expect(cards().every((card, index) => card === first[index])).toBe(true);

    const select = vi.spyOn(arena, 'selectDraftMod');
    first[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    refreshHud();
    first[1].dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    first[1].click();
    expect(select).toHaveBeenCalledWith(0, 'gyro_spin');
    expect(arena.phase).toBe('PLAYING');
    expect(overlay.classList.contains('hidden')).toBe(true);
  });
});
