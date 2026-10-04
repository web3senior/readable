'use client'

import { site } from '@/config/site'

/**
 * The app the site is running inside, when it runs as a mini app: Hup, which embeds it in a post
 * and lends it the viewer's Hup wallet. Null on its own page, where nothing changes.
 */

const { hup } = site.miniApp
const SCRIPT_TIMEOUT_MS = 8000

// The page that framed this one, as far as the browser tells it
const parentOrigin = () => {
  const ancestors = window.location.ancestorOrigins
  if (ancestors?.length) return ancestors[0]
  try {
    return document.referrer ? new URL(document.referrer).origin : null
  } catch {
    return null
  }
}

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const script = Object.assign(document.createElement('script'), { src, async: true, onload: resolve, onerror: reject })
    document.head.append(script)
    setTimeout(() => reject(new Error('The host SDK did not load')), SCRIPT_TIMEOUT_MS)
  })

// Hup's SDK is a script of its own; it answers ready() only inside a Hup post
async function hupHost() {
  if (!hup.origins.includes(parentOrigin())) return null
  await loadScript(hup.sdk)
  await window.hup.ready()
  return { id: 'hup', name: 'Hup', provider: await window.hup.getProvider() }
}

/** The host and its wallet provider, or null when the site isn't framed by one. */
export async function findMiniAppHost() {
  const framed = window.parent !== window || Boolean(window.ReactNativeWebView)
  if (!framed) return null
  return hupHost().catch(() => null)
}
