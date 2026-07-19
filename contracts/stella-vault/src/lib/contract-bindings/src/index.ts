import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CDDZ2WEXCX3UBEUBM2PBVRCO2W2EEMPQUB5XHDDKCWA2MB2EX66WRT7E",
  }
} as const

export type Role = {tag: "Owner", values: void} | {tag: "Contributor", values: void};


export interface Member {
  address: string;
  joined_at: u64;
  role: Role;
  /**
 * Informational contribution share, in basis points (out of 10_000).
 * Not enforced on-chain; useful for UIs showing expected payout splits.
 */
share_bps: u32;
}

export const Errors = {
  1: {message:"NotInitialized"},
  2: {message:"AlreadyInitialized"},
  3: {message:"VaultNotFound"},
  4: {message:"NotAuthorized"},
  5: {message:"InvalidAmount"},
  6: {message:"VaultNotActive"},
  7: {message:"VaultLocked"},
  8: {message:"AlreadyMember"},
  9: {message:"NotMember"},
  10: {message:"InsufficientBalance"},
  11: {message:"RequestNotFound"},
  12: {message:"AlreadyApproved"},
  13: {message:"InsufficientApprovals"},
  14: {message:"InvalidGoal"},
  15: {message:"NoContributions"}
}


export interface Vault {
  balance: i128;
  created_at: u64;
  creator: string;
  goal_amount: i128;
  id: u64;
  /**
 * Unix timestamp after which funds may be withdrawn even if the goal
 * hasn't been reached. `0` means "no lock".
 */
lock_until: u64;
  purpose: string;
  status: VaultStatus;
  /**
 * The Stellar Asset Contract (SAC) token this vault is denominated in, e.g. USDC.
 */
token: string;
  vault_type: VaultType;
}

export type DataKey = {tag: "Admin", values: void} | {tag: "VaultCounter", values: void} | {tag: "Vault", values: readonly [u64]} | {tag: "Members", values: readonly [u64]} | {tag: "Contributions", values: readonly [u64]} | {tag: "WithdrawalCounter", values: readonly [u64]} | {tag: "WithdrawalReq", values: readonly [u64, u64]} | {tag: "Approvals", values: readonly [u64, u64]};

/**
 * Personal vaults are single-user. Collaborative vaults are paluwagan-style
 * pooled vaults with member-approved payouts (see `permissions.rs` / `withdraw.rs`).
 */
export type VaultType = {tag: "Personal", values: void} | {tag: "Collaborative", values: void};

export type VaultStatus = {tag: "Active", values: void} | {tag: "GoalReached", values: void} | {tag: "Closed", values: void};


export interface WithdrawalRequest {
  amount: i128;
  created_at: u64;
  executed: boolean;
  id: u64;
  recipient: string;
  requester: string;
  vault_id: u64;
}

