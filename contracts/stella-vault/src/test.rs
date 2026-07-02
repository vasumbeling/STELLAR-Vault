#![cfg(test)]
use super::*;
use crate::vault::VaultContractClient;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup(env: &Env) -> VaultContractClient<'_> {
    env.mock_all_auths();
    let contract_id = env.register(VaultContract, ());
    VaultContractClient::new(env, &contract_id)
}

#[test]
fn initialize_and_create_vault() {
    let env = Env::default();
    let client = setup(&env);

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let token = Address::generate(&env);
    let purpose = String::from_str(&env, "Emergency Fund");

    client.initialize(&admin);

    let vault_id = client.create_vault(
        &creator,
        &token,
        &VaultType::Personal,
        &purpose,
        &1000,
        &0,
    );

    let vault = client.get_vault(&vault_id);
    assert_eq!(vault.id, vault_id);
    assert_eq!(vault.creator, creator);
    assert_eq!(vault.goal_amount, 1000);
}

#[test]
fn double_initialize_fails() {
    let env = Env::default();
    let client = setup(&env);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let err = client.try_initialize(&admin);
    assert_eq!(err, Err(Ok(Error::AlreadyInitialized)));
}
