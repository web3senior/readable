// Registers +0 4343 against the registry admin.mjs set up (treasury set), then checks that the
// whole payment reached the treasury.
import { join } from 'node:path'
import { formatEther } from 'viem'
import { APP, BUYER, DOLLAR, RPC, TREASURY, ethOf, launch, shotsDir, walletShim } from './setup.mjs'

const browser = await launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, ignoreHTTPSErrors: true })
await context.addInitScript(walletShim, { rpc: RPC, account: BUYER })
const page = await context.newPage()
const problems = []
page.on('pageerror', (error) => problems.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(message.text().slice(0, 300))
})

const card = (name) => page.locator('article', { hasText: name })
const register = () => card('+0 4343').getByRole('button', { name: 'Register', exact: true })
const before = await ethOf(TREASURY)

await page.goto(`${APP}/?q=4343`, { waitUntil: 'networkidle' })
await register().waitFor({ timeout: 30000 })

await register().click()
await page.locator('dialog[open]').getByText('Browser wallet').click()
await page.getByRole('button', { name: 'Account' }).waitFor({ timeout: 15000 })

await register().click()
await page.locator('dialog[open]').getByRole('button', { name: 'Register', exact: true }).click()
await page.getByText('+0 4343 is yours').waitFor({ timeout: 30000 })

const paid = (await ethOf(TREASURY)) - before
console.log(`treasury received ${formatEther(paid)} ETH`)
if (paid !== 100n * DOLLAR) problems.push(`expected ${formatEther(100n * DOLLAR)} ETH to reach the treasury`)

await page.waitForTimeout(600)
await page.screenshot({ path: join(shotsDir, 'treasury.png'), fullPage: true })

console.log(problems.length ? problems.join('\n') : 'no page errors')
await browser.close()
if (problems.length) process.exit(1)
