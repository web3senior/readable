'use client'

import { useMemo, useRef, useState } from 'react'
import { useConnection } from 'wagmi'
import { Rise } from 'cube-motion/react'
import { CloudSlashIcon, MagnifyingGlassIcon, PlugsIcon, WalletIcon } from '@phosphor-icons/react'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import Shimmer from '@/components/ui/Shimmer'
import ActionDialog from '@/components/admin/ActionDialog'
import NameCard from '@/components/names/NameCard'
import { transferSpec } from '@/components/names/specs'
import { useWalletDialog } from '@/components/WalletDialogProvider'
import { registry, registryEnabled } from '@/config/registry'
import { site } from '@/config/site'
import useIsClient from '@/hooks/useIsClient'
import useMyNames from '@/hooks/useMyNames'
import { sendAdmin, trackAdmin } from '@/lib/adminActions'
import { displayName, toNamespace } from '@/lib/namespaces'
import styles from './MyNames.module.scss'

const SKELETON_CARDS = 2
const { gates } = site.names

/** The connected wallet's names, each a card that links to its page, with Renew and Transfer at hand. */
export default function MyNames() {
  const isClient = useIsClient()
  const { address, isConnected } = useConnection()
  const openWalletDialog = useWalletDialog()
  const account = isClient && isConnected ? address : undefined
  const { data, isPending, isError, refetch, refresh } = useMyNames(account)
  const transferRef = useRef(null)
  // Fixed for the visit, so a card doesn't flip to expired between two renders
  const [now] = useState(() => Date.now())

  const names = useMemo(
    () =>
      (data?.names ?? [])
        .filter((name) => name.source)
        .map((name) => {
          const namespace = toNamespace(name.source, { chainId: registry.chainId, currency: data.currency })
          return { ...name, namespace, display: displayName(namespace, name.label) }
        })
        .sort((a, b) => a.expiresAt - b.expiresAt),
    [data]
  )

  // Resolves once the wallet signs; the toast carries the transaction and the list drops the name on success
  const perform = async ({ functionName, args, pending, done }) => {
    const sent = await sendAdmin(functionName, args)
    trackAdmin(sent, { pending, done }).then((success) => success && refresh())
  }
  const openTransfer = (name) => transferRef.current?.open(transferSpec({ name, account, perform }))

  if (!registryEnabled) {
    return (
      <EmptyState size="lg" align="center" icon={PlugsIcon}>
        {gates.unconfigured}
      </EmptyState>
    )
  }
  if (!account) {
    return (
      <EmptyState
        size="lg"
        align="center"
        icon={WalletIcon}
        action={
          <Button size="sm" onClick={openWalletDialog}>
            {site.wallet.connect}
          </Button>
        }
      >
        {gates.disconnected}
      </EmptyState>
    )
  }
  if (isError) {
    return (
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
  }
  if (isPending) {
    return (
      <div className={styles.names__grid}>
        {Array.from({ length: SKELETON_CARDS }, (_, index) => (
          <Shimmer key={index} className={styles.names__skeleton} label="Loading your names" />
        ))}
      </div>
    )
  }
  if (names.length === 0) {
    return (
      <EmptyState
        size="lg"
        align="center"
        icon={MagnifyingGlassIcon}
        action={
          <Button variant="link" size="sm" href="/">
            {site.names.find}
          </Button>
        }
      >
        {gates.empty}
      </EmptyState>
    )
  }

  return (
    <div className={styles.names}>
      <Rise as="ul" targets="children" className={styles.names__grid}>
        {names.map((name) => (
          <li key={String(name.tokenId)}>
            <NameCard
              name={name}
              account={account}
              currency={data.currency}
              now={now}
              onTransfer={openTransfer}
            />
          </li>
        ))}
      </Rise>
      <ActionDialog ref={transferRef} />
    </div>
  )
}
