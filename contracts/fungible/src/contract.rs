// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Stellar Soroban Contracts ^0.4.1


use soroban_sdk::{contract, contractimpl, Env, String};
use stellar_macros::default_impl;
use stellar_tokens::fungible::{Base, FungibleToken};

#[contract]
pub struct MyToken;

#[contractimpl]
impl MyToken {
    pub fn __constructor(e: &Env) {
        Base::set_metadata(e, 18, String::from_str(e, "DOLAR"), String::from_str(e, "USDC"));
    }
}

#[default_impl]
#[contractimpl]
impl FungibleToken for MyToken {
    type ContractType = Base;

}
