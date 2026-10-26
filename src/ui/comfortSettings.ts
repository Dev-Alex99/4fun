import { playPreferences, savePreferences } from '../game/playPreferences';
import { sfx } from '../audio/mechanicalSfx';
import { bgm } from '../audio/chiptuneBgm';

export class ComfortSettings {
  constructor() {
    const effects = document.getElementById('effectsVolumeInput') as HTMLInputElement;
    const music = document.getElementById('musicVolumeInput') as HTMLInputElement;
    const motion = document.getElementById('reducedMotionInput') as HTMLInputElement;
    const flashes = document.getElementById('reducedFlashesInput') as HTMLInputElement;
    const scale = document.getElementById('controlScaleInput') as HTMLSelectElement;
    effects.value = String(playPreferences.effectsVolume); music.value = String(playPreferences.musicVolume);
    motion.checked = playPreferences.reducedMotion; flashes.checked = playPreferences.reducedFlashes; scale.value = String(playPreferences.controlScale);
    const apply = () => {
      savePreferences({ effectsVolume: Number(effects.value), musicVolume: Number(music.value),
        reducedMotion: motion.checked, reducedFlashes: flashes.checked, controlScale: Number(scale.value) });
      sfx.setVolume(playPreferences.effectsVolume / 100); bgm.setVolume(playPreferences.musicVolume / 100 * 0.36);
      document.documentElement.style.setProperty('--control-scale', String(playPreferences.controlScale));
      document.documentElement.style.setProperty('--touch-reserve', `${Math.ceil(184 * playPreferences.controlScale)}px`);
      document.body.classList.toggle('reduced-motion', playPreferences.reducedMotion);
      document.getElementById('effectsVolumeValue')!.textContent = `${playPreferences.effectsVolume}%`;
      document.getElementById('musicVolumeValue')!.textContent = `${playPreferences.musicVolume}%`;
    };
    for (const element of [effects, music, motion, flashes, scale]) element.addEventListener('input', apply);
    apply();
  }
}
