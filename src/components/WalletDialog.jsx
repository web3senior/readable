'use client'

import { forwardRef, useId, useImperativeHandle, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { useConnect, useConnectors } from 'wagmi'
import { CaretRightIcon, QrCodeIcon, WalletIcon } from '@phosphor-icons/react'
import DialogSheet from '@/components/ui/DialogSheet'
import EmptyState from '@/components/ui/EmptyState'
import { Spinner } from '@/components/Loading'
import { toast } from '@/components/NextToast'
import { site } from '@/config/site'
import { CONNECTOR_TYPES, GENERIC_INJECTED_ID } from '@/config/wallets'
import { themeWalletConnect } from '@/lib/walletConnectTheme'
import styles from './WalletDialog.module.scss'

const copy = site.wallet

// wagmi's message once WalletConnect has a pairing link to show
const LINK_READY = 'display_uri'

const isGeneric = (connector) => connector.id === GENERIC_INJECTED_ID

// Announced over EIP-6963, so provably installed
const isDetected = (connector) => connector.type === CONNECTOR_TYPES.injected && !isGeneric(connector)

// WalletConnect draws its own sheet in the page, underneath anything in the top layer
const bringsOwnSheet = (connector) => connector.type === CONNECTOR_TYPES.walletConnect

// Installed wallets lead. The generic connector stands in for a provider that never announced
// itself, and is left out where there is none to reach (a phone browser)
const visibleWallets = (connectors) => {
  const detected = connectors.filter(isDetected)
  const showGeneric = detected.length === 0 && Boolean(window.ethereum)
  const others = connectors.filter((connector) => !isDetected(connector) && (!isGeneric(connector) || showGeneric))
  return [...detected, ...others]
}

// Closing WalletConnect's sheet reads as a rejection; it is a change of mind, not a failure
const SHEET_CLOSED = /connection request reset/i
const closedOwnSheet = (error) => SHEET_CLOSED.test(error?.cause?.message ?? '')

const connectError = (error) =>
  error?.name === 'UserRejectedRequestError' ? copy.errors.rejected : (error?.shortMessage ?? copy.errors.failed)

const walletName = (connector) => (isGeneric(connector) ? copy.genericName : connector.name)

function WalletMeta({ connector, pending }) {
  if (pending) return <Spinner size={16} label={copy.connecting} />
  if (isDetected(connector)) return copy.detected
  if (bringsOwnSheet(connector)) return <QrCodeIcon size={18} aria-hidden="true" />
  return <CaretRightIcon size={16} aria-hidden="true" />
}

const WalletDialog = forwardRef(function WalletDialog(_, ref) {
  const titleId = useId()
  const dialogRef = useRef(null)
  // The list renders from the first open on: connectors exist in the browser alone
  const [hasOpened, setHasOpened] = useState(false)
  const connectors = useConnectors()
  const { mutate: connect, isPending, variables } = useConnect()
  const { resolvedTheme } = useTheme()

  const close = () => dialogRef.current?.close()

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        setHasOpened(true)
        dialogRef.current?.open()
      },
      close: () => dialogRef.current?.close(),
    }),
    []
  )

  const handleConnect = (connector) =>
    connect(
      { connector },
      {
        onSuccess: close,
        onError: (error) => toast(connectError(error), 'error'),
      }
    )

  // The chooser steps aside, and a toast covers the wait until the other sheet has its link
  const handleOwnSheet = async (connector) => {
    close()
    const opening = toast(`${copy.opening} ${connector.name}`, 'loading')
    const handleMessage = ({ type }) => type === LINK_READY && opening.dismiss()
    connector.emitter.on('message', handleMessage)
    await themeWalletConnect(connector, resolvedTheme)
    connect(
      { connector },
      {
        onError: (error) => closedOwnSheet(error) || toast(connectError(error), 'error'),
        onSettled: () => {
          connector.emitter.off('message', handleMessage)
          opening.dismiss()
        },
      }
    )
  }

  const wallets = hasOpened ? visibleWallets(connectors) : []

  return (
    <DialogSheet ref={dialogRef} lightDismiss aria-labelledby={titleId}>
      {hasOpened && (
        <>
          <DialogSheet.Header id={titleId} title={copy.title} closeLabel={copy.close} onClose={close} />

          <DialogSheet.Body>
            {wallets.length > 0 ? (
              <DialogSheet.Group>
                {wallets.map((connector) => (
                  <DialogSheet.Row
                    key={connector.uid}
                    icon={
                      connector.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element -- wallets announce their icon as a data URI
                        <img src={connector.icon} alt="" />
                      ) : (
                        <WalletIcon size={20} aria-hidden="true" />
                      )
                    }
                    name={walletName(connector)}
                    hint={copy.hints[connector.type]}
                    meta={<WalletMeta connector={connector} pending={isPending && variables?.connector?.uid === connector.uid} />}
                    onClick={() => (bringsOwnSheet(connector) ? handleOwnSheet(connector) : handleConnect(connector))}
                    disabled={isPending}
                  />
                ))}
              </DialogSheet.Group>
            ) : (
              <EmptyState align="center" icon={WalletIcon} className={styles.wallet__empty}>
                {copy.empty}
              </EmptyState>
            )}
          </DialogSheet.Body>

          <DialogSheet.Footer>
            {copy.footnote}{' '}
            <a href={copy.helpUrl} target="_blank" rel="noopener noreferrer">
              {copy.findWallet}
            </a>
          </DialogSheet.Footer>
        </>
      )}
    </DialogSheet>
  )
})

export default WalletDialog
