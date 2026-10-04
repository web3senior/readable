/** Display formatting. Native Intl only. */

import { formatUnits } from 'viem'

// An amount of ETH is mostly a fraction, so below one it keeps its first few significant digits
const coinFormat = (amount, locale) =>
  new Intl.NumberFormat(locale, Math.abs(amount) >= 1 ? { maximumFractionDigits: 4 } : { maximumSignificantDigits: 4 }).format(amount)

export const formatPrice = (amount, currency, locale) => {
  if (Number(amount) === 0) return 'Free'
  return `${coinFormat(Number(amount), locale)} ${currency}`
}

/** An onchain amount in base units (wei), in the coin names are paid in. */
export const formatAmount = (value, currency, locale) =>
  formatPrice(formatUnits(BigInt(value ?? 0), currency.decimals), currency.symbol, locale)

/** A balance in base units; unlike a price, zero is "0", not "Free". */
export const formatBalance = (value, currency, locale) => {
  return `${coinFormat(Number(formatUnits(BigInt(value ?? 0), currency.decimals)), locale)} ${currency.symbol}`
}

/** Dollars as the reader's locale writes them: with cents below a hundred, whole dollars above. */
export const formatUsd = (amount, locale) => {
  const digits = amount >= 100 ? 0 : 2
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount)
}

/** A plain count, grouped the way the reader's locale groups it. */
export const formatCount = (value, locale) => new Intl.NumberFormat(locale).format(value)

export const formatYears = (years, locale) =>
  new Intl.NumberFormat(locale, { style: 'unit', unit: 'year', unitDisplay: 'long' }).format(years)

export const formatDate = (ms, locale) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(ms))

/** A calendar day stored as `1990-05-14`, written out the same wherever the reader is. */
export const formatDay = (isoDay, locale) =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${isoDay}T00:00:00Z`))

export const formatDays = (days, locale) =>
  new Intl.NumberFormat(locale, { style: 'unit', unit: 'day', unitDisplay: 'long' }).format(days)

/** A fraction (0.1) as a percentage ("10%"). */
export const formatPercent = (fraction, locale) =>
  new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(fraction)

const RELATIVE_UNITS = [
  ['year', 31_536_000_000],
  ['month', 2_592_000_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
  ['second', 1000],
]

/** "in 3 months", "2 days ago", with the unit picked for the distance. */
export const formatRelative = (ms, now, locale) => {
  const delta = ms - now
  if (!Number.isFinite(delta)) return ''
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(delta) >= size || unit === 'second') return rtf.format(Math.round(delta / size), unit)
  }
  return ''
}

// A short distance counts weeks instead of months, whose narrow form ("4m") reads as minutes
const SHORT_UNITS = [
  ['year', 31_536_000_000],
  ['week', 604_800_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
  ['second', 1000],
]

/** How long ago, in the fewest characters: "4m", "20h", "3d", "6w", "1y". */
export const formatAgo = (ms, now, locale) => {
  const delta = Math.max(0, now - ms)
  if (!Number.isFinite(delta)) return ''
  const [unit, size] = SHORT_UNITS.find(([, length]) => delta >= length) ?? SHORT_UNITS.at(-1)
  return new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'narrow' }).format(Math.floor(delta / size))
}

/** 0x1234…cdef. */
export const truncateAddress = (address, lead = 6, tail = 4) => {
  const value = String(address ?? '')
  return value.length > lead + tail + 1 ? `${value.slice(0, lead)}…${value.slice(-tail)}` : value
}
