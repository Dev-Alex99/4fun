/**
 * VIRTUAL TOUCH GAMEPAD FOR MOBILE / TOUCH SCREENS
 * - Floating/fixed thumbstick with normalized (moveX, moveY) vectors.
 * - Multi-touch tracking (separate touch IDs for joystick vs buttons).
 * - Tactile action buttons [A] Hit/Parry, [B] Dash/Anchor, [E] Skill.
 * - Haptic pulse feedback (navigator.vibrate).
 * - Zero external dependencies.
 */

export interface TouchGamepadOptions {
  onPressA?: () => void;
  onReleaseA?: () => void;
  onPressB?: () => void;
  onReleaseB?: () => void;
  onPressE?: () => void;
  onReleaseE?: () => void;
}

export class TouchGamepad {
  public moveX = 0;
  public moveY = 0;
  public isHoldingA = false;
  public isHoldingB = false;
  public isHoldingE = false;
  public isTouchDevice = false;
  public enabled = false;

  private joystickZone: HTMLElement | null = null;
  private joystickBase: HTMLElement | null = null;
  private joystickThumb: HTMLElement | null = null;
  private btnA: HTMLElement | null = null;
  private btnB: HTMLElement | null = null;
  private btnE: HTMLElement | null = null;
  private container: HTMLElement | null = null;

  private joystickTouchId: number | null = null;
  private joystickCenter = { x: 0, y: 0 };
  private readonly maxRadius = 45;

  public callbacks: TouchGamepadOptions = {};

  constructor() {
    if (typeof window !== 'undefined') {
      this.isTouchDevice =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        (navigator as unknown as { msMaxTouchPoints?: number }).msMaxTouchPoints! > 0;
      this.enabled = this.isTouchDevice;
    }
  }

  public init(containerId = 'virtualGamepad', options: TouchGamepadOptions = {}): void {
    if (typeof document === 'undefined') return;
    this.callbacks = options;
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.joystickZone = document.getElementById('touchJoystickZone');
    this.joystickBase = document.getElementById('touchJoystickBase');
    this.joystickThumb = document.getElementById('touchJoystickThumb');
    this.btnA = document.getElementById('touchBtnA');
    this.btnB = document.getElementById('touchBtnB');
    this.btnE = document.getElementById('touchBtnE');

    this.bindJoystickEvents();
    this.bindButtonEvents();

    if (this.enabled) {
      this.show();
    } else {
      this.hide();
    }
  }

  public show(): void {
    if (this.container) {
      this.container.classList.remove('hidden');
    }
    this.enabled = true;
  }

  public hide(): void {
    if (this.container) {
      this.container.classList.add('hidden');
    }
    this.enabled = false;
    this.resetJoystick();
  }

  public toggle(): boolean {
    if (this.enabled) {
      this.hide();
    } else {
      this.show();
    }
    return this.enabled;
  }

  public triggerHaptic(durationMs = 12): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(durationMs);
      } catch {
        // Ignore audio/haptic security context limitations
      }
    }
  }

  private resetJoystick(): void {
    this.moveX = 0;
    this.moveY = 0;
    this.joystickTouchId = null;
    if (this.joystickThumb) {
      this.joystickThumb.style.transform = `translate(0px, 0px)`;
    }
  }

  private bindJoystickEvents(): void {
    if (!this.joystickZone || !this.joystickBase) return;

    const handleStart = (e: TouchEvent) => {
      e.preventDefault();
      if (this.joystickTouchId !== null) return;

      const touch = e.changedTouches[0];
      if (!touch || !this.joystickBase) return;

      this.joystickTouchId = touch.identifier;
      const rect = this.joystickBase.getBoundingClientRect();
      this.joystickCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };

      this.updateJoystickPosition(touch.clientX, touch.clientY);
      this.triggerHaptic(8);
    };

    const handleMove = (e: TouchEvent) => {
      e.preventDefault();
      if (this.joystickTouchId === null) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch && touch.identifier === this.joystickTouchId) {
          this.updateJoystickPosition(touch.clientX, touch.clientY);
          break;
        }
      }
    };

    const handleEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (this.joystickTouchId === null) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch && touch.identifier === this.joystickTouchId) {
          this.resetJoystick();
          break;
        }
      }
    };

    this.joystickZone.addEventListener('touchstart', handleStart, { passive: false });
    this.joystickZone.addEventListener('touchmove', handleMove, { passive: false });
    this.joystickZone.addEventListener('touchend', handleEnd, { passive: false });
    this.joystickZone.addEventListener('touchcancel', handleEnd, { passive: false });
  }

  private updateJoystickPosition(clientX: number, clientY: number): void {
    const dx = clientX - this.joystickCenter.x;
    const dy = clientY - this.joystickCenter.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 1) {
      this.moveX = 0;
      this.moveY = 0;
      if (this.joystickThumb) this.joystickThumb.style.transform = `translate(0px, 0px)`;
      return;
    }

    const clampedDist = Math.min(dist, this.maxRadius);
    const angle = Math.atan2(dy, dx);
    const thumbX = Math.cos(angle) * clampedDist;
    const thumbY = Math.sin(angle) * clampedDist;

    if (this.joystickThumb) {
      this.joystickThumb.style.transform = `translate(${thumbX.toFixed(1)}px, ${thumbY.toFixed(1)}px)`;
    }

    // Normalized move vector (-1 to 1) with slight deadzone
    const norm = clampedDist / this.maxRadius;
    if (norm < 0.12) {
      this.moveX = 0;
      this.moveY = 0;
    } else {
      this.moveX = Number((Math.cos(angle) * norm).toFixed(3));
      this.moveY = Number((Math.sin(angle) * norm).toFixed(3));
    }
  }

  private bindButtonEvents(): void {
    const bindBtn = (
      btn: HTMLElement | null,
      onPress?: () => void,
      onRelease?: () => void,
      holdingProp?: 'isHoldingA' | 'isHoldingB' | 'isHoldingE'
    ) => {
      if (!btn) return;

      const handlePress = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.add('touch-btn-pressed');
        if (holdingProp) this[holdingProp] = true;
        this.triggerHaptic(14);
        onPress?.();
      };

      const handleRelease = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.remove('touch-btn-pressed');
        if (holdingProp) this[holdingProp] = false;
        onRelease?.();
      };

      btn.addEventListener('touchstart', handlePress, { passive: false });
      btn.addEventListener('touchend', handleRelease, { passive: false });
      btn.addEventListener('touchcancel', handleRelease, { passive: false });
      btn.addEventListener('pointerdown', handlePress);
      btn.addEventListener('pointerup', handleRelease);
      btn.addEventListener('pointercancel', handleRelease);
    };

    bindBtn(this.btnA, () => this.callbacks.onPressA?.(), () => this.callbacks.onReleaseA?.(), 'isHoldingA');
    bindBtn(this.btnB, () => this.callbacks.onPressB?.(), () => this.callbacks.onReleaseB?.(), 'isHoldingB');
    bindBtn(this.btnE, () => this.callbacks.onPressE?.(), () => this.callbacks.onReleaseE?.(), 'isHoldingE');
  }
}

export const touchGamepad = new TouchGamepad();
