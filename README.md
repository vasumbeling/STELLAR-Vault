# STELLA Vault (Soroban Transparent Escrow Ledger for Localized Assets)
STELLA Vault disrupts the over-saturated pool of generic digital lockboxes by transforming traditional Filipino paluwagan savings circles and remittance streams into a permissionless, No-KYC collaborative vault protocol built on Soroban smart contracts that instantly pegs micro-savings to stable USD assets.

## Problem
STELLA Vault addresses three critical financial challenges faced by many Filipinos. First, the identity document gap excludes over 40% of Filipino adults from accessing formal financial services due to the lack of government-issued IDs, proof of income, or the ability to maintain minimum account balances. STELLA Vault eliminates these bureaucratic barriers through a friction-free, No-KYC smart contract onboarding layer, making financial participation more accessible. Second, the erosion of purchasing power caused by inflation and domestic currency depreciation places micro-savers at significant financial risk when their funds are stored in cash or low-yield PHP accounts. To help preserve wealth, STELLA Vault democratizes access to stable USD-denominated reserve assets such as USDC. Finally, existing DeFi solutions are often complex, isolated, and designed for individual users, making them inaccessible and culturally disconnected from the needs of many communities. STELLA Vault reimagines decentralized savings infrastructure by providing a collaborative, culturally native framework that supports destination-based family remittances and collective community saving.

## How It Works
Users can create personal or community-driven "smart vaults" to lock away stablecoins (like USDC) for specific life goals—such as emergency funds, tuition fees, or entrepreneurial capital—without worrying about inflation eroding their local currency or high traditional banking fees.

## How It Uses Stellar
- Soroban Smart Contracts (Rust): Powers the core collaborative and individual vault parameters. The contracts safely manage multi-user states, cryptographic asset locking, and deposit/withdrawal logic without requiring centralized ledgers.
- Stellar Asset Contract (SAC): Utilizes native USDC on Stellar out of the box to guarantee hyper-low transaction fees, lightning-fast settlement, and immediate exposure to stable USD values.
- Stellar Compliance & Anchor Architecture (SEP-24/SEP-6): Keeps the contract layer purely permissionless and No-KYC at entry, while shifting regulatory compliance entirely to the edge. Users interact freely on-chain in USD, but complete standard KYC checks only when interacting with regulated local off-ramps (like PeraHub or Coins.ph) to cash out into physical Philippine Peso (PHP) fiat.


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
