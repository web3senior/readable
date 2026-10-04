import { bytesToHex, hexToBytes } from 'viem'

/** The bytes the registry stores for an address typed on `chain`, or null when it isn't one. */
export const addressBytes = (chain, text) => {
  try {
    return bytesToHex(chain.coin.decode(text))
  } catch {
    return null
  }
}

/** The address as the chain writes it, or null when nothing is stored or it can't be read. */
export const addressText = (chain, hex) => {
  if (!hex || hex === '0x') return null
  try {
    return chain.coin.encode(hexToBytes(hex))
  } catch {
    return null
  }
}
