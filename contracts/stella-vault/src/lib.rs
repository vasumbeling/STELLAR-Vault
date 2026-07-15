#![no_std]

pub mod vault;
pub mod permissions;
pub mod deposit;
pub mod withdraw;
pub mod distribute;

pub use permissions::{Member, Role};
pub use vault::{Error, Vault, VaultContract, VaultContractClient, VaultStatus, VaultType};
pub use withdraw::WithdrawalRequest;

#[cfg(test)]
mod test;