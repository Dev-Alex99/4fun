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

type HoldingButton = 'isHoldingA' | 'isHoldingB' | 'isHoldingE';

export class TouchGamepad {
  public moveX = 0;
  public moveY = 0;
  public isHoldingA = false;
  public isHoldingB = false;
  public isHoldingE = false;
  public isTouchDevice = false;
  public enabled = false;
  public callbacks: TouchGamepadOptions = {};

  private joystickZone: HTMLElement | null = null;
  private joystickBase: HTMLElement | null = null;
  private joystickThumb: HTMLElement | null = null;
  private container: HTMLElement | null = null;
  private joystickPointerId: number | null = null;
  private joystickCenter = { x: 0, y: 0 };
  private readonly maxRadius = 45;
  private readonly cleanup: Array<() => void> = [];
  private readonly buttons = new Map<HoldingButton, { element: HTMLElement; pointerId: number | null; release: () => void }>();

  constructor() {
    if (typeof window !== 'undefined') {
      this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      this.enabled = this.isTouchDevice;
    }
  }

  public init(containerId = 'virtualGamepad', options: TouchGamepadOptions = {}): void {
    if (typeof document === 'undefined') return;
    const enabled = this.enabled;
    this.dispose();
    this.callbacks = options;
    this.container = document.getElementById(containerId);
    if (!this.container) return;
    this.joystickZone = this.container.querySelector('#touchJoystickZone');
    this.joystickBase = this.container.querySelector('#touchJoystickBase');
    this.joystickThumb = this.container.querySelector('#touchJoystickThumb');
    this.bindJoystickEvents();
    this.bindButton('touchBtnA', 'isHoldingA', () => this.callbacks.onPressA?.(), () => this.callbacks.onReleaseA?.());
    this.bindButton('touchBtnB', 'isHoldingB', () => this.callbacks.onPressB?.(), () => this.callbacks.onReleaseB?.());
    this.bindButton('touchBtnE', 'isHoldingE', () => this.callbacks.onPressE?.(), () => this.callbacks.onReleaseE?.());
    this.listen(window, 'blur', () => this.releaseAll());
    this.listen(document, 'visibilitychange', () => { if (document.hidden) this.releaseAll(); });
    if (enabled) this.show(); else this.hide();
  }

  public show(): void {
    this.container?.classList.remove('hidden');
    this.enabled = true;
  }

  public hide(): void {
    this.container?.classList.add('hidden');
    this.enabled = false;
    this.releaseAll();
  }

  public dispose(): void {
    this.hide();
    for (const remove of this.cleanup.splice(0)) remove();
    this.buttons.clear();
    this.callbacks = {};
    this.container = this.joystickZone = this.joystickBase = this.joystickThumb = null;
  }

  public toggle(): boolean {
    if (this.enabled) this.hide(); else this.show();
    return this.enabled;
  }

  public triggerHaptic(durationMs = 12): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(durationMs); } catch { /* Optional browser capability. */ }
    }
  }

  private listen(target: EventTarget, type: string, listener: (event: PointerEvent) => void): void {
    const handler = listener as EventListener;
    target.addEventListener(type, handler, { passive: false });
    this.cleanup.push(() => target.removeEventListener(type, handler));
  }

  private capture(element: HTMLElement, pointerId: number): void {
    try { element.setPointerCapture?.(pointerId); } catch { /* Pointer may already have ended. */ }
  }

  private releaseCapture(element: HTMLElement | null, pointerId: number | null): void {
    if (pointerId === null) return;
    try { element?.releasePointerCapture?.(pointerId); } catch { /* Capture may already be lost. */ }
  }

  private resetJoystick(): void {
    const pointerId = this.joystickPointerId;
    this.joystickPointerId = null;
    this.moveX = this.moveY = 0;
    if (this.joystickThumb) this.joystickThumb.style.transform = 'translate(0px, 0px)';
    this.releaseCapture(this.joystickZone, pointerId);
  }

  private releaseButton(prop: HoldingButton): void {
    const button = this.buttons.get(prop);
    const pointerId = button?.pointerId ?? null;
    if (button) button.pointerId = null;
    const wasHolding = this[prop];
    this[prop] = false;
    button?.element.classList.remove('touch-btn-pressed');
    this.releaseCapture(button?.element ?? null, pointerId);
    if (wasHolding) button?.release();
  }

  private releaseAll(): void {
    this.resetJoystick();
    this.releaseButton('isHoldingA');
    this.releaseButton('isHoldingB');
    this.releaseButton('isHoldingE');
  }

  private preparePointerSurface(element: HTMLElement): void {
    const oldTouchAction = element.style.touchAction;
    element.style.touchAction = 'none';
    this.cleanup.push(() => { element.style.touchAction = oldTouchAction; });
  }

  private bindJoystickEvents(): void {
    const zone = this.joystickZone;
    if (!zone || !this.joystickBase) return;
    this.preparePointerSurface(zone);
    this.listen(zone, 'pointerdown', (event) => {
      if (!this.enabled || this.joystickPointerId !== null || event.button > 0) return;
      event.preventDefault();
      this.joystickPointerId = event.pointerId;
      const rect = this.joystickBase!.getBoundingClientRect();
      this.joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      this.capture(zone, event.pointerId);
      this.updateJoystickPosition(event.clientX, event.clientY);
      this.triggerHaptic(8);
    });
    this.listen(window, 'pointermove', (event) => {
      if (!this.enabled || event.pointerId !== this.joystickPointerId) return;
      event.preventDefault();
      this.updateJoystickPosition(event.clientX, event.clientY);
    });
    const end = (event: PointerEvent) => {
      if (event.pointerId === this.joystickPointerId) this.resetJoystick();
    };
    this.listen(window, 'pointerup', end);
    this.listen(window, 'pointercancel', end);
    this.listen(zone, 'lostpointercapture', end);
  }

  private bindButton(id: string, prop: HoldingButton, press: () => void, release: () => void): void {
    const element = this.container?.querySelector<HTMLElement>('#' + id);
    if (!element) return;
    const button = { element, pointerId: null as number | null, release };
    this.buttons.set(prop, button);
    this.preparePointerSurface(element);
    this.listen(element, 'pointerdown', (event) => {
      if (!this.enabled || this[prop] || event.button > 0) return;
      event.preventDefault();
      event.stopPropagation();
      button.pointerId = event.pointerId;
      this[prop] = true;
      element.classList.add('touch-btn-pressed');
      this.capture(element, event.pointerId);
      this.triggerHaptic(14);
      press();
    });
    const end = (event: PointerEvent) => {
      if (event.pointerId === button.pointerId) this.releaseButton(prop);
    };
    this.listen(window, 'pointerup', end);
    this.listen(window, 'pointercancel', end);
    this.listen(element, 'lostpointercapture', end);
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

}

export const touchGamepad = new TouchGamepad();
