// Shared setup for the local end-to-end scripts. Every path can be overridden from the environment.
// They run against a local fork of Base Sepolia, so the forwarder and the deploy factory are the
// real ones:
//   anvil --fork-url https://base-sepolia-rpc.publicnode.com --chain-id 84532
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const RPC = process.env.E2E_RPC ?? 'http://127.0.0.1:8545'
export const APP = process.env.E2E_APP ?? 'http://localhost:3005'
export const DEPLOY_PAGE = process.env.E2E_DEPLOY_PAGE ?? 'http://localhost/readable/contracts/deploy/deploy.html'

export const CHAIN_ID = 84532
// Names are paid in ETH. The placeholder prices are dollars at 4,000 dollars an ETH, so a dollar
// is this many wei
export const DOLLAR = 250_000_000_000_000n

// Anvil's first two default accounts: the registry owner and a buyer
export const OWNER = process.env.E2E_OWNER ?? '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'
export const BUYER = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8'
// Anvil's third default account pays the network fee of gasless calls. Its key is public, the
// same on every Anvil, so it is only ever a key for a local chain
export const RELAYER = '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc'
export const RELAYER_KEY = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'
// Anvil's fourth default account: the wallet the buyer makes the editor of a name
export const EDITOR = '0x90f79bf6eb2c4f870365e785982e1f101e93b906'
// Two addresses that start empty: what the treasury holds afterwards is what the registry paid it
export const OTHER = `0x${'5eed'.repeat(10)}`
export const TREASURY = `0x${'da0'.repeat(13)}d`
// Long enough to be written in groups, with a valid check digit
export const LONG_NUMBER = '+0 42421230'

export const registryAbi = JSON.parse(readFileSync(new URL('../../src/abis/Readable.json', import.meta.url), 'utf8'))
// Written by deploy.mjs
export const registryAddress = () => readFileSync(new URL('./.shots/registry-address.txt', import.meta.url), 'utf8').trim()
export const nameRulesAddress = () => readFileSync(new URL('./.shots/name-rules-address.txt', import.meta.url), 'utf8').trim()

export const rpc = async (method, params = []) => {
  const response = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const body = await response.json()
  if (body.error) throw new Error(body.error.message)
  return body.result
}

/** What `address` holds, in wei. */
export const ethOf = async (address) => BigInt(await rpc('eth_getBalance', [address, 'latest']))

const PLAYWRIGHT = process.env.E2E_PLAYWRIGHT ?? 'file:///C:/xampp/htdocs/monsoon/node_modules/playwright-core/index.mjs'
// The installed browser build; the playwright-core package would otherwise look for a newer one
const CHROME = process.env.E2E_CHROME ?? 'C:/Users/atenyun/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'

export const shotsDir = fileURLToPath(new URL('./.shots/', import.meta.url))
mkdirSync(shotsDir, { recursive: true })

export async function launch() {
  const { chromium } = await import(PLAYWRIGHT)
  return chromium.launch({ executablePath: CHROME })
}

/** A minimal EIP-1193 wallet in the page, signing through Anvil's unlocked accounts. */
export const walletShim = ({ rpc, account }) => {
  let id = 0
  const call = async (method, params = []) => {
    const response = await fetch(rpc, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
    })
    const body = await response.json()
    if (body.error) {
      const error = new Error(body.error.message)
      error.code = body.error.code
      error.data = body.error.data
      throw error
    }
    return body.result
  }
  window.ethereum = {
    request: async ({ method, params = [] }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [account]
      if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') return null
      if (method === 'wallet_requestPermissions' || method === 'wallet_getPermissions') return [{ parentCapability: 'eth_accounts' }]
      if (method === 'eth_sendTransaction') params[0] = { ...params[0], from: account }
      return call(method, params)
    },
    on: () => {},
    removeListener: () => {},
  }
}
