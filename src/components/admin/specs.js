import { formatUnits, isAddress, parseUnits, zeroAddress } from 'viem'
import { KIND, KIND_BY_INDEX, OFFERED_KINDS, namespacePresets } from '@/config/namespaces'
import { registry } from '@/config/registry'
import { site } from '@/config/site'
import { FormError } from '@/lib/adminActions'
import { displayName as fullName } from '@/lib/namespaces'
import { parseNumber } from '@/lib/query/numbers'
import { normalizeText } from '@/lib/query/text'

/**
 * Builders for the ActionDialog: each returns a spec whose `submit` validates what was typed,
 * then hands one owner call to `perform({ functionName, args, pending, done })`.
 */

export const DAY = 86_400

const address = (value, { allowEmpty = false } = {}) => {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) {
    if (allowEmpty) return zeroAddress
    throw new FormError('An address is required')
  }
  if (!isAddress(trimmed)) throw new FormError('That is not a valid address')
  return trimmed
}

const integer = (value, label, { min = 0, max = 255 } = {}) => {
  const number = Number(value)
  if (!Number.isInteger(number) || number < min || number > max) throw new FormError(`${label} must be a whole number from ${min} to ${max}`)
  return number
}

const parsePrices = (value, currency) => {
  const parts = String(value ?? '')
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (!parts.length) throw new FormError('Enter at least one price')
  const prices = parts.map((part) => {
    try {
      return parseUnits(part, currency.decimals)
    } catch {
      throw new FormError(`"${part}" is not a price`)
    }
  })
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > prices[i - 1]) throw new FormError('Prices must not rise with length')
  }
  return prices
}

const formatPrices = (prices, currency) => prices.map((price) => formatUnits(price, currency.decimals)).join(', ')

const parseMetadata = (value) => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  try {
    return JSON.stringify(JSON.parse(text))
  } catch {
    throw new FormError('Metadata must be valid JSON, or empty')
  }
}

