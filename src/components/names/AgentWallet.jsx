'use client'

import { useId, useState } from 'react'
import { isAddressEqual } from 'viem'
import { ArrowLineDownIcon, ArrowSquareOutIcon, PlusCircleIcon, RobotIcon, WarningIcon } from '@phosphor-icons/react'
import AddressAvatar from '@/components/ui/AddressAvatar'
import Button from '@/components/ui/Button'
import CopyButton from '@/components/ui/CopyButton'
import Shimmer from '@/components/ui/Shimmer'
import { toast } from '@/components/NextToast'
import { chainNameFor, explorerFor } from '@/config/chains'
import { registry } from '@/config/registry'
import { site } from '@/config/site'
import useTokenBound from '@/hooks/useTokenBound'
import { actionError, trackAdmin } from '@/lib/adminActions'
import { formatBalance, truncateAddress } from '@/lib/format'
import { sendFromTokenBound, setUpTokenBound } from '@/lib/tokenBoundActions'
import styles from './AgentWallet.module.scss'

const copy = site.profile.agentWallet

/**
 * A name's own wallet (ERC-6551), for its holder: where it is, what it holds, a way to point the
 * name at it and a way to move its ETH out. It is the holder's because the NFT is, so it goes with
 * the name to whoever holds it next, and the warning says so. An expired name's holder still
 * controls it until someone registers the name again, so this shows then too, when it holds ETH.
 */
export default function AgentWallet({ name, wallet, account, currency, expired = false, perform, onChange }) {
  const titleId = useId()
  const { data, isPending, isError } = useTokenBound(wallet)
  const [busy, setBusy] = useState(null)

  const fill = (text, amount) => text.replaceAll('{name}', name.display).replaceAll('{amount}', amount ?? '')
  const pointed = isAddressEqual(name.target, wallet)
  const holds = data ? data.balance > 0n : false
  // Read and not set up yet. An expired name's holder only moves out, which sets it up anyway
  const unset = Boolean(data) && !data.ready && !expired
  const explorer = explorerFor(registry.chainId)

  if (expired && !holds) return null

  const run = async (kind, task) => {
    setBusy(kind)
    try {
      await task()
    } catch (error) {
      toast(actionError(error), 'error')
    } finally {
      setBusy(null)
    }
  }

  // Through the page's own path, so a holder's change is relayed without a fee like the others
  const point = () =>
    run('point', () =>
      perform({
        functionName: 'setTarget',
        args: [name.tokenId, pointed ? account : wallet],
        pending: fill(pointed ? copy.pointingBack : copy.pointing),
        done: fill(pointed ? copy.pointedBack : copy.pointed),
      })
    )

  // Deploys and initializes it; resolves with whether that confirmed
  const setUp = async () => {
    const created = await setUpTokenBound(name.tokenId, data)
    const done = await trackAdmin(created, { pending: fill(copy.creating), done: fill(copy.createdDone) })
    onChange()
    return done
  }

  // Before anything is sent to it, or when it holds only tokens, which Move doesn't cover
  const create = () => run('create', setUp)

  const move = () =>
    run('move', async () => {
      if (!data.ready && !(await setUp())) return
      const amount = formatBalance(data.balance, currency)
      const sent = await sendFromTokenBound({ account: wallet, to: account, value: data.balance })
      trackAdmin(sent, { pending: fill(copy.moving, amount), done: fill(copy.moved, amount) }).then((success) => success && onChange())
    })

  let balance = <Shimmer className={styles.wallet__shimmer} label="Reading the agent wallet" />
  let status = <Shimmer className={styles.wallet__shimmer} label="Reading the agent wallet" />
  if (isError) {
    balance = copy.unread
    status = copy.unread
  } else if (!isPending && data) {
    balance = formatBalance(data.balance, currency)
    status = data.ready ? copy.created : copy.notCreated
  }

  return (
    <section className={styles.wallet} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.wallet__title}>
        <RobotIcon size={20} aria-hidden />
        {copy.title}
      </h2>
      {!expired && <p className={styles.wallet__intro}>{fill(copy.intro)}</p>}

      <dl className={styles.wallet__facts}>
        <div className={styles.wallet__row}>
          <dt className={styles.wallet__term}>{copy.address}</dt>
          <dd className={styles.wallet__value}>
            <span className={styles.wallet__identity}>
              <AddressAvatar address={wallet} size="sm" />
              <span title={wallet}>{truncateAddress(wallet)}</span>
              <CopyButton value={wallet} title="Copy address" size={13} />
            </span>
          </dd>
        </div>
        <div className={styles.wallet__row}>
          <dt className={styles.wallet__term}>{copy.balance}</dt>
          <dd className={styles.wallet__value}>{balance}</dd>
        </div>
        <div className={styles.wallet__row}>
          <dt className={styles.wallet__term}>{copy.status}</dt>
          <dd className={styles.wallet__value}>{status}</dd>
        </div>
      </dl>

      <div className={styles.wallet__warning} role="note">
        <WarningIcon className={styles['wallet__warning-icon']} size={18} weight="fill" aria-hidden />
        <div className={styles['wallet__warning-text']}>
          <p>{fill(expired ? copy.expired : copy.warning)}</p>
          {!expired && <p>{fill(copy.chainOnly).replaceAll('{chain}', chainNameFor(registry.chainId))}</p>}
        </div>
      </div>

      <div className={styles.wallet__actions}>
        {!expired && (
          <Button variant={pointed ? 'secondary' : 'primary'} loading={busy === 'point'} disabled={Boolean(busy)} onClick={point}>
            {fill(pointed ? copy.pointBack : copy.point)}
          </Button>
        )}
        {holds && (
          <Button
            variant={expired ? 'primary' : 'secondary'}
            icon={<ArrowLineDownIcon size={16} />}
            loading={busy === 'move'}
            disabled={Boolean(busy)}
            onClick={move}
          >
            {fill(copy.move, formatBalance(data.balance, currency))}
          </Button>
        )}
        {unset && (
          <Button variant="secondary" icon={<PlusCircleIcon size={16} />} loading={busy === 'create'} disabled={Boolean(busy)} onClick={create}>
            {copy.create}
          </Button>
        )}
        {explorer && (
          <Button variant="link" size="sm" href={`${explorer}/address/${wallet}`} icon={<ArrowSquareOutIcon size={14} />}>
            {copy.explorer}
          </Button>
        )}
      </div>
      {holds && <p className={styles.wallet__note}>{data.ready ? copy.fee : copy.createNote}</p>}
      {unset && !holds && <p className={styles.wallet__note}>{copy.createFee}</p>}
    </section>
  )
}
