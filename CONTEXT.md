# Readable: context and decisions

Carried over from the session that designed and built this project (2026-09-24 → 26). Read it
before changing product behaviour; the "why" lines are the constraints.

## What it is

readable.name is a registry of readable names for wallets and AI agents: onchain numbers first,
then usernames under whichever extensions the owner adds onchain. It grew out of NameIt
(`htdocs/hupsocial/src/contracts/Naming Service/NameIt.sol`) and is a standalone brand, not
Hup-prefixed.

Roadmap order, decided by the user:
1. **Tunnel** (`htdocs/tunnel`): add contacts by number instead of `0x…` (its add-contact field is
   in `src/app/chat/_components/Chat.jsx`). A contact must pin number + address + key at add time
   and warn when the number's owner changes.
2. **PayPost** (`htdocs/paypost`): bill and pay a number; invoices can land in the payer's Tunnel inbox.
3. **Hup and agents**: a number resolves to an agent (records: endpoint, ERC-8004 id, payment
   address); a `dial` tool in hup-mcp; ratings tied to paid jobs.

## Decisions

- **Numbers launch first, usernames later (2026-09-27).** The launch registry holds Numbers
  alone. The app names no extension in code: the preview lineup is numbers only, and the search
  placeholder and example queries derive from the namespaces the registry holds
  (`lib/query/examples.js`, `noun` and `examples` in `kindDefaults`). This replaces the lineup of
  2026-09-26 below, which was a hardcoded list and is why the user called the design wrong.
  The example numbers are random on each visit (2026-10-02, the user's request): one of each of
  `exampleLengths`, with no leading zero and the check digit where one is due. They are drawn
  in the browser only, so a shimmer holds their place in the server's render. Since 2026-10-04
  (the user's request) there is one of each length from 2 to 7 digits, none with a check digit;
  it replaced a 2-digit and an 8-digit one. `site.search.exampleLimit` is 7, so an extension's
  username still fits once one is added.
- **The hero names both kinds (2026-10-03, the user’s request: "we have names and numbers both").**
  The copy names no extension; the search below it still offers only what the registry holds,
  so until an extension is added it says "Number".
- **The hero is short and links to the docs (2026-10-03, the user’s request, after
  dns.ton.org's "Get .ton domains").** `site.tagline` "Get a readable name", `site.subtitle`
  "Give wallets and AI agents a username or a number instead of a 0x… address." and a
  "More info" link to `/docs` (`site.hero.more`). The tagline is also the page title and the
  share card. They replace "Names and numbers for every wallet and agent." and "Replace 0x…
  with a username or a number, owned onchain like any token."
- **The hero names Robinhood Chain in a badge (2026-10-04, the user's request, after Arco's
  "lands in a real [Uniswap v4] pool").** After the subtitle: "Owned onchain on [Robinhood
  Chain], and **updates are gasless**." (`site.hero.line`, `chain`, `claim`). The badge holds
  the chain's logo (`public/robinhood.svg`, the user's file: since 2026-10-04 a lime feather
  without a tile, painted as a mask in `--color-chain-mark`, dark ink in light mode where the
  lime vanished, the lime in dark mode) and its name, a size smaller than the text. Each sentence of the
  description takes a line of its own, so it is two lines on a wide screen (the user's
  request). The share card keeps the plain `site.subtitle`. The
  user's word was "it will be on Robinhood", in reply to a Base badge: the registry is to live
  on Robinhood Chain. **Nothing else has moved yet**: `config/chains.js`, the deployments, the
  docs and the copy that names Base (its wallet, OpenSea, the onramp, the ETH/USD
  feed, the Hup forwarders) still follow the Base decision below. The claim is only about a
  holder's changes to a name: buying still costs gas.
- **Search copy lives in `config/site.js`, not in env (2026-10-04, the user's choice over
  hupsocial's `NEXT_PUBLIC_TITLE` and kin).** It is the same on every deployment, and a
  `NEXT_PUBLIC_*` value is fixed at build anyway. `site.description` is the hero in one sentence,
  under 160 characters; `homeChain` feeds it, the keywords and the hero's badge. The layout sets
  no `openGraph` title or description, so each page's preview carries its own; the home page
  and `/agents` name their own canonical (the layout's `/` had made `/agents` a copy of the
  home page). `app/robots.js` keeps crawlers off `/api/`; `app/sitemap.js` lists `/`, `/docs`
  and `/agents`.
- **The site says plainly how few apps read names yet (2026-10-04, the user's request).** The
  user's reason: most ENS-like registries of the last years failed on integration, not on
  building. The register dialog (not renew) says "Readable is new." and where a name works
  today, names the apps marked Next and links to the docs' list. `site.integrations` is that
  list, one app each with its stage (`next` built and waiting, `planned` not built, none once
  it reads names), and the docs' "In wallets and apps" is drawn from it. Name apps there, never
  a count, and mark an app live only once it ships: when one does, drop its stage and say so
  in `early.today`. Tunnel and Hup read names from the launch on (the user's word, the same
  day), so they carry no stage, the roadmap's "Add a contact by number" follows the site's own
  stage, and the chat scene of "How it works" lost its "Planned".
- **The search field takes the cursor on arrival (2026-10-03, the user's request)**, where a
  pointer hovers (`site.search.autoFocusMedia`): on a phone it would raise the keyboard over
  the page. Focused that way it keeps the recent searches shut until a click or a key.
- **The owner decides which extensions exist**, by `addNamespace` from `/admin`. The user's
  examples are `.lyx`, `.eth`, `.arc`. Each namespace carries free-form metadata JSON onchain;
  the app reads `label`, `title` and `about` from it, and the user plans more fields.
- **No ENS or LUKSO name resolution.** Both providers were built and then removed on request.
  A `.eth` or `.lyx` extension here is a Readable namespace of that name, not the other system's
  names: `alice.eth` on Readable and on ENS can belong to different people.
- **Numbers use a `+0` prefix.** No ITU country code starts with 0, so a Readable number can never
  be mistaken for a real phone number. Numbers carry no real-world identity.
- **A number is written with its digits unbroken: `+0 42421230` (2026-10-03, the user's
  request: "spaces between numbers cause confusion").** One space after the prefix, nothing
  between the digits. Replaces groups of four (`+0 4242 1230`), which split one number into what
  looked like several and left a lone digit at the end (`+0 4242 1`). Hyphens (`+0 4242-1230`)
  were proposed and rejected by the user: no separator at all. It is how `nameOf` writes a
  number onchain too. Only the display changed: the search, the SDK and `/admin` still take
  spaces and dashes, a page's path is `/names/+0-42421230`, and an old `/names/+0-4242-1230`
  link still opens. `formatNumber` and the SDK's `formatName` write it; `groupSize` is gone.
- **Long numbers end in a Luhn check digit** (from 8 digits). Number space is dense, so one wrong
  digit would otherwise reach a stranger. Long numbers are cheap (a dollar's worth a year, not free: the user expects free numbers to be
  registered in bulk by spammers, 2026-09-27); short ones are the scarce product.
- **No number starts with 0 (2026-10-03, review fix 3, approved by the user).** A leading zero
  adds nothing to the Luhn sum, so `042421230` passed whenever `42421230` did, at the same
  price, and `042` cost a quarter of `42`; someone writing `+0 4242 1230` without the plus, as
  many countries write a local number, reached a stranger. `_measureNumber` refuses it as
  `InvalidCharacter`. The app (`parseNumber`) and the SDK (`locateIn`) read a bare leading `0`
  as the prefix, so `04242` is `+0 4242`; `+0 04242` says "A number doesn't start with 0".
- **One home chain: Base (8453), rehearsed on Base Sepolia (84532). Decided 2026-09-29**, replacing
  Arc. The user chose reach (wallets, marketplaces, the largest USDC user base) over Arc's simpler
  purchase. The app's chain is `NEXT_PUBLIC_READABLE_CHAIN_ID` (`config/chains.js`). Deploying
  the same registry on several chains would break uniqueness; other chains should read it
  (CCIP-Read style).
- **Names are paid in ETH only (2026-10-03, the user's request, plan approved).** Replaces USDC as
  an ERC-20 with permit (2026-09-29). The contract has no payment token, no `setPaymentToken`,
  no `Permit` and no `UnexpectedNativePayment`: `register(namespaceId, label, years)` and
  `renew(tokenId, years)` are payable and take the exact price as `msg.value`, and `withdraw`
  sends ETH. Prices are fixed in ETH, the user's choice over dollar prices through Chainlink's
  ETH/USD feed (an oracle, stale-price checks and refunds): the owner reprices when ETH moves.
  Paying a name (the Pay button) sends ETH too, a plain transfer. What it cost: a buyer needs
  ETH on Base, and buying is no longer gasless (an ETH price can't travel in a signed request).
- **A price in ETH shows its dollar value under it (2026-10-03, the user's request)**, as
  "≈ $67.03", on the search card (and the launch preview) and under the yearly price and the
  total in the payment dialog (`components/search/UsdValue`). The rate is Chainlink's ETH/USD
  feed on Base (`ethUsdFeed` in `config/chains.js`, checked onchain: "ETH / USD", 8 decimals),
  read on the server by `/api/price` (`lib/ethUsd.js`) and kept for `site.usd.cacheSeconds`;
  an answer older than `site.usd.staleSeconds` shows nothing. A testnet's ETH is shown at the
  real ETH's price. Dollars keep cents below a hundred (`formatUsd` in `lib/format.js`). The
  prices themselves stay fixed in ETH: this is a display, not a dollar price.
- **A holder's changes to a name are gasless (2026-10-03, the user's words: "it must be gasless
  for updating names or numbers").** The forwarder is believed for `setTarget`,
  `setPrimaryName`, `setText` and `setAddrs` alone (`_relayedSender()`), the relayer sends
  them (`config/gasless.js`, 30 an hour per wallet each), and a smart wallet's goes to the
  paymaster instead (`sendNameChange` in `lib/registryActions.js`). Purchases, transfers,
  approvals and owner functions answer to `msg.sender`. The user chose name changes only, not
  transfers, so no signed request can move a name. The owner can still replace the forwarder
  (the user's choice over fixing it at deployment), so one it wrote could change any live
  name's target, records and addresses, though never move a name or act as the owner: open
  finding 1 of the review of 2026-10-03, said on `/docs` and on `/admin`.
- **Addresses, each confirmed onchain 2026-09-29.** USDC (no longer used since 2026-10-03): Base
  `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, Base Sepolia
  `0x036CbD53842c5426634e7929541eC2318f3dCF7e`. Hup forwarders (from hupsocial's
  `public/hup-skill.md`): Base `0xae95e44D2642F568D0e0Fc0d60202B55c8764567`, Base Sepolia
  `0x18B86518709a6C0942F3adCD0CD528D1716e0A80`.
- **A transfer re-points the name at its new holder**, and text records belong to one
  registration only. Why: recycled numbers must not deliver to the old holder's setup. A
  transfer clears the records too (approved 2026-09-29): `_update` bumps `_generation` like
  `_claim` does. Before that a transferred name kept the old holder's records, the agent payment
  address among them. An indexer following `TextChanged` must treat a transfer as a reset.
- **The owner can never take a name.** It can pause a namespace, reprice, and reserve labels.
  What is left (review of 2026-10-03, finding 5, open by choice): renewals pay the price of the
  day, so the owner could price a tier out, wait out the grace period and grant the names to
  itself. A cap at the registration price was weighed and not built: it would lock placeholder
  prices, and with prices fixed in ETH the owner has to follow ETH's dollar value both ways.
  `/docs` says it under the owner.
- **The forwarder was trusted for purchases only (2026-10-03, review fix 1), then for name
  changes only (the same day, with ETH).** Before the review the owner could point
  `setTrustedForwarder` at a contract of its own that named any holder as the caller and take
  any name in one transaction, and `onlyOwner` believed the forwarder too. `ERC2771Context` is
  gone; `_relayedSender()` is read only by the functions listed above, everything else reads
  `msg.sender`, and `isTrustedForwarder` stays for the forwarder's own check. A new relayed
  function is a contract change as well as a line in `config/gasless.js`.
- **UP and smart-account safe:** `_mint` (not `_safeMint`), the holder read from the forwarder for
  a change to a name, payouts by `.call`, explicit `initialOwner` (through the CREATE2 factory
  `msg.sender` is the factory).
- **Prices count from `priceFrom` (2026-10-03, review fix 4).** `Namespace` gained `priceFrom`, the
  `minLength` a namespace was added with, fixed. Before, the curve counted from the current
  `minLength`, so raising Numbers to 3 digits would have moved every renewal up a tier (a
  3-digit number from 500 to 2,000 a year). `minLength` now decides what is sold only. The app's
  `priceForLength` takes `priceFromOf(namespace)`.
- **The rules for names live in a contract of their own (2026-09-30).** The registry can't be
  upgraded and the rules for names will need to change, so it asks `nameRules`, a contract of
  the shape `INameRules` that the owner replaces with `setNameRules`. Chosen by the user over
  ASCII-only names, which would have been simpler and would have cost Persian names. New rules
  bind new registrations only: a name keeps its label and token id, and a renewal is priced by
  the `length` its record was given when it was registered. Without rules, or with rules that
  fail, no name is taken; numbers ask no rules. The owner still can't take a name through them:
  a held token id is refused whatever the rules spell.
- **The first rules (`NameRules.sol`, 1.0.0) refuse by default.** Taken: lowercase letters of
  Latin, Greek, Cyrillic, Armenian, Hebrew, Arabic, Georgian, and Chinese, Japanese and Korean
  characters; ASCII digits; hyphens inside. One script per label. A Greek or Cyrillic label needs
  a letter that doesn't pass for a Latin one. No combining marks but the Arabic vowel marks, in
  canonical order. The ZWNJ only between an Arabic letter that would join the next one and that
  letter. No label with hyphens third and fourth (`xn--`). Capitals are refused, the ASCII
  ones lowered first. Not taken yet: the Indic scripts and Thai, which need marks ordered.
- **The name rules, reviewed (2026-10-03, review fixes 2 and 6, approved by the user).** Still
  version 1.0.0: the user keeps every contract at 1.0.0 until mainnet. The first build took
  Cyrillic `раураӏ` (palochka for l) as a name drawn exactly like `paypal`, and Armenian had no
  look-alike rule at all. That build is the copy on Base Sepolia at `0x037F…e01b`, which also
  answers 1.0.0; the current one lands at another CREATE2 address. Now:
  - The look-alike list is Unicode's confusables data (UTS #39, 18.0): every Greek, Cyrillic
    and Armenian letter whose skeleton is a Latin letter, digit or run of them the rules take,
    66 letters, printed by `contracts/tools/look-alikes.mjs`. Kra is left out as a target, which
    keeps `сок` and `και` (kappa matches kra alone).
  - A Greek, Cyrillic or Armenian label needs one letter off that list. It now refuses some
    common words made only of look-alikes: Greek `για`, `ναι`, `σου`, Armenian `հայ`, `հաց`.
    Chromium's own lists were looked at and are stricter (they would refuse `кот`, `мост`).
  - Hebrew, Arabic and Georgian need no own letter: their look-alikes spell only l, o, v, y,
    and the rule would refuse words such as `סוס`.
  - Refused: compatibility forms (`ĳ`, `ŀ`, Arabic U+0675 to U+0678) and the Middle Welsh
    letters after U+1EF9; a Hebrew or Arabic label starting with a digit (RFC 5893: `1שלום`
    drew like `שלום1`); the katakana long vowel mark except after kana.
  - The `xn--` rule counts characters, not bytes.
  - Still two names, by choice: Romanian s and t with a comma and Turkish ones with a cedilla,
    katakana and Chinese characters drawn alike (`カード`, `力一ド`), with the yeh and kaf.
  - The app's joining tables in `lib/query/text.js` dropped U+0675 to U+0678 with it.
- **The app cleans a name before it sends it** (`cleanName` in `lib/query/text.js`): lowercase,
  digits to ASCII, and the ZWNJ, ZWJ, tatweel and variation selectors dropped where they show
  nothing. So a Persian name typed with a joiner after an alef is found under the name without
  it, instead of being refused. Its joining tables are those of `NameRules.sol`; change both
  together. The registry has the last word: what the app lets through and the rules refuse
  shows as "Not valid".
- **Prices are placeholders**, in ETH since 2026-10-03: the dollar placeholders turned into ETH at
  4,000 dollars an ETH (no rate was given). Numbers 0.5/0.125/0.025/0.00625/0.00125/0.00125/
  0.00025 ETH a year from 2 digits up; word extensions 0.04/0.01/0.00125 from 3 characters
  (`config/namespaces.js`). Final prices are still the user's call.
- **The lineup (2026-09-26, superseded 2026-09-27)** had `username.hup`, `.arc`, `.up`, three
  emoji extensions and numbers from 2 digits (`+0 42`). Only the numbers remain in the app; the
  rest is whatever the owner adds.
- **No emoji anywhere (2026-09-29).** The user had emoji removed to make the contract simpler
  and smaller. An extension is a lowercase ASCII word, a number prefix is digits, and a label
  with an emoji in it is refused, under every extension. `Kind` is `Name` (0) and `Number` (1);
  `Number` was 2 while `Kind.Emoji` existed. Since 2026-09-30 the name rules refuse emoji
  without listing them, as everything that is no letter. `hasEmoji` in the app is there for
  the message alone. Do not bring emoji back without the user asking.
- **"Subdomain" means `username.hup`** in the user's words: a name under an extension, which the
  registry already sells. Third-level names (`pay.alice.hup`) are not supported and not planned.
- **Numbers start at 2 digits.** Two-digit numbers are the scarcest product.
- **No referral fee (2026-09-30).** Built on 2026-09-27 (anyone named as `referrer` in `register`
  or `renew` earned one registry-wide percent, named by a `?ref=0x…` link) and removed on the
  user's request, to make the contract simpler. `register` and `renew` take no `referrer`
  argument; a payment is split between the namespace's manager and the registry alone. Do not
  suggest a referral fee again.
- **Treasury (2026-09-27), for a DAO later:** `setTreasury` makes the registry send its share of
  each payment there as it is paid; the owner keeps every admin power. Empty keeps funds for
  `withdraw`.
- **Every payout must arrive or the purchase reverts (2026-09-29).** The first version let a
  referrer or treasury that refused leave its cut in the registry, so neither could block a
  sale. That was a defect: a wallet's gas estimate only has to make the call succeed, so it
  starved the last payout and the treasury was silently skipped (found on the Base Sepolia fork:
  estimate 298,136 gas, full run 309,284). Never make a payout in `register` or `renew`
  optional again. The cost: a treasury that can't receive stops sales until the owner changes it.
- **Ownership moves in two steps (2026-09-30).** `Ownable2Step`: the owner offers, the new owner
  accepts from its own wallet, and until then the offer can be changed or withdrawn. Done when the
  user asked for the registry to be made ready for mainnet, so a mistyped address can't take the
  registry with it. `/admin` shows the offer as "Offered to" with an Accept button for the wallet
  it names. `renounceOwnership` is still there: an explicit act of the owner alone.
- **The trusted forwarder can be replaced, not removed** (`setTrustedForwarder` rejects the zero
  address). Since 2026-10-03 it is believed for a holder's changes to a name alone (see above).
  The admin form used to promise that empty turns relaying off; it now asks for an address.
- **No discount codes (2026-09-29).** They were built and removed the same day, the user's
  words: "if admin can register for free it's enough". A free or cheaper name is a grant: the
  owner registers it for the holder from `/admin` (`adminRegister`), without payment. `register`
  and `renew` take no `code` argument. Do not suggest discount codes again.
- **The relayer (2026-09-30, ported from Hup), relaying name changes since 2026-10-03.** It first
  made buying gasless: a buyer held USDC and no ETH, signed an EIP-2612 permit and an ERC-2771
  request, and the relayer behind `/api/relay` sent it. With ETH-only payments that is gone, and
  the same relay now carries a holder's changes to a name, the user's request (see above). The
  route takes only the functions in `config/gasless.js`, only on the registry, with no value,
  runs each first as the registry will see it, and refuses every other contract. Whenever the
  relayer can't take a change (no key, empty tank, a contract account, a refusal) the wallet
  sends it as an ordinary transaction, so gasless never blocks a change.
- **Addresses on other chains, as ENS keeps them (2026-10-02, approved by the user).**
  `setAddrs(tokenId, CoinAddress[])` and `addr(tokenId, coinType)`: the coin type is SLIP-44
  (Bitcoin 0, Solana 501) and the address is stored in the chain's own binary form, as ENSIP-9
  does; `AddressChanged` reports each change. Stored per generation like text records, so a
  transfer, a new registration and an expiry clear them with no new code. The user chose that
  Base, Ethereum, BNB and every other EVM chain use the name's one `target`, so the app offers
  only chains that aren't EVM: Bitcoin and Solana (`config/addresses.js`, one line a chain,
  with its coder from `@ensdomains/address-encoder`). The contract takes any coin type but an
  EVM chain's and any length, so which chains exist stays the app's choice. Not relayed, like
  every holder action. My names shows them as "Other chains". Since 2026-10-03 (review item 8)
  the contract enforces the EVM choice: `setAddrs` refuses coin type 60 and ENSIP-11's
  `0x80000000 | chainId` range (`InvalidCoinType`), and `addr` answers them with `target`, as
  the ENS gateway already did, so ENS-style readers never see a stored address apart from it.
- **The copy says "most EVM chains", never "every" (2026-10-03, the user's request).** The site,
  the docs, the MCP tool, the SDK and the Snap's README say a name's wallet works on Base and
  most EVM chains. The registry's rule is unchanged: `addr` and the ENS gateway answer every
  EVM coin type with `target`, so comments that describe that rule (in `Readable.sol`,
  `IReadable.sol` and the tests) still say every; a comment there is a change to the verified
  source.
- **Reserved numbers are bare digits.** `/admin` turns `111 111` and `+0 111 111` into `111111`
  before `setReserved`, which takes a batch. The contract has no pattern rule; each number is listed.
- **NFT data is offchain, behind a link the owner can change (2026-09-27).** The contract used
  to draw the name and image itself; the user had that removed because nothing onchain can be
  fixed later (it wrote `+0 42421230` where the site writes `+0 4242 1230`). `tokenURI` is now
  `baseURI` followed by the token id, set with `setBaseURI`, and ERC-4906 events tell
  marketplaces to reload. The user chose this site as the source (`/nft/<id>` and
  `/nft/<id>/image`, in `lib/nft.js`) over an IPFS folder: a CID is fixed content, so every new
  registration would need the folder republished and the link updated. The link can still move
  to IPFS later. `nameOf` stays onchain and stays ungrouped.
- **A name's records are one JSON document** under the text key `records` (`config/records.js`
  holds the structure, version 1). Why one document: the contract has no batch `setText`, so
  separate keys would cost a transaction each. Keys the site doesn't know are kept, so Tunnel
  or another app can store its own. Where a name points is not a record but the registry's
  `target` (`setTarget`), which resets on transfer.
- **Records are a contact card (2026-10-02, the user's request: "like smart phone's contact
  fields").** `components/names/RecordsDialog` shows the photo (or initials) and the name on
  top, then grouped rows with an icon each: profile (photo, display name, job title, about),
  contact (email, website, location, birthday), social (X, Telegram, GitHub, Hup) and AI agent.
  The user chose the personal fields: email, a city or country, birthday and job, and **no
  phone number and no street address**, because records are public and every earlier version
  stays in the chain's history (the dialog says so). One value per field, the user's choice, so
  other apps read a field without picking among several. A social profile is stored as the
  handle alone (`social.x: "alice"`); a pasted link such as `https://www.hup.social/@alice` is
  cut down to it, and each network's own rule checks it (Hup's is in `hupsocial/src/lib/username.js`).
  The keys of version 1 are unchanged, so nothing stored before breaks. Still no contract change:
  a new field is a line in `config/records.js`.
- **A LUKSO Universal Profile is a record the holder enters (2026-10-04, the user's request).**
  `social.up` holds the profile's address, typed or pasted like any record, under Social. The
  contact card shows the name and picture the profile publishes (LSP3, read on LUKSO by
  `/api/universal-profile/<address>`, `lib/universalProfile.js`, kept `cacheSeconds`), linked
  to its page; without them it shows the address. No check mark: it is the holder's word, like an
  unproven handle, so a holder can show someone else's profile. A first version had the
  profile sign for the name through the UP extension (ERC-1271, checked on LUKSO); the user had
  it removed the same day: "doesnt work, no need to sign just let them to enter". Not done
  either: an "Other chains" address (LUKSO is an EVM chain, coin type `0x8000002A`, which
  `setAddrs` refuses by design), pointing `target` at the UP (the same address on Base has no
  code, so a payment there would be stuck), and connecting the UP as the site's wallet (the
  registry is on Base). The server fetches a profile's document only from IPFS or Arweave
  through the gateway, or a `data:` link, never a host the profile names.
- **Names for agents (2026-10-04, the user's request, plan approved).** The user is weighing an
  app that creates an agent in one click, with a wallet the user limits, jobs paid over x402 and
  a reputation from paid jobs. The registry is its identity; wallets, jobs and reputation stay in
  contracts of their own. Three additions to `Readable`, made before mainnet because it can't
  be upgraded:
  - `registerFor(namespaceId, label, to, yearCount)`: `register` minted to `to` and pointing at
    it, with the same checks, price and payouts. `register` calls it. Not relayed.
  - **An editor per name** (`setEditor`, `editorOf`, `EditorChanged`): one account the holder
    names that may `setTarget`, `setText` and `setAddrs`, relayed like the holder's, and can't
    transfer, approve, name an editor or set a primary name. `setEditor` answers to
    `msg.sender` (the holder or an account it approved), like an approval. Stored per
    generation, so a transfer and a new registration clear it with no event; `editorOf` answers
    none for an expired name. The user chose that it can change `target` too, as ENS's manager
    can: an agent's wallet can change, and the records already hold the agent's payment
    address. Called editor, not manager (the plan's word), because `Namespace.manager` is a
    namespace's payee.
  - `generationOf(tokenId)`: the counter that already reset records, so a reputation contract
    keys by token id and generation and nothing passes to the next holder. It grows with each
    registration and transfer, never with a renewal.
  The name page gives the holder an Editor section, and the editor Points to, Records (without
  proofs, which only the holder's wallet signs) and Other chains; its summary shows the editor.
  `/docs` says it under Manage a name, Transfers, The registry, For AI agents, Events and the
  owner.
- **The deploy page only deploys and verifies (2026-09-29).** The user uses it for that alone
  and wants every setting of the registry on `/admin`. Its Registry setup panel (payment token,
  presets, reprice, reserve) is gone. `/admin` opens with `SetupGuide`, shown until done:
  Numbers, NFT data link (the payment token step went with the ERC-20, 2026-10-03). The Add form
  starts from `namespacePresets` (`config/namespaces.js`), prices typed in ETH. Do not put
  registry settings back on the deploy page.
- **The NFT data link is `https://readable.name/nft/` (2026-09-29).** This project serves every
  name's title and picture itself; the user wants no second server and no file per NFT. They had
  first set `https://huplabs.com/nfts/` on Base Sepolia, a plain folder, which needs a file
  uploaded for every name: never suggest a static folder or an export script again. A
  marketplace can't read `localhost`, and OpenSea has no testnets; Rarible's testnet and the
  explorers show Base Sepolia.
- **My names shows each name's NFT** at the top of its card, drawn by the site's own
  `/nft/<id>/image`, so it shows whatever the onchain link says.
- Brand explored and chosen: **readable.name** (tagline idea "0x… is not a name").
- **The primary color is Telegram's blue `#2aabee` (2026-10-04, the user's words: "make it
  blue like telegram")**, the light end of Telegram's logo gradient; the hover in light mode is
  its deep end, `#229ed9`. It replaces the violet `#c77dff` (2026-10-03), which had replaced the
  lime `#ccff00` (2026-10-03), the periwinkle `#8296f2` (2026-09-29) and the blue `#0b6bff`
  before it. Tried and replaced the same day: the terracotta `#c6613f` (it sat beside
  `--color-warning` and `--color-danger`, so a primary button read like a warning, and it was
  close to Claude's brand color) and the cyan `#22d3ee`. Green, red and amber already mean
  success, danger and warning, so the accent stays out of them. It is `--color-accent` in
  light and dark alike, and the background of the NFT picture (`nft.art` in `config/site.js`),
  the badge, the app icon, the Snap icon, the sample SVG and the deploy
  page. Ink on it is dark (`#0f1419`, 7.2:1), never white (2.6:1), unlike Telegram's own
  buttons. On white the blue is 2.6:1, so in light mode it is a fill only: a border, the
  focus ring, a spinner or an icon reads `--color-accent-line` (`#1088c6`, 3.5:1 on the soft
  fill), and text reads `--color-accent-text` (`#0d6ea1`, 5:1 on the soft fill). In dark mode
  both are the blue itself (6:1 and up). The Snap's manifest shasum covers its icon: run
  `mm-snap manifest --fix` after changing it. The WalletConnect sheet takes
  `--color-accent-text`, since AppKit sets its own accent as text and puts white ink on its
  accent buttons in light mode. The badge's dark label keeps white ink (`badge.labelInk`).

## State on 2026-09-26

- `contracts/src/Readable.sol` + `IReadable.sol`: 28 forge tests pass, runtime 22,954 bytes
  (1,622 under the limit). **Not deployed on Arc.**
- `/admin` (`src/components/admin/`): the owner's console. Reads the registry for anyone; actions
  (add/update/reprice/reserve/pause a namespace, grant a name, registry pause, grace period,
  payment token, forwarder, withdraw, transfer ownership) need the owner wallet. One
  `ActionDialog` driven by specs in `specs.js`; every call goes through `lib/adminActions.js`.
  Not linked from the header; the owner opens the URL.
- `contracts/deploy/deploy.html`: CREATE2 deploy plus a Registry setup panel (Numbers and
  Extension presets, reprice, reserve). Proven end to end on a local Anvil (chain id 5042).
- The app runs in preview mode until `NEXT_PUBLIC_READABLE_ADDRESS` is set. With it set, search,
  Available/Taken cards, register and renew were proven end to end against Anvil.
- Not a git repository yet; nothing committed.

## State on 2026-09-27

- Contract with referral fee and treasury: 37 forge tests pass, runtime 23,711 bytes (865 under
  the limit, so any further contract feature needs a size check first). `register` and `renew`
  gained a `referrer` argument, so every caller passes one (`address(0)` for none). Still
  **not deployed on Arc**; the CREATE2 address changed with the bytecode.
- `/admin` gained Treasury, Referral fee and NFT data link rows.
- After the onchain art was removed: 40 forge tests pass, runtime 22,707 bytes (1,869 under the
  limit). The CREATE2 address changed again with the bytecode.
- After the payout fix: 40 forge tests pass, runtime 22,764 bytes (1,812 under the limit).
  **Not deployed anywhere yet.** The whole flow passed on a local fork of Base Sepolia with its
  real USDC and the wallet's own gas estimate.
- With records cleared on transfer: 53 forge tests pass, runtime 24,374 bytes (**202 under the
  limit**). Not deployed: Base Sepolia still runs the build before it at
  `0xfc3ead9ddA28f079022943007eF0a3B725d1747f`, whose verification input is kept in
  `contracts/deploy/verification/deployed/`. The app's ABI is unchanged, so the site works with
  both.
- `/names` (My names, `src/components/names/`), linked from the account menu: the connected
  wallet's names, each with Point to a wallet, Make primary, Records and Renew. It reuses the
  admin's `ActionDialog` and `lib/adminActions.js`, which send any registry call.

## State on 2026-09-29

- Contract with discount codes: 52 forge tests, runtime 24,326 bytes, 250 under the limit. This
  build is the one on Base Sepolia at `0xfc3ead9ddA28f079022943007eF0a3B725d1747f`. The build
  before it is at `0x5aFB6acCC9aD4c598E477862eA4a8fFA4FE1c3a9` (22,764 bytes). The verification
  input of both is kept in `contracts/deploy/verification/deployed/`.
- **After discount codes and emoji were removed: 39 forge tests pass, runtime 22,234 bytes,
  2,342 under the limit** (2,140 freed). It includes the records cleared on transfer. **Not
  deployed.** `register` and `renew` lost the `code` argument, so the app's ABI matches neither
  build on Base Sepolia: the rehearsal needs a new deployment, at a new CREATE2 address, and
  that address in `.env.local`.
- Gone from the app with them: the Discount codes panel on `/admin`, the code field of the
  payment dialog, `lib/discounts.js` and `tests/e2e/discount.mjs`.

## State on 2026-09-30

- Gasless buying, a port of hupsocial's relay to viem: `config/gasless.js` (what is relayed),
  `lib/relayGasless.js` (the browser signs), `lib/relayer.js` and `app/api/relay/route.js` (the
  server checks and sends), `abis/Forwarder.json` (copied from Hup). Hup's version is built on
  ethers and carries its session keys, chains and post throttles; none of that came over.
- The route reads the forwarder from the registry (`trustedForwarder`) and its signing name
  from the forwarder (`eip712Domain`), so neither is configured: Base Sepolia's is
  `HupChatForwarder`, Base's is `HupForwarder`.
- Proven on a fork of Base Sepolia with a buyer holding USDC and 0 ETH: register 392,709 gas,
  renew 137,541, a purchase with referrer and treasury 378,971. At Base's gas price on that
  day (0.006 gwei) a registration costs the relayer about 0.0000024 ETH, before the L1 data fee.
- The whole end-to-end suite passed on that fork with the build of 2026-09-29 (no discount
  codes, no emoji). **Still not deployed.**

## Contract review (2026-09-30)

The user asked for a test of every function and a check for mainnet, then for the recommended
fixes and a second check.

- **Tests: 249 pass** in 11 suites (`contracts/test/`), 39 of them the earlier ones. Coverage:
  `Readable.sol` 98.3% of lines and 98.8% of branches, `NameRules.sol` 99.4% and 90.7%; every
  external function is called. Before the review: 92.9% and 60%. `Fixture.sol` sets the
  registry up as on Base: a six-decimal dollar token with permit, a real OpenZeppelin forwarder
  and the first name rules.
- `Fork.t.sol` runs against Base itself when `BASE_RPC_URL` is set (skipped otherwise): the real
  USDC, its permit and the real forwarder, a Persian name bought through it included.
- `Findings.t.sol` holds the findings by their number: a fixed one by a test of the fix, an
  open one by a test of what the registry still does.
- **Sizes after the fixes:** `Readable` 20,408 bytes (4,168 under the limit), `NameRules` 3,833.
  After the referral fee was removed the same day: `Readable` 19,809 bytes (4,767 under),
  242 tests. With two-step ownership: 19,997 bytes (4,579 under), 244 tests, coverage
  98.3% of lines and 98.7% of branches of `Readable.sol`. The whole end-to-end suite passed
  again on a fork after each change. **Not deployed.**
- **Fixed:**
  1. `trustedForwarder()` follows `setTrustedForwarder`. The relay route still checks that the
     registry trusts the forwarder it names.
  2. `renew` is never stopped by a pause, which stops new registrations only.
  3. The grace period stays between 30 and 365 days (`MIN_GRACE_PERIOD`, `MAX_GRACE_PERIOD`).
     It still applies to names already in their grace period, which a cut can release, but
     never before their thirtieth day.
  4. Invisible characters and letters of another script make no twin of a name: the name rules
     above.
  5. Only letters, digits and hyphens pass.
  6. `text` answers with nothing for an expired name.
- **Also changed:** `setReserved` refuses a label that could not be a name and reserves the
  form it would be registered under, and `Record` gained `length`. The constructor's second
  argument is named `forwarder`.
- **Open, by the user's choice or undecided:**
  - 4, what is left: letters of one script that look alike are two names (Arabic and Persian
    yeh and kaf, l and 1), and look-alikes between two scripts other than Latin. A reservation
    made under earlier rules can only be lifted under rules that still take its label.
  - 6, what is left: an expired name stays an NFT of its last holder (`ownerOf`, `balanceOf`,
    `namesOf`) until someone registers it. It can't be moved.
  - 7, what is left: `renounceOwnership` would lock the balance in. The transfer itself is fixed,
    in two steps.
  - 8. Gone with the ERC-20 (2026-10-03): there is one currency, and `withdraw` sends all of it.
  - 9. A payee that can't take ETH (a contract without a way to receive) fails every sale that
    pays it. Known cost of "every payout must arrive". USDC's block list is gone with USDC.
- **The two forwarders are different contracts.** Base Sepolia's `HupChatForwarder` (3,973 bytes)
  also accepts a `personal_sign` signature, which a wallet shows as unreadable bytes. Base's
  `HupForwarder` (3,870 bytes) accepts typed data only. Checked on forks of both.
- Not a professional audit. One was recommended to the user before mainnet.

## Wallet chooser (2026-09-27)

- Ported from hupsocial's `ConnectWallet`: `ui/DialogSheet` (a bottom sheet with drag-to-dismiss on a
  phone, a centered dialog from `sm`) and the connector list with WalletConnect. One surface for
  every caller of `useWalletDialog()`; hupsocial's anchored desktop panel was not brought over.
- Left in hupsocial: the email wallet (needs its OTP and keystore API), Solana, Safe and the
  community strip.
- `.env` holds hupsocial's WalletConnect project id. It survives the e2e cleanup, which deletes
  `.env.local` only. Production needs the site origin allowed in Reown, or a project of its own.
- WalletConnect draws its sheet in the page, below the top layer, so the chooser closes before it
  opens. `lib/walletConnectTheme.js` restyles it to the site theme on each open.

## Home page story (2026-09-27)

- Below the search: `components/home/Story` (pitch and a button that focuses the search) beside
  `components/home/ChatDemo`, a chat in messenger greens that plays once when scrolled into view.
  Modelled on the chat on ens.domains. Copy is `site.story`; the greens are the `--color-chat-*`
  tokens.
- The green is the bright one of a messenger's app icon (2026-09-29, sampled from the image the
  user gave: `#3ce25b` down to `#1ec940`), the same in light and dark. The ink is white, as on
  the icon: dark ink on the green was tried first and the user rejected the look. White on the
  header is under 2.3:1, which the user accepts; the sent bubble is a deeper green (`#1fab4f`)
  so that message text reaches 3:1.
- The chat names no other product. Its claim is the one true of any phone-number messenger: it
  knows your phone number, your contacts and who you talk to.
- The number is `site.story.chat.digits` in the number namespace's own format, never a literal.
- It promises roadmap item 1: Tunnel does not take numbers yet, which the note under the button
  says.

## Home page hero (2026-09-29)

- **Off the page since 2026-09-30:** the user had the animation removed from the hero, which
  is the title, the subtitle and the search again. `WalletDemo` is still in `components/home`,
  with its holders in `site.hero`, but nothing renders it. What follows describes that file.

- Above the title: `components/home/WalletDemo`, a pill in which a wallet's address turns into
  its number, letter by letter, then leaves for the next holder. The user asked for "a wallet
  that turns to a number, something cool".
- The holders are `site.hero.holders`: made-up addresses, and digits written in the number
  namespace's own format (`hooks/useNumberNamespace`, shared with the chat). A number of 8
  digits or more has to end in its check digit.
- Motion is cube-motion's own: `useMorph` for the letters and the pill's width, `leave` and
  `rise` between holders. The faces are the component's own elements, not `Morph`'s, because
  the number is set larger and in the accent.
- The whole address shows where it fits (measured against a hidden copy, no breakpoint in
  code); a phone shows it shortened.
- It loops while it is on screen. With reduced motion it rests on the first number.

## Home page rows (2026-09-29)

- **Off the page since 2026-09-30:** the user had the partners row and the story (with its
  chat) removed from the home page, which now ends with the latest activity. `Partners`,
  `Story` and `ChatDemo` are still in `components/home`, with their copy in `config/site.js`,
  but nothing renders them. What follows about them describes those files.

- Under the search: `components/home/LatestActivity` (once `LatestBuys`), then
  `components/home/Partners`, then the story.
- **Latest activity is a table (2026-10-04, the user's request: "show latest activity
  including update or set too", "it's not clean make it like a table").** It replaced Latest
  buys, a list of purchases alone (2026-09-30, which had replaced a row of cards). Columns:
  Name (a link to its page), Activity (an icon and a word), Wallet, Paid, When; a phone keeps
  Name, Activity and When. When is short, `4m`, `20h`, `3d`, `6w`, `1y` (the user's request,
  `formatAgo` in `lib/format.js`; weeks instead of months, whose narrow form reads as
  minutes), and links to the transaction. Kinds are `site.activity.kinds`: bought, granted,
  renewed, transferred, repointed, records updated, other chains set, made primary, editor
  named or removed. It has no heading (the user had "Latest buys" removed). The wallet's
  picture is `ui/Identicon`, the blockie Hup draws beside a profile, which the user asked for.
  The user wanted the feed to encourage a visitor, so under the table is an empty slot with a
  button that focuses the search (`site.activity.next`, `lib/focusSearch.js`). It shows
  `site.activity.limit` rows, eight.
- **Latest activity** comes from `/api/activity` (`lib/activity.js`), read on the server and
  kept for `site.activity.cacheSeconds`, so visitors don't each read the chain. The events come
  from Blockscout (`eventsApiFor` in `config/chains.js`), every kind in one page of the
  registry's logs, because the public Base RPCs serve logs a thousand blocks at a time (about
  half an hour); the newest blocks are read from the chain as well, which is all a local Anvil
  has. One row per name and transaction, its most telling event: a registration also mints,
  and a transfer also re-points the name. The wallet is the new holder of a name bought,
  granted or transferred, and otherwise who made the change: the caller, or the signer read
  from the forwarder's request when the relayer sent it (never the relayer), or, from inside a
  smart account, the holder now. The price is the ETH sent with the transaction; a grant is
  told by `adminRegister`. A smart account's purchase (the user's own wallet is an EIP-7702
  account, whose buy went through a bundle with value 0) is priced by the inner call that
  reached the registry, read from Blockscout's trace (`readPaymentsInside` in `lib/events.js`);
  several in one transaction pair with its payments in order, and without the explorer it shows
  no price. The table is absent in preview mode and until the registry has a name.
- **Partners** are `site.partners.items`, each a name, a logo in `public/partners` and an
  optional link. The row shows logos alone: the user had the "Partners" heading and the names
  beside the logos removed (2026-09-30), so both are only what a screen reader says. Every
  logo shows in grays (`filter: grayscale`), the user's choice over its own colors
  (2026-09-30); one marked `ink: true` is painted through a CSS mask in the text's ink, so
  one file serves light and dark. Hup and Tunnel, the user's own products, stand in
  for partners the user has not named yet; never list a company there that the user has not
  named. The ten network logos from Tunnel (`public/partners/networks`) were added on the
  user's request (2026-09-30); the registry itself still lives on Base alone.

## How it works (2026-10-02)

- The last section of the home page, `components/home/HowItWorks` with its phone screens in
  `HowItWorksScreens`. The first version, cards wired into one number with dots running along
  the lines, was rejected by the user as not meaningful, and the dots as not good.
- It shows four scenes, the four things the user asked to show: the number's profile (its
  address on most EVM chains, Bitcoin, Solana and records), paying a number, adding it as a
  chat contact, and dialling an agent by its number. Copy, the holder and the agent are
  `site.howItWorks`.
- **A row each, no slider (2026-10-03, the user's request).** The scenes used to take turns on
  one stage behind a row of tabs. Now each scene is a row: its words on one side, its own dark
  stage with the phone on the other, the sides swapping row by row from `lg` (on a phone the
  words come first). Each phone plays its scene while it is on screen and starts it again when
  it ends, its screen rising in afresh; the mouse over a stage pauses it, so it can be read.
- **The streaks of light are gone (2026-10-03, the user's request)**, and with them
  `--color-light-core`. Then the user had the dark boxes go (`--color-stage` is gone), and
  after them the frosted glass (`--color-glass*`) and the gradients: the colored light behind
  each phone and the tint at the top of the agent's call. A stage has no box of its own, only
  the phone, a plain card of the page's own surfaces in either theme. The phone itself, not a
  card around it, is ringed by a faint glow of four colors, after a picture the user gave
  (`--shadow-glow`: green, cyan, violet and pink, a corner each, at 30%, made lighter on the
  user's request). The chat scene's green header is the messenger being shown and keeps its
  gradient.
- **Above the rows, a tree of what a number answers with (2026-10-03)**, after a picture the
  user gave (a tilted, out-of-focus diagram of cards fanning out by curved lines), to show that
  a number returns several things: `components/home/NumberMap`. The number fans out to its
  kinds (wallet, other chains, contact card, AI agent), and the kind shown fans out to its rows
  (the same wallet on Base and most EVM chains, the Bitcoin and Solana addresses, the card's
  fields, the agent's endpoint, id and payment address). The kinds take turns while it is on
  screen; a phone shows the number and its kinds alone. Copy is `site.howItWorks.map`.
- The agent scene carries the docs' "Planned" stage, since the `dial` tool takes no numbers
  yet. Drop `stage` from a step in `site.howItWorks` once it ships. The chat scene lost its own
  on 2026-10-04: Tunnel takes numbers from the launch on.
- **The example number is `+0 8888 8888`** (the user asked for a cool number, and one whose
  last digit is not 0; it passes the Luhn check). The agent's is `+0 247`.
- **The Pay scene sends 25 USDC (2026-10-04, the user's request)**, replacing 0.01 ETH. The
  scene is a wallet's own send screen, not the site's Pay dialog, which still sends ETH; don't
  bring the two back in line.

## Docs page (2026-09-30)

- `/docs` (`src/app/docs/page.jsx`), linked from the header (from `sm` up) and the footer. One
  page with its contents beside it, modelled on Arco's docs (`htdocs/arco/src/app/docs`): a
  sidebar on a wide screen, a row of pills under the header on a phone.
- Sections are listed once in `config/docs.js`; the sidebar (`components/docs/DocsNav`) lights
  the one being read. A section's id on the page must be one of that list.
- **The page itself reads nothing.** It is written from the config (the launch number format,
  `registry`, `home`) and sent at once. The first version read the registry on the server
  before sending the page, which made every load wait for the public RPC (a second and more);
  the user's words: "wtf is this??? takes long time to load????". Never make this page, or any
  page, wait for the chain on the server.
- What the registry decides is read by the browser afterwards (`hooks/useDocsFacts`,
  `readRegistryTerms` in `lib/registry.js`, kept for `site.docs.staleMs`) and shown by
  `components/docs/LiveFacts`: the price tables, the extensions and the grace period. A
  skeleton or the launch value stands in until it answers, and the launch
  values in preview. Numbers are `site.docs.examples` in the launch number format.
- The code it prints (`components/docs/samples.js`) names the configured chain and registry.
  Every sample was run against the current build on a local chain: `resolve` answers the zero
  address from the moment the term ends, while `lookup` names the holder through the grace
  period; `namesOf` keeps a name whose term has ended; a transfer clears records and the
  sender's primary name. Run them again after a change to the contract's read functions.
- It says the owner can't take a name, and that it can replace the trusted forwarder, which the
  registry trusts to name who signed a change to a name, so a forwarder it wrote could change
  any live name (2026-10-03). It says renewals cost the price of their day.
- **Other chains (2026-10-02, the user's request):** what a coin type is (SLIP-44), that it is
  not a chain id, and ENSIP-11's `0x80000000 | chainId` for EVM chains, computed for the home
  chain. Its coin types come from `config/addresses.js`.

## Search result and shared links (2026-09-30)

- **A search shows one name, as a page of its own**, modelled on dns.ton.org, which the user
  gave as the example: the status, the name in display size, a panel with the price (or the
  holder and the expiry), the button, then the About link and Copy link. It replaced the grid
  of cards, one per namespace. The first candidate is the result; the same label under the
  other namespaces is offered beneath it ("Also"), and picking one searches for that name.
- **While a name is looked up the home page steps aside**: the title, the subtitle and the
  latest activity are hidden (`data-searching` on the search, `:has()` in `page.module.scss`), so
  the page is the search and its result.
- **A shared link carries the search as `?q=` (2026-10-03, the user's words: "do not use # in
  urls, use search params")**: `/?q=4242`, `/?q=alice.arc` (`lib/searchLink.js`,
  `site.search.queryParam`). It replaces `/#4242` (2026-09-30, after `dns.ton.org/#name`). The
  address follows the search as it is typed (`replaceState`, no navigation), an empty search
  leaves a bare `/`, and a `+` is written `%2B`. The server reads the parameter, so a shared
  link arrives already searching. A `/#4242` link, an old share or an NFT's old `external_url`,
  still opens: the hash is read in the browser and the address rewritten to `?q=`. The NFT's
  `external_url`, the MCP server's register link and every in-app search link use `?q=`.
- Nothing is written to the address before it has been read (`ready` in `SearchExperience`).
  The first version wrote on mount and wiped the name off every shared link.
- **The search follows the address too (2026-10-03)**: the logo, or any link to `/` or to another
  search, is served from the router's cache and doesn't start the search over, so the field kept
  its text and wrote it back. `SearchExperience` reads `useSearchParams()` and takes the address
  when it names something else. It works because the search writes the address with
  `history.replaceState(null, …)`: Next.js syncs `useSearchParams` with that call, and skips a
  call that passes its own `history.state`, as one version did.
- **Copy link shares the name's page since 2026-10-03** (`/names/+0-4242`), part of the growth
  work the user asked for: a path reaches the server, so the link's preview shows the name
  (`app/names/[name]/opengraph-image.jsx`, drawn from the path alone). The address bar follows
  the search with `/?q=4242`.

## Reservations on /admin (2026-10-02)

- Each namespace card lists the labels it holds reserved, shortest first, in the site's own
  format (`lib/reservations.js`, `hooks/useReservations`). The registry keeps only their hashes,
  so the list is read back from every `ReservedUpdated` event, the last event of a label
  deciding. No contract change.
- The events come from `lib/events.js`, which the latest activity now shares: Blockscout's pages
  plus the newest `site.events.recentBlocks` read from the chain, so a reservation shows the
  moment its transaction confirms, and on a local Anvil, which Blockscout doesn't know.
- **The reservation list needs Blockscout to answer.** The chain alone serves the newest blocks
  only, so without the explorer the card says "Could not be read" instead of showing part of
  the list. The first version fell back to the chain and would have shown "None". Blockscout
  answers an address it has never seen with an empty list, so a local Anvil still works. No
  function of the contract lists reservations: `_reserved` is a mapping keyed by the label's hash.

## Photo uploads to IPFS (2026-10-02)

- The user asked that the records photo be uploadable to IPFS with Hup's APIs, nothing hard
  coded. Ported from `hupsocial/src/lib/filebase.js` and `app/api/ipfs/file`: `lib/filebase.js`
  pins through Filebase's IPFS RPC with Hup's retry, `app/api/ipfs/route.js` takes one photo
  (`GET` tells whether uploads are on). Settings are in `config/ipfs.js`; the token is
  `FILEBASE_IPFS_RPC_TOKEN` and the gateway `NEXT_PUBLIC_IPFS_GATEWAY_URL_PRIMARY`, the same
  variables as Hup's, so its values can be reused. Without the token the upload is hidden and a
  photo is a pasted link. Hup's presigned S3 path (for video) and HEIC transcoding were not
  brought over.
- A photo is a JPEG, PNG, WebP or GIF up to 4 MB, told by its first bytes; the route renames it
  `photo.<ext>` and throttles 20 uploads an hour per visitor, in memory like the relay. Only
  the pinned link reaches the records, and only when the holder saves them.
- Tried end to end with a stand-in for Filebase's RPC (`FILEBASE_IPFS_RPC_URL` points
  elsewhere); never against Filebase itself, which needs the user's token.

## Home page "How it works" (2026-10-02)

- `components/home/HowItWorks`, under the latest activity, after an illustration the user gave
  (Gemini Notebook's): cards for a wallet on every EVM chain, Bitcoin, Solana, a contact card and
  an AI agent, whose lines flow into one number. All inline SVG colored by tokens; the
  travelling dots are SMIL `animateMotion`, paused off screen and hidden with reduced motion.
  Copy is `site.howItWorks`; the number is `digits` in the number namespace's format.

## A page for each name (2026-10-02)

- The user asked for "another page to show details instead of showing in modals". Each name
  has `/names/<name>`: `/names/+0-4242-1230` (a number's groups joined by dashes) or
  `/names/alice.arc`, built by `namePath` (`lib/namespaces.js`) and read back by the search's
  own parser. `components/names/NamePage` shows the NFT, the holder, where it points and the
  expiry for anyone, and for the holder of a live name every change in a section of its own:
  Points to, Primary name, Records (`RecordsForm`, the contact card) and Other chains.
  `ActionPanel` renders the same specs the dialogs took (`components/names/specs.js`), inline.
- The page is read in the browser (`useNamePage`, `readNamePage` in `lib/registry.js`); the
  server sends it at once, as on `/docs`.
- My names cards keep the summary and gain **Manage**, a link to the page; their change
  buttons and dialogs are gone. A search result that is yours offers Manage too. **Renew stays
  a dialog**: it is the checkout, with the wallet's signatures.
- `ui/Button` with an `href` inside the site now renders Next's `Link`, so moving between
  My names and a name's page keeps the app and the wallet connection.

## SDK and API (2026-10-02)

- The user asked for "an api or a mini library" to resolve a name, after LUKSO's
  `getAddressRecord`, and chose both. `packages/sdk` is `readable-sdk` (`@readable` is someone
  else's npm organisation): `createReadable({ chain, registry, rpc })` with `resolve`,
  `getAddress(name, coin)`, `getRecords`, `getName` and `getProfile`, on viem with multicall
  batching. It knows the Base Sepolia registry; Base needs `registry` until mainnet. **Not
  published to npm**: publishing is the user's step, and the docs already say
  `npm install readable-sdk`.
- The app imports it through a path alias in `jsconfig.json`, not a pnpm workspace, so the
  install is unchanged. The SDK's registry address lives in `packages/sdk/src/registry.js`:
  update it with each deployment the SDK should know.
- The API is built on it: `GET /api/resolve/<name>` (what `getProfile` answers, 404 when the
  name reaches nobody) and `GET /api/reverse/<address>`, open to any origin and cached for
  `site.api.cacheSeconds`. `/docs` has an "SDK and API" section.
- `tests/e2e/sdk.mjs`, run after `names.mjs`, checks both against the fork.

## Reach: paying, sharing, agents and wallets (2026-10-03)

The user asked for ideas to bring users on board, then had sections 2, 3 and 4 of the answer
built: make one name useful by itself, distribution, and easier buying. A Persian and Arabic
version of the site was left out by the user. No contract change; all of it reads the registry
as deployed.

- **A name's page is for visitors too.** `NamePage` shows anyone a read-only contact card
  (`ContactCard`), a Pay button, Add in Tunnel, Watch, Make an offer (OpenSea, Base only:
  `marketplaceFor` in `config/chains.js`) and a share panel (link, QR code from `ui/QrCode`, a
  badge). The holder keeps the change sections and gets the share panel and a renewal reminder.
  The QR code is dark on light in either theme: `--color-qr-ink` and `--color-qr-plate`.
- **Paying a name** (`components/names/PayDialog`, `lib/pay.js`): ETH since 2026-10-03, sent as a
  plain transfer to the wallet the name points to, looked up again right before signing. The
  USDC version sent it gasless as `transferWithAuthorization` (EIP-3009) through
  `/api/relay/transfer`, which is gone. The throttle lives in `lib/relayer.js` (`waitFor`,
  `countHit`), shared by the relay and the paymaster.
- **Keypad words** (`lib/query/keypad.js`): a word in the search is also the number it dials
  (`crypto` is `+0 2797 86`; 8 digits or more get a check digit after the word). Usernames come
  first where an extension takes the word; the number leads when none does. Search only:
  `parseQuery(…, { keypad: true })`; a name's page never reads a word as a number.
- **Next to a taken number**, up to four free neighbours (`lib/nearby.js`, one multicall of
  `lookup`), plus Pay, View profile and Watch for someone else's name.
- **Watch list** (`lib/watchlist.js`): in this browser only, shown on My names with the day each
  name returns (expiry plus the grace period) and a calendar file for that day.
- **Reminders are calendar files** (`lib/calendar.js`, RFC 5545): 30 and 7 days before expiry.
  The site keeps no email and sends nothing.
- **Proven accounts** (`lib/proofs.js`, `lib/verify.js`, `/api/verify/<name>`): the holder's
  wallet signs a statement naming the name, its token and the handle; the X post or GitHub gist
  carries the signature; its link is stored under `proofs.<network>` in the records. The server
  reads X's oEmbed and GitHub's gist API (no keys; GitHub allows 60 an hour, so answers are kept
  `site.verify.cacheSeconds`) and checks the signature against the holder now, contract
  accounts included. Only X and GitHub; Telegram and Hup have no public post to read.
- **Agents**: `/agents` and `/api/agents` (`lib/agents.js`) list live names whose records name an
  agent endpoint or ERC-8004 id, found through `TextChanged` events. `/api/mcp` is a stateless
  MCP server (`lib/mcp.js`): `resolve_name`, `lookup_address`, `check_name`, `dial_agent`,
  `list_agents`, `payment_details`. The SDK gained `getAgent` and TypeScript types (0.2.0).
- **ENS gateway** (`lib/ens.js`, `/api/ens/{sender}/{data}.json`, `config/ens.js`): answers ENS's
  OffchainResolver (CCIP-Read) for `<label>.readable.eth`: `addr`, `addr(coinType)` (60 and
  every ENSIP-11 EVM coin type give the name's wallet), `text` (ENS keys mapped onto the
  records), `contenthash` and `multicall`, signed with `ENS_GATEWAY_PRIVATE_KEY`. It does
  nothing until a resolver contract on Ethereum points at it, which is a contract and waits for
  the user's approval of a plan. This is the opposite direction of the removed ENS lookup: it
  publishes Readable names into ENS, it reads no ENS name.
- **Mini app**: `MiniAppBridge` connects Hup's wallet through Hup's own SDK script when the site
  is framed by hup.social (`lib/miniAppHost.js`). **Nothing of Farcaster (2026-10-04, the user's
  request: "remove everything about Farcaster, even from envs")**: its manifest, the
  `fc:miniapp` and `fc:frame` tags, the card pictures of `/api/miniapp/<kind>`,
  `@farcaster/miniapp-sdk` and `FARCASTER_*` are gone, and with them the Base app, which ran the
  site as a Farcaster mini app. Do not bring them back without the user asking.
- **Easier buying**: `OnrampLink` (Coinbase's onramp, `/api/onramp`, a session token made with
  `CDP_API_KEY_*`; Base only, hidden without keys), selling ETH since 2026-10-03. A paymaster
  (ERC-7677, when `PAYMASTER_URL` is set): `/api/paymaster` opens the userOp (Coinbase Smart
  Wallet's `execute`/`executeBatch`, ERC-7579's `execute`). It first passed on USDC approvals
  and paid purchases; since 2026-10-03 it passes on only a holder's changes to a name, with no
  value, so a smart wallet changes its names without a fee too. `sendNameChange` and
  `sendAdmin` resolve with `{ hash }` or `{ callsId }`, read by `waitForPayment`.
- **Badge** (`/api/badge/<name>`): "Pay me at +0 4242" as SVG, drawn from the path.
- **Admin**: Grant several (`grantManySpec`), one line per name, for founding numbers such as
  Hup creators'. One wallet confirmation per name, in list order.
- **Outside this repo**: `packages/snap` (a MetaMask Snap for name lookup, built, not
  published; `@metamask/snaps-sdk` pinned to 12.0.1, the newest platform production MetaMask
  runs). Tunnel: New chat takes `+0 4242`, the contact keeps `readable: { name, address, at }`
  in its encrypted blob, the card warns when the number points elsewhere, and `?add=+04242`
  invites work (`lib/readableName.js`, `hooks/useReadablePin.js`). Hup: a profile shows the
  wallet's primary number (`components/ReadableNumber.jsx`). Both read readable.name's API
  (`NEXT_PUBLIC_READABLE_API`). Neither repo is committed.
- Proven on a fork of Base Sepolia by `tests/e2e/reach.mjs` (30 checks, see Local end-to-end).
  Not proven there: a real X or GitHub proof (the negative path and the signature are), the
  onramp (no testnet), a smart wallet's batch through a live paymaster (the guard is), Tunnel
  and Hup in their own apps (their name parsing and lookup are).

## State on 2026-10-02

- With addresses on other chains: 240 forge tests pass (and the Base fork suite, skipped without
  `BASE_RPC_URL`), runtime 20,752 bytes (**3,824 under the limit**), coverage of `Readable.sol`
  98.3% of lines and 98.8% of branches. `NameRules` is unchanged. **Not deployed.**
- On a fork of Base Sepolia, `names.mjs` saved a Bitcoin and a Solana address through the
  dialog and read them back, and a transfer cleared them.
- **Deployed on Base Sepolia by the user:** `Readable` at
  `0x88aB72cC1CA8ED8B21456ce3C9b1f07Bd0cAac7D` (block 47,591,043), owner
  `0x20e229667Cec8A0e9D3C6Fb89693B2a44ec2C50e`, the Hup forwarder. Its bytes match this build
  (immutables aside). `.env.local` points at it. Not set up yet (no payment token, no
  namespaces) and not verified. `NameRules` 1.0.0 is the copy already at `0x037F…e01b`.
  Verification inputs of both are in `deploy/verification/deployed/`.
- The rehearsal before it, `0x58Be857D66E0F8FCC830B687b3e81ed25Ec0df74` (19,997 bytes, two-step
  ownership, USDC and two namespaces), is unverified and its verification input was never
  saved: this session's artifact build overwrote it. It can be rebuilt from the source without
  the addresses change.

## State on 2026-10-03

- The user asked for a deep review of the contracts, then for the recommended fixes. Fixed:
  forwarder for purchases only (1), the name rules (2 and 6), no leading zero (3), `priceFrom`
  (4), EVM coin types answered with the target (8). Open: the owner prices renewals (5, said on
  `/docs`), a new payment token keeps the old numbers (7: prices must be set again with it; an
  atomic switch with prices was not built, no fix had been recommended), the twins across
  languages listed under the name rules. `test/Findings.t.sol` holds them as `SecondReviewTest`,
  `test/Twins.t.sol` the rules. Both contracts stay at version 1.0.0, the user's choice
  (2026-10-03): nothing is on mainnet yet.
- **258 forge tests pass**, 1 skipped; the Base fork suite passes against Base itself
  (`BASE_RPC_URL=https://mainnet.base.org`): a relayed registration 423,989 gas. `Readable`
  20,829 bytes (**3,747 under the limit**), `NameRules` 5,058. Coverage not run again.
- **The ABI changed**: `Namespace` has `priceFrom` after `checkDigitFrom`, and there is a new
  error `InvalidCoinType`. The SDK's ABI follows; it still names `0x88aB…ac7D`, which runs the
  build before and has no namespaces yet. **That deployment no longer matches the source**: the
  rehearsal needs a new `Readable` and a new `NameRules` (each at a new CREATE2 address; the
  rules on Base Sepolia are the first build), then `.env.local` and
  `packages/sdk/src/registry.js` pointed at them.
- The whole end-to-end suite passed on a fork of Base Sepolia, against a production build on
  port 3007 (a dev server ran on 3003): fund, deploy, launch, app, admin, treasury, names, sdk,
  nft, gasless and reach (all 30 checks). Two steps needed help, neither from these changes:
  the NFT link form takes https only and the build served http, so that one setting was sent
  from the owner account; and `reach.mjs` needs the owner `admin.mjs` hands away, so it ran from
  a snapshot after `app.mjs` with `.arc` added by `cast`.
- Fixed on the way: `admin.mjs` clicked "Grant" where "Grant several" now matches too, and the
  reserved-labels list missed a reservation confirmed a moment before: `lib/events.js` read a
  block number viem had cached (`getBlockNumber({ cacheTime: 0 })` now). `/docs` said a pause
  stops renewals; it never does.
- **Later the same day: ETH only, gasless name changes** (decisions above). Review finding 7
  went with the payment token; finding 1 is open by the user's choice (a replaced forwarder can
  change names). **250 forge tests pass**, 1 skipped; the Base fork suite (7 tests) passes
  against Base: a registration 304,640 gas, a relayed change of target 57,242 for the relayer.
  `Readable` **19,659 bytes (4,917 under the limit)**. The ABI changed again: `register` and
  `renew` lost the permit, and `paymentToken`, `setPaymentToken`, `Permit`,
  `PaymentTokenUpdated` and `UnexpectedNativePayment` are gone. The whole end-to-end suite
  passed again on a fork with the same two helps (all 32 checks of `reach.mjs`). Prices show in
  ETH with four significant digits below one (`lib/format.js`).
- **Deployed on Base Sepolia by the user (2026-10-03):** `Readable` at
  `0x7c636853ECFA14e61d3A9Ec0c9501d66D17797D6` (block 47,636,239), owner
  `0x20e229667Cec8A0e9D3C6Fb89693B2a44ec2C50e`, the Hup forwarder `0x18B8…0A80`. Its runtime
  bytes are this build's, byte for byte (ETH only, gasless name changes). Not set up yet (no
  namespaces, no name rules) and not verified. Its verification input is
  `deploy/verification/deployed/84532-0x7c63…97D6.json`. `.env.local` and the SDK
  (`packages/sdk/src/registry.js`) point at it. The new `NameRules` build is not deployed: its
  CREATE2 address with the default salt is `0x9b701f64690234c199d58f54913B1b1fE3096834`, needed
  only when usernames launch. `0x88aB…ac7D` runs the build before and is left as it is.

## State on 2026-10-04

- With `registerFor`, editors and `generationOf`: **268 forge tests pass**, 1 skipped (18 new in
  `test/Agents.t.sol`); the Base fork suite (7 tests) passes against Base. `Readable` **20,233
  bytes (4,343 under the limit)**. The ABI only gained (`registerFor`, `setEditor`, `editorOf`,
  `generationOf`, `EditorChanged`), so every existing call of the app, SDK and MCP server is
  unchanged. The name page reads `editorOf` with a fallback, so it still works on `0x7c63…97D6`.
- **`0x7c63…97D6` no longer matches the source.** The rehearsal needs a new `Readable` at a new
  CREATE2 address, then `.env.local` and `packages/sdk/src/registry.js` pointed at it. Its
  verification input was saved before the rebuild (`deployed/84532-0x7c63…97D6.json`).
- End-to-end on a fork, against a production build on 3007 behind an https proxy on 3008 (a
  `dev:ssl` server ran on 3003): deploy, launch, app, admin, treasury, sdk and the new
  `editor.mjs` passed, the editor's changes relayed with no fee. `names.mjs` made every change
  (`sdk.mjs` read them back) and then failed on a stale count: the Universal Profile field made
  16 record fields where it expected 15. Fixed, not run again on a fresh chain. `nft.mjs`,
  `gasless.mjs` and `reach.mjs` were not run.

## Pending

- **Mainnet, in this order (2026-09-30):** a professional audit of `Readable.sol` and
  `NameRules.sol` first. Then, from the owner wallet on the deploy page: deploy `Readable`
  (the Base forwarder is prefilled) and `NameRules`; ask the user before verifying either on
  the explorer; copy `deploy/verification/Readable.json` and `NameRules.json` to
  `deploy/verification/deployed/8453-<address>.json`. On `/admin`: Numbers at the final prices
  (in ETH), the NFT data link `https://readable.name/nft/`; name
  rules and the first extension only when usernames launch. On the server: `.env.local` with
  the chain, the address, a private RPC and `RELAYER_PRIVATE_KEY` of a fresh wallet funded
  with a little ETH; the site origin allowed for the WalletConnect project. Rehearse the same
  on Base Sepolia first, on a new deployment of the current build: `0x7c63…97D6` has no editors.
- Which fields an extension's metadata should carry beyond label, title and about.
- Final prices.
- Ideas raised and not decided: a falling premium on released names and a commit step against
  front-running (both as in ENS), and a pattern filler for the Reserve dialog.
- Showing a name's records where it is looked up (the search card shows the owner only).
- Set the NFT data link after deploying; until then wallets show no title or image.
- Gasless in production: a relayer wallet of its own, its key in `RELAYER_PRIVATE_KEY` on the
  server, funded with ETH on Base. `GET /api/relay` tells its address and balance. Until then a
  holder's changes go out as ordinary transactions.
- Idea: a number assigned at signup. It would have to be granted by the owner or paid for by the
  app, since no number is free.
- **Reach, the steps that are the user's (2026-10-03):** approve a plan for the ENS resolver
  contract (ENS's OffchainResolver, MIT, unchanged: its URL `https://readable.name/api/ens/{sender}/{data}.json`,
  its signer the address of `ENS_GATEWAY_PRIVATE_KEY`), deploy it on Ethereum and set it as the
  resolver of `readable.eth` (or of `readable.name` imported into ENS), then set
  `ENS_RESOLVER_ADDRESS`. Publish `readable-sdk` 0.2.0 and `readable-snap`, and ask MetaMask to
  list the Snap. List the mini app on Hup. Set
  `CDP_API_KEY_*` and `PAYMASTER_URL` (with the paymaster's own allowlist: the registry). Deploy
  Tunnel and Hup with `NEXT_PUBLIC_READABLE_API`.
- An idea from the same answer that needs the contract, so it belongs before mainnet: a fair
  launch for short numbers (a commit step or a falling price). `registerFor` from that answer
  is built (2026-10-04).

## Local end-to-end

1. `anvil --fork-url https://base-sepolia-rpc.publicnode.com --chain-id 84532`: a local copy of
   Base Sepolia, so the forwarder and the CREATE2 factory are the real ones.
2. `node tests/e2e/fund.mjs` sets the buyer's balance back to 10,000 ETH. Then
   `node tests/e2e/deploy.mjs` deploys the registry and the name rules through deploy.html. XAMPP must serve htdocs; the page is
   at http://localhost/readable/contracts/deploy/deploy.html.
3. `.env.local` with `NEXT_PUBLIC_READABLE_CHAIN_ID=84532`,
   `NEXT_PUBLIC_READABLE_ADDRESS=<printed address>`,
   `NEXT_PUBLIC_READABLE_RPC=http://127.0.0.1:8545` and `NEXT_PUBLIC_BASE_URL=<the app's origin>` (the
   NFT data link is built from it), then `pnpm dev`.
4. `node tests/e2e/launch.mjs`: as the owner on `/admin`, follows the setup guide: Numbers at the
   launch prices in ETH. With `E2E_OWNER=<address>` and that address impersonated
   (`anvil_impersonateAccount`), it rehearses a registry already deployed on Base Sepolia.
   Then `node tests/e2e/app.mjs`: connects a wallet and registers `+0 4242` for two years.
5. `node tests/e2e/admin.mjs`: as the owner, sets the name rules, adds `.arc`, reprices, reserves (numbers
   too), grants, pauses and resumes, sets a treasury and the NFT data link, then checks the
   search sees `alice.arc`, the granted name, `+0 42` and the reserved numbers, and calls a
   name with an emoji or a Cyrillic look-alike not valid, and hands ownership to the buyer in two
   steps. Needs a fresh chain (an extension can only be added once); restart Anvil for one.
6. `node tests/e2e/treasury.mjs`: registers `+0 4343` and checks that the treasury received the
   0.025 ETH. It pays with the gas the wallet estimates, which is what caught the skipped
   treasury payout.
7. `node tests/e2e/names.mjs`: as the buyer, opens the page of `+0 4343` from My names, points it at another wallet, makes
   it primary, saves its records and its Bitcoin and Solana addresses, then reads them all back
   from the registry. Then `node tests/e2e/sdk.mjs` reads the same back through the SDK and
   the API. Then `node tests/e2e/editor.mjs`: the buyer makes Anvil's fourth account the editor
   of `+0 42421230`, which points it and saves its records from the name's page, then removes it.
8. `node tests/e2e/nft.mjs`: follows `tokenURI` to the site and checks the name and image of
   `+0 4242` and `+0 4242 1230`.
9. `node tests/e2e/gasless.mjs`: with `RELAYER_PRIVATE_KEY` in `.env.local` set to `RELAYER_KEY`
   of `tests/e2e/setup.mjs`, registers `+0 4646` with ETH, empties the buyer's ETH, then points
   the name elsewhere and saves its records from its page, and checks the holder paid no fee.
   With the key set, the changes in steps 5 and 7 are relayed too.
10. Blank the values in `.env.local`, let the server reload, then delete the file. The site
   returns to preview mode without a restart.
11. `node tests/e2e/reach.mjs`, after step 4: relays a holder's change and refuses a relayed
   purchase, pays a name from its page in ETH, checks the page, the share panel, keypad words,
   free neighbours, the watch list, a proof's signature, the agents directory, the MCP server,
   the ENS gateway's signed answers and the paymaster's guard (name changes only). The app needs `RELAYER_PRIVATE_KEY`, `ENS_GATEWAY_PRIVATE_KEY` set to `ENS_KEY` of the
   script and `PAYMASTER_URL` at a closed port (`http://127.0.0.1:9/`).

## Gotchas

- The Write tool turns `\uXXXX` in file content into raw characters. Source keeps invisible
  characters as escapes (see AGENTS.md); write them from a script with `String.fromCharCode(92)`.
- `years` is reserved in Solidity (hence `yearCount`). solc refuses `string(hex"…")` with invalid
  UTF-8; go through a `bytes` variable.
- wagmi 3: `useConnection` / `useConnectors`; `writeContract` asserts the chain, so `switchChain` first.
- Playwright: `playwright-core` from `htdocs/monsoon`, launched with the installed
  `chromium-1228` executable (the package expects a newer build).
- A screenshot taken right after an instant Anvil confirmation can catch a dialog mid-close.
- `next dev` refuses a second server for the same directory. If one is already running (for example
  `dev:ssl`), point the e2e scripts at it with `E2E_APP`; the scripts
  accept its self-signed certificate.
- A running `next dev` reloads its environment when an env file changes, not when one is deleted.
  After deleting `.env.local`, restart the server; otherwise it keeps the Anvil address and RPC
  and the search shows "Couldn't reach the registry" once Anvil stops.
- The dev servers on this machine change ports between sessions (Hup, Tunnel and Readable have
  each been on 3001). Check which port answers with the Readable title before running the e2e
  scripts, and set `E2E_APP` and `NEXT_PUBLIC_BASE_URL` to it.
- Addresses recalled from memory can be wrong: the Base USDC address first tried had no code.
  Confirm a token or forwarder onchain (`symbol()`, `eth_getCode`) before writing it down.
- `build-artifacts.mjs` overwrites `deploy/verification/Readable.json`. After a deployment, copy
  that file to `deploy/verification/deployed/<chainId>-<address>.json` before the next build, or
  the input that verifies the deployed bytes is gone.
- `.env.local` holds the user's Base Sepolia settings. Copy it aside before an end-to-end run
  and put it back after, instead of deleting it as step 10 says.
- The relayer key of the end-to-end run is Anvil's third account, a public key: never fund it
  on a real chain. On the fork it shows 1,207 earlier transactions, because others use it too.
- A deployment inside a pranked call takes the prank: `vm.prank(owner); registry.setX(address(new Y()))`
  sends `setX` from the test itself. So does building a signed request there. Build first, prank after.
- Foundry's coverage needs `--ir-minimum` here, and then reports a few lines as never run that
  tests do run (`pause`, `unpause`).
- The Bash tool turns `\uXXXX` into raw characters too, in a script it writes as in a file.
- "exceeds max transaction gas limit" from a wallet is rarely about gas. A call that would revert
  can't be estimated, the wallet falls back to a huge limit, and Base rejects that. It first
  showed when the site (with discount codes) called a `register` the deployed build didn't have.
  `sendRegistryCall` in `lib/registryActions.js` now runs every call before the wallet signs, and
  `paymentError` names a version mismatch when the refusal carries no reason. After any change to
  `register` or `renew`, redeploy and update `NEXT_PUBLIC_READABLE_ADDRESS`.
- The first build of `NameRules` is on Base Sepolia at its CREATE2 address
  (`0x037FA3784CF157c2c1c935250467541C7B29e01b`), so a fork inherits it. `deploy.mjs` reuses
  a copy already at the current build's address (no constructor argument, no state); it used to
  wait for the address to be empty and timed out. Both builds answer `version()` with 1.0.0,
  so tell them apart by address, not by version.
- `admin.mjs` timed out waiting for the reserved labels on the `.arc` card (2026-10-02). Cause,
  found 2026-10-03: the refresh after the reservation read events up to a block number viem had
  cached from before it, and nothing refreshed again. Fixed in `lib/events.js`.
- `admin.mjs` is not idempotent (an extension is added once, the rules toast appears once) and
  ends by handing ownership to the buyer, which `reach.mjs` can't work with. Take an Anvil
  snapshot (`evm_snapshot`) after `app.mjs` and revert to it (`evm_revert`) instead of
  restarting the fork for each try; `reach.mjs` also needs an extension (add `.arc` with `cast`).
- `/admin`'s NFT data link form takes https, IPFS and Arweave links only, so against a plain
  http build `admin.mjs` stops at that step. Send `setBaseURI` from the owner account instead,
  or put an https proxy with `certificates/localhost*.pem` in front of the build and point
  `E2E_APP` and `NEXT_PUBLIC_BASE_URL` at it (done 2026-10-04, a dozen lines of `node:https`).
- With another session's `next dev` running on this directory, test against a production build
  instead (2026-10-03): export the `NEXT_PUBLIC_*` values of the fork, `next build`, then
  `next start -p 3007` with the server-only keys in its environment, which wins over
  `.env.local`. `NEXT_PUBLIC_*` values are baked in at build, so build again with the normal
  env afterwards. `next dev` writes to `.next/dev`, so the two don't collide.
- The app validates labels before the contract does (`lib/query/rules.js`); when the contract's
  rules widen, widen them there too or the search calls a valid name invalid. The app may be
  looser than the registry, whose answer is shown, and must never be stricter.
- `build-artifacts.mjs` takes the first build info in `out/build-info` that covers a source, and
  an incremental `forge build` leaves the old ones there. Run `forge clean` before
  `forge build --build-info`, or the frozen verification input can be of an older source.
- In the Bash tool a heredoc collapses `\\` to `\` and a long one has failed to parse; write
  Solidity and scripts with backslashes or many quotes through the file tools.
