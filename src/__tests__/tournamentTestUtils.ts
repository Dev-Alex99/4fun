import { TournamentManager } from '../game/tournamentManager';

/** Complete the actual roulette, human confirmation and shared countdown before simulating results. */
export function readyTournamentRound(tournament: TournamentManager): void {
  if (tournament.state.rouletteSpinning) tournament.step(2.3, () => {});
  for (const slot of tournament.state.requiredSlots) tournament.markReady(slot, tournament.state.preparationId);
  tournament.step(3.01, () => {});
}
