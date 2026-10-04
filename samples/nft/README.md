# Sample NFT data

What a wallet or marketplace reads for one name, `+0 4242 1230`. The site produces both files
live for every registered name; these copies show the shape.

| File | Served by the site at | What it is |
| --- | --- | --- |
| `metadata.json` | `/nft/<token id>` | Title, description, image link and attributes |
| `image.svg` | `/nft/<token id>/image` | The picture |

The token id of this name is
`97777072972893470552268196847448963764225090304689912102410055650548199618836`. A token id is
`keccak256(namespaceId, label)` read as a number; the registry's `tokenIdOf(1, "42421230")`
returns it.

## The fields

| Field | Meaning |
| --- | --- |
| `name` | The name as the site writes it, numbers in groups of four |
| `description` | One sentence, from `nft.description` in `src/config/site.js` |
| `image` | Link to the picture |
| `external_url` | The name's page on the site |
| `Kind` | `Number` or `Name` |
| `Length` | Digits or characters, which is what sets the price |
| `Registered`, `Expires` | Unix time in seconds; marketplaces show them as dates |

## Changing the design

Colors, sizes and wording are `nft` in `src/config/site.js`; the layout is `nftImage` in
`src/lib/nft.js`. A change shows for every name at once, with no transaction.

## Hosting on IPFS instead

The registry builds a name's link as its NFT data link followed by the token id, with no file
extension. So an IPFS folder holds one metadata file per name, named by the token id alone:

```
<folder>/
  97777072972893470552268196847448963764225090304689912102410055650548199618836
  77790791367694919471700135171367860275136632961822087505627816847742825467362
```

Each file's `image` then points at a picture hosted the same way, for example
`ipfs://<images CID>/<token id>.svg`. With the folder pinned, set the NFT data link on `/admin` to
`ipfs://<folder CID>/`.

A folder is fixed content: a name registered later is not in it. Every batch of new names means a
new folder, a new CID and the link set again.
