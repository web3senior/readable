/**
 * The docs' table of contents, read by the sidebar and by the page. Every `id` is the id of a
 * section on the page: the sidebar watches those elements to know which one is being read.
 */
export const docGroups = [
  {
    label: 'Getting started',
    items: [
      { id: 'introduction', label: 'Introduction' },
      { id: 'how-it-works', label: 'How it works' },
      { id: 'numbers', label: 'Numbers' },
      { id: 'usernames', label: 'Usernames' },
    ],
  },
  {
    label: 'Using a name',
    items: [
      { id: 'get-a-name', label: 'Get a name' },
      { id: 'prices', label: 'Prices' },
      { id: 'manage', label: 'Manage a name' },
      { id: 'pay', label: 'Pay a name' },
      { id: 'share', label: 'Share and prove' },
      { id: 'renewal', label: 'Renewal and expiry' },
      { id: 'transfers', label: 'Transfers' },
    ],
  },
  {
    label: 'Resolving',
    items: [
      { id: 'registry', label: 'The registry' },
      { id: 'sdk', label: 'SDK and API' },
      { id: 'agents', label: 'For AI agents' },
      { id: 'wallets', label: 'In wallets and apps' },
      { id: 'resolve', label: 'Resolve a name' },
      { id: 'from-a-contract', label: 'From a contract' },
      { id: 'reverse', label: 'From a wallet to its name' },
      { id: 'records', label: 'Records' },
      { id: 'other-chains', label: 'Other chains' },
      { id: 'token-ids', label: 'Token ids and NFT data' },
      { id: 'check-digit', label: 'The check digit' },
      { id: 'events', label: 'Events' },
      { id: 'in-your-app', label: 'In your app' },
    ],
  },
  {
    label: 'Trust',
    items: [
      { id: 'owner', label: 'What the owner can do' },
      { id: 'roadmap', label: 'Roadmap' },
    ],
  },
]

/** Every section id in the order the page shows them, which is how the sidebar breaks a tie. */
export const docSectionIds = docGroups.flatMap((group) => group.items.map((item) => item.id))
