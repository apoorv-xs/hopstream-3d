import {
  MULTIHOPPER_API_BASE,
  MultiHopperEnvironment,
  EstimateFeesRequest,
  EstimateFeesResponse,
  CreateTransferRequest,
  CreateTransferResponse,
  PreparedTransactionsBundle,
  ConfirmBroadcastRequest,
  TransferDetails,
} from './types';

export class MultiHopperApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(`MultiHopper API Error [${code}] (HTTP ${status}): ${message}`);
    this.name = 'MultiHopperApiError';
  }
}

export interface MultiHopperClientConfig {
  apiKey: string;
  environment?: MultiHopperEnvironment;
  customBaseUrl?: string;
  timeoutMs?: number;
}

export class MultiHopperClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(config: MultiHopperClientConfig) {
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? 30000;
    const env = config.environment ?? 'mainnet';
    this.baseUrl =
      config.customBaseUrl?.replace(/\/+$/, '') ??
      (env === 'devnet' ? MULTIHOPPER_API_BASE.DEVNET : MULTIHOPPER_API_BASE.MAINNET);
  }

  private async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'DELETE';
      body?: unknown;
      idempotencyKey?: string;
    } = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
    };

    if (options.method === 'POST') {
      headers['Idempotency-Key'] =
        options.idempotencyKey ||
        (typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        let errJson: any = null;
        try {
          errJson = await response.json();
        } catch {}
        const code = errJson?.code || `MH_HTTP_${response.status}`;
        const message = errJson?.message || response.statusText;
        throw new MultiHopperApiError(code, message, response.status, errJson);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async estimateFees(params: EstimateFeesRequest): Promise<EstimateFeesResponse> {
    return this.request<EstimateFeesResponse>('/transfers/estimate', {
      method: 'POST',
      body: params,
    });
  }

  async createTransfer(params: CreateTransferRequest): Promise<CreateTransferResponse> {
    return this.request<CreateTransferResponse>('/transfers', {
      method: 'POST',
      body: params,
    });
  }

  async prepareTransfer(transferId: number | string): Promise<PreparedTransactionsBundle> {
    return this.request<PreparedTransactionsBundle>(`/transfers/${transferId}/prepare`, {
      method: 'POST',
    });
  }

  async confirmBroadcast(transferId: number | string, body: ConfirmBroadcastRequest): Promise<void> {
    await this.request<void>(`/transfers/${transferId}/confirm-broadcast`, {
      method: 'POST',
      body,
    });
  }

  async getTransfer(transferId: number | string): Promise<TransferDetails> {
    const res = await this.request<{ transfer: TransferDetails } | TransferDetails>(
      `/transfers/${transferId}`
    );
    return (res as any).transfer ?? res;
  }
}
