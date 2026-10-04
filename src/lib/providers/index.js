import * as readable from '@/lib/providers/readable'

const PROVIDERS = { readable }

/**
 * Resolves one valid candidate through its namespace's provider.
 * @returns {Promise<{ status: 'available'|'taken'|'soon', [key: string]: unknown }>}
 */
export const lookupCandidate = (candidate) => {
  const provider = PROVIDERS[candidate.namespace.provider]
  if (!provider) throw new Error(`No provider named "${candidate.namespace.provider}"`)
  return provider.lookup(candidate)
}
