'use client'

import { createContext, useCallback, useContext, useEffect, useRef } from 'react'
import { useConnection, useDisconnect } from 'wagmi'
import WalletDialog from '@/components/WalletDialog'
import { isHiddenWallet } from '@/config/wallets'

const WalletDialogContext = createContext(() => {})

/** One wallet picker for the whole app; anything that needs a wallet opens it through the hook. */
export function WalletDialogProvider({ children }) {
  const dialogRef = useRef(null)
  const open = useCallback(() => dialogRef.current?.open(), [])
  const { connector } = useConnection()
  const { mutate: disconnect } = useDisconnect()

  // A wallet the picker leaves out, connected before it did, is let go rather than reconnected
  useEffect(() => {
    if (connector && isHiddenWallet(connector)) disconnect({ connector })
  }, [connector, disconnect])

  return (
    <WalletDialogContext value={open}>
      {children}
      <WalletDialog ref={dialogRef} />
    </WalletDialogContext>
  )
}

export const useWalletDialog = () => useContext(WalletDialogContext)
