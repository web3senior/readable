// After agentWallet.mjs: the holder of a name transfers it from My names to another wallet, which
// sends it back from the name's page. Mistyped addresses are refused before the wallet is asked.
// The registry is read back after each transfer: the name points at its new holder, its records
// are gone and it is no longer the sender's primary name.
//
// Against a dev server that reads a public RPC (Base Sepolia's own registry, a real name), send
// that RPC's requests to the fork and name the registry and the name:
//   E2E_APP=https://localhost:3003 E2E_FORWARD_RPC=https://sepolia.base.org \
//   E2E_REGISTRY=0x… E2E_NAME=alice.arc node tests/e2e/transfer.mjs
// The holder is impersonated on the fork, so it can be any account, a smart one included.
import { join } from 'node:path'
import { createPublicClient, createWalletClient, http, isAddressEqual, zeroHash } from 'viem'
import { APP, CHAIN_ID, EDITOR, RPC, launch, registryAbi, registryAddress, rpc, shotsDir, walletShim } from './setup.mjs'

const REGISTRY = process.env.E2E_REGISTRY ?? registryAddress()
const NAME = process.env.E2E_NAME ?? '+0 4343'
const FORWARD = process.env.E2E_FORWARD_RPC
const NUMBER = NAME.startsWith('+0 ')
const PAGE = `${APP}/names/${NAME.replace(' ', '-')}`
// Anvil's fourth account takes the name: it is unlocked, so it can send it back
const RECIPIENT = EDITOR
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

const client = createPublicClient({ transport: http(RPC) })
const read = (functionName, args) => client.readContract({ address: REGISTRY, abi: registryAbi, functionName, args })
// A number is under the first namespace; a username, label.extension, under its extension
const [label, extension] = NUMBER ? [NAME.replace('+0 ', '')] : NAME.split('.')
const namespaceId = NUMBER ? 1n : (await read('getNamespaces')).find((namespace) => namespace.name === extension).id
const tokenId = await read('tokenIdOf', [namespaceId, label])
const holder = await read('ownerOf', [tokenId])
const wallet = await client.readContract({ address: ERC6551, abi: accountAbi, functionName: 'account', args: [PROXY, zeroHash, BigInt(CHAIN_ID), REGISTRY, tokenId] })
// A registry deployed before editors has no generationOf
const generationOf = () => read('generationOf', [tokenId]).catch(() => null)
const generation = await generationOf()
// primaryNameOf answers the token id and the name as written
const primaryOf = async (account) => (await read('primaryNameOf', [account]))[0]

await rpc('anvil_impersonateAccount', [holder])
await rpc('anvil_setBalance', [holder, '0x8ac7230489e80000'])

// Records and the primary name, so the transfer has something to leave behind
const holderWallet = createWalletClient({ account: holder, transport: http(RPC) })
const send = async (functionName, args) => {
  const hash = await holderWallet.writeContract({ chain: null, address: REGISTRY, abi: registryAbi, functionName, args })
  await client.waitForTransactionReceipt({ hash })
}
await send('setText', [tokenId, 'records', JSON.stringify({ v: 1, name: 'Before' })])
await send('setPrimaryName', [tokenId])
console.log('name:', JSON.stringify({ name: NAME, holder, primary: (await primaryOf(holder)) === tokenId, records: await read('text', [tokenId, 'records']) }))

const browser = await launch()
const problems = []

// A browser of its own for each wallet, connected on the name's page
async function open(account) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1300 }, ignoreHTTPSErrors: true })
  await context.addInitScript(walletShim, { rpc: RPC, account })
  if (FORWARD) {
    await context.route(`${FORWARD}/**`, async (route) => {
      const response = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: route.request().postData() })
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: await response.text() })
    })
  }
  const page = await context.newPage()
  page.on('pageerror', (error) => problems.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text().slice(0, 300))
  })
  await page.goto(PAGE, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Connect its wallet' }).click()
  await page.locator('dialog[open]').getByText('Browser wallet').click()
  return {
    page,
    section: (name) => page.getByRole('region', { name, exact: true }),
    toast: (text) => page.getByText(text, { exact: true }).first().waitFor({ timeout: 30000 }),
  }
}

// --- MISTYPED ADDRESSES ARE REFUSED ON THE NAME'S PAGE ---

const owner = await open(holder)
const panel = owner.section('Transfer')
await panel.waitFor({ timeout: 30000 })
const refusals = [
  ['not-an-address', 'That is not a valid address'],
  [holder, 'This wallet holds it already'],
  [REGISTRY, 'The registry can’t hold names'],
  [wallet, 'A name can’t be sent to its own agent wallet'],
]
for (const [typed, refusal] of refusals) {
  await panel.getByLabel('New holder’s address').fill(typed)
  await panel.getByRole('button', { name: 'Transfer', exact: true }).click()
  await owner.toast(refusal)
}
if (!isAddressEqual(await read('ownerOf', [tokenId]), holder)) problems.push('a refused address took the name')

// --- THE HOLDER TRANSFERS IT FROM MY NAMES ---

await owner.page.locator('main').getByRole('link', { name: 'My names', exact: true }).first().click()
const card = owner.page.locator('article').filter({ has: owner.page.getByRole('heading', { name: NAME, exact: true }) })
await card.waitFor({ timeout: 30000 })
await card.getByRole('button', { name: 'Transfer', exact: true }).click()
const dialog = owner.page.locator('dialog[open]')
await dialog.getByText('arrives pointing at its new holder', { exact: false }).waitFor()
await dialog.getByLabel('New holder’s address').fill(RECIPIENT)
await owner.page.screenshot({ path: join(shotsDir, 'transfer.png'), fullPage: true })
await dialog.getByRole('button', { name: 'Transfer', exact: true }).click()
await owner.toast(`${NAME} is transferred`)
// The list drops the name once it is mined
await card.waitFor({ state: 'detached', timeout: 30000 })

const [moved, target, stored, primary, generationAfter] = await Promise.all([
  read('ownerOf', [tokenId]),
  read('resolve', [tokenId]),
  read('text', [tokenId, 'records']),
  primaryOf(holder),
  generationOf(),
])
console.log('transferred:', JSON.stringify({ holder: moved, target, records: stored, generation: generationAfter?.toString() }))
if (!isAddressEqual(moved, RECIPIENT)) problems.push(`the name is held by ${moved}, not the recipient`)
if (!isAddressEqual(target, RECIPIENT)) problems.push(`the name points at ${target}, not its new holder`)
if (stored) problems.push('the records survived the transfer')
if (primary === tokenId) problems.push('the name is still the sender’s primary name')
if (generation !== null && generationAfter !== generation + 1n) problems.push(`the generation went from ${generation} to ${generationAfter}`)

// --- THE RECIPIENT SENDS IT BACK FROM THE NAME'S PAGE ---

const recipient = await open(RECIPIENT)
const back = recipient.section('Transfer')
await back.waitFor({ timeout: 30000 })
await back.getByLabel('New holder’s address').fill(holder)
await back.getByRole('button', { name: 'Transfer', exact: true }).click()
await recipient.toast(`${NAME} is transferred`)
// The page turns into a visitor's once it is mined
await back.waitFor({ state: 'detached', timeout: 30000 })
if (!isAddressEqual(await read('ownerOf', [tokenId]), holder)) problems.push('the name did not come back to its holder')
if (!isAddressEqual(await read('resolve', [tokenId]), holder)) problems.push('the name does not point at its holder again')
await recipient.page.screenshot({ path: join(shotsDir, 'transfer-back.png'), fullPage: true })

await rpc('anvil_stopImpersonatingAccount', [holder])
await browser.close()
// A dev server logs its own warnings to the console; only failures matter here
const failures = problems.filter((problem) => !/Download the React DevTools|Fast Refresh|\[HMR\]/.test(problem))
if (failures.length) {
  console.error('PROBLEMS:\n' + failures.join('\n'))
  process.exit(1)
}
console.log('transfer: ok')
