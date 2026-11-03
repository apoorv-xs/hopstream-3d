export const MULTIHOPPER_PROGRAM_IDS = {
  CORE: '3jLoS2wbNgtKzieUUxwg6Xhdv6gbZkHDtPWA9ZAgspFh',
  ORCHESTRATOR: '4TPCmR2uN3hDM1FbTsf7ZtFXwXGSz4u1Kxv5YHj6eruX',
  TRANSFER_HOOK_GUARD: '2JEv3pD6nczEvn1xDXaEzehkJofPPjoQQpnW5nGY3r52',
} as const;

export const MULTIHOPPER_API_BASE = {
  MAINNET: 'https://multihopper.com/api/v1',
  DEVNET: 'https://devnet.multihopper.com/api/v1',
} as const;

export type MultiHopperEnvironment = 'mainnet' | 'devnet';

export type TransferStatus =
  | 'quote'
  | 'awaiting_signature'
  | 'processing'
  | 'active'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'refunded';

export type TransferPhase =
  | 'quoted'
  | 'deploying'
  | 'executing'
  | 'settled'
  | 'failed'
  | 'recoverable'
  | 'rescued'
  | 'reclaimed'
  | 'expired';

export interface MultiHopperDestination {
  wallet: string;
  amountRaw: string;
  status?: 'pending' | 'paid';
  payoutSignature?: string | null;
  paidAt?: string | null;
}

export interface EstimateFeesRequest {
  tokenMint: string;
  amountRaw: string;
  tokenDecimals?: number;
  hops?: number;
  destinationCount?: number;
  arrivalSeconds?: number;
}

export interface EstimateFeesResponse {
  tier: string;
  percentFeeRaw: string;
  totalFlatFeeLamports: string;
  hopAmountRaw: string;
  integratorPercentShare: string;
  integratorFlatShare: string;
  priceSource: 'onchain_pool' | 'coingecko' | 'fallback';
  sol: {
    requiredSolUpFrontLamports: string;
    breakdown?: {
      rentLamports: string;
      keeperLamports: string;
      dispersionRentLamports?: string;
      screeningFeeLamports?: string;
    };
  };
}

export interface CreateTransferRequest {
  tokenMint: string;
  amountRaw: string;
  amountTokens: string;
  sourceOwner: string;
  recipientWallet?: string;
  destinations?: Array<{ wallet: string; amountRaw: string }>;
  hops?: number;
  arrivalSeconds?: number;
  tokenDecimals?: number;
  tokenSymbol?: string;
  tokenPriceUsd?: number;
  externalId?: string;
}

export interface CreateTransferResponse {
  id: number | string;
  status: TransferStatus;
  recipientReceivesRaw?: string;
  destinations?: MultiHopperDestination[];
  createdAt: string;
  expiresAt: string;
}

export interface PreparedTransactionsBundle {
  transfer: Record<string, unknown>;
  preparedTxs: {
    routeInitTxs?: Array<{ base64: string }> | null;
    orchestratorInitTx?: string | null;
    sessionInitTxs?: string[] | null;
    keeperFundingTx?: string | null;
    dispersionInitTxs?: string[] | null;
    recentBlockhash?: string;
    lastValidBlockHeight?: number;
    resume?: {
      nothingToDo?: boolean;
      routeAlreadyDeployed?: boolean;
      dispersion?: number;
    };
  };
}

export interface ConfirmBroadcastRequest {
  routeInitSignatures: string[];
  orchestratorInitSignature?: string;
  sessionInitSignatures?: string[];
  keeperFundingSignature?: string;
  dispersionInitSignatures?: string[];
}

export interface TransferProgress {
  hopsCompleted: number;
  hopsTotal: number;
  currentHopIndex: number;
  currentHopWallet?: string;
  estimatedArrival?: string;
}

export interface TransferDetails {
  id: number | string;
  status: TransferStatus;
  phase: TransferPhase;
  sourceOwner: string;
  tokenMint: string;
  amountRaw: string;
  amountTokens: string;
  progress: TransferProgress;
  recipientWallet?: string;
  destinations?: MultiHopperDestination[];
  lastError?: { code: string; message: string } | null;
  recovery?: { recoverableLamports: string; reason: string } | null;
  createdAt: string;
  updatedAt: string;
}

export type WebhookEventType =
  | 'transfer.created'
  | 'transfer.processing'
  | 'transfer.active'
  | 'transfer.hop_completed'
  | 'transfer.completed'
  | 'transfer.failed'
  | 'transfer.refunded';

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: {
    transferId: number | string;
    status: TransferStatus;
    phase: TransferPhase;
    progress: TransferProgress;
    payoutSignatures?: string[];
    error?: string;
  };
}
