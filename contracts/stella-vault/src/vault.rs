//! Core vault contract: shared types, storage layout, and vault lifecycle.
//!
//! This is the "anchor" module — it defines the `#[contract]` struct that
//! `deposit.rs`, `withdraw.rs`, and `permissions.rs` all extend with their
//! own `#[contractimpl]` blocks. Soroban merges every `pub` function across
//! those blocks into the contract's exported interface.

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env, String, Symbol, Vec};

// ---------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    VaultNotFound = 3,
    NotAuthorized = 4,
    InvalidAmount = 5,
    VaultNotActive = 6,
    VaultLocked = 7,
    AlreadyMember = 8,
    NotMember = 9,
    InsufficientBalance = 10,
    RequestNotFound = 11,
    AlreadyApproved = 12,
    InsufficientApprovals = 13,
    InvalidGoal = 14,
    NoContributions = 15
}

// ---------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    VaultCounter,
    Vault(u64),
    Members(u64),
    Contributions(u64),
    WithdrawalCounter(u64),
    WithdrawalReq(u64, u64),
    Approvals(u64, u64),
}

// ---------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------

/// Personal vaults are single-user. Collaborative vaults are paluwagan-style
/// pooled vaults with member-approved payouts (see `permissions.rs` / `withdraw.rs`).
#[contracttype]
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum VaultType {
    Personal,
    Collaborative,
}

#[contracttype]
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum VaultStatus {
    Active,
    GoalReached,
    Closed,
}

#[contracttype]
#[derive(Clone)]
pub struct Vault {
    pub id: u64,
    pub creator: Address,
    /// The Stellar Asset Contract (SAC) token this vault is denominated in, e.g. USDC.
    pub token: Address,
    pub vault_type: VaultType,
    pub purpose: String,
    pub goal_amount: i128,
    pub balance: i128,
    /// Unix timestamp after which funds may be withdrawn even if the goal
    /// hasn't been reached. `0` means "no lock".
    pub lock_until: u64,
    pub status: VaultStatus,
    pub created_at: u64,
}

#[contract]
pub struct VaultContract;

