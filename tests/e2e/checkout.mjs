// Buying a name with LYX, end to end, on two forks: Robinhood Chain, where the registry is, and
// LUKSO, where LYX is paid, read through a stand-in for LUKSO's Blockscout that this script serves
// from the LUKSO fork (port 8547):
//   anvil --fork-url https://rpc.mainnet.chain.robinhood.com --chain-id 4663
//   anvil --fork-url https://rpc.mainnet.lukso.network --chain-id 42 --port 8546
// It buys numbers on the registry deployed there, which must sell Numbers. It moves the LUKSO
// fork's clock past its quotes, so each run needs that fork fresh. The app runs with:
//   NEXT_PUBLIC_READABLE_RPC=http://127.0.0.1:8545  NEXT_PUBLIC_LUKSO_RPC=http://127.0.0.1:8546
//   CHECKOUT_PRIVATE_KEY=<CHECKOUT_KEY below>  CHECKOUT_LYX_RECEIVER=<RECEIVER below>
//   CHECKOUT_LUKSO_EXPLORER=http://127.0.0.1:8547/api/v2
// Checked: a quote refused while the checkout wallet can't pay; a Universal Profile refused as a holder; a wallet's payment through the dialog, followed
// to the name; a real Universal Profile's payment through its `execute`; a claim made twice buying
// once; a late payment and one whose name was taken first, both refunds; LYX sent without a quote;
// and the list /admin reads. `node tests/e2e/checkout.mjs --explorer` serves the stand-in alone.
import { createServer } from 'node:http'
import { join } from 'node:path'
import { createPublicClient, encodeFunctionData, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { APP, BUYER, EDITOR, RPC, launch, registryAbi, rpc, shotsDir } from './setup.mjs'

const LUKSO = process.env.E2E_LUKSO_RPC ?? 'http://127.0.0.1:8546'
const EXPLORER_PORT = Number(process.env.E2E_EXPLORER_PORT ?? 8547)
const REGISTRY = process.env.E2E_REGISTRY ?? '0x8085d2351F5Bb3675549683495134fc9B4D8A2F9'
// Anvil's sixth default account pays for the names; a public key, for a local chain only
export const CHECKOUT_KEY = '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba'
export const RECEIVER = `0x${'1e'.repeat(20)}`
const CHECKOUT_WALLET = privateKeyToAccount(CHECKOUT_KEY).address
// Anvil's third and fourth accounts pay late and take a name first
const LATE_PAYER = '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc'
const RIVAL = '0x90f79bf6eb2c4f870365e785982e1f101e93b906'
// A Universal Profile on LUKSO and a controller that calls its `execute` directly (LSP20), seen
// sending LYX on 2026-10-06
const PROFILE = '0xbcafa8114916380e5b626315f15c658da2049156'
const CONTROLLER = '0x4d900e3f0f1b35f179794706a7bd82ce99dc9616'
const CONFIRMATIONS = 12

const problems = []
const check = (ok, message) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`)
  if (!ok) problems.push(message)
}

// --- LUKSO ---

let rpcId = 0
const lukso = async (method, params = []) => {
  const response = await fetch(LUKSO, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  })
  const body = await response.json()
  if (body.error) throw new Error(`${method}: ${body.error.message}`)
  return body.result
}
const hex = (value) => `0x${BigInt(value).toString(16)}`
const mine = (blocks) => lukso('anvil_mine', [hex(blocks)])

async function waitForReceipt(call, hash) {
  for (let i = 0; i < 60; i++) {
    const receipt = await call('eth_getTransactionReceipt', [hash])
    if (receipt) return receipt
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`no receipt for ${hash}`)
}

// --- A stand-in for LUKSO's Blockscout, the few reads the checkout makes ---

// Where the fork left LUKSO: what was mined after it is what the stand-in lists
const forkBlock = BigInt((await lukso('anvil_nodeInfo')).forkConfig.forkBlockNumber)

async function txView(hash) {
  const tx = await lukso('eth_getTransactionByHash', [hash])
  if (!tx) return null
  const receipt = await lukso('eth_getTransactionReceipt', [hash])
  const latest = BigInt(await lukso('eth_blockNumber'))
  const block = receipt ? await lukso('eth_getBlockByNumber', [receipt.blockNumber, false]) : null
  const ok = receipt?.status === '0x1'
  return {
    hash,
    from: { hash: tx.from },
    to: tx.to ? { hash: tx.to } : null,
    value: BigInt(tx.value).toString(),
    raw_input: tx.input,
    status: receipt ? (ok ? 'ok' : 'error') : null,
    result: receipt ? (ok ? 'success' : 'Reverted') : 'pending',
    block_number: receipt ? Number(receipt.blockNumber) : null,
    timestamp: block ? new Date(Number(block.timestamp) * 1000).toISOString() : null,
    confirmations: receipt ? Number(latest - BigInt(receipt.blockNumber) + 1n) : 0,
  }
}

async function internals(hash) {
  const trace = await lukso('debug_traceTransaction', [hash, { tracer: 'callTracer' }])
  const items = []
  const walk = (frame, top) => {
    if (!top) {
      items.push({
        type: frame.type.toLowerCase(),
        from: { hash: frame.from },
        to: frame.to ? { hash: frame.to } : null,
        value: BigInt(frame.value ?? '0x0').toString(),
        success: !frame.error,
        transaction_hash: hash,
      })
    }
    for (const call of frame.calls ?? []) walk(call, false)
  }
  walk(trace, true)
  return items
}

// Every transaction the fork mined since this script began, to list what an address received
async function minedHashes() {
  const latest = BigInt(await lukso('eth_blockNumber'))
  const hashes = []
  for (let number = forkBlock + 1n; number <= latest; number++) {
    const block = await lukso('eth_getBlockByNumber', [hex(number), false])
    hashes.push(...block.transactions)
  }
  return hashes
}

const same = (a, b) => Boolean(a && b) && a.toLowerCase() === b.toLowerCase()

async function explorerAnswer(path) {
  let match = path.match(/^\/api\/v2\/transactions\/(0x[0-9a-fA-F]{64})(\/internal-transactions)?$/)
  if (match) {
    const view = await txView(match[1])
    if (!view) return null
    return match[2] ? { items: view.status ? await internals(match[1]) : [], next_page_params: null } : view
  }
  match = path.match(/^\/api\/v2\/addresses\/(0x[0-9a-fA-F]{40})(\/transactions|\/internal-transactions)?$/)
  if (!match) return null
  const [, address, list] = match
  if (!list) return { hash: address, is_contract: (await lukso('eth_getCode', [address, 'latest'])) !== '0x' }
  const items = []
  for (const hash of (await minedHashes()).reverse()) {
    if (list === '/transactions') {
      const view = await txView(hash)
      if (same(view.to?.hash, address)) items.push(view)
    } else {
      items.push(...(await internals(hash)).filter((item) => same(item.to?.hash, address)))
    }
  }
  return { items, next_page_params: null }
}

const explorer = createServer(async (request, response) => {
  try {
    const answer = await explorerAnswer(new URL(request.url, 'http://localhost').pathname)
    response.writeHead(answer ? 200 : 404, { 'content-type': 'application/json' })
    response.end(JSON.stringify(answer ?? { message: 'Not found' }))
  } catch (error) {
    response.writeHead(500, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ message: error.message }))
  }
})
await new Promise((resolve) => explorer.listen(EXPLORER_PORT, '127.0.0.1', resolve))

// With --explorer, only the stand-in, until stopped: for trying the dialog or /admin by hand
if (process.argv.includes('--explorer')) {
  console.log(`LUKSO explorer stand-in on http://127.0.0.1:${EXPLORER_PORT}/api/v2`)
  await new Promise(() => {})
}

