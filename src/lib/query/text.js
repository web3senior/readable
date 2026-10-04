const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null

/** Splits into user-perceived characters, so a letter with its mark is one. */
export const graphemes = (value) => (segmenter ? Array.from(segmenter.segment(value), (part) => part.segment) : Array.from(value))

export const graphemeLength = (value) => graphemes(value).length

// What reads as an emoji, named here for the sake of a clear message. The name rules refuse these
// with everything else that is no letter, and have the last word
const EMOJI = /[\u00A9\u00AE\u203C\u2049\u20E3\u2122\u2139\u2194-\u21AA\u231A-\u23FF\u24C2\u25AA-\u25FE\u2600-\u27BF\u2934-\u2935\u2B05-\u2B55\u3030\u303D\u3297\u3299\uFE0F\u{1F000}-\u{1FAFF}]/u

export const hasEmoji = (value) => EMOJI.test(value)

const inRanges = (ranges) => (codePoint) => ranges.some(([from, to = from]) => codePoint >= from && codePoint <= to)

// The Arabic script as NameRules.sol lists it; change both together
const isArabicLetter = inRanges([
  [0x620, 0x63f], [0x641, 0x64a], [0x66e, 0x66f], [0x671, 0x674], [0x679, 0x6d3], [0x6d5], [0x6ee, 0x6ef], [0x6fa, 0x6fc], [0x6ff], [0x750, 0x77f],
])
// Letters that join the one before them and never the one after: alef, dal, reh, waw and their kin
const joinsBackOnly = inRanges([
  [0x622, 0x625], [0x627], [0x629], [0x62f, 0x632], [0x648], [0x671, 0x673], [0x688, 0x699], [0x6c0], [0x6c3, 0x6cb],
  [0x6cd], [0x6cf], [0x6d2, 0x6d3], [0x6d5], [0x6ee, 0x6ef], [0x759, 0x75b], [0x76b, 0x76c], [0x771], [0x773, 0x774], [0x778, 0x779],
])
// The hamza and the high hamza
const joinsNothing = inRanges([[0x621], [0x674]])
const joinsPrevious = (codePoint) => isArabicLetter(codePoint) && !joinsNothing(codePoint)
const joinsNext = (codePoint) => joinsPrevious(codePoint) && !joinsBackOnly(codePoint)

const ZWNJ = 0x200c
// What a keyboard adds and a reader never sees: the zero width joiner, the tatweel that stretches
// a word, the variation selectors
const isIdle = inRanges([[0x200d], [0x640], [0xfe00, 0xfe0f]])

/**
 * A name as the registry stores it: lowercase, its digits ASCII, and nothing invisible in it
 * but the joiner where it shows, between an Arabic letter that would join the next and that
 * letter. Two spellings a reader can't tell apart become one name here, before they are sent.
 */
export const cleanName = (value) => {
  const points = Array.from(toAsciiDigits(value.toLowerCase()), (char) => char.codePointAt(0)).filter((codePoint) => !isIdle(codePoint))
  const kept = points.filter((codePoint, index) => codePoint !== ZWNJ || (joinsNext(points[index - 1]) && joinsPrevious(points[index + 1])))
  return String.fromCodePoint(...kept)
}

// Arabic-Indic, Extended Arabic-Indic (Persian) and full-width digit blocks, each 0–9 in order
const DIGIT_BLOCK_STARTS = [0x0660, 0x06f0, 0xff10]

export const toAsciiDigits = (value) =>
  value.replace(/[\u0660-\u0669\u06F0-\u06F9\uFF10-\uFF19]/g, (char) => {
    const code = char.charCodeAt(0)
    const start = DIGIT_BLOCK_STARTS.find((blockStart) => code >= blockStart && code <= blockStart + 9)
    return String(code - start)
  })

// NFC composes without touching ZWNJ, which carries meaning in Persian and other scripts
export const normalizeText = (value) => String(value ?? '').normalize('NFC').trim()
