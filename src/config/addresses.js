import { btc, sol } from '@ensdomains/address-encoder/coins'

/**
 * The chains a holder can give a name an address on, kept by the registry as ENS keeps them:
 * `addr(tokenId, coinType)` answers the address in the chain's own binary form. Base, Ethereum,
 * BNB and most other EVM chains use the address the name points to (`target`), so only chains
 * that aren't EVM are listed. Another chain is one line here, with its coder from
 * @ensdomains/address-encoder; the registry takes any coin type.
 */
export const addresses = {
  chains: [
    { coin: btc, label: 'Bitcoin', placeholder: 'bc1…' },
    { coin: sol, label: 'Solana' },
  ],
}
