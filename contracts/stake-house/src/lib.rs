#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Vec};
use soroban_sdk::token::TokenClient;


#[contracttype]
pub enum DataKey {
    Token,
    Admin,
    Users,
}


#[contract]
pub struct StakeHouse;

#[contractimpl]
impl StakeHouse {
    pub fn __constructor(e: &Env, token: Address, admin: Address) {
        e.storage().instance().set(&DataKey::Token, &token);
        e.storage().instance().set(&DataKey::Admin, &admin);
    }


    // investor
    pub fn deposit(e: Env, from: Address, amount: i128) {
        // Obter o endereço do token do storage
        let token_address: Address = e.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = TokenClient::new(&e, &token_address);
        
        // Validar que o contrato tem allowance suficiente
        let allowance = token_client.allowance(&from, &e.current_contract_address());
        if allowance < amount {
            panic!("Allowance insuficiente");
        }
        
        // Transferir tokens do investidor para o contrato
        token_client.transfer_from(&e.current_contract_address(), &from, &e.current_contract_address(), &amount);
    }

    // user
    pub fn join(e: Env, user: Address) {
        // Obter o endereço do token do storage
        let token_address: Address = e.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = TokenClient::new(&e, &token_address);
        
        // Validar que o usuário tem saldo de tokens
        let balance = token_client.balance(&user);
        if balance <= 0 {
            panic!("Usuário deve ter saldo de tokens para se registrar");
        }
        
        // Obter lista atual de usuários ou criar uma nova
        let mut users: Vec<Address> = e.storage().instance()
            .get(&DataKey::Users)
            .unwrap_or(Vec::new(&e));
        
        // Verificar se o usuário já está registrado
        for existing_user in users.iter() {
            if existing_user == user {
                panic!("Usuário já está registrado");
            }
        }
        
        // Adicionar usuário à lista
        users.push_back(user);
        
        // Salvar lista atualizada no storage
        e.storage().instance().set(&DataKey::Users, &users);
    }

    // distributor
    pub fn airdrop(e: Env) {
        // Obter o endereço do token do storage
        let token_address: Address = e.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = TokenClient::new(&e, &token_address);
        
        // Verificar saldo do contrato
        let contract_balance = token_client.balance(&e.current_contract_address());
        if contract_balance <= 0 {
            panic!("Contrato não tem saldo para distribuir");
        }
        
        // Obter lista de usuários registrados
        let users: Vec<Address> = e.storage().instance()
            .get(&DataKey::Users)
            .unwrap_or(Vec::new(&e));
        
        if users.is_empty() {
            panic!("Nenhum usuário registrado para airdrop");
        }
        
        // Calcular saldo total de todos os holders registrados
        let mut total_holders_balance: i128 = 0;
        let mut valid_users: Vec<Address> = Vec::new(&e);
        
        for user in users.iter() {
            let user_balance = token_client.balance(&user);
            if user_balance > 0 {
                total_holders_balance += user_balance;
                valid_users.push_back(user);
            }
        }
        
        if total_holders_balance <= 0 {
            panic!("Nenhum holder válido encontrado");
        }
        
        // Calcular 10% do saldo do contrato para distribuir
        let airdrop_amount = contract_balance / 10;
        
        // Distribuir proporcionalmente para cada holder válido
        for user in valid_users.iter() {
            let user_balance = token_client.balance(&user);
            
            // Calcular proporção do usuário em relação ao total
            let user_proportion = (user_balance * airdrop_amount) / total_holders_balance;
            
            if user_proportion > 0 {
                // Transferir tokens para o usuário
                token_client.transfer(&e.current_contract_address(), &user, &user_proportion);
            }
        }
    }

}
