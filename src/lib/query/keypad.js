import { luhnCheckDigit } from '@/lib/query/numbers'

// The letters on each key of a phone's keypad
const KEYS = { 2: 'abc', 3: 'def', 4: 'ghi', 5: 'jkl', 6: 'mno', 7: 'pqrs', 8: 'tuv', 9: 'wxyz' }
const DIGIT_OF = Object.fromEntries(Object.entries(KEYS).flatMap(([digit, letters]) => Array.from(letters, (letter) => [letter, digit])))

// What people put between the parts of a vanity number: 1-800-FLOWERS
const SEPARATORS = /[\s-]/g

/**
 * The digits a word dials on a phone keypad, `crypto` → `279786`, or null when it isn't a
 * keypad word: Latin letters and digits only, with a letter among them.
 */
export function keypadDigits(word) {
  const text = String(word ?? '').toLowerCase().replace(SEPARATORS, '')
  if (!/^[a-z0-9]+$/.test(text) || !/[a-z]/.test(text)) return null
  return Array.from(text, (character) => DIGIT_OF[character] ?? character).join('')
}

/**
 * The number a word stands for in a number namespace: its keypad digits, and the check digit
 * after them where a number that long needs one. Null when the word isn't a keypad word.
 */
export function keypadNumber(word, namespace) {
  const digits = keypadDigits(word)
  if (!digits) return null
  const { checkDigit } = namespace.rules
  // A word as long as a checked number gets its check digit after it, never in place of a letter
  const checked = checkDigit?.algorithm === 'luhn' && digits.length >= checkDigit.fromLength
  return checked ? `${digits}${luhnCheckDigit(digits)}` : digits
}
