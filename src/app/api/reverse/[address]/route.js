import { getAddress, isAddress } from 'viem'
import { registryEnabled } from '@/config/registry'
import { apiAnswer, apiError, readable, segment } from '@/lib/api'

// GET /api/reverse/0x…: the primary name a wallet chose, or null when it chose none
export async function GET(_request, { params }) {
  if (!registryEnabled) return apiError('No registry is configured yet', 503)
  const address = segment((await params).address)
  if (!isAddress(address)) return apiError(`${address} is not an address`, 400)
  try {
    return apiAnswer({ address: getAddress(address), name: await readable().getName(address) })
  } catch {
    return apiError('The registry could not be read', 502)
  }
}
