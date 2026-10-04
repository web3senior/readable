import { ipfs } from '@/config/ipfs'

/**
 * A name's public records, laid out like a phone's contact card: one JSON document stored under
 * one text key of the registry, so a holder saves everything in a single transaction and an app
 * reads it in a single call.
 *
 *   {
 *     "v": 1,
 *     "avatar": "ipfs://…",
 *     "name": "Alice",
 *     "job": "Designer",
 *     "about": "Making things readable",
 *     "email": "alice@example.com",
 *     "url": "https://alice.example",
 *     "location": "Lisbon",
 *     "birthday": "1990-05-14",
 *     "social": { "x": "alice", "telegram": "alice", "github": "alice", "hup": "alice", "up": "0x…" },
 *     "agent": { "endpoint": "https://alice.example/mcp", "erc8004": "412", "payment": "0x…" }
 *   }
 *
 * Where the name points is not a record: it is the registry's `target`, which resets to the new
 * holder on a transfer. Every field is optional, and keys this list doesn't know are kept as they
 * are, so another app can store its own beside them. A new field is a line here: the registry
 * stores the document as text and never reads it. One value per field, so other apps read a
 * field without choosing between several.
 */

// `name` is the path inside the document; a dot steps into an object. A `handle` is stored
// without its site, and `profile` is the link it is read at
const groups = [
  {
    id: 'profile',
    fields: [
      { name: 'avatar', label: 'Photo', type: 'url', placeholder: 'Photo link, https:// or ipfs://', hint: 'A link to an image, or one uploaded here and pinned on IPFS.' },
      { name: 'name', label: 'Display name', type: 'text', maxLength: 64 },
      { name: 'job', label: 'Job title', type: 'text', maxLength: 64 },
      { name: 'about', label: 'About', type: 'textarea', maxLength: 280, rows: 3 },
    ],
  },
  {
    id: 'contact',
    label: 'Contact',
    fields: [
      { name: 'email', label: 'Email', type: 'email', maxLength: 254 },
      { name: 'url', label: 'Website', type: 'url', placeholder: 'Website, https://' },
      { name: 'location', label: 'Location', type: 'text', maxLength: 64, hint: 'A city or a country, never a street address.' },
      { name: 'birthday', label: 'Birthday', type: 'date' },
    ],
  },
  {
    id: 'social',
    label: 'Social',
    fields: [
      { name: 'social.x', label: 'X', type: 'handle', profile: 'https://x.com/', aliases: ['twitter.com/'], maxLength: 15, pattern: /^[A-Za-z0-9_]{1,15}$/ },
      { name: 'social.telegram', label: 'Telegram', type: 'handle', profile: 'https://t.me/', maxLength: 32, pattern: /^[A-Za-z][A-Za-z0-9_]{4,31}$/ },
      { name: 'social.github', label: 'GitHub', type: 'handle', profile: 'https://github.com/', maxLength: 39, pattern: /^[A-Za-z0-9](?:-?[A-Za-z0-9]){0,38}$/ },
      // Hup's own rule: a lowercase letter first, 3 to 20 in all, no underscore doubled or last
      {
        name: 'social.hup',
        label: 'Hup',
        type: 'handle',
        profile: 'https://www.hup.social/@',
        aliases: ['hup.social/'],
        lowercase: true,
        maxLength: 20,
        pattern: /^[a-z](?:[a-z0-9]|_(?!_|$)){2,19}$/,
      },
      // A LUKSO Universal Profile, by its address. The card shows the name and picture the
      // profile publishes, and links to it at `profile`
      {
        name: 'social.up',
        label: 'Universal Profile',
        type: 'up',
        profile: 'https://universaleverything.io/',
        placeholder: 'Universal Profile address',
      },
    ],
  },
  {
    id: 'agent',
    label: 'AI agent',
    hint: 'For a name that reaches an AI agent.',
    fields: [
      { name: 'agent.endpoint', label: 'Agent endpoint', type: 'url', placeholder: 'Agent endpoint, https://', hint: 'Where the agent answers.' },
      { name: 'agent.erc8004', label: 'Agent id (ERC-8004)', type: 'text', maxLength: 78 },
      { name: 'agent.payment', label: 'Agent payment address', type: 'address' },
    ],
  },
]

export const records = {
  key: 'records',
  version: 1,
  // The document lives onchain, so its size is what the holder pays for
  maxBytes: 2048,
  groups,
  fields: groups.flatMap((group) => group.fields),
  // Accounts a holder can prove are theirs: a post from the account that carries a signature by
  // the wallet holding the name. The post's link is stored under `proofs.<id>`, and the site
  // checks it whenever the name is shown. `compose` opens a new post; `{text}` is what it says
  proofs: [
    {
      id: 'x',
      field: 'social.x',
      label: 'X',
      compose: 'https://x.com/intent/post?text={text}',
      link: /^https:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d+)/i,
      placeholder: 'https://x.com/…/status/…',
    },
    {
      id: 'github',
      field: 'social.github',
      label: 'GitHub',
      compose: 'https://gist.github.com/',
      link: /^https:\/\/gist\.github\.com\/(?:[A-Za-z0-9-]+\/)?([0-9a-f]{20,})/i,
      placeholder: 'https://gist.github.com/…',
    },
  ],
  links: /^(https|ipfs|ar):\/\/\S+$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  // Where a photo stored as ipfs:// or ar:// is shown from
  gateways: { ipfs: ipfs.gateway, ar: 'https://arweave.net/' },
}
