'use client'

import { useRef } from 'react'
import clsx from 'clsx'
import { isAddressEqual, zeroAddress } from 'viem'
import { useConnection } from 'wagmi'
import { CloudSlashIcon, PaperPlaneTiltIcon, StorefrontIcon, WarningCircleIcon } from '@phosphor-icons/react'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import CopyButton from '@/components/ui/CopyButton'
import EmptyState from '@/components/ui/EmptyState'
import Shimmer from '@/components/ui/Shimmer'
import AddressAvatar from '@/components/ui/AddressAvatar'
import PayDialog from '@/components/names/PayDialog'
import ReminderButton from '@/components/names/ReminderButton'
import WatchButton from '@/components/names/WatchButton'
import Countdown from '@/components/search/Countdown'
import PaymentDialog from '@/components/search/PaymentDialog'
import UsdValue from '@/components/search/UsdValue'
import { useWalletDialog } from '@/components/WalletDialogProvider'
import { chainNameFor, marketplaceFor } from '@/config/chains'
import { registry } from '@/config/registry'
import useIsClient from '@/hooks/useIsClient'
import useNameLookup from '@/hooks/useNameLookup'
import useNearby from '@/hooks/useNearby'
import { site } from '@/config/site'
import { formatAmount, formatDate, formatPrice, truncateAddress } from '@/lib/format'
import { namePath } from '@/lib/namespaces'
import styles from './ResultCard.module.scss'

const STATUS = {
  loading: { label: 'Checking', tone: 'neutral' },
  available: { label: 'Available', tone: 'success' },
  taken: { label: 'Taken', tone: 'danger' },
  soon: { label: 'Coming soon', tone: 'accent' },
  reserved: { label: 'Reserved', tone: 'neutral' },
  paused: { label: 'Paused', tone: 'warning' },
  invalid: { label: 'Not valid', tone: 'neutral' },
  error: { label: 'Unavailable', tone: 'warning' },
}

// Statuses whose body is just the reason the name can't be registered
const REASON_STATUSES = new Set(['invalid', 'reserved', 'paused'])

const sameAddress = (a, b) => Boolean(a && b) && isAddressEqual(a, b)

const statusOf = (candidate, lookup) => {
  if (!candidate.checkable) return 'invalid'
  if (lookup.isPending) return 'loading'
  if (lookup.isError) return candidate.valid ? 'error' : 'invalid'
  // Refused by today's length or check digit: held from before the rules changed, or not valid
  if (!candidate.valid) return lookup.data.status === 'taken' ? 'taken' : 'invalid'
  return lookup.data.status
}

function Row({ term, children }) {
  return (
    <div className={styles.card__row}>
      <dt className={styles.card__term}>{term}</dt>
      <dd className={styles.card__value}>{children}</dd>
    </div>
  )
}

function Identity({ address, name }) {
  return (
    <span className={styles.card__identity}>
      <AddressAvatar address={address} size="sm" />
      <span className={styles['card__identity-text']} title={address} dir="auto">
        {name ?? truncateAddress(address)}
      </span>
      <CopyButton value={address} title="Copy address" size={13} />
    </span>
  )
}

function LoadingBody() {
  return (
    <>
      <Shimmer className={styles['card__skeleton-panel']} />
      <Shimmer className={styles['card__skeleton-button']} />
    </>
  )
}

function Price({ value, currency }) {
  return (
    <>
      <span className={styles.card__price}>
        {formatAmount(value, currency)}
        {value > 0n && <span className={styles.card__per}> / year</span>}
      </span>
      <UsdValue wei={value} decimals={currency.decimals} className={styles.card__usd} />
    </>
  )
}

function AvailableBody({ data, onRegister }) {
  return (
    <>
      <dl className={styles.card__panel}>
        <Row term="Price">
          <Price value={data.pricePerYear} currency={data.currency} />
        </Row>
        <p className={styles.card__note}>Nobody owns this name yet.</p>
      </dl>
      <Button size="lg" block onClick={onRegister}>
        Register
      </Button>
    </>
  )
}

