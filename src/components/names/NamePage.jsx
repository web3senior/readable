'use client'

import { useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useConnection } from 'wagmi'
import { isAddressEqual, zeroAddress } from 'viem'
import { ArrowLeftIcon, ChatsCircleIcon, CloudSlashIcon, MagnifyingGlassIcon, PaperPlaneTiltIcon, PlugsIcon, StorefrontIcon, WalletIcon } from '@phosphor-icons/react'
import AddressAvatar from '@/components/ui/AddressAvatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import CopyButton from '@/components/ui/CopyButton'
import EmptyState from '@/components/ui/EmptyState'
import Shimmer from '@/components/ui/Shimmer'
import ActionPanel from '@/components/names/ActionPanel'
import AgentWallet from '@/components/names/AgentWallet'
import ContactCard from '@/components/names/ContactCard'
import PayDialog from '@/components/names/PayDialog'
import RecordsForm from '@/components/names/RecordsForm'
import ReminderButton from '@/components/names/ReminderButton'
import SharePanel from '@/components/names/SharePanel'
import WatchButton from '@/components/names/WatchButton'
import { addressesSpec, editorSpec, primarySpec, targetSpec, transferSpec } from '@/components/names/specs'
import PaymentDialog from '@/components/search/PaymentDialog'
import { useWalletDialog } from '@/components/WalletDialogProvider'
import { chainNameFor, marketplaceFor } from '@/config/chains'
import { registry, registryEnabled } from '@/config/registry'
import { site } from '@/config/site'
import useGasless from '@/hooks/useGasless'
import useIsClient from '@/hooks/useIsClient'
import useNamePage from '@/hooks/useNamePage'
import useNamespaces from '@/hooks/useNamespaces'
import { sendAdmin, trackAdmin } from '@/lib/adminActions'
import { formatDate, formatRelative, truncateAddress } from '@/lib/format'
import { displayName, namePath, toNamespace } from '@/lib/namespaces'
import { findName } from '@/lib/query/parse'
import { searchPath } from '@/lib/searchLink'
import { tokenBoundAccountOf } from '@/lib/tokenBound'
import styles from './NamePage.module.scss'

const { path: NFT_PATH, art: NFT_ART } = site.nft
const { gates } = site.names
const { profile } = site

// A path segment as it was typed, with the dashes the link puts between digit groups
const readSlug = (slug) => {
  try {
    return decodeURIComponent(slug)
  } catch {
    return slug
  }
}

function Skeleton() {
  return (
    <div className={styles.detail__layout}>
      <Shimmer className={styles['detail__skeleton-summary']} label="Loading the name" />
      <div className={styles.detail__sections}>
        <Shimmer className={styles['detail__skeleton-panel']} label="Loading the name" />
        <Shimmer className={styles['detail__skeleton-panel']} label="Loading the name" />
      </div>
    </div>
  )
}

/**
 * One name on a page of its own. Anyone sees what it is and where it points, its contact card,
 * a way to pay it and ways to share it; its holder sees every change, each in its own section
 * instead of a dialog, and its editor the changes an editor can make. Read in the browser, so
 * the page never waits for the chain on the server.
 */
