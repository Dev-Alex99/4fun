import './style.css';
import { ArenaEngine } from './game/arenaEngine';
import { CHAIN_LEVELS, ChainPanicEngine } from './game/chainPanicEngine';
import { HOT_CORE_ARENAS, HotCoreEngine } from './game/hotCoreEngine';
import { VOLT_CROWN_ARENAS, VoltCrownEngine } from './game/voltCrownEngine';
import { HEX_CRUSH_ARENAS, HexCrushEngine } from './game/hexCrushEngine';
import { PUTT_HOLES, PuttWarEngine } from './game/puttWarEngine';
import { HARDWARE_MODS } from './game/hardwareMods';
import { CourtRenderer } from './render/courtRenderer';
import { ChainPanicRenderer } from './render/chainPanicRenderer';
import { HotCoreRenderer } from './render/hotCoreRenderer';
import { VoltCrownRenderer } from './render/voltCrownRenderer';
import { HexCrushRenderer } from './render/hexCrushRenderer';
import { PuttWarRenderer } from './render/puttWarRenderer';
import { generateRoomCode, MultiplayerRoomManager } from './net/multiplayerRoom';
import { sfx } from './audio/mechanicalSfx';
import { ActiveGameId, BotDifficulty, ClientInputPacket } from './types';

// 1. Constants & Lookup Tables (Must be at top before any function calls!)
const DIFFICULTY_CYCLE: BotDifficulty[] = ['NORMAL', 'CHILL', 'OFF', 'PRO'];
const DIFFICULTY_LABELS: Record<BotDifficulty, string> = {
  NORMAL: '🤖 BOTS: NORMAL',
  CHILL: '🤖 BOTS: FÁCIL',
  OFF: '🚫 SIN BOTS (OFF)',
  PRO: '🤖 BOTS: PRO'
};

// 2. DOM Elements
const canvas = document.getElementById('courtCanvas') as HTMLCanvasElement;
const playerSlotsBar = document.getElementById('playerSlotsBar') as HTMLDivElement;
const rpmBadge = document.getElementById('rpmBadge') as HTMLDivElement;
const netLed = document.getElementById('netLed') as HTMLDivElement;
const netRoleLabel = document.getElementById('netRoleLabel') as HTMLDivElement;
const roomCodeInput = document.getElementById('roomCodeInput') as HTMLInputElement;
const joinRoomBtn = document.getElementById('joinRoomBtn') as HTMLButtonElement;
const createNewRoomBtn = document.getElementById('createNewRoomBtn') as HTMLButtonElement;
const copyInviteBtn = document.getElementById('copyInviteBtn') as HTMLButtonElement;
const topBotsToggleBtn = document.getElementById('topBotsToggleBtn') as HTMLButtonElement;
const soundToggleBtn = document.getElementById('soundToggleBtn') as HTMLButtonElement;
const resetMatchBtn = document.getElementById('resetMatchBtn') as HTMLButtonElement;
const playerNameInput = document.getElementById('playerNameInput') as HTMLInputElement;
const toggleBotsBtn = document.getElementById('toggleBotsBtn') as HTMLButtonElement;
const prevSectorBtn = document.getElementById('prevSectorBtn') as HTMLButtonElement;
const nextSectorBtn = document.getElementById('nextSectorBtn') as HTMLButtonElement;
const chainModeBtn = document.getElementById('chainModeBtn') as HTMLButtonElement;
const controlsLegendStrip = document.getElementById('controlsLegendStrip') as HTMLDivElement;
const installedModsStrip = document.getElementById('installedModsStrip') as HTMLDivElement;
const roomToastContainer = document.getElementById('roomToastContainer') as HTMLDivElement;

const hubOverlay = document.getElementById('hubOverlay') as HTMLDivElement;
const hubConnectionBadge = document.getElementById('hubConnectionBadge') as HTMLDivElement;
const hubRoomCodeText = document.getElementById('hubRoomCodeText') as HTMLSpanElement;
const hubBotsToggleBtn = document.getElementById('hubBotsToggleBtn') as HTMLButtonElement;
const hubCopyInviteBtn = document.getElementById('hubCopyInviteBtn') as HTMLButtonElement;
const hubNewRoomBtn = document.getElementById('hubNewRoomBtn') as HTMLButtonElement;
const hubLeaveRoomBtn = document.getElementById('hubLeaveRoomBtn') as HTMLButtonElement;
const hubPilotNameInput = document.getElementById('hubPilotNameInput') as HTMLInputElement;
const hubJoinCodeInput = document.getElementById('hubJoinCodeInput') as HTMLInputElement;
const hubJoinRoomBtn = document.getElementById('hubJoinRoomBtn') as HTMLButtonElement;
const hubRosterList = document.getElementById('hubRosterList') as HTMLDivElement;
const unbanAllBtn = document.getElementById('unbanAllBtn') as HTMLButtonElement;
const kickNoticeBanner = document.getElementById('kickNoticeBanner') as HTMLDivElement;

const pilotOnboardingModal = document.getElementById('pilotOnboardingModal') as HTMLDivElement;
const onboardingNameInput = document.getElementById('onboardingNameInput') as HTMLInputElement;
const confirmOnboardingBtn = document.getElementById('confirmOnboardingBtn') as HTMLButtonElement;

const tabButtons = document.querySelectorAll<HTMLButtonElement>('#cartridgeTabs .tab-btn');
const launchGameButtons = document.querySelectorAll<HTMLButtonElement>('.launch-game-btn');

const draftOverlay = document.getElementById('draftOverlay') as HTMLDivElement;
const draftWinnerText = document.getElementById('draftWinnerText') as HTMLDivElement;
const draftCardsGrid = document.getElementById('draftCardsGrid') as HTMLDivElement;

const championOverlay = document.getElementById('championOverlay') as HTMLDivElement;
const championNameTitle = document.getElementById('championNameTitle') as HTMLHeadingElement;
const newChampionshipBtn = document.getElementById('newChampionshipBtn') as HTMLButtonElement;

// 3. Input & Session State (All declared before engines/network start)
const keys: Record<string, boolean> = {};
let mouseCourtPos = { x: 500, y: 258 };
let pendingParry = false;
let chargingParry = false;
let pendingDash = false;
let pendingYank = false;
let anchorHeld = false;
let pendingEmote = 0;

const urlParams = new URLSearchParams(window.location.search);
const urlJoinParam = urlParams.get('join');
const urlRoom =
  urlJoinParam && urlJoinParam !== '1' ? urlJoinParam : urlParams.get('room');
const sessionRoom =
  typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('tp04_my_room') : null;
const hostedRoomInTab =
  typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('tp04_hosted_room') : null;
const initialRoom = (urlRoom || sessionRoom || generateRoomCode()).toUpperCase().slice(0, 8);

// Explicit Host vs Client determination:
// If URL has ?join=1 or ?room=XXXX that wasn't created as Host in this tab, join strictly as CLIENT!
const startAsClient =
  urlJoinParam !== null || Boolean(urlRoom && hostedRoomInTab !== initialRoom);

