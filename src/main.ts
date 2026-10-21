import './style.css';
import { ArenaEngine } from './game/arenaEngine';
import { CHAIN_LEVELS, ChainPanicEngine } from './game/chainPanicEngine';
import { HARDWARE_MODS } from './game/hardwareMods';
import { CourtRenderer } from './render/courtRenderer';
import { ChainPanicRenderer } from './render/chainPanicRenderer';
import { MultiplayerRoomManager } from './net/multiplayerRoom';
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

const hubOverlay = document.getElementById('hubOverlay') as HTMLDivElement;
const hubRoomCodeText = document.getElementById('hubRoomCodeText') as HTMLSpanElement;
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
const initialRoom = (urlParams.get('room') || 'TP04').toUpperCase().slice(0, 8);
roomCodeInput.value = initialRoom;
hubRoomCodeText.textContent = initialRoom;

const savedName = localStorage.getItem('tp04_pilot_name') || 'ALEX';
playerNameInput.value = savedName;

// 4. Engines & Renderers
const arenaEngine = new ArenaEngine(syncOverlaysAndHUD);
const chainEngine = new ChainPanicEngine();
const courtRenderer = new CourtRenderer(canvas);
const chainRenderer = new ChainPanicRenderer(canvas);
const net = new MultiplayerRoomManager(arenaEngine, chainEngine, syncOverlaysAndHUD);

// 5. UI & HUD Synchronization Function
function syncOverlaysAndHUD(): void {
  const humanCount = arenaEngine.players.filter((p) => !p.isBot).length;
  netLed.className = humanCount > 1 ? 'status-led online' : 'status-led';
  netRoleLabel.textContent = net.isHost
    ? `SALA #${net.roomCode} • HOST (${humanCount}/4 HUMANOS)`
    : `SALA #${net.roomCode} • CONECTADO (SLOT ${net.localSlotId + 1})`;

  const botLabel = DIFFICULTY_LABELS[arenaEngine.botDifficulty] || '🤖 BOTS: NORMAL';
  if (toggleBotsBtn) toggleBotsBtn.textContent = botLabel;
  if (topBotsToggleBtn) topBotsToggleBtn.textContent = botLabel;

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
    .map(
      (p) => `
      <div class="player-slot" style="background:${p.bodyColor}">
        <span class="slot-dot"></span>
        <span>${p.name}${p.isBot ? ' [BOT]' : ''}</span>
        <span class="slot-score">${
          net.activeGame === 'CHAIN_PANIC'
            ? `S${chainEngine.levelIndex + 1}`
            : p.score
        }</span>
      </div>
    `
    )
    .join('');

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
  net.switchGame(gameId);
  if (gameId !== 'HUB') {
    setTimeout(() => canvas.focus(), 40);
  }
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

window.addEventListener('keydown', (e) => {
  if (document.activeElement === roomCodeInput || document.activeElement === playerNameInput) {
    return;
  }
  keys[e.code] = true;

  if (e.code === 'Digit1') pendingEmote = 1;
  if (e.code === 'Digit2') pendingEmote = 2;
  if (e.code === 'Digit3') pendingEmote = 3;
  if (e.code === 'Digit4') pendingEmote = 4;

  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault();
    sfx.unlock();
    pendingParry = true;
    chargingParry = true;
  }

  if ((e.code === 'KeyE' || e.code === 'KeyQ') && !e.repeat) {
    e.preventDefault();
    sfx.unlock();
    if (net.activeGame === 'CHAIN_PANIC') {
      pendingYank = true;
    } else {
      const myPlayer = arenaEngine.players[net.localSlotId] || arenaEngine.players[0];
      myPlayer.feintPrimed = true;
      pendingParry = true;
    }
  }

  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    e.preventDefault();
    sfx.unlock();
    anchorHeld = true;
    if (!e.repeat) pendingDash = true;
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'Space') {
    chargingParry = false;
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
});

