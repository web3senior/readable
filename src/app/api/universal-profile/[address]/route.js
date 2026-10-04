import { isAddress } from 'viem'
import { apiAnswer, apiError } from '@/lib/api'
import { readUniversalProfile } from '@/lib/universalProfile'

// GET /api/universal-profile/0x…: the name and picture a LUKSO Universal Profile publishes, read
// from LUKSO. 404 for an address with no profile that can be read
export async function GET(_request, { params }) {
  const { address } = await params
  if (!isAddress(address)) return apiError(`${address} is not an address`, 400)
  const profile = await readUniversalProfile(address)
  return profile ? apiAnswer(profile) : apiError(`No Universal Profile could be read at ${address}`, 404)
}
