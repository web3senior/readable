import { createConfig, http } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { chains, luksoRpc, rpcUrlFor } from '@/config/chains'
import { checkout } from '@/config/checkout'
import { walletConnectOptions } from '@/config/wallets'

// EIP-6963 discovery adds each installed wallet; WalletConnect reaches the wallets on a phone
const browserConnectors = () => {
  const walletConnectConfig = walletConnectOptions(window.location.origin)
  return [injected(), ...(walletConnectConfig ? [walletConnect(walletConnectConfig)] : [])]
}

// LUKSO too, where a name can be paid for in LYX: the wallet switches there to pay and back to buy
const walletChains = [...chains, checkout.chain]

export const config = createConfig({
  chains: walletChains,
  ssr: true,
  // Connectors touch window and indexedDB on construction, so they exist in the browser alone
  connectors: typeof window === 'undefined' ? [] : browserConnectors(),
  transports: Object.fromEntries(walletChains.map((chain) => [chain.id, http(chain.id === checkout.chain.id ? luksoRpc : rpcUrlFor(chain.id))])),
})
