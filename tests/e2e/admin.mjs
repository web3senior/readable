// Drives the admin page as the owner against the numbers-only registry deploy.mjs set up: sets
// the name rules, adds an extension, reprices, reserves, grants, pauses and resumes, sets the
// treasury and the NFT data link, then checks the search sees it all and
// refuses emoji and look-alikes.
import { join } from 'node:path'
import { APP, BUYER, LONG_NUMBER, OWNER, RPC, TREASURY, launch, nameRulesAddress, shotsDir, walletShim } from './setup.mjs'

const text = (...codePoints) => String.fromCodePoint(...codePoints)
const UP = text(0x1f199)
const EXT = '.arc'
// Persian mirza khan, and the same with the joiner a keyboard puts after the alef, where it shows nothing
const MIRZA = text(0x645, 0x6cc, 0x631, 0x632, 0x627, 0x62e, 0x627, 0x646)
const MIRZA_TYPED = text(0x645, 0x6cc, 0x631, 0x632, 0x627, 0x200c, 0x62e, 0x627, 0x646)
// alice with the Cyrillic a, which reads the same
const TWIN = `${text(0x430)}lice`

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
// Scoped to the section: a closing Add dialog still shows its own "Add namespace" button
const openAdd = () => page.getByLabel('Namespaces').getByRole('button', { name: 'Add namespace' }).click()
const card = (text) => page.locator('article', { hasText: text })
const row = (term) => page.locator('dl > div', { hasText: term })
const toast = (text) => page.getByText(text, { exact: true }).waitFor({ timeout: 30000 })
// The labels a namespace card lists as reserved, read back from the registry's events
const reservedIn = (text) => card(text).getByRole('list', { name: 'Reserved' })
const flat = async (locator) => (await locator.innerText()).replace(/\s+/g, ' ')

await page.goto(`${APP}/admin`, { waitUntil: 'networkidle' })
await page.getByRole('status').getByRole('button', { name: 'Connect wallet' }).click()
await dialog().getByText('Browser wallet').click()
await page.getByRole('button', { name: 'Account' }).waitFor({ timeout: 15000 })
console.log('registry:', await flat(page.locator('section', { hasText: 'Registry' }).first()))

// An extension sells nothing until the registry has rules for names
await openAdd()
await dialog().getByLabel('Kind').selectOption('name')
await dialog().getByLabel('Name', { exact: true }).fill(EXT.slice(1))
await dialog().getByRole('button', { name: 'Add namespace' }).click()
await toast('Set the name rules first, under Registry')
await page.keyboard.press('Escape')

await row('Name rules').getByRole('button', { name: 'Change' }).click()
await dialog().getByLabel('Rules address').fill(nameRulesAddress())
await dialog().getByRole('button', { name: 'Save' }).click()
await toast('Name rules changed')
await row('Name rules').getByText('1.0.0').waitFor({ timeout: 30000 })

// Add a word extension; the dialog opens on the extension defaults
await openAdd()
await dialog().getByLabel('Kind').selectOption('name')
await dialog().getByLabel('Name', { exact: true }).fill(EXT.slice(1))
await dialog().getByLabel('Yearly prices (ETH)').fill('0.04, 0.01, 0.00125')
await dialog().getByRole('button', { name: 'Add namespace' }).click()
await toast(`${EXT} added`)
await card(EXT).waitFor({ timeout: 30000 })
console.log('added:', await flat(card(EXT)))

// Reprice the numbers
await card('Onchain numbers').getByRole('button', { name: 'Prices' }).click()
await dialog().getByLabel('Yearly prices (ETH)').fill('0.375, 0.125, 0.025, 0.00625, 0.00125, 0.00125, 0.00025')
await dialog().getByRole('button', { name: 'Save prices' }).click()
await toast('Numbers repriced')
await card('Onchain numbers').getByText('0.375 ETH').waitFor({ timeout: 30000 })

// Reserve, then grant past the reservation
await card(EXT).getByRole('button', { name: 'Reserve' }).click()
await dialog().getByLabel('Labels, one per line').fill('hup\nroot')
await dialog().getByRole('button', { name: 'Apply' }).click()
await toast(`Reserved in ${EXT}`)
await reservedIn(EXT).getByText(`root${EXT}`, { exact: true }).waitFor({ timeout: 30000 })

await card(EXT).getByRole('button', { name: 'Grant', exact: true }).click()
await dialog().getByLabel('Label', { exact: true }).fill('hup')
await dialog().getByLabel('Holder').fill(BUYER)
await dialog().getByLabel('Years').fill('2')
await dialog().getByRole('button', { name: 'Grant' }).click()
await toast(`hup${EXT} granted`)

// Numbers reserve in one batch, typed the way people write them
await card('Onchain numbers').getByRole('button', { name: 'Reserve' }).click()
await dialog().getByLabel('Labels, one per line').fill('111 111\n+0 222\n333')
await dialog().getByRole('button', { name: 'Apply' }).click()
await toast('Reserved in Numbers')
// Shortest first, each in the number format
const reservedNumbers = reservedIn('+0').getByRole('listitem')
await reservedNumbers.filter({ hasText: '+0 111111' }).waitFor({ timeout: 30000 })
console.log('reserved numbers:', await reservedNumbers.allInnerTexts())

