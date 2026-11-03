# HopStream 3D // Solana Token-2022 Programmable Multi-Hop Route Terminal

> **Official Entry for the Superteam MultiHopper Build & Route Challenge ($5,000–$50,000 USDC)**  
> **Engineered by the C-137 Syndicate Foundry (`@apoorv-xs`)**

---

## 1. Executive Summary

**HopStream 3D** is an autonomous route architect and real-time 3D topology terminal built on top of **MultiHopper**—Solana's next-generation programmable asset-routing protocol ("SWIFT 2.0" for Web3). 

While traditional crypto payment tools treat transfers as a single, static point-to-point transaction, HopStream 3D enables DAOs, payroll treasuries, and autonomous AI agents to construct, simulate, and deploy **scheduled, sequenced, multi-hop distributions** utilizing Solana's **Token-2022 standard extensions** (*Permanent Delegate* + *Transfer Hook Guard*).

---

## 2. Core Architectural Pillars

### A. Real-Time 60 FPS 3D Topology Viewport
- Built using **Three.js (WebGL)** with ACES Filmic Tone Mapping and clamped Device Pixel Ratio (DPR 2.0).
- Dynamically generates interactive 3D Bezier splines and additive particle flows representing the live hop path:
  - **Origin**: Connected Phantom Wallet.
  - **Escrow Vault**: MultiHopper Core PDA (`3jLoS2wb...pFh`).
  - **Wrapper Minter**: Token-2022 ephemeral mint backed 1:1.
  - **Keepers Relay**: Sequenced intermediate hops with configurable time-locks.
  - **Terminal Settlement**: Multi-destination dispersion accounts (e.g. Treasury 60%, Contributor 40%).

### B. Production-Grade MultiHopper TypeScript SDK (`src/lib/multihopper/`)
- **`types.ts`**: Comprehensive protocol typing, fee tiers, and state machines.
- **`client.ts`**: HTTP client with automatic UUIDv4 idempotency keys, timeout abort controllers, and error classification.
- **`builder.ts`**: Implements the strict **2-Step Broadcast Pipeline**:
  1. `keeperFundingTx` (Versioned Tx v0) is signed, broadcast, and confirmed first to avoid keeper double-funding.
  2. `routeInitTxs`, `orchestratorInitTx` (Legacy), `sessionInitTxs`, and `dispersionInitTxs` are sequentially dispatched with blockhash health checks.
- **`tracker.ts`**: Real-time lifecycle polling and HMAC-SHA256 webhook signature verification.

### C. Natural Language / AI Agent Dispatcher
- Provides an integrated command bar allowing natural language route creation:  
  *e.g. "Split 500 USDC into 3 hops with 15s delays to Treasury and Contributor"*
- Automatically parses parameters, adjusts the slider controls, and renders the updated Bezier topology graph in real time.

---

## 3. Protocol Program IDs (Verified On-Chain)

| Program | Public Key | Role |
| :--- | :--- | :--- |
| **MultiHopper Core** | `3jLoS2wbNgtKzieUUxwg6Xhdv6gbZkHDtPWA9ZAgspFh` | Escrow custody, wrap/unwrap, hop execution |
| **Orchestrator** | `4TPCmR2uN3hDM1FbTsf7ZtFXwXGSz4u1Kxv5YHj6eruX` | Keeper step sequencing & rent reclamation |
| **Transfer Hook Guard**| `2JEv3pD6nczEvn1xDXaEzehkJofPPjoQQpnW5nGY3r52` | Token-2022 transfer verification & policy rules |

---

## 4. Quickstart & Local Execution

HopStream 3D is designed with zero-bloat modern ES Modules:

```bash
# 1. Clone repository
git clone https://github.com/apoorv-xs/hopstream-3d.git
cd hopstream-3d

# 2. Launch 60 FPS viewport
python -m http.server 3000

# 3. Open in browser
http://localhost:3000
```

---

## 5. Hackathon Verification Checklist
- [x] Full integration with MultiHopper Core, Orchestrator, and Transfer Hook Guard programs.
- [x] Token-2022 1:1 wrapper lifecycle implemented.
- [x] Multi-hop route configuration (1–5 hops) with dynamic Bezier topology canvas.
- [x] Phantom Wallet integration via `@solana/web3.js`.
- [x] Rigorous 2-step broadcast builder handling Versioned v0 and Legacy transactions.
- [x] Zero-latency 60 FPS graphics with built-in memory disposal patterns.
