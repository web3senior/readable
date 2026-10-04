import { records } from '@/config/records'
import { site } from '@/config/site'
import { readField } from '@/lib/records'

/**
 * Proving that a social account belongs to a name's holder. The holder's wallet signs a
 * statement naming the name, its token and the account; the account posts the signature; the
 * site checks that the post is the account's and that the signature is the current holder's.
 * Shared by the records form, which builds the post, and the route that checks it.
 */

const fill = (template, values) => Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template)

/** Where a network's proof link is kept in the records document. */
export const proofPath = (network) => `proofs.${network.id}`

/** The networks with a handle and a proof link in `document`, each with both. */
export const claimedProofs = (document) =>
  records.proofs
    .map((network) => ({ network, handle: readField(document, network.field), link: readField(document, proofPath(network)) }))
    .filter(({ handle, link }) => handle && link)

/** The statement the holder's wallet signs for `handle` on `network`. */
export const proofMessage = ({ name, tokenId, network, handle }) =>
  fill(site.verify.message, { name, network: network.label, handle, tokenId: String(tokenId) })

/** What the account posts: the name, its page and the signature. */
export const proofPost = ({ name, link, signature }) => fill(site.verify.post, { name, link, signature })

/** Where the network opens a new post saying `text`. */
export const composeLink = (network, text) => network.compose.replace('{text}', encodeURIComponent(text))

// A wallet's signature: 65 bytes from a key, longer from a contract account
const SIGNATURE = /0x[0-9a-fA-F]{130,}/g

/** Every signature written in `text`. */
export const signaturesIn = (text) => String(text ?? '').match(SIGNATURE) ?? []
