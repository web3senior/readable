/**
 * Pins a file on IPFS through Filebase's RPC, retrying what a retry can fix. Ported from Hup
 * (`hupsocial/src/lib/filebase.js`): the same call and the same retry, with its settings in
 * `config/ipfs.js`. Server-only: it carries the token.
 */
import { ipfs } from '@/config/ipfs'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Whether uploads can be pinned here at all. */
export const filebaseConfigured = () => Boolean(process.env.FILEBASE_IPFS_RPC_TOKEN?.trim())

// An answer from Filebase is final unless it is its own trouble or a rate limit; no answer at
// all (a dropped socket, a timeout) is worth another try
const retryable = (error) => (error?.status ? error.status >= 500 || error.status === 429 : true)

/**
 * The CID of the file Filebase pinned, without `ipfs://`.
 * @param {() => FormData} buildForm A factory, not a value: a FormData carrying a Blob is spent
 *   by the attempt that sends it, and a reused one sends an empty body the second time.
 */
export async function addToFilebase(buildForm) {
  const { attempts, backoffMs, timeoutMs } = ipfs.retry
  let lastError

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(ipfs.rpcAddUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.FILEBASE_IPFS_RPC_TOKEN}` },
        body: buildForm(),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!response.ok) {
        const error = new Error(`Filebase RPC ${response.status}: ${(await response.text().catch(() => '')).slice(0, 200)}`)
        error.status = response.status
        throw error
      }
      // One JSON object per line; a single file is the one-line case
      const [entry] = (await response.text())
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line))
      if (!entry?.Hash) throw new Error('Filebase RPC returned no CID')
      return entry.Hash
    } catch (error) {
      lastError = error
      if (attempt === attempts || !retryable(error)) break
      await sleep(backoffMs[Math.min(attempt, backoffMs.length) - 1])
    }
  }
  throw lastError
}
