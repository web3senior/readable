import { site } from '@/config/site'

const { queryParam } = site.search

/** The path that opens the site on `query`, which is what a shared link ends in: `/?q=4242`. */
export const searchPath = (query) => {
  const trimmed = String(query ?? '').trim()
  return trimmed ? `/?${new URLSearchParams({ [queryParam]: trimmed })}` : '/'
}

export const searchLink = (query) => `${site.baseUrl}${searchPath(query)}`

/** `url` with its search set to `query`, or cleared when `query` is empty. */
export const withSearch = (url, query) => {
  const next = new URL(url)
  const trimmed = String(query ?? '').trim()
  if (trimmed) next.searchParams.set(queryParam, trimmed)
  else next.searchParams.delete(queryParam)
  return next
}

/**
 * The search a link from before 2026-10-03 carried after # (`/#4242`), or '' when there is
 * none. Such links still open, and the address is rewritten to the search parameter.
 */
export const readLegacyHash = () => {
  try {
    return decodeURIComponent(window.location.hash.slice(1)).trim()
  } catch {
    return ''
  }
}
