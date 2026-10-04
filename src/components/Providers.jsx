'use client'

import { useEffect, useState } from 'react'
import { ThemeProvider } from 'next-themes'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from '@/config/wagmi'
import MiniAppBridge from '@/components/MiniAppBridge'
import NextToast from '@/components/NextToast'
import { WalletDialogProvider } from '@/components/WalletDialogProvider'

export default function Providers({ children }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      })
  )


  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem disableTransitionOnChange>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <WalletDialogProvider>{children}</WalletDialogProvider>
          <NextToast />
          <MiniAppBridge />
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  )
}
