/**
 * The gateway that lets every wallet that reads ENS resolve a Readable name: `4242.readable.eth`
 * for `+0 4242`, `alice.arc.readable.eth` for `alice.arc`. ENS asks a resolver contract on
 * Ethereum, which sends the question here (EIP-3668, CCIP-Read); the answer is read from the
 * registry on its own chain and signed with the gateway's key, which the contract trusts.
 * Server-only values (the key) are read where they are used.
 */
export const ens = {
  path: '/api/ens',
  // The ENS name the registry's names live under
  parent: process.env.ENS_PARENT_NAME || 'readable.eth',
  // The resolver contract on Ethereum that sends its questions here. Others are refused
  resolver: process.env.ENS_RESOLVER_ADDRESS || null,
  // How long a signed answer stays valid; a name can change hands, so not long
  ttlSeconds: 300,
  // ENS text keys (ENSIP-5 and the usual service keys), and the record each one reads
  texts: {
    avatar: 'avatar',
    description: 'about',
    display: 'name',
    name: 'name',
    email: 'email',
    url: 'url',
    location: 'location',
    'com.twitter': 'social.x',
    'com.x': 'social.x',
    'com.github': 'social.github',
    'org.telegram': 'social.telegram',
    'social.hup': 'social.hup',
    'agent.endpoint': 'agent.endpoint',
    'agent.erc8004': 'agent.erc8004',
  },
}
