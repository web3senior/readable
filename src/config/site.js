export const site = {
  name: 'readable.name',
  wordmark: { lead: 'readable', tail: '.name' },
  // The home page hero, also the page title and the site's share card. Kept short: the docs
  // say the rest (`hero.more`). Names and numbers both: no extension named, since the owner
  // adds those onchain
  tagline: 'Get a readable name',
  subtitle: 'Give wallets and AI agents a username or a number instead of a 0x… address.',
  description: 'Look up and register onchain numbers for wallets and AI agents.',
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3005',
  keywords: ['readable names', 'onchain numbers', 'wallet numbers', 'wallet names', 'ai agents'],
  // Metadata can't read CSS variables, so the browser chrome colors mirror --color-bg
  themeColor: { light: '#ffffff', dark: '#0b0e13' },
  footer: 'Names for people and agents, onchain.',

  search: {
    // Until the namespaces are known; after that the placeholder names the kinds the registry holds
    placeholder: 'Search names',
    label: 'Search names',
    // The field's id, so a call to action elsewhere on the page can focus it
    inputId: 'search',
    allLabel: 'All',
    focusKey: '/',
    // The field takes the cursor on arrival where this matches: a mouse, not a touch screen
    autoFocusMedia: '(hover: hover) and (pointer: fine)',
    debounceMs: 350,
    historyLimit: 8,
    historyStorageKey: 'readable:history',
    // A shared link carries the search as this parameter (/?q=4242). Links from when it followed
    // # (/#4242) still open, and the address is rewritten
    queryParam: 'q',
    // Before the same label under the other namespaces
    also: 'Also',
    copyLink: 'Copy link',
    // Examples come from the namespaces themselves (kindDefaults in config/namespaces.js)
    // The six numbers and an extension's username
    exampleLimit: 7,
    // Someone else's name: its page, with its contact card
    open: 'View profile',
    // A word typed into the search is also the number it dials on a phone keypad
    keypad: 'Spells {word} on a phone keypad',
    // Free numbers next to a taken one, offered under it
    nearby: { label: 'Free nearby', limit: 4 },
  },

  // Buying without the chain's coin: the wallet signs and the relayer pays the network fee
  // The dollar value beside a price in ETH (config/chains.js names the feed). Read on the server
  // and kept for `cacheSeconds`; a feed answer older than `staleSeconds` is not shown
  usd: {
    path: '/api/price',
    cacheSeconds: 60,
    staleSeconds: 7200,
    label: '≈ {amount}',
    title: 'At the ETH price Chainlink reports now',
  },

  gasless: {
    // Under a holder's changes to a name, which the relayer or the paymaster sends
    note: 'No network fee. Your wallet asks you to sign, not to send a transaction.',
  },

  // The names a wallet holds, and what their holder can change
  names: {
    path: '/names',
    title: 'My names',
    intro: 'The numbers and names this wallet holds. Open one to point it at a wallet, make it your primary name or fill in its records.',
    find: 'Find a name',
    gates: {
      unconfigured: 'Your names appear here once Readable launches.',
      disconnected: 'Connect a wallet to see the names it holds.',
      unreachable: 'The registry could not be read.',
      empty: 'This wallet holds no names yet.',
    },
  },

  // A name's page as anyone sees it: its contact card, a way to pay it and a way to share it.
  // `{name}` is the name as the site writes it
  profile: {
    title: 'Contact',
    empty: 'No records yet.',
    expired: 'This name has expired, so it shows no records and reaches nobody.',
    proofNote: 'A check marks an account proven by a post signed with this name’s wallet. The others are its holder’s word.',
    // Shown to a visitor who isn't connected, under the summary
    manage: { question: 'Hold this name?', action: 'Connect its wallet' },
    // An account the holder lets change the name, such as the agent it stands for
    editor: {
      term: 'Editor',
      badge: 'Editor',
      self: 'This wallet',
      note: 'You edit this name for its holder: where it points, its records and its addresses. Only the holder can move it or name another editor.',
    },
    chains: 'Other chains',
    agent: 'AI agent',
    unregistered: '{name} isn’t registered.',
    register: 'Check it',
    // Apps that take a number. `{query}` is the name with its spaces taken out
    tunnel: { label: 'Add in Tunnel', url: 'https://www.tunnelapp.chat/chat?add={query}' },
    // An offer goes to the holder through the marketplace, never through this site
    offer: 'Make an offer',
    share: {
      title: 'Share',
      intro: 'A link to this page, a code to scan and a badge for a site. Shared links show the name in their preview.',
      copy: 'Copy link',
      qr: 'Scan to open {name}',
      badge: 'Badge',
      badgeNote: 'For a README or a web page. It links here.',
      copyBadge: 'Copy badge',
    },
  },

  // Sending the payment token to a name: to the wallet it points to at the moment of sending
  pay: {
    action: 'Pay',
    title: 'Pay',
    amount: 'Amount',
    to: 'To',
    note: 'Sent to the wallet {name} points to right now. A name can change hands, so it is looked up again before you sign.',
    nobody: '{name} points nowhere, so nothing can be sent to it.',
    pending: 'Sending {amount} to {name}',
    done: '{amount} sent to {name}',
    short: 'This wallet doesn’t hold enough {symbol}',
    // Suggested amounts, in ETH
    presets: [0.001, 0.005, 0.01],
  },

  // A calendar file with a reminder: before a name expires, or the day a watched one returns
  reminders: {
    renew: {
      action: 'Remind me to renew',
      // One event for each, this many days before the name expires
      daysBefore: [30, 7],
      title: 'Renew {name}',
      body: '{name} expires on {date}. Renew it here: {link}',
    },
    release: {
      action: 'Add to calendar',
      title: '{name} returns to the public',
      body: 'Unless its holder renews it, {name} can be registered again from {date}: {link}',
    },
    // What the event's time of day is when a calendar shows it: the morning, local time
    alarmHour: 9,
  },

  // Names someone keeps an eye on, kept in this browser only
  watch: {
    storageKey: 'readable:watching',
    limit: 50,
    add: 'Watch',
    remove: 'Watching',
    added: 'Watching {name}. It is listed on My names.',
    title: 'Watching',
    intro: 'Names you watch on this device. Each shows the day it returns to the public if its holder doesn’t renew it.',
    released: 'Returns {date}',
    available: 'Available now',
    unwatch: 'Stop watching',
  },

  // Proving a social account belongs to a name's holder: a post that carries the holder's signature
  verify: {
    path: '/api/verify',
    cacheSeconds: 300,
    verified: 'Verified',
    unverified: 'Not verified',
    action: 'Prove it',
    title: 'Prove {network}',
    steps: {
      sign: 'Sign a statement with the wallet that holds {name}. It costs nothing.',
      post: 'Post this from {handle}, as it is.',
      link: 'Paste the link to the post, then save the records.',
    },
    sign: 'Sign',
    // The statement a wallet signs; the post carries its signature
    message: 'readable.name\n{name} is held by the same person as the {network} account {handle}.\nToken {tokenId}',
    post: 'I am {name} on readable.name: {link}\nProof: {signature}',
    linkLabel: 'Link to the post',
  },

  // A LUKSO Universal Profile in a name's records: the holder enters its address, and the card
  // shows the name and picture the profile publishes, read from LUKSO
  universalProfile: {
    path: '/api/universal-profile',
    cacheSeconds: 300,
    // The picture asked for, in pixels: the smallest one at least this wide
    imageWidth: 96,
    // How long the server waits for the profile's document
    timeoutMs: 6000,
  },

  // The badge a site or README shows: an image that links to the name's page
  badge: {
    path: '/api/badge',
    label: 'Pay me at',
    cacheSeconds: 3600,
    // An image can't read CSS variables; these mirror the accent and its ink. The label is dark
    // and takes white ink
    height: 28,
    font: 'Verdana, DejaVu Sans, sans-serif',
    fontSize: 12,
    labelBackground: '#24292f',
    labelInk: '#ffffff',
    background: '#2aabee',
    ink: '#0f1419',
  },

  // A directory of the names whose records reach an AI agent
  agents: {
    path: '/agents',
    api: '/api/agents',
    title: 'Agents',
    intro: 'AI agents with a Readable name. Each one answers at the endpoint its records name and is paid at its wallet.',
    empty: 'No agent has a name yet. Fill in the AI agent records of yours and it appears here.',
    unreachable: 'The agents could not be read.',
    loading: 'Loading agents',
    endpoint: 'Endpoint',
    erc8004: 'Agent id',
    payment: 'Paid at',
    cacheSeconds: 120,
    refreshMs: 120_000,
  },

  // The MCP server this site serves, which lets any AI agent look names up and dial agents
  mcp: {
    path: '/api/mcp',
    name: 'readable',
    title: 'Readable',
    version: '0.1.0',
  },

  // The site as a mini app inside Hup, which runs it in a post and lends it the viewer's wallet
  // through its own SDK
  miniApp: {
    hup: { sdk: 'https://hup.social/miniapp-sdk.js', origins: ['https://hup.social', 'https://www.hup.social'] },
  },

  // Coins by card, for a buyer who holds none: Coinbase's onramp, on the chains it serves
  onramp: {
    path: '/api/onramp',
    action: 'Buy {symbol} with a card',
    note: 'Opens Coinbase in a new tab. The {symbol} arrives in this wallet.',
  },

  // The home page's "How it works": what one number answers with, then four scenes, a row each,
  // each one thing a number does, played on a phone. In the copy, `{number}` is `digits` and
  // `{agent}` is `agent.digits`, both written in the number namespace's own format; a number of
  // 8 digits or more ends in its check digit. The holder, the agent and their addresses are made up
  howItWorks: {
    title: 'How it works',
    body: 'A number is yours like any token. It carries your addresses and a contact card, and whoever has it, a friend, an app or an AI agent, reaches you by it.',
    digits: '88888888',
    // What the number answers with, drawn as a tree: the number, the kinds of thing it carries,
    // and the rows of one kind at a time. A row marked `address` is shortened, and one with no
    // `value` shows the holder's address. `label` is what a screen reader hears for the tree
    map: {
      label: '{number} answers with a wallet for Base and most EVM chains, Bitcoin and Solana addresses, a contact card, and an AI agent’s endpoint, id and payment address',
      kinds: [
        {
          id: 'wallet',
          label: 'Wallet',
          rows: [
            { label: 'Base', address: true },
            { label: 'Ethereum', address: true },
            { label: 'Arbitrum', address: true },
            { label: 'LUKSO', address: true },
            { label: 'Most EVM chains', address: true },
          ],
        },
        {
          id: 'chains',
          label: 'Other chains',
          rows: [
            { label: 'Bitcoin', value: 'bc1qn4c8yd5mfx3hz0u7a2kwm6j9ve4ztr8p3wl6cy', address: true },
            { label: 'Solana', value: '7GqXr2bMd9TnVkPz4sLw8hYcJ3eFuA6oRiN5tE1xKf9k', address: true },
          ],
        },
        {
          id: 'card',
          label: 'Contact card',
          rows: [
            { label: 'Display name', value: 'Alice' },
            { label: 'Email', value: 'alice@example.com' },
            { label: 'X', value: '@alice' },
            { label: 'GitHub', value: 'alice' },
            { label: 'Website', value: 'alice.example' },
          ],
        },
        {
          id: 'agent',
          label: 'AI agent',
          rows: [
            { label: 'Endpoint', value: 'alice.example/mcp' },
            { label: 'Agent id', value: 'ERC-8004 #1088' },
            { label: 'Payment address', value: '0x7A3c9E21b4D05f8e6C1a92B3d4E5F60718293aB4', address: true },
          ],
        },
      ],
    },
    // `badge` is shown after the holder's name wherever it appears, as a profile's mark is
    holder: {
      name: 'Alice',
      address: '0x1E7FfD3905063b9195fc0090E7c04dD5A9B25604',
      badge: { src: '/up.png', label: 'Universal Profile' },
    },
    agent: { digits: '247', name: 'Iris', role: 'AI agent', endpoint: 'iris.example/mcp', erc8004: '412' },
    // `tab` names the scene above its `title` and `body`, which sit beside the phone. `label` is
    // what a screen reader hears for the scene. `stage` marks a scene that isn't live yet, by
    // its key in docs.stages
    steps: [
      {
        id: 'profile',
        tab: 'Profile',
        title: 'One number, every address',
        body: '{number} keeps your wallet for Base and most EVM chains, your Bitcoin and Solana addresses and a contact card. Change any of them and the number stays the same.',
        label: 'The profile of {number}: one wallet for most EVM chains, a Bitcoin address, a Solana address, an email and an X handle',
        // The EVM row shows the holder's address. `logo` is the row's mark in public, drawn in
        // its own colors
        rows: [
          { id: 'evm', label: 'Base and most EVM chains', logo: '/wallet.svg' },
          { id: 'btc', label: 'Bitcoin', logo: '/bitcoin.svg', value: 'bc1qn4c8yd5mfx3hz0u7a2kwm6j9ve4ztr8p3wl6cy' },
          { id: 'sol', label: 'Solana', logo: '/solana.svg', value: '7GqXr2bMd9TnVkPz4sLw8hYcJ3eFuA6oRiN5tE1xKf9k' },
          { id: 'email', label: 'Email', logo: '/email.svg', value: 'alice@example.com' },
          { id: 'x', label: 'X', logo: '/x.svg', value: '@alice' },
        ],
      },
      {
        id: 'send',
        tab: 'Pay',
        title: 'Pay a number',
        body: 'Anyone can send to {number} instead of a 0x… address. The app finds the wallet behind it, and a mistyped digit fails instead of paying a stranger.',
        label: 'A wallet sends {amount} to {number} and finds it is Alice’s wallet',
        screen: { title: 'Send', amount: 25, currency: 'USDC', to: 'To', placeholder: 'Number or address', action: 'Send', done: 'Sent' },
      },
      {
        id: 'contact',
        tab: 'Chat',
        title: 'Add a contact by number',
        body: 'In a chat app, friends add {number} where they would paste an address. The contact keeps your wallet and your key, and they are warned if the number ever changes hands.',
        label: 'A chat app adds {number} as a contact, Alice, and pins the wallet and key behind it',
        screen: {
          title: 'New contact',
          field: 'Number',
          wallet: 'Wallet',
          key: 'Key',
          keyValue: '0x9f3ac1e47b2d8e05c6a91f3d7e4b20c8a5d6c21e',
          action: 'Add contact',
          done: 'Added',
          pinned: 'Number, wallet and key pinned. You’ll be warned if they change.',
        },
      },
      {
        id: 'agent',
        tab: 'Agents',
        title: 'Dial an agent',
        body: 'An AI agent has a number too. Dial {agent} and its records say where it answers and where it gets paid.',
        label: 'A dialer calls {agent} and reaches Iris, an AI agent, at the endpoint its records name',
        stage: 'planned',
        screen: {
          calling: 'Calling…',
          connected: 'Connected',
          endpoint: 'Endpoint',
          erc8004: 'Agent id',
          greeting: 'Hi, this is Iris. What can I book for you today?',
        },
      },
    ],
  },

  // The public API, built on packages/sdk: /api/resolve/<name> and /api/reverse/<address>.
  // Answers are kept this long by browsers and caches, then served stale while they refresh
  api: {
    resolvePath: '/api/resolve',
    reversePath: '/api/reverse',
    cacheSeconds: 30,
    staleSeconds: 300,
  },

  // Where a name works outside this site: listed on /docs, and named in the register dialog,
  // which tells a buyer plainly that few apps read Readable yet. `stage` is a key of
  // docs.stages: 'next' is built and waits for its launch, 'planned' is not built. Drop it once
  // the app reads names, and say so in `early.today`. In `about`, `{number}` is
  // docs.examples.number in the number namespace's own format, and `{ens}` that number under ENS
  integrations: {
    // The docs section that lists them, an id of config/docs.js
    section: 'wallets',
    // Tunnel and Hup read names from the launch on (the user's word, 2026-10-04)
    items: [
      {
        name: 'Tunnel',
        about: 'New chat takes {number} where it takes an address. The contact keeps the number and the wallet it reached, and warns if they part.',
      },
      { name: 'Hup', about: 'A profile shows the number its wallet chose as its primary name.' },
      { name: 'Mini apps', about: 'The site runs inside Hup with the wallet the app already has.' },
      {
        name: 'ENS',
        stage: 'next',
        about: 'Through a gateway on this site, a wallet that reads ENS resolves {ens} to the wallet {number} points to, and its text records to the name’s records.',
      },
      { name: 'MetaMask', stage: 'next', about: 'The Readable Snap resolves {number} typed into MetaMask’s send field, and shows the name of a wallet that chose one.' },
      { name: 'PayPost', stage: 'planned', about: 'Send an invoice to {number}, and pay one.' },
    ],
    // The register dialog's word to a buyer, linked to the list on /docs. `{apps}` is the
    // items at 'next'
    early: {
      lead: 'Readable is new.',
      today: 'Few apps read its names yet: today a name works on this site, in Tunnel and Hup, in mini apps and in any app that uses the open API.',
      next: '{apps} are next, and more will follow.',
      more: 'Where names work',
    },
  },

  // The docs: one page, its sections listed in config/docs.js
  docs: {
    path: '/docs',
    title: 'Docs',
    description: 'How Readable works: getting, managing and paying a number or a username, and resolving one from an app, a contract or an AI agent.',
    navLabel: 'Documentation',
    copyCode: 'Copy code',
    // Digits the page shows in the number namespace's own format; `long` ends in its check digit.
    // `namespaceId` is the id the printed code gives the numbers: the first namespace added
    examples: { short: '42', number: '4242', long: '42421230', namespaceId: 1 },
    // How far along the registry is, shown in the introduction and the roadmap
    stages: { preview: 'Preview', testnet: 'Testnet', live: 'Live', next: 'Next', planned: 'Planned' },
    // The page is sent as written. What the registry decides is read by the browser afterwards
    // and kept for `staleMs`
    loading: 'Reading the registry',
    staleMs: 300_000,
  },

  // What wallets and marketplaces show for a name. The registry's base URI points at `path`
  nft: {
    path: '/nft',
    // {name} is the name as the site writes it
    description: '{name} is a readable name on readable.name.',
    kinds: { name: 'Name', number: 'Number' },
    traits: { kind: 'Kind', length: 'Length', registered: 'Registered', expires: 'Expires' },
    cacheSeconds: 300,
    // An image can't read CSS variables, so its colors mirror the accent and its ink here
    art: {
      size: 500,
      radius: 56,
      background: '#2aabee',
      ink: '#0f1419',
      font: 'system-ui, sans-serif',
      weight: 700,
      brandSize: 22,
      brandOpacity: 0.7,
      // The name shrinks as it grows: up to `length` characters at `size`
      steps: [
        { length: 12, size: 56 },
        { length: 24, size: 40 },
        { length: Infinity, size: 28 },
      ],
    },
  },

  // The home page hero. `line` follows the subtitle there alone (the share card keeps the plain
  // subtitle): `{chain}` is a badge of the chain the registry lives on, its logo in its own
  // colors, and `{claim}` is set in bold. `more` closes it with a link to the docs; the rest
  // is WalletDemo's, off the page: a wallet's address turns into its number, one holder after another
  hero: {
    line: 'Owned onchain on {chain}, and {claim}.',
    chain: { name: 'Robinhood Chain', logo: '/robinhood.svg' },
    claim: 'updates are gasless',
    more: 'More info',
    label: 'A wallet address turns into a Readable number',
    // Addresses made up for the page. Digits are shown in the number namespace's own format;
    // a number of 8 digits or more has to end in its check digit
    holders: [
      { address: '0xf5E540Bb1d20d8A0dd64b40a9F4D73A2278a4315', digits: '4242' },
      { address: '0x75d09B94cE0F58e471461c89224Aa6FAb61CE783', digits: '42' },
      { address: '0x1E7FfD3905063b9195fc0090E7c04dD5A9B25604', digits: '42421230' },
    ],
  },

  // The home page table of what happened to names lately, served by `path`. It has no heading:
  // `label` is what a screen reader calls it
  activity: {
    label: 'Latest activity',
    path: '/api/activity',
    limit: 8,
    columns: { name: 'Name', kind: 'Activity', wallet: 'Wallet', paid: 'Paid', at: 'When' },
    // One per kind. The wallet is the new holder of a name bought, granted or transferred, and
    // otherwise the one who made the change
    kinds: {
      bought: 'Bought',
      granted: 'Granted',
      renewed: 'Renewed',
      transferred: 'Transferred',
      target: 'Repointed',
      records: 'Records updated',
      addresses: 'Other chains set',
      primary: 'Made primary',
      editor: 'Editor named',
      editorRemoved: 'Editor removed',
    },
    // Under the table, the visitor's to fill
    next: {
      title: 'The next one could be yours',
      note: 'Short numbers are rare. Find yours before someone else does.',
      action: 'Find your number',
    },
    // How long the server keeps one reading, and how often an open page asks for the next
    cacheSeconds: 30,
    refreshMs: 60_000,
    loading: 'Loading the latest activity',
  },

  // The registry's events (the latest activity, the reservations) come from the chain's explorer.
  // The newest blocks are read from the chain itself, since the explorer's index trails it
  events: {
    recentBlocks: 1000,
  },

  // The home page row of partners: logos alone, with no heading and no names. A logo is a file
  // in public/partners, and `logo` is its path from there on (public/partners/hup.svg is
  // '/partners/hup.svg'). It shows in grays, whatever its colors. `ink: true` is for a logo drawn in one
  // color with nothing behind it: it is painted in the text's ink, so it follows the theme.
  // `wordmark: true` is for a wide logo that spells the name; `name` and `label` are what a
  // screen reader says. Without a `url` the partner is shown, not linked
  partners: {
    label: 'Partners and networks',
    items: [
      { name: 'Hup', logo: '/partners/hup.svg', url: 'https://hup.social', ink: true },
      { name: 'Tunnel', logo: '/partners/tunnel.svg' },
      // The networks, the registry's home first
      { name: 'Base', logo: '/partners/networks/base.svg', url: 'https://www.base.org' },
      { name: 'Ethereum', logo: '/partners/networks/ethereum.svg', url: 'https://ethereum.org' },
      { name: 'Arbitrum', logo: '/partners/networks/arbitrum.svg', url: 'https://arbitrum.io' },
      { name: 'Optimism', logo: '/partners/networks/optimism.svg', url: 'https://www.optimism.io' },
      { name: 'Arc', logo: '/partners/networks/arc.svg', url: 'https://www.arc.network' },
      { name: 'LUKSO', logo: '/partners/networks/lukso.svg', url: 'https://lukso.network' },
      { name: 'BNB Chain', logo: '/partners/networks/bnb.svg', url: 'https://www.bnbchain.org' },
      { name: 'Celo', logo: '/partners/networks/celo.svg', url: 'https://celo.org' },
      { name: 'Monad', logo: '/partners/networks/monad.svg', url: 'https://www.monad.xyz' },
      { name: 'Unichain', logo: '/partners/networks/unichain.svg', url: 'https://www.unichain.org' },
    ],
  },

  // The home page story: a chat in a phone-number messenger that moves to Tunnel
  story: {
    eyebrow: 'Onchain numbers',
    title: 'Share a number, not your identity.',
    body: 'A phone number drags a SIM, a name and a country behind it. A Readable number points at your wallet and nothing else, so you can hand it to anyone.',
    cta: 'Find your number',
    note: 'Tunnel is end-to-end encrypted chat, and it adds a contact by number.',
    chat: {
      label: 'A chat that moves to Tunnel with a Readable number',
      contact: 'Alice',
      me: 'You',
      status: { idle: 'online', typing: 'typing…' },
      day: 'Today',
      // Shown in the number namespace's own format, so the prefix is never written here
      digits: '4242',
      // `from` is 'me' or 'them'; `number: true` stands for the formatted number
      messages: [
        { from: 'me', text: 'Not here. This app knows my phone number, my contacts and who I talk to.' },
        { from: 'me', text: 'Let’s talk on Tunnel.' },
        { from: 'them', text: 'Deal. What’s your number?' },
        { from: 'me', number: true },
        { from: 'them', text: 'That’s not a phone number 🤨' },
        { from: 'me', text: 'Exactly. No SIM, no ID, no country. It’s mine, onchain.' },
        { from: 'them', text: 'OK, I want one.' },
      ],
      moved: 'This conversation moved to Tunnel',
    },
  },

  // Served by src/app/icon.svg; wallets show it on their approval screen
  iconPath: '/icon.svg',

  wallet: {
    helpUrl: 'https://ethereum.org/wallets/find-wallet',
    connect: 'Connect wallet',
    title: 'Connect a wallet',
    close: 'Close',
    genericName: 'Browser wallet',
    detected: 'Detected',
    connecting: 'Connecting',
    // Followed by the connector's name
    opening: 'Opening',
    // Keyed by connector type; a type without an entry shows its name alone
    hints: { walletConnect: 'Any phone wallet, by link or QR code' },
    empty: 'No wallet found on this device.',
    footnote: 'New to wallets?',
    findWallet: 'Find a wallet',
    account: 'Account',
    copyAddress: 'Copy address',
    connectedWith: 'Connected with',
    unknownConnector: 'a wallet',
    disconnect: 'Disconnect',
    errors: {
      rejected: 'Connection request was rejected',
      failed: 'Could not connect the wallet',
    },
  },

  admin: {
    title: 'Admin',
    heading: 'Registry admin',
    intro: 'Namespaces, prices, reservations and registry settings. Every change is a transaction from the owner wallet.',
    kinds: { name: 'Extension', number: 'Numbers' },
    // The labels a namespace holds reserved, listed on its card, shortest first. The first
    // `shown` are listed and the rest folded behind `more`
    reserved: {
      label: 'Reserved',
      none: 'None',
      unreadable: 'Could not be read',
      loading: 'Loading reservations',
      shown: 12,
      more: '{count} more',
      less: 'Show fewer',
    },
    // What a fresh registry needs before it can sell, shown on the admin page until it is done
    setup: {
      title: 'Finish setting up',
      done: 'Done',
      steps: {
        numbers: { label: 'Numbers', note: 'The launch lineup: numbers from two digits, at the launch prices.', action: 'Add numbers' },
        link: { label: 'NFT data link', note: 'Where wallets read each name’s title and image.', action: 'Set link' },
      },
    },
    gates: {
      unconfigured: 'No registry is configured. Set NEXT_PUBLIC_READABLE_ADDRESS to the deployed contract to manage it here.',
      unreachable: 'The registry could not be read.',
      disconnected: 'Connect the owner wallet to make changes.',
      notOwner: 'This wallet is not the registry owner. You can look, but every action needs the owner wallet.',
    },
  },
}
