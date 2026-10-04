'use client'

import { useEffect } from 'react'
import { injected } from 'wagmi/connectors'
import { connect, getConnection } from 'wagmi/actions'
import { config } from '@/config/wagmi'
import { findMiniAppHost } from '@/lib/miniAppHost'

/**
 * Inside a mini app host the visitor is already signed in, so the site connects the host's
 * wallet at once instead of asking for one. Renders nothing; on its own page it does nothing.
 */
export default function MiniAppBridge() {
  useEffect(() => {
    let cancelled = false
    findMiniAppHost()
      .then(async (host) => {
        if (cancelled || !host?.provider || getConnection(config).isConnected) return
        const connector = injected({ target: () => ({ id: `miniapp-${host.id}`, name: host.name, provider: () => host.provider }) })
        await connect(config, { connector })
      })
      .catch((error) => console.warn('MINIAPP_CONNECT_FAILED:', error?.shortMessage ?? error?.message))
    return () => {
      cancelled = true
    }
  }, [])
  return null
}
