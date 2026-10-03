# Deploy

`deploy.html` is a deterministic CREATE2 deployer with source verification. Serve it over
http so it can read its files: with XAMPP, http://localhost/readable/contracts/deploy/deploy.html.

## Build

```bash
cd contracts
forge build --build-info
forge test
node deploy/build-artifacts.mjs
```

The script writes `artifacts/Readable.json` (picked in the page), `../../src/abis/Readable.json`
(the app's ABI) and `verification/Readable.json` (the standard-JSON input, frozen with the build
so a later verification publishes exactly the deployed bytes). The picker dates each artifact by
its file time; a `.sol` edited after that stamp means rebuild first.

## Deploy on Base

Rehearse on Base Sepolia (84532) first, then repeat on Base (8453).

1. Connect the wallet that will own the registry.
2. Pick **Readable**. `initialOwner` fills with the connected wallet (it must be explicit: through
   the factory, `msg.sender` is the factory). `trustedForwarder` fills with the chain's Hup
   forwarder. It can be replaced later with `setTrustedForwarder`, not removed, and it can act as
   any holder, so trust only one you control.
3. **Load bytecode**, check the predicted address, **Deploy**. The default salt is
   `keccak256("readable")`; derive another from a label to deploy the same build twice.

## Set up

This page only deploys and verifies. Everything about the registry is set on the app's `/admin`
page, with the owner wallet:

1. Put the chain and the deployed address in the app's `.env.local` as
   `NEXT_PUBLIC_READABLE_CHAIN_ID` and `NEXT_PUBLIC_READABLE_ADDRESS`.
2. Open `/admin`. **Finish setting up** lists what a fresh registry needs, in order: the payment
   token (USDC, filled in for the chain), Numbers at the launch prices, and the NFT data link.
   Numbers wait for the payment token, because prices are stored in the units of the currency in
   force when they are typed, and on Base the native coin is ETH.
3. The rest is on the same page: treasury, reserved numbers, and later each
   extension.
4. Before the first extension, deploy **NameRules** from this page and set its address on
   `/admin` under **Name rules**. It decides what the label of a name may be made of, and the
   owner can replace it. Numbers need none.
