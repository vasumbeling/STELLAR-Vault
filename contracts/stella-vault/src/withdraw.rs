//! Withdrawals.
//!
//! - Personal vaults: the owner withdraws directly, once the savings goal is
//!   reached or the optional lock period has elapsed.
//! - Collaborative vaults: any member can propose a payout; it only executes
//!   once it has been approved by more than half of the vault's current
//!   members (simple majority), reflecting the paluwagan's group-decision norm.

use soroban_sdk::{contracttype, token, Address, Env, Symbol, Vec};

use crate::permissions;
use crate::vault::{DataKey, Error, VaultContract, VaultStatus, VaultType};

#[contracttype]
#[derive(Clone)]
pub struct WithdrawalRequest {
    pub id: u64,
    pub vault_id: u64,
    pub requester: Address,
    pub recipient: Address,
    pub amount: i128,
    pub executed: bool,
    pub created_at: u64,
}

impl VaultContract {
    /// Personal-vault withdrawal. Only the creator can call this, and only
    /// once the goal has been met or the lock has elapsed (a `lock_until` of
    /// `0` means the vault was created with no lock at all).
    pub(crate) fn withdraw_impl(
        env: Env,
        caller: Address,
        vault_id: u64,
        recipient: Address,
        amount: i128,
    ) -> Result<(), Error> {
        caller.require_auth();

        let mut vault = Self::load_vault(&env, vault_id)?;

        if vault.vault_type != VaultType::Personal {
            return Err(Error::NotAuthorized);
        }
        if caller != vault.creator {
            return Err(Error::NotAuthorized);
        }
        if vault.status == VaultStatus::Closed {
            return Err(Error::VaultNotActive);
        }
        if amount <= 0 || amount > vault.balance {
            return Err(Error::InvalidAmount);
        }

        let goal_met = vault.status == VaultStatus::GoalReached;
        let lock_elapsed = vault.lock_until == 0 || env.ledger().timestamp() >= vault.lock_until;
        if !goal_met && !lock_elapsed {
            return Err(Error::VaultLocked);
        }

        execute_transfer(&env, &vault.token, &recipient, amount);

        vault.balance -= amount;
        if vault.balance == 0 {
            vault.status = VaultStatus::Active;
        }
        Self::save_vault(&env, &vault);

        env.events().publish(
            (Symbol::new(&env, "withdraw"), caller),
            (vault_id, amount, recipient),
        );

        Ok(())
    }

    /// Collaborative-vault step 1: a member proposes a payout. The proposer's
    /// approval is recorded automatically.
    pub(crate) fn request_withdrawal_impl(
        env: Env,
        requester: Address,
        vault_id: u64,
        recipient: Address,
        amount: i128,
    ) -> Result<u64, Error> {
        requester.require_auth();

        let vault = Self::load_vault(&env, vault_id)?;
        if vault.vault_type != VaultType::Collaborative {
            return Err(Error::NotAuthorized);
        }
        permissions::require_member(&env, vault_id, &requester)?;
        if amount <= 0 || amount > vault.balance {
            return Err(Error::InvalidAmount);
        }

        let request_id = next_request_id(&env, vault_id);
        let request = WithdrawalRequest {
            id: request_id,
            vault_id,
            requester: requester.clone(),
            recipient,
            amount,
            executed: false,
            created_at: env.ledger().timestamp(),
        };
        env.storage()
            .persistent()
            .set(&DataKey::WithdrawalReq(vault_id, request_id), &request);

        approve_internal(&env, vault_id, request_id, &requester);

        env.events().publish(
            (Symbol::new(&env, "withdrawal_requested"), requester),
            (vault_id, request_id, amount),
        );

        Ok(request_id)
    }

    /// Collaborative-vault step 2: a member votes to approve a pending request.
    pub(crate) fn approve_withdrawal_impl(
        env: Env,
        approver: Address,
        vault_id: u64,
        request_id: u64,
    ) -> Result<(), Error> {
        approver.require_auth();
        permissions::require_member(&env, vault_id, &approver)?;

        let request = load_request(&env, vault_id, request_id)?;
        if request.executed {
            return Err(Error::RequestNotFound);
        }

        approve_internal(&env, vault_id, request_id, &approver);

        env.events().publish(
            (Symbol::new(&env, "withdrawal_approved"), approver),
            (vault_id, request_id),
        );

        Ok(())
    }

    /// Collaborative-vault step 3: once a request has strictly more than 50%
    /// of current-member approvals, any member can trigger execution.
    pub(crate) fn execute_withdrawal_impl(
        env: Env,
        caller: Address,
        vault_id: u64,
        request_id: u64,
    ) -> Result<(), Error> {
        caller.require_auth();
        permissions::require_member(&env, vault_id, &caller)?;

        let mut request = load_request(&env, vault_id, request_id)?;
        if request.executed {
            return Err(Error::RequestNotFound);
        }

        let approvals: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::Approvals(vault_id, request_id))
            .unwrap_or(Vec::new(&env));

        let member_count = permissions::load_members(&env, vault_id).len();
        if (approvals.len() as u32) * 2 <= member_count {
            return Err(Error::InsufficientApprovals);
        }

        let mut vault = Self::load_vault(&env, vault_id)?;
        if request.amount > vault.balance {
            return Err(Error::InsufficientBalance);
        }

        execute_transfer(&env, &vault.token, &request.recipient, request.amount);

        vault.balance -= request.amount;
        Self::save_vault(&env, &vault);

        request.executed = true;
        env.storage()
            .persistent()
            .set(&DataKey::WithdrawalReq(vault_id, request_id), &request);

        env.events().publish(
            (Symbol::new(&env, "withdrawal_executed"), caller),
            (vault_id, request_id, request.amount),
        );

        Ok(())
    }

    pub(crate) fn get_withdrawal_request_impl(env: Env, vault_id: u64, request_id: u64) -> Result<WithdrawalRequest, Error> {
        load_request(&env, vault_id, request_id)
    }
}

// ---------------------------------------------------------------------
// Crate-internal helpers
// ---------------------------------------------------------------------

fn execute_transfer(env: &Env, token_id: &Address, recipient: &Address, amount: i128) {
    let token_client = token::Client::new(env, token_id);
    token_client.transfer(&env.current_contract_address(), recipient, &amount);
}

fn next_request_id(env: &Env, vault_id: u64) -> u64 {
    let current: u64 = env
        .storage()
        .persistent()
        .get(&DataKey::WithdrawalCounter(vault_id))
        .unwrap_or(0);
    let next = current + 1;
    env.storage()
        .persistent()
        .set(&DataKey::WithdrawalCounter(vault_id), &next);
    next
}

fn load_request(env: &Env, vault_id: u64, request_id: u64) -> Result<WithdrawalRequest, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::WithdrawalReq(vault_id, request_id))
        .ok_or(Error::RequestNotFound)
}

fn approve_internal(env: &Env, vault_id: u64, request_id: u64, approver: &Address) {
    let mut approvals: Vec<Address> = env
        .storage()
        .persistent()
        .get(&DataKey::Approvals(vault_id, request_id))
        .unwrap_or(Vec::new(env));

    if !approvals.iter().any(|a| &a == approver) {
        approvals.push_back(approver.clone());
        env.storage()
            .persistent()
            .set(&DataKey::Approvals(vault_id, request_id), &approvals);
    }
}