try {
  sessionStorage.setItem('tp04_my_room', initialRoom);
  if (!startAsClient) {
    sessionStorage.setItem('tp04_hosted_room', initialRoom);
  }
  if (!urlRoom) {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('room', initialRoom);
    window.history.replaceState({}, '', nextUrl.toString());
  }
} catch {
  // Ignore URL/storage errors in restricted environments
}
roomCodeInput.value = initialRoom;
hubRoomCodeText.textContent = initialRoom;

const storedPilotName = localStorage.getItem('tp04_pilot_name');
const savedName = storedPilotName || 'ALEX';
playerNameInput.value = savedName;
if (hubPilotNameInput) hubPilotNameInput.value = savedName;
if (onboardingNameInput) onboardingNameInput.value = '';

// Show first-time pilot onboarding modal if user hasn't registered a name yet
if (!storedPilotName && pilotOnboardingModal) {
  pilotOnboardingModal.classList.remove('hidden');
  setTimeout(() => onboardingNameInput?.focus(), 60);
}

// 4. Engines & Renderers
const arenaEngine = new ArenaEngine(syncOverlaysAndHUD);
const chainEngine = new ChainPanicEngine();
const puttEngine = new PuttWarEngine();
const hotCoreEngine = new HotCoreEngine();
const voltCrownEngine = new VoltCrownEngine();
const hexCrushEngine = new HexCrushEngine();
const courtRenderer = new CourtRenderer(canvas);
const chainRenderer = new ChainPanicRenderer(canvas);
const puttRenderer = new PuttWarRenderer(canvas);
const hotCoreRenderer = new HotCoreRenderer(canvas);
const voltCrownRenderer = new VoltCrownRenderer(canvas);
const hexCrushRenderer = new HexCrushRenderer(canvas);
const net = new MultiplayerRoomManager(
  arenaEngine,
  chainEngine,
  syncOverlaysAndHUD,
  puttEngine,
  hotCoreEngine,
  voltCrownEngine,
  hexCrushEngine
);

// 5. UI & HUD Synchronization Function
function syncOverlaysAndHUD(): void {
  const humanCount = arenaEngine.players.filter((p) => !p.isBot).length;
  netLed.className =
    net.connectionState === 'CONNECTED_CLIENT' || humanCount > 1
      ? 'status-led online'
      : 'status-led';

  const pingSuffix = !net.isHost && net.pingMs > 0 ? ` • ${net.pingMs}ms` : '';
  if (net.connectionState === 'CONNECTING') {
    netRoleLabel.textContent = `🟡 CLIENTE -> UNIENDOSE A SALA #${net.roomCode}...`;
    if (hubConnectionBadge) {
      hubConnectionBadge.textContent = `🟡 MODO CLIENTE // CONECTANDO CON EL HOST DE SALA #${net.roomCode}...`;
    }
  } else if (net.connectionState === 'RECONNECTING') {
    netRoleLabel.textContent = `🔄 CLIENTE -> RECONECTANDO A #${net.roomCode}...`;
    if (hubConnectionBadge) {
      hubConnectionBadge.textContent = `🔄 MODO CLIENTE // RECONECTANDO CON LA SALA #${net.roomCode}...`;
    }
  } else if (net.isHost) {
    netRoleLabel.textContent = `👑 HOST DE SALA #${net.roomCode} (${humanCount}/4 EN LÍNEA)`;
    if (hubConnectionBadge) {
      hubConnectionBadge.textContent = `👑 ERES EL ANFITRIÓN (HOST) DE SALA #${net.roomCode} (${humanCount}/4 HUMANOS EN LÍNEA)`;
    }
  } else {
    netRoleLabel.textContent = `🎮 CLIENTE EN #${net.roomCode} (HOST: ${net.hostName}) • SLOT ${net.localSlotId + 1}${pingSuffix}`;
    if (hubConnectionBadge) {
      hubConnectionBadge.textContent = `🎮 ERES CLIENTE EN SALA #${net.roomCode} (ANFITRIÓN: ${net.hostName}) • SLOT ${net.localSlotId + 1}${pingSuffix}`;
    }
  }

  if (hubLeaveRoomBtn) {
    if (net.isHost) {
      hubLeaveRoomBtn.classList.add('hidden');
    } else {
      hubLeaveRoomBtn.classList.remove('hidden');
    }
  }

  if (hubRoomCodeText) hubRoomCodeText.textContent = net.roomCode;
  if (roomCodeInput && document.activeElement !== roomCodeInput) {
    roomCodeInput.value = net.roomCode;
  }

  // Render Live Join / Leave Toasts
  if (roomToastContainer) {
    roomToastContainer.innerHTML = net.toasts
      .map(
        (t) => `<div class="room-toast tone-${t.tone}">${t.text}</div>`
      )
      .join('');
  }

  // Kick Notice Banner
  if (kickNoticeBanner) {
    if (net.kickedNotice) {
      kickNoticeBanner.textContent = `⚠️ ${net.kickedNotice}`;
      kickNoticeBanner.classList.remove('hidden');
    } else {
      kickNoticeBanner.classList.add('hidden');
    }
  }

  // Unban Button visibility for Host
  if (unbanAllBtn) {
    if (net.isHost && net.bannedPeerIds.size > 0) {
      unbanAllBtn.textContent = `DESBLOQUEAR VETADOS (${net.bannedPeerIds.size})`;
      unbanAllBtn.classList.remove('hidden');
    } else {
      unbanAllBtn.classList.add('hidden');
    }
  }

  const botLabel = DIFFICULTY_LABELS[arenaEngine.botDifficulty] || '🤖 BOTS: NORMAL';
  if (toggleBotsBtn) toggleBotsBtn.textContent = botLabel;
  if (topBotsToggleBtn) topBotsToggleBtn.textContent = botLabel;
  if (hubBotsToggleBtn) hubBotsToggleBtn.textContent = botLabel;

  tabButtons.forEach((btn) => {
    if (btn.dataset.game === net.activeGame) {
      btn.classList.add('active-tab');
    } else {
      btn.classList.remove('active-tab');
    }
  });

  if (net.activeGame === 'HUB') {
    hubOverlay.classList.remove('hidden');
  } else {
    hubOverlay.classList.add('hidden');
  }

  if (net.activeGame === 'CHAIN_PANIC') {
    prevSectorBtn.classList.remove('hidden');
    nextSectorBtn.classList.remove('hidden');
    prevSectorBtn.textContent = '◀ SECTOR';
    nextSectorBtn.textContent = 'SECTOR ▶';
    chainModeBtn.classList.remove('hidden');
    chainModeBtn.textContent =
      chainEngine.mode === 'SABOTAGE' ? 'MODO: TRAIDOR (3v1)' : 'MODO: CO-OP';

    controlsLegendStrip.innerHTML = `
      <span><strong>[WASD]</strong> CAMINAR</span>
      <span class="sep">•</span>
      <span><strong>[ESPACIO / CLIC IZQ]</strong> SALTAR LÁSER</span>
      <span class="sep">•</span>
      <span><strong>[E]</strong> TIRÓN DE CABLE</span>
      <span class="sep">•</span>
      <span><strong>[SHIFT / CLIC DER]</strong> ANCLA PESADA</span>
      <span class="sep">•</span>
      <span><strong>[1-4]</strong> GRITAR</span>
    `;
    installedModsStrip.textContent = `SECTOR ${chainEngine.levelIndex + 1}/${
      CHAIN_LEVELS.length
    } • SUPERADOS: ${chainEngine.completions} • CAÍDAS: ${chainEngine.wipes}`;
  } else if (net.activeGame === 'TURBO_PUTT') {
    prevSectorBtn.classList.remove('hidden');
    nextSectorBtn.classList.remove('hidden');
    prevSectorBtn.textContent = '◀ HOYO';
    nextSectorBtn.textContent = 'HOYO ▶';
    chainModeBtn.classList.add('hidden');

    controlsLegendStrip.innerHTML = `
      <span><strong>[MOUSE]</strong> APUNTAR</span>
      <span class="sep">•</span>
      <span><strong>[MANTENER CLIC IZQ / ESPACIO]</strong> CARGAR GOLPE</span>
      <span class="sep">•</span>
      <span><strong>[E]</strong> MINA / COHETE WORMS</span>
      <span class="sep">•</span>
      <span><strong>[SHIFT / CLIC DER]</strong> PULSO / POWERUP</span>
      <span class="sep">•</span>
      <span><strong>[1-4]</strong> BURLA</span>
    `;
    const localPutt = puttEngine.players[net.localSlotId] || puttEngine.players[0];
    installedModsStrip.textContent = `HOYO ${puttEngine.holeIndex + 1}/${
      PUTT_HOLES.length
    } (PAR ${puttEngine.par}) • GOLPES: ${localPutt?.strokes ?? 0} • PUNTOS: ${
      localPutt?.totalPoints ?? 0
    }`;
  } else if (net.activeGame === 'HOT_CORE') {
    prevSectorBtn.classList.remove('hidden');
    nextSectorBtn.classList.remove('hidden');
    prevSectorBtn.textContent = '◀ CÁMARA';
    nextSectorBtn.textContent = 'CÁMARA ▶';
    chainModeBtn.classList.add('hidden');

    controlsLegendStrip.innerHTML = `
      <span><strong>[WASD]</strong> CORRER / PLACAR</span>
      <span class="sep">•</span>
      <span><strong>[CLIC IZQ / ESPACIO]</strong> LANZAR NÚCLEO / ESCUDO PARRY</span>
      <span class="sep">•</span>
      <span><strong>[E]</strong> PULSO EMP</span>
      <span class="sep">•</span>
      <span><strong>[SHIFT / CLIC DER]</strong> DASH</span>
      <span class="sep">•</span>
      <span><strong>[1-4]</strong> BURLA</span>
    `;
    const localHot = hotCoreEngine.players[net.localSlotId] || hotCoreEngine.players[0];
    installedModsStrip.textContent = `CÁMARA ${hotCoreEngine.arenaIndex + 1}/${
      HOT_CORE_ARENAS.length
    } • PASES: ${hotCoreEngine.core.passCount} • VICTORIAS: ${localHot?.score ?? 0}/5`;
  } else if (net.activeGame === 'VOLT_CROWN') {
    prevSectorBtn.classList.remove('hidden');
    nextSectorBtn.classList.remove('hidden');
    prevSectorBtn.textContent = '◀ SECTOR';
    nextSectorBtn.textContent = 'SECTOR ▶';
    chainModeBtn.classList.add('hidden');

    controlsLegendStrip.innerHTML = `
      <span><strong>[WASD]</strong> MOVER / PERSEGUIR</span>
      <span class="sep">•</span>
      <span><strong>[CLIC IZQ / ESPACIO]</strong> TÁSER / ESCUDO REY</span>
      <span class="sep">•</span>
      <span><strong>[E]</strong> ACTIVAR TRAMPA / PULSO ESTÁTICO</span>
      <span class="sep">•</span>
      <span><strong>[SHIFT / CLIC DER]</strong> DASH</span>
      <span class="sep">•</span>
      <span><strong>[1-4]</strong> BURLA</span>
    `;
    const localVolt = voltCrownEngine.players[net.localSlotId] || voltCrownEngine.players[0];
    const isLocalKing = voltCrownEngine.crown.holderId === localVolt?.id;
    installedModsStrip.textContent = `SECTOR ${voltCrownEngine.arenaIndex + 1}/${
      VOLT_CROWN_ARENAS.length
    } • ${isLocalKing ? '👑 ERES EL REY (CARGANDO)' : '🎯 CAZADOR'} • BATERÍA: ${Math.floor(
      localVolt?.score ?? 0
    )}% / 100%`;
  } else if (net.activeGame === 'HEX_CRUSH') {
    prevSectorBtn.classList.remove('hidden');
    nextSectorBtn.classList.remove('hidden');
    prevSectorBtn.textContent = '◀ SECTOR';
    nextSectorBtn.textContent = 'SECTOR ▶';
    chainModeBtn.classList.add('hidden');

    controlsLegendStrip.innerHTML = `
      <span><strong>[WASD]</strong> MOVER</span>
      <span class="sep">•</span>
      <span><strong>[CLIC IZQ / ESPACIO]</strong> MARTILLAZO SÍSMICO</span>
      <span class="sep">•</span>
      <span><strong>[SHIFT / CLIC DER]</strong> SALTO / PISOTÓN EN EL AIRE</span>
      <span class="sep">•</span>
      <span><strong>[E]</strong> NANOPUENTE</span>
      <span class="sep">•</span>
      <span><strong>[1-4]</strong> BURLA</span>
    `;
    const localHex = hexCrushEngine.players[net.localSlotId] || hexCrushEngine.players[0];
    const aliveCount = hexCrushEngine.players.filter((p) => p.alive && p.fallTimer <= 0).length;
    installedModsStrip.textContent = `SECTOR ${hexCrushEngine.arenaIndex + 1}/${
      HEX_CRUSH_ARENAS.length
    } • RONDA 0${hexCrushEngine.roundNumber} • EN PIE: ${aliveCount}/4 • VICTORIAS: ${localHex?.score ?? 0}/3🏆`;
  } else {
    prevSectorBtn.classList.add('hidden');
    nextSectorBtn.classList.add('hidden');
    chainModeBtn.classList.add('hidden');

    controlsLegendStrip.innerHTML = `
      <span><strong>[WASD]</strong> MOVER</span>
      <span class="sep">•</span>
      <span><strong>[CLIC IZQ / ESPACIO]</strong> BATEAR</span>
      <span class="sep">•</span>
      <span><strong>[E]</strong> AMAGO CURVO</span>
      <span class="sep">•</span>
      <span><strong>[CLIC DER / SHIFT]</strong> TURBO</span>
      <span class="sep">•</span>
      <span><strong>[1-4]</strong> BOCINA</span>
    `;
    const localP = arenaEngine.players[net.localSlotId];
    if (localP) {
      installedModsStrip.textContent =
        localP.installedModCodes.length > 0
          ? `CARTUCHOS ACTIVOS: ${localP.installedModCodes.join(' + ')}`
          : 'SIN CARTUCHOS INSTALADOS';
    }
  }

  const botsActive = arenaEngine.botDifficulty !== 'OFF';
  const visibleRoster = arenaEngine.players.filter((p) => !p.isBot || botsActive);

  playerSlotsBar.innerHTML = visibleRoster
    .map((p) => {
      const puttP = puttEngine.players[p.id];
      const hotP = hotCoreEngine.players[p.id];
      const voltP = voltCrownEngine.players[p.id];
      const hexP = hexCrushEngine.players[p.id];
      const isKing = voltCrownEngine.crown.holderId === p.id;
      const scoreBadge =
        net.activeGame === 'CHAIN_PANIC'
          ? `S${chainEngine.levelIndex + 1}`
          : net.activeGame === 'TURBO_PUTT'
            ? `${puttP ? puttP.totalPoints : 0}P`
            : net.activeGame === 'HOT_CORE'
              ? `${hotP ? hotP.score : 0}★`
              : net.activeGame === 'VOLT_CROWN'
                ? `${isKing ? '👑' : '⚡'}${Math.floor(voltP ? voltP.score : 0)}%`
                : net.activeGame === 'HEX_CRUSH'
                  ? `${hexP ? hexP.score : 0}/3🏆`
                  : `${p.score}`;
      const canKick = net.isHost && p.id > 0 && !p.isBot;
      return `
      <div class="player-slot" style="background:${p.bodyColor}">
        <span class="slot-dot"></span>
        <span>${p.name}${p.isBot ? ' [BOT]' : ''}</span>
        <span class="slot-score">${scoreBadge}</span>
        ${
          canKick
            ? `<button class="kick-btn" data-kick-slot="${p.id}" title="Vetar a ${p.name} de la sala">✕</button>`
            : ''
        }
      </div>
    `;
    })
    .join('');

  // Render Live 4-Slot Room Roster inside Hub with clear HOST / CLIENT / BOT / EMPTY badges
  if (hubRosterList) {
    hubRosterList.innerHTML = arenaEngine.players
      .map((p) => {
        const canKick = net.isHost && p.id > 0 && !p.isBot;
        const isEmptyBotSlot = p.isBot && !botsActive;
        const roleTag =
          p.id === 0
            ? '👑 HOST'
            : !p.isBot
              ? '🟢 CLIENTE'
              : botsActive
                ? '🤖 BOT'
                : '⚪ VACÍO';
        const displayName = isEmptyBotSlot ? 'ESPERANDO AMIGO...' : p.name;
        const chipBg = isEmptyBotSlot ? '#52525B' : p.bodyColor;
        return `
        <div class="roster-chip" style="background:${chipBg}">
          <span>S${p.id + 1}: ${displayName} [${roleTag}]</span>
          ${
            canKick
              ? `<button class="kick-btn" data-kick-slot="${p.id}" title="Vetar jugador de la sala">✕ VETAR</button>`
              : ''
          }
        </div>
      `;
      })
      .join('');
  }

  if (net.activeGame === 'BASH_BOT' && arenaEngine.phase === 'CARD_DRAFT') {
    draftOverlay.classList.remove('hidden');
    const winner =
      arenaEngine.lastRoundWinnerId !== null
        ? arenaEngine.players[arenaEngine.lastRoundWinnerId]
        : null;
    draftWinnerText.textContent = winner
      ? `🏆 ${winner.name} GANA LA RONDA (+1 PTO)`
      : 'EMPATE TÉCNICO EN LA MESA';

    draftCardsGrid.innerHTML = '';
    const options =
      arenaEngine.draftOptions.length > 0
        ? arenaEngine.draftOptions
        : ['heavy_paddle', 'gyro_spin', 'pneumatic_dash'];

    options.forEach((modId) => {
      const mod = HARDWARE_MODS.find((m) => m.id === modId) || HARDWARE_MODS[0];
      const btn = document.createElement('button');
      btn.className = 'keycap-btn cartridge-card';
      btn.innerHTML = `
        <div>
          <div class="cartridge-top">
            <span class="cartridge-tag" style="background:${mod.color}">${mod.tag}</span>
            <span>${mod.code}</span>
          </div>
          <div class="cartridge-name">${mod.title}</div>
          <p class="cartridge-desc">${mod.desc}</p>
        </div>
        <div class="cartridge-cta">[ INSTALAR CARTUCHO → ]</div>
      `;
      btn.addEventListener('click', () => {
        net.submitDraftSelection(mod.id);
        canvas.focus();
      });
      draftCardsGrid.appendChild(btn);
    });
  } else {
    draftOverlay.classList.add('hidden');
  }

  if (net.activeGame === 'BASH_BOT' && arenaEngine.phase === 'MATCH_OVER') {
    championOverlay.classList.remove('hidden');
    const winner =
      arenaEngine.lastRoundWinnerId !== null
        ? arenaEngine.players[arenaEngine.lastRoundWinnerId]
        : null;
    championNameTitle.textContent = winner
      ? `¡${winner.name} GANA EL CAMPEONATO!`
      : '¡PARTIDA COMPLETADA!';
  } else {
    championOverlay.classList.add('hidden');
  }
}

