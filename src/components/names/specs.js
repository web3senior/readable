import { isAddress, isAddressEqual, zeroAddress } from 'viem'
import { addresses } from '@/config/addresses'
import { home } from '@/config/chains'
import { registry } from '@/config/registry'
import { site } from '@/config/site'
import { addressBytes, addressText } from '@/lib/addresses'
import { FormError } from '@/lib/adminActions'
import { tokenBoundAccountOf } from '@/lib/tokenBound'

const { profile } = site

/**
 * Builders for the ActionDialog, one per thing a holder can change on a name. Each `submit`
 * validates what was typed, then hands one call to `perform({ functionName, args, pending, done })`.
 */

export const targetSpec = ({ name, perform, account }) => ({
  title: `Point ${name.display} at a wallet`,
  description: 'Whoever looks this name up reaches this wallet. You keep the name; it points back at its holder when it changes hands.',
  fields: [
    {
      name: 'target',
      label: 'Wallet address',
      type: 'address',
      hint: isAddressEqual(name.target, account) ? 'It points at your own wallet now.' : `Your own wallet is ${account}.`,
    },
  ],
  initial: { target: name.target },
  submitLabel: 'Save',
  submit: (values) => {
    const target = String(values.target ?? '').trim()
    if (!isAddress(target)) throw new FormError('That is not a valid address')
    return perform({
      functionName: 'setTarget',
      args: [name.tokenId, target],
      pending: `Pointing ${name.display} at the wallet`,
      done: `${name.display} points at the wallet`,
    })
  },
})

export const primarySpec = ({ name, perform }) =>
  name.primary
    ? {
        title: 'Remove your primary name',
        description: `${name.display} is the name apps show for your wallet. Remove it and they show your address again.`,
        fields: [],
        submitLabel: 'Remove',
        submit: () =>
          perform({ functionName: 'setPrimaryName', args: [0n], pending: 'Removing your primary name', done: 'Primary name removed' }),
      }
    : {
        title: `Make ${name.display} your primary name`,
        description: `Apps that would show your wallet’s address show ${name.display} instead. Only one name can be primary; every name you hold still receives.`,
        fields: [],
        submitLabel: 'Make primary',
        submit: () =>
          perform({
            functionName: 'setPrimaryName',
            args: [name.tokenId],
            pending: `Making ${name.display} your primary name`,
            done: `${name.display} is your primary name`,
          }),
      }

export const editorSpec = ({ name, perform }) => {
  const current = name.editor ?? zeroAddress
  return {
    title: `Let another wallet edit ${name.display}`,
    description:
      'An editor, such as the agent this name stands for, changes where it points, its records and its addresses. It can’t move the name or name another editor. It goes when the name changes hands, and you can remove it any time.',
    fields: [{ name: 'editor', label: 'Editor’s address', type: 'address', hint: 'Leave it empty for no editor.' }],
    initial: { editor: isAddressEqual(current, zeroAddress) ? '' : current },
    submitLabel: 'Save',
    submit: (values) => {
      const typed = String(values.editor ?? '').trim()
      if (typed && !isAddress(typed)) throw new FormError('That is not a valid address')
      const editor = typed || zeroAddress
      if (isAddressEqual(editor, current)) throw new FormError('Nothing changed')
      if (isAddressEqual(editor, name.owner)) throw new FormError('The holder can change it already')
      const removing = isAddressEqual(editor, zeroAddress)
      return perform({
        functionName: 'setEditor',
        args: [name.tokenId, editor],
        pending: removing ? `Removing the editor of ${name.display}` : `Naming the editor of ${name.display}`,
        done: removing ? `${name.display} has no editor` : `The editor of ${name.display} is saved`,
      })
    },
  }
}

// `transferFrom`, not `safeTransferFrom`: a Universal Profile or an EIP-7702 account without an
// ERC-721 receiver would refuse a safe transfer, as the registry mints with `_mint` for them
export const transferSpec = ({ name, perform, account }) => {
  const agentWallet = tokenBoundAccountOf(name.tokenId)
  const goes = [
    name.primary && 'It stops being your primary name.',
    agentWallet && `Its ${profile.agentWallet.title.toLowerCase()} goes with it, with everything in it.`,
  ].filter(Boolean)
  return {
    title: `Transfer ${name.display}`,
    description: [
      `Send ${name.display} to another wallet, with the years left on it. It arrives pointing at its new holder, with no records, no addresses on other chains and no editor.`,
      ...goes,
      'A transfer is an ordinary transaction, with a network fee, and only the new holder can send the name back.',
    ].join(' '),
    fields: [
      {
        name: 'to',
        label: 'New holder’s address',
        type: 'address',
        hint: 'Check it twice: a name sent to a wrong address, or to a contract that can’t hold NFTs, can’t be brought back.',
      },
    ],
    initial: { to: '' },
    submitLabel: 'Transfer',
    tone: 'danger',
    submit: (values) => {
      const to = String(values.to ?? '').trim()
      if (!isAddress(to)) throw new FormError('That is not a valid address')
      if (isAddressEqual(to, zeroAddress)) throw new FormError('A name can’t be sent to the zero address')
      if (isAddressEqual(to, account)) throw new FormError('This wallet holds it already')
      if (isAddressEqual(to, registry.address)) throw new FormError('The registry can’t hold names')
      // An account that answers to the name it holds: nobody could move either again
      if (agentWallet && isAddressEqual(to, agentWallet)) throw new FormError('A name can’t be sent to its own agent wallet')
      return perform({
        functionName: 'transferFrom',
        args: [account, to, name.tokenId],
        pending: `Transferring ${name.display}`,
        done: `${name.display} is transferred`,
      })
    },
  }
}

const listAnd = new Intl.ListFormat('en', { type: 'conjunction' })

export const addressesSpec = ({ name, perform }) => {
  const field = (chain) => String(chain.coin.coinType)
  // An address the site can't read back is shown as nothing and kept unless replaced
  const initial = Object.fromEntries(addresses.chains.map((chain) => [field(chain), addressText(chain, name.addresses[chain.coin.coinType]) ?? '']))
  return {
    title: `Other chains for ${name.display}`,
    description: `Where ${name.display} receives on ${listAnd.format(addresses.chains.map((chain) => chain.label))}. On ${home.name}, Ethereum, BNB and most other EVM chains it reaches the wallet it points to. Like its records, these belong to you: whoever holds the name next starts with none.`,
    fields: addresses.chains.map((chain) => ({
      name: field(chain),
      label: `${chain.label} address`,
      type: 'address',
      placeholder: chain.placeholder,
    })),
    initial,
    submitLabel: 'Save addresses',
    submit: (values) => {
      const entries = []
      for (const chain of addresses.chains) {
        const text = String(values[field(chain)] ?? '').trim()
        if (text === initial[field(chain)]) continue
        const value = text ? addressBytes(chain, text) : '0x'
        if (!value) throw new FormError(`That is not a valid ${chain.label} address`)
        entries.push({ coinType: BigInt(chain.coin.coinType), value })
      }
      if (!entries.length) throw new FormError('Nothing changed')
      return perform({
        functionName: 'setAddrs',
        args: [name.tokenId, entries],
        pending: `Saving the addresses of ${name.display}`,
        done: `Addresses of ${name.display} saved`,
      })
    },
  }
}
