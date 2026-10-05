// After names.mjs: the holder of a number sees its agent wallet (ERC-6551) on the name's page,
// points the name at it, moves out the ETH someone sent it (which creates the account first) and
// points the name back. A visitor sees where it points. The chain is read back after each step.
//
// Against a dev server that reads a public RPC (Robinhood Chain's own registry, a real name), send
// that RPC's requests to the fork and name the registry and the number:
//   E2E_APP=https://localhost:3003 E2E_FORWARD_RPC=https://rpc.mainnet.chain.robinhood.com \
//   E2E_REGISTRY=0x… E2E_NAME=alice.arc node tests/e2e/agentWallet.mjs
// The holder is impersonated on the fork, so it can be any account, a smart one included.
import { join } from 'node:path'
import { createPublicClient, http, isAddressEqual, parseEther, zeroHash } from 'viem'
import { APP, CHAIN_ID, OWNER, RPC, ethOf, launch, registryAbi, registryAddress, rpc, shotsDir, walletShim } from './setup.mjs'

const REGISTRY = process.env.E2E_REGISTRY ?? registryAddress()
const NAME = process.env.E2E_NAME ?? '+0 4343'
const FORWARD = process.env.E2E_FORWARD_RPC
const NUMBER = NAME.startsWith('+0 ')
const PAGE = `${APP}/names/${NAME.replace(' ', '')}`
const SENT = parseEther('0.02')
// ERC-6551's registry and Tokenbound's account proxy, as src/config/tokenBound.js names them
const ERC6551 = '0x000000006551c19487814612e58FE06813775758'
const PROXY = '0x55266d75D1a14E4572138116aF39863Ed6596E7F'
const accountAbi = [
  {
    type: 'function',
    name: 'account',
    stateMutability: 'view',
    inputs: [{ type: 'address' }, { type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }, { type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
]
const ownerAbi = [{ type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }]

const client = createPublicClient({ transport: http(RPC) })
const read = (functionName, args) => client.readContract({ address: REGISTRY, abi: registryAbi, functionName, args })
// A number is under the first namespace; a username, label.extension, under its extension
const [label, extension] = NUMBER ? [NAME.replace('+0 ', '')] : NAME.split('.')
const namespaceId = NUMBER ? 1n : (await read('getNamespaces')).find((namespace) => namespace.name === extension).id
const tokenId = await read('tokenIdOf', [namespaceId, label])
const holder = await read('ownerOf', [tokenId])
// Asked of the standard's registry, not computed as the app does, so the two are checked against each other
const wallet = await client.readContract({ address: ERC6551, abi: accountAbi, functionName: 'account', args: [PROXY, zeroHash, BigInt(CHAIN_ID), REGISTRY, tokenId] })
console.log('name:', JSON.stringify({ name: NAME, holder, wallet }))

await rpc('anvil_impersonateAccount', [holder])
await rpc('anvil_setBalance', [holder, '0x8ac7230489e80000'])
// Someone pays the name's own wallet before it exists
const funded = await rpc('eth_sendTransaction', [{ from: OWNER, to: wallet, value: `0x${SENT.toString(16)}` }])
await client.waitForTransactionReceipt({ hash: funded })

const browser = await launch()
const problems = []

async function open(account) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1300 }, ignoreHTTPSErrors: true })
  if (account) await context.addInitScript(walletShim, { rpc: RPC, account })
  if (FORWARD) {
    await context.route(`${FORWARD}/**`, async (route) => {
      const response = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: route.request().postData() })
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: await response.text() })
    })
  }
  // Every change here is the holder's own transaction; gasless.mjs covers the relay
  await context.route('**/api/relay', (route) => route.fulfill({ json: { enabled: false } }))
  await context.route('**/api/paymaster', (route) => route.fulfill({ json: { enabled: false } }))
  const page = await context.newPage()
  page.on('pageerror', (error) => problems.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text().slice(0, 300))
  })
  await page.goto(PAGE, { waitUntil: 'networkidle' })
  if (account) {
    await page.getByRole('button', { name: 'Connect its wallet' }).click()
    await page.locator('dialog[open]').getByText('Browser wallet').click()
  }
  return {
    page,
    section: (name) => page.getByRole('region', { name, exact: true }),
    toast: (text) => page.getByText(text, { exact: true }).waitFor({ timeout: 30000 }),
  }
}

