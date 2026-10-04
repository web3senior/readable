import { registryEnabled } from '@/config/registry'
import { apiAnswer, apiError, segment } from '@/lib/api'
import { readVerification } from '@/lib/verify'

// GET /api/verify/+0 4242: which accounts in the name's records are proven to be its holder's, by
// a post that carries the holder's signature. 404 for a name that reaches nobody
export async function GET(_request, { params }) {
  if (!registryEnabled) return apiError('No registry is configured yet', 503)
  const name = segment((await params).name)
  try {
    const verification = await readVerification(name)
    return verification ? apiAnswer(verification) : apiError(`${name} is not a registered name`, 404)
  } catch {
    return apiError('The registry could not be read', 502)
  }
}