const prettyMetadata = (value) => {
  if (!value) return ''
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

// Labels go out NFC-normalized; the contract lowercases ASCII only, so names are lowercased here
const cleanLabel = (value, kind) => {
  const text = normalizeText(value)
  if (!text) throw new FormError('A label is required')
  return kind === KIND.NAME ? text.toLowerCase() : text
}

// A number is stored as bare digits, so `111 111` and `+0 111 111` must both become `111111`
const labelIn = (value, namespace) => {
  const label = cleanLabel(value, namespace.kind)
  if (namespace.kind !== KIND.NUMBER) return label
  const parsed = parseNumber(label, namespace)
  if (!parsed) throw new FormError(`"${label}" is not a number`)
  return parsed.digits
}

const SHARE_TOTAL = 100

const rules = (values) => {
  const minLength = integer(values.minLength, 'Shortest label', { min: 1 })
  const maxLength = integer(values.maxLength, 'Longest label', { min: 1 })
  if (minLength > maxLength) throw new FormError('The shortest label cannot be longer than the longest')
  const managerShare = integer(values.managerShare, 'Manager share', { max: SHARE_TOTAL })
  return {
    minLength,
    maxLength,
    checkDigitFrom: integer(values.checkDigitFrom, 'Check digit from'),
    manager: address(values.manager, { allowEmpty: true }),
    managerShare,
    metadata: parseMetadata(values.metadata),
  }
}

const RULE_FIELDS = [
  {
    name: 'minLength',
    label: 'Shortest label',
    type: 'number',
    min: 1,
    max: 255,
    hint: 'What is sold, never what a name costs: prices count from the shortest length the namespace started with.',
  },
  { name: 'maxLength', label: 'Longest label', type: 'number', min: 1, max: 255 },
  {
    name: 'checkDigitFrom',
    label: 'Check digit from',
    type: 'number',
    min: 0,
    max: 255,
    hint: 'Numbers only: the length from which the last digit is a Luhn check digit. 0 turns it off.',
  },
  { name: 'manager', label: 'Manager', type: 'address', placeholder: 'None', hint: 'Receives a share of every payment in this namespace.' },
  { name: 'managerShare', label: 'Manager share (%)', type: 'number', min: 0, max: 100 },
  {
    name: 'metadata',
    label: 'Metadata (JSON)',
    type: 'textarea',
    rows: 6,
    hint: 'Optional display copy: label, title and about { title, body[] }. {name} stands for the namespace name.',
  },
]

const priceField = (currency) => ({
  name: 'prices',
  label: `Yearly prices (${currency.symbol})`,
  type: 'text',
  mono: true,
  placeholder: '0.08, 0.02, 0.005',
  hint: 'First entry at the shortest length the namespace started with, one more per extra character, the last for everything longer. 0 makes those lengths free. Renewals pay them too.',
})

const displayName = (kind, name) => (kind === KIND.NAME ? `.${name}` : kind === KIND.NUMBER ? `+${name}` : name)

// --- REGISTRY ---

export const registryPauseSpec = ({ data, perform }) => {
  const copy = site.admin.contractPause[data.paused ? 'resume' : 'pause']
  return {
    title: copy.title,
    description: copy.description,
    fields: [],
    submitLabel: copy.label,
    tone: data.paused ? undefined : 'danger',
    submit: () =>
      perform({
        functionName: data.paused ? 'unpause' : 'pause',
        args: [],
        pending: copy.pending,
        done: copy.done,
      }),
  }
}

export const gracePeriodSpec = ({ data, perform }) => ({
  title: 'Grace period',
  description: `How long after expiry only the holder can still renew, before the name returns to the public. Between ${registry.gracePeriod.min} and ${registry.gracePeriod.max} days, so a holder always has time.`,
  fields: [{ name: 'days', label: 'Days', type: 'number', min: registry.gracePeriod.min, max: registry.gracePeriod.max }],
  initial: { days: String(Math.round(data.gracePeriod / DAY)) },
  submitLabel: 'Save',
  submit: (values) =>
    perform({
      functionName: 'setGracePeriod',
      args: [BigInt(integer(values.days, 'Days', registry.gracePeriod) * DAY)],
      pending: 'Updating the grace period',
      done: 'Grace period updated',
    }),
})

export const forwarderSpec = ({ data, perform }) => ({
  title: 'Trusted forwarder',
  description:
    'The ERC-2771 forwarder that relays a holder’s changes to a name (where it points, primary name, records, other chains) so they cost no fee. It can’t move a name or act as the owner, but a forwarder that lies about who signed could change any live name, so trust only one you control. It can be replaced, not removed.',
  fields: [{ name: 'forwarder', label: 'Forwarder address', type: 'address' }],
  initial: { forwarder: data.forwarder === zeroAddress ? '' : data.forwarder },
  submitLabel: 'Save',
  submit: (values) =>
    perform({
      functionName: 'setTrustedForwarder',
      args: [address(values.forwarder)],
      pending: 'Changing the forwarder',
      done: 'Forwarder changed',
    }),
})

export const nameRulesSpec = ({ data, perform }) => ({
  title: 'Name rules',
  description:
    'The contract that decides what a name under an extension may be made of. New rules bind new names only: a name already held keeps its label and its price. Empty stops new names; numbers are not affected.',
  fields: [{ name: 'rules', label: 'Rules address', type: 'address' }],
  initial: { rules: data.nameRules?.address ?? '' },
  submitLabel: 'Save',
  submit: (values) =>
    perform({
      functionName: 'setNameRules',
      args: [address(values.rules, { allowEmpty: true })],
      pending: 'Changing the name rules',
      done: 'Name rules changed',
    }),
})

export const treasurySpec = ({ data, perform }) => ({
  title: 'Treasury',
  description:
    'Where the registry’s share of each payment is sent as it is paid. Empty keeps it in the registry for Withdraw. Purchases fail while the treasury can’t receive, so use an address that can.',
  fields: [{ name: 'treasury', label: 'Treasury address', type: 'address', placeholder: 'None' }],
  initial: { treasury: data.treasury ?? '' },
  submitLabel: 'Save',
  submit: (values) =>
    perform({
      functionName: 'setTreasury',
      args: [address(values.treasury, { allowEmpty: true })],
      pending: 'Changing the treasury',
      done: 'Treasury changed',
    }),
})

export const SITE_BASE_URI = `${site.baseUrl}${site.nft.path}/`

export const baseURISpec = ({ data, perform }) => ({
  title: 'NFT data link',
  description:
    'Wallets and marketplaces read each name’s title and image from this link followed by the token id. It can point at this site or at an IPFS folder, and can change at any time. Empty leaves the NFTs without a title or image.',
  fields: [
    {
      name: 'baseURI',
      label: 'Link prefix',
      type: 'text',
      mono: true,
      placeholder: SITE_BASE_URI,
      hint: `This site serves the data at ${SITE_BASE_URI}. An IPFS folder looks like ipfs://<CID>/. End it with a slash.`,
    },
  ],
  initial: { baseURI: data.baseURI || SITE_BASE_URI },
  submitLabel: 'Save',
  submit: (values) => {
    const baseURI = String(values.baseURI ?? '').trim()
    if (baseURI && !/^(https|ipfs|ar):\/\/\S+\/$/.test(baseURI)) {
      throw new FormError('Use an https://, ipfs:// or ar:// link that ends with a slash')
    }
    return perform({ functionName: 'setBaseURI', args: [baseURI], pending: 'Changing the NFT data link', done: 'NFT data link changed' })
  },
})

export const withdrawSpec = ({ data, perform, account }) => ({
  title: 'Withdraw',
  fields: [
    { name: 'to', label: 'Recipient', type: 'address' },
    { name: 'amount', label: `Amount (${data.currency.symbol})`, type: 'text', mono: true },
  ],
  initial: { to: account ?? '', amount: formatUnits(data.balance, data.currency.decimals) },
  submitLabel: 'Withdraw',
  submit: (values) => {
    let amount
    try {
      amount = parseUnits(String(values.amount ?? '').trim(), data.currency.decimals)
    } catch {
      throw new FormError('That is not an amount')
    }
    if (amount <= 0n) throw new FormError('The amount must be above zero')
    if (amount > data.balance) throw new FormError('That is more than the balance')
    return perform({ functionName: 'withdraw', args: [address(values.to), amount], pending: 'Withdrawing', done: 'Withdrawn' })
  },
})

export const transferOwnershipSpec = ({ data, perform }) => ({
  title: 'Transfer ownership',
  description:
    'Nothing moves until the new owner accepts from its own wallet, on this page. Until then this wallet keeps every action and can name someone else, or nobody, instead.',
  tone: 'danger',
  fields: [{ name: 'to', label: 'New owner', type: 'address', placeholder: 'None' }],
  initial: { to: data.pendingOwner ?? '' },
  submitLabel: 'Offer ownership',
  submit: (values) =>
    perform({
      functionName: 'transferOwnership',
      args: [address(values.to, { allowEmpty: true })],
      pending: 'Offering ownership',
      done: 'Ownership offered. It moves once the new owner accepts',
    }),
})

/** For the wallet that was offered ownership: the second of the two steps. */
export const acceptOwnershipSpec = ({ perform }) => ({
  title: 'Accept ownership',
  description: 'This wallet takes over every action on this page. The owner that offered it loses them.',
  tone: 'danger',
  fields: [],
  initial: {},
  submitLabel: 'Accept ownership',
  submit: () => perform({ functionName: 'acceptOwnership', args: [], pending: 'Accepting ownership', done: 'Ownership accepted' }),
})

// --- NAMESPACES ---

/** Starts from the preset of `kind`; every value can be changed before it is sent. */
export const addNamespaceSpec = ({ currency, nameRules, perform, kind = KIND.NAME }) => ({
  title: 'Add a namespace',
  description: 'Kind and name are fixed forever: every token id and displayed name derives from them.',
  fields: [
    { name: 'kind', label: 'Kind', type: 'select', options: OFFERED_KINDS.map((kind) => ({ value: kind, label: site.admin.kinds[kind] })) },
    {
      name: 'name',
      label: 'Name',
      type: 'text',
      placeholder: 'arc',
      hint: 'An extension is a lowercase word. Numbers take a digit prefix.',
    },
    ...RULE_FIELDS,
    priceField(currency),
  ],
  initial: {
    kind,
    name: namespacePresets[kind].name,
    minLength: String(namespacePresets[kind].minLength),
    maxLength: String(namespacePresets[kind].maxLength),
    checkDigitFrom: String(namespacePresets[kind].checkDigitFrom),
    manager: '',
    managerShare: '0',
    metadata: '',
    prices: namespacePresets[kind].prices.join(', '),
  },
  submitLabel: 'Add namespace',
  submit: (values) => {
    const kind = values.kind
    // Without rules the registry takes no name, so an extension would open with nothing to sell
    if (kind === KIND.NAME && !nameRules) throw new FormError('Set the name rules first, under Registry')
    const name = cleanLabel(values.name, kind)
    const { minLength, maxLength, checkDigitFrom, manager, managerShare, metadata } = rules(values)
    const prices = parsePrices(values.prices, currency)
    const display = displayName(kind, name)
    return perform({
      functionName: 'addNamespace',
      args: [KIND_BY_INDEX.indexOf(kind), name, minLength, maxLength, checkDigitFrom, prices, manager, managerShare, metadata],
      pending: `Adding ${display}`,
      done: `${display} added`,
    })
  },
})

export const updateRulesSpec = ({ source, namespace, perform }) => ({
  title: `Rules for ${namespace.label}`,
  fields: RULE_FIELDS,
  initial: {
    minLength: String(source.minLength),
    maxLength: String(source.maxLength),
    checkDigitFrom: String(source.checkDigitFrom),
    manager: source.manager === zeroAddress ? '' : source.manager,
    managerShare: String(source.managerShare),
    metadata: prettyMetadata(source.metadata),
  },
  submitLabel: 'Save rules',
  submit: (values) => {
    const { minLength, maxLength, checkDigitFrom, manager, managerShare, metadata } = rules(values)
    return perform({
      functionName: 'updateNamespace',
      args: [source.id, minLength, maxLength, checkDigitFrom, source.paused, manager, managerShare, metadata],
      pending: `Updating ${namespace.label}`,
      done: `${namespace.label} updated`,
    })
  },
})

export const pauseNamespaceSpec = ({ source, namespace, perform }) => ({
  title: source.paused ? `Resume ${namespace.label}` : `Pause ${namespace.label}`,
  description: source.paused
    ? 'New registrations open again.'
    : 'New registrations stop. Existing names keep working and can still be renewed.',
  fields: [],
  submitLabel: source.paused ? 'Resume' : 'Pause',
  tone: source.paused ? undefined : 'danger',
  submit: () =>
    perform({
      functionName: 'updateNamespace',
      args: [source.id, source.minLength, source.maxLength, source.checkDigitFrom, !source.paused, source.manager, source.managerShare, source.metadata],
      pending: source.paused ? `Resuming ${namespace.label}` : `Pausing ${namespace.label}`,
      done: source.paused ? `${namespace.label} resumed` : `${namespace.label} paused`,
    }),
})

export const pricesSpec = ({ source, namespace, currency, perform }) => ({
  title: `Prices for ${namespace.label}`,
  fields: [priceField(currency)],
  initial: { prices: formatPrices(source.prices, currency) },
  submitLabel: 'Save prices',
  submit: (values) =>
    perform({
      functionName: 'setPrices',
      args: [source.id, parsePrices(values.prices, currency)],
      pending: `Repricing ${namespace.label}`,
      done: `${namespace.label} repriced`,
    }),
})

export const reserveSpec = ({ source, namespace, perform }) => ({
  title: `Reserve in ${namespace.label}`,
  description: 'Reserved labels can only be granted by the owner. Release them to open them up again.',
  fields: [
    { name: 'labels', label: 'Labels, one per line', type: 'textarea', rows: 5 },
    {
      name: 'mode',
      label: 'Action',
      type: 'select',
      options: [
        { value: 'reserve', label: 'Reserve' },
        { value: 'release', label: 'Release' },
      ],
    },
  ],
  initial: { labels: '', mode: 'reserve' },
  submitLabel: 'Apply',
  submit: (values) => {
    const labels = String(values.labels ?? '')
      .split('\n')
      .map((label) => label.trim())
      .filter(Boolean)
      .map((label) => labelIn(label, namespace))
    if (!labels.length) throw new FormError('Enter at least one label')
    const reserved = values.mode === 'reserve'
    return perform({
      functionName: 'setReserved',
      args: [source.id, labels, reserved],
      pending: reserved ? `Reserving in ${namespace.label}` : `Releasing in ${namespace.label}`,
      done: reserved ? `Reserved in ${namespace.label}` : `Released in ${namespace.label}`,
    })
  },
})

// One line of a grant list: the label, the holder's address, and the years when not one
const GRANT_LINE = /^(.+?)[\s,]+(0x[0-9a-fA-F]{40})(?:[\s,]+(\d+))?$/

/**
 * Grants several names at once, such as founding numbers for a community: one line each. The
 * registry grants one name per call, so the wallet asks once for each, in the order listed.
 */
export const grantManySpec = ({ source, namespace, perform }) => ({
  title: `Grant several ${namespace.label} names`,
  description: 'One name per line: the label, the holder’s address, and the years (1 when left out). The wallet asks to confirm each one.',
  fields: [{ name: 'lines', label: 'Names', type: 'textarea', rows: 6, placeholder: `4242 0x… 2\n4243 0x…` }],
  initial: { lines: '' },
  submitLabel: 'Grant all',
  submit: async (values) => {
    const grants = String(values.lines ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const match = GRANT_LINE.exec(line)
        if (!match) throw new FormError(`Line ${index + 1} needs a label and an address`)
        const label = labelIn(match[1], namespace)
        const years = integer(match[3] ?? '1', `Years on line ${index + 1}`, { min: 1, max: registry.maxYears })
        return { label, to: address(match[2]), years: BigInt(years), display: fullName(namespace, label) }
      })
    if (!grants.length) throw new FormError('Enter at least one name')
    const labels = grants.map((grant) => grant.label)
    if (new Set(labels).size !== labels.length) throw new FormError('A name is listed twice')
    // One after another, so the wallet's confirmations come in the order of the list
    for (const grant of grants) {
      await perform({
        functionName: 'adminRegister',
        args: [source.id, grant.label, grant.to, grant.years],
        pending: `Granting ${grant.display}`,
        done: `${grant.display} granted`,
      })
    }
  },
})

export const grantSpec = ({ source, namespace, perform, account }) => ({
  title: `Grant a ${namespace.label} name`,
  description: 'Registers a name for someone without payment, past any reservation or pause.',
  fields: [
    { name: 'label', label: 'Label', type: 'text' },
    { name: 'to', label: 'Holder', type: 'address' },
    { name: 'years', label: 'Years', type: 'number', min: 1, max: registry.maxYears },
  ],
  initial: { label: '', to: account ?? '', years: '1' },
  submitLabel: 'Grant',
  submit: (values) => {
    const label = labelIn(values.label, namespace)
    const display = fullName(namespace, label)
    return perform({
      functionName: 'adminRegister',
      args: [source.id, label, address(values.to), BigInt(integer(values.years, 'Years', { min: 1, max: registry.maxYears }))],
      pending: `Granting ${display}`,
      done: `${display} granted`,
    })
  },
})
