'use client'

import { encodeFunctionData, multicall3Abi } from 'viem'
import { getConnection, simulateContract, writeContract } from 'wagmi/actions'
import { chainById } from '@/config/chains'
import { config } from '@/config/wagmi'
import { registry } from '@/config/registry'
import { tokenBound } from '@/config/tokenBound'
import { ensureRegistryChain } from '@/lib/registryActions'
import { tokenBoundAccountOf, tokenBoundArgs } from '@/lib/tokenBound'

// Run first like every registry call, so a refusal comes with its reason instead of a gas guess.
// None is relayed: the forwarder speaks for the registry alone
async function send(request) {
  await ensureRegistryChain()
  const simulated = await simulateContract(config, { chainId: registry.chainId, account: getConnection(config).address, ...request })
  return { hash: await writeContract(config, simulated.request) }
}

const initialize = () => encodeFunctionData({ abi: tokenBound.accountAbi, functionName: 'initialize', args: [tokenBound.account] })

/**
 * Makes a name's own wallet usable: deploys it at its address and initializes it with AccountV3
 * in one transaction, through Multicall3 as Tokenbound does; one deployed by someone else and
 * left bare is only initialized. Anyone may; it belongs to the holder either way.
 */
export function setUpTokenBound(tokenId, { created }) {
  const account = tokenBoundAccountOf(tokenId)
  if (created) return send({ address: account, abi: tokenBound.accountAbi, functionName: 'initialize', args: [tokenBound.account] })
  const create = encodeFunctionData({ abi: tokenBound.registryAbi, functionName: 'createAccount', args: tokenBoundArgs(tokenId) })
  return send({
    address: chainById(registry.chainId).contracts.multicall3.address,
    abi: multicall3Abi,
    functionName: 'aggregate3',
    args: [
      [
        { target: tokenBound.registry, allowFailure: false, callData: create },
        { target: account, allowFailure: false, callData: initialize() },
      ],
    ],
  })
}

/** Sends ETH out of a name's wallet, signed by the wallet that holds the name. */
export const sendFromTokenBound = ({ account, to, value }) =>
  send({ address: account, abi: tokenBound.accountAbi, functionName: 'execute', args: [to, value, '0x', 0] })
