import type { MultiplayerRoomManager } from '../net/multiplayerRoom';
import type { ConnectionDiagnostic } from '../net/connectionDiagnostics';

export class ConnectionPanel {
  private summary = document.getElementById('connectionPanelSummary')!;
  private links = document.getElementById('connectionPanelLinks')!;
  private status = document.getElementById('connectionPanelStatus')!;
  private refreshButton = document.getElementById('refreshConnectionBtn') as HTMLButtonElement;
  private copyButton = document.getElementById('copyDiagnosticsBtn') as HTMLButtonElement;
  private epoch = '';
  private busy = false;
  private refresh = () => { void this.read(); };
  private copy = () => { void this.copyReport(); };

  constructor(private room: MultiplayerRoomManager) {
    this.refreshButton.addEventListener('click', this.refresh);
    this.copyButton.addEventListener('click', this.copy);
  }

  public sync(): void {
    if (this.epoch !== this.room.roomSessionId) {
      this.epoch = this.room.roomSessionId; this.links.innerHTML = ''; this.status.textContent = '';
      document.getElementById('connectionDiagnosticText')?.remove();
    }
    this.summary.textContent = this.room.networkConfigurationError ? 'La configuración de conexión necesita revisión antes de invitar.' :
      !this.room.isHost && !this.room.isSynchronized ? 'Recuperando conexión con el anfitrión. Puedes volver a comprobar los enlaces.' :
        this.room.isHost && !this.room.hostSignalingReady ? 'La sala se está registrando. Las invitaciones estarán disponibles cuando termine.' :
          this.room.isHost ? 'Mantén activo el dispositivo anfitrión durante la partida. Comprueba los enlaces después de que entren tus amigos.' :
            'Conectado a la sala. Comprueba el enlace para ver el ping y si utiliza un servidor de relevo.';
  }

  private async read(): Promise<ConnectionDiagnostic | null> {
    if (this.busy) return null;
    this.busy = true; this.refreshButton.disabled = this.copyButton.disabled = true;
    this.status.textContent = 'Comprobando los enlaces actuales…';
    const epoch = this.room.roomSessionId;
    try {
      const report = await this.room.getConnectionDiagnostic();
      if (epoch !== this.room.roomSessionId) { this.status.textContent = 'La sala cambió. Vuelve a comprobar sus enlaces.'; return null; }
      this.links.innerHTML = report.links.length ? report.links.map(link => `<div class="connection-link"><strong>${link.slot === 0 ? 'ANFITRIÓN' : `JUGADOR ${link.slot + 1}`}</strong> · ${link.route === 'RELAY' ? 'SERVIDOR DE RELEVO' : link.route === 'DIRECT' ? 'CONEXIÓN DIRECTA' : 'RUTA AÚN SIN CONFIRMAR'} · ${link.rttMs === null ? 'ping sin medir' : `${link.rttMs} ms`} · ${link.open ? 'enlace abierto' : 'reconectando'}</div>`).join('') : '<p>Todavía no hay enlaces con invitados para medir.</p>';
      this.status.textContent = report.configurationError ? 'Revisa la configuración de conexión.' : report.turnConfigured ?
        'Comprobación completada. Hay un servidor de relevo configurado; la ruta de cada enlace indica si se está usando.' :
        'Comprobación completada. Sin servidor de relevo configurado: falta validar el acceso desde redes que lo requieran.';
      return report;
    } catch { this.status.textContent = 'No se pudo comprobar el enlace. Inténtalo de nuevo.'; return null; }
    finally { this.busy = false; this.refreshButton.disabled = this.copyButton.disabled = false; }
  }

  private async copyReport(): Promise<void> {
    const report = await this.read();
    if (!report) return;
    const json = JSON.stringify(report, null, 2);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(json);
      this.status.textContent = 'Diagnóstico copiado. No incluye direcciones de red, nombres de jugadores ni credenciales.';
    } catch {
      let output = document.getElementById('connectionDiagnosticText') as HTMLTextAreaElement | null;
      if (!output) {
        output = document.createElement('textarea'); output.id = 'connectionDiagnosticText'; output.readOnly = true;
        output.setAttribute('aria-label', 'Diagnóstico para copiar'); output.rows = 8; output.style.width = '100%';
        document.getElementById('connectionPanel')!.appendChild(output);
      }
      output.value = json; output.focus(); output.select();
      this.status.textContent = 'Selecciona y copia el diagnóstico. No incluye direcciones de red ni credenciales.';
    }
  }

  public dispose(): void {
    this.refreshButton.removeEventListener('click', this.refresh); this.copyButton.removeEventListener('click', this.copy);
  }
}