export default function NamePage({ slug }) {
  const isClient = useIsClient()
  const { address, isConnected } = useConnection()
  const openWalletDialog = useWalletDialog()
  const account = isClient && isConnected ? address : undefined
  const gaslessChanges = useGasless(account)
  const paymentRef = useRef(null)
  const payRef = useRef(null)
  // Fixed for the visit, so the page doesn't flip to expired between two renders
  const [now] = useState(() => Date.now())

  const typed = readSlug(slug)
  const { namespaces, isLoading: namespacesLoading, isError: namespacesError } = useNamespaces()
  const candidate = useMemo(() => findName(typed, namespaces), [typed, namespaces])
  const { data, isPending, isError, refetch, refresh } = useNamePage(candidate)

  const name = useMemo(() => {
    if (!data?.name?.source) return null
    const namespace = toNamespace(data.name.source, { chainId: registry.chainId, currency: data.currency })
    return { ...data.name, namespace, display: displayName(namespace, data.name.label) }
  }, [data])

  // A visitor from a shared link goes on to the search; a wallet goes back to its names
  const back = account ? (
    <Button className={styles.detail__back} variant="link" size="sm" href={site.names.path} icon={<ArrowLeftIcon size={14} weight="bold" />}>
      {site.names.title}
    </Button>
  ) : (
    <Button className={styles.detail__back} variant="link" size="sm" href="/" icon={<MagnifyingGlassIcon size={14} weight="bold" />}>
      {site.names.find}
    </Button>
  )

  let content
  if (!registryEnabled) {
    content = (
      <EmptyState size="lg" align="center" icon={PlugsIcon}>
        {gates.unconfigured}
      </EmptyState>
    )
  } else if (namespacesError || isError) {
    content = (
      <EmptyState
        size="lg"
        align="center"
        icon={CloudSlashIcon}
        action={
          <Button variant="link" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        }
      >
        {gates.unreachable}
      </EmptyState>
    )
  } else if (namespacesLoading || isPending) {
    content = <Skeleton />
  } else if (!name) {
    content = (
      <EmptyState
        size="lg"
        align="center"
        icon={MagnifyingGlassIcon}
        action={
          <Button variant="link" size="sm" href={searchPath(typed)}>
            {profile.register}
          </Button>
        }
      >
        {candidate ? profile.unregistered.replace('{name}', candidate.name) : `“${typed}” isn’t a name.`}
      </EmptyState>
    )
  } else {
    const expired = name.expiresAt <= now
    const holder = Boolean(account) && isAddressEqual(name.owner, account)
    const edited = !isAddressEqual(name.editor, zeroAddress)
    const editor = Boolean(account) && !holder && edited && isAddressEqual(name.editor, account)
    const pointsHome = isAddressEqual(name.target, name.owner)
    // The name's own wallet (ERC-6551), where the chain has one
    const agentWallet = tokenBoundAccountOf(name.tokenId)
    const pointsToAgentWallet = Boolean(agentWallet) && isAddressEqual(name.target, agentWallet)
    const reachable = !expired && !isAddressEqual(name.target, zeroAddress)
    const path = namePath(name.namespace, name.label)
    const offer = marketplaceFor(registry.chainId, registry.address, name.tokenId)
    const tunnel = profile.tunnel.url.replace('{query}', encodeURIComponent(name.display.replaceAll(' ', '')))
    const payable = !holder && reachable
    const share = <SharePanel name={name.display} path={path} />

    // Resolves once the wallet signs; the toast carries the transaction and refreshes on success
    const perform = async ({ functionName, args, pending, done }) => {
      const sent = await sendAdmin(functionName, args)
      trackAdmin(sent, { pending, done }).then((success) => success && refresh())
    }
    const args = { name, account, perform }
    const agentWalletPanel = (live) =>
      agentWallet && (
        <AgentWallet
          name={name}
          wallet={agentWallet}
          account={account}
          currency={data.currency}
          expired={!live}
          perform={perform}
          onChange={refresh}
        />
      )

    let sections
    if (holder && !expired) {
      // Each section starts from what the registry holds, and starts over when that changes
      sections = (
        <>
          {gaslessChanges && <p className={styles.detail__hint}>{site.gasless.note}</p>}
          <ActionPanel key={`target:${name.target}`} spec={targetSpec(args)} heading="Points to" />
          <ActionPanel key={`primary:${name.primary}`} spec={primarySpec(args)} heading="Primary name" />
          <RecordsForm key={`records:${name.stored}`} name={name} account={account} perform={perform} />
          <ActionPanel key={`chains:${Object.values(name.addresses).join()}`} spec={addressesSpec(args)} heading="Other chains" />
          <ActionPanel key={`editor:${name.editor}`} spec={editorSpec(args)} heading={profile.editor.term} />
          {agentWalletPanel(true)}
          <ActionPanel key={`transfer:${name.tokenId}`} spec={transferSpec(args)} heading="Transfer" />
          {share}
        </>
      )
    } else if (editor && !expired) {
      // What the registry lets an editor change, and no proofs, which only the holder's wallet signs
      sections = (
        <>
          <p className={styles.detail__hint}>{profile.editor.note}</p>
          {gaslessChanges && <p className={styles.detail__hint}>{site.gasless.note}</p>}
          <ActionPanel key={`target:${name.target}`} spec={targetSpec(args)} heading="Points to" />
          <RecordsForm key={`records:${name.stored}`} name={name} account={account} perform={perform} proving={false} />
          <ActionPanel key={`chains:${Object.values(name.addresses).join()}`} spec={addressesSpec(args)} heading="Other chains" />
        </>
      )
    } else if (holder) {
      // Its own wallet is still the holder's until someone registers the name again
      sections = (
        <>
          <EmptyState className={styles.detail__notice} align="center" icon={WalletIcon}>
            Renew it to keep it. Until then it points nowhere and can’t be changed.
          </EmptyState>
          {agentWalletPanel(false)}
        </>
      )
    } else if (expired) {
      sections = (
        <EmptyState className={styles.detail__notice} align="center" icon={WalletIcon}>
          {profile.expired}
        </EmptyState>
      )
    } else {
      sections = (
        <>
          <ContactCard name={name} />
          {share}
        </>
      )
    }

    content = (
      <div className={styles.detail__layout}>
        <aside className={styles.detail__summary}>
          {/* Drawn by the site, as a wallet sees it; an SVG gains nothing from the image optimizer */}
          <Image
            className={styles.detail__nft}
            src={`${NFT_PATH}/${name.tokenId}/image`}
            width={NFT_ART.size}
            height={NFT_ART.size}
            alt={`The NFT of ${name.display}`}
            unoptimized
            priority
          />

          <header className={styles.detail__header}>
            <div className={styles.detail__badges}>
              <Badge tone={expired ? 'warning' : 'success'}>{expired ? 'Expired' : 'Active'}</Badge>
              {holder && <Badge tone="accent">Yours</Badge>}
              {editor && <Badge tone="accent">{profile.editor.badge}</Badge>}
              {name.primary && <Badge>Primary</Badge>}
            </div>
            <div className={styles.detail__title}>
              <h1 className={styles.detail__display} dir="auto">
                {name.display}
              </h1>
              <CopyButton value={name.display} title="Copy name" />
            </div>
            <p className={styles.detail__meta}>
              {name.namespace.title} · {chainNameFor(name.namespace.chainId)}
            </p>
          </header>

          <dl className={styles.detail__panel}>
            <div className={styles.detail__row}>
              <dt className={styles.detail__term}>Holder</dt>
              <dd className={styles.detail__value}>
                <span className={styles.detail__identity}>
                  <AddressAvatar address={name.owner} size="sm" />
                  <span title={name.owner}>{holder ? 'This wallet' : truncateAddress(name.owner)}</span>
                  <CopyButton value={name.owner} title="Copy address" size={13} />
                </span>
              </dd>
            </div>
            <div className={styles.detail__row}>
              <dt className={styles.detail__term}>Points to</dt>
              <dd className={styles.detail__value}>
                <span className={styles.detail__identity}>
                  <AddressAvatar address={name.target} size="sm" />
                  <span title={name.target}>
                    {pointsHome ? 'Its holder' : pointsToAgentWallet ? profile.agentWallet.target : truncateAddress(name.target)}
                  </span>
                  <CopyButton value={name.target} title="Copy address" size={13} />
                </span>
              </dd>
            </div>
            {edited && (
              <div className={styles.detail__row}>
                <dt className={styles.detail__term}>{profile.editor.term}</dt>
                <dd className={styles.detail__value}>
                  <span className={styles.detail__identity}>
                    <AddressAvatar address={name.editor} size="sm" />
                    <span title={name.editor}>{editor ? profile.editor.self : truncateAddress(name.editor)}</span>
                    <CopyButton value={name.editor} title="Copy address" size={13} />
                  </span>
                </dd>
              </div>
            )}
            <div className={styles.detail__row}>
              <dt className={styles.detail__term}>{expired ? 'Expired on' : 'Expires on'}</dt>
              <dd className={styles.detail__value}>
                {formatDate(name.expiresAt)}
                <span className={styles.detail__relative}> · {formatRelative(name.expiresAt, now)}</span>
              </dd>
            </div>
          </dl>

          {holder && name.pricePerYear !== null && (
            <div className={styles.detail__actions}>
              <Button variant={expired ? 'primary' : 'secondary'} block onClick={() => paymentRef.current?.open()}>
                Renew
              </Button>
              <ReminderButton name={name.display} path={path} expiresAt={name.expiresAt} block />
              <PaymentDialog
                ref={paymentRef}
                action="renew"
                candidate={{ namespace: name.namespace, label: name.label, name: name.display }}
                tokenId={name.tokenId}
                pricePerYear={name.pricePerYear}
                currency={data.currency}
              />
            </div>
          )}

          {!holder && (
            <div className={styles.detail__actions}>
              {payable && (
                <>
                  <Button block icon={<PaperPlaneTiltIcon size={16} />} onClick={() => (account ? payRef.current?.open() : openWalletDialog())}>
                    {site.pay.action}
                  </Button>
                  <PayDialog ref={payRef} candidate={{ namespace: name.namespace, label: name.label, name: name.display }} target={name.target} currency={data.currency} />
                </>
              )}
              {reachable && (
                <Button variant="secondary" block href={tunnel} icon={<ChatsCircleIcon size={16} />}>
                  {profile.tunnel.label}
                </Button>
              )}
              <div className={styles.detail__pair}>
                <WatchButton name={name.display} block />
                {offer && (
                  <Button variant="secondary" size="sm" block href={offer} icon={<StorefrontIcon size={14} />}>
                    {profile.offer}
                  </Button>
                )}
              </div>
              {!account && (
                <p className={styles.detail__hint}>
                  {profile.manage.question}{' '}
                  <Button variant="link" size="sm" onClick={openWalletDialog}>
                    {profile.manage.action}
                  </Button>
                </p>
              )}
            </div>
          )}
        </aside>

        <div className={styles.detail__sections}>{sections}</div>
      </div>
    )
  }

  return (
    <div className={styles.detail}>
      {back}
      {content}
    </div>
  )
}
