import { createConfig, http } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { chains, rpcUrlFor } from '@/config/chains'
import { walletConnectOptions } from '@/config/wallets'

// EIP-6963 discovery adds each installed wallet; WalletConnect reaches the wallets on a phone
const browserConnectors = () => {
  const walletConnectConfig = walletConnectOptions(window.location.origin)
  return [injected(), ...(walletConnectConfig ? [walletConnect(walletConnectConfig)] : [])]
}

export const config = createConfig({
  chains,
  ssr: true,
  // Connectors touch window and indexedDB on construction, so they exist in the browser alone
  connectors: typeof window === 'undefined' ? [] : browserConnectors(),
  transports: Object.fromEntries(chains.map((chain) => [chain.id, http(rpcUrlFor(chain.id))])),
})
