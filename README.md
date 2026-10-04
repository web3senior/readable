# readable.name

Readable names for every wallet and agent. Onchain numbers (`+0 42`) launch first. Usernames
under an extension (`alice.arc`) follow: the registry owner adds each extension onchain, and the
site shows whatever the registry holds. Every name is an NFT in the Readable registry on Base, paid for in ETH.
A holder's changes to a name cost it no fee: the site's relayer sends them.

## How it differs from X Numbers

In September 2026 X launched X Numbers: an eight-digit number such as `6880-5899` that lets people
message or call an account inside X. A Readable number looks similar and is a different thing. An
X Number is a private contact code inside one app. A Readable number is a public identity its
holder owns.

| | X Number | Readable number |
| --- | --- | --- |
| How you get it | Assigned at random | Chosen by you |
| Who controls it | X; refreshing replaces it | You, as an NFT you can transfer or sell |
| Where it works | Inside X | Any app that reads the registry |
| What it reaches | Messages and calls | A wallet address and its records |
| Who can hold one | X accounts | People and AI agents |
| How it is shared | With people you trust | Safe to publish |

What that means in practice:

- **Owned, not assigned.** Nobody can rotate or revoke a Readable number, the registry owner
  included. It moves only when its holder transfers it.
- **Chosen and scarce.** Short numbers like `+0 42` are rare and priced by length. Long numbers cost
  very little and end in a check digit, so one mistyped digit fails instead of reaching a stranger.
- **Open.** The registry is a public contract on Base. Any wallet, app or agent can resolve a number
  without asking permission.
- **Not a phone number.** Every number starts with `+0`. No country code starts with 0, so a
  Readable number can't be mistaken for a real phone number or for a number from another service.

On the roadmap, building on the same registry:

- Add a contact by number in Tunnel, with a warning when a number changes hands.
- Bill and pay a number in PayPost.
- Dial an AI agent by number, with its endpoint and payment address held in the number's records.
- A number given at signup.
- Receive controls, since a permanent public number can't be refreshed to escape spam: contacts
  only, or a small fee for strangers to reach you.

## Run

```bash
pnpm install
pnpm dev        # http://localhost:3005
```

Copy `.env.example` to `.env.local`. With `NEXT_PUBLIC_READABLE_ADDRESS` empty the site runs in
preview mode: it searches `previewNamespaces` from `src/config/namespaces.js` (numbers only) and
quotes launch prices. With the address set it reads the registry's namespaces, shows live
Available and Taken states, and registers and renews from the connected wallet.

`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` adds WalletConnect to the wallet chooser, which is how a phone
browser reaches a wallet app. Without it the chooser lists installed browser wallets only.

## Contracts

`contracts/` holds the registry (`src/Readable.sol`, `src/IReadable.sol`), its forge tests and the
deploy page. See `contracts/deploy/README.md` for build, deploy and setup.

## Where things live

| Change | File |
| --- | --- |
| Brand, copy, search behaviour | `src/config/site.js` |
| Chains and RPCs | `src/config/chains.js` |
| Wallet connectors, WalletConnect options | `src/config/wallets.js` |
| Registry address, validity copy | `src/config/registry.js` |
| Per-kind display copy, preview lineup | `src/config/namespaces.js` |
| Colors, radii, spacing, type (light + dark) | `src/styles/_themes.scss` |
| Registry reads and writes | `src/lib/registry.js`, `src/lib/registryActions.js` |
| Owner actions (the `/admin` page) | `src/components/admin/`, `src/lib/adminActions.js` |
| How input becomes candidates | `src/lib/query/` |
| What a name may be made of | `contracts/src/NameRules.sol`, `cleanName` in `src/lib/query/text.js` |
| Gasless changes to a name (what is relayed, signing, the relayer) | `src/config/gasless.js`, `src/lib/relayGasless.js`, `src/app/api/relay/route.js` |
| What a holder can change (the `/names` page) | `src/components/names/` |
| The structure of a name's records | `src/config/records.js` |
| The docs (the `/docs` page) | `src/app/docs/page.jsx`, contents in `src/config/docs.js`, code samples in `src/components/docs/samples.js` |
| What wallets show for a name (`/nft/<id>`) | `src/lib/nft.js`, `nft` in `src/config/site.js` |

A new extension is an `addNamespace` call on the registry, from the `/admin` page with the owner
wallet connected; the app picks it up with no code change. The deploy page only deploys. An extension's name is a lowercase word; names take no emoji. Its label, title and about
copy come from the namespace's metadata JSON, falling back to the kind's defaults. The search
placeholder and the example queries follow the namespaces too, so no extension is named in code.

## What a name holds

A holder manages its names on `/names`, reached from the account menu.

| | Where it lives | Changed with |
| --- | --- | --- |
| The wallet it points to | The registry (`target`) | Point to a wallet |
| Primary name of a wallet | The registry | Make primary |
| Records | One JSON document under the text key `records` | Records |

```json
{
  "v": 1,
  "name": "Alice",
  "about": "Designer in Lisbon",
  "avatar": "ipfs://…",
  "url": "https://alice.example",
  "agent": { "endpoint": "https://alice.example/mcp", "erc8004": "412", "payment": "0x…" }
}
```

Every field is optional. An app reads the document with `text(tokenId, "records")` and may keep
keys of its own in it; the site leaves them untouched. A transfer points the name
at its new holder and leaves its records behind, as does a fresh registration after it expired.

## What wallets show

The registry holds no artwork. A name's `tokenURI` is a link prefix the owner sets, followed by
the token id. The site answers at `/nft/<id>` with the name, description and attributes, and at
`/nft/<id>/image` with the image, so both can be redesigned without touching the contract. The
prefix can also point at an IPFS folder, which then needs a file per name.

## Where a payment goes

Every registration and renewal is split as it is paid:

| Share | Goes to | Set by |
| --- | --- | --- |
| Manager share | The namespace's manager, if it has one | The owner, per namespace |
| The rest | The treasury, or the registry itself until one is set | The owner |

The manager takes its percent of the full price; the rest is the registry's.
