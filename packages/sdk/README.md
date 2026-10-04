# readable-sdk

Resolve [readable.name](https://readable.name) numbers and names: the wallet a name reaches, its
addresses on other chains, its records, and the name a wallet chose for itself. It reads the
registry contract directly through [viem](https://viem.sh); no key, no server.

```sh
npm install readable-sdk viem
```

```js
import { createReadable } from 'readable-sdk'
import { baseSepolia } from 'viem/chains'

const readable = createReadable({ chain: baseSepolia })

await readable.resolve('+0 42421230')         // '0x…', or null when it reaches nobody
await readable.getAddress('+0 4242', 'btc')   // 'bc1q…', or null
await readable.getRecords('+0 4242')          // { name, job, social: { x }, … }
await readable.getName('0x…')                 // '+0 42421230', or null
await readable.getProfile('+0 4242')          // all of the above in one answer
await readable.getAgent('+0 247')             // { endpoint, erc8004, payment }, or null
```

TypeScript types ship with the package.

## AI agents

A name can reach an AI agent: its records name the endpoint where the agent answers, its
ERC-8004 id and where it is paid. `getAgent` reads them, with the payment address falling back to
the wallet the name points to:

```js
const agent = await readable.getAgent('+0 247')
if (agent?.endpoint) await fetch(agent.endpoint, { method: 'POST', body: '…' })
```

An agent that speaks MCP can skip the SDK: readable.name serves an MCP server at
`https://readable.name/api/mcp` with tools to resolve names, look up wallets and dial agents.

## Options

| Option | Default | |
|---|---|---|
| `chain` | Base | A viem chain or its id. |
| `registry` | The known registry of that chain | Needed for Base until mainnet launches. |
| `rpc` | The chain's public RPC | Use your own in production. |
| `client` | | A viem public client to read through, in place of `rpc`. |
| `cacheMs` | 5 minutes | How long the list of namespaces is kept. |

## Names

A number can be written any way people write it: `+0 4242 1230`, `42421230` and `+0-4242-1230`
are the same. A username is `label.extension`, for any extension the registry holds.

Every function answers `null` for a name that reaches nobody: never registered, expired, or one
that can't exist.

## Coins

`getAddress(name, coin)` takes `'eth'` (the wallet the name points to, which Base, Ethereum, BNB
and most other EVM chains use), `'btc'`, `'sol'`, a SLIP-44 coin type, or any coder from
`@ensdomains/address-encoder/coins`:

```js
import { trx } from '@ensdomains/address-encoder/coins'

await readable.getAddress('+0 4242', trx)
```

A coin type with no coder comes back as the bytes the registry stores.

A name can point to its **agent wallet**, a wallet of its own (ERC-6551) that exists on the
registry's chain alone. Then `resolve` and the registry's chain answer it, `getProfile` says
`agentWallet: true`, and `'eth'` and every other EVM chain answer `null`: there nobody controls
that address.

## Resolve when you send

A name can change hands or run out. Read it at the moment money moves, not once at sign-up.
