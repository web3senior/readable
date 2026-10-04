import { KIND } from '@/config/namespaces'
import { registry } from '@/config/registry'
import { formatNumber, luhnCheckDigit } from '@/lib/query/numbers'
import { publicClient } from '@/lib/registry'

// How many neighbours are asked about at once; the free ones among them are offered
const ASKED = 18

/**
 * Numbers that read like `digits`, closest first: the same number with its last digit changed,
 * then one more or less, then one digit longer. A number long enough for a check digit keeps
 * one, recomputed. None starts with 0, which would read as part of the prefix.
 */
export function neighbours(digits, namespace) {
  const { checkDigit, minLength, maxLength } = namespace.rules
  const needsCheck = (length) => checkDigit?.algorithm === 'luhn' && length >= checkDigit.fromLength
  const finish = (payload) => (needsCheck(payload.length + 1) ? `${payload}${luhnCheckDigit(payload)}` : payload)
  const payload = needsCheck(digits.length) ? digits.slice(0, -1) : digits
  const last = Number(payload.at(-1))

  const found = []
  const offer = (candidate) => {
    if (!candidate || candidate.startsWith('0') || candidate === digits || found.includes(candidate)) return
    if (candidate.length < minLength || (maxLength && candidate.length > maxLength)) return
    found.push(candidate)
  }

  // The last digit, nearest first
  for (let step = 1; step <= 9; step++) {
    for (const digit of [last + step, last - step]) {
      if (digit >= 0 && digit <= 9) offer(needsCheck(digits.length) ? finish(`${payload.slice(0, -1)}${digit}`) : `${payload.slice(0, -1)}${digit}`)
    }
  }
  // One more or less, wherever the carry lands
  for (const delta of [1n, -1n, 2n, -2n]) {
    const next = (BigInt(payload) + delta).toString()
    if (next.length === payload.length) offer(needsCheck(digits.length) ? finish(next) : next)
  }
  // One digit longer: cheaper, and still the same number to the eye. Where that length needs a
  // check digit, the check digit is the one more
  for (let digit = 0; digit <= 9; digit++) {
    const longer = `${payload}${digit}`
    if (needsCheck(digits.length)) offer(finish(longer))
    else if (needsCheck(longer.length)) {
      offer(finish(payload))
      break
    } else offer(longer)
  }
  return found.slice(0, ASKED)
}

/**
 * Free numbers near a taken one, `limit` at most, each `{ digits, name }`. Asked of the registry
 * in one multicall. Empty for anything but a number on the live registry.
 */
export async function readNearby(candidate, limit) {
  const { namespace, label } = candidate
  if (namespace.kind !== KIND.NUMBER || namespace.onchainId == null) return []
  const options = neighbours(label, namespace)
  const results = await publicClient().multicall({
    contracts: options.map((digits) => ({ address: registry.address, abi: registry.abi, functionName: 'lookup', args: [namespace.onchainId, digits] })),
    allowFailure: true,
  })
  return options
    .filter((_, index) => results[index].status === 'success' && results[index].result.available)
    .slice(0, limit)
    .map((digits) => ({ digits, name: formatNumber(digits, namespace) }))
}
