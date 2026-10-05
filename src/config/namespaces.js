import { home } from '@/config/chains'

// Same order as IReadable.Kind, so an onchain kind index maps straight onto these
export const KIND = {
  NAME: 'name',
  NUMBER: 'number',
}
export const KIND_BY_INDEX = [KIND.NAME, KIND.NUMBER]

// What the owner can add
export const OFFERED_KINDS = [KIND.NAME, KIND.NUMBER]

/**
 * Display copy per kind. A namespace's onchain `metadata` JSON (label, title, about) overrides
 * any of it; `{name}` is replaced with the namespace name. `noun` names the kind in the search
 * placeholder; `examples` are offered on an empty search when they pass the namespace's rules.
 * `exampleLengths` offers a number of each length, drawn at random on each visit; a range, [8, 11],
 * offers one of a length drawn in it.
 */
export const kindDefaults = {
  [KIND.NAME]: {
    label: '.{name}',
    title: '.{name} names',
    noun: 'username',
    examples: ['alice.{name}'],
    about: {
      title: 'What are .{name} names?',
      body: [
        'A readable name under the .{name} extension, owned as an NFT.',
        'The part before the dot is a word in any script, so alice.{name} is a name. Emoji are not part of names.',
      ],
    },
  },
  [KIND.NUMBER]: {
    label: 'Numbers',
    title: 'Onchain numbers',
    noun: 'number',
    // One of each length from the scarcest up, then a long one, which ends in its check digit
    exampleLengths: [2, 3, 4, 5, 6, 7, [8, 11]],
    about: {
      title: 'What are onchain numbers?',
      body: [
        'A number works like a phone number for your wallet: easy to say, easy to type, and the same in every language.',
        'People and AI agents can both own one. Short numbers are rare; long numbers cost very little and end in a check digit that catches typos.',
      ],
    },
  },
}

/**
 * The launch lineup, searched with preview prices until NEXT_PUBLIC_READABLE_ADDRESS points at a
 * deployed registry. Same shape as an onchain namespace: `prices[0]` is the yearly price at
 * `minLength` (onchain, `priceFrom`: the shortest length the namespace started with), each next
 * entry one character longer, the last one for everything longer.
 *
 * Numbers launch alone. Extensions are never listed here: the owner adds each one onchain and
 * the app reads it from the registry.
 */
const numbers = {
  id: 'number',
  kind: KIND.NUMBER,
  // No ITU country code starts with 0, so a +0 number never collides with a real phone number
  name: '0',
  chainId: home.id,
  minLength: 2,
  maxLength: 12,
  // Long numbers end in a Luhn check digit, so one mistyped digit fails instead of reaching a stranger
  checkDigitFrom: 8,
  currency: 'ETH',
  // Placeholders, in ETH: 2,000 down to 1 dollar a year at 4,000 dollars an ETH. The longest
  // numbers keep a small price: free ones would be registered in bulk by spammers
  prices: [0.5, 0.125, 0.025, 0.00625, 0.00125, 0.00125, 0.00025],
}

export const previewNamespaces = [numbers]

/**
 * What the admin's Add forms start from; the owner can change any value before it is sent.
 * Numbers start from the launch values, so the registry sells what the site previewed.
 */
export const namespacePresets = {
  [KIND.NUMBER]: numbers,
  [KIND.NAME]: { name: '', minLength: 3, maxLength: 32, checkDigitFrom: 0, prices: [0.04, 0.01, 0.00125] },
}
