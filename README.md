# STELLA Vault (Soroban Transparent Escrow Ledger for Localized Assets)
STELLA Vault disrupts the over-saturated pool of generic digital lockboxes by transforming traditional Filipino paluwagan savings circles and remittance streams into a permissionless, No-KYC collaborative vault protocol built on Soroban smart contracts that instantly pegs micro-savings to stable USD assets.

## Problem
STELLA Vault addresses three critical financial challenges faced by many Filipinos. First, the identity document gap excludes over 40% of Filipino adults from accessing formal financial services due to the lack of government-issued IDs, proof of income, or the ability to maintain minimum account balances. STELLA Vault eliminates these bureaucratic barriers through a friction-free, No-KYC smart contract onboarding layer, making financial participation more accessible. Second, the erosion of purchasing power caused by inflation and domestic currency depreciation places micro-savers at significant financial risk when their funds are stored in cash or low-yield PHP accounts. To help preserve wealth, STELLA Vault democratizes access to stable USD-denominated reserve assets such as USDC. Finally, existing DeFi solutions are often complex, isolated, and designed for individual users, making them inaccessible and culturally disconnected from the needs of many communities. STELLA Vault reimagines decentralized savings infrastructure by providing a collaborative, culturally native framework that supports destination-based family remittances and collective community saving.

## How It Works
Users can create personal or community-driven "smart vaults" to lock away stablecoins (like USDC) for specific life goals—such as emergency funds, tuition fees, or entrepreneurial capital—without worrying about inflation eroding their local currency or high traditional banking fees.

> **Note on auth vs. KYC:** the app's JWT-based session layer and PIN-unlock flow authenticate a user's *wallet session* (so their signing key stays protected client-side) — they are not identity verification. No government ID or personal identity data is collected or required to create or use a vault; KYC only enters the picture at the off-ramp (see below).

## How It Uses Stellar
- Soroban Smart Contracts (Rust): Powers the core collaborative and individual vault parameters. The contracts safely manage multi-user states, cryptographic asset locking, and deposit/withdrawal logic without requiring centralized ledgers.
- Stellar Asset Contract (SAC): Utilizes native USDC on Stellar out of the box to guarantee hyper-low transaction fees, lightning-fast settlement, and immediate exposure to stable USD values.
- Stellar Compliance & Anchor Architecture (SEP-24/SEP-6): Keeps the contract layer purely permissionless and No-KYC at entry, while shifting regulatory compliance entirely to the edge. Users interact freely on-chain in USD, but complete standard KYC checks only when interacting with regulated local off-ramps (like PeraHub or Coins.ph) to cash out into physical Philippine Peso (PHP) fiat.


## Track
Track 2: Financial Inclusion & Everyday Payments (Secondary alignment with Track 3: DeFi, Stablecoins & Real-World Assets)

## Tech Stack
- Framework: Next.js 16 (App Router) / React 19 / TypeScript 5
- Stellar SDK: @stellar/stellar-sdk v16.0.1
- Network: Testnet
- Wallet: @stellar/freighter-api v6.0.1
- Database/ORM: Prisma 7.8.0 with @prisma/adapter-neon, on Neon serverless Postgres (@neondatabase/serverless v1.1.0)
- Auth: jsonwebtoken v9.0.3 (JWT-based session auth)
- Styling: Tailwind CSS v4 (@tailwindcss/postcss)
- Icons: lucide-react v1.23.0
- QR: qrcode v1.5.4 (generate) / jsqr v1.4.0 (scan)

## Setup & Run

### Prerequisites
- Node.js 20+
- A Neon Postgres database (or any Postgres instance Prisma can reach)
- [Freighter wallet](https://www.freighter.app/) browser extension, for connecting a Stellar account in dev
- A deployed Soroban savings/vault contract (or access to one) if you're testing on-chain features

### 1. Install dependencies
```bash
npm install
```
`postinstall` runs `prisma generate` automatically.

### 2. Configure environment variables
Create a `.env` file in the project root. At minimum you'll need:
```bash
DATABASE_URL=            # Neon Postgres connection string
JWT_SECRET=               # secret for signing session JWTs
NEXT_PUBLIC_STELLAR_NETWORK=   # testnet | mainnet (confirm actual var name in your config)
NEXT_PUBLIC_SOROBAN_RPC_URL=   # Soroban RPC endpoint for your chosen network
NEXT_PUBLIC_SAVINGS_CONTRACT_ID=   # deployed contract address
```

### 3. Set up the database
```bash
npx prisma migrate dev      # apply migrations locally
# or
npx prisma db push          # push schema without migration history
```

### 4. Run the dev server
```bash
npm run dev
```
App runs at `http://localhost:3000`.

### 5. Connect a wallet
Install the Freighter extension, create/import a testnet account, and fund it via [Friendbot](https://friendbot.stellar.org) if you're on testnet.

### Build & production
```bash
npm run build   # runs `prisma generate` then `next build`
npm run start
```

### Lint
```bash
npm run lint
```

## Network Details
- Network: testnet
- RPC URL: `https://soroban-testnet.stellar.org` <!-- update if using a dedicated/private RPC provider -->
- Contract IDs:
  - Savings/Vault contract: `TODO — fill in after deployment (C... address)`
- Asset issuers:
  - USDC: `TODO — fill in issuer G... address (or note if using a testnet mock token)`

## Team


## License
Proprietary — All Rights Reserved. Unauthorized copying, distribution, or use of this software, in whole or in part, is strictly prohibited without prior written permission.