// Prints the letters NameRules counts as passing for Latin, from Unicode's confusables data.
//
//   node tools/look-alikes.mjs [path/to/confusables.txt]
//
// Without a path it downloads https://www.unicode.org/Public/security/latest/confusables.txt.
// A letter of Greek, Cyrillic or Armenian passes for Latin when its UTS #39 skeleton is the
// skeleton of a Latin letter, a digit, or a run of them that NameRules takes. Kra is left out as
// a target: no name is worth impersonating with it, and it would make Cyrillic and Greek kappa,
// which match nothing else, look-alikes. The scripts below mirror NameRules._script; change both
// together.
import fs from 'node:fs'

const LATIN = 'Latin'
const SHARED = 'shared'
const CHECKED = ['Greek', 'Cyrillic', 'Armenian']
const KRA = 0x138

const isLatinLetter = (cp) => {
  if (cp < 0x100) return cp >= 0xdf && cp !== 0xf7
  if (cp < 0x138) return cp % 2 === 1 && cp !== 0x133
  if (cp === 0x138) return true
  if (cp < 0x149) return cp % 2 === 0 && cp !== 0x140
  if (cp === 0x149) return false
  if (cp < 0x178) return cp % 2 === 1
  if (cp < 0x17f) return cp === 0x17a || cp === 0x17c || cp === 0x17e
  return cp === 0x1a1 || cp === 0x1b0 || cp === 0x219 || cp === 0x21b
}
const isCyrillicLetter = (cp) => {
  if (cp < 0x430) return false
  if (cp < 0x460) return true
  if (cp < 0x482) return cp % 2 === 1
  if (cp < 0x48b) return false
  if (cp < 0x4c0) return cp % 2 === 1
  if (cp === 0x4c0) return false
  if (cp < 0x4cf) return cp % 2 === 0
  if (cp === 0x4cf) return true
  return cp % 2 === 1
}
const script = (cp) => {
  if (cp < 0x80) {
    if (cp >= 0x61 && cp <= 0x7a) return LATIN
    if ((cp >= 0x30 && cp <= 0x39) || cp === 0x2d) return SHARED
    return null
  }
  if (cp < 0x250) return isLatinLetter(cp) ? LATIN : null
  if (cp < 0x400) return cp === 0x390 || (cp >= 0x3ac && cp <= 0x3ce) ? 'Greek' : null
  if (cp < 0x530) return isCyrillicLetter(cp) ? 'Cyrillic' : null
  if (cp < 0x590) return cp >= 0x561 && cp <= 0x586 ? 'Armenian' : null
  if (cp >= 0x1e00 && cp < 0x1f00) return cp % 2 === 1 && (cp <= 0x1e95 || (cp >= 0x1ea1 && cp <= 0x1ef9)) ? LATIN : null
  return null
}

const source = process.argv[2]
  ? fs.readFileSync(process.argv[2], 'utf8')
  : await (await fetch('https://www.unicode.org/Public/security/latest/confusables.txt')).text()
const version = source.match(/^# Version: (.+)$/m)?.[1] ?? 'unknown'
const prototypes = new Map()
for (const line of source.split('\n')) {
  const match = line.match(/^([0-9A-F]+)\s*;\s*([0-9A-F ]+?)\s*;/)
  if (match) prototypes.set(parseInt(match[1], 16), match[2].split(' ').map((hex) => String.fromCodePoint(parseInt(hex, 16))).join(''))
}
const skeleton = (text) => [...text.normalize('NFD')].map((char) => prototypes.get(char.codePointAt(0)) ?? char).join('').normalize('NFD')

const letters = []
for (let cp = 0; cp < 0x1f00; cp++) letters.push([cp, script(cp)])
const targets = new Set(letters.filter(([cp, kind]) => (kind === LATIN || kind === SHARED) && cp !== KRA).map(([cp]) => skeleton(String.fromCodePoint(cp))))
// Whether the skeleton splits into skeletons of Latin letters and digits
const spellsLatin = (text) => {
  const chars = [...text]
  const reach = [true]
  for (let end = 1; end <= chars.length; end++) {
    reach[end] = false
    for (let start = Math.max(0, end - 4); start < end && !reach[end]; start++) {
      reach[end] = reach[start] && targets.has(chars.slice(start, end).join(''))
    }
  }
  return reach[chars.length]
}

console.log(`// From confusables.txt, version ${version}`)
for (const name of CHECKED) {
  const found = letters.filter(([cp, kind]) => kind === name && spellsLatin(skeleton(String.fromCodePoint(cp)))).map(([cp]) => cp)
  console.log(`// ${name}, ${found.length}`)
  console.log(found.map((cp) => `cp == 0x${cp.toString(16)}`).join(' ||\n') + ' ||')
}
