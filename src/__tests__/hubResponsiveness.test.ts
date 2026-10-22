import { describe, it, expect, beforeEach, vi } from 'vitest';
import indexHtml from '../../index.html?raw';

describe('Hub Usability and Responsiveness Test Suite', () => {
  beforeEach(() => {
    const bodyMatch = indexHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    document.body.innerHTML = bodyMatch ? bodyMatch[1] : indexHtml;
  });

  it('verifies hub overlay exists, has tabindex for keyboard scrolling, and contains grid', () => {
    const hubOverlay = document.getElementById('hubOverlay');
    expect(hubOverlay).not.toBeNull();
    expect(hubOverlay?.getAttribute('tabindex')).toBe('-1');

    const hubContainer = document.querySelector('.hub-container');
    expect(hubContainer).not.toBeNull();

    const hubGrid = document.getElementById('hubGameGrid');
    expect(hubGrid).not.toBeNull();
  });

  it('verifies all 7 cartridges exist with correct categories and launch targets', () => {
    const cartridges = document.querySelectorAll<HTMLElement>('.game-cartridge');
    expect(cartridges.length).toBe(7);

    const expectedGames = [
      'BASH_BOT',
      'CHAIN_PANIC',
      'TURBO_PUTT',
      'HOT_CORE',
      'VOLT_CROWN',
      'HEX_CRUSH',
      'RICOCHET_1'
    ];

    expectedGames.forEach((gameId) => {
      const btn = document.querySelector<HTMLButtonElement>(`button[data-launch="${gameId}"]`);
      expect(btn).not.toBeNull();
    });

    // Check categories exist
    cartridges.forEach((card) => {
      expect(card.dataset.category).toBeDefined();
      expect(card.dataset.gameTitle).toBeDefined();
    });
  });

  it('verifies filter bar, search input, clear search, and random buttons exist', () => {
    const filterBar = document.querySelector('.hub-filter-bar');
    expect(filterBar).not.toBeNull();

    const searchInput = document.getElementById('hubSearchInput') as HTMLInputElement;
    expect(searchInput).not.toBeNull();

    const clearBtn = document.getElementById('hubClearSearchBtn') as HTMLButtonElement;
    expect(clearBtn).not.toBeNull();

    const randomBtn = document.getElementById('hubRandomGameBtn') as HTMLButtonElement;
    expect(randomBtn).not.toBeNull();

    const noResultsMsg = document.getElementById('hubNoResultsMsg');
    expect(noResultsMsg).not.toBeNull();
  });

  it('filters cartridges dynamically by category and search keyword', () => {
    const cartridges = document.querySelectorAll<HTMLElement>('.game-cartridge');

    // Simulate search for 'spleef'
    const q = 'spleef';
    const matches: HTMLElement[] = [];
    cartridges.forEach((card) => {
      const title = (card.dataset.gameTitle || '').toLowerCase();
      if (title.includes(q)) {
        matches.push(card);
      }
    });

    expect(matches.length).toBe(1);
    expect(matches[0].querySelector('button')?.dataset.launch).toBe('HEX_CRUSH');

    // Simulate filter for COOP
    const coopMatches = Array.from(cartridges).filter((c) =>
      (c.dataset.category || '').split(' ').includes('COOP')
    );
    expect(coopMatches.length).toBe(1);
    expect(coopMatches[0].querySelector('button')?.dataset.launch).toBe('CHAIN_PANIC');

    // Simulate filter for PVP
    const pvpMatches = Array.from(cartridges).filter((c) =>
      (c.dataset.category || '').split(' ').includes('PVP')
    );
    expect(pvpMatches.length).toBe(6);
  });
});