// --- The registry ---

const robinhood = createPublicClient({ transport: http(RPC) })
const read = (functionName, args) => robinhood.readContract({ address: REGISTRY, abi: registryAbi, functionName, args })
const numbers = (await read('getNamespaces')).find((namespace) => namespace.kind === 1)
if (!numbers) throw new Error('The registry sells no numbers')
const lookup = (label) => read('lookup', [numbers.id, label])
const ethOn = async (call, address) => BigInt(await call('eth_getBalance', [address, 'latest']))

// A free number of the shortest length that needs no check digit, different on each run
async function freeNumber() {
  for (;;) {
    const length = Math.max(Number(numbers.minLength), 6)
    const label = String(Math.floor(10 ** (length - 1) + Math.random() * 9 * 10 ** (length - 1)))
    if ((await lookup(label)).available) return label
  }
}

// --- The app ---

const api = async (path, body) => {
  const response = await fetch(`${APP}${path}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {})
  return { status: response.status, body: await response.json() }
}
const quoteFor = (label, to) => api('/api/checkout', { namespaceId: String(numbers.id), label, to, years: 1 })
const claim = (hash) => api('/api/checkout/claim', { hash })

async function claimUntil(hash, statuses) {
  let answer
  for (let i = 0; i < 30; i++) {
    answer = (await claim(hash)).body
    if (statuses.includes(answer.status)) return answer
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  return answer
}

// Pays a quote on LUKSO from `from`, an unlocked or impersonated account; resolves with the hash
const pay = async (from, quote) => {
  const hash = await lukso('eth_sendTransaction', [{ from, to: quote.to, value: hex(quote.amount), data: quote.data }])
  await waitForReceipt(lukso, hash)
  return hash
}

try {
  const status = (await api('/api/checkout')).body
  check(status.enabled && same(status.receiver, RECEIVER) && same(status.wallet, CHECKOUT_WALLET), `checkout on: ${JSON.stringify(status)}`)
  const walletBefore = await ethOn(rpc, CHECKOUT_WALLET)

  // A checkout wallet that can't pay for the name takes no LYX for it
  await rpc('anvil_setBalance', [CHECKOUT_WALLET, hex(10n ** 12n)])
  const short = await quoteFor(await freeNumber(), BUYER)
  check(short.status === 503 && /can’t be bought with LYX/.test(short.body.error), `a name the checkout wallet can't buy refused: ${short.body.error}`)
  await rpc('anvil_setBalance', [CHECKOUT_WALLET, hex(walletBefore)])

  // A Universal Profile lives on LUKSO alone, so it can't hold the name
  const refused = await quoteFor(await freeNumber(), PROFILE)
  check(refused.status === 400 && /Universal Profile/.test(refused.body.error), `a profile refused as holder: ${refused.body.error}`)

  // --- A wallet pays through the dialog ---
  const dialogLabel = await freeNumber()
  const dialogName = `+${numbers.name} ${dialogLabel}`
  const browser = await launch()
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
  await context.addInitScript(
    ({ rpcs, account, start }) => {
      let chainId = start
      let id = 0
      const call = async (method, params = []) => {
        const response = await fetch(rpcs[chainId], {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
        })
        const body = await response.json()
        if (body.error) throw Object.assign(new Error(body.error.message), { code: body.error.code, data: body.error.data })
        return body.result
      }
      window.ethereum = {
        request: async ({ method, params = [] }) => {
          if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [account]
          if (method === 'eth_chainId') return `0x${chainId.toString(16)}`
          if (method === 'wallet_switchEthereumChain') {
            const next = parseInt(params[0].chainId, 16)
            if (!rpcs[next]) throw Object.assign(new Error('Unrecognized chain'), { code: 4902 })
            chainId = next
            return null
          }
          if (method === 'wallet_addEthereumChain') return null
          if (method === 'wallet_requestPermissions' || method === 'wallet_getPermissions') return [{ parentCapability: 'eth_accounts' }]
          if (method === 'eth_sendTransaction') params[0] = { ...params[0], from: account }
          return call(method, params)
        },
        on: () => {},
        removeListener: () => {},
      }
    },
    { rpcs: { 4663: RPC, 42: LUKSO }, account: BUYER, start: 4663 }
  )
  const page = await context.newPage()
  page.on('pageerror', (error) => problems.push(`page: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text().slice(0, 300)}`)
  })

  const card = page.locator('article', { hasText: dialogName })
  const register = () => card.getByRole('button', { name: 'Register', exact: true })
  // Not networkidle: the latest activity reads the registry's whole history, slow on some RPCs
  await page.goto(`${APP}/?q=${dialogLabel}`, { waitUntil: 'domcontentloaded' })
  await register().waitFor({ timeout: 60000 })
  await register().click()
  await page.locator('dialog[open]').getByText('Browser wallet').click()
  await page.getByRole('button', { name: 'Account' }).waitFor({ timeout: 15000 })
  await register().click()

  const dialog = page.locator('dialog[open]')
  await dialog.getByRole('button', { name: 'LYX', exact: true }).click()
  const payButton = dialog.getByRole('button', { name: /^Pay .* LYX$/ })
  await payButton.waitFor({ timeout: 30000 })
  console.log('dialog:', (await dialog.innerText()).replace(/\s+/g, ' '))
  await page.screenshot({ path: join(shotsDir, 'checkout-dialog.png') })
  const receivedBefore = await ethOn(lukso, RECEIVER)
  await payButton.click()

  await page.getByText(/Waiting for LUKSO to confirm/).waitFor({ timeout: 60000 })
  const paidOnLukso = (await ethOn(lukso, RECEIVER)) - receivedBefore
  check(paidOnLukso > 0n, `the wallet paid ${paidOnLukso} wei of LYX to the receiver`)
  await page.screenshot({ path: join(shotsDir, 'checkout-pending.png') })
  await mine(CONFIRMATIONS)
  await page.getByText(`${dialogName} is yours`).waitFor({ timeout: 60000 })
  const dialogInfo = await lookup(dialogLabel)
  check(same(dialogInfo.owner, BUYER), `${dialogName} registered to the buyer`)
  await page.screenshot({ path: join(shotsDir, 'checkout-done.png') })
  const pending = await page.evaluate(() => localStorage.getItem('readable:checkout'))
  check(pending === '[]', `the browser forgot the finished payment: ${pending}`)
  await browser.close()

  // --- A Universal Profile pays through its own execute ---
  const profileLabel = await freeNumber()
  const profileQuote = (await quoteFor(profileLabel, EDITOR)).body
  check(Boolean(profileQuote.data), `quote for a profile's payment: ${profileQuote.amount} wei of LYX`)
  await lukso('anvil_setBalance', [PROFILE, hex(10n ** 24n)])
  await lukso('anvil_setBalance', [CONTROLLER, hex(10n ** 20n)])
  await lukso('anvil_impersonateAccount', [CONTROLLER])
  const execute = encodeFunctionData({
    abi: parseAbi(['function execute(uint256 operationType, address target, uint256 value, bytes data) payable returns (bytes)']),
    args: [0n, RECEIVER, BigInt(profileQuote.amount), profileQuote.data],
  })
  const profileHash = await lukso('eth_sendTransaction', [{ from: CONTROLLER, to: PROFILE, data: execute }])
  const profileReceipt = await waitForReceipt(lukso, profileHash)
  check(profileReceipt.status === '0x1', 'the profile sent the LYX')
  const early = (await claim(profileHash)).body
  check(early.status === 'pending' && early.confirmations < CONFIRMATIONS, `claimed before ${CONFIRMATIONS} blocks: ${early.status} ${early.confirmations}`)
  await mine(CONFIRMATIONS)
  const profileDone = await claimUntil(profileHash, ['done', 'refund', 'blocked', 'unpaid'])
  check(profileDone.status === 'done' && same(profileDone.payer, PROFILE), `the profile's payment bought the name: ${profileDone.status}, payer ${profileDone.payer}`)
  check(same((await lookup(profileLabel)).owner, EDITOR), `+${numbers.name} ${profileLabel} registered to the holder the quote names`)

  // A claim made again buys nothing more
  const walletMid = await ethOn(rpc, CHECKOUT_WALLET)
  const again = (await claim(profileHash)).body
  check(again.status === 'done' && (await ethOn(rpc, CHECKOUT_WALLET)) === walletMid, 'a second claim of the same payment spends nothing')

  // --- Someone registers the name between the quote and the payment ---
  const takenLabel = await freeNumber()
  const takenQuote = (await quoteFor(takenLabel, LATE_PAYER)).body
  const takenPrice = (await lookup(takenLabel)).pricePerYear
  const rivalHash = await rpc('eth_sendTransaction', [
    { from: RIVAL, to: REGISTRY, value: hex(takenPrice), data: encodeFunctionData({ abi: registryAbi, functionName: 'register', args: [numbers.id, takenLabel, 1n] }) },
  ])
  await waitForReceipt(rpc, rivalHash)
  const takenHash = await pay(LATE_PAYER, takenQuote)
  await mine(CONFIRMATIONS)
  const taken = (await claim(takenHash)).body
  check(taken.status === 'refund' && taken.reason === 'taken', `a name taken first is a refund: ${taken.status} ${taken.reason}`)
  check(same((await lookup(takenLabel)).owner, RIVAL), 'and it stays the rival’s')

  // --- Paid after the quote ran out. Last: it moves the fork's clock past every quote made so far ---
  const lateLabel = await freeNumber()
  const lateQuote = (await quoteFor(lateLabel, LATE_PAYER)).body
  const latestBlock = await lukso('eth_getBlockByNumber', ['latest', false])
  await lukso('evm_setNextBlockTimestamp', [hex(Math.max(Number(latestBlock.timestamp) + 1, Math.ceil(lateQuote.expiresAt / 1000) + 60))])
  const lateHash = await pay(LATE_PAYER, lateQuote)
  await mine(CONFIRMATIONS)
  const late = (await claim(lateHash)).body
  check(late.status === 'refund' && late.reason === 'late', `a late payment is a refund: ${late.status} ${late.reason}`)
  check((await lookup(lateLabel)).available, 'and its name stays free')

  // --- LYX sent with no quote ---
  const strayHash = await lukso('eth_sendTransaction', [{ from: LATE_PAYER, to: RECEIVER, value: hex(10n ** 18n) }])
  await waitForReceipt(lukso, strayHash)
  check((await claim(strayHash)).body.status === 'foreign', 'LYX without a quote is no payment for a name')

  // --- What /admin lists ---
  const list = (await api('/api/checkout/payments')).body
  const statusOf = (hash) => list.payments?.find((payment) => same(payment.hash, hash))?.status
  console.log('admin list:', list.payments?.map((payment) => `${payment.status}${payment.reason ? `:${payment.reason}` : ''} ${payment.quote?.label ?? '-'}`).join(', '))
  check(statusOf(profileHash) === 'done' && statusOf(lateHash) === 'refund' && statusOf(takenHash) === 'refund' && statusOf(strayHash) === 'foreign', 'the list shows each payment where it stands')

  // Two names bought: the checkout wallet paid their prices and the gas, nothing more
  const spent = walletBefore - (await ethOn(rpc, CHECKOUT_WALLET))
  const prices = dialogInfo.pricePerYear + (await lookup(profileLabel)).pricePerYear
  check(spent >= prices && spent < prices + 10n ** 16n, `the checkout wallet spent ${spent} wei for ${prices} wei of names`)
} catch (error) {
  problems.push(error.stack ?? error.message)
} finally {
  explorer.close()
}

console.log(problems.length ? `\n${problems.join('\n')}` : '\nall checks passed')
if (problems.length) process.exit(1)
