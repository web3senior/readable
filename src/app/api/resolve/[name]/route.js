import { registryEnabled } from '@/config/registry'
import { apiAnswer, apiError, readable, segment } from '@/lib/api'

// GET /api/resolve/+0 42421230: a live name's wallet, its addresses on other chains and its
// records, as the SDK's getProfile gives them. 404 for a name that reaches nobody
export async function GET(_request, { params }) {
  if (!registryEnabled) return apiError('No registry is configured yet', 503)
  const name = segment((await params).name)
  try {
    const profile = await readable().getProfile(name)
    return profile ? apiAnswer(profile) : apiError(`${name} is not a registered name`, 404)
  } catch {
    return apiError('The registry could not be read', 502)
  }
}
