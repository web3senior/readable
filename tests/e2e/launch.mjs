// As the owner on /admin, takes a freshly deployed registry through its setup guide: Numbers at
// the launch prices, in ETH. The site must already read the registry.
import { join } from 'node:path'
import { APP, OWNER, RPC, launch, shotsDir, walletShim } from './setup.mjs'

const browser = await launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 1100 }, ignoreHTTPSErrors: true })
await context.addInitScript(walletShim, { rpc: RPC, account: OWNER })
const page = await context.newPage()
const problems = []
page.on('pageerror', (error) => problems.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(message.text().slice(0, 300))
})

const dialog = () => page.locator('dialog[open]')
const guide = () => page.getByLabel('Finish setting up')
const toast = (text) => page.getByText(text, { exact: true }).waitFor({ timeout: 30000 })
const flat = async (locator) => (await locator.innerText()).replace(/\s+/g, ' ')

await page.goto(`${APP}/admin`, { waitUntil: 'networkidle' })
await page.getByRole('status').getByRole('button', { name: 'Connect wallet' }).click()
await dialog().getByText('Browser wallet').click()
await page.getByRole('button', { name: 'Account' }).waitFor({ timeout: 15000 })
console.log('guide:', await flat(guide()))

// Names are paid in ETH, so there is no payment token to set first
if (await guide().getByText('Payment token').count()) problems.push('the guide still asks for a payment token')

await guide().getByRole('button', { name: 'Add numbers' }).click()
console.log('numbers form:', await flat(dialog()))
await dialog().getByRole('button', { name: 'Add namespace' }).click()
await toast('+0 added')
await page.locator('article', { hasText: '+0' }).getByText('0.5 ETH').waitFor({ timeout: 30000 })
console.log('added:', await flat(page.locator('article', { hasText: '+0' })))

await page.waitForTimeout(600)
await page.screenshot({ path: join(shotsDir, 'launch.png'), fullPage: true })

console.log(problems.length ? problems.join('\n') : 'no page errors')
await browser.close()
if (problems.length) process.exit(1)
