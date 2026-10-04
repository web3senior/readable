// After names.mjs and sdk.mjs: as the buyer, makes another wallet the editor of +0 42421230 from
// the name's page. As that wallet, points the name and saves its records, and sees nothing only a
// holder may do. Then the buyer removes it. The registry is read back after each step.
import { join } from 'node:path'
import { createPublicClient, http, isAddressEqual, zeroAddress } from 'viem'
import { APP, BUYER, EDITOR, LONG_NUMBER, RPC, ethOf, launch, registryAbi, registryAddress, shotsDir, walletShim } from './setup.mjs'

const PAGE = `${APP}/names/${LONG_NUMBER.replace(' ', '-')}`
const NOTE = 'You edit this name for its holder'

const client = createPublicClient({ transport: http(RPC) })
const read = (functionName, args) => client.readContract({ address: registryAddress(), abi: registryAbi, functionName, args })
const tokenId = await read('tokenIdOf', [1n, LONG_NUMBER.replace('+0 ', '')])

const browser = await launch()
const problems = []

// A browser of its own for each wallet, connected on the name's page
async function open(account) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1100 }, ignoreHTTPSErrors: true })
  await context.addInitScript(walletShim, { rpc: RPC, account })
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
    toast: (text) => page.getByText(text, { exact: true }).waitFor({ timeout: 30000 }),
  }
}

// --- THE HOLDER NAMES AN EDITOR ---

const holder = await open(BUYER)
const editorField = () => holder.section('Editor').getByLabel('Editor’s address')
await editorField().waitFor({ timeout: 30000 })
await editorField().fill('not-an-address')
await holder.section('Editor').getByRole('button', { name: 'Save' }).click()
await holder.toast('That is not a valid address')
await editorField().fill(BUYER)
await holder.section('Editor').getByRole('button', { name: 'Save' }).click()
await holder.toast('The holder can change it already')
await editorField().fill(EDITOR)
await holder.section('Editor').getByRole('button', { name: 'Save' }).click()
await holder.toast(`The editor of ${LONG_NUMBER} is saved`)
await holder.page.locator('aside').getByText('Editor', { exact: true }).waitFor({ timeout: 30000 })

if (!isAddressEqual(await read('editorOf', [tokenId]), EDITOR)) problems.push('the registry has no editor after the holder named one')

// --- THE EDITOR CHANGES THE NAME ---

const before = await ethOf(EDITOR)
const editor = await open(EDITOR)
await editor.page.getByText(NOTE, { exact: false }).waitFor({ timeout: 30000 })
for (const holderOnly of ['Primary name', 'Editor']) {
  if (await editor.section(holderOnly).count()) problems.push(`the editor is offered ${holderOnly}`)
}

await editor.section('Points to').getByLabel('Wallet address').fill(EDITOR)
await editor.section('Points to').getByRole('button', { name: 'Save' }).click()
await editor.toast(`${LONG_NUMBER} points at the wallet`)

await editor.section('Records').getByLabel('Display name').fill('Agent')
await editor.section('Records').getByLabel('X', { exact: true }).fill('agent')
// A proof is signed by the holder's wallet, so the editor is never offered one
if (await editor.section('Records').getByRole('button', { name: 'Prove it' }).count()) problems.push('the editor is offered a proof')
await editor.section('Records').getByRole('button', { name: 'Save records' }).click()
await editor.toast(`Records of ${LONG_NUMBER} saved`)
await editor.page.waitForTimeout(600)
await editor.page.screenshot({ path: join(shotsDir, 'editor.png'), fullPage: true })

const [target, stored] = await Promise.all([read('resolve', [tokenId]), read('text', [tokenId, 'records'])])
console.log('registry:', JSON.stringify({ target, stored }))
if (!isAddressEqual(target, EDITOR)) problems.push(`the name resolves to ${target}, not the editor`)
if (stored !== JSON.stringify({ v: 1, name: 'Agent', social: { x: 'agent' } })) problems.push(`records are ${stored}`)
// With RELAYER_PRIVATE_KEY on the server the relayer sent both changes
const fee = before - (await ethOf(EDITOR))
console.log(fee === 0n ? 'the editor paid no fee' : `the editor paid ${fee} wei`)

// --- THE HOLDER REMOVES IT ---

await holder.page.reload({ waitUntil: 'networkidle' })
await editorField().waitFor({ timeout: 30000 })
await editorField().fill('')
await holder.section('Editor').getByRole('button', { name: 'Save' }).click()
await holder.toast(`${LONG_NUMBER} has no editor`)

if (!isAddressEqual(await read('editorOf', [tokenId]), zeroAddress)) problems.push('the editor is still there after the holder removed it')

// The page sends the editor what any visitor sees
await editor.page.reload({ waitUntil: 'networkidle' })
await editor.page.getByRole('region', { name: 'Share', exact: true }).waitFor({ timeout: 30000 })
if (await editor.section('Points to').count()) problems.push('a removed editor is still offered changes')

console.log(problems.length ? problems.join('\n') : 'no page errors')
await browser.close()
if (problems.length) process.exit(1)
