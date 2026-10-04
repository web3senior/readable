// Registers +0 4242 for two years through the app, against the registry deploy.mjs set up.
import { join } from 'node:path'
import { APP, BUYER, RPC, launch, shotsDir, walletShim } from './setup.mjs'

const browser = await launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
await context.addInitScript(walletShim, { rpc: RPC, account: BUYER })
const page = await context.newPage()
const problems = []
page.on('pageerror', (error) => problems.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(message.text().slice(0, 300))
})

const card = (name) => page.locator('article', { hasText: name })
const flat = async (locator) => (await locator.innerText()).replace(/\s+/g, ' ')
const register = () => card('+0 4242').getByRole('button', { name: 'Register', exact: true })

await page.goto(`${APP}/?q=4242`, { waitUntil: 'networkidle' })
await register().waitFor({ timeout: 30000 })
console.log('before:', await flat(card('+0 4242')))

// Without a wallet, Register opens the picker first
await register().click()
await page.locator('dialog[open]').getByText('Browser wallet').click()
await page.getByRole('button', { name: 'Account' }).waitFor({ timeout: 15000 })

await register().click()
const dialog = page.locator('dialog[open]')
await dialog.getByRole('button', { name: 'One year more' }).click()
console.log('dialog:', await flat(dialog))
await dialog.getByRole('button', { name: 'Register', exact: true }).click()

await page.getByText('+0 4242 is yours').waitFor({ timeout: 30000 })
await card('+0 4242').getByText('Yours').waitFor({ timeout: 30000 })
await page.waitForTimeout(600)
console.log('after:', await flat(card('+0 4242')))
await page.screenshot({ path: join(shotsDir, 'app-registered.png'), fullPage: true })

console.log(problems.length ? problems.join('\n') : 'no page errors')
await browser.close()
