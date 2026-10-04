import { READABLE_API, PROTOCOL } from './config.js'

/**
 * MetaMask's send field asks this Snap about whatever is typed that isn't an address. A Readable
 * number or name is resolved through readable.name's API, which reads the registry; anything
 * else is left to MetaMask and the other Snaps. From an address, the name it chose is shown.
 */

// A number as people write it: +0 4242 1230, +0-4242-1230, +042421230
const NUMBER = /^\+\d[\d\s\-().]*$/
// A username under an extension: alice.arc. ENS and other names are answered by the API with 404
const USERNAME = /^[^\s.]+\.[a-z]+$/i

const readableName = (text) => {
  const value = String(text ?? '').trim()
  return NUMBER.test(value) || USERNAME.test(value) ? value : null
}

async function getJson(path) {
  const response = await fetch(`${READABLE_API}${path}`)
  return response.ok ? response.json() : null
}

/** @type {import('@metamask/snaps-sdk').OnNameLookupHandler} */
export const onNameLookup = async ({ domain, address }) => {
  if (domain) {
    const name = readableName(domain)
    if (!name) return null
    // Read when the sender types it, so the wallet it shows is the one the name points to now
    const profile = await getJson(`/api/resolve/${encodeURIComponent(name)}`)
    if (!profile?.address) return null
    return { resolvedAddresses: [{ resolvedAddress: profile.address, protocol: PROTOCOL, domainName: profile.name }] }
  }
  if (address) {
    const answer = await getJson(`/api/reverse/${address}`)
    return answer?.name ? { resolvedDomains: [{ resolvedDomain: answer.name, protocol: PROTOCOL }] } : null
  }
  return null
}
