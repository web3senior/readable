import { site } from '@/config/site'

/** Brings the search field into view and puts the cursor in it, for a call to action elsewhere on the page. */
export function focusSearch() {
  const input = document.getElementById(site.search.inputId)
  if (!input) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  input.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
  input.focus({ preventScroll: true })
}
