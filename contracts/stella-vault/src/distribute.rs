//! Even distribution — once a collaborative vault hits its goal, the owner
//! can trigger a payout that splits the full balance equally across every
//! address that actually contributed (not every member — someone invited
//! but who never deposited gets nothing).

use soroban_sdk::{token, Address, Env, Symbol, Vec};

use crate::permissions;
use crate::vault::{DataKey, Error, VaultContract, VaultStatus, VaultType};

impl VaultContract {
    pub(crate) fn distribute_impl(env: Env, caller: Address, vault_id: u64) -> Result<(), Error> {
        caller.require_auth();

        let mut vault = Self::load_vault(&env, vault_id)?;

        if vault.vault_type != VaultType::Collaborative {
            return Err(Error::NotAuthorized);
        }
        permissions::require_owner(&env, vault_id, &caller)?;

        if vault.status != VaultStatus::GoalReached {
            return Err(Error::VaultLocked);
        }
        if vault.balance <= 0 {
            return Err(Error::InsufficientBalance);
        }

        let contributions: soroban_sdk::Map<Address, i128> = env
            .storage()
            .persistent()
            .get(&DataKey::Contributions(vault_id))
            .unwrap_or(soroban_sdk::Map::new(&env));

        let mut contributors: Vec<Address> = Vec::new(&env);
        for (addr, amount) in contributions.iter() {
            if amount > 0 {
                contributors.push_back(addr);
            }
        }

        let count = contributors.len();
        if count == 0 {
            return Err(Error::NoContributions);
        }

        let total = vault.balance;
        let share = total / (count as i128);
        let remainder = total - (share * count as i128);

        let token_client = token::Client::new(&env, &vault.token);
        for (i, addr) in contributors.iter().enumerate() {
            // Give any leftover (from integer division) to the first
            // contributor so the vault empties out exactly, rather than
            // leaving dust behind in the contract.
            let amount = if i == 0 { share + remainder } else { share };
            if amount > 0 {
                token_client.transfer(&env.current_contract_address(), &addr, &amount);
            }
        }

        vault.balance = 0;
        vault.status = VaultStatus::Closed;
        Self::save_vault(&env, &vault);

        env.events().publish(
            (Symbol::new(&env, "distributed"), caller),
            (vault_id, total, count as u32),
        );

        Ok(())
    }
}