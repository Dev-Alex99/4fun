import { describe, expect, it } from 'vitest';
import { ChainPanicEngine, CHAIN_CAMPAIGN_SECTORS, CHAIN_LEVELS } from '../game/chainPanicEngine';
import { campaignMedal, copyCampaign, validCampaignSave } from '../game/chainCampaign';
import { validAction } from '../net/protocol';
import type { ClientInputPacket } from '../types';

const idle: ClientInputPacket = { slotId: 0, name: 'ALEX', moveX: 0, moveY: 0, aimAngle: 0,
  parryPressed: false, chargingParry: false, dashPressed: false, emotePressed: 0, clientBallDist: 999 };

describe('CHAIN-PANIC expedition', () => {
  it('connects all six sectors and finishes once instead of looping back to the beginning', () => {
    const engine = new ChainPanicEngine();
    engine.players.forEach(p => { p.isBot = false; });
    engine.startCampaign();
    for (let sector = 0; sector < CHAIN_CAMPAIGN_SECTORS; sector++) {
      expect(engine.levelIndex).toBe(sector);
      const goal = engine.getCurrentLevelDef().goalRect;
      engine.players.forEach((p, i) => { p.x = goal.x + 45 + i * 20; p.y = goal.y + 70; p.vx = p.vy = 0; });
      if (engine.battery) { engine.battery.x = goal.x + 100; engine.battery.y = goal.y + 140; }
      engine.step(0.05, idle);
      expect(engine.campaign.sectorTimes).toHaveLength(sector + 1);
      if (sector < 5) engine.step(2, idle);
    }
    expect(engine.status).toBe('CAMPAIGN_COMPLETE');
    expect(engine.campaign.completed).toBe(true);
    const elapsed = engine.campaign.elapsedSeconds;
    engine.step(100, idle);
    expect(engine.levelIndex).toBe(5);
    expect(engine.campaign.elapsedSeconds).toBe(elapsed);
    expect(engine.completions).toBe(6);
  });

  it('restores the unlocked bridge checkpoint and cargo, and keeps the cost of retries', () => {
    const engine = new ChainPanicEngine();
    engine.startCampaign();
    engine.levelIndex = 2;
    engine.campaign.sectorTimes = [60, 90];
    engine.campaign.checkpointUnlocked = true;
    engine.campaign.elapsedSeconds = 180;
    engine.campaign.sectorSeconds = 30;
    engine.retryCampaignSector();
    expect(engine.doorOpen).toBe(true);
    expect(engine.players.every(p => p.x >= 700)).toBe(true);
    expect(engine.battery!.x).toBe(760);
    expect(engine.campaign.sectorWipes[2]).toBe(1);
    expect(engine.campaign.sectorSeconds).toBe(30);
    const save = { version: 1 as const, levelIndex: 2, campaign: copyCampaign(engine.campaign) };
    expect(validCampaignSave(save)).toBe(true);
    const resumed = new ChainPanicEngine(); resumed.startCampaign(save);
    expect(resumed.levelIndex).toBe(2);
    expect(resumed.doorOpen).toBe(true);
    expect(resumed.campaign.elapsedSeconds).toBe(180);
    save.campaign.rescues[0] = 99;
    expect(resumed.campaign.rescues[0]).toBe(0);
  });

  it('rescues across empty slots and credits only a confirmed return to supported ground', () => {
    const engine = new ChainPanicEngine(); engine.botsEnabled = false;
    engine.players[2].isBot = false; engine.startCampaign();
    const rescuer = engine.players[0], victim = engine.players[2];
    Object.assign(rescuer, { x: 160, y: 260 });
    Object.assign(victim, { x: 210, y: 260, isDangling: true });
    engine.triggerCableYank(rescuer);
    expect(victim.vx).toBeLessThan(0);
    expect(engine.campaign.rescues[0]).toBe(0);
    engine.step(0.01, idle);
    expect(engine.campaign.rescues[0]).toBe(1);
    engine.step(0.01, idle);
    expect(engine.campaign.rescues[0]).toBe(1);
    const client = new ChainPanicEngine(); client.applySnapshot(engine.getSnapshot());
    expect(client.campaign.rescues[0]).toBe(1);
  });

  it('rejects corrupt saves and calculates explicit medal thresholds', () => {
    const engine = new ChainPanicEngine(); engine.startCampaign();
    const save = { version: 1, levelIndex: 0, campaign: copyCampaign(engine.campaign) };
    expect(validAction({ kind: 'START_CAMPAIGN', campaignSave: save })).toBe(true);
    for (const patch of [{ levelIndex: -1 }, { levelIndex: 6 }, { campaign: { ...save.campaign, rescues: [1] } },
      { campaign: { ...save.campaign, sectorTimes: [NaN] } }, { campaign: { ...save.campaign, sectorWipes: [-1, 0, 0, 0, 0, 0] } }]) {
      expect(validCampaignSave({ ...save, ...patch })).toBe(false);
    }
    expect(campaignMedal(150, 0)).toBe('ORO');
    expect(campaignMedal(200, 2)).toBe('PLATA');
    expect(campaignMedal(241, 0)).toBe('BRONCE');
  });
});
