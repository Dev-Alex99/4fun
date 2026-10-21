import { beforeEach, describe, expect, it, vi } from 'vitest';
import indexHtml from '../../index.html?raw';

describe('Full DOM + main.ts Bootstrap Smoke Test (Prevents TDZ / ReferenceError & Freezes)', () => {
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

  it('boots main.ts without ReferenceError, switches games, and toggles SIN BOTS cleanly', async () => {
    // Importing main.ts executes top-level initialization (caught the TDZ ReferenceError!)
    await expect(import('../main')).resolves.toBeDefined();

    const hubOverlay = document.getElementById('hubOverlay') as HTMLDivElement;
    const topBotsBtn = document.getElementById('topBotsToggleBtn') as HTMLButtonElement;
    const playerSlotsBar = document.getElementById('playerSlotsBar') as HTMLDivElement;

    expect(hubOverlay.classList.contains('hidden')).toBe(false);
    expect(topBotsBtn.textContent).toContain('BOTS: NORMAL');
    expect(playerSlotsBar.children.length).toBe(4);

    // Click topBotsBtn twice: NORMAL -> CHILL -> OFF (SIN BOTS)
    topBotsBtn.click();
    expect(topBotsBtn.textContent).toContain('BOTS: FÁCIL');

    topBotsBtn.click();
    expect(topBotsBtn.textContent).toContain('SIN BOTS');
    // When SIN BOTS is active, only the 1 human player slot remains in the scoreboard!
    expect(playerSlotsBar.children.length).toBe(1);

    // Click "JUGAR BASH-BOT (01)" card button -> Hub overlay must hide immediately
    const bashLaunchBtn = document.querySelector<HTMLButtonElement>('[data-launch="BASH_BOT"]');
    expect(bashLaunchBtn).not.toBeNull();
    bashLaunchBtn!.click();
    expect(hubOverlay.classList.contains('hidden')).toBe(true);

    // Switch to "02 // CHAIN-PANIC" via top tab -> Sector controls must appear
    const chainTabBtn = document.querySelector<HTMLButtonElement>('[data-game="CHAIN_PANIC"]');
    expect(chainTabBtn).not.toBeNull();
    chainTabBtn!.click();

    const nextSectorBtn = document.getElementById('nextSectorBtn') as HTMLButtonElement;
    expect(nextSectorBtn.classList.contains('hidden')).toBe(false);
    nextSectorBtn.click();
  });
});
