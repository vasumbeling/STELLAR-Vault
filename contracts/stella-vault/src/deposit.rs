//! Deposits — locking stablecoins into a vault, and the transparent
//! per-contributor ledger ("Transparent Escrow Ledger") that lets any
//! member audit exactly who put in how much.

use soroban_sdk::{token, Address, Env, Map, Symbol};

use crate::permissions;
use crate::vault::{DataKey, Error, VaultContract, VaultStatus, VaultType};

impl VaultContract {
    /// Lock stablecoins (e.g. native USDC on Stellar) into a vault. Personal
    /// vaults only accept deposits from their creator; collaborative vaults
    /// accept deposits from any registered member.
    pub(crate) fn deposit_impl(env: Env, depositor: Address, vault_id: u64, amount: i128) -> Result<(), Error> {
        depositor.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let mut vault = Self::load_vault(&env, vault_id)?;

        if vault.status == VaultStatus::Closed {
            return Err(Error::VaultNotActive);
        }

        match vault.vault_type {
            VaultType::Personal => {
                if depositor != vault.creator {
                    return Err(Error::NotAuthorized);
                }
            }
            VaultType::Collaborative => {
                permissions::require_member(&env, vault_id, &depositor)?;
            }
        }

        // Collaborative vaults are capped at the goal — once it's reached, no
        // more can go in until it's distributed and reset.
        if vault.vault_type == VaultType::Collaborative && vault.balance + amount > vault.goal_amount {
            return Err(Error::InvalidAmount);
        }

        // Custody model: funds move from the depositor straight into this
        // contract's own address via the token's Stellar Asset Contract (SAC)
        // interface. The contract — not any individual — holds the balance.
        let token_client = token::Client::new(&env, &vault.token);
        token_client.transfer(&depositor, &env.current_contract_address(), &amount);

        vault.balance += amount;
        if vault.balance >= vault.goal_amount && vault.status == VaultStatus::Active {
            vault.status = VaultStatus::GoalReached;
        }
        Self::save_vault(&env, &vault);

        record_contribution(&env, vault_id, &depositor, amount);

        env.events().publish(
            (Symbol::new(&env, "deposit"), depositor),
            (vault_id, amount, vault.balance),
        );

        Ok(())
    }

    /// How much a given address has contributed to a vault in total. Anyone
    /// can query this — it's the transparency layer the protocol is named for.
    pub(crate) fn get_contribution_impl(env: Env, vault_id: u64, address: Address) -> i128 {
        load_contributions(&env, vault_id)
            .get(address)
            .unwrap_or(0)
    }
}

// ---------------------------------------------------------------------
// Crate-internal helpers
// ---------------------------------------------------------------------

fn load_contributions(env: &Env, vault_id: u64) -> Map<Address, i128> {
    env.storage()
        .persistent()
        .get(&DataKey::Contributions(vault_id))
        .unwrap_or(Map::new(env))
}

pub(crate) fn record_contribution(env: &Env, vault_id: u64, depositor: &Address, amount: i128) {
    let mut contributions = load_contributions(env, vault_id);
    let current = contributions.get(depositor.clone()).unwrap_or(0);
    contributions.set(depositor.clone(), current + amount);

    env.storage()
        .persistent()
        .set(&DataKey::Contributions(vault_id), &contributions);
}