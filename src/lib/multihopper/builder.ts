import { Connection, Transaction, VersionedTransaction, PublicKey, Keypair } from '@solana/web3.js';
import { MultiHopperClient } from './client';
import { CreateTransferRequest, ConfirmBroadcastRequest, TransferDetails } from './types';

export interface WalletAdapterSigner {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>;
  signAllTransactions?<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]>;
}

export type SignerTarget = WalletAdapterSigner | Keypair;

export class MultiHopperTransactionBuilder {
  constructor(
    private readonly client: MultiHopperClient,
    private readonly connection: Connection
  ) {}

  /**
   * Signs a VersionedTransaction (v0) while preserving server ephemeral signatures.
   */
  async signVersionedTx(base64Tx: string, signer: SignerTarget): Promise<{ serializedBase64: string }> {
    const tx = VersionedTransaction.deserialize(Buffer.from(base64Tx, 'base64'));
    if ('secretKey' in signer) {
      tx.sign([signer]);
    } else {
      await signer.signTransaction(tx);
    }
    return { serializedBase64: Buffer.from(tx.serialize()).toString('base64') };
  }

  /**
   * Signs a legacy Transaction.
   */
  async signLegacyTx(base64Tx: string, signer: SignerTarget): Promise<{ serializedBase64: string }> {
    const tx = Transaction.from(Buffer.from(base64Tx, 'base64'));
    if ('secretKey' in signer) {
      tx.partialSign(signer);
    } else {
      await signer.signTransaction(tx);
    }
    return { serializedBase64: Buffer.from(tx.serialize({ requireAllSignatures: false })).toString('base64') };
  }

  async broadcastAndConfirm(base64Tx: string, label: string): Promise<string> {
    const rawBytes = Buffer.from(base64Tx, 'base64');
    const sig = await this.connection.sendRawTransaction(rawBytes, { skipPreflight: false });
    const latest = await this.connection.getLatestBlockhash('confirmed');
    await this.connection.confirmTransaction(
      {
        signature: sig,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      'confirmed'
    );
    return sig;
  }

  /**
   * Full end-to-end execution implementing MultiHopper's mandatory 2-step broadcast.
   */
  async executeRouteDeployment(
    transferParams: CreateTransferRequest,
    signer: SignerTarget,
    onStage?: (stage: string, sig?: string) => void
  ): Promise<TransferDetails> {
    const transfer = await this.client.createTransfer(transferParams);
    const transferId = transfer.id;
    const collected: ConfirmBroadcastRequest = { routeInitSignatures: [] };

    let attempts = 0;
    while (true) {
      if (attempts++ >= 4) throw new Error('Exceeded prepare attempts due to blockhash expiry.');

      const { preparedTxs } = await this.client.prepareTransfer(transferId);
      if (preparedTxs.resume?.nothingToDo) break;

      // 1. keeperFundingTx MUST be broadcast & confirmed FIRST to avoid double-funding
      if (preparedTxs.keeperFundingTx) {
        onStage?.('keeperFundingTx');
        const { serializedBase64 } = await this.signVersionedTx(preparedTxs.keeperFundingTx, signer);
        const sig = await this.broadcastAndConfirm(serializedBase64, 'keeperFundingTx');
        collected.keeperFundingSignature = sig;

        await this.client.confirmBroadcast(transferId, {
          routeInitSignatures: [],
          keeperFundingSignature: sig,
        });
        onStage?.('keeperFundingTx', sig);
      }

      // 2. routeInitTxs
      if (preparedTxs.routeInitTxs?.length) {
        for (let i = 0; i < preparedTxs.routeInitTxs.length; i++) {
          onStage?.(`routeInitTxs[${i}]`);
          const { serializedBase64 } = await this.signVersionedTx(preparedTxs.routeInitTxs[i].base64, signer);
          const sig = await this.broadcastAndConfirm(serializedBase64, `routeInitTxs[${i}]`);
          collected.routeInitSignatures.push(sig);
          if (i < preparedTxs.routeInitTxs.length - 1) await new Promise((r) => setTimeout(r, 3000));
        }
        await new Promise((r) => setTimeout(r, 3000));
      }

      // 3. orchestratorInitTx (Legacy Tx)
      if (preparedTxs.orchestratorInitTx) {
        onStage?.('orchestratorInitTx');
        const { serializedBase64 } = await this.signLegacyTx(preparedTxs.orchestratorInitTx, signer);
        const sig = await this.broadcastAndConfirm(serializedBase64, 'orchestratorInitTx');
        collected.orchestratorInitSignature = sig;
        await new Promise((r) => setTimeout(r, 3000));
      }

      // 4. sessionInitTxs
      if (preparedTxs.sessionInitTxs?.length) {
        const sessionSigs: string[] = [];
        for (const [i, b64] of preparedTxs.sessionInitTxs.entries()) {
          onStage?.(`sessionInitTxs[${i}]`);
          const { serializedBase64 } = await this.signVersionedTx(b64, signer);
          sessionSigs.push(await this.broadcastAndConfirm(serializedBase64, `sessionInitTxs[${i}]`));
        }
        collected.sessionInitSignatures = sessionSigs;
      }

      // 5. dispersionInitTxs (if multi-destination)
      if (preparedTxs.dispersionInitTxs?.length) {
        const dispSigs: string[] = [];
        for (const [i, b64] of preparedTxs.dispersionInitTxs.entries()) {
          const { serializedBase64 } = await this.signVersionedTx(b64, signer);
          dispSigs.push(await this.broadcastAndConfirm(serializedBase64, `dispersionInitTxs[${i}]`));
        }
        collected.dispersionInitSignatures = dispSigs;
      }

      if (!preparedTxs.resume?.routeAlreadyDeployed) break;
    }

    // Final broadcast confirmation
    onStage?.('confirming');
    await this.client.confirmBroadcast(transferId, collected);
    return this.client.getTransfer(transferId);
  }
}
