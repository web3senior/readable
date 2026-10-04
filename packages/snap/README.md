# readable-snap

A MetaMask Snap that resolves [readable.name](https://readable.name) numbers and names in
MetaMask's send field. Type `+0 4242 1230` (or `alice.arc` once usernames launch) and MetaMask
shows the wallet the name points to, labelled Readable. From an address, it shows the primary
name that wallet chose.

It reads names through readable.name's API (`/api/resolve/<name>` and `/api/reverse/<address>`),
which reads the registry on Base. A Readable name points to the same wallet on most EVM chains,
so the Snap answers on Ethereum, Base, Optimism, Arbitrum, Polygon and BNB Chain.

## Build

```sh
npm install
npm run build        # writes dist/bundle.js and updates the manifest's shasum
npm start            # serves the Snap on http://localhost:8081 for MetaMask Flask
```

Test it in [MetaMask Flask](https://metamask.io/flask/) with `local:http://localhost:8081`.

## Publish

1. `npm publish` (the package name is `readable-snap`).
2. Ask MetaMask to allowlist it: name-lookup Snaps run in production MetaMask only once listed
   ([Snaps directory](https://snaps.metamask.io)).

`@metamask/snaps-sdk` is pinned to the newest platform version production MetaMask supports;
raise it only when MetaMask does.
