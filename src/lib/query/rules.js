import { KIND } from '@/config/namespaces'
import { checkDigitValid, formatNumber, parseNumber } from '@/lib/query/numbers'
import { cleanName, graphemeLength, hasEmoji } from '@/lib/query/text'

// Letters and marks of any script, digits, hyphens and ZWNJ
const NAME_PATTERN = /^[\p{L}\p{M}\p{N}\u200C-]+$/u
const EDGE_PATTERN = /^[-\u200C]|[-\u200C]$/u

const invalid = (reason) => ({ valid: false, reason })

// Refused by what is sold today, a length or a check digit, which the owner can change. A name
// registered before the change keeps its label, so the registry is still asked about it
const unsold = (reason, found) => ({ valid: false, reason, checkable: true, ...found })

const checkLength = (length, { minLength, maxLength }, unit = 'characters') => {
  if (minLength && length < minLength) return `Needs at least ${minLength} ${unit}`
  if (maxLength && length > maxLength) return `Can be at most ${maxLength} ${unit}`
  return null
}

function validateName(raw, namespace) {
  const label = cleanName(raw)
  if (hasEmoji(label)) return invalid('Names can’t include emoji')
  if (!NAME_PATTERN.test(label)) return invalid('Use letters, numbers and hyphens only')
  if (EDGE_PATTERN.test(label)) return invalid('Can’t start or end with a hyphen')

  const found = { label, name: `${label}${namespace.suffix ?? ''}`, length: graphemeLength(label) }
  const lengthError = checkLength(found.length, namespace.rules)
  if (lengthError) return unsold(lengthError, found)
  return { valid: true, checkable: true, ...found }
}

function validateNumber(raw, namespace) {
  const parsed = parseNumber(raw, namespace)
  if (!parsed) return invalid('Numbers use digits only')
  const { digits } = parsed
  // The registry refuses it too: a zero in front would make a twin of the number after it
  if (digits.startsWith('0')) return invalid('A number doesn’t start with 0')
  const found = { label: digits, name: formatNumber(digits, namespace), length: digits.length }
  const lengthError = checkLength(digits.length, namespace.rules, 'digits')
  if (lengthError) return unsold(lengthError, found)
  if (!checkDigitValid(digits, namespace.rules.checkDigit)) {
    return unsold('The check digit doesn’t match. A digit may be mistyped.', found)
  }
  return { valid: true, checkable: true, ...found }
}

const VALIDATORS = {
  [KIND.NAME]: validateName,
  [KIND.NUMBER]: validateNumber,
}

/**
 * Validates one label against one namespace. `checkable` says the registry can be asked about
 * it: every valid label, and one refused only for its length or check digit, which may still be
 * held from before the namespace's rules changed. Such a label carries its `label` and `name` too.
 * @returns {{ valid: true, checkable: true, label: string, name: string, length: number } | { valid: false, reason: string, checkable?: true, label?: string, name?: string, length?: number }}
 */
export const validateLabel = (raw, namespace) => {
  const validate = VALIDATORS[namespace.kind]
  return validate ? validate(raw, namespace) : invalid('Unsupported namespace')
}