const short = `${wallet.slice(0, 6)}…${wallet.slice(-4)}`

// --- THE HOLDER SEES ITS AGENT WALLET ---

const owner = await open(holder)
const panel = owner.section('Agent wallet')
await panel.waitFor({ timeout: 30000 })
await panel.getByText(short, { exact: true }).waitFor({ timeout: 30000 })
await panel.getByText('0.02 ETH', { exact: true }).waitFor({ timeout: 30000 })
await panel.getByText('Not created yet', { exact: true }).waitFor()
await panel.getByText('Everything in it goes with the name', { exact: false }).waitFor()
await owner.page.screenshot({ path: join(shotsDir, 'agent-wallet.png'), fullPage: true })

// --- POINTS THE NAME AT IT ---

await panel.getByRole('button', { name: `Point ${NAME} here` }).click()
await owner.toast(`${NAME} points at its agent wallet`)
if (!isAddressEqual(await read('resolve', [tokenId]), wallet)) problems.push('the name does not resolve to its agent wallet')
await owner.page.locator('aside').getByText('Its agent wallet', { exact: true }).waitFor({ timeout: 30000 })

// A visitor sees where it points, and nothing of the holder's
const visitor = await open(null)
await visitor.page.locator('aside').getByText('Its agent wallet', { exact: true }).waitFor({ timeout: 30000 })
if (await visitor.section('Agent wallet').count()) problems.push('a visitor is shown the agent wallet section')
await visitor.page.close()

// --- MOVES ITS ETH OUT, WHICH CREATES IT FIRST ---

const before = await ethOf(holder)
await panel.getByRole('button', { name: 'Move 0.02 ETH to your wallet' }).click()
await owner.toast(`The agent wallet of ${NAME} is created`)
await owner.toast('0.02 ETH moved to your wallet')
const [code, left, after] = await Promise.all([client.getCode({ address: wallet }), ethOf(wallet), ethOf(holder)])
const controller = await client.readContract({ address: wallet, abi: ownerAbi, functionName: 'owner' })
console.log('wallet:', JSON.stringify({ created: Boolean(code && code !== '0x'), owner: controller, left: left.toString(), gained: (after - before).toString() }))
if (!code || code === '0x') problems.push('the agent wallet was not created')
if (!isAddressEqual(controller, holder)) problems.push(`the agent wallet answers to ${controller}`)
if (left !== 0n) problems.push(`the agent wallet still holds ${left} wei`)
// The holder paid the gas of two transactions out of what arrived
if (after - before < SENT - parseEther('0.001')) problems.push(`the holder gained ${after - before} wei`)
await panel.getByText('Created', { exact: true }).waitFor({ timeout: 30000 })
await owner.page.screenshot({ path: join(shotsDir, 'agent-wallet-moved.png'), fullPage: true })

// --- POINTS IT BACK ---

await panel.getByRole('button', { name: `Point ${NAME} back at your wallet` }).click()
await owner.toast(`${NAME} points at your wallet`)
if (!isAddressEqual(await read('resolve', [tokenId]), holder)) problems.push('the name does not resolve to its holder again')

await rpc('anvil_stopImpersonatingAccount', [holder])
await browser.close()
// A dev server logs its own warnings to the console; only failures matter here
const failures = problems.filter((problem) => !/Download the React DevTools|Fast Refresh|\[HMR\]/.test(problem))
if (failures.length) {
  console.error('PROBLEMS:\n' + failures.join('\n'))
  process.exit(1)
}
console.log('agent wallet: ok')
