import { toAsciiDigits } from '@/lib/query/text'

// Separators people type inside phone numbers
const SEPARATORS = /[\s\-().\u00A0]/g

/** Strips separators and converts non-ASCII digits. Returns '' when anything else remains. */
export const compactNumber = (raw) => {
  const compact = toAsciiDigits(raw).replace(SEPARATORS, '')
  return /^\+?\d+$/.test(compact) ? compact : ''
}

export const looksLikeNumber = (raw) => compactNumber(raw) !== ''

/**
 * The digits a number namespace stores. A leading `+` marks the namespace prefix as typed, so
 * `+0 4242` and `4242` are the same number. A number never starts with 0, so a bare `04242` is
 * that number too, its prefix written without the plus, the way many countries write a local number.
 * @returns {{ digits: string, explicit: boolean } | null}
 */
export const parseNumber = (raw, namespace) => {
  const compact = compactNumber(raw)
  if (!compact) return null
  const explicit = compact.startsWith('+')
  let digits = explicit ? compact.slice(1) : compact
  const prefixDigits = (namespace.prefix ?? '').replace(/\D/g, '')
  const prefixed = explicit || prefixDigits.startsWith('0')
  if (prefixed && prefixDigits && digits.startsWith(prefixDigits) && digits.length > prefixDigits.length) {
    digits = digits.slice(prefixDigits.length)
  }
  return { digits, explicit }
}

export const luhnValid = (digits) => {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

/** The digit that, put after `payload`, makes the number pass `luhnValid`. */
export const luhnCheckDigit = (payload) => {
  for (let digit = 0; digit < 10; digit++) {
    if (luhnValid(`${payload}${digit}`)) return String(digit)
  }
}

const CHECKS = { luhn: luhnValid }

export const checkDigitValid = (digits, checkDigit) => {
  if (!checkDigit || digits.length < checkDigit.fromLength) return true
  const check = CHECKS[checkDigit.algorithm]
  return check ? check(digits) : true
}

const randomDigit = (from = 0) => String(from + Math.floor(Math.random() * (10 - from)))

/**
 * A random number of `length` digits that the namespace takes. It never starts with 0, which
 * would read as part of the `+0` prefix, and ends in its check digit where one is due.
 */
export const randomNumber = (length, namespace) => {
  const { checkDigit } = namespace.rules
  const checked = checkDigit?.algorithm === 'luhn' && length >= checkDigit.fromLength
  let digits = randomDigit(1)
  while (digits.length < length - (checked ? 1 : 0)) digits += randomDigit()
  return checked ? `${digits}${luhnCheckDigit(digits)}` : digits
}

/**
 * `+0 42421230`: the namespace prefix, a space, then the digits unbroken. Groups split one
 * number into what looked like several.
 */
export const formatNumber = (digits, namespace) => [namespace.prefix, digits].filter(Boolean).join(' ')