function TakenBody({ data, candidate, isYours, onRenew, onPay, onPick, page }) {
  const { owner, ownerName, target, expiresAt, expired, tokenId } = data
  const pointsElsewhere = target && target !== zeroAddress && !sameAddress(target, owner)
  // Someone else's name: free numbers beside it, and the way to its holder through a marketplace
  const nearby = useNearby(candidate, !isYours)
  const offer = isYours ? null : marketplaceFor(registry.chainId, registry.address, tokenId)

  return (
    <>
      <dl className={styles.card__panel}>
        <Row term="Owner">
          <Identity address={owner} name={ownerName} />
        </Row>
        {pointsElsewhere && (
          <Row term="Points to">
            <Identity address={target} />
          </Row>
        )}
        <Row term={expired ? 'Expired on' : 'Expires on'}>{formatDate(expiresAt)}</Row>
        {expired && <p className={styles.card__note}>Its holder can still renew it before it returns to the public.</p>}
      </dl>
      {!expired && <Countdown target={expiresAt} label="Expires in" />}
      {isYours ? (
        <div className={styles.card__owned}>
          <Button size="lg" block href={page}>
            Manage
          </Button>
          <Button variant="secondary" size="lg" block onClick={onRenew}>
            Renew
          </Button>
          <ReminderButton name={candidate.name} path={page} expiresAt={expiresAt} variant="link" />
        </div>
      ) : (
        <div className={styles.card__owned}>
          {onPay && (
            <Button size="lg" block icon={<PaperPlaneTiltIcon size={16} />} onClick={onPay}>
              {site.pay.action}
            </Button>
          )}
          <div className={styles.card__pair}>
            <Button variant="secondary" block href={page}>
              {site.search.open}
            </Button>
            <WatchButton name={candidate.name} size="md" block />
          </div>
          {offer && (
            <Button variant="link" size="sm" href={offer} icon={<StorefrontIcon size={14} />}>
              {site.profile.offer}
            </Button>
          )}
        </div>
      )}
      {nearby.length > 0 && (
        <div className={styles.card__nearby}>
          <span className={styles['card__nearby-label']}>{site.search.nearby.label}</span>
          {nearby.map((option) => (
            <button key={option.digits} type="button" className={styles.card__suggestion} onClick={() => onPick(option.name)}>
              {option.name}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

function SoonBody({ data, namespace }) {
  const { quote } = data
  return (
    <>
      <dl className={styles.card__panel}>
        <Row term="Launch price">
          {quote?.perYear != null ? (
            <>
              <span className={styles.card__price}>
                {formatPrice(quote.perYear, quote.currency)}
                {quote.perYear > 0 && <span className={styles.card__per}> / year</span>}
              </span>
              <UsdValue eth={quote.perYear} className={styles.card__usd} />
            </>
          ) : (
            'To be announced'
          )}
        </Row>
        <p className={styles.card__note}>Registration opens when Readable launches on {chainNameFor(namespace.chainId)}.</p>
      </dl>
      <Button size="lg" block disabled>
        Coming soon
      </Button>
    </>
  )
}

/** One candidate name in one namespace, with its live status and the way to claim or renew it. */
export default function ResultCard({ candidate, onAbout, onPick }) {
  const { namespace } = candidate
  const lookup = useNameLookup(candidate)
  const { address, isConnected } = useConnection()
  const isClient = useIsClient()
  const openWalletDialog = useWalletDialog()
  const paymentRef = useRef(null)
  const payRef = useRef(null)

  const status = statusOf(candidate, lookup)
  const { label, tone } = STATUS[status] ?? STATUS.error
  const data = lookup.data
  const isYours = isClient && status === 'taken' && sameAddress(data?.owner, address)
  const payable = status === 'available' || isYours
  // Someone else's live name that points somewhere can be paid, in ETH
  const sendable = status === 'taken' && !isYours && !data.expired && data.target !== zeroAddress
  const named = candidate.valid || status === 'taken'
  const page = named ? namePath(namespace, candidate.label) : null

  // Paying needs a wallet: without one the same button opens the picker instead
  const openPayment = () => (isConnected ? paymentRef.current?.open() : openWalletDialog())
  const openPay = () => (isConnected ? payRef.current?.open() : openWalletDialog())

  return (
    <article className={clsx(styles.card, styles[`card--${status}`])} aria-busy={status === 'loading'}>
      <header className={styles.card__header}>
        <div className={styles.card__badges}>
          <Badge tone={tone}>{label}</Badge>
          {isYours && <Badge tone="accent">Yours</Badge>}
        </div>
        <div className={styles.card__title}>
          <h2 className={styles.card__name} dir="auto">
            {candidate.name}
          </h2>
          {named && <CopyButton value={candidate.name} title="Copy name" />}
        </div>
        <p className={styles.card__meta}>
          {namespace.title} · {chainNameFor(namespace.chainId)}
        </p>
        {candidate.keypad && <p className={styles.card__keypad}>{site.search.keypad.replace('{word}', candidate.keypad.word)}</p>}
      </header>

      <div className={styles.card__body}>
        {status === 'loading' && <LoadingBody />}
        {REASON_STATUSES.has(status) && (
          <EmptyState icon={WarningCircleIcon} className={styles.card__message}>
            {candidate.reason ?? data?.reason}
          </EmptyState>
        )}
        {status === 'error' && (
          <EmptyState
            icon={CloudSlashIcon}
            className={styles.card__message}
            action={
              <Button variant="link" size="sm" onClick={() => lookup.refetch()}>
                Try again
              </Button>
            }
          >
            Couldn’t reach {chainNameFor(namespace.chainId)}.
          </EmptyState>
        )}
        {status === 'available' && <AvailableBody data={data} onRegister={openPayment} />}
        {status === 'taken' && (
          <TakenBody
            data={data}
            candidate={candidate}
            isYours={isYours}
            onRenew={openPayment}
            onPay={sendable ? openPay : null}
            onPick={onPick}
            page={page}
          />
        )}
        {status === 'soon' && <SoonBody data={data} namespace={namespace} />}
      </div>

      <footer className={styles.card__footer}>
        {namespace.about && (
          <Button variant="link" size="sm" onClick={() => onAbout(namespace)}>
            {namespace.about.title}
          </Button>
        )}
        {/* The name's page, whose preview shows the name wherever the link is pasted */}
        {page && <CopyButton value={page} label={site.search.copyLink} title={site.search.copyLink} variant="chip" />}
      </footer>

      {sendable && <PayDialog ref={payRef} candidate={candidate} target={data.target} currency={data.currency} />}
      {payable && (
        <PaymentDialog
          ref={paymentRef}
          action={status === 'available' ? 'register' : 'renew'}
          candidate={candidate}
          tokenId={data.tokenId}
          pricePerYear={data.pricePerYear}
          currency={data.currency}
        />
      )}
    </article>
  )
}
