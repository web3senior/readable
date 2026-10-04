import { KIND } from '@/config/namespaces'
import { checkDigitValid, formatNumber, parseNumber } from '@/lib/query/numbers'
import { cleanName, graphemeLength, hasEmoji } from '@/lib/query/text'

// Letters and marks of any script, digits, hyphens and ZWNJ
const NAME_PATTERN = /^[\p{L}\p{M}\p{N}\u200C-]+$/u
const EDGE_PATTERN = /^[-\u200C]|[-\u200C]$/u

const invalid = (reason) => ({ valid: false, reason })

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

  const lengthError = checkLength(graphemeLength(label), namespace.rules)
  if (lengthError) return invalid(lengthError)
  return { valid: true, label, name: `${label}${namespace.suffix ?? ''}`, length: graphemeLength(label) }
}

function validateNumber(raw, namespace) {
  const parsed = parseNumber(raw, namespace)
  if (!parsed) return invalid('Numbers use digits only')
  const { digits } = parsed
  // The registry refuses it too: a zero in front would make a twin of the number after it
  if (digits.startsWith('0')) return invalid('A number doesn’t start with 0')
  const lengthError = checkLength(digits.length, namespace.rules, 'digits')
  if (lengthError) return invalid(lengthError)
  if (!checkDigitValid(digits, namespace.rules.checkDigit)) {
    return invalid('The check digit doesn’t match. A digit may be mistyped.')
  }
  return { valid: true, label: digits, name: formatNumber(digits, namespace), length: digits.length }
}

const VALIDATORS = {
  [KIND.NAME]: validateName,
  [KIND.NUMBER]: validateNumber,
}

/**
 * Validates one label against one namespace.
 * @returns {{ valid: true, label: string, name: string, length: number } | { valid: false, reason: string }}
 */
export const validateLabel = (raw, namespace) => {
  const validate = VALIDATORS[namespace.kind]
  return validate ? validate(raw, namespace) : invalid('Unsupported namespace')
}