// 6. Event Listeners
function requestGameSwitch(gameId: ActiveGameId): void {
  sfx.unlock();
  sfx.playCartridgeClick();
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  net.switchGame(gameId);
  setTimeout(() => canvas.focus(), 20);
}

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.game as ActiveGameId;
    if (target) requestGameSwitch(target);
  });
});

launchGameButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.launch as ActiveGameId;
    if (target) requestGameSwitch(target);
  });
});

function isTypingInInput(): boolean {
  const el = document.activeElement;
  return (
    el === roomCodeInput ||
    el === playerNameInput ||
    el === hubPilotNameInput ||
    el === hubJoinCodeInput ||
    el === onboardingNameInput
  );
}

function flushImmediateClientAction(): void {
  if (net.isHost) return;
  const myArenaPlayer = arenaEngine.players[net.localSlotId] || arenaEngine.players[0];
  const myChainPlayer = chainEngine.players[net.localSlotId] || chainEngine.players[0];
  const myPuttPlayer = puttEngine.players[net.localSlotId] || puttEngine.players[0];
  const myHotPlayer = hotCoreEngine.players[net.localSlotId] || hotCoreEngine.players[0];
  const myVoltPlayer = voltCrownEngine.players[net.localSlotId] || voltCrownEngine.players[0];
  const myHexPlayer = hexCrushEngine.players[net.localSlotId] || hexCrushEngine.players[0];

  // Trigger immediate local visual feedback (0ms input lag!)
  if (net.activeGame === 'BASH_BOT') {
    if (pendingParry) arenaEngine.triggerParry(myArenaPlayer);
    if (pendingDash) {
      arenaEngine.triggerDash(
        myArenaPlayer,
        Math.cos(myArenaPlayer.aimAngle),
        Math.sin(myArenaPlayer.aimAngle)
      );
    }
  } else if (net.activeGame === 'CHAIN_PANIC') {
    if (pendingParry) chainEngine.triggerJump(myChainPlayer);
  } else if (net.activeGame === 'HOT_CORE') {
    if (pendingParry) hotCoreEngine.triggerThrowOrShield(myHotPlayer);
    if (pendingDash) {
      hotCoreEngine.triggerDash(
        myHotPlayer,
        Math.cos(myHotPlayer.aimAngle),
        Math.sin(myHotPlayer.aimAngle)
      );
    }
  } else if (net.activeGame === 'VOLT_CROWN') {
    if (pendingParry) voltCrownEngine.triggerTaserOrDefend(myVoltPlayer);
    if (pendingDash) {
      voltCrownEngine.triggerDash(
        myVoltPlayer,
        Math.cos(myVoltPlayer.aimAngle),
        Math.sin(myVoltPlayer.aimAngle)
      );
    }
  } else if (net.activeGame === 'HEX_CRUSH') {
    if (pendingParry) hexCrushEngine.triggerHammerSlam(myHexPlayer);
    if (pendingDash) hexCrushEngine.triggerJumpOrPound(myHexPlayer);
    if (pendingYank) hexCrushEngine.triggerEmergencyNanobridge(myHexPlayer);
  }

  const refX =
    net.activeGame === 'TURBO_PUTT'
      ? myPuttPlayer.x
      : net.activeGame === 'HOT_CORE'
        ? myHotPlayer.x
        : net.activeGame === 'VOLT_CROWN'
          ? myVoltPlayer.x
          : net.activeGame === 'HEX_CRUSH'
            ? myHexPlayer.x
            : myArenaPlayer.x;
  const refY =
    net.activeGame === 'TURBO_PUTT'
      ? myPuttPlayer.y
      : net.activeGame === 'HOT_CORE'
        ? myHotPlayer.y
        : net.activeGame === 'VOLT_CROWN'
          ? myVoltPlayer.y
          : net.activeGame === 'HEX_CRUSH'
            ? myHexPlayer.y
            : myArenaPlayer.y;
  const aimAngle = Math.atan2(mouseCourtPos.y - refY, mouseCourtPos.x - refX);
  const primaryBall = arenaEngine.balls[0];
  const clientBallDist = primaryBall
    ? Math.hypot(primaryBall.x - myArenaPlayer.x, primaryBall.y - myArenaPlayer.y)
    : 999;

  net.sendClientInput({
    slotId: net.localSlotId,
    name: playerNameInput.value.toUpperCase() || 'ALEX',
    moveX: 0,
    moveY: 0,
    aimAngle,
    parryPressed: pendingParry,
    chargingParry,
    feintPrimed: myArenaPlayer.feintPrimed,
    dashPressed: pendingDash,
    yankPressed: pendingYank,
    anchorHeld,
    emotePressed: pendingEmote,
    clientBallDist,
    clientX:
      net.activeGame === 'CHAIN_PANIC'
        ? myChainPlayer.x
        : net.activeGame === 'HOT_CORE'
          ? myHotPlayer.x
          : net.activeGame === 'VOLT_CROWN'
            ? myVoltPlayer.x
            : net.activeGame === 'HEX_CRUSH'
              ? myHexPlayer.x
              : myArenaPlayer.x,
    clientY:
      net.activeGame === 'CHAIN_PANIC'
        ? myChainPlayer.y
        : net.activeGame === 'HOT_CORE'
          ? myHotPlayer.y
          : net.activeGame === 'VOLT_CROWN'
            ? myVoltPlayer.y
            : net.activeGame === 'HEX_CRUSH'
              ? myHexPlayer.y
              : myArenaPlayer.y,
    clientZ: net.activeGame === 'HEX_CRUSH' ? myHexPlayer.z : myChainPlayer.z,
    sentAtMs: performance.now()
  });
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && document.activeElement === onboardingNameInput) {
    confirmOnboardingBtn?.click();
    return;
  }
  if (isTypingInInput()) {
    return;
  }
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (document.activeElement instanceof HTMLButtonElement) {
      document.activeElement.blur();
    }
  }
  keys[e.code] = true;

  if (e.code === 'Digit1') pendingEmote = 1;
  if (e.code === 'Digit2') pendingEmote = 2;
  if (e.code === 'Digit3') pendingEmote = 3;
  if (e.code === 'Digit4') pendingEmote = 4;

  if (e.code === 'Space' && !e.repeat) {
    sfx.unlock();
    pendingParry = true;
    chargingParry = true;
    flushImmediateClientAction();
  }

  if ((e.code === 'KeyE' || e.code === 'KeyQ') && !e.repeat) {
    e.preventDefault();
    sfx.unlock();
    if (
      net.activeGame === 'CHAIN_PANIC' ||
      net.activeGame === 'TURBO_PUTT' ||
      net.activeGame === 'HOT_CORE' ||
      net.activeGame === 'VOLT_CROWN'
    ) {
      pendingYank = true;
    } else {
      const myPlayer = arenaEngine.players[net.localSlotId] || arenaEngine.players[0];
      myPlayer.feintPrimed = true;
      pendingParry = true;
    }
    flushImmediateClientAction();
  }

  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    e.preventDefault();
    sfx.unlock();
    anchorHeld = true;
    if (!e.repeat) {
      pendingDash = true;
      flushImmediateClientAction();
    }
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'Space') {
    if (!isTypingInInput()) {
      e.preventDefault();
    }
    chargingParry = false;
    if (net.activeGame === 'TURBO_PUTT') {
      flushImmediateClientAction();
    }
  }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    anchorHeld = false;
  }
});