// A number is granted as it is written; it is stored as bare digits
await card('Onchain numbers').getByRole('button', { name: 'Grant', exact: true }).click()
await dialog().getByLabel('Label', { exact: true }).fill(LONG_NUMBER)
await dialog().getByLabel('Holder').fill(BUYER)
await dialog().getByRole('button', { name: 'Grant' }).click()
await toast(`${LONG_NUMBER} granted`)

// Pause and resume the registry, then change the grace period
await row('Status').getByRole('button', { name: 'Pause contract', exact: true }).click()
await dialog().getByRole('button', { name: 'Pause contract', exact: true }).click()
await toast('Registry paused')
await row('Status').getByText('Paused').waitFor({ timeout: 30000 })
await row('Status').getByRole('button', { name: 'Resume contract', exact: true }).click()
await dialog().getByRole('button', { name: 'Resume contract', exact: true }).click()
await toast('Registry resumed')
await row('Status').getByText('Live').waitFor({ timeout: 30000 })

await row('Grace period').getByRole('button', { name: 'Change' }).click()
await dialog().getByLabel('Days').fill('45')
await dialog().getByRole('button', { name: 'Save' }).click()
await toast('Grace period updated')
await row('Grace period').getByText('45 days').waitFor({ timeout: 30000 })

// The treasury the registry's share is sent to
await row('Treasury').getByRole('button', { name: 'Change' }).click()
await dialog().getByLabel('Treasury address').fill(TREASURY)
await dialog().getByRole('button', { name: 'Save' }).click()
await toast('Treasury changed')
await row('Treasury').getByRole('button', { name: 'Copy address' }).waitFor({ timeout: 30000 })

// Where wallets and marketplaces read each name: this site, as the form suggests
await row('NFT data link').getByRole('button', { name: 'Change' }).click()
await dialog().getByRole('button', { name: 'Save' }).click()
await toast('NFT data link changed')
await row('NFT data link').getByText(`${APP}/nft/`).waitFor({ timeout: 30000 })

// A typo in a form never reaches the wallet
await card(EXT).getByRole('button', { name: 'Rules' }).click()
await dialog().getByLabel('Manager', { exact: true }).fill('not-an-address')
await dialog().getByRole('button', { name: 'Save rules' }).click()
await toast('That is not a valid address')
await page.keyboard.press('Escape')

await page.waitForTimeout(600)
await page.screenshot({ path: join(shotsDir, 'admin.png'), fullPage: true })

// The search sees the new extension, the granted name and a two-digit number, and takes no emoji
for (const [query, name, expected] of [
  [`hup${EXT}`, `hup${EXT}`, 'Taken'],
  [`alice${EXT}`, `alice${EXT}`, 'Available'],
  [`${UP}${EXT}`, `${UP}${EXT}`, 'Not valid'],
  // Two spellings a reader can't tell apart are one name, and a look-alike is none
  [`${MIRZA_TYPED}${EXT}`, `${MIRZA}${EXT}`, 'Available'],
  [`${TWIN}${EXT}`, `${TWIN}${EXT}`, 'Not valid'],
  // A bare number also fits the extensions, so the number card is named in full
  ['42', '+0 42', 'Available'],
  // Reserved as "111 111" and "+0 222"
  ['111111', '+0 111111', 'Reserved'],
  ['+0 222', '+0 222', 'Reserved'],
]) {
  await page.goto(`${APP}/?q=${encodeURIComponent(query)}`, { waitUntil: 'networkidle' })
  const result = card(name)
  await result.getByText(expected, { exact: true }).waitFor({ timeout: 30000 })
  console.log(`search ${query}:`, await flat(result))
}
await page.screenshot({ path: join(shotsDir, 'admin-search.png'), fullPage: true })

// Ownership is offered by the owner and taken by the wallet it was offered to, in its own session
await page.goto(`${APP}/admin`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Transfer ownership' }).click()
await dialog().getByLabel('New owner').fill(BUYER)
await dialog().getByRole('button', { name: 'Offer ownership' }).click()
await toast('Ownership offered. It moves once the new owner accepts')
await row('Offered to').waitFor({ timeout: 30000 })
if (!(await row('Owner').first().innerText()).includes('0xf39F')) problems.push('the owner changed before the offer was accepted')

const offered = await browser.newContext({ viewport: { width: 1280, height: 1100 }, ignoreHTTPSErrors: true })
await offered.addInitScript(walletShim, { rpc: RPC, account: BUYER })
const other = await offered.newPage()
const otherRow = (term) => other.locator('dl > div', { hasText: term })
await other.goto(`${APP}/admin`, { waitUntil: 'networkidle' })
await other.getByRole('status').getByRole('button', { name: 'Connect wallet' }).click()
await other.locator('dialog[open]').getByText('Browser wallet').click()
await other.getByRole('button', { name: 'Account' }).waitFor({ timeout: 15000 })
await otherRow('Offered to').getByRole('button', { name: 'Accept' }).click()
await other.locator('dialog[open]').getByRole('button', { name: 'Accept ownership' }).click()
await other.getByText('Ownership accepted', { exact: true }).waitFor({ timeout: 30000 })
await otherRow('Owner').first().getByText('0x7099', { exact: false }).waitFor({ timeout: 30000 })
console.log('owner now:', await flat(otherRow('Owner').first()))
await offered.close()

console.log(problems.length ? problems.join('\n') : 'no page errors')
await browser.close()
