// Everything that takes a name past the registry, against the fork app.mjs left: a holder's change
// sent by the relayer, paying a name from its page, its public page and its share panel, keypad
// words, free numbers beside a taken one, the watch list, proven accounts, the agents directory,
// the MCP server, the ENS gateway and the paymaster's guard. Run after app.mjs, with the app started with
// RELAYER_PRIVATE_KEY, ENS_GATEWAY_PRIVATE_KEY=ENS_KEY below and PAYMASTER_URL at a closed port.
import { join } from 'node:path'
import {
  createPublicClient,
  createWalletClient,
  decodeAbiParameters,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  http,
  isAddressEqual,
  keccak256,
  namehash,
  parseAbi,
  recoverAddress,
  stringToBytes,
  toHex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { robinhood } from 'viem/chains'
import { APP, BUYER, CHAIN_ID, OTHER, OWNER, RPC, ethOf, launch, registryAbi, registryAddress, shotsDir, walletShim } from './setup.mjs'

// Anvil's second default account, the buyer: its key is public, the same on every Anvil
const BUYER_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
// Anvil's fifth: what the app signs ENS answers with in this run
export const ENS_KEY = '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a'
const ENS_PARENT = 'readable.eth'
const NUMBERS = 1n
const AGENT = { endpoint: 'https://iris.example/mcp', erc8004: '412' }

const chain = { ...robinhood, rpcUrls: { default: { http: [RPC] } } }
const reader = createPublicClient({ chain, transport: http(RPC) })
// Anvil's accounts are unlocked, so a plain address signs
const walletOf = (account) => createWalletClient({ account, chain, transport: http(RPC) })
const registry = registryAddress()

let failures = 0
const check = (ok, label) => {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`)
}
const api = async (path, init) => {
  const response = await fetch(`${APP}${path}`, init)
  return { status: response.status, body: await response.json().catch(() => null) }
}
const send = async (from, functionName, args) => {
  const hash = await walletOf(from).writeContract({ address: registry, abi: registryAbi, functionName, args })
  return reader.waitForTransactionReceipt({ hash })
}

// --- A name someone else holds, with an agent behind it ---

// Granted to the owner, so the buyer is a visitor to it
if ((await reader.readContract({ address: registry, abi: registryAbi, functionName: 'lookup', args: [NUMBERS, '5555'] })).available) {
  await send(OWNER, 'adminRegister', [NUMBERS, '5555', OWNER, 1n])
}
const tokenId = await reader.readContract({ address: registry, abi: registryAbi, functionName: 'tokenIdOf', args: [NUMBERS, '5555'] })
const records = { v: 1, name: 'Iris', about: 'Books tables', agent: AGENT, social: { github: 'readable-e2e-nobody' }, proofs: { github: 'https://gist.github.com/readable-e2e-nobody/0123456789abcdef0123' } }
await send(OWNER, 'setText', [tokenId, 'records', JSON.stringify(records)])

// --- The API ---

const resolved = await api(`/api/resolve/${encodeURIComponent('+0 5555')}`)
check(resolved.status === 200 && isAddressEqual(resolved.body.address, OWNER) && resolved.body.records.agent.endpoint === AGENT.endpoint, 'resolve answers the wallet and the agent')

const agents = await api('/api/agents')
check(agents.body?.agents?.some((agent) => agent.name === '+0 5555' && agent.endpoint === AGENT.endpoint && isAddressEqual(agent.payment, OWNER)), 'the directory lists the agent')

const verified = await api(`/api/verify/${encodeURIComponent('+0 5555')}`)
check(verified.status === 200 && verified.body.verified.github === false, 'a proof link to a gist that does not exist is not verified')

const badge = await fetch(`${APP}/api/badge/+05555`)
check(badge.ok && (await badge.text()).includes('+0 5555'), 'the badge draws the name')

const card = await fetch(`${APP}/names/+05555/opengraph-image`)
check(card.ok && card.headers.get('content-type') === 'image/png', 'the name page has a preview picture')

const moved = await fetch(`${APP}/names/+0-5555`, { redirect: 'manual' })
check(moved.status === 308 && new URL(moved.headers.get('location'), APP).pathname === '/names/+05555', 'an older link with a dash moves to the page')

// --- The MCP server ---

const mcp = (method, params) =>
  api('/api/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
const tool = async (name, args) => (await mcp('tools/call', { name, arguments: args })).body.result.structuredContent

const initialized = await mcp('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '1' } })
check(initialized.body?.result?.protocolVersion === '2025-06-18', 'MCP initializes')
check((await tool('resolve_name', { name: '+0-5555' })).found === true, 'MCP resolves a name')
const free = await tool('check_name', { name: '4243' })
check(free.status === 'available' && free.pricePerYear === '0.025 ETH', 'MCP checks a free name and its price')
check((await tool('check_name', { name: '+0 4242' })).status === 'taken', 'MCP sees a taken name')
check((await tool('dial_agent', { name: '+0 5555' })).endpoint === AGENT.endpoint, 'MCP dials the agent')
const details = await tool('payment_details', { name: '+0 5555' })
check(isAddressEqual(details.to, OWNER) && details.token.native === true && details.token.symbol === 'ETH', 'MCP says how to pay a name')

// --- The ENS gateway ---

const dnsEncode = (name) => toHex(new Uint8Array(name.split('.').flatMap((label) => [stringToBytes(label).length, ...stringToBytes(label)]).concat(0)))
const resolverAbi = parseAbi([
  'function resolve(bytes name, bytes data) view returns (bytes, uint64, bytes)',
  'function addr(bytes32 node) view returns (address)',
  'function addr(bytes32 node, uint256 coinType) view returns (bytes)',
  'function text(bytes32 node, string key) view returns (string)',
])
const SENDER = '0x000000000000000000000000000000000000e45e'
async function askEns(name, inner) {
  const callData = encodeFunctionData({ abi: resolverAbi, functionName: 'resolve', args: [dnsEncode(name), inner] })
  const { status, body } = await api(`/api/ens/${SENDER}/${callData}.json`)
  if (status !== 200) return { status }
  const [result, expires, signature] = decodeAbiParameters([{ type: 'bytes' }, { type: 'uint64' }, { type: 'bytes' }], body.data)
  const hash = keccak256(encodePacked(['bytes2', 'address', 'uint64', 'bytes32', 'bytes32'], ['0x1900', SENDER, expires, keccak256(callData), keccak256(result)]))
  return { status, result, signer: await recoverAddress({ hash, signature }) }
}
const node = namehash(`5555.${ENS_PARENT}`)
const ensAddr = await askEns(`5555.${ENS_PARENT}`, encodeFunctionData({ abi: resolverAbi, functionName: 'addr', args: [node] }))
check(
  isAddressEqual(decodeAbiParameters([{ type: 'address' }], ensAddr.result)[0], OWNER) && isAddressEqual(ensAddr.signer, privateKeyToAccount(ENS_KEY).address),
  'ENS: 5555.readable.eth answers the wallet, signed by the gateway'
)
const ensBase = await askEns(`5555.${ENS_PARENT}`, encodeFunctionData({ abi: resolverAbi, functionName: 'addr', args: [node, 0x80000000n + 8453n] }))
check(isAddressEqual(decodeAbiParameters([{ type: 'bytes' }], ensBase.result)[0], OWNER), 'ENS: the Base coin type answers the same wallet')
const ensText = await askEns(`5555.${ENS_PARENT}`, encodeFunctionData({ abi: resolverAbi, functionName: 'text', args: [node, 'description'] }))
check(decodeAbiParameters([{ type: 'string' }], ensText.result)[0] === records.about, 'ENS: description is the records’ about')
check((await askEns('5555.other.eth', encodeFunctionData({ abi: resolverAbi, functionName: 'addr', args: [namehash('5555.other.eth')] }))).status === 404, 'ENS: a name under another parent is refused')

// --- The paymaster's guard ---

const accountAbi = parseAbi(['function executeBatch((address target, uint256 value, bytes data)[] calls)'])
const paymaster = (calls) =>
  api('/api/paymaster', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'pm_getPaymasterStubData',
      params: [{ sender: BUYER, callData: encodeFunctionData({ abi: accountAbi, functionName: 'executeBatch', args: [calls] }) }, '0x0000000071727De22E5E9d8BAf0edAc6f37da032', toHex(CHAIN_ID), {}],
    }),
  })
const change = await paymaster([{ target: registry, value: 0n, data: encodeFunctionData({ abi: registryAbi, functionName: 'setTarget', args: [tokenId, OTHER] }) }])
check(change.body?.error?.message === 'The paymaster could not be reached', 'paymaster: a change to a name is passed on')
const purchase = await paymaster([{ target: registry, value: 25n * 10n ** 15n, data: encodeFunctionData({ abi: registryAbi, functionName: 'register', args: [NUMBERS, '7777', 1n] }) }])
check(purchase.body?.error?.message === 'A sponsored call cannot carry value', 'paymaster: a purchase is refused')
const elsewhere = await paymaster([{ target: OTHER, value: 0n, data: '0x' }])
check(elsewhere.body?.error?.message === 'The paymaster pays for changes to a name only', 'paymaster: any other call is refused')

// --- A holder's change without gas, through the relayer ---

const relayStatus = (await api('/api/relay')).body
const forwarder = relayStatus.forwarder
const FORWARD_TYPES = {
  ForwardRequest: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'gas', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint48' },
    { name: 'data', type: 'bytes' },
  ],
}
async function signedRequest(functionName, args) {
  const data = encodeFunctionData({ abi: registryAbi, functionName, args })
  const nonce = await reader.readContract({ address: forwarder.address, abi: parseAbi(['function nonces(address) view returns (uint256)']), functionName: 'nonces', args: [BUYER] })
  const request = { from: BUYER, to: registry, value: 0n, gas: 300_000n, nonce, deadline: Math.floor(Date.now() / 1000) + 600, data }
  const signature = await privateKeyToAccount(BUYER_KEY).signTypedData({
    domain: { name: forwarder.name, version: forwarder.version, chainId: CHAIN_ID, verifyingContract: forwarder.address },
    types: FORWARD_TYPES,
    primaryType: 'ForwardRequest',
    message: request,
  })
  return { request: Object.fromEntries(Object.entries(request).map(([key, value]) => [key, typeof value === 'bigint' ? String(value) : value])), signature }
}
const relay = (body) => api('/api/relay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

// The buyer holds +0 4242 since app.mjs
const held = await reader.readContract({ address: registry, abi: registryAbi, functionName: 'tokenIdOf', args: [NUMBERS, '4242'] })
const buyerEth = await ethOf(BUYER)
const changed = await relay(await signedRequest('setText', [held, 'relay-check', 'yes']))
check(changed.status === 200 && changed.body.hash, 'relay: a holder’s change is sent')
if (changed.body?.hash) await reader.waitForTransactionReceipt({ hash: changed.body.hash })
const landed = await reader.readContract({ address: registry, abi: registryAbi, functionName: 'text', args: [held, 'relay-check'] })
check(landed === 'yes' && (await ethOf(BUYER)) === buyerEth, 'relay: the change landed and the holder paid no fee')
check((await relay(await signedRequest('register', [NUMBERS, '7778', 1n]))).status === 403, 'relay: a purchase is refused')
check((await relay(await signedRequest('setTarget', [tokenId, BUYER]))).status === 400, 'relay: a change to someone else’s name is refused')

// --- The site ---

const browser = await launch()
const problems = []
const watchProblems = (page) => {
  page.on('pageerror', (error) => problems.push(error.message))
  page.on('console', (message) => message.type() === 'error' && problems.push(message.text().slice(0, 300)))
}
const flat = async (locator) => (await locator.innerText()).replace(/\s+/g, ' ')

// A visitor, without a wallet
const visitor = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
const page = await visitor.newPage()
watchProblems(page)

// A word is a username first, where an extension takes it, and the number it dials after it
await page.goto(`${APP}/?q=crypto`, { waitUntil: 'networkidle' })
const dialed = page.getByRole('button', { name: '+0 279786' })
await dialed.waitFor({ timeout: 30000 })
check((await dialed.getAttribute('title')) === 'Spells CRYPTO on a phone keypad', 'a word offers the number it dials')
await dialed.click()
await page.locator('article', { hasText: '+0 279786' }).getByText('Available').waitFor({ timeout: 30000 })
// Without an extension that takes it, the number is the result, with the word beside it
await page.goto(`${APP}/?q=hi`, { waitUntil: 'networkidle' })
await page.locator('article', { hasText: '+0 44' }).getByText('Spells HI on a phone keypad').waitFor({ timeout: 30000 })
check(true, 'a word no extension takes searches the number it dials')

// A link from when the search followed # still opens, and the address moves it to ?q=
await page.goto(`${APP}/#4242`, { waitUntil: 'networkidle' })
const taken = page.locator('article', { hasText: '+0 4242' })
await taken.getByText('Free nearby').waitFor({ timeout: 30000 })
check(new URL(page.url()).searchParams.get('q') === '4242' && !new URL(page.url()).hash, 'an older # link is rewritten to ?q=')
console.log('taken:', await flat(taken))
check((await taken.getByRole('button', { name: 'Pay' }).count()) === 1 && (await taken.getByRole('link', { name: 'View profile' }).count()) === 1, 'a taken name offers Pay and its profile')
await taken.getByRole('button', { name: 'Watch' }).click()
await taken.getByRole('button', { name: '+0 4243' }).click()
await page.locator('article', { hasText: '+0 4243' }).getByText('Available').waitFor({ timeout: 30000 })
check(true, 'a free number beside it searches that number')

await page.goto(`${APP}/names`, { waitUntil: 'networkidle' })
const watching = page.locator('section', { hasText: 'Watching' })
await watching.getByText(/Returns/).waitFor({ timeout: 30000 })
check((await watching.getByRole('link', { name: '+0 4242' }).count()) === 1, 'the watch list shows the day the name returns')

await page.goto(`${APP}/names/+05555`, { waitUntil: 'networkidle' })
await page.getByText(AGENT.endpoint.replace('https://', '')).first().waitFor({ timeout: 30000 })
const tunnel = await page.getByRole('link', { name: 'Add in Tunnel' }).getAttribute('href')
check(tunnel.includes('tunnelapp.chat/chat?add=%2B05555'), 'the page links to Tunnel with the number')
const badgeLoaded = await page.locator('img[alt="Pay me at +0 5555"]').evaluate((image) => image.complete && image.naturalWidth > 0)
check(badgeLoaded && (await page.locator('svg[role="img"][aria-label^="Scan to open"]').count()) === 1, 'the share panel shows the QR code and the badge')
await page.screenshot({ path: join(shotsDir, 'reach-name-page.png'), fullPage: true })
await visitor.close()

// The buyer, paying a name from its page
const buyer = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
await buyer.addInitScript(walletShim, { rpc: RPC, account: BUYER })
const payer = await buyer.newPage()
watchProblems(payer)
await payer.goto(`${APP}/names/+05555`, { waitUntil: 'networkidle' })
await payer.getByRole('button', { name: 'Pay', exact: true }).click()
await payer.locator('dialog[open]').getByText('Browser wallet').click()
await payer.getByRole('button', { name: 'Account' }).waitFor({ timeout: 15000 })
const before = await ethOf(OWNER)
await payer.getByRole('button', { name: 'Pay', exact: true }).click()
const dialog = payer.locator('dialog[open]')
await dialog.getByRole('button', { name: '0.001 ETH', exact: true }).click()
console.log('pay dialog:', await flat(dialog))
await dialog.getByRole('button', { name: 'Pay 0.001 ETH' }).click()
await payer.getByText('0.001 ETH sent to +0 5555').waitFor({ timeout: 30000 })
check((await ethOf(OWNER)) - before === 10n ** 15n, 'the page pays 0.001 ETH to the name’s wallet')
await payer.screenshot({ path: join(shotsDir, 'reach-paid.png'), fullPage: true })

// The buyer holds +0 4242: proving a GitHub account signs the statement the server checks
await payer.goto(`${APP}/names/+04242`, { waitUntil: 'networkidle' })
await payer.getByPlaceholder('handle').nth(2).fill('readable-e2e-holder')
await payer.getByRole('button', { name: 'Prove it' }).click()
const proof = payer.locator('dialog[open]')
await proof.getByRole('button', { name: 'Sign' }).click()
const post = await proof.locator('pre').innerText({ timeout: 15000 })
const [signature] = post.match(/0x[0-9a-fA-F]{130,}/) ?? []
const holderToken = await reader.readContract({ address: registry, abi: registryAbi, functionName: 'tokenIdOf', args: [NUMBERS, '4242'] })
const statement = `readable.name\n+0 4242 is held by the same person as the GitHub account readable-e2e-holder.\nToken ${holderToken}`
check(Boolean(signature) && (await reader.verifyMessage({ address: BUYER, message: statement, signature })), 'a proof carries the holder’s signature of the statement')
await payer.screenshot({ path: join(shotsDir, 'reach-proof.png'), fullPage: true })

await browser.close()
console.log(problems.length ? `page errors:\n${problems.join('\n')}` : 'no page errors')
console.log(failures ? `${failures} failed` : 'all passed')
process.exit(failures ? 1 : 0)
