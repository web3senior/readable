import { concat, encodeAbiParameters, getContractAddress } from 'viem'
import { registry, registryEnabled } from '@/config/registry'
import { tokenBound, tokenBoundOn } from '@/config/tokenBound'
import { publicClient } from '@/lib/registry'

// ERC-6551's account: an ERC-1167 proxy of the implementation with the token it belongs to
// appended, deployed by the registry with CREATE2. Its address follows from those bytes alone
const PROXY_HEAD = '0x3d60ad80600a3d3981f3363d3d373d3d3d363d73'
const PROXY_FOOT = '0x5af43d82803e903d91602b57fd5bf3'
const TOKEN = [{ type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }, { type: 'uint256' }]

/** Whether names have wallets of their own on the registry's chain. */
export const tokenBoundEnabled = () => registryEnabled && tokenBoundOn(registry.chainId)

/**
 * The address of a name's own wallet, computed without a read. It is the same for every holder
 * of the name, since the token id is the name's, and it holds funds before it is created.
 */
export function tokenBoundAccountOf(tokenId) {
  if (!tokenBoundEnabled()) return null
  const { registry: factory, implementation, salt } = tokenBound
  const bytecode = concat([
    PROXY_HEAD,
    implementation.toLowerCase(),
    PROXY_FOOT,
    encodeAbiParameters(TOKEN, [salt, BigInt(registry.chainId), registry.address, BigInt(tokenId)]),
  ])
  return getContractAddress({ opcode: 'CREATE2', from: factory, salt, bytecode })
}

/** What the arguments of the registry's `createAccount` and `account` are for one name. */
export const tokenBoundArgs = (tokenId) => [tokenBound.implementation, tokenBound.salt, BigInt(registry.chainId), registry.address, BigInt(tokenId)]

/**
 * Whether a name's wallet is deployed (`created`), whether it runs an account yet (`ready`, once
 * initialized), and the ETH it holds.
 */
export async function readTokenBound(account) {
  const client = publicClient()
  const [code, running, balance] = await Promise.all([
    client.getCode({ address: account }),
    client.getStorageAt({ address: account, slot: tokenBound.implementationSlot }),
    client.getBalance({ address: account }),
  ])
  return { created: Boolean(code && code !== '0x'), ready: Boolean(running) && BigInt(running) !== 0n, balance }
}
