import {
  Address,
  Asset,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  Account,
  rpc,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { server, NETWORK_PASSPHRASE, CONTRACT_ID, USDC_ISSUER, USDC_CONTRACT_ID } from './stellar';

// A real, funded testnet account used ONLY as the source for read-only
// simulations. Nothing is signed or submitted for reads, so any existing
// account works — we reuse the Circle USDC issuer.
const READ_SOURCE = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

export interface CreateVaultParams {
  creator: string;
  purpose: string;
  vaultType: 'Personal' | 'Collaborative';
  goalAmount: number;
  lockUntil?: number; // unix seconds; 0 or omitted = no lock
  tokenAddress?: string; // Soroban SAC address; defaults to the USDC SAC derived below
}

export async function buildCreateVaultXDR(params: CreateVaultParams): Promise<string> {
  const { creator, purpose, vaultType, goalAmount, lockUntil = 0 } = params;

  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(creator);

  const tokenAddress = params.tokenAddress ?? USDC_CONTRACT_ID;
  console.log('buildCreateVaultXDR params:', {
    creator,
    tokenAddress,
    purpose,
    vaultType,
    goalAmount,
    lockUntil,
  });

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'create_vault',
        nativeToScVal(Address.fromString(creator), { type: 'address' }),        // creator
        nativeToScVal(Address.fromString(tokenAddress), { type: 'address' }),    // token
        xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(vaultType)]),                       // vault_type
        nativeToScVal(purpose, { type: 'string' }),                              // purpose
        nativeToScVal(BigInt(Math.trunc(goalAmount)), { type: 'i128' }),         // goal_amount
        nativeToScVal(BigInt(Math.trunc(lockUntil)), { type: 'u64' }),          // lock_until
      ),
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error('Simulation failed — the create_vault call would not succeed.');
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

export interface SavingsState {
  saved: number;
  target: number;
}

export interface VaultBalanceSummary {
  vaultId: string;
  purpose: string;
  vaultType: string;
  balance: number;
  goalAmount: number;
  contribution: number;
  withdrawable: number;
  progress: number;
  status: string;
  lockUntil: number | null;
  lockLabel: string;
}

export function contractConfigured(): boolean {
  return Boolean(CONTRACT_ID);
}

export function resolveVaultId(value?: string | number | null): string {
  const rawValue = typeof value === 'number' ? String(value) : value?.toString().trim();
  if (rawValue && /^\d+$/.test(rawValue)) {
    return rawValue;
  }

  const fromEnv = process.env.NEXT_PUBLIC_VAULT_ID?.trim() ?? process.env.NEXT_PUBLIC_CONTRACT_ID?.trim();
  if (fromEnv && /^\d+$/.test(fromEnv)) {
    return fromEnv;
  }

  return '1';
}

function toNumber(value: unknown): number {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeEnum(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.tag === 'string') return record.tag;
    if (typeof record.value === 'string') return record.value;
    if (record.value && typeof record.value === 'object') {
      const nested = record.value as Record<string, unknown>;
      if (typeof nested.tag === 'string') return nested.tag;
    }
  }
  return 'Unknown';
}

async function readScVal(contractCall: string, args: Array<unknown> = []): Promise<unknown> {
  const contract = new Contract(CONTRACT_ID);
  const source = new Account(READ_SOURCE, '0');
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const operation = contract.call(contractCall, ...args.map((arg) => arg as never));
  tx.addOperation(operation);
  tx.setTimeout(30);

  const sim = await server.simulateTransaction(tx.build());
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
    throw new Error(`Could not read ${contractCall} from the deployed vault contract.`);
  }

  return scValToNative(sim.result.retval);
}

/** Read the current vault balance and goal directly from the deployed vault. */
export async function readSavingsState(): Promise<SavingsState> {
  const summary = await readVaultBalanceSummary(resolveVaultId());
  if (!summary) {
    return { saved: 0, target: 1 };
  }

  return { saved: summary.balance, target: summary.goalAmount };
}

export async function readVaultBalanceSummary(
  vaultId: string | number | null | undefined,
  address?: string | null,
): Promise<VaultBalanceSummary | null> {
  const resolvedVaultId = resolveVaultId(vaultId);
  if (!CONTRACT_ID || !resolvedVaultId) {
    return null;
  }

  try {
    const id = BigInt(resolvedVaultId);
    const vaultData = (await readScVal('get_vault', [nativeToScVal(id, { type: 'u64' })])) as Record<string, unknown>;
    const balance = toNumber(vaultData.balance);
    const goalAmount = Math.max(toNumber(vaultData.goal_amount), 1);
    const lockUntil = toNumber(vaultData.lock_until);
    const status = normalizeEnum(vaultData.status);
    const vaultType = normalizeEnum(vaultData.vault_type);
    const lockElapsed = lockUntil === 0 || Date.now() / 1000 >= lockUntil;
    const withdrawable = vaultType === 'Personal' && (status === 'GoalReached' || lockElapsed) ? balance : 0;
    const progress = goalAmount > 0 ? Math.min(100, (balance / goalAmount) * 100) : 0;

    let contribution = 0;
    if (address) {
      try {
        const contributionData = await readScVal('get_contribution', [
          nativeToScVal(id, { type: 'u64' }),
          nativeToScVal(Address.fromString(address), { type: 'address' }),
        ]);
        contribution = toNumber(contributionData);
      } catch {
        contribution = 0;
      }
    }

    const lockLabel = lockUntil > 0 && !lockElapsed
      ? `Unlocks ${new Date(lockUntil * 1000).toLocaleDateString()}`
      : 'Ready to withdraw';

    return {
      vaultId: String(vaultId),
      purpose: typeof vaultData.purpose === 'string' ? vaultData.purpose : 'Savings vault',
      vaultType,
      balance,
      goalAmount,
      contribution,
      withdrawable,
      progress,
      status,
      lockUntil: lockUntil > 0 ? lockUntil : null,
      lockLabel,
    };
  } catch {
    return null;
  }
}

/**
 * Build + simulate + assemble an unsigned `contribute(amount)` invocation,
 * returning the prepared XDR ready for Freighter to sign.
 * Honors the rule: always simulate a Soroban tx before sending.
 */
export async function buildContributeXDR(
  sender: string,
  amount: number,
): Promise<string> {
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(sender);
  const vaultId = resolveVaultId();

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'deposit',
        nativeToScVal(Address.fromString(sender), { type: 'address' }),
        nativeToScVal(BigInt(vaultId), { type: 'u64' }),
        nativeToScVal(BigInt(Math.trunc(amount)), { type: 'i128' }),
      ),
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error('Simulation failed — the deposit call would not succeed.');
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

/** Build + simulate + assemble an unsigned `withdraw(...)` invocation. */
export async function buildWithdrawXDR(
  sender: string,
  amount: number,
): Promise<string> {
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(sender);
  const vaultId = resolveVaultId();

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'withdraw',
        nativeToScVal(Address.fromString(sender), { type: 'address' }),
        nativeToScVal(BigInt(vaultId), { type: 'u64' }),
        nativeToScVal(Address.fromString(sender), { type: 'address' }),
        nativeToScVal(BigInt(Math.trunc(amount)), { type: 'i128' }),
      ),
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error('Simulation failed — the withdraw call would not succeed.');
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}