canvas.addEventListener('pointermove', (e) => {
  mouseCourtPos = courtRenderer.screenToCourt(e.clientX, e.clientY);
});

canvas.addEventListener('pointerdown', (e) => {
  canvas.focus();
  sfx.unlock();
  mouseCourtPos = courtRenderer.screenToCourt(e.clientX, e.clientY);
  if (e.button === 2) {
    pendingDash = true;
    anchorHeld = true;
  } else {
    pendingParry = true;
    chargingParry = true;
  }
  flushImmediateClientAction();
});

window.addEventListener('pointerup', (e) => {
  if (e.button === 0) {
    chargingParry = false;
    if (net.activeGame === 'TURBO_PUTT') {
      flushImmediateClientAction();
    }
  }
  if (e.button === 2) {
    anchorHeld = false;
  }
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function joinExistingRoomAsClient(rawCode: string): void {
  const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (!code) {
    net.pushToast('⚠️ Escribe el código de 4 letras de la sala de tu amigo', 'warn');
    return;
  }
  roomCodeInput.value = code;
  if (hubJoinCodeInput) hubJoinCodeInput.value = code;
  if (hubRoomCodeText) hubRoomCodeText.textContent = code;
  try {
    sessionStorage.setItem('tp04_my_room', code);
    sessionStorage.removeItem('tp04_hosted_room');
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('room', code);
    nextUrl.searchParams.set('join', '1');
    window.history.replaceState({}, '', nextUrl.toString());
  } catch {
    // Ignore URL errors
  }
  net.joinRoomAsClient(code, playerNameInput.value);
}

joinRoomBtn.addEventListener('click', () => {
  sfx.playCartridgeClick();
  joinExistingRoomAsClient(roomCodeInput.value);
});

hubJoinRoomBtn?.addEventListener('click', () => {
  sfx.playCartridgeClick();
  joinExistingRoomAsClient(hubJoinCodeInput?.value || roomCodeInput.value);
});

roomCodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    joinRoomBtn.click();
  }
});

hubJoinCodeInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    hubJoinRoomBtn?.click();
  }
});

function createFreshRoom(): void {
  sfx.playCartridgeClick();
  const freshCode = generateRoomCode();
  roomCodeInput.value = freshCode;
  if (hubJoinCodeInput) hubJoinCodeInput.value = '';
  if (hubRoomCodeText) hubRoomCodeText.textContent = freshCode;
  try {
    sessionStorage.setItem('tp04_my_room', freshCode);
    sessionStorage.setItem('tp04_hosted_room', freshCode);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('room', freshCode);
    nextUrl.searchParams.delete('join');
    window.history.replaceState({}, '', nextUrl.toString());
  } catch {
    // Ignore URL errors
  }
  net.hostRoom(freshCode, playerNameInput.value);
  net.pushToast(`👑 SALA #${freshCode} CREADA COMO ANFITRIÓN — COMPARTE EL LINK`, 'info');
}

createNewRoomBtn?.addEventListener('click', createFreshRoom);
hubNewRoomBtn?.addEventListener('click', createFreshRoom);
hubLeaveRoomBtn?.addEventListener('click', createFreshRoom);

function copyRoomInviteLink(): void {
  sfx.playCartridgeClick();
  const inviteUrl = new URL(window.location.href);
  inviteUrl.searchParams.set('room', net.roomCode);
  inviteUrl.searchParams.set('join', '1');
  navigator.clipboard.writeText(inviteUrl.toString()).then(() => {
    net.pushToast(`🔗 LINK DE INVITADO (#${net.roomCode}) COPIADO AL PORTAPAPELES`, 'join');
    const prevTop = copyInviteBtn.textContent;
    copyInviteBtn.textContent = '¡LINK COPIADO!';
    if (hubCopyInviteBtn) hubCopyInviteBtn.textContent = '¡LINK COPIADO!';
    setTimeout(() => {
      copyInviteBtn.textContent = prevTop;
      if (hubCopyInviteBtn) hubCopyInviteBtn.textContent = '📋 COPIAR LINK DE SALA';
    }, 1600);
  });
}

copyInviteBtn.addEventListener('click', copyRoomInviteLink);
hubCopyInviteBtn?.addEventListener('click', copyRoomInviteLink);

soundToggleBtn.addEventListener('click', () => {
  sfx.enabled = !sfx.enabled;
  soundToggleBtn.textContent = sfx.enabled ? 'SFX: ON' : 'SFX: OFF';
});

resetMatchBtn.addEventListener('click', () => {
  sfx.playCartridgeClick();
  net.sendOrApplyRoomAction({ kind: 'RESET_MATCH' });
});

prevSectorBtn.addEventListener('click', () => {
  sfx.playCartridgeClick();
  if (net.activeGame === 'TURBO_PUTT') {
    net.sendOrApplyRoomAction({
      kind: 'LOAD_STAGE',
      holeIndex: puttEngine.holeIndex - 1
    });
  } else if (net.activeGame === 'HOT_CORE') {
    net.sendOrApplyRoomAction({
      kind: 'LOAD_STAGE',
      arenaIndex: hotCoreEngine.arenaIndex - 1
    });
  } else if (net.activeGame === 'VOLT_CROWN') {
    net.sendOrApplyRoomAction({
      kind: 'LOAD_STAGE',
      arenaIndex: voltCrownEngine.arenaIndex - 1
    });
  } else if (net.activeGame === 'HEX_CRUSH') {
    net.sendOrApplyRoomAction({
      kind: 'LOAD_STAGE',
      arenaIndex: hexCrushEngine.arenaIndex - 1
    });
  } else {
    net.sendOrApplyRoomAction({
      kind: 'LOAD_STAGE',
      levelIndex: chainEngine.levelIndex - 1
    });
  }
});

nextSectorBtn.addEventListener('click', () => {
  sfx.playCartridgeClick();
  if (net.activeGame === 'TURBO_PUTT') {
    net.sendOrApplyRoomAction({
      kind: 'LOAD_STAGE',
      holeIndex: puttEngine.holeIndex + 1
    });
  } else if (net.activeGame === 'HOT_CORE') {
    net.sendOrApplyRoomAction({
      kind: 'LOAD_STAGE',
      arenaIndex: hotCoreEngine.arenaIndex + 1
    });
  } else if (net.activeGame === 'VOLT_CROWN') {
    net.sendOrApplyRoomAction({
      kind: 'LOAD_STAGE',
      arenaIndex: voltCrownEngine.arenaIndex + 1
    });
  } else if (net.activeGame === 'HEX_CRUSH') {
    net.sendOrApplyRoomAction({
      kind: 'LOAD_STAGE',
      arenaIndex: hexCrushEngine.arenaIndex + 1
    });
  } else {
    net.sendOrApplyRoomAction({
      kind: 'LOAD_STAGE',
      levelIndex: chainEngine.levelIndex + 1
    });
  }
});

chainModeBtn.addEventListener('click', () => {
  sfx.playCartridgeClick();
  const nextMode = chainEngine.mode === 'COOP' ? 'SABOTAGE' : 'COOP';
  net.sendOrApplyRoomAction({
    kind: 'CHAIN_MODE',
    chainMode: nextMode
  });
});

newChampionshipBtn.addEventListener('click', () => {
  sfx.playCartridgeClick();
  net.sendOrApplyRoomAction({ kind: 'RESET_MATCH' });
});

function applyPilotNameChange(rawValue: string): void {
  const clean = rawValue.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 10) || 'PILOTO';
  localStorage.setItem('tp04_pilot_name', clean);
  if (playerNameInput && document.activeElement !== playerNameInput) {
    playerNameInput.value = clean;
  }
  if (hubPilotNameInput && document.activeElement !== hubPilotNameInput) {
    hubPilotNameInput.value = clean;
  }
  const myPlayer = arenaEngine.players[net.localSlotId] || arenaEngine.players[0];
  if (myPlayer) {
    myPlayer.name = clean;
    net.syncEnginesRoster();
    if (net.isHost) {
      net.broadcastHostSnapshot(true);
    } else {
      flushImmediateClientAction();
    }
    syncOverlaysAndHUD();
  }
}