window.addEventListener('pointerup', (e) => {
  if (e.button === 0) {
    chargingParry = false;
  }
  if (e.button === 2) {
    anchorHeld = false;
  }
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

joinRoomBtn.addEventListener('click', () => {
  const code = roomCodeInput.value.trim().toUpperCase() || 'TP04';
  hubRoomCodeText.textContent = code;
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('room', code);
  window.history.replaceState({}, '', nextUrl.toString());
  net.connectToRoom(code, playerNameInput.value);
});

copyInviteBtn.addEventListener('click', () => {
  const inviteUrl = new URL(window.location.href);
  inviteUrl.searchParams.set('room', net.roomCode);
  navigator.clipboard.writeText(inviteUrl.toString()).then(() => {
    const prev = copyInviteBtn.textContent;
    copyInviteBtn.textContent = '¡LINK COPIADO!';
    setTimeout(() => {
      copyInviteBtn.textContent = prev;
    }, 1600);
  });
});

soundToggleBtn.addEventListener('click', () => {
  sfx.enabled = !sfx.enabled;
  soundToggleBtn.textContent = sfx.enabled ? 'SFX: ON' : 'SFX: OFF';
});

resetMatchBtn.addEventListener('click', () => {
  if (!net.shouldStepLocally()) return;
  if (net.activeGame === 'CHAIN_PANIC') {
    chainEngine.loadLevel(chainEngine.levelIndex);
  } else {
    arenaEngine.resetChampionship();
  }
  net.broadcastHostSnapshot(true);
});

prevSectorBtn.addEventListener('click', () => {
  if (!net.shouldStepLocally()) return;
  sfx.playCartridgeClick();
  chainEngine.loadLevel(chainEngine.levelIndex - 1);
  net.broadcastHostSnapshot(true);
  syncOverlaysAndHUD();
});

nextSectorBtn.addEventListener('click', () => {
  if (!net.shouldStepLocally()) return;
  sfx.playCartridgeClick();
  chainEngine.loadLevel(chainEngine.levelIndex + 1);
  net.broadcastHostSnapshot(true);
  syncOverlaysAndHUD();
});

chainModeBtn.addEventListener('click', () => {
  if (!net.shouldStepLocally()) return;
  sfx.playCartridgeClick();
  chainEngine.toggleMode();
  chainModeBtn.textContent =
    chainEngine.mode === 'SABOTAGE' ? 'MODO: TRAIDOR (3v1)' : 'MODO: CO-OP';
  net.broadcastHostSnapshot(true);
  syncOverlaysAndHUD();
});

newChampionshipBtn.addEventListener('click', () => {
  if (net.shouldStepLocally()) {
    arenaEngine.resetChampionship();
    net.broadcastHostSnapshot(true);
  }
});

playerNameInput.addEventListener('input', () => {
  const clean = playerNameInput.value.toUpperCase().slice(0, 10) || 'UNIT';
  localStorage.setItem('tp04_pilot_name', clean);
  const myPlayer = arenaEngine.players[net.localSlotId];
  if (myPlayer) {
    myPlayer.name = clean;
    chainEngine.syncPlayerIdentities(
      arenaEngine.players.map((p) => ({ name: p.name, isBot: p.isBot })),
      arenaEngine.botDifficulty !== 'OFF'
    );
    syncOverlaysAndHUD();
  }
});

function cycleBotMode(): void {
  if (!net.shouldStepLocally()) return;
  sfx.playCartridgeClick();
  const idx = DIFFICULTY_CYCLE.indexOf(arenaEngine.botDifficulty);
  const nextDiff = DIFFICULTY_CYCLE[(idx + 1) % DIFFICULTY_CYCLE.length];
  arenaEngine.botDifficulty = nextDiff;

  const botsActive = nextDiff !== 'OFF';
  chainEngine.syncPlayerIdentities(
    arenaEngine.players.map((p) => ({ name: p.name, isBot: p.isBot })),
    botsActive
  );
  arenaEngine.spawnRound();
  chainEngine.loadLevel(chainEngine.levelIndex);
  net.broadcastHostSnapshot(true);
  syncOverlaysAndHUD();
}

toggleBotsBtn.addEventListener('click', cycleBotMode);
topBotsToggleBtn.addEventListener('click', cycleBotMode);

// 7. Game Step & Main Loop
function stepGameFrame(dt: number): void {
  const myArenaPlayer = arenaEngine.players[net.localSlotId] || arenaEngine.players[0];
  let moveX = 0;
  let moveY = 0;
  if (keys['KeyW'] || keys['ArrowUp']) moveY -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) moveY += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;

  const aimAngle = Math.atan2(
    mouseCourtPos.y - myArenaPlayer.y,
    mouseCourtPos.x - myArenaPlayer.x
  );
  const primaryBall = arenaEngine.balls[0];
  const clientBallDist = primaryBall
    ? Math.hypot(primaryBall.x - myArenaPlayer.x, primaryBall.y - myArenaPlayer.y)
    : 999;

  const inputPacket: ClientInputPacket = {
    slotId: net.localSlotId,
    name: playerNameInput.value.toUpperCase() || 'ALEX',
    moveX,
    moveY,
    aimAngle,
    parryPressed: pendingParry,
    chargingParry,
    dashPressed: pendingDash,
    yankPressed: pendingYank,
    anchorHeld,
    emotePressed: pendingEmote,
    clientBallDist
  };

  if (net.shouldStepLocally()) {
    if (net.activeGame === 'CHAIN_PANIC') {
      const myChainPlayer = chainEngine.players[net.localSlotId] || chainEngine.players[0];
      if (pendingEmote > 0) chainEngine.triggerEmote(myChainPlayer, pendingEmote);
      if (pendingParry) chainEngine.triggerJump(myChainPlayer);
      if (pendingYank) chainEngine.triggerCableYank(myChainPlayer);
      chainEngine.step(dt, inputPacket);
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
net.connectToRoom(initialRoom, savedName);
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
