'use client'

import { formatUnits } from 'viem'
import { site } from '@/config/site'
import useEthUsd from '@/hooks/useEthUsd'
import { formatUsd } from '@/lib/format'

const { usd } = site

/**
 * What an amount of ETH is worth in dollars, as "≈ $67.03": `wei` in base units, or `eth` as a
 * number. Nothing for a free amount, or until the ETH price is known.
 */
export default function UsdValue({ wei, eth, decimals = 18, className }) {
  const rate = useEthUsd()
  const amount = eth ?? (wei == null ? null : Number(formatUnits(BigInt(wei), decimals)))
  if (rate === null || !amount) return null
  return (
    <span className={className} title={usd.title}>
      {usd.label.replace('{amount}', formatUsd(amount * rate))}
    </span>
  )
}
