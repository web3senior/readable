'use client'

import { useRef } from 'react'
import { useConnection } from 'wagmi'
import { isAddressEqual } from 'viem'
import { Rise } from 'cube-motion/react'
import { CloudSlashIcon, PlugsIcon, PlusIcon, WarningCircleIcon } from '@phosphor-icons/react'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import Shimmer from '@/components/ui/Shimmer'
import { useWalletDialog } from '@/components/WalletDialogProvider'
import ActionDialog from '@/components/admin/ActionDialog'
import CheckoutPanel from '@/components/admin/CheckoutPanel'
import RegistryPanel from '@/components/admin/RegistryPanel'
import SetupGuide from '@/components/admin/SetupGuide'
import NamespaceCard from '@/components/admin/NamespaceCard'
import { addNamespaceSpec } from '@/components/admin/specs'
import { registry, registryEnabled } from '@/config/registry'
import { site } from '@/config/site'
import useIsClient from '@/hooks/useIsClient'
import useRegistryAdmin from '@/hooks/useRegistryAdmin'
import useReservations from '@/hooks/useReservations'
import { sendAdmin, trackAdmin } from '@/lib/adminActions'
import { toNamespace } from '@/lib/namespaces'
import styles from './AdminConsole.module.scss'

const SKELETON_CARDS = 2

const sameAddress = (a, b) => Boolean(a && b) && isAddressEqual(a, b)

/** The owner's view of the registry: what is left to set up, settings and one card per namespace, every action in one dialog. */
export default function AdminConsole() {
  const isClient = useIsClient()
  const { address, isConnected } = useConnection()
  const openWalletDialog = useWalletDialog()
  const { data, isPending, isError, refetch, refresh } = useRegistryAdmin()
  const reservations = useReservations()
  const dialogRef = useRef(null)

  if (!registryEnabled) {
    return (
      <EmptyState size="lg" align="center" icon={PlugsIcon}>
        {site.admin.gates.unconfigured}
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
          <Button variant="link" onClick={() => refetch()}>
            Try again
          </Button>
        }
      >
        {site.admin.gates.unreachable}
      </EmptyState>
    )
  }
  if (isPending || !data) {
    return (
      <div className={styles.console}>
        <Shimmer className={styles.console__skeleton} label="Loading registry" />
        <div className={styles.console__grid}>
          {Array.from({ length: SKELETON_CARDS }, (_, index) => (
            <Shimmer key={index} className={styles.console__skeleton} label="Loading namespaces" />
          ))}
        </div>
      </div>
    )
  }

  const isOwner = isClient && isConnected && sameAddress(address, data.owner)
  const gate = !isClient || !isConnected ? 'disconnected' : !isOwner ? 'notOwner' : null

  const act = (spec) => dialogRef.current?.open(spec)

  // Resolves once the wallet signs; the toast carries the transaction and refreshes on success
  const perform = async ({ functionName, args, pending, done }) => {
    const sent = await sendAdmin(functionName, args)
    trackAdmin(sent, { pending, done }).then((success) => success && refresh())
  }

  const context = { currency: data.currency, nameRules: data.nameRules, perform, account: address }

  return (
    <div className={styles.console}>
      {gate && (
        <div className={styles.console__banner} role="status">
          <WarningCircleIcon size={18} aria-hidden="true" />
          <span className={styles.console__gate}>{site.admin.gates[gate]}</span>
          {gate === 'disconnected' && (
            <Button size="sm" onClick={openWalletDialog}>
              Connect wallet
            </Button>
          )}
        </div>
      )}

      <SetupGuide data={data} canAct={isOwner} onAction={act} context={context} />

      <RegistryPanel data={data} canAct={isOwner} onAction={act} context={context} />

      <CheckoutPanel data={data} />

      <section className={styles.console__section} aria-labelledby="admin-namespaces">
        <header className={styles.console__heading}>
          <h2 id="admin-namespaces" className={styles.console__title}>
            Namespaces
          </h2>
          <Button size="sm" icon={<PlusIcon size={14} weight="bold" />} disabled={!isOwner} onClick={() => act(addNamespaceSpec(context))}>
            Add namespace
          </Button>
        </header>

        {data.namespaces.length ? (
          <Rise as="ul" targets="children" className={styles.console__grid}>
            {data.namespaces.map((source) => (
              <li key={String(source.id)}>
                <NamespaceCard
                  source={source}
                  namespace={toNamespace(source, { chainId: registry.chainId, currency: data.currency })}
                  reserved={{
                    labels: reservations.data?.[String(source.id)] ?? [],
                    isPending: reservations.isPending,
                    isError: reservations.isError,
                  }}
                  canAct={isOwner}
                  onAction={act}
                  context={context}
                />
              </li>
            ))}
          </Rise>
        ) : (
          <EmptyState icon={PlusIcon}>No namespaces yet. Add the first one.</EmptyState>
        )}
      </section>

      <ActionDialog ref={dialogRef} />
    </div>
  )
}
