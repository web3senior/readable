'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useConnection } from 'wagmi'
import { CreditCardIcon } from '@phosphor-icons/react'
import Button from '@/components/ui/Button'
import { toast } from '@/components/NextToast'
import { site } from '@/config/site'
import styles from './OnrampLink.module.scss'

const { onramp } = site
const STALE_MS = 600_000

/**
 * A way to buy the payment token by card, for a wallet that holds too little: opens Coinbase's
 * onramp in a new tab, set to send to the connected wallet. Shown only where the site can sell.
 */
export default function OnrampLink({ currency }) {
  const { address } = useConnection()
  const [opening, setOpening] = useState(false)
  const { data: enabled } = useQuery({
    queryKey: ['onramp'],
    queryFn: async () => (await (await fetch(onramp.path)).json()).enabled === true,
    staleTime: STALE_MS,
  })
  if (!enabled || !address || !currency?.symbol) return null

  const open = async () => {
    // Opened while the click still counts, or a browser blocks the tab
    const tab = window.open('', '_blank')
    setOpening(true)
    try {
      const response = await fetch(onramp.path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address }) })
      const { url, error } = await response.json()
      if (!url) throw new Error(error)
      if (tab) tab.location.href = url
      else window.open(url, '_blank', 'noopener')
    } catch (error) {
      tab?.close()
      toast(error?.message || 'Coinbase could not be reached.', 'error')
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className={styles.onramp}>
      <Button variant="link" size="sm" icon={<CreditCardIcon size={14} />} loading={opening} onClick={open}>
        {onramp.action.replace('{symbol}', currency.symbol)}
      </Button>
      <p className={styles.onramp__note}>{onramp.note.replaceAll('{symbol}', currency.symbol)}</p>
    </div>
  )
}
