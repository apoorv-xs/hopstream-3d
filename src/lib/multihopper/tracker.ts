import { MultiHopperClient } from './client';
import { TransferDetails, TransferStatus, WebhookPayload } from './types';

export interface RouteEventListener {
  onStatusChange?: (status: TransferStatus, details: TransferDetails) => void;
  onHopComplete?: (hopIndex: number, totalHops: number, details: TransferDetails) => void;
  onError?: (error: Error) => void;
  onSettled?: (details: TransferDetails) => void;
}

export class MultiHopperRouteTracker {
  private isPolling = false;
  private timer: any = null;

  constructor(
    private readonly client: MultiHopperClient,
    private readonly transferId: number | string,
    private readonly listeners: RouteEventListener,
    private readonly pollIntervalMs = 3000
  ) {}

  start(): void {
    if (this.isPolling) return;
    this.isPolling = true;

    let previousStatus: TransferStatus | null = null;
    let previousHopsCompleted = -1;

    const poll = async () => {
      if (!this.isPolling) return;
      try {
        const details = await this.client.getTransfer(this.transferId);

        if (details.status !== previousStatus) {
          previousStatus = details.status;
          this.listeners.onStatusChange?.(details.status, details);
        }

        if (details.progress && details.progress.hopsCompleted !== previousHopsCompleted) {
          previousHopsCompleted = details.progress.hopsCompleted;
          this.listeners.onHopComplete?.(
            details.progress.hopsCompleted,
            details.progress.hopsTotal,
            details
          );
        }

        if (['completed', 'failed', 'expired', 'refunded'].includes(details.status)) {
          this.stop();
          this.listeners.onSettled?.(details);
          return;
        }
      } catch (err: any) {
        this.listeners.onError?.(err);
      }

      if (this.isPolling) {
        this.timer = setTimeout(poll, this.pollIntervalMs);
      }
    };

    poll();
  }

  stop(): void {
    this.isPolling = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