playerNameInput.addEventListener('input', () => {
  applyPilotNameChange(playerNameInput.value);
});

hubPilotNameInput?.addEventListener('input', () => {
  applyPilotNameChange(hubPilotNameInput.value);
});

confirmOnboardingBtn?.addEventListener('click', () => {
  sfx.unlock();
  sfx.playCartridgeClick();
  const chosen = onboardingNameInput?.value.trim() || 'ALEX';
  playerNameInput.value = chosen.toUpperCase().slice(0, 10);
  if (hubPilotNameInput) hubPilotNameInput.value = playerNameInput.value;
  applyPilotNameChange(chosen);
  pilotOnboardingModal?.classList.add('hidden');
});

unbanAllBtn?.addEventListener('click', () => {
  sfx.playCartridgeClick();
  net.clearBanList();
});

// Event delegation for [✕ VETAR] buttons in both Top Bar & Hub Roster
document.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement)?.closest<HTMLButtonElement>('[data-kick-slot]');
  if (!target) return;
  const slotId = Number(target.dataset.kickSlot);
  if (!Number.isNaN(slotId) && slotId > 0) {
    sfx.playKODisassembly();
    net.kickPlayerSlot(slotId);
  }
});

function cycleBotMode(): void {
  sfx.playCartridgeClick();
  const idx = DIFFICULTY_CYCLE.indexOf(arenaEngine.botDifficulty);
  const nextDiff = DIFFICULTY_CYCLE[(idx + 1) % DIFFICULTY_CYCLE.length];
  net.sendOrApplyRoomAction({
    kind: 'BOT_DIFF',
    botDifficulty: nextDiff
  });
}

toggleBotsBtn.addEventListener('click', cycleBotMode);
topBotsToggleBtn.addEventListener('click', cycleBotMode);
hubBotsToggleBtn?.addEventListener('click', cycleBotMode);

// 7. Game Step & Main Loop
function stepGameFrame(dt: number): void {
  const myArenaPlayer = arenaEngine.players[net.localSlotId] || arenaEngine.players[0];
  const myPuttPlayer = puttEngine.players[net.localSlotId] || puttEngine.players[0];
  const myHotPlayer = hotCoreEngine.players[net.localSlotId] || hotCoreEngine.players[0];
  const myVoltPlayer = voltCrownEngine.players[net.localSlotId] || voltCrownEngine.players[0];
  const myHexPlayer = hexCrushEngine.players[net.localSlotId] || hexCrushEngine.players[0];
  let moveX = 0;
  let moveY = 0;
  if (keys['KeyW'] || keys['ArrowUp']) moveY -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) moveY += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;

  const refX =
    net.activeGame === 'TURBO_PUTT'
      ? myPuttPlayer.x
      : net.activeGame === 'HOT_CORE'
        ? myHotPlayer.x
        : net.activeGame === 'VOLT_CROWN'
          ? myVoltPlayer.x
          : net.activeGame === 'HEX_CRUSH'
            ? myHexPlayer.x
            : myArenaPlayer.x;
  const refY =
    net.activeGame === 'TURBO_PUTT'
      ? myPuttPlayer.y
      : net.activeGame === 'HOT_CORE'
        ? myHotPlayer.y
        : net.activeGame === 'VOLT_CROWN'
          ? myVoltPlayer.y
          : net.activeGame === 'HEX_CRUSH'
            ? myHexPlayer.y
            : myArenaPlayer.y;
  const aimAngle = Math.atan2(mouseCourtPos.y - refY, mouseCourtPos.x - refX);

  const primaryBall = arenaEngine.balls[0];
  const clientBallDist = primaryBall
    ? Math.hypot(primaryBall.x - myArenaPlayer.x, primaryBall.y - myArenaPlayer.y)
    : 999;

  // Quick-click putt support (if clicked and released within 1 frame)
  const quickClickPutt =
    net.activeGame === 'TURBO_PUTT' && pendingParry && !chargingParry ? 0.55 : undefined;

  const myChainPlayer = chainEngine.players[net.localSlotId] || chainEngine.players[0];

  const inputPacket: ClientInputPacket = {
    slotId: net.localSlotId,
    name: playerNameInput.value.toUpperCase() || 'ALEX',
    moveX,
    moveY,
    aimAngle,
    parryPressed: pendingParry,
    chargingParry,
    feintPrimed: myArenaPlayer.feintPrimed,
    shotReleasedPower: quickClickPutt,
    dashPressed: pendingDash,
    yankPressed: pendingYank,
    anchorHeld,
    emotePressed: pendingEmote,
    clientBallDist,
    clientX:
      net.activeGame === 'CHAIN_PANIC'
        ? myChainPlayer.x
        : net.activeGame === 'HOT_CORE'
          ? myHotPlayer.x
          : net.activeGame === 'VOLT_CROWN'
            ? myVoltPlayer.x
            : net.activeGame === 'HEX_CRUSH'
              ? myHexPlayer.x
              : myArenaPlayer.x,
    clientY:
      net.activeGame === 'CHAIN_PANIC'
        ? myChainPlayer.y
        : net.activeGame === 'HOT_CORE'
          ? myHotPlayer.y
          : net.activeGame === 'VOLT_CROWN'
            ? myVoltPlayer.y
            : net.activeGame === 'HEX_CRUSH'
              ? myHexPlayer.y
              : myArenaPlayer.y,
    clientZ: net.activeGame === 'HEX_CRUSH' ? myHexPlayer.z : myChainPlayer.z,
    sentAtMs: performance.now()
  };

  if (net.shouldStepLocally()) {
    if (net.activeGame === 'CHAIN_PANIC') {
      if (pendingEmote > 0) chainEngine.triggerEmote(myChainPlayer, pendingEmote);
      if (pendingParry) chainEngine.triggerJump(myChainPlayer);
      if (pendingYank) chainEngine.triggerCableYank(myChainPlayer);
      chainEngine.step(dt, inputPacket);
    } else if (net.activeGame === 'TURBO_PUTT') {
      if (pendingEmote > 0) puttEngine.triggerEmote(myPuttPlayer, pendingEmote);
      if (pendingYank) puttEngine.lobBombOrWeapon(myPuttPlayer);
      if (pendingDash) puttEngine.triggerShockwaveOrPowerup(myPuttPlayer);
      if (quickClickPutt) {
        puttEngine.executePutt(myPuttPlayer, quickClickPutt, aimAngle);
      }
      puttEngine.step(dt, inputPacket);
    } else if (net.activeGame === 'HOT_CORE') {
      if (pendingEmote > 0) hotCoreEngine.triggerEmote(myHotPlayer, pendingEmote);
      if (pendingParry) hotCoreEngine.triggerThrowOrShield(myHotPlayer, aimAngle);
      if (pendingYank) hotCoreEngine.triggerEmpOrSurge(myHotPlayer);
      if (pendingDash) {
        hotCoreEngine.triggerDash(
          myHotPlayer,
          moveX || Math.cos(aimAngle),
          moveY || Math.sin(aimAngle)
        );
      }
      hotCoreEngine.step(dt, inputPacket);
    } else if (net.activeGame === 'VOLT_CROWN') {
      if (pendingEmote > 0) voltCrownEngine.triggerEmote(myVoltPlayer, pendingEmote);
      if (pendingParry) voltCrownEngine.triggerTaserOrDefend(myVoltPlayer, aimAngle);
      if (pendingYank) voltCrownEngine.triggerTrapOrPulse(myVoltPlayer);
      if (pendingDash) {
        voltCrownEngine.triggerDash(
          myVoltPlayer,
          moveX || Math.cos(aimAngle),
          moveY || Math.sin(aimAngle)
        );
      }
      voltCrownEngine.step(dt, inputPacket);
    } else if (net.activeGame === 'HEX_CRUSH') {
      if (pendingEmote > 0) hexCrushEngine.triggerEmote(myHexPlayer, pendingEmote);
      if (pendingParry) hexCrushEngine.triggerHammerSlam(myHexPlayer, aimAngle);
      if (pendingDash) hexCrushEngine.triggerJumpOrPound(myHexPlayer);
      if (pendingYank) hexCrushEngine.triggerEmergencyNanobridge(myHexPlayer);
      hexCrushEngine.step(dt, inputPacket);
    } else if (net.activeGame === 'BASH_BOT') {
      if (pendingEmote > 0) arenaEngine.triggerEmote(myArenaPlayer, pendingEmote);
      if (pendingParry) arenaEngine.triggerParry(myArenaPlayer);
      if (pendingDash) {
        arenaEngine.triggerDash(
          myArenaPlayer,
          moveX || Math.cos(aimAngle),
          moveY || Math.sin(aimAngle)
        );
      }
      arenaEngine.step(dt, inputPacket);
    }
    net.broadcastHostSnapshot();
  } else {
    // Client-side prediction & dead-reckoning across all 5 games at 60/144fps for 0ms input lag!
    if (net.activeGame === 'BASH_BOT') {
      arenaEngine.stepClientPrediction(dt, net.localSlotId, inputPacket);
    } else if (net.activeGame === 'CHAIN_PANIC') {
      chainEngine.stepClientPrediction(dt, net.localSlotId, inputPacket);
    } else if (net.activeGame === 'TURBO_PUTT') {
      const releasedPwr = puttEngine.stepClientPrediction(dt, net.localSlotId, inputPacket);
      if (releasedPwr) {
        inputPacket.shotReleasedPower = releasedPwr;
      }
    } else if (net.activeGame === 'HOT_CORE') {
      hotCoreEngine.stepClientPrediction(dt, net.localSlotId, inputPacket);
    } else if (net.activeGame === 'VOLT_CROWN') {
      voltCrownEngine.stepClientPrediction(dt, net.localSlotId, inputPacket);
    } else if (net.activeGame === 'HEX_CRUSH') {
      hexCrushEngine.stepClientPrediction(dt, net.localSlotId, inputPacket);
    }
    net.sendClientInput(inputPacket);
  }

  pendingParry = false;
  pendingDash = false;
  pendingYank = false;
  pendingEmote = 0;
}

