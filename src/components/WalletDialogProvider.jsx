'use client'

import { createContext, useCallback, useContext, useRef } from 'react'
import WalletDialog from '@/components/WalletDialog'

const WalletDialogContext = createContext(() => {})

/** One wallet picker for the whole app; anything that needs a wallet opens it through the hook. */
export function WalletDialogProvider({ children }) {
  const dialogRef = useRef(null)
  const open = useCallback(() => dialogRef.current?.open(), [])

  return (
    <WalletDialogContext value={open}>
      {children}
      <WalletDialog ref={dialogRef} />
    </WalletDialogContext>
  )
}

export const useWalletDialog = () => useContext(WalletDialogContext)