#[contractimpl]
impl VaultContract {
    /// One-time protocol setup. No KYC or identity is collected here — `admin`
    /// is only a placeholder for future protocol-level parameters (e.g. fee
    /// switches), never a gate on who can create or use a vault.
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::VaultCounter, &0u64);
        Ok(())
    }

    /// Create a personal or collaborative savings vault. Anyone with a Stellar
    /// address can call this directly — there is no identity or balance
    /// gatekeeping at the contract layer.
    pub fn create_vault(
        env: Env,
        creator: Address,
        token: Address,
        vault_type: VaultType,
        purpose: String,
        goal_amount: i128,
        lock_until: u64,
    ) -> Result<u64, Error> {
        creator.require_auth();

        if goal_amount <= 0 {
            return Err(Error::InvalidGoal);
        }

        let id = Self::next_vault_id(&env);

        let vault = Vault {
            id,
            creator: creator.clone(),
            token,
            vault_type: vault_type.clone(),
            purpose,
            goal_amount,
            balance: 0,
            lock_until,
            status: VaultStatus::Active,
            created_at: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&DataKey::Vault(id), &vault);

        // The creator is always the first member, with the Owner role. This
        // matters for collaborative vaults, where membership drives both
        // deposit eligibility and withdrawal approval (see permissions.rs).
        crate::permissions::init_owner(&env, id, &creator);

        env.events()
            .publish((Symbol::new(&env, "vault_created"), creator), (id, vault_type));

        Ok(id)
    }

    pub fn get_vault(env: Env, vault_id: u64) -> Result<Vault, Error> {
        Self::load_vault(&env, vault_id)
    }

    /// Owner-only. A vault can only be closed once its balance has been fully
    /// withdrawn — this just marks the vault inactive, it never seizes funds.
    pub fn close_vault(env: Env, caller: Address, vault_id: u64) -> Result<(), Error> {
        caller.require_auth();
        let mut vault = Self::load_vault(&env, vault_id)?;
        crate::permissions::require_owner(&env, vault_id, &caller)?;

        if vault.balance != 0 {
            return Err(Error::InsufficientBalance);
        }

        vault.status = VaultStatus::Closed;
        Self::save_vault(&env, &vault);

        env.events()
            .publish((Symbol::new(&env, "vault_closed"), caller), vault_id);

        Ok(())
    }

    pub fn deposit(env: Env, depositor: Address, vault_id: u64, amount: i128) -> Result<(), Error> {
        Self::deposit_impl(env, depositor, vault_id, amount)
    }

    pub fn get_contribution(env: Env, vault_id: u64, address: Address) -> i128 {
        Self::get_contribution_impl(env, vault_id, address)
    }

    pub fn distribute(env: Env, caller: Address, vault_id: u64) -> Result<(), Error> {
        Self::distribute_impl(env, caller, vault_id)
    }

    pub fn add_member(
        env: Env,
        caller: Address,
        vault_id: u64,
        member: Address,
        share_bps: u32,
    ) -> Result<(), Error> {
        Self::add_member_impl(env, caller, vault_id, member, share_bps)
    }

    pub fn remove_member(env: Env, caller: Address, vault_id: u64, member: Address) -> Result<(), Error> {
        Self::remove_member_impl(env, caller, vault_id, member)
    }

    pub fn list_members(env: Env, vault_id: u64) -> Vec<crate::permissions::Member> {
        Self::list_members_impl(env, vault_id)
    }

    pub fn is_vault_member(env: Env, vault_id: u64, address: Address) -> bool {
        Self::is_vault_member_impl(env, vault_id, address)
    }

    pub fn withdraw(
        env: Env,
        caller: Address,
        vault_id: u64,
        recipient: Address,
        amount: i128,
    ) -> Result<(), Error> {
        Self::withdraw_impl(env, caller, vault_id, recipient, amount)
    }

    pub fn request_withdrawal(
        env: Env,
        requester: Address,
        vault_id: u64,
        recipient: Address,
        amount: i128,
    ) -> Result<u64, Error> {
        Self::request_withdrawal_impl(env, requester, vault_id, recipient, amount)
    }

    pub fn approve_withdrawal(
        env: Env,
        approver: Address,
        vault_id: u64,
        request_id: u64,
    ) -> Result<(), Error> {
        Self::approve_withdrawal_impl(env, approver, vault_id, request_id)
    }

    pub fn execute_withdrawal(
        env: Env,
        caller: Address,
        vault_id: u64,
        request_id: u64,
    ) -> Result<(), Error> {
        Self::execute_withdrawal_impl(env, caller, vault_id, request_id)
    }

    pub fn get_withdrawal_request(env: Env, vault_id: u64, request_id: u64) -> Result<crate::withdraw::WithdrawalRequest, Error> {
        Self::get_withdrawal_request_impl(env, vault_id, request_id)
    }

    // -------------------------------------------------------------
    // Crate-internal helpers, shared by deposit.rs / withdraw.rs / permissions.rs
    // -------------------------------------------------------------

    pub(crate) fn next_vault_id(env: &Env) -> u64 {
        let current: u64 = env
            .storage()
            .instance()
            .get(&DataKey::VaultCounter)
            .unwrap_or(0);
        let next = current + 1;
        env.storage().instance().set(&DataKey::VaultCounter, &next);
        next
    }

    pub(crate) fn load_vault(env: &Env, vault_id: u64) -> Result<Vault, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Vault(vault_id))
            .ok_or(Error::VaultNotFound)
    }

    pub(crate) fn save_vault(env: &Env, vault: &Vault) {
        env.storage()
            .persistent()
            .set(&DataKey::Vault(vault.id), vault);
    }
}