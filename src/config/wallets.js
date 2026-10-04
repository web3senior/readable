import { injected, walletConnect } from 'wagmi/connectors'
import { site } from '@/config/site'

// NEXT_PUBLIC_ values are inlined only when referenced literally
const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

export const CONNECTOR_TYPES = {
  injected: injected.type,
  walletConnect: walletConnect.type,
}

// wagmi's plain window.ethereum connector; a wallet announced over EIP-6963 carries its rdns instead
export const GENERIC_INJECTED_ID = 'injected'

/**
 * Options for the WalletConnect connector, or null while no project id is set. The origin is
 * the page's own, so the wallet's approval screen names the host the visitor is really on.
 */
export const walletConnectOptions = (origin) =>
  WALLETCONNECT_PROJECT_ID
    ? {
        projectId: WALLETCONNECT_PROJECT_ID,
        metadata: {
          name: site.name,
          description: site.description,
          url: origin,
          icons: [new URL(site.iconPath, origin).href],
        },
      }
    : null
