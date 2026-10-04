import { VALIDITY } from '@/config/registry'
import { priceForLength } from '@/lib/pricing'
import { readName } from '@/lib/registry'

/**
 * The Readable registry. A namespace that lives onchain answers with its real state; a preview
 * namespace (no registry configured yet) quotes its launch price instead.
 */
export async function lookup({ namespace, label, length }) {
  if (namespace.onchainId == null) {
    const { currency, prices } = namespace.preview
    return { status: 'soon', quote: { currency, perYear: priceForLength(prices, namespace.rules.priceFrom, length) } }
  }

  const info = await readName(namespace.onchainId, label)
  const shared = { tokenId: info.tokenId, pricePerYear: info.pricePerYear, currency: namespace.currency }

  if (info.owner) {
    const expiresAt = Number(info.expiresAt) * 1000
    return {
      ...shared,
      status: 'taken',
      owner: info.owner,
      ownerName: info.ownerName,
      target: info.target,
      expiresAt,
      // Held past expiry means the grace period, when only the holder can still renew
      expired: expiresAt <= Date.now(),
    }
  }

  const verdict = VALIDITY[Number(info.validity)] ?? VALIDITY[3]
  if (verdict.status !== 'available') return { status: verdict.status, reason: verdict.reason }
  return { ...shared, status: 'available' }
}
