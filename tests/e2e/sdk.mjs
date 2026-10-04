// Reads back, through the SDK (packages/sdk) and the site's API built on it, what names.mjs saved
// on +0 4343: the wallet it points to, its Bitcoin and Solana addresses, its records and the
// buyer's primary name. Run it after names.mjs.
import { baseSepolia } from 'viem/chains'
import { isAddressEqual } from 'viem'
import { createReadable } from '../../packages/sdk/src/index.js'
import { APP, BUYER, LONG_NUMBER, OTHER, RPC, registryAddress } from './setup.mjs'

const BTC = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
const SOL = 'So11111111111111111111111111111111111111112'

// The dev server's certificate is self-signed
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const problems = []
const expect = (label, actual, wanted) => {
  const same = typeof wanted === 'function' ? wanted(actual) : JSON.stringify(actual) === JSON.stringify(wanted)
  console.log(`${same ? 'ok  ' : 'FAIL'} ${label}: ${JSON.stringify(actual)}`)
  if (!same) problems.push(label)
}

const readable = createReadable({ chain: baseSepolia, registry: registryAddress(), rpc: RPC })

expect('resolve +0 4343', await readable.resolve('+0 4343'), (value) => value && isAddressEqual(value, OTHER))
expect('resolve written another way', await readable.resolve('43-43'), (value) => value && isAddressEqual(value, OTHER))
expect('resolve a number nobody holds', await readable.resolve('+0 9999'), null)
expect('resolve what is not a name', await readable.resolve('hello world'), null)
expect('Bitcoin address', await readable.getAddress('+0 4343', 'btc'), BTC)
expect('Solana address', await readable.getAddress('+0 4343', 'sol'), SOL)
expect('eth is the wallet it points to', await readable.getAddress('+0 4343', 'eth'), (value) => value && isAddressEqual(value, OTHER))
expect('records', await readable.getRecords('+0 4343'), (value) => value?.name === 'Alice' && value?.social?.x === 'alice')
expect('records of a name with none', await readable.getRecords(LONG_NUMBER), {})
expect('primary name of the buyer', await readable.getName(BUYER), '+0 4343')
expect('primary name of a wallet with none', await readable.getName(OTHER), null)

const profile = await readable.getProfile(LONG_NUMBER)
expect('profile name is grouped', profile?.name, LONG_NUMBER)
expect('profile owner', profile?.owner, (value) => value && isAddressEqual(value, BUYER))

const get = async (path) => {
  const response = await fetch(`${APP}${path}`)
  return { status: response.status, body: await response.json(), cors: response.headers.get('access-control-allow-origin') }
}
const api = await get(`/api/resolve/${encodeURIComponent('+0 4343')}`)
expect('API resolve status', api.status, 200)
expect('API resolve is open to any origin', api.cors, '*')
expect('API resolve body', api.body, (body) => body.name === '+0 4343' && body.addresses?.btc === BTC && body.records?.social?.hup === 'alice_l')
expect('API resolve, nobody', (await get(`/api/resolve/${encodeURIComponent('+0 9999')}`)).status, 404)
expect('API reverse', (await get(`/api/reverse/${BUYER}`)).body?.name, '+0 4343')
expect('API reverse, not an address', (await get('/api/reverse/hello')).status, 400)

console.log(problems.length ? `failed: ${problems.join(', ')}` : 'all good')
if (problems.length) process.exit(1)
