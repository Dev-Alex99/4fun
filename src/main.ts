import './style.css';
import './ui/playMode.css';
import './ui/party.css';
import type { PracticeRoom } from './ui/practiceRoom';
import { PARTY_GAMES, type PlayableGame } from './game/partyVote';
import { SharePanel, shareUrl } from './ui/sharePanel';
import { PartyPanel } from './ui/partyPanel';
import { ComfortSettings } from './ui/comfortSettings';
import { playPreferences } from './game/playPreferences';
import { ArenaEngine } from './game/arenaEngine';
import { CHAIN_CAMPAIGN_SECTORS, CHAIN_LEVELS, ChainPanicEngine } from './game/chainPanicEngine';
import { HOT_CORE_ARENAS, HotCoreEngine } from './game/hotCoreEngine';
import { VOLT_CROWN_ARENAS, VoltCrownEngine } from './game/voltCrownEngine';
import { HEX_CRUSH_ARENAS, HexCrushEngine } from './game/hexCrushEngine';
import { RICOCHET_ARENAS, RicochetEngine } from './game/ricochetEngine';
import { TournamentManager } from './game/tournamentManager';
import { validTournamentOptions } from './game/tournamentRules';
import { GAME_INSTRUCTIONS, instructionControls } from './game/gameInstructions';
import { campaignMedal, copyCampaign, validCampaignSave } from './game/chainCampaign';
import { ResultDialog } from './ui/resultDialog';
import { PlayModeUI } from './ui/playMode';
import { actionPresentation } from './ui/actionHints';
import { ConnectionPanel } from './ui/connectionPanel';
import { cargoStageMedal, CARGO_ROUTE_NAMES, CARGO_STAGES, CargoCrewEngine } from './game/cargoCrewEngine';
import { CargoCrewRenderer } from './render/cargoCrewRenderer';
import { makeSessionResult } from './game/matchResults';
import { playerProgress, SKIN_ACHIEVEMENTS } from './game/playerProgress';
import { PUTT_HOLES, PuttWarEngine } from './game/puttWarEngine';
import { HARDWARE_MODS } from './game/hardwareMods';
import { CourtRenderer } from './render/courtRenderer';
import { ChainPanicRenderer } from './render/chainPanicRenderer';
import { HotCoreRenderer } from './render/hotCoreRenderer';
import { VoltCrownRenderer } from './render/voltCrownRenderer';
import { HexCrushRenderer } from './render/hexCrushRenderer';
import { RicochetRenderer } from './render/ricochetRenderer';
import { PuttWarRenderer } from './render/puttWarRenderer';
import { generateRoomCode, MultiplayerRoomManager } from './net/multiplayerRoom';
import { sfx } from './audio/mechanicalSfx';
import { bgm } from './audio/chiptuneBgm';
import { touchGamepad } from './input/touchGamepad';
import { robotWorkshop, ROBOT_HATS, ROBOT_VISORS, ROBOT_SKINS, skinIsUnlocked } from './game/robotWorkshop';
import { ActiveGameId, BotDifficulty, CHAOS_MUTATORS, ClientInputPacket, TournamentGameId, TournamentOptions } from './types';
import { FixedStepClock } from './runtime/fixedStepClock';
import { escapeHtml, normalizePilotName, readPilotName, writePilotName, readStorage, removeStorage, writeStorage } from './utils/browser';

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
const bgmToggleBtn = document.getElementById('bgmToggleBtn') as HTMLButtonElement | null;
const touchToggleBtn = document.getElementById('touchToggleBtn') as HTMLButtonElement | null;
const resetMatchBtn = document.getElementById('resetMatchBtn') as HTMLButtonElement;
const playerNameInput = document.getElementById('playerNameInput') as HTMLInputElement;
const toggleBotsBtn = document.getElementById('toggleBotsBtn') as HTMLButtonElement;
const prevSectorBtn = document.getElementById('prevSectorBtn') as HTMLButtonElement;
const nextSectorBtn = document.getElementById('nextSectorBtn') as HTMLButtonElement;
const chainModeBtn = document.getElementById('chainModeBtn') as HTMLButtonElement;
const cargoRouteBtn = document.getElementById('cargoRouteBtn') as HTMLButtonElement;
cargoRouteBtn.addEventListener('click', () => net.sendOrApplyRoomAction({ kind: 'CARGO_ROUTE', cargoRoute: (cargoEngine.routeIndex + 1) % 3 }));
const voltModeBtn = document.getElementById('voltModeBtn') as HTMLButtonElement;
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
const hubSearchInput = document.getElementById('hubSearchInput') as HTMLInputElement | null;
const hubClearSearchBtn = document.getElementById('hubClearSearchBtn') as HTMLButtonElement | null;
const hubRandomGameBtn = document.getElementById('hubRandomGameBtn') as HTMLButtonElement | null;
const hubResetFiltersBtn = document.getElementById('hubResetFiltersBtn') as HTMLButtonElement | null;
const hubNoResultsMsg = document.getElementById('hubNoResultsMsg') as HTMLDivElement | null;
const filterPillButtons = document.querySelectorAll<HTMLButtonElement>('.filter-pill');
const gameCartridgeCards = document.querySelectorAll<HTMLDivElement>('.game-cartridge');

const draftOverlay = document.getElementById('draftOverlay') as HTMLDivElement;
const draftWinnerText = document.getElementById('draftWinnerText') as HTMLDivElement;
const draftCardsGrid = document.getElementById('draftCardsGrid') as HTMLDivElement;

const championOverlay = document.getElementById('championOverlay') as HTMLDivElement;
const championNameTitle = document.getElementById('championNameTitle') as HTMLHeadingElement;
const newChampionshipBtn = document.getElementById('newChampionshipBtn') as HTMLButtonElement;

// Tournament Mode Elements
const tabTournamentBtn = document.getElementById('tabTournamentBtn') as HTMLButtonElement | null;
const hubStartTournamentBtn = document.getElementById('hubStartTournamentBtn') as HTMLButtonElement | null;
const tournamentOverlay = document.getElementById('tournamentOverlay') as HTMLDivElement;
const tourneyModalEyebrow = document.getElementById('tourneyModalEyebrow') as HTMLDivElement;
const tourneyModalTitle = document.getElementById('tourneyModalTitle') as HTMLHeadingElement;
const tourneyRouletteView = document.getElementById('tourneyRouletteView') as HTMLDivElement;
const rouletteIcon = document.getElementById('rouletteIcon') as HTMLDivElement;
const rouletteName = document.getElementById('rouletteName') as HTMLDivElement;
const rouletteDesc = document.getElementById('rouletteDesc') as HTMLParagraphElement;
const tourneyStandingsView = document.getElementById('tourneyStandingsView') as HTMLDivElement;
const tourneyLeaderboard = document.getElementById('tourneyLeaderboard') as HTMLDivElement;
const tourneyIntermissionText = document.getElementById('tourneyIntermissionText') as HTMLDivElement;
const tourneyPodiumView = document.getElementById('tourneyPodiumView') as HTMLDivElement;
const tourneyChampName = document.getElementById('tourneyChampName') as HTMLHeadingElement;
const tourneyRestartBtn = document.getElementById('tourneyRestartBtn') as HTMLButtonElement;
const tourneyExitHubBtn = document.getElementById('tourneyExitHubBtn') as HTMLButtonElement;
const tourneyShuffleBtn = document.getElementById('tourneyShuffleBtn') as HTMLButtonElement;
const tourneyCancelBtn = document.getElementById('tourneyCancelBtn') as HTMLButtonElement;
const tourneyPreparationView = document.getElementById('tourneyPreparationView') as HTMLDivElement;
const tourneyReadyBtn = document.getElementById('tourneyReadyBtn') as HTMLButtonElement;
const tourneySettings = document.getElementById('tourneySettings') as HTMLFieldSetElement;
const tourneyRoundsSelect = document.getElementById('tourneyRoundsSelect') as HTMLSelectElement;
const tourneyMutatorsInput = document.getElementById('tourneyMutatorsInput') as HTMLInputElement;
const tourneyGameInputs = [...document.querySelectorAll<HTMLInputElement>('[data-tournament-game]')];
const tourneySettingsHint = document.getElementById('tourneySettingsHint') as HTMLParagraphElement;
const tourneyObjective = document.getElementById('tourneyObjective') as HTMLParagraphElement;
const tourneyControls = document.getElementById('tourneyControls') as HTMLDListElement;
const tourneyTip = document.getElementById('tourneyTip') as HTMLParagraphElement;
const tourneyMutator = document.getElementById('tourneyMutator') as HTMLParagraphElement;
const tourneyReadyRoster = document.getElementById('tourneyReadyRoster') as HTMLDivElement;
const tourneyReadyStatus = document.getElementById('tourneyReadyStatus') as HTMLParagraphElement;
const tourneyFinalLeaderboard = document.getElementById('tourneyFinalLeaderboard') as HTMLDivElement;
const virtualGamepad = document.getElementById('virtualGamepad') as HTMLDivElement;
const adventureHud = document.getElementById('adventureHud') as HTMLDivElement;
const startChainCampaignBtn = document.getElementById('startChainCampaignBtn') as HTMLButtonElement;
const continueChainCampaignBtn = document.getElementById('continueChainCampaignBtn') as HTMLButtonElement;
const resultDialog = new ResultDialog();
const actionHint = document.getElementById('actionHint') as HTMLDivElement;
const playMode = new PlayModeUI({ onBlockControls: () => releaseInputState(), onChange: () => syncOverlaysAndHUD() });
let cancelHeldInput = false;
let lastCampaignSaveKey = '';

// Robot Workshop Elements
const workshopOverlay = document.getElementById('workshopOverlay') as HTMLDivElement;
const closeWorkshopBtn = document.getElementById('closeWorkshopBtn') as HTMLButtonElement;
const hubOpenWorkshopBtn = document.getElementById('hubOpenWorkshopBtn') as HTMLButtonElement | null;
const hudWorkshopBtn = document.getElementById('hudWorkshopBtn') as HTMLButtonElement | null;
const applyWorkshopBtn = document.getElementById('applyWorkshopBtn') as HTMLButtonElement;
const workshopPreviewCanvas = document.getElementById('workshopPreviewCanvas') as HTMLCanvasElement;
const workshopHatsGrid = document.getElementById('workshopHatsGrid') as HTMLDivElement;
const workshopVisorsRow = document.getElementById('workshopVisorsRow') as HTMLDivElement;
const workshopSkinsRow = document.getElementById('workshopSkinsRow') as HTMLDivElement;

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
const sessionRoom = readStorage('session', 'tp04_my_room');
const hostedRoomInTab = readStorage('session', 'tp04_hosted_room');
const initialRoom = (urlRoom || sessionRoom || generateRoomCode()).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || generateRoomCode();

// Explicit Host vs Client determination:
// If URL has ?join=1 or ?room=XXXX that wasn't created as Host in this tab, join strictly as CLIENT!
const startAsClient =
  urlJoinParam !== null || Boolean(urlRoom && hostedRoomInTab !== initialRoom);

