// Follows a name's tokenURI from the registry to the site, as a wallet or marketplace would,
// against the registry admin.mjs pointed at this site.
import { join } from 'node:path'
import { createPublicClient, http } from 'viem'
import { APP, LONG_NUMBER, RPC, launch, registryAbi, registryAddress, shotsDir } from './setup.mjs'

const problems = []
const client = createPublicClient({ transport: http(RPC) })
const read = (functionName, args) => client.readContract({ address: registryAddress(), abi: registryAbi, functionName, args })

const browser = await launch()
const context = await browser.newContext({ viewport: { width: 600, height: 600 }, ignoreHTTPSErrors: true })

for (const [label, name] of [
  ['4242', '+0 4242'],
  ['42421230', LONG_NUMBER],
]) {
  const tokenId = await read('tokenIdOf', [1n, label])
  const uri = await read('tokenURI', [tokenId])
  if (uri !== `${APP}/nft/${tokenId}`) problems.push(`tokenURI is ${uri}`)

  const response = await context.request.get(uri)
  const metadata = await response.json()
  console.log(`${label}:`, JSON.stringify(metadata))
  if (metadata.name !== name) problems.push(`${label} is named ${metadata.name}`)

  const image = await context.request.get(metadata.image)
  const svg = await image.text()
  if (!image.headers()['content-type'].startsWith('image/svg+xml') || !svg.includes(`>${name}<`)) problems.push(`${label} has no image of its name`)
}

const unknown = await context.request.get(`${APP}/nft/1`)
if (unknown.status() !== 404) problems.push(`an unknown token answered ${unknown.status()}`)

const page = await context.newPage()
const longId = await read('tokenIdOf', [1n, '42421230'])
await page.goto(`${APP}/nft/${longId}/image`)
await page.screenshot({ path: join(shotsDir, 'nft.png') })

console.log(problems.length ? problems.join('\n') : 'all checks passed')
await browser.close()
if (problems.length) process.exit(1)