export interface Client {
  /**
   * Construct and simulate a deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  deposit: ({depositor, vault_id, amount}: {depositor: string, vault_id: u64, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  upgrade: ({caller, new_wasm_hash}: {caller: string, new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  withdraw: ({caller, vault_id, recipient, amount}: {caller: string, vault_id: u64, recipient: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_vault transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_vault: ({vault_id}: {vault_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Vault>>>

  /**
   * Construct and simulate a add_member transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  add_member: ({caller, vault_id, member, share_bps}: {caller: string, vault_id: u64, member: string, share_bps: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a distribute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  distribute: ({caller, vault_id}: {caller: string, vault_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * One-time protocol setup. No KYC or identity is collected here — `admin`
   * is only a placeholder for future protocol-level parameters (e.g. fee
   * switches), never a gate on who can create or use a vault.
   */
  initialize: ({admin}: {admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a close_vault transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  close_vault: ({caller, vault_id}: {caller: string, vault_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a update_goal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Owner-only. A vault can only be closed once its balance has been fully
   * withdrawn — this just marks the vault inactive, it never seizes funds.
   * Business rule (unanimous member approval) is enforced by
   * the app backend before the owner is allowed to submit this call —
   * the contract itself only checks ownership, same pattern as close_vault.
   */
  update_goal: ({caller, vault_id, new_goal_amount}: {caller: string, vault_id: u64, new_goal_amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a update_lock transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Owner-only, same approval-before-call pattern as update_goal.
   */
  update_lock: ({caller, vault_id, new_lock_until}: {caller: string, vault_id: u64, new_lock_until: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a create_vault transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create a personal or collaborative savings vault. Anyone with a Stellar
   * address can call this directly — there is no identity or balance
   * gatekeeping at the contract layer.
   */
  create_vault: ({creator, token, vault_type, purpose, goal_amount, lock_until}: {creator: string, token: string, vault_type: VaultType, purpose: string, goal_amount: i128, lock_until: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a list_members transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  list_members: ({vault_id}: {vault_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Member>>>

  /**
   * Construct and simulate a remove_member transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  remove_member: ({caller, vault_id, member}: {caller: string, vault_id: u64, member: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a is_vault_member transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_vault_member: ({vault_id, address}: {vault_id: u64, address: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a get_contribution transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_contribution: ({vault_id, address}: {vault_id: u64, address: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a approve_withdrawal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  approve_withdrawal: ({approver, vault_id, request_id}: {approver: string, vault_id: u64, request_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a execute_withdrawal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  execute_withdrawal: ({caller, vault_id, request_id}: {caller: string, vault_id: u64, request_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a request_withdrawal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  request_withdrawal: ({requester, vault_id, recipient, amount}: {requester: string, vault_id: u64, recipient: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a get_withdrawal_request transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_withdrawal_request: ({vault_id, request_id}: {vault_id: u64, request_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<WithdrawalRequest>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAgAAAAAAAAAAAAAABFJvbGUAAAACAAAAAAAAAAAAAAAFT3duZXIAAAAAAAAAAAAAAAAAAAtDb250cmlidXRvcgA=",
        "AAAAAQAAAAAAAAAAAAAABk1lbWJlcgAAAAAABAAAAAAAAAAHYWRkcmVzcwAAAAATAAAAAAAAAAlqb2luZWRfYXQAAAAAAAAGAAAAAAAAAARyb2xlAAAH0AAAAARSb2xlAAAAiEluZm9ybWF0aW9uYWwgY29udHJpYnV0aW9uIHNoYXJlLCBpbiBiYXNpcyBwb2ludHMgKG91dCBvZiAxMF8wMDApLgpOb3QgZW5mb3JjZWQgb24tY2hhaW47IHVzZWZ1bCBmb3IgVUlzIHNob3dpbmcgZXhwZWN0ZWQgcGF5b3V0IHNwbGl0cy4AAAAJc2hhcmVfYnBzAAAAAAAABA==",
        "AAAAAAAAAAAAAAAHZGVwb3NpdAAAAAADAAAAAAAAAAlkZXBvc2l0b3IAAAAAAAATAAAAAAAAAAh2YXVsdF9pZAAAAAYAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAACAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAADW5ld193YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAADwAAAAAAAAAOTm90SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAgAAAAAAAAANVmF1bHROb3RGb3VuZAAAAAAAAAMAAAAAAAAADU5vdEF1dGhvcml6ZWQAAAAAAAAEAAAAAAAAAA1JbnZhbGlkQW1vdW50AAAAAAAABQAAAAAAAAAOVmF1bHROb3RBY3RpdmUAAAAAAAYAAAAAAAAAC1ZhdWx0TG9ja2VkAAAAAAcAAAAAAAAADUFscmVhZHlNZW1iZXIAAAAAAAAIAAAAAAAAAAlOb3RNZW1iZXIAAAAAAAAJAAAAAAAAABNJbnN1ZmZpY2llbnRCYWxhbmNlAAAAAAoAAAAAAAAAD1JlcXVlc3ROb3RGb3VuZAAAAAALAAAAAAAAAA9BbHJlYWR5QXBwcm92ZWQAAAAADAAAAAAAAAAVSW5zdWZmaWNpZW50QXBwcm92YWxzAAAAAAAADQAAAAAAAAALSW52YWxpZEdvYWwAAAAADgAAAAAAAAAPTm9Db250cmlidXRpb25zAAAAAA8=",
        "AAAAAQAAAAAAAAAAAAAABVZhdWx0AAAAAAAACgAAAAAAAAAHYmFsYW5jZQAAAAALAAAAAAAAAApjcmVhdGVkX2F0AAAAAAAGAAAAAAAAAAdjcmVhdG9yAAAAABMAAAAAAAAAC2dvYWxfYW1vdW50AAAAAAsAAAAAAAAAAmlkAAAAAAAGAAAAbFVuaXggdGltZXN0YW1wIGFmdGVyIHdoaWNoIGZ1bmRzIG1heSBiZSB3aXRoZHJhd24gZXZlbiBpZiB0aGUgZ29hbApoYXNuJ3QgYmVlbiByZWFjaGVkLiBgMGAgbWVhbnMgIm5vIGxvY2siLgAAAApsb2NrX3VudGlsAAAAAAAGAAAAAAAAAAdwdXJwb3NlAAAAABAAAAAAAAAABnN0YXR1cwAAAAAH0AAAAAtWYXVsdFN0YXR1cwAAAABPVGhlIFN0ZWxsYXIgQXNzZXQgQ29udHJhY3QgKFNBQykgdG9rZW4gdGhpcyB2YXVsdCBpcyBkZW5vbWluYXRlZCBpbiwgZS5nLiBVU0RDLgAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAAp2YXVsdF90eXBlAAAAAAfQAAAACVZhdWx0VHlwZQAAAA==",
        "AAAAAAAAAAAAAAAId2l0aGRyYXcAAAAEAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAACHZhdWx0X2lkAAAABgAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAAAAAAAJZ2V0X3ZhdWx0AAAAAAAAAQAAAAAAAAAIdmF1bHRfaWQAAAAGAAAAAQAAA+kAAAfQAAAABVZhdWx0AAAAAAAAAw==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAACAAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAMVmF1bHRDb3VudGVyAAAAAQAAAAAAAAAFVmF1bHQAAAAAAAABAAAABgAAAAEAAAAAAAAAB01lbWJlcnMAAAAAAQAAAAYAAAABAAAAAAAAAA1Db250cmlidXRpb25zAAAAAAAAAQAAAAYAAAABAAAAAAAAABFXaXRoZHJhd2FsQ291bnRlcgAAAAAAAAEAAAAGAAAAAQAAAAAAAAANV2l0aGRyYXdhbFJlcQAAAAAAAAIAAAAGAAAABgAAAAEAAAAAAAAACUFwcHJvdmFscwAAAAAAAAIAAAAGAAAABg==",
        "AAAAAAAAAAAAAAAKYWRkX21lbWJlcgAAAAAABAAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAh2YXVsdF9pZAAAAAYAAAAAAAAABm1lbWJlcgAAAAAAEwAAAAAAAAAJc2hhcmVfYnBzAAAAAAAABAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAAAAAAAKZGlzdHJpYnV0ZQAAAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAh2YXVsdF9pZAAAAAYAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAMhPbmUtdGltZSBwcm90b2NvbCBzZXR1cC4gTm8gS1lDIG9yIGlkZW50aXR5IGlzIGNvbGxlY3RlZCBoZXJlIOKAlCBgYWRtaW5gCmlzIG9ubHkgYSBwbGFjZWhvbGRlciBmb3IgZnV0dXJlIHByb3RvY29sLWxldmVsIHBhcmFtZXRlcnMgKGUuZy4gZmVlCnN3aXRjaGVzKSwgbmV2ZXIgYSBnYXRlIG9uIHdobyBjYW4gY3JlYXRlIG9yIHVzZSBhIHZhdWx0LgAAAAppbml0aWFsaXplAAAAAAABAAAAAAAAAAVhZG1pbgAAAAAAABMAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAAAAAAALY2xvc2VfdmF1bHQAAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAh2YXVsdF9pZAAAAAYAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAVRPd25lci1vbmx5LiBBIHZhdWx0IGNhbiBvbmx5IGJlIGNsb3NlZCBvbmNlIGl0cyBiYWxhbmNlIGhhcyBiZWVuIGZ1bGx5CndpdGhkcmF3biDigJQgdGhpcyBqdXN0IG1hcmtzIHRoZSB2YXVsdCBpbmFjdGl2ZSwgaXQgbmV2ZXIgc2VpemVzIGZ1bmRzLgpCdXNpbmVzcyBydWxlICh1bmFuaW1vdXMgbWVtYmVyIGFwcHJvdmFsKSBpcyBlbmZvcmNlZCBieQp0aGUgYXBwIGJhY2tlbmQgYmVmb3JlIHRoZSBvd25lciBpcyBhbGxvd2VkIHRvIHN1Ym1pdCB0aGlzIGNhbGwg4oCUCnRoZSBjb250cmFjdCBpdHNlbGYgb25seSBjaGVja3Mgb3duZXJzaGlwLCBzYW1lIHBhdHRlcm4gYXMgY2xvc2VfdmF1bHQuAAAAC3VwZGF0ZV9nb2FsAAAAAAMAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAIdmF1bHRfaWQAAAAGAAAAAAAAAA9uZXdfZ29hbF9hbW91bnQAAAAACwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAD1Pd25lci1vbmx5LCBzYW1lIGFwcHJvdmFsLWJlZm9yZS1jYWxsIHBhdHRlcm4gYXMgdXBkYXRlX2dvYWwuAAAAAAAAC3VwZGF0ZV9sb2NrAAAAAAMAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAIdmF1bHRfaWQAAAAGAAAAAAAAAA5uZXdfbG9ja191bnRpbAAAAAAABgAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAgAAAJxQZXJzb25hbCB2YXVsdHMgYXJlIHNpbmdsZS11c2VyLiBDb2xsYWJvcmF0aXZlIHZhdWx0cyBhcmUgcGFsdXdhZ2FuLXN0eWxlCnBvb2xlZCB2YXVsdHMgd2l0aCBtZW1iZXItYXBwcm92ZWQgcGF5b3V0cyAoc2VlIGBwZXJtaXNzaW9ucy5yc2AgLyBgd2l0aGRyYXcucnNgKS4AAAAAAAAACVZhdWx0VHlwZQAAAAAAAAIAAAAAAAAAAAAAAAhQZXJzb25hbAAAAAAAAAAAAAAADUNvbGxhYm9yYXRpdmUAAAA=",
        "AAAAAAAAAK1DcmVhdGUgYSBwZXJzb25hbCBvciBjb2xsYWJvcmF0aXZlIHNhdmluZ3MgdmF1bHQuIEFueW9uZSB3aXRoIGEgU3RlbGxhcgphZGRyZXNzIGNhbiBjYWxsIHRoaXMgZGlyZWN0bHkg4oCUIHRoZXJlIGlzIG5vIGlkZW50aXR5IG9yIGJhbGFuY2UKZ2F0ZWtlZXBpbmcgYXQgdGhlIGNvbnRyYWN0IGxheWVyLgAAAAAAAAxjcmVhdGVfdmF1bHQAAAAGAAAAAAAAAAdjcmVhdG9yAAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAKdmF1bHRfdHlwZQAAAAAH0AAAAAlWYXVsdFR5cGUAAAAAAAAAAAAAB3B1cnBvc2UAAAAAEAAAAAAAAAALZ29hbF9hbW91bnQAAAAACwAAAAAAAAAKbG9ja191bnRpbAAAAAAABgAAAAEAAAPpAAAABgAAAAM=",
        "AAAAAAAAAAAAAAAMbGlzdF9tZW1iZXJzAAAAAQAAAAAAAAAIdmF1bHRfaWQAAAAGAAAAAQAAA+oAAAfQAAAABk1lbWJlcgAA",
        "AAAAAAAAAAAAAAANcmVtb3ZlX21lbWJlcgAAAAAAAAMAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAIdmF1bHRfaWQAAAAGAAAAAAAAAAZtZW1iZXIAAAAAABMAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAgAAAAAAAAAAAAAAC1ZhdWx0U3RhdHVzAAAAAAMAAAAAAAAAAAAAAAZBY3RpdmUAAAAAAAAAAAAAAAAAC0dvYWxSZWFjaGVkAAAAAAAAAAAAAAAABkNsb3NlZAAA",
        "AAAAAAAAAAAAAAAPaXNfdmF1bHRfbWVtYmVyAAAAAAIAAAAAAAAACHZhdWx0X2lkAAAABgAAAAAAAAAHYWRkcmVzcwAAAAATAAAAAQAAAAE=",
        "AAAAAAAAAAAAAAAQZ2V0X2NvbnRyaWJ1dGlvbgAAAAIAAAAAAAAACHZhdWx0X2lkAAAABgAAAAAAAAAHYWRkcmVzcwAAAAATAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAASYXBwcm92ZV93aXRoZHJhd2FsAAAAAAADAAAAAAAAAAhhcHByb3ZlcgAAABMAAAAAAAAACHZhdWx0X2lkAAAABgAAAAAAAAAKcmVxdWVzdF9pZAAAAAAABgAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAAAAAAASZXhlY3V0ZV93aXRoZHJhd2FsAAAAAAADAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAACHZhdWx0X2lkAAAABgAAAAAAAAAKcmVxdWVzdF9pZAAAAAAABgAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAAAAAAAScmVxdWVzdF93aXRoZHJhd2FsAAAAAAAEAAAAAAAAAAlyZXF1ZXN0ZXIAAAAAAAATAAAAAAAAAAh2YXVsdF9pZAAAAAYAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAABgAAAAM=",
        "AAAAAAAAAAAAAAAWZ2V0X3dpdGhkcmF3YWxfcmVxdWVzdAAAAAAAAgAAAAAAAAAIdmF1bHRfaWQAAAAGAAAAAAAAAApyZXF1ZXN0X2lkAAAAAAAGAAAAAQAAA+kAAAfQAAAAEVdpdGhkcmF3YWxSZXF1ZXN0AAAAAAAAAw==",
        "AAAAAQAAAAAAAAAAAAAAEVdpdGhkcmF3YWxSZXF1ZXN0AAAAAAAABwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAApjcmVhdGVkX2F0AAAAAAAGAAAAAAAAAAhleGVjdXRlZAAAAAEAAAAAAAAAAmlkAAAAAAAGAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAAAAAAlyZXF1ZXN0ZXIAAAAAAAATAAAAAAAAAAh2YXVsdF9pZAAAAAY=" ]),
      options
    )
  }
  public readonly fromJSON = {
    deposit: this.txFromJSON<Result<void>>,
        upgrade: this.txFromJSON<Result<void>>,
        withdraw: this.txFromJSON<Result<void>>,
        get_vault: this.txFromJSON<Result<Vault>>,
        add_member: this.txFromJSON<Result<void>>,
        distribute: this.txFromJSON<Result<void>>,
        initialize: this.txFromJSON<Result<void>>,
        close_vault: this.txFromJSON<Result<void>>,
        update_goal: this.txFromJSON<Result<void>>,
        update_lock: this.txFromJSON<Result<void>>,
        create_vault: this.txFromJSON<Result<u64>>,
        list_members: this.txFromJSON<Array<Member>>,
        remove_member: this.txFromJSON<Result<void>>,
        is_vault_member: this.txFromJSON<boolean>,
        get_contribution: this.txFromJSON<i128>,
        approve_withdrawal: this.txFromJSON<Result<void>>,
        execute_withdrawal: this.txFromJSON<Result<void>>,
        request_withdrawal: this.txFromJSON<Result<u64>>,
        get_withdrawal_request: this.txFromJSON<Result<WithdrawalRequest>>
  }
}