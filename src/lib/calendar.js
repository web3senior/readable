import { site } from '@/config/site'

/**
 * Calendar files (RFC 5545) the visitor saves and opens in any calendar: a reminder that lives in
 * their own calendar, so the site keeps no address and sends nothing.
 */

const DAY = 86_400_000
const CRLF = '\r\n'
// A line longer than this is folded onto the next one, which starts with a space
const LINE_LIMIT = 74

const escapeText = (value) => String(value).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

const fold = (line) => {
  const characters = Array.from(line)
  const lines = []
  for (let start = 0; start < characters.length; start += LINE_LIMIT) lines.push(characters.slice(start, start + LINE_LIMIT).join(''))
  return lines.join(`${CRLF} `)
}

const pad = (value) => String(value).padStart(2, '0')

// The day in the visitor's own calendar, as an all-day event takes it
const localDate = (ms) => {
  const date = new Date(ms)
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

const utcStamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

const host = () => {
  try {
    return new URL(site.baseUrl).host
  } catch {
    return 'readable.name'
  }
}

/**
 * One all-day event with an alert in its morning.
 * @param {{ id: string, at: number, title: string, body: string, link: string }} event
 */
const vevent = ({ id, at, title, body, link }) => [
  'BEGIN:VEVENT',
  `UID:${id}@${host()}`,
  `DTSTAMP:${utcStamp(Date.now())}`,
  `DTSTART;VALUE=DATE:${localDate(at)}`,
  `DTEND;VALUE=DATE:${localDate(at + DAY)}`,
  `SUMMARY:${escapeText(title)}`,
  `DESCRIPTION:${escapeText(body)}`,
  `URL:${link}`,
  'BEGIN:VALARM',
  'ACTION:DISPLAY',
  `DESCRIPTION:${escapeText(title)}`,
  `TRIGGER:PT${site.reminders.alarmHour}H`,
  'END:VALARM',
  'END:VEVENT',
]

/** The text of a calendar holding `events`. */
export const calendarText = (events) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${site.name}//Reminders//EN`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', ...events.flatMap(vevent), 'END:VCALENDAR']
    .map(fold)
    .join(CRLF)

const fill = (template, values) => Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template)

/**
 * Reminders to renew `name` before `expiresAt`, one for each of `reminders.renew.daysBefore`
 * that is still ahead of `now`. `link` is the name's page.
 */
export function renewalEvents({ name, slug, expiresAt, link, now }, formatDate) {
  const copy = site.reminders.renew
  const values = { name, date: formatDate(expiresAt), link }
  return copy.daysBefore
    .map((days) => ({ id: `renew-${slug}-${days}`, at: expiresAt - days * DAY, title: fill(copy.title, values), body: fill(copy.body, values), link }))
    .filter((event) => event.at > now)
}

/** The day a name returns to the public unless its holder renews it. */
export function releaseEvent({ name, slug, releasedAt, link }, formatDate) {
  const copy = site.reminders.release
  const values = { name, date: formatDate(releasedAt), link }
  return { id: `release-${slug}`, at: releasedAt, title: fill(copy.title, values), body: fill(copy.body, values), link }
}

/** Hands the visitor a calendar file to open or save. */
export function downloadCalendar(fileName, events) {
  const url = URL.createObjectURL(new Blob([calendarText(events)], { type: 'text/calendar;charset=utf-8' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: `${fileName}.ics` })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
