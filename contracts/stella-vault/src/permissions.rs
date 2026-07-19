//! Membership and access control.
//!
//! Personal vaults have exactly one implicit member (the creator, as Owner).
//! Collaborative vaults (the paluwagan / group-savings case) can have many
//! members, each with a role and an informational contribution share used
//! for display/payout-splitting off-chain. Withdrawals on collaborative
//! vaults additionally require member approval — see `withdraw.rs`.

use soroban_sdk::{contracttype, Address, Env, Vec};

use crate::vault::{DataKey, Error, VaultContract, VaultType};

#[contracttype]
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum Role {
    Owner,
    Contributor,
}

#[contracttype]
#[derive(Clone)]
pub struct Member {
    pub address: Address,
    pub role: Role,
    /// Informational contribution share, in basis points (out of 10_000).
    /// Not enforced on-chain; useful for UIs showing expected payout splits.
    pub share_bps: u32,
    pub joined_at: u64,
}

impl VaultContract {
    /// Add a contributor to a collaborative vault. Owner-only.
    pub(crate) fn add_member_impl(
        env: Env,
        caller: Address,
        vault_id: u64,
        member: Address,
        share_bps: u32,
    ) -> Result<(), Error> {
        caller.require_auth();
        let vault = Self::load_vault(&env, vault_id)?;

        if vault.vault_type != VaultType::Collaborative {
            return Err(Error::NotAuthorized);
        }
        require_owner(&env, vault_id, &caller)?;

        if is_member(&env, vault_id, &member) {
            return Err(Error::AlreadyMember);
        }

        let mut members = load_members(&env, vault_id);
        members.push_back(Member {
            address: member,
            role: Role::Contributor,
            share_bps,
            joined_at: env.ledger().timestamp(),
        });
        env.storage()
            .persistent()
            .set(&DataKey::Members(vault_id), &members);

        Ok(())
    }

    /// Remove a contributor. Owner-only, OR a member removing themselves
    /// (self-service leave). Does not touch vault funds — any balance already
    /// contributed by that member stays escrowed in the vault.
    pub(crate) fn remove_member_impl(env: Env, caller: Address, vault_id: u64, member: Address) -> Result<(), Error> {
        caller.require_auth();
        Self::load_vault(&env, vault_id)?;

        let is_self_removal = caller == member;
        if !is_self_removal {
            require_owner(&env, vault_id, &caller)?;
        }

        let members = load_members(&env, vault_id);
        let mut updated: Vec<Member> = Vec::new(&env);
        let mut found = false;
        for m in members.iter() {
            if m.address == member {
                found = true;
            } else {
                updated.push_back(m);
            }
        }
        if !found {
            return Err(Error::NotMember);
        }

        env.storage()
            .persistent()
            .set(&DataKey::Members(vault_id), &updated);
        Ok(())
    }

    pub(crate) fn list_members_impl(env: Env, vault_id: u64) -> Vec<Member> {
        load_members(&env, vault_id)
    }

    pub(crate) fn is_vault_member_impl(env: Env, vault_id: u64, address: Address) -> bool {
        is_member(&env, vault_id, &address)
    }
}

// ---------------------------------------------------------------------
// Crate-internal helpers
// ---------------------------------------------------------------------

pub(crate) fn init_owner(env: &Env, vault_id: u64, creator: &Address) {
    let mut members: Vec<Member> = Vec::new(env);
    members.push_back(Member {
        address: creator.clone(),
        role: Role::Owner,
        share_bps: 10_000,
        joined_at: env.ledger().timestamp(),
    });
    env.storage()
        .persistent()
        .set(&DataKey::Members(vault_id), &members);
}

pub(crate) fn load_members(env: &Env, vault_id: u64) -> Vec<Member> {
    env.storage()
        .persistent()
        .get(&DataKey::Members(vault_id))
        .unwrap_or(Vec::new(env))
}

pub(crate) fn is_member(env: &Env, vault_id: u64, address: &Address) -> bool {
    load_members(env, vault_id)
        .iter()
        .any(|m| &m.address == address)
}

pub(crate) fn get_role(env: &Env, vault_id: u64, address: &Address) -> Option<Role> {
    load_members(env, vault_id)
        .iter()
        .find(|m| &m.address == address)
        .map(|m| m.role.clone())
}

pub(crate) fn require_owner(env: &Env, vault_id: u64, address: &Address) -> Result<(), Error> {
    match get_role(env, vault_id, address) {
        Some(Role::Owner) => Ok(()),
        _ => Err(Error::NotAuthorized),
    }
}

pub(crate) fn require_member(env: &Env, vault_id: u64, address: &Address) -> Result<(), Error> {
    if is_member(env, vault_id, address) {
        Ok(())
    } else {
        Err(Error::NotMember)
    }
}