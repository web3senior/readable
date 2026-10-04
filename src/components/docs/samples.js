/**
 * The code the docs print. Each sample is built from the registry the site is configured for,
 * so what a reader copies names the real chain, contract and number format.
 *
 * @typedef {object} SampleContext
 * @property {string} registry The registry's address, or a placeholder before launch.
 * @property {string} chain What viem exports the chain as.
 * @property {string} currency The symbol of the coin names are paid in.
 * @property {string} prefix The number namespace's name: the digits after the `+`.
 * @property {string} numbersId The number namespace's id.
 * @property {string} number A number as people write it.
 * @property {string} label The same number as the registry stores it.
 * @property {number} checkDigitFrom The length from which a number ends in a check digit.
 * @property {string} recordsKey The text key a name's records are stored under.
 */

const ABI = `const abi = parseAbi([
  'struct Namespace { uint256 id; uint8 kind; string name; uint8 minLength; uint8 maxLength; uint8 checkDigitFrom; uint8 priceFrom; bool paused; address manager; uint8 managerShare; string metadata; uint64 createdAt; }',
  'function getNamespaces() view returns (Namespace[])',
  'function tokenIdOf(uint256 namespaceId, string label) view returns (uint256)',
  'function resolve(uint256 tokenId) view returns (address)',
  'function primaryNameOf(address account) view returns (uint256 tokenId, string name)',
  'function text(uint256 tokenId, string key) view returns (string)',
  'function addr(uint256 tokenId, uint256 coinType) view returns (bytes)',
])`

export const sdkSample = ({ registry, chain, number }) => `import { createReadable } from 'readable-sdk'
import { ${chain} } from 'viem/chains'

const readable = createReadable({ chain: ${chain}, registry: '${registry}' })

// '0x…', or null when it reaches nobody
await readable.resolve('${number}')

// Its Bitcoin address, 'bc1q…', or null
await readable.getAddress('${number}', 'btc')

// Its records: { name, job, social: { x }, … }
await readable.getRecords('${number}')

// The primary name a wallet chose, or null
await readable.getName('0x…')

// All of the above in one answer
await readable.getProfile('${number}')`

export const apiSample = ({ baseUrl, number }) => `curl ${baseUrl}/api/resolve/${number.replaceAll(' ', '%20')}

{
  "name": "${number}",
  "tokenId": "…",
  "owner": "0x…",
  "address": "0x…",
  "expiresAt": 1822493531,
  "addresses": { "btc": "bc1q…", "sol": null },
  "records": { "name": "Alice", "social": { "x": "alice" } }
}

curl ${baseUrl}/api/reverse/0x…

{ "address": "0x…", "name": "${number}" }`

export const resolveSample =({ registry, chain, prefix, number }) => `import { createPublicClient, http, parseAbi, zeroAddress } from 'viem'
import { ${chain} } from 'viem/chains'

const registry = '${registry}'
${ABI}

const client = createPublicClient({ chain: ${chain}, transport: http() })
const read = (functionName, args) => client.readContract({ address: registry, abi, functionName, args })

// 1. Find the namespace. Numbers are kind 1, named by the digits of their prefix
const namespaces = await read('getNamespaces')
const numbers = namespaces.find((namespace) => namespace.kind === 1 && namespace.name === '${prefix}')

// 2. Reduce what was typed to the stored label: the prefix and every separator go
const label = '${number}'.replace(/^\\+${prefix}/, '').replace(/\\D/g, '')

// 3. Resolve. The zero address means nobody: never registered, or expired
const tokenId = await read('tokenIdOf', [numbers.id, label])
const wallet = await read('resolve', [tokenId])
if (wallet === zeroAddress) throw new Error('This number reaches nobody')`

export const contractSample = ({ registry, numbersId }) => `interface IReadable {
    function tokenIdOf(uint256 namespaceId, string calldata label) external view returns (uint256);
    function resolve(uint256 tokenId) external view returns (address);
}

contract PayANumber {
    IReadable constant READABLE = IReadable(${registry});
    // The id of the number namespace, from getNamespaces()
    uint256 constant NUMBERS = ${numbersId};

    error NobodyThere(string digits);
    error NotDelivered();

    /// @param digits The number without its prefix or spaces
    function pay(string calldata digits) external payable {
        address to = READABLE.resolve(READABLE.tokenIdOf(NUMBERS, digits));
        if (to == address(0)) revert NobodyThere(digits);
        (bool delivered, ) = to.call{value: msg.value}("");
        if (!delivered) revert NotDelivered();
    }
}`

export const reverseSample = () => `const [tokenId, name] = await read('primaryNameOf', [account])

// No token id and an empty name: the account has chosen none, or the one it chose has expired
if (tokenId === 0n) showAddress(account)
else showName(name)`

export const recordsDocument = `{
  "v": 1,
  "avatar": "ipfs://…",
  "name": "Alice",
  "job": "Designer",
  "about": "Making things readable",
  "email": "alice@example.com",
  "url": "https://alice.example",
  "location": "Lisbon",
  "birthday": "1990-05-14",
  "social": {
    "x": "alice",
    "telegram": "alice_lisbon",
    "github": "alice",
    "hup": "alice",
    "up": "0x…"
  },
  "agent": {
    "endpoint": "https://alice.example/mcp",
    "erc8004": "412",
    "payment": "0x…"
  }
}`

export const recordsSample = ({ recordsKey }) => `const stored = await read('text', [tokenId, '${recordsKey}'])

// Written by the holder, so anything can be in it
let records = {}
try {
  records = JSON.parse(stored || '{}')
} catch {}

const endpoint = records.agent?.endpoint`

export const addrSample = () => `import { btc, sol } from '@ensdomains/address-encoder/coins'
import { hexToBytes } from 'viem'

// Each coder knows its chain's coin type and turns the stored bytes back into text
const addressOn = async (coin) => {
  const bytes = await read('addr', [tokenId, BigInt(coin.coinType)])
  // 0x: the holder set none on that chain
  return bytes === '0x' ? null : coin.encode(hexToBytes(bytes))
}

const bitcoin = await addressOn(btc) // 'bc1q…'
const solana = await addressOn(sol)`

export const setAddrsSample = () => `import { btc, sol } from '@ensdomains/address-encoder/coins'
import { bytesToHex, parseAbi } from 'viem'

const abi = parseAbi([
  'struct CoinAddress { uint256 coinType; bytes value; }',
  'function setAddrs(uint256 tokenId, CoinAddress[] entries)',
])

// Several chains in one transaction. Empty bytes remove one;
// a chain left out keeps its address
await wallet.writeContract({
  address: registry,
  abi,
  functionName: 'setAddrs',
  args: [
    tokenId,
    [
      { coinType: BigInt(btc.coinType), value: bytesToHex(btc.decode('bc1q…')) },
      { coinType: BigInt(sol.coinType), value: '0x' },
    ],
  ],
})`

export const tokenIdSample =({ numbersId, label }) => `import { encodePacked, keccak256 } from 'viem'

// keccak256(abi.encodePacked(namespaceId, label)) in Solidity
const tokenId = BigInt(keccak256(encodePacked(['uint256', 'string'], [${numbersId}n, '${label}'])))`

export const checkDigitSample = ({ checkDigitFrom }) => `// Luhn: from the right, double every second digit, and the sum must end in 0
const luhnValid = (digits) => {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

// The one digit that completes the digits before it
const checkDigitFor = (body) => [...'0123456789'].find((digit) => luhnValid(body + digit))

const valid = (digits) => digits.length < ${checkDigitFrom} || luhnValid(digits)`
