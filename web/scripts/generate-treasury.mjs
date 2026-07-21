import StellarHDWallet from 'stellar-hd-wallet';

const mnemonic = StellarHDWallet.generateMnemonic();
const wallet = StellarHDWallet.fromMnemonic(mnemonic);
const publicKey = wallet.getPublicKey(0);
const secretKey = wallet.getSecret(0);

console.log('--- TREASURY ACCOUNT (testnet) ---');
console.log('Public Key:', publicKey);
console.log('Secret Key:', secretKey);
console.log('Mnemonic:  ', mnemonic);
console.log('----------------------------------');
console.log('Save the secret key + mnemonic somewhere safe and OFFLINE.');
console.log('Do NOT commit them. Only the public key goes in .env.');

const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
console.log('Friendbot funding:', res.ok ? 'success' : `failed (${res.status})`);