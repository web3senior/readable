'use client'

import { useConnection, useDisconnect } from 'wagmi'
import { CaretDownIcon, IdentificationCardIcon, SignOutIcon, WalletIcon } from '@phosphor-icons/react'
import NativePopover from '@/components/ui/NativePopover'
import Button from '@/components/ui/Button'
import CopyButton from '@/components/ui/CopyButton'
import AddressAvatar from '@/components/ui/AddressAvatar'
import { useWalletDialog } from '@/components/WalletDialogProvider'
import useIsClient from '@/hooks/useIsClient'
import { site } from '@/config/site'
import { truncateAddress } from '@/lib/format'
import styles from './ConnectButton.module.scss'

const copy = site.wallet

export default function ConnectButton() {
  const isClient = useIsClient()
  const openWalletDialog = useWalletDialog()
  const { address, isConnected, connector } = useConnection()
  const { mutate: disconnect } = useDisconnect()

  if (isClient && isConnected && address) {
    return (
      <NativePopover
        placement="bottom-end"
        className={styles.menu}
        trigger={
          <button className={styles.account} aria-label={copy.account}>
            <AddressAvatar address={address} size="sm" />
            <span className={styles.account__label}>{truncateAddress(address)}</span>
            <CaretDownIcon size={14} weight="bold" aria-hidden="true" />
          </button>
        }
      >
        {({ close }) => (
          <div className={styles.menu__body}>
            <div className={styles.menu__identity}>
              <AddressAvatar address={address} />
              <p className={styles.menu__address}>{truncateAddress(address, 8, 6)}</p>
              <CopyButton value={address} title={copy.copyAddress} />
            </div>
            <p className={styles.menu__connector}>{copy.connectedWith} {connector?.name ?? copy.unknownConnector}</p>
            <Button variant="secondary" size="sm" block icon={<IdentificationCardIcon size={16} />} href={site.names.path} onClick={close}>
              {site.names.title}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              block
              icon={<SignOutIcon size={16} />}
              onClick={() => {
                close()
                disconnect()
              }}
            >
              {copy.disconnect}
            </Button>
          </div>
        )}
      </NativePopover>
    )
  }

  return (
    <Button aria-label={copy.connect} className={styles.connect} icon={<WalletIcon size={18} weight="bold" />} onClick={openWalletDialog}>
      <span className={styles.connect__label}>{copy.connect}</span>
    </Button>
  )
}