try {
  writeStorage('session', 'tp04_my_room', initialRoom);
  if (!startAsClient) {
    writeStorage('session', 'tp04_hosted_room', initialRoom);
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

const storedPilotName = readPilotName();
const savedName = normalizePilotName(storedPilotName || 'ALEX');
writeStorage('session', 'tp04_pilot_name', savedName);
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
const ricochetEngine = new RicochetEngine();
const cargoEngine = new CargoCrewEngine();
const tournament = new TournamentManager();
const courtRenderer = new CourtRenderer(canvas);
const chainRenderer = new ChainPanicRenderer(canvas);
const puttRenderer = new PuttWarRenderer(canvas);
const hotCoreRenderer = new HotCoreRenderer(canvas);
const voltCrownRenderer = new VoltCrownRenderer(canvas);
const hexCrushRenderer = new HexCrushRenderer(canvas);
const ricochetRenderer = new RicochetRenderer(canvas);
const cargoRenderer = new CargoCrewRenderer(canvas);
const engines = [arenaEngine, chainEngine, puttEngine, hotCoreEngine, voltCrownEngine, hexCrushEngine, ricochetEngine, cargoEngine];
const renderers = [courtRenderer, chainRenderer, puttRenderer, hotCoreRenderer, voltCrownRenderer, hexCrushRenderer, ricochetRenderer, cargoRenderer];

function getActiveRenderer() {
  switch (net.activeGame) {
    case 'CARGO_CREW': return cargoRenderer;
    case 'CHAIN_PANIC': return chainRenderer;
    case 'TURBO_PUTT': return puttRenderer;
    case 'HOT_CORE': return hotCoreRenderer;
    case 'VOLT_CROWN': return voltCrownRenderer;
    case 'HEX_CRUSH': return hexCrushRenderer;
    case 'RICOCHET_1': return ricochetRenderer;
    default: return courtRenderer;
  }
}

function getActiveEngine() {
  switch (net.activeGame) {
    case 'CARGO_CREW': return cargoEngine;
    case 'CHAIN_PANIC': return chainEngine;
    case 'TURBO_PUTT': return puttEngine;
    case 'HOT_CORE': return hotCoreEngine;
    case 'VOLT_CROWN': return voltCrownEngine;
    case 'HEX_CRUSH': return hexCrushEngine;
    case 'RICOCHET_1': return ricochetEngine;
    default: return arenaEngine;
  }
}
const net = new MultiplayerRoomManager(
  arenaEngine,
  chainEngine,
  syncOverlaysAndHUD,
  puttEngine,
  hotCoreEngine,
  voltCrownEngine,
  hexCrushEngine,
  tournament,
  ricochetEngine,
  {},
  cargoEngine
);
const connectionPanel = new ConnectionPanel(net);
let practiceRoom: PracticeRoom | null = null;
let practiceLoading: Promise<PracticeRoom> | null = null;
const practiceSelect = document.getElementById('practiceGameSelect') as HTMLSelectElement;
for (const game of PARTY_GAMES) practiceSelect.add(new Option(GAME_INSTRUCTIONS[game].title, game));
async function openPractice(game: PlayableGame): Promise<void> {
  releaseInputState();
  const start = document.getElementById('startPracticeBtn') as HTMLButtonElement;
  const help = document.getElementById('helpPracticeBtn') as HTMLButtonElement;
  start.disabled = help.disabled = true;
  try {
    practiceLoading ??= import('./ui/practiceRoom').then(({ PracticeRoom }) => new PracticeRoom({ touch: () => touchGamepad.enabled, game: () => net.activeGame, block: () => releaseInputState() }));
    practiceRoom = await practiceLoading; practiceRoom.open(game);
  } catch { practiceLoading = null; net.pushToast('No se pudo abrir la práctica. Inténtalo de nuevo.', 'warn'); }
  finally { start.disabled = help.disabled = false; }
}
document.getElementById('startPracticeBtn')!.addEventListener('click', () => { void openPractice(practiceSelect.value as PlayableGame); });
document.getElementById('helpPracticeBtn')!.addEventListener('click', () => { void openPractice(net.activeGame === 'HUB' ? practiceSelect.value as PlayableGame : net.activeGame); });
const sharePanel = new SharePanel(() => releaseInputState());
const partyPanel = new PartyPanel(net, sharePanel);
new ComfortSettings();
function localControlsBlocked(): boolean { return playMode.blocksControls || Boolean(practiceRoom?.isOpen) || sharePanel.isOpen; }

// 5. UI & HUD Synchronization Function
// The HUD refreshes every 100 ms. Rewriting unchanged markup would replace buttons between mousedown and
// mouseup (the browser then fires no click) and restart their hover/press styles, so write only on change.
const renderedHtml = new WeakMap<Element, string>();
function setHtmlIfChanged(element: Element, html: string): void {
  if (renderedHtml.get(element) === html) return;
  renderedHtml.set(element, html);
  element.innerHTML = html;
}

/** Mod chosen locally; cards stay disabled until the host's snapshot ends the draft (may take one RTT). */
let pendingDraftPick: string | null = null;
let pendingDraftPickAt = 0;
let tournamentFocusKey = '';

draftCardsGrid.addEventListener('click', (event) => {
  const card = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-mod-id]');
  const modId = card?.dataset.modId;
  if (!modId || pendingDraftPick) return;
  pendingDraftPick = modId;
  pendingDraftPickAt = performance.now();
  net.submitDraftSelection(modId);
  canvas.focus();
  syncOverlaysAndHUD();
});

function syncOverlaysAndHUD(): void {
  const humanCount = arenaEngine.players.filter((p) => !p.isBot).length;
  netLed.className =
    net.connectionState === 'CONNECTED_CLIENT' || humanCount > 1
      ? 'status-led online'
      : 'status-led';

  // Smoothed RTT plus its variation: unstable Wi-Fi/mobile shows up as a large ± even with a decent ping.
  const jitter = net.linkStats.jitterMs;
  const pingSuffix = !net.isHost && net.pingMs > 0 ? ` • ${net.pingMs}ms${jitter >= 15 ? ` ±${jitter}` : ''}` : '';
  if (net.networkConfigurationError) {
    netLed.className = 'status-led';
    netRoleLabel.textContent = `⚠️ ${net.networkConfigurationError}`;
    if (hubConnectionBadge) hubConnectionBadge.textContent = net.networkConfigurationError;
  } else if (net.connectionState === 'CONNECTING') {
    netRoleLabel.textContent = `🟡 CLIENTE -> UNIENDOSE A SALA #${net.roomCode}...`;
    if (hubConnectionBadge) {
      hubConnectionBadge.textContent = `🟡 MODO CLIENTE // CONECTANDO CON EL HOST DE SALA #${net.roomCode}...`;
    }
  } else if (net.connectionState === 'RECONNECTING') {
    netRoleLabel.textContent = `🔄 CLIENTE -> RECONECTANDO A #${net.roomCode}...`;
    if (hubConnectionBadge) {
      hubConnectionBadge.textContent = `🔄 MODO CLIENTE // RECONECTANDO CON LA SALA #${net.roomCode}...`;
    }
  } else if (!net.isHost && !net.isSynchronized) {
    netRoleLabel.textContent = `🔄 RECUPERANDO SINCRONIZACIÓN DE #${net.roomCode}...`;
    if (hubConnectionBadge) hubConnectionBadge.textContent = '🔄 ESPERANDO ESTADO ACTUAL DEL ANFITRIÓN...';
  } else if (net.isHost) {
    // Players already in the room keep playing; only new invitations wait for the signaling server.
    const signalingNote = net.hostSignalingReady ? '' : ' • ⚠️ REGISTRANDO SALA, NUEVOS INGRESOS EN ESPERA';
    netRoleLabel.textContent = `👑 HOST DE SALA #${net.roomCode} (${humanCount}/4 EN LÍNEA)${signalingNote}`;
    if (hubConnectionBadge) {
      hubConnectionBadge.textContent = `👑 ERES EL ANFITRIÓN (HOST) DE SALA #${net.roomCode} (${humanCount}/4 HUMANOS EN LÍNEA)${signalingNote}`;
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
    setHtmlIfChanged(roomToastContainer, net.toasts
      .map(
        (t) => `<div class="room-toast tone-${escapeHtml(t.tone)}">${escapeHtml(t.text)}</div>`
      )
      .join(''));
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
  const hostControls = [
    ...tabButtons, ...launchGameButtons, tabTournamentBtn, topBotsToggleBtn,
    toggleBotsBtn, hubBotsToggleBtn, resetMatchBtn, prevSectorBtn, nextSectorBtn,
    chainModeBtn, cargoRouteBtn, newChampionshipBtn, hubStartTournamentBtn, tourneyRestartBtn, tourneyExitHubBtn,
    tourneyShuffleBtn, tourneyCancelBtn, startChainCampaignBtn, continueChainCampaignBtn, voltModeBtn
  ];
  hostControls.forEach((button) => {
    if (!button) return;
    button.disabled = !net.isHost;
    if (!net.isHost) button.title = 'El anfitrión controla el juego y la configuración de la sala';
  });
  tourneySettings.disabled = !net.isHost;
  cargoRouteBtn.classList.toggle('hidden', net.activeGame !== 'CARGO_CREW');
  cargoRouteBtn.textContent = CARGO_ROUTE_NAMES[cargoEngine.routeIndex];
  voltModeBtn.classList.toggle('hidden', net.activeGame !== 'VOLT_CROWN');
  voltModeBtn.textContent = voltCrownEngine.mode === 'TEAMS' ? 'MODO: EQUIPOS 2 CONTRA 2' : 'MODO: INDIVIDUAL';
  voltModeBtn.disabled = !net.isHost || tournament.state.active;
  if (hubStartTournamentBtn) hubStartTournamentBtn.disabled = !net.isHost || !validTournamentOptions(readTournamentSettings());

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

  if (bgm.enabled) {
    bgm.setTrack(net.activeGame === 'HUB' ? 'HUB' : 'BATTLE');
  }

  if (net.activeGame === 'CARGO_CREW') {
    prevSectorBtn.classList.add('hidden'); nextSectorBtn.classList.add('hidden'); chainModeBtn.classList.add('hidden');
    setHtmlIfChanged(controlsLegendStrip, `<span><strong>[WASD]</strong> MOVER</span><span><strong>[CLIC / ESPACIO / A]</strong> ENGANCHAR / SOLTAR CERCA DE LA BATERÍA</span><span><strong>[SHIFT / B]</strong> MANTENER ANCLA</span><span><strong>[E]</strong> REPARAR CERCA DE LA BATERÍA</span>`);
    installedModsStrip.textContent = `ETAPA ${cargoEngine.stageIndex + 1}/3 · INTEGRIDAD ${Math.ceil(cargoEngine.integrity)}% · ${cargoEngine.definition.hint}`;
  } else if (net.activeGame === 'CHAIN_PANIC') {
    prevSectorBtn.classList.remove('hidden');
    nextSectorBtn.classList.remove('hidden');
    prevSectorBtn.textContent = '◀ SECTOR';
    nextSectorBtn.textContent = 'SECTOR ▶';
    chainModeBtn.classList.remove('hidden');
    chainModeBtn.textContent =
      chainEngine.mode === 'SABOTAGE' ? 'MODO: TRAIDOR (3v1)' : 'MODO: CO-OP';

    setHtmlIfChanged(controlsLegendStrip, `
      <span><strong>[WASD]</strong> CAMINAR</span>
      <span class="sep">•</span>
      <span><strong>[ESPACIO / CLIC IZQ]</strong> SALTAR LÁSER</span>
      <span class="sep">•</span>
      <span><strong>[E]</strong> TIRÓN DE CABLE</span>
      <span class="sep">•</span>
      <span><strong>[SHIFT / CLIC DER]</strong> ANCLA PESADA</span>
      <span class="sep">•</span>
      <span><strong>[1-4]</strong> GRITAR</span>
    `);
    installedModsStrip.textContent = `SECTOR ${chainEngine.levelIndex + 1}/${
      CHAIN_LEVELS.length
    } • SUPERADOS: ${chainEngine.completions} • CAÍDAS: ${chainEngine.wipes}`;
  } else if (net.activeGame === 'TURBO_PUTT') {
    prevSectorBtn.classList.remove('hidden');
    nextSectorBtn.classList.remove('hidden');
    prevSectorBtn.textContent = '◀ HOYO';
    nextSectorBtn.textContent = 'HOYO ▶';
    chainModeBtn.classList.add('hidden');

    setHtmlIfChanged(controlsLegendStrip, `
      <span><strong>[MOUSE]</strong> APUNTAR</span>
      <span class="sep">•</span>
      <span><strong>[MANTENER CLIC IZQ / ESPACIO]</strong> CARGAR GOLPE</span>
      <span class="sep">•</span>
      <span><strong>[E]</strong> MINA / COHETE WORMS</span>
      <span class="sep">•</span>
      <span><strong>[SHIFT / CLIC DER]</strong> PULSO / POWERUP</span>
      <span class="sep">•</span>
      <span><strong>[1-4]</strong> BURLA</span>
    `);
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

    setHtmlIfChanged(controlsLegendStrip, `
      <span><strong>[WASD]</strong> CORRER / PLACAR</span>
      <span class="sep">•</span>
      <span><strong>[CLIC IZQ / ESPACIO]</strong> LANZAR NÚCLEO / ESCUDO PARRY</span>
      <span class="sep">•</span>
      <span><strong>[E]</strong> PULSO EMP</span>
      <span class="sep">•</span>
      <span><strong>[SHIFT / CLIC DER]</strong> DASH</span>
      <span class="sep">•</span>
      <span><strong>[1-4]</strong> BURLA</span>
    `);
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

    setHtmlIfChanged(controlsLegendStrip, `
      <span><strong>[WASD]</strong> MOVER / PERSEGUIR</span>
      <span class="sep">•</span>
      <span><strong>[CLIC IZQ / ESPACIO]</strong> TÁSER / ESCUDO REY</span>
      <span class="sep">•</span>
      <span><strong>[E]</strong> ACTIVAR TRAMPA / PULSO ESTÁTICO</span>
      <span class="sep">•</span>
      <span><strong>[SHIFT / CLIC DER]</strong> DASH</span>
      <span class="sep">•</span>
      <span><strong>[1-4]</strong> BURLA</span>
    `);
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

    setHtmlIfChanged(controlsLegendStrip, `
      <span><strong>[WASD]</strong> MOVER</span>
      <span class="sep">•</span>
      <span><strong>[CLIC IZQ / ESPACIO]</strong> MARTILLAZO SÍSMICO</span>
      <span class="sep">•</span>
      <span><strong>[SHIFT / CLIC DER]</strong> SALTO / PISOTÓN EN EL AIRE</span>
      <span class="sep">•</span>
      <span><strong>[E]</strong> NANOPUENTE</span>
      <span class="sep">•</span>
      <span><strong>[1-4]</strong> BURLA</span>
    `);
    const localHex = hexCrushEngine.players[net.localSlotId] || hexCrushEngine.players[0];
    const aliveCount = hexCrushEngine.players.filter((p) => p.alive && p.fallTimer <= 0).length;
    installedModsStrip.textContent = `SECTOR ${hexCrushEngine.arenaIndex + 1}/${
      HEX_CRUSH_ARENAS.length
    } • RONDA 0${hexCrushEngine.roundNumber} • EN PIE: ${aliveCount}/4 • VICTORIAS: ${localHex?.score ?? 0}/3🏆`;
  } else if (net.activeGame === 'RICOCHET_1') {
    prevSectorBtn.classList.remove('hidden');
    nextSectorBtn.classList.remove('hidden');
    prevSectorBtn.textContent = '◀ SECTOR';
    nextSectorBtn.textContent = 'SECTOR ▶';
    chainModeBtn.classList.add('hidden');

    setHtmlIfChanged(controlsLegendStrip, `
      <span><strong>[WASD]</strong> MOVER</span>
      <span class="sep">•</span>
      <span><strong>[CLIC IZQ / ESPACIO]</strong> PARRY REFLECTOR</span>
      <span class="sep">•</span>
      <span><strong>[CLIC DER / SHIFT]</strong> BARRIDA EN PLANCHA</span>
      <span class="sep">•</span>
      <span><strong>[1-4]</strong> BOCINA</span>
    `);
    const localRico = ricochetEngine.players[net.localSlotId] || ricochetEngine.players[0];
    installedModsStrip.textContent = `SECTOR ${ricochetEngine.arenaIndex + 1}/${
      RICOCHET_ARENAS.length
    } • BALA: ${Math.round(ricochetEngine.bullets[0]?.speed ?? 0)} RPM • KOs: ${localRico?.score ?? 0}/5 🏆 • VIDAS: ${localRico?.lives ?? 0} ❤️`;
  } else {
    prevSectorBtn.classList.add('hidden');
    nextSectorBtn.classList.add('hidden');
    chainModeBtn.classList.add('hidden');

    setHtmlIfChanged(controlsLegendStrip, `
      <span><strong>[WASD]</strong> MOVER</span>
      <span class="sep">•</span>
      <span><strong>[CLIC IZQ / ESPACIO]</strong> BATEAR</span>
      <span class="sep">•</span>
      <span><strong>[E]</strong> AMAGO CURVO</span>
      <span class="sep">•</span>
      <span><strong>[CLIC DER / SHIFT]</strong> TURBO</span>
      <span class="sep">•</span>
      <span><strong>[1-4]</strong> BOCINA</span>
    `);
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

  setHtmlIfChanged(playerSlotsBar, visibleRoster
    .map((p) => {
      const puttP = puttEngine.players[p.id];
      const hotP = hotCoreEngine.players[p.id];
      const voltP = voltCrownEngine.players[p.id];
      const hexP = hexCrushEngine.players[p.id];
      const ricoP = ricochetEngine.players[p.id];
      const isKing = voltCrownEngine.crown.holderId === p.id;
      const scoreBadge =
        net.activeGame === 'CARGO_CREW' ? `🚚 ${cargoEngine.stageIndex + 1}/3` : net.activeGame === 'CHAIN_PANIC'
          ? `S${chainEngine.levelIndex + 1}`
          : net.activeGame === 'TURBO_PUTT'
            ? `${puttP ? puttP.totalPoints : 0}P`
            : net.activeGame === 'HOT_CORE'
              ? `${hotP ? hotP.score : 0}★`
              : net.activeGame === 'VOLT_CROWN'
                ? `${voltCrownEngine.mode === 'TEAMS' ? (voltCrownEngine.teamFor(p.id) === 0 ? 'A · ' : 'B · ') : ''}${isKing ? '👑' : '⚡'}${Math.floor(voltP ? voltP.score : 0)}%`
                : net.activeGame === 'HEX_CRUSH'
                  ? `${hexP ? hexP.score : 0}/3🏆`
                  : net.activeGame === 'RICOCHET_1'
                    ? `${ricoP ? ricoP.score : 0}⚔️ (${ricoP ? ricoP.lives : 0}❤️)`
                    : `${p.score}`;
      const canKick = net.isHost && p.id > 0 && !p.isBot;
      return `
      <div class="player-slot" style="background:${escapeHtml(p.bodyColor)}">
        <span class="slot-dot"></span>
        <span>${escapeHtml(p.name)}${p.isBot ? ' [BOT]' : ''}</span>
        <span class="slot-score">${scoreBadge}</span>
        ${
          canKick
            ? `<button class="kick-btn" data-kick-slot="${p.id}" title="Vetar a ${escapeHtml(p.name)} de la sala">✕</button>`
            : ''
        }
      </div>
    `;
    })
    .join(''));

  // Render Live 4-Slot Room Roster inside Hub with clear HOST / CLIENT / BOT / EMPTY badges
  if (hubRosterList) {
    setHtmlIfChanged(hubRosterList, arenaEngine.players
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
        <div class="roster-chip" style="background:${escapeHtml(chipBg)}">
          <span>S${p.id + 1}: ${escapeHtml(displayName)} [${roleTag}]</span>
          ${
            canKick
              ? `<button class="kick-btn" data-kick-slot="${p.id}" title="Vetar jugador de la sala">✕ VETAR</button>`
              : ''
          }
        </div>
      `;
      })
      .join(''));
  }

  if (net.activeGame === 'BASH_BOT' && arenaEngine.phase === 'CARD_DRAFT') {
    draftOverlay.classList.remove('hidden');
    // A pick lost to a reconnection must not leave the cards locked: allow choosing again.
    if (pendingDraftPick && performance.now() - pendingDraftPickAt > 2500) pendingDraftPick = null;
    const winner =
      arenaEngine.lastRoundWinnerId !== null
        ? arenaEngine.players[arenaEngine.lastRoundWinnerId]
        : null;
    draftWinnerText.textContent = winner
      ? `🏆 ${winner.name} GANA LA RONDA (+1 PTO)`
      : 'EMPATE TÉCNICO EN LA MESA';

    const options =
      arenaEngine.draftOptions.length > 0
        ? arenaEngine.draftOptions
        : ['heavy_paddle', 'gyro_spin', 'pneumatic_dash'];

    setHtmlIfChanged(draftCardsGrid, options
      .map((modId) => {
        const mod = HARDWARE_MODS.find((m) => m.id === modId) || HARDWARE_MODS[0];
        const picked = pendingDraftPick === mod.id;
        return `
        <button class="keycap-btn cartridge-card${picked ? ' is-picked' : ''}" data-mod-id="${escapeHtml(mod.id)}"
          ${pendingDraftPick ? 'disabled' : ''}>
          <div>
            <div class="cartridge-top">
              <span class="cartridge-tag" style="background:${escapeHtml(mod.color)}">${escapeHtml(mod.tag)}</span>
              <span>${escapeHtml(mod.code)}</span>
            </div>
            <div class="cartridge-name">${escapeHtml(mod.title)}</div>
            <p class="cartridge-desc">${escapeHtml(mod.desc)}</p>
          </div>
          <div class="cartridge-cta">${picked ? '[ INSTALANDO… ]' : '[ INSTALAR CARTUCHO → ]'}</div>
        </button>`;
      })
      .join(''));
  } else {
    draftOverlay.classList.add('hidden');
    pendingDraftPick = null;
  }

  if (!net.sessionResult && !tournament.state.active && net.activeGame === 'BASH_BOT' && arenaEngine.phase === 'MATCH_OVER') {
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

  syncAdventureUI();
  playMode.sync({ game: net.activeGame, room: net.roomCode, name: normalizePilotName(playerNameInput.value), humans: humanCount,
    touch: touchGamepad.enabled,
    objective: net.activeGame === 'VOLT_CROWN' && voltCrownEngine.mode === 'TEAMS' ? 'Protege a tu portador y carga la batería compartida de tu equipo al 100%. Los jugadores 1 y 3 forman el equipo A; 2 y 4, el equipo B.' :
      net.activeGame === 'BASH_BOT' && arenaEngine.botDifficulty === 'OFF' && humanCount === 1 ? 'Practica el parry y sobrevive a la bola. En el torneo, superar 30 segundos sin KO gana la ronda.' : undefined });
  syncTournamentHUD();
  syncActionHints();
  connectionPanel.sync();
  partyPanel.sync();
}

function syncActionHints(): void {
  const blocked = isGameplayPaused() || localControlsBlocked();
  const presentation = actionPresentation({ game: net.activeGame, slot: net.localSlotId, touch: touchGamepad.enabled,
    connected: net.isSynchronized, blocked, holdingA: touchGamepad.isHoldingA,
    arena: arenaEngine, chain: chainEngine, cargo: cargoEngine, putt: puttEngine,
    hot: hotCoreEngine, volt: voltCrownEngine, hex: hexCrushEngine, ricochet: ricochetEngine });
  for (const key of ['A', 'B', 'E'] as const) touchGamepad.presentButton(key, presentation[key]);
  actionHint.classList.toggle('hidden', net.activeGame === 'HUB' || tournament.isPaused || resultDialog.isOpen || localControlsBlocked());
  actionHint.dataset.tone = presentation.tone;
  const actionMessage = `${net.challenge ? `RETO ${net.challenge.code}${net.challenge.eligible === false ? ' · GRUPO CAMBIÓ, SIN RÉCORD' : ''} · ` : ''}${presentation.message}`;
  if (actionHint.textContent !== actionMessage) actionHint.textContent = actionMessage;
  document.body.classList.toggle('landscape-play', window.innerWidth > window.innerHeight);
  const visible = !virtualGamepad.classList.contains('hidden');
  document.body.classList.toggle('touch-controls-visible', visible);
  document.getElementById('mobileMatchStatus')!.textContent = rpmBadge.textContent;
  const compact = document.body.classList.contains('compact-play');
  const landscape = window.innerWidth > window.innerHeight;
  const hintHeight = actionHint.classList.contains('hidden') ? 0 : actionHint.getBoundingClientRect().height + 12;
  const top = compact && !adventureHud.classList.contains('hidden') ? adventureHud.getBoundingClientRect().height + 14 : 8;
  const scale = playPreferences.controlScale;
  const insets = compact ? { top, bottom: landscape ? hintHeight + 8 : (visible ? 184 * scale : 8) + hintHeight,
    left: visible && landscape ? 124 * scale : 0, right: visible && landscape ? 144 * scale : 0, compact: true } :
    { top: 48, bottom: hintHeight + 40, left: visible ? 124 * scale : 0, right: visible ? 144 * scale : 0, compact: false };
  renderers.forEach(renderer => renderer.setPlayInsets(insets));
}

function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

function readCampaignSave() {
  try {
    const save: unknown = JSON.parse(readStorage('local', 'tp04_chain_campaign') ?? 'null');
    return validCampaignSave(save) ? save : undefined;
  } catch { return undefined; }
}

function syncAdventureUI(): void {
  captureSessionResult();
  const session = net.sessionResult;
  if (session) {
    const unlocked = playerProgress.record(session, net.localSlotId);
    if (unlocked.length) queueMicrotask(() => net.pushToast(`🏅 NUEVAS PINTURAS: ${unlocked.join(', ')} · disponibles en el taller`, 'info'));
  }
  const progress = playerProgress.data;
  setHtmlIfChanged(document.getElementById('playerProgressPanel')!, `<p>En este dispositivo: <strong>${progress.played} partidas · ${progress.wins} victorias · ${progress.rescues} rescates · ${progress.perfectParries} parries perfectos</strong>.</p>
    <div class="result-grid">${SKIN_ACHIEVEMENTS.map(achievement => `<article class="result-card"><strong>${playerProgress.unlockedSkins.includes(achievement.skin) ? '✓' : '○'} ${achievement.label}</strong><p>${achievement.requirement}</p></article>`).join('')}</div>
    <p>Récords cooperativos: ${Object.entries(progress.bestTimes).map(([game, seconds]) => `${escapeHtml(game.replaceAll('_', '-'))}: ${formatTime(seconds)}`).join(' · ') || 'Completa una expedición para registrar tu primer tiempo.'}</p>
    <p>${progress.recent.slice(0, 3).map(result => `${result.won ? '🏆' : '🏁'} ${escapeHtml(result.title)} · ${formatTime(result.seconds)}`).join('<br>')}</p>`);
  const campaign = chainEngine.campaign;
  continueChainCampaignBtn.disabled = !net.isHost || !readCampaignSave();
  const playingCampaign = net.activeGame === 'CHAIN_PANIC' && campaign.active;
  const cargo = net.activeGame === 'CARGO_CREW';
  const teams = net.activeGame === 'VOLT_CROWN' && voltCrownEngine.mode === 'TEAMS';
  adventureHud.classList.toggle('hidden', !playingCampaign && !teams && !cargo);
  if (cargo) setHtmlIfChanged(adventureHud, `<strong>CARGO-CREW · ${CARGO_ROUTE_NAMES[cargoEngine.routeIndex]} · ${cargoEngine.stageIndex + 1}/3 · ⏱ ${formatTime(cargoEngine.elapsedSeconds)}</strong>
    <span>⚡ ${Math.ceil(cargoEngine.integrity)}% INTEGRIDAD · ${cargoEngine.checkpoint ? '✓ CHECKPOINT' : 'CHECKPOINT A MITAD DE ETAPA'} · ${cargoEngine.craneActive ? '🚨 GRÚA ABAJO' : cargoEngine.craneWarning ? '⚠ GRÚA EN 1 SEGUNDO' : 'TRANSPORTE SEGURO'}</span>
    <span>${touchGamepad.enabled ? 'A' : 'ESPACIO'}: enganchar / soltar · ${touchGamepad.enabled ? 'B' : 'SHIFT'}: anclar · E: reparar · ${cargoEngine.switches.length ? `${cargoEngine.switches.filter(sw => sw.pressed).length}/2 SEGUROS` : cargoEngine.definition.hint}</span>`);
  if (teams) setHtmlIfChanged(adventureHud, `<strong>2 CONTRA 2 · BATERÍA COMPARTIDA</strong>${[0, 1].map(team =>
    `<span>EQUIPO ${team === 0 ? 'A' : 'B'}: ${Math.floor(voltCrownEngine.teamScores[team])}% · ${voltCrownEngine.getActiveParticipants().filter(p => voltCrownEngine.teamFor(p.id) === team).map(p => escapeHtml(p.name)).join(' + ')}</span>`).join('')}<span>Protege a tu portador. Las trampas del escenario afectan a ambos equipos.</span>`);
  if (playingCampaign) {
    prevSectorBtn.classList.add('hidden'); nextSectorBtn.classList.add('hidden'); chainModeBtn.classList.add('hidden');
    setHtmlIfChanged(adventureHud, `<div class="sector-progress" aria-label="Progreso de campaña">${CHAIN_LEVELS.slice(0, CHAIN_CAMPAIGN_SECTORS).map((_, i) =>
      `<span class="${i < campaign.sectorTimes.length ? 'sector-done' : i === chainEngine.levelIndex ? 'sector-current' : ''}">${i < campaign.sectorTimes.length ? '✓' : i + 1}</span>`).join('')}</div>
      <span>⏱ ${formatTime(campaign.elapsedSeconds)} · ${campaign.checkpointUnlocked ? '✓ CHECKPOINT' : 'ABRE EL PUENTE PARA GUARDAR CHECKPOINT'} · ⛓ ${campaign.rescues.reduce((sum, n) => sum + n, 0)} RESCATES</span>
      <span>${touchGamepad.enabled ? 'A' : 'ESPACIO'}: saltar · ${touchGamepad.enabled ? 'B' : 'SHIFT'}: anclar · E: rescatar al compañero</span>`);
    if (net.isHost && !campaign.completed && chainEngine.status !== 'LEVEL_CLEAR') {
      const saveKey = `${campaign.runId}:${chainEngine.levelIndex}:${campaign.checkpointUnlocked}:${chainEngine.wipes}:${Math.floor(campaign.elapsedSeconds / 5)}`;
      if (saveKey !== lastCampaignSaveKey) {
        lastCampaignSaveKey = saveKey;
        writeStorage('local', 'tp04_chain_campaign', JSON.stringify({ version: 1, levelIndex: chainEngine.levelIndex, campaign: copyCampaign(campaign) }));
      }
    }
  }
  if (playingCampaign && campaign.completed) {
    if (net.isHost) removeStorage('local', 'tp04_chain_campaign');
    resultDialog.show({ key: `chain:${campaign.runId}:${net.isHost}`, eyebrow: 'EXPEDICIÓN COOPERATIVA · 6 DE 6 SECTORES',
      title: '⛓️ ¡EQUIPO EXTRAÍDO!', primaryLabel: 'NUEVA EXPEDICIÓN',
      body: `<p>Tiempo del equipo: <strong>${formatTime(campaign.elapsedSeconds)}</strong> · ${chainEngine.wipes} caídas · ${campaign.rescues.reduce((sum, n) => sum + n, 0)} rescates.</p>
        <div class="result-grid">${campaign.sectorTimes.map((seconds, i) => `<article class="result-card"><strong>SECTOR ${i + 1} · ${campaignMedal(seconds, campaign.sectorWipes[i])}</strong><p>${formatTime(seconds)} · ${campaign.sectorWipes[i]} caídas</p></article>`).join('')}</div>
        <p>Oro: hasta 2:30 sin caídas. Plata: hasta 4:00 y como máximo dos caídas. Cada sector conserva su medalla.</p>
        <div class="result-grid">${chainEngine.getActivePlayers().map(p => `<article class="result-card"><strong>${escapeHtml(p.name)}</strong><p>${campaign.rescues[p.id]} rescates confirmados</p></article>`).join('')}</div>${session ? resultHighlights(session) : ''}`,
      onPrimary: net.isHost ? () => net.sendOrApplyRoomAction({ kind: 'START_CAMPAIGN' }) : undefined,
      onExit: net.isHost ? () => net.switchGame('HUB') : undefined });
  } else if (session && !tournament.state.active) {
    resultDialog.show({ key: `${session.id}:${net.isHost}`, eyebrow: 'RESULTADOS · HAZAÑAS DE LA PARTIDA',
      title: session.title, primaryLabel: 'JUGAR REVANCHA',
      body: `<p>Duración: ${formatTime(session.durationSeconds)}.${session.gameId === 'CARGO_CREW' ? ` Ruta completada · ${cargoEngine.damageTaken} daños · ${cargoEngine.retries} recuperaciones.` : ''}</p>
        ${session.gameId === 'CARGO_CREW' ? `<div class="result-grid">${cargoEngine.stageTimes.map((seconds, i) => `<article class="result-card"><strong>${escapeHtml(CARGO_STAGES[i].title)}</strong><p>${formatTime(seconds)} · ${cargoStageMedal(seconds, cargoEngine.stageDamage[i] ?? cargoEngine.damageTaken)}</p><p>${cargoEngine.stageDamage[i] === 0 ? '✓ SIN DAÑOS' : `${cargoEngine.stageDamage[i] ?? cargoEngine.damageTaken} daños`} · ${cargoEngine.stageRepairs[i] === 0 ? '✓ SIN REPARACIONES' : `${cargoEngine.stageRepairs[i] ?? 0} reparaciones`}</p></article>`).join('')}</div>` : ''}
        ${session.gameId === 'CARGO_CREW' ? '<p>Medallas por entrega: oro hasta 1:30 sin daño; plata hasta 2:30 con un máximo de 30 daños; bronce al completar. Objetivos extra: entregar sin daños y sin reparaciones.</p>' : ''}<div class="result-grid">${[...session.players].sort((a, b) => session.gameId === 'TURBO_PUTT' ? a.score - b.score : b.score - a.score).map(player =>
        `<article class="result-card"><strong>${session.winnerSlots.includes(player.slot) ? '🏆 ' : ''}${escapeHtml(player.name)}${player.isBot ? ' · BOT' : ''}</strong><p>${session.gameId === 'CARGO_CREW' ? `${player.stats.deliveries} entregas del equipo` : `${Math.floor(player.score)} ${session.gameId === 'TURBO_PUTT' ? 'golpes' : session.gameId === 'VOLT_CROWN' ? '% de batería' : 'puntos'}${player.stats.parries ? ` · ${player.stats.parries} devoluciones` : ''}`}</p></article>`).join('')}</div>${resultHighlights(session)}`,
      onPrimary: net.isHost ? () => net.sendOrApplyRoomAction({ kind: 'RESET_MATCH' }) : undefined,
      secondaryLabel: 'VOTAR SIGUIENTE JUEGO',
      onSecondary: net.isHost ? () => { net.switchGame('HUB'); net.startGameVote(); (document.getElementById('partyPanel') as HTMLDetailsElement).open = true; (document.getElementById('playExtras') as HTMLDetailsElement).open = true; } : undefined,
      onExit: net.isHost ? () => net.switchGame('HUB') : undefined });
    championOverlay.classList.add('hidden');
  } else resultDialog.hide();
}

function resultHighlights(result: import('./types').SessionResult): string {
  return `<div class="result-grid">${result.highlights.map(highlight => `<article class="result-card"><strong>${escapeHtml(highlight.title)}</strong><p>${escapeHtml(result.players.find(p => p.slot === highlight.slot)?.name ?? 'PILOTO')} · ${highlight.value} ${escapeHtml(highlight.unit)}</p></article>`).join('')}</div>`;
}

function captureSessionResult(): void {
  if (!net.isHost || net.activeGame === 'HUB') return;
  const cup = tournament.state.active;
  if (cup && !tournament.state.isFinished) return;
  let winners: number[] = [];
  let title = '';
  let cooperative = false;
  const engine = getActiveEngine();
  let participants: Array<{ id: number; name: string; isBot: boolean; score?: number }> = engine.players.filter(p => !p.isBot || arenaEngine.botDifficulty !== 'OFF');
  if (net.activeGame === 'HOT_CORE') participants = hotCoreEngine.getActiveParticipants();
  if (net.activeGame === 'VOLT_CROWN') participants = voltCrownEngine.getActiveParticipants();
  if (net.activeGame === 'HEX_CRUSH') participants = hexCrushEngine.getActiveParticipants();
  if (net.activeGame === 'RICOCHET_1') participants = ricochetEngine.getActiveParticipants();
  if (cup) {
    participants = arenaEngine.players.filter(p => !p.isBot || arenaEngine.botDifficulty !== 'OFF' || tournament.state.scores[p.id] > 0);
    winners = tournament.state.champId === null ? [] : [tournament.state.champId];
    title = winners.length ? `🏆 ${arenaEngine.players[winners[0]].name} GANA LA COPA` : 'COPA COMPLETADA';
  } else if (net.activeGame === 'CARGO_CREW' && cargoEngine.status === 'ROUTE_COMPLETE') {
    winners = cargoEngine.getActivePlayers().map(p => p.id); title = '🚚 ¡CARGO-CREW · RUTA COMPLETADA!'; cooperative = true;
  } else if (net.activeGame === 'CHAIN_PANIC' && net.challenge && chainEngine.status === 'LEVEL_CLEAR') {
    winners = chainEngine.getActivePlayers().map(p => p.id); title = '⛓️ ¡RETO DE SECTOR COMPLETADO!'; cooperative = true;
  } else if (net.activeGame === 'CHAIN_PANIC' && chainEngine.campaign.completed && chainEngine.campaign.active) {
    winners = chainEngine.getActivePlayers().map(p => p.id); title = 'CHAIN-PANIC · EXPEDICIÓN COMPLETADA'; cooperative = true;
  } else {
    let winner: number | null = null;
    if (net.activeGame === 'BASH_BOT' && arenaEngine.phase === 'MATCH_OVER') winner = arenaEngine.lastRoundWinnerId;
    else if (net.activeGame === 'HOT_CORE' && hotCoreEngine.status === 'MATCH_OVER') winner = hotCoreEngine.lastWinnerId;
    else if (net.activeGame === 'VOLT_CROWN' && voltCrownEngine.status === 'MATCH_OVER') winner = voltCrownEngine.lastWinnerId;
    else if (net.activeGame === 'HEX_CRUSH' && hexCrushEngine.status === 'MATCH_OVER') winner = hexCrushEngine.matchWinnerId;
    else if (net.activeGame === 'RICOCHET_1' && ricochetEngine.status === 'MATCH_OVER') winner = ricochetEngine.matchWinnerId;
    else if (net.activeGame === 'TURBO_PUTT' && puttEngine.status === 'HOLE_COMPLETE') winner = puttEngine.getRoundWinnerId();
    else return;
    winners = winner === null ? [] : [winner];
    if (net.activeGame === 'VOLT_CROWN' && voltCrownEngine.winningTeam !== null) {
      winners = participants.filter(p => voltCrownEngine.teamFor(p.id) === voltCrownEngine.winningTeam).map(p => p.id);
      title = `👑 ¡EQUIPO ${voltCrownEngine.winningTeam === 0 ? 'A' : 'B'} GANA!`;
    } else title = winner === null ? 'PARTIDA EMPATADA' : `🏆 ¡${engine.players[winner].name} GANA!`;
  }
  const chainCampaign = cooperative && net.activeGame === 'CHAIN_PANIC' && chainEngine.campaign.active;
  const id = `${net.roomSessionId}:${cup ? `cup-${tournament.state.preparationId}` : chainCampaign ? chainEngine.campaign.runId : `${net.activeGame}-${net.activeRoundEpoch}`}`;
  if (net.sessionResult?.id === id) return;
  net.publishSessionResult(makeSessionResult({ id, gameId: cup ? 'TOURNAMENT' : net.activeGame, title, cooperative,
    durationSeconds: cup ? tournament.state.elapsedSeconds ?? 0 : chainCampaign ? chainEngine.campaign.elapsedSeconds : net.activeGame === 'CARGO_CREW' ? cargoEngine.elapsedSeconds : engine.matchSeconds,
    winnerSlots: winners, players: participants.map(p => ({ slot: p.id, name: p.name, isBot: p.isBot,
      score: cup ? tournament.state.scores[p.id] : net.activeGame === 'TURBO_PUTT' ? puttEngine.players[p.id].strokes : net.activeGame === 'CARGO_CREW' ? cargoEngine.stageTimes.length : p.score ?? chainEngine.campaign.sectorTimes.length,
      stats: cup ? { ...tournament.state.matchStats[p.id] } : chainCampaign ? { ...engine.matchStats[p.id], rescues: chainEngine.campaign.rescues[p.id] } : { ...engine.matchStats[p.id] } })) }));
}

function tournamentStandings(): string {
  const sorted = arenaEngine.players.filter(p => !p.isBot || arenaEngine.botDifficulty !== 'OFF').sort((a, b) =>
    tournament.state.scores[b.id] - tournament.state.scores[a.id] ||
    Number(b.id === tournament.state.champId) - Number(a.id === tournament.state.champId));
  return sorted.map((p, index) => `<div class="leaderboard-row" style="background:${escapeHtml(p.bodyColor)}">
    <span>${index + 1}. ${escapeHtml(p.name)}${p.isBot ? ' · BOT' : ''}</span>
    <span>${tournament.state.scores[p.id]} PTOS</span></div>`).join('');
}

function syncTournamentHUD(): void {
  const state = tournament.state;
  // Keep the selected input mode while freeing the hub and dialogs from touch button overlays.
  virtualGamepad.classList.toggle('hidden', !touchGamepad.enabled || net.activeGame === 'HUB' || tournament.isPaused || resultDialog.isOpen || localControlsBlocked());
  const view = !state.active ? '' : state.rouletteSpinning ? 'roulette' : state.preparing ? 'prepare' :
    state.isFinished ? 'podium' : tournament.isIntermission ? 'standings' : '';
  tournamentOverlay.classList.toggle('hidden', !view);
  tourneyRouletteView.classList.toggle('hidden', view !== 'roulette');
  tourneyPreparationView.classList.toggle('hidden', view !== 'prepare');
  tourneyStandingsView.classList.toggle('hidden', view !== 'standings');
  tourneyPodiumView.classList.toggle('hidden', view !== 'podium');
  tourneyCancelBtn.classList.toggle('hidden', !net.isHost || view === 'podium');
  tourneyModalEyebrow.textContent = `TORNEO DEL CAOS // RONDA ${state.roundIndex + 1} DE ${state.totalRounds}`;

  if (view === 'roulette') {
    const mutator = CHAOS_MUTATORS[state.rouletteDisplayId] || CHAOS_MUTATORS.NONE;
    tourneyModalTitle.textContent = 'RULETA DE MUTADORES';
    rouletteIcon.textContent = mutator.icon;
    rouletteName.textContent = mutator.name;
    rouletteDesc.textContent = mutator.desc;
  } else if (view === 'prepare') {
    const game = state.gameSequence[state.roundIndex] as TournamentGameId;
    const instructions = GAME_INSTRUCTIONS[game];
    if (!instructions) return;
    tourneyModalTitle.textContent = instructions.title;
    const soloBash = game === 'BASH_BOT' && arenaEngine.botDifficulty === 'OFF' && state.requiredSlots.length === 1;
    tourneyObjective.textContent = soloBash ? 'Sobrevive 30 segundos sin sufrir un KO para ganar esta ronda de práctica.' : instructions.objective;
    setHtmlIfChanged(tourneyControls, instructionControls(game, touchGamepad.enabled)
      .map(control => `<dt>${escapeHtml(control.key)}</dt><dd>${escapeHtml(control.action)}</dd>`).join(''));
    tourneyTip.textContent = `💡 ${instructions.tip}`;
    const mutator = tournament.getCurrentMutatorDef();
    tourneyMutator.textContent = `${mutator.icon} ${mutator.name} · ${mutator.desc}`;
    setHtmlIfChanged(tourneyReadyRoster, state.requiredSlots.map(slot => {
      const player = arenaEngine.players[slot];
      const ready = state.readySlots.includes(slot);
      return `<div class="tourney-ready-player${ready ? ' is-ready' : ''}">${ready ? '✓' : '○'} ${escapeHtml(player.name)}${slot === net.localSlotId ? ' (TÚ)' : ''} · ${ready ? 'LISTO' : 'LEYENDO'}</div>`;
    }).join(''));
    const ready = state.readySlots.includes(net.localSlotId);
    tourneyReadyBtn.disabled = ready || !net.isSynchronized;
    tourneyReadyBtn.textContent = ready ? '✓ LISTO · ESPERANDO AL GRUPO' : '✓ ESTOY LISTO';
    const status = !net.isSynchronized ? 'Reconectando con la sala…' : state.countdown > 0
      ? `¡Todos listos! Empezamos en ${Math.ceil(state.countdown)}…`
      : `${state.readySlots.length} de ${state.requiredSlots.length} pilotos listos · los bots están preparados`;
    if (tourneyReadyStatus.textContent !== status) tourneyReadyStatus.textContent = status;
  } else if (view === 'standings') {
    tourneyModalTitle.textContent = 'TABLA DE POSICIONES';
    setHtmlIfChanged(tourneyLeaderboard, tournamentStandings());
    const next = GAME_INSTRUCTIONS[state.gameSequence[state.roundIndex + 1] as TournamentGameId];
    tourneyIntermissionText.textContent = `Siguiente: ${next?.title ?? 'otro juego'} · podrás prepararte antes de empezar`;
  } else if (view === 'podium') {
    const champion = state.champId === null ? null : arenaEngine.players[state.champId];
    tourneyModalEyebrow.textContent = `TORNEO FINALIZADO // ${state.totalRounds} RONDAS`;
    tourneyModalTitle.textContent = '🏆 GRAN CAMPEÓN DEL CAOS';
    tourneyChampName.textContent = champion ? `¡${champion.name} ES EL GRAN CAMPEÓN!` : 'TORNEO EMPATADO — SIN CAMPEÓN';
    setHtmlIfChanged(tourneyFinalLeaderboard, tournamentStandings());
    setHtmlIfChanged(document.getElementById('tourneyHighlights')!, net.sessionResult?.gameId === 'TOURNAMENT' ? resultHighlights(net.sessionResult) : '');
  }

  const focusKey = view ? `${state.preparationId}:${view}` : '';
  if (focusKey !== tournamentFocusKey) {
    const focusedInModal = tournamentOverlay.contains(document.activeElement);
    tournamentFocusKey = focusKey;
    if (view === 'prepare' && !tourneyReadyBtn.disabled) tourneyReadyBtn.focus({ preventScroll: true });
    else if (view) tournamentOverlay.querySelector<HTMLElement>('.tournament-modal-box')?.focus({ preventScroll: true });
    else if (focusedInModal) (net.activeGame === 'HUB' ? hubOverlay : canvas).focus({ preventScroll: true });
  }
}

// 6. Event Listeners
function requestGameSwitch(gameId: ActiveGameId): void {
  sfx.unlock();
  sfx.playCartridgeClick();
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  if (net.isHost && gameId === 'CHAIN_PANIC') chainEngine.stopCampaign();
  net.switchGame(gameId);
  if (gameId === 'HUB') {
    hubOverlay.focus();
  } else {
    setTimeout(() => canvas.focus(), 20);
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

tabTournamentBtn?.addEventListener('click', () => {
  sfx.playCartridgeClick();
  requestGameSwitch('HUB');
  setTimeout(() => {
    const hero = document.querySelector('.tournament-hero-card');
    hero?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);
});

// Hub Filtering, Search and Random Game Launcher
let hubFilterCategory = 'ALL';
let hubSearchTerm = '';

function updateHubCartridgeVisibility(): void {
  const q = hubSearchTerm.toLowerCase().trim();
  let matches = 0;

  gameCartridgeCards.forEach((card) => {
    const cats = (card.dataset.category || '').split(' ');
    const title = (card.dataset.gameTitle || card.textContent || '').toLowerCase();

    const matchesCategory = hubFilterCategory === 'ALL' || cats.includes(hubFilterCategory);
    const matchesSearch = !q || title.includes(q);

    if (matchesCategory && matchesSearch) {
      card.style.display = '';
      matches++;
    } else {
      card.style.display = 'none';
    }
  });

  if (hubNoResultsMsg) {
    if (matches === 0) {
      hubNoResultsMsg.classList.remove('hidden');
    } else {
      hubNoResultsMsg.classList.add('hidden');
    }
  }

  if (hubClearSearchBtn) {
    if (hubSearchTerm.length > 0) {
      hubClearSearchBtn.classList.remove('hidden');
    } else {
      hubClearSearchBtn.classList.add('hidden');
    }
  }
}

filterPillButtons.forEach((pill) => {
  pill.addEventListener('click', () => {
    sfx.playCartridgeClick();
    filterPillButtons.forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
    hubFilterCategory = pill.dataset.filter || 'ALL';
    updateHubCartridgeVisibility();
  });
});

hubSearchInput?.addEventListener('input', () => {
  hubSearchTerm = hubSearchInput.value;
  updateHubCartridgeVisibility();
});

hubClearSearchBtn?.addEventListener('click', () => {
  sfx.playCartridgeClick();
  if (hubSearchInput) hubSearchInput.value = '';
  hubSearchTerm = '';
  updateHubCartridgeVisibility();
  hubSearchInput?.focus();
});

hubResetFiltersBtn?.addEventListener('click', () => {
  sfx.playCartridgeClick();
  if (hubSearchInput) hubSearchInput.value = '';
  hubSearchTerm = '';
  hubFilterCategory = 'ALL';
  filterPillButtons.forEach((p) => {
    if (p.dataset.filter === 'ALL') {
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });
  updateHubCartridgeVisibility();
});

hubRandomGameBtn?.addEventListener('click', () => {
  sfx.playCartridgeClick();
  const visibleButtons = Array.from(gameCartridgeCards)
    .filter((card) => card.style.display !== 'none')
    .map((card) => card.querySelector<HTMLButtonElement>('.launch-game-btn'))
    .filter((btn): btn is HTMLButtonElement => btn !== null);

  const pool = visibleButtons.length > 0 ? visibleButtons : Array.from(launchGameButtons);
  if (pool.length > 0) {
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    chosen.classList.add('keycap-press-flash');
    chosen.click();
  }
});

function readTournamentSettings(): TournamentOptions {
  return {
    totalRounds: Number(tourneyRoundsSelect.value) as TournamentOptions['totalRounds'],
    games: tourneyGameInputs.filter(input => input.checked).map(input => input.dataset.tournamentGame as TournamentGameId),
    mutatorsEnabled: tourneyMutatorsInput.checked
  };
}

try {
  const saved = JSON.parse(readStorage('local', 'tp04_tournament_options') || 'null') as unknown;
  if (validTournamentOptions(saved)) {
    tourneyRoundsSelect.value = String(saved.totalRounds);
    tourneyMutatorsInput.checked = saved.mutatorsEnabled;
    tourneyGameInputs.forEach(input => { input.checked = saved.games.includes(input.dataset.tournamentGame as TournamentGameId); });
  }
} catch { /* Ignore unavailable storage or older settings. */ }

tourneySettings.addEventListener('change', () => {
  const options = readTournamentSettings();
  const valid = validTournamentOptions(options);
  if (hubStartTournamentBtn) hubStartTournamentBtn.disabled = !net.isHost || !valid;
  tourneySettingsHint.textContent = valid
    ? 'Se sortean sin repetir hasta agotar los juegos elegidos. Los cooperativos se juegan aparte.'
    : 'Elige al menos un juego para iniciar la copa.';
  if (valid && net.isHost) writeStorage('local', 'tp04_tournament_options', JSON.stringify(options));
});

hubStartTournamentBtn?.addEventListener('click', () => {
  const options = readTournamentSettings();
  if (!validTournamentOptions(options)) return;
  sfx.unlock();
  sfx.playCartridgeClick();
  net.sendOrApplyRoomAction({ kind: 'START_TOURNAMENT', tournamentOptions: options });
});

tourneyRestartBtn?.addEventListener('click', () => {
  sfx.playCartridgeClick();
  net.sendOrApplyRoomAction({ kind: 'START_TOURNAMENT', replaySame: true });
});

tourneyShuffleBtn.addEventListener('click', () => {
  sfx.playCartridgeClick();
  net.sendOrApplyRoomAction({ kind: 'START_TOURNAMENT', tournamentOptions: tournament.state.options });
});

tourneyReadyBtn.addEventListener('click', () => {
  sfx.unlock();
  sfx.playCartridgeClick();
  clearPendingActions();
  net.submitTournamentReady();
  syncOverlaysAndHUD();
});

function exitTournament(): void {
  sfx.playCartridgeClick();
  net.sendOrApplyRoomAction({ kind: 'STOP_TOURNAMENT' });
}
tourneyExitHubBtn?.addEventListener('click', exitTournament);
tourneyCancelBtn.addEventListener('click', exitTournament);
startChainCampaignBtn.addEventListener('click', () => { sfx.unlock(); net.sendOrApplyRoomAction({ kind: 'START_CAMPAIGN' }); });
continueChainCampaignBtn.addEventListener('click', () => {
  const campaignSave = readCampaignSave();
  if (campaignSave) net.sendOrApplyRoomAction({ kind: 'START_CAMPAIGN', campaignSave });
});
voltModeBtn.addEventListener('click', () => net.sendOrApplyRoomAction({ kind: 'VOLT_MODE', voltMode: voltCrownEngine.mode === 'FFA' ? 'TEAMS' : 'FFA' }));

function isTypingInInput(): boolean {
  const el = document.activeElement;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el === roomCodeInput ||
    el === playerNameInput ||
    el === hubPilotNameInput ||
    el === hubJoinCodeInput ||
    el === onboardingNameInput ||
    el === hubSearchInput
  );
}

function clearPendingActions(): void {
  pendingParry = pendingDash = pendingYank = false;
  pendingEmote = 0;
}

function isGameplayPaused(): boolean {
  return net.activeGame === 'HUB' ||
    (!net.isHost && !net.isSynchronized) ||
    tournament.isPaused || resultDialog.isOpen || (!tournament.state.active && net.sessionResult !== null);
}

function buildInputPacket(): ClientInputPacket {
  const engine = getActiveEngine();
  const player = engine.players[net.localSlotId] || engine.players[0];
  const myArenaPlayer = arenaEngine.players[net.localSlotId] || arenaEngine.players[0];
  let moveX = 0, moveY = 0;
  if (!isTypingInInput() && !localControlsBlocked()) {
    if (keys['KeyW'] || keys['ArrowUp']) moveY--;
    if (keys['KeyS'] || keys['ArrowDown']) moveY++;
    if (keys['KeyA'] || keys['ArrowLeft']) moveX--;
    if (keys['KeyD'] || keys['ArrowRight']) moveX++;
    if (touchGamepad.enabled && Math.hypot(touchGamepad.moveX, touchGamepad.moveY) > 0.05) {
      moveX = touchGamepad.moveX; moveY = touchGamepad.moveY;
    }
  }
  const aimAngle = touchGamepad.enabled && Math.hypot(touchGamepad.moveX, touchGamepad.moveY) > 0.1
    ? Math.atan2(touchGamepad.moveY, touchGamepad.moveX)
    : Math.atan2(mouseCourtPos.y - player.y, mouseCourtPos.x - player.x);
  const primaryBall = arenaEngine.balls[0];
  if (!localControlsBlocked() && (moveX || moveY || pendingParry || pendingDash || pendingYank || pendingEmote || chargingParry || anchorHeld || touchGamepad.isHoldingA || touchGamepad.isHoldingB)) cancelHeldInput = false;
  const packet: ClientInputPacket = {
    slotId: net.localSlotId, activeGame: net.activeGame, roundEpoch: engine.roundEpoch,
    name: normalizePilotName(playerNameInput.value), cosmetics: robotWorkshop.cosmetics,
    moveX, moveY, aimAngle,
    parryPressed: pendingParry,
    chargingParry: chargingParry || (touchGamepad.enabled && touchGamepad.isHoldingA),
    feintPrimed: myArenaPlayer.feintPrimed,
    shotReleasedPower: net.activeGame === 'TURBO_PUTT' && pendingParry && !chargingParry ? 0.32 : undefined,
    dashPressed: pendingDash, yankPressed: pendingYank,
    anchorHeld: anchorHeld || (touchGamepad.enabled && touchGamepad.isHoldingB),
    emotePressed: pendingEmote,
    clientBallDist: primaryBall ? Math.hypot(primaryBall.x - myArenaPlayer.x, primaryBall.y - myArenaPlayer.y) : 999,
    clientX: player.x, clientY: player.y, clientZ: 'z' in player ? player.z : 0,
    sentAtMs: performance.now(), cancelHeldActions: localControlsBlocked() || cancelHeldInput
  };
  if (packet.cancelHeldActions) {
    packet.moveX = packet.moveY = 0; packet.parryPressed = packet.dashPressed = packet.yankPressed = false;
    packet.chargingParry = packet.anchorHeld = packet.feintPrimed = false; packet.emotePressed = 0; packet.shotReleasedPower = undefined;
  }
  return packet;
}

function flushImmediateClientAction(): void {
  if (net.isHost) return;
  const packet = buildInputPacket();
  if (isGameplayPaused() || localControlsBlocked() || packet.cancelHeldActions) {
    packet.moveX = packet.moveY = 0;
    packet.parryPressed = packet.dashPressed = packet.yankPressed = false;
    packet.chargingParry = packet.anchorHeld = false;
    packet.emotePressed = 0; packet.shotReleasedPower = undefined;
  } else if (getActiveEngine().players[net.localSlotId]) {
    if (net.activeGame === 'BASH_BOT') {
      if (packet.parryPressed) arenaEngine.triggerParry(arenaEngine.players[net.localSlotId]);
      if (packet.dashPressed) arenaEngine.triggerDash(arenaEngine.players[net.localSlotId], packet.moveX || Math.cos(packet.aimAngle), packet.moveY || Math.sin(packet.aimAngle));
    } else if (net.activeGame === 'CARGO_CREW') {
      if (packet.parryPressed) cargoEngine.triggerGrip(cargoEngine.players[net.localSlotId]);
    } else if (net.activeGame === 'CHAIN_PANIC') {
      if (packet.parryPressed) chainEngine.triggerJump(chainEngine.players[net.localSlotId]);
    } else if (net.activeGame === 'TURBO_PUTT') {
      packet.shotReleasedPower = puttEngine.stepClientPrediction(0, net.localSlotId, packet) ?? packet.shotReleasedPower;
    } else if (net.activeGame === 'HOT_CORE') {
      if (packet.parryPressed) hotCoreEngine.triggerThrowOrShield(hotCoreEngine.players[net.localSlotId], packet.aimAngle);
      if (packet.dashPressed) hotCoreEngine.triggerDash(hotCoreEngine.players[net.localSlotId], packet.moveX || Math.cos(packet.aimAngle), packet.moveY || Math.sin(packet.aimAngle));
    } else if (net.activeGame === 'VOLT_CROWN') {
      if (packet.parryPressed) voltCrownEngine.triggerTaserOrDefend(voltCrownEngine.players[net.localSlotId], packet.aimAngle);
      if (packet.dashPressed) voltCrownEngine.triggerDash(voltCrownEngine.players[net.localSlotId], packet.moveX || Math.cos(packet.aimAngle), packet.moveY || Math.sin(packet.aimAngle));
    } else if (net.activeGame === 'HEX_CRUSH') {
      if (packet.parryPressed) hexCrushEngine.triggerHammerSlam(hexCrushEngine.players[net.localSlotId], packet.aimAngle);
      if (packet.dashPressed) hexCrushEngine.triggerJumpOrPound(hexCrushEngine.players[net.localSlotId]);
      if (packet.yankPressed) hexCrushEngine.triggerEmergencyNanobridge(hexCrushEngine.players[net.localSlotId]);
    } else if (net.activeGame === 'RICOCHET_1') {
      ricochetEngine.stepClientPrediction(0, net.localSlotId, packet);
    }
  }
  net.sendClientInput(packet);
  // This press was already sent; do not issue a second action ID on the next tick.
  clearPendingActions();
}

window.addEventListener('keydown', (e) => {
  if (practiceRoom?.isOpen) { practiceRoom.handleKey(e, true); return; }
  if (sharePanel.isOpen) { sharePanel.handleKey(e); return; }
  if (playMode.handleKey(e)) return;
  if (resultDialog.handleKey(e)) return;
  if (tournament.isPaused) {
    // Keep native Enter/Space button activation and keyboard focus inside the dialog.
    if (e.code === 'Tab') {
      const buttons = [...tournamentOverlay.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
        .filter(button => !button.closest('.hidden'));
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (!first) e.preventDefault();
      else if (e.shiftKey && (document.activeElement === first || !buttons.includes(document.activeElement as HTMLButtonElement))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !buttons.includes(document.activeElement as HTMLButtonElement))) {
        e.preventDefault(); first.focus();
      }
    }
    return;
  }
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
      net.activeGame === 'CARGO_CREW' || net.activeGame === 'CHAIN_PANIC' ||
      net.activeGame === 'TURBO_PUTT' ||
      net.activeGame === 'HOT_CORE' ||
      net.activeGame === 'VOLT_CROWN' ||
      net.activeGame === 'HEX_CRUSH' ||
      net.activeGame === 'RICOCHET_1'
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
  if (practiceRoom?.isOpen) { practiceRoom.handleKey(e, false); return; }
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
  mouseCourtPos = getActiveRenderer().screenToCourt(e.clientX, e.clientY);
});

canvas.addEventListener('pointerdown', (e) => {
  if (localControlsBlocked()) return;
  canvas.focus();
  sfx.unlock();
  mouseCourtPos = getActiveRenderer().screenToCourt(e.clientX, e.clientY);
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
    writeStorage('session', 'tp04_my_room', code);
    removeStorage('session', 'tp04_hosted_room');
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
    writeStorage('session', 'tp04_my_room', freshCode);
    writeStorage('session', 'tp04_hosted_room', freshCode);
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
  const url = shareUrl(window.location.href, { room: net.roomCode });
  void (async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url); net.pushToast(`LINK DE SALA #${net.roomCode} COPIADO`, 'join');
    } catch { partyPanel.invite(); }
  })();
}

copyInviteBtn.addEventListener('click', copyRoomInviteLink);
hubCopyInviteBtn?.addEventListener('click', copyRoomInviteLink);

soundToggleBtn.addEventListener('click', () => {
  sfx.enabled = !sfx.enabled;
  soundToggleBtn.textContent = sfx.enabled ? 'SFX: ON' : 'SFX: OFF';
});

if (bgmToggleBtn) {
  bgmToggleBtn.textContent = bgm.enabled ? 'BGM: ON' : 'BGM: OFF';
  bgmToggleBtn.addEventListener('click', () => {
    const isNowOn = bgm.toggle();
    bgmToggleBtn.textContent = isNowOn ? 'BGM: ON' : 'BGM: OFF';
    if (isNowOn) {
      bgm.setTrack(net.activeGame === 'HUB' ? 'HUB' : 'BATTLE');
    }
  });
}

const unlockBgmOnFirstGesture = () => {
  if (bgm.enabled) {
    bgm.setTrack(net.activeGame === 'HUB' ? 'HUB' : 'BATTLE');
    bgm.start();
  }
  window.removeEventListener('pointerdown', unlockBgmOnFirstGesture);
  window.removeEventListener('keydown', unlockBgmOnFirstGesture);
};
window.addEventListener('pointerdown', unlockBgmOnFirstGesture, { passive: true });
window.addEventListener('keydown', unlockBgmOnFirstGesture, { passive: true });

touchGamepad.init('virtualGamepad', {
  onPressA: () => {
    if (localControlsBlocked()) return;
    sfx.unlock();
    pendingParry = true;
    chargingParry = true;
    flushImmediateClientAction();
  },
  onReleaseA: () => {
    chargingParry = false;
    if (net.activeGame === 'TURBO_PUTT') {
      flushImmediateClientAction();
    }
  },
  onPressB: () => {
    if (localControlsBlocked()) return;
    sfx.unlock();
    pendingDash = true;
    anchorHeld = true;
    flushImmediateClientAction();
  },
  onReleaseB: () => {
    anchorHeld = false;
  },
  onPressE: () => {
    if (localControlsBlocked()) return;
    sfx.unlock();
    if (
      net.activeGame === 'CARGO_CREW' || net.activeGame === 'CHAIN_PANIC' ||
      net.activeGame === 'TURBO_PUTT' ||
      net.activeGame === 'HOT_CORE' ||
      net.activeGame === 'VOLT_CROWN' ||
      net.activeGame === 'HEX_CRUSH' ||
      net.activeGame === 'RICOCHET_1'
    ) {
      pendingYank = true;
    } else {
      const myPlayer = arenaEngine.players[net.localSlotId] || arenaEngine.players[0];
      myPlayer.feintPrimed = true;
      pendingParry = true;
    }
    flushImmediateClientAction();
  }
});

if (touchToggleBtn) {
  touchToggleBtn.textContent = touchGamepad.enabled ? '📱 TOUCH: ON' : '📱 TOUCH: OFF';
  touchToggleBtn.addEventListener('click', () => {
    const isNowOn = touchGamepad.toggle();
    touchToggleBtn.textContent = isNowOn ? '📱 TOUCH: ON' : '📱 TOUCH: OFF';
    sfx.playCartridgeClick();
    syncOverlaysAndHUD();
  });
}

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
  } else if (net.activeGame === 'RICOCHET_1') {
    net.sendOrApplyRoomAction({
      kind: 'LOAD_STAGE',
      arenaIndex: ricochetEngine.arenaIndex - 1
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
  } else if (net.activeGame === 'RICOCHET_1') {
    net.sendOrApplyRoomAction({
      kind: 'LOAD_STAGE',
      arenaIndex: ricochetEngine.arenaIndex + 1
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
  const clean = writePilotName(rawValue);
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
      // Profile edits must reach the host in the Hub and while joining too.
      // sendClientInput also retains the latest name for the next JOIN_CLAIM.
      net.sendClientInput({ ...buildInputPacket(), parryPressed: false, dashPressed: false,
        yankPressed: false, emotePressed: 0, shotReleasedPower: undefined });
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
  if (net.shouldStepLocally() && tournament.state.active) tournament.step(dt, (nextGame) => net.switchGame(nextGame, true));
  const mutator = tournament.state.active && !isGameplayPaused() ? tournament.state.currentMutator : net.challenge?.mutator ?? 'NONE';
  engines.forEach((engine) => engine.setChaosMutator(mutator));
  if (isGameplayPaused()) {
    clearPendingActions();
    chargingParry = anchorHeld = false;
    if (net.shouldStepLocally()) net.broadcastHostSnapshot();
    return;
  }
  const myArenaPlayer = arenaEngine.players[net.localSlotId] || arenaEngine.players[0];
  const myChainPlayer = chainEngine.players[net.localSlotId] || chainEngine.players[0];
  const myPuttPlayer = puttEngine.players[net.localSlotId] || puttEngine.players[0];
  const myHotPlayer = hotCoreEngine.players[net.localSlotId] || hotCoreEngine.players[0];
  const myVoltPlayer = voltCrownEngine.players[net.localSlotId] || voltCrownEngine.players[0];
  const myHexPlayer = hexCrushEngine.players[net.localSlotId] || hexCrushEngine.players[0];
  const inputPacket = buildInputPacket();
  const { moveX, moveY, aimAngle } = inputPacket;
  const quickClickPutt = inputPacket.shotReleasedPower;

  if (net.shouldStepLocally()) {
    if (net.activeGame === 'CARGO_CREW') {
      if (pendingParry) cargoEngine.triggerGrip(cargoEngine.players[net.localSlotId]);
      if (pendingYank) cargoEngine.triggerRepair(cargoEngine.players[net.localSlotId]);
      cargoEngine.step(dt, inputPacket);
    } else if (net.activeGame === 'CHAIN_PANIC') {
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
    } else if (net.activeGame === 'RICOCHET_1') {
      ricochetEngine.step(dt, inputPacket);
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

    // Solo BASH OFF uses a 30s survival challenge; Putt uses a completed hole.
    if (tournament.state.active && !tournament.evaluateSoloBashRound(
      net.activeGame, arenaEngine.botDifficulty, arenaEngine.players, arenaEngine.roundTimer, arenaEngine.matchStats
    )) {
      if (net.activeGame === 'TURBO_PUTT' && puttEngine.status === 'HOLE_COMPLETE') {
        tournament.recordRoundWinner(puttEngine.getRoundWinnerId(), puttEngine.matchStats);
      } else if (net.activeGame === 'BASH_BOT' && arenaEngine.phase === 'MATCH_OVER') {
        tournament.recordRoundWinner(arenaEngine.lastRoundWinnerId, arenaEngine.matchStats);
      } else if (net.activeGame === 'HOT_CORE' && hotCoreEngine.status === 'MATCH_OVER') {
        tournament.recordRoundWinner(hotCoreEngine.lastWinnerId, hotCoreEngine.matchStats);
      } else if (net.activeGame === 'VOLT_CROWN' && voltCrownEngine.status === 'MATCH_OVER') {
        tournament.recordRoundWinner(voltCrownEngine.lastWinnerId, voltCrownEngine.matchStats);
      } else if (net.activeGame === 'HEX_CRUSH' && hexCrushEngine.status === 'MATCH_OVER') {
        tournament.recordRoundWinner(hexCrushEngine.matchWinnerId, hexCrushEngine.matchStats);
      } else if (net.activeGame === 'RICOCHET_1' && ricochetEngine.status === 'MATCH_OVER') {
        tournament.recordRoundWinner(ricochetEngine.matchWinnerId, ricochetEngine.matchStats);
      }
    }

    captureSessionResult();
    net.broadcastHostSnapshot();
  } else {
    // Predict presentation and local movement; game results remain host-authoritative.
    if (net.activeGame === 'BASH_BOT') {
      arenaEngine.stepClientPrediction(dt, net.localSlotId, inputPacket);
    } else if (net.activeGame === 'CARGO_CREW') {
      cargoEngine.stepClientPrediction(dt, net.localSlotId, inputPacket);
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
    } else if (net.activeGame === 'RICOCHET_1') {
      ricochetEngine.stepClientPrediction(dt, net.localSlotId, inputPacket);
    }
    net.sendClientInput(inputPacket);
  }

  clearPendingActions();
}

// One clock prevents foreground/background callbacks from advancing physics twice.
const simulationClock = new FixedStepClock(60, 8);
simulationClock.reset(performance.now());
// Hidden tabs get no animation frames and main-thread timers are throttled to about once per second,
// which would run every guest's match at 8/60 speed. A dedicated worker's ticks are not throttled that way,
// so a host that switches tabs keeps simulating and sending snapshots. Plain timers remain the fallback.
function startBackgroundPump(tick: () => void): () => void {
  if (typeof Worker === 'function' && typeof Blob === 'function' && typeof URL.createObjectURL === 'function') {
    try {
      const url = URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 16);'], { type: 'text/javascript' }));
      const worker = new Worker(url);
      let revoked = false;
      worker.onmessage = () => {
        if (!revoked) { URL.revokeObjectURL(url); revoked = true; }
        tick();
      };
      return () => worker.terminate();
    } catch { /* Worker blocked (CSP, privacy mode): use the main-thread timer. */ }
  }
  const timer = window.setInterval(tick, 16);
  return () => window.clearInterval(timer);
}
const stopBackgroundPump = startBackgroundPump(() => {
  if (!document.hidden || !net.isHost) return;
  simulationClock.advance(performance.now(), stepGameFrame);
  // The room's own 50 ms input-expiry timer is throttled too while hidden.
  net.expireRemoteInputs();
});
// A page restored from the back/forward cache has already closed its room; start fresh.
window.addEventListener('pageshow', (event) => { if (event.persisted) window.location.reload(); });

function releaseInputState(): void {
  cancelHeldInput = true;
  Object.keys(keys).forEach((key) => { keys[key] = false; });
  chargingParry = anchorHeld = false;
  clearPendingActions();
  getActiveEngine().clearRemoteInput(net.localSlotId);
  touchGamepad.cancelInput();
  flushImmediateClientAction();
}
window.addEventListener('blur', releaseInputState);
document.addEventListener('visibilitychange', () => {
  releaseInputState();
  simulationClock.reset(performance.now());
});

// 8. Start Room Connection & Render Loop (Last!)
if (startAsClient) {
  net.joinRoomAsClient(initialRoom, savedName);
} else {
  net.hostRoom(initialRoom, savedName);
}
syncOverlaysAndHUD();

let animationFrame = 0;
let lastHudSync = 0;

function animate(now: number): void {
  simulationClock.advance(now, stepGameFrame);
  if (now - lastHudSync >= 100) {
    syncOverlaysAndHUD();
    lastHudSync = now;
  }
  const engine = getActiveEngine();
  const ghostActive = tournament.state.active && !isGameplayPaused() && tournament.state.currentMutator === 'GHOST_PULSE';
  renderers.forEach((renderer) => renderer.setGhostPulse(ghostActive, engine.simulationTime));

  const primaryBall = arenaEngine.balls[0];
  if (net.activeGame === 'CARGO_CREW') {
    rpmBadge.textContent = `🚚 CARGA ${Math.ceil(cargoEngine.integrity)}% · ${cargoEngine.stageIndex + 1}/3`;
    rpmBadge.style.background = cargoEngine.integrity < 35 ? '#dc2626' : '#0e7490';
    cargoRenderer.render(cargoEngine, net.localSlotId, touchGamepad.enabled);
  } else if (net.activeGame === 'CHAIN_PANIC') {
    rpmBadge.textContent = `SECTOR 0${chainEngine.levelIndex + 1}/0${chainEngine.campaign.active ? CHAIN_CAMPAIGN_SECTORS : CHAIN_LEVELS.length}`;
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
  } else if (net.activeGame === 'RICOCHET_1') {
    const b = ricochetEngine.bullets[0];
    const spd = Math.round(b?.speed ?? 0);
    rpmBadge.textContent = `⚡ VEL BALA: ${spd} RPM • SECTOR 0${ricochetEngine.arenaIndex + 1}`;
    rpmBadge.style.background = b?.isSupercharged ? '#F59E0B' : '#E11D48';
    ricochetRenderer.render(ricochetEngine, net.localSlotId);
  } else {
    if (primaryBall) {
      const rpm = Math.round((primaryBall.speed / primaryBall.baseSpeed) * 100);
      rpmBadge.textContent = arenaEngine.multiballActive ? `2x BOLA • RPM ${rpm}` : `RPM ${rpm}`;
      rpmBadge.style.background =
        rpm > 210 || arenaEngine.multiballActive ? '#FF4F00' : '#18181B';
    }
    courtRenderer.render(arenaEngine, net.localSlotId);
  }

  // Override top RPM badge if Tournament Fiesta is in progress
  if (tournament.state.active) {
    const mut = tournament.getCurrentMutatorDef();
    rpmBadge.textContent = `🏆 R${tournament.state.roundIndex + 1}/${tournament.state.totalRounds} • ${mut.icon} ${mut.name}`;
    rpmBadge.style.background = mut.color;
  }

  if (workshopOverlay && !workshopOverlay.classList.contains('hidden') && workshopPreviewCanvas) {
    robotWorkshop.renderPreview(workshopPreviewCanvas, robotWorkshop.cosmetics, now * 0.001);
  }

  getActiveRenderer().renderChaosBombs(engine.chaosBombs);
  practiceRoom?.frame(now);
  animationFrame = requestAnimationFrame(animate);
}

function initWorkshopUI(): void {
  if (!workshopOverlay || !workshopHatsGrid || !workshopVisorsRow || !workshopSkinsRow) return;

  const myPlayer = arenaEngine.players[net.localSlotId] || arenaEngine.players[0];
  if (myPlayer) {
    myPlayer.cosmetics = robotWorkshop.cosmetics;
    net.syncEnginesRoster();
  }

  function renderSelectors(): void {
    workshopHatsGrid.innerHTML = '';
    ROBOT_HATS.forEach((h) => {
      const btn = document.createElement('button');
      btn.className = `cosmetic-btn ${robotWorkshop.cosmetics.hat === h.id ? 'active-cosmetic' : ''}`;
      btn.innerHTML = `
        <span class="cosmetic-btn-icon">${h.icon || '🎩'}</span>
        <span class="cosmetic-btn-title">${h.label}</span>
      `;
      btn.addEventListener('click', () => {
        sfx.playCartridgeClick();
        robotWorkshop.saveCosmetics({ hat: h.id });
        renderSelectors();
      });
      workshopHatsGrid.appendChild(btn);
    });

    workshopVisorsRow.innerHTML = '';
    ROBOT_VISORS.forEach((v) => {
      const btn = document.createElement('button');
      btn.className = `visor-pill-btn ${robotWorkshop.cosmetics.visor === v.id ? 'active-cosmetic' : ''}`;
      btn.innerHTML = `
        <span class="visor-color-dot" style="background-color: ${v.color};"></span>
        <span>${v.label}</span>
      `;
      btn.addEventListener('click', () => {
        sfx.playCartridgeClick();
        robotWorkshop.saveCosmetics({ visor: v.id });
        renderSelectors();
      });
      workshopVisorsRow.appendChild(btn);
    });

    workshopSkinsRow.innerHTML = '';
    ROBOT_SKINS.forEach((s) => {
      const btn = document.createElement('button');
      btn.className = `skin-card-btn ${robotWorkshop.cosmetics.skin === s.id ? 'active-cosmetic' : ''}`;
      btn.disabled = !skinIsUnlocked(s.id);
      if (btn.disabled) { btn.classList.add('cosmetic-locked'); btn.title = s.desc ?? 'Completa la hazaña para desbloquear'; }
      btn.innerHTML = `
        <span class="skin-title">${s.label}</span>
        <span class="skin-desc">${s.desc || ''}</span>
      `;
      btn.addEventListener('click', () => {
        sfx.playCartridgeClick();
        robotWorkshop.saveCosmetics({ skin: s.id });
        renderSelectors();
      });
      workshopSkinsRow.appendChild(btn);
    });
  }

  renderSelectors();

  const openWorkshop = () => {
    sfx.unlock();
    sfx.playCartridgeClick();
    renderSelectors();
    workshopOverlay.classList.remove('hidden');
  };

  const closeWorkshop = () => {
    sfx.playCartridgeClick();
    workshopOverlay.classList.add('hidden');
    const p = arenaEngine.players[net.localSlotId] || arenaEngine.players[0];
    if (p) {
      p.cosmetics = robotWorkshop.cosmetics;
      net.syncEnginesRoster();
      if (net.isHost) {
        net.broadcastHostSnapshot(true);
      } else {
        flushImmediateClientAction();
      }
    }
  };

  hubOpenWorkshopBtn?.addEventListener('click', openWorkshop);
  hudWorkshopBtn?.addEventListener('click', openWorkshop);
  closeWorkshopBtn?.addEventListener('click', closeWorkshop);
  applyWorkshopBtn?.addEventListener('click', closeWorkshop);
}

initWorkshopUI();
animationFrame = requestAnimationFrame(animate);

function disposeSession(): void {
  playMode.dispose();
  connectionPanel.dispose();
  arenaEngine.dispose();
  practiceRoom?.dispose();
  if (net.isHost && net.activeGame === 'CHAIN_PANIC' && chainEngine.campaign.active && !chainEngine.campaign.completed) {
    const save = { version: 1, levelIndex: chainEngine.levelIndex, campaign: copyCampaign(chainEngine.campaign) };
    if (validCampaignSave(save)) writeStorage('local', 'tp04_chain_campaign', JSON.stringify(save));
  }
  stopBackgroundPump();
  cancelAnimationFrame(animationFrame);
  net.dispose();
  touchGamepad.dispose();
  bgm.dispose();
  sfx.dispose();
}
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) disposeSession();
});
if (import.meta.hot) import.meta.hot.dispose(disposeSession);
