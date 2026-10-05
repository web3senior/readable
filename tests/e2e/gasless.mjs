// Buys a number with ETH, then empties the wallet and changes the name with no ETH at all: the
// wallet signs, the relayer behind /api/relay pays the network fee. The app must run with
// RELAYER_PRIVATE_KEY set to RELAYER_KEY of setup.mjs.
import { join } from 'node:path'
import { createPublicClient, http, isAddressEqual } from 'viem'
import { APP, BUYER, DOLLAR, OTHER, RELAYER, RPC, ethOf, launch, registryAbi, registryAddress, rpc, shotsDir, walletShim } from './setup.mjs'

// A four-digit number at the launch prices, for one year. E2E_LABEL picks another on a chain
// where this one is taken
const LABEL = process.env.E2E_LABEL ?? '4646'
const NUMBER = `+0 ${LABEL}`
const PRICE = 100n * DOLLAR
const NOTE = 'No network fee'

const reader = createPublicClient({ transport: http(RPC) })
const lookup = () => reader.readContract({ address: registryAddress(), abi: registryAbi, functionName: 'lookup', args: [1n, LABEL] })

// What the buyer held, given back at the end so the other scripts still find it
const held = await ethOf(BUYER)
const relayerBefore = await ethOf(RELAYER)

const browser = await launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, ignoreHTTPSErrors: true })
await context.addInitScript(walletShim, { rpc: RPC, account: BUYER })
const page = await context.newPage()
const problems = []
page.on('pageerror', (error) => problems.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(message.text().slice(0, 300))
})

const card = () => page.locator('article', { hasText: NUMBER })
const dialog = () => page.locator('dialog[open]')
const section = (name) => page.getByRole('region', { name, exact: true })
const toast = (text) => page.getByText(text, { exact: true }).waitFor({ timeout: 30000 })
const flat = async (locator) => (await locator.innerText()).replace(/\s+/g, ' ')
const check = (passed, message) => {
  if (!passed) problems.push(message)
}

try {
  // The purchase is an ordinary transaction: the price goes with it, in ETH
  await page.goto(`${APP}/?q=${LABEL}`, { waitUntil: 'networkidle' })
  const register = card().getByRole('button', { name: 'Register', exact: true })
  await register.waitFor({ timeout: 30000 })
  await register.click()
  await dialog().getByText('Browser wallet').click()
  await page.getByRole('button', { name: 'Account' }).waitFor({ timeout: 15000 })

  await register.click()
  console.log('dialog:', await flat(dialog()))
  check(!(await dialog().getByText(NOTE, { exact: false }).count()), 'the purchase promises no network fee')
  const beforePurchase = await ethOf(BUYER)
  await dialog().getByRole('button', { name: 'Register', exact: true }).click()
  await page.getByText(`${NUMBER} is yours`).waitFor({ timeout: 30000 })
  const spent = beforePurchase - (await ethOf(BUYER))
  check(spent >= PRICE && spent < PRICE + 10n ** 15n, `the purchase cost ${spent} wei, not the price and a fee`)
  check(isAddressEqual((await lookup()).owner, BUYER), 'the name is not the buyer’s')

  // The changes: not one wei left for a fee
  await rpc('anvil_setBalance', [BUYER, '0x0'])
  await page.goto(`${APP}/names/+0${LABEL}`, { waitUntil: 'networkidle' })
  await page.getByText(NOTE, { exact: false }).first().waitFor({ timeout: 30000 })

  await section('Points to').getByLabel('Wallet address').fill(OTHER)
  await section('Points to').getByRole('button', { name: 'Save' }).click()
  await toast(`${NUMBER} points at the wallet`)
  check(isAddressEqual((await lookup()).target, OTHER), 'the name does not point at the new wallet')

  await section('Records').getByLabel('Display name').fill('Gasless')
  await section('Records').getByRole('button', { name: 'Save records' }).click()
  await toast(`Records of ${NUMBER} saved`)

  check((await ethOf(BUYER)) === 0n, 'the holder paid a network fee')
  check((await ethOf(RELAYER)) < relayerBefore, 'the relayer paid nothing')

  await page.waitForTimeout(600)
  await page.screenshot({ path: join(shotsDir, 'gasless.png'), fullPage: true })
  console.log(`relayer spent ${relayerBefore - (await ethOf(RELAYER))} wei`)
} catch (error) {
  await page.screenshot({ path: join(shotsDir, 'gasless-failed.png'), fullPage: true }).catch(() => {})
  problems.push(error.message)
} finally {
  await rpc('anvil_setBalance', [BUYER, `0x${held.toString(16)}`])
  await browser.close()
}

console.log(problems.length ? problems.join('\n') : 'no problems: the holder changed the name with no ETH')
process.exitCode = problems.length ? 1 : 0
