const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/**
 * Dresses WalletConnect's own sheet in the site's theme. The sheet is built once, before the
 * visitor can change theme, so it is restyled each time it is about to open.
 * @param {'light'|'dark'} themeMode
 */
export async function themeWalletConnect(connector, themeMode) {
  const provider = await connector.getProvider().catch(() => null)
  const modal = provider?.modal
  if (!modal) return
  modal.setThemeMode?.(themeMode)
  modal.setThemeVariables?.({
    '--w3m-accent': token('--color-accent-text'),
    '--w3m-font-family': token('--font-sans'),
  })
}
