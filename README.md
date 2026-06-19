# Tala Vault

Tala Vault is a non-custodial micro-savings platform that brings the Filipino culture of pag-iipon into Web3, enabling users to securely save USDC in smart vaults for financial goals while protecting their money from inflation, currency depreciation, and costly banking barriers.

## Problem
Millions of Filipinos remain underserved by traditional financial institutions, with over 40% of adults still lacking formal bank accounts due to strict documentary requirements, high minimum balance thresholds, and ongoing account maintenance fees. At the same time, those who do save in cash or standard Philippine Peso (PHP) accounts face the gradual erosion of their purchasing power from inflation and the peso's depreciation against the US dollar. Digital wallets have improved access to financial services, but their convenience often encourages impulse spending, making it difficult for users to build long-term savings habits. Tala Vault addresses these challenges by providing a simple and accessible way for anyone with a mobile phone and internet connection to securely save in USD-backed stablecoins while using programmable features such as time-locks and savings milestones to encourage financial discipline and help users preserve and grow their wealth over time.

## How It Works
[The core user flow, in plain language. What does a user actually do?]

## How It Uses Stellar
Tala Vault leverages the Stellar ecosystem for its low costs, high speed, and native asset-handling capabilities:
-  Soroban Smart Contracts (Rust): Handles the core logic of the savings vaults. The contract safely manages deposit, withdraw, and internal accounting for balances using persistent storage keys (like your DataKey::Balance(Address) setup). It can also enforce time-locks or penalty rules for breaking a savings goal early.
- Stellar Asset Sandbox / Anchor Network: Uses standard USDC on Stellar to ensure stability, predictable value, and fractional micro-deposits without being eaten alive by gas fees.
- Stellar Wallets & Passkeys (Frontend): Integrates via Stellar Wallet Connect (supporting wallets like Freighter or embedded passkey wallets) to provide a seamless Web2-like login experience for the user.
- Stellar Logging Engine (log!): Emits secure, on-chain events whenever a milestone or deposit is hit, feeding your frontend dashboard real-time celebratory animations and updates.

## Track
[Which StellarX Philippines track this is submitted to]

## Tech Stack
- Framework: [Next.js / React / SvelteKit / ...]
- Stellar SDK: @stellar/stellar-sdk v[version]
- Network: [testnet / mainnet]
- [other key dependencies]

## Setup & Run
[Step-by-step. A judge must be able to run this from these instructions alone.]

\`\`\`bash
git clone [your repo]
cd [your project]
npm install
# environment variables needed:
#   NEXT_PUBLIC_SOROBAN_RPC=...
#   ...
npm run dev
\`\`\`

## Network Details
- Network: [testnet / mainnet]
- RPC URL: [endpoint]
- Contract IDs: [if any]
- Asset issuers: [if any]

## Team
- [Name] — @[github-username]
- ...

## License
[MIT / Apache-2.0 / ...]
