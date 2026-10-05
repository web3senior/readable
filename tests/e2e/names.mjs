// As the buyer, opens My names against the registry the earlier scripts filled, then the page of
// +0 4343, where it points the name at another wallet, makes it the primary name, saves its
// records and its Bitcoin and Solana addresses, then reads them all back from the registry.
import { join } from 'node:path'
import { btc, sol } from '@ensdomains/address-encoder/coins'
import { bytesToHex, createPublicClient, getAddress, hexToBytes, http, isAddressEqual } from 'viem'
import { APP, BUYER, LONG_NUMBER, OTHER, RPC, launch, registryAbi, registryAddress, shotsDir, walletShim } from './setup.mjs'

const NAME = '+0 4343'
// Profiles are pasted as links and stored as handles
const RECORDS = { name: 'Alice', url: 'https://alice.example', payment: OTHER, x: 'https://x.com/alice?s=20', hup: 'https://www.hup.social/@Alice_L' }
const CHAINS = { btc: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', sol: 'So11111111111111111111111111111111111111112' }

const browser = await launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 1100 }, ignoreHTTPSErrors: true })
await context.addInitScript(walletShim, { rpc: RPC, account: BUYER })
const page = await context.newPage()
const problems = []
page.on('pageerror', (error) => problems.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(message.text().slice(0, 300))
})

const dialog = () => page.locator('dialog[open]')
const card = (text) => page.locator('article', { hasText: text })
const toast = (text) => page.getByText(text, { exact: true }).waitFor({ timeout: 30000 })
const flat = async (locator) => (await locator.innerText()).replace(/\s+/g, ' ')

await page.goto(`${APP}/names`, { waitUntil: 'networkidle' })
await page.getByRole('status').getByRole('button', { name: 'Connect wallet' }).click()
await dialog().getByText('Browser wallet').click()
await card(NAME).waitFor({ timeout: 30000 })
for (const held of [NAME, LONG_NUMBER]) console.log('holds:', await flat(card(held)))

// Every change is made on the name's own page, opened from its card
await card(NAME).getByRole('link', { name: 'Manage' }).click()
await page.waitForURL((url) => url.pathname === '/names/+04343')
const section = (name) => page.getByRole('region', { name, exact: true })

await section('Points to').getByLabel('Wallet address').fill('not-an-address')
await section('Points to').getByRole('button', { name: 'Save' }).click()
await toast('That is not a valid address')
await section('Points to').getByLabel('Wallet address').fill(OTHER)
await section('Points to').getByRole('button', { name: 'Save' }).click()
await toast(`${NAME} points at the wallet`)

await section('Primary name').getByRole('button', { name: 'Make primary' }).click()
await toast(`${NAME} is your primary name`)
await page.locator('aside').getByText('Primary', { exact: true }).waitFor({ timeout: 30000 })

await section('Records').getByLabel('Display name').fill(RECORDS.name)
await section('Records').getByLabel('Website').fill('alice.example')
await section('Records').getByRole('button', { name: 'Save records' }).click()
await toast('Website must be an https://, ipfs:// or ar:// link')
await section('Records').getByLabel('Website').fill(RECORDS.url)
await section('Records').getByLabel('Email').fill('alice-at-example')
await section('Records').getByRole('button', { name: 'Save records' }).click()
await toast('Email is not a valid email address')
await section('Records').getByLabel('Email').fill('')
await section('Records').getByLabel('X', { exact: true }).fill(RECORDS.x)
await section('Records').getByLabel('Hup', { exact: true }).fill(RECORDS.hup)
await section('Records').getByLabel('Agent payment address').fill(RECORDS.payment)
await section('Records').getByRole('button', { name: 'Save records' }).click()
await toast(`Records of ${NAME} saved`)

await section('Other chains').getByLabel('Bitcoin address').fill('bc1-not-an-address')
await section('Other chains').getByRole('button', { name: 'Save addresses' }).click()
await toast('That is not a valid Bitcoin address')
await section('Other chains').getByLabel('Bitcoin address').fill(CHAINS.btc)
await section('Other chains').getByLabel('Solana address').fill(CHAINS.sol)
await section('Other chains').getByRole('button', { name: 'Save addresses' }).click()
await toast(`Addresses of ${NAME} saved`)

// Back on My names, the card shows what was saved
await page.locator('main').getByRole('link', { name: 'My names' }).click()
await card(NAME).getByText('5 of 16 filled').waitFor({ timeout: 30000 })
await card(NAME).getByText('Bitcoin and Solana').waitFor({ timeout: 30000 })
console.log('after:', await flat(card(NAME)))

// Saved again as they are, nothing is sent
await card(NAME).getByRole('link', { name: 'Manage' }).click()
await section('Other chains').getByRole('button', { name: 'Save addresses' }).click()
await toast('Nothing changed')

await page.waitForTimeout(600)
await page.screenshot({ path: join(shotsDir, 'names.png'), fullPage: true })

// What the page did is what the registry holds
const client = createPublicClient({ transport: http(RPC) })
const read = (functionName, args) => client.readContract({ address: registryAddress(), abi: registryAbi, functionName, args })
const tokenId = await read('tokenIdOf', [1n, '4343'])
const [target, [primaryId, primaryName], stored, btcBytes, solBytes] = await Promise.all([
  read('resolve', [tokenId]),
  read('primaryNameOf', [BUYER]),
  read('text', [tokenId, 'records']),
  read('addr', [tokenId, BigInt(btc.coinType)]),
  read('addr', [tokenId, BigInt(sol.coinType)]),
])
console.log('registry:', JSON.stringify({ target, primaryName, stored, btcBytes, solBytes }))

// Addresses are stored in their checksummed form
const expected = JSON.stringify({
  v: 1,
  name: RECORDS.name,
  url: RECORDS.url,
  social: { x: 'alice', hup: 'alice_l' },
  agent: { payment: getAddress(RECORDS.payment) },
})
if (!isAddressEqual(target, OTHER)) problems.push(`the name resolves to ${target}`)
if (primaryId !== tokenId) problems.push('the name is not the primary name')
if (stored !== expected) problems.push(`records are ${stored}, expected ${expected}`)
// Kept as ENS keeps them: the chain's binary form, which turns back into what was typed
if (btcBytes !== bytesToHex(btc.decode(CHAINS.btc))) problems.push(`the Bitcoin address is stored as ${btcBytes}`)
if (sol.encode(hexToBytes(solBytes)) !== CHAINS.sol) problems.push(`the Solana address is stored as ${solBytes}`)

console.log(problems.length ? problems.join('\n') : 'no page errors')
await browser.close()
if (problems.length) process.exit(1)