// Keep Host physics alive at 30Hz even if Host tab is in background!
setInterval(() => {
  if (document.hidden && net.isHost) {
    stepGameFrame(0.033);
  }
}, 33);

// 8. Start Room Connection & Render Loop (Last!)
if (startAsClient) {
  net.joinRoomAsClient(initialRoom, savedName);
} else {
  net.hostRoom(initialRoom, savedName);
}
syncOverlaysAndHUD();

let lastTime = performance.now();

function animate(now: number): void {
  const dt = Math.min((now - lastTime) * 0.001, 0.05);
  lastTime = now;

  stepGameFrame(dt);

  const primaryBall = arenaEngine.balls[0];
  if (net.activeGame === 'CHAIN_PANIC') {
    rpmBadge.textContent = `SECTOR 0${chainEngine.levelIndex + 1}/0${CHAIN_LEVELS.length}`;
    rpmBadge.style.background = chainEngine.windActive ? '#FF4F00' : '#1B4DFF';
    chainRenderer.render(chainEngine, net.localSlotId);
  } else if (net.activeGame === 'TURBO_PUTT') {
    const myPutt = puttEngine.players[net.localSlotId] || puttEngine.players[0];
    rpmBadge.textContent = `HOYO 0${puttEngine.holeIndex + 1} • ${myPutt.strokes}G (PAR ${puttEngine.par})`;
    rpmBadge.style.background = puttEngine.hurryActive ? '#FF4F00' : '#15803D';
    puttRenderer.render(puttEngine, net.localSlotId);
  } else if (net.activeGame === 'HOT_CORE') {
    rpmBadge.textContent = `💣 ${hotCoreEngine.core.fuseTimer.toFixed(1)}s • C0${hotCoreEngine.arenaIndex + 1}`;
    rpmBadge.style.background = hotCoreEngine.core.fuseTimer < 3.0 ? '#FF4F00' : '#F59E0B';
    hotCoreRenderer.render(hotCoreEngine, net.localSlotId);
  } else if (net.activeGame === 'VOLT_CROWN') {
    const myVolt = voltCrownEngine.players[net.localSlotId] || voltCrownEngine.players[0];
    const isKing = voltCrownEngine.crown.holderId === myVolt.id;
    rpmBadge.textContent = isKing
      ? `👑 REY: ${Math.floor(myVolt.score)}% (${myVolt.holdStreak.toFixed(1)}s)`
      : `⚡ BATERÍA: ${Math.floor(myVolt.score)}%`;
    rpmBadge.style.background = isKing ? '#F59E0B' : '#18181B';
    voltCrownRenderer.render(voltCrownEngine, net.localSlotId);
  } else if (net.activeGame === 'HEX_CRUSH') {
    const aliveCount = hexCrushEngine.players.filter((p) => p.alive && p.fallTimer <= 0).length;
    rpmBadge.textContent = `🧱 SECTOR 0${hexCrushEngine.arenaIndex + 1} • R0${hexCrushEngine.roundNumber} (${aliveCount} EN PIE)`;
    rpmBadge.style.background = '#0284C7';
    hexCrushRenderer.render(hexCrushEngine, net.localSlotId);
  } else {
    if (primaryBall) {
      const rpm = Math.round((primaryBall.speed / primaryBall.baseSpeed) * 100);
      rpmBadge.textContent = arenaEngine.multiballActive ? `2x BOLA • RPM ${rpm}` : `RPM ${rpm}`;
      rpmBadge.style.background =
        rpm > 210 || arenaEngine.multiballActive ? '#FF4F00' : '#18181B';
    }
    courtRenderer.render(arenaEngine, net.localSlotId);
  }

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
