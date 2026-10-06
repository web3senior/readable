import { createHash, timingSafeEqual } from 'node:crypto'
import { formatUnits, isAddressEqual, zeroAddress } from 'viem'
import { chainNameFor } from '@/config/chains'
import { registry, registryEnabled } from '@/config/registry'
import { site } from '@/config/site'
import { readAgents } from '@/lib/agents'
import { readable } from '@/lib/api'
import { readEthUsd } from '@/lib/ethUsd'
import { formatAmount, formatDate, formatUsd, truncateAddress } from '@/lib/format'
import { namePath, toNamespace } from '@/lib/namespaces'
import { lookupCandidate } from '@/lib/providers'
import { parseQuery } from '@/lib/query/parse'
import { readField } from '@/lib/records'
import { readRegistry } from '@/lib/registry'
import { countHit, waitFor } from '@/lib/relayer'
import { searchLink } from '@/lib/searchLink'
import { tokenBoundAccountOf } from '@/lib/tokenBound'

/**
 * The Telegram bot. Each update Telegram posts is answered with one Bot API call, sent back as
 * the webhook's reply, so the bot keeps no state and makes no call of its own. It only reads:
 * nothing it answers moves money, and every button opens the site, where the wallet signs.
 */

const { telegram } = site
const fill = (text, values) => Object.entries(values).reduce((out, [key, value]) => out.replaceAll(`{${key}}`, value), text)
const link = (path) => `${site.baseUrl}${path}`

// Telegram's HTML asks for &, < and > to be escaped, and the quote inside a link's address
const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

const token = () => process.env.TELEGRAM_BOT_TOKEN || null

/** Whether this server runs the bot: it holds the bot's token. */
export const telegramEnabled = () => Boolean(token())

// The secret Telegram sends with each update, set with the webhook. Derived from the token, so
// there is no second value to keep; scripts/telegram.mjs derives it the same way
const secretOf = (botToken) => createHash('sha256').update(`readable-telegram-webhook:${botToken}`).digest('hex')

/** Whether a request carries the webhook's secret, so it came from Telegram. */
export function fromTelegram(request) {
  const sent = Buffer.from(request.headers.get('x-telegram-bot-api-secret-token') ?? '')
  const expected = Buffer.from(secretOf(token()))
  return sent.length === expected.length && timingSafeEqual(sent, expected)
}

/** What scripts/telegram.mjs sets on the bot: its menu and descriptions. Nothing secret. */
export const botProfile = () => ({
  enabled: telegramEnabled(),
  // The token's first part, public like the username: tells which bot this server answers for
  botId: token()?.split(':')[0] ?? null,
  username: telegram.username,
  path: telegram.path,
  updates: ['message', 'inline_query'],
  commands: telegram.commands,
  description: telegram.description,
  shortDescription: telegram.shortDescription,
})

// --- Cards ---

const button = (text, url) => ({ inline_keyboard: [[{ text, url }]] })

// What a typed name could be, in the registry's namespaces: the name itself, then the number a
// word spells on a keypad, as the search offers them
async function candidatesFor(query) {
  const { namespaces, currency } = await readRegistry()
  const live = namespaces.map((source) => toNamespace(source, { chainId: registry.chainId, currency }))
  return parseQuery(query, live, { keypad: true }).candidates
}

// A free name's price a year, with its dollar value when the feed can tell it
async function freeLine(pricePerYear, currency, locale) {
  const free = fill(telegram.card.free, { price: formatAmount(pricePerYear, currency, locale) })
  const { usd } = await readEthUsd().catch(() => ({ usd: null }))
  if (!usd) return free
  return `${free} (${fill(site.usd.label, { amount: formatUsd(Number(formatUnits(pricePerYear, currency.decimals)) * usd, locale) })})`
}

/**
 * One name's card: `text` in Telegram's HTML, the `summary` an inline result shows under the
 * name, and a button to the page where it is paid, bought or viewed.
 */
async function cardOf(candidate, locale) {
  const answer = await lookupCandidate(candidate)
  const { name } = candidate
  const lines = [`<b>${esc(name)}</b>`]
  if (candidate.keypad) lines.push(esc(fill(site.search.keypad, { word: candidate.keypad.word })))

  if (answer.status === 'available') {
    const free = await freeLine(answer.pricePerYear, answer.currency, locale)
    lines.push(esc(free))
    return { name, summary: free, text: lines.join('\n'), markup: button(fill(telegram.buttons.get, { name }), searchLink(name)) }
  }

  if (answer.status !== 'taken') return { name, summary: answer.reason ?? '', text: [...lines, esc(answer.reason ?? '')].join('\n'), markup: null }

  const { owner, ownerName, target, expiresAt, expired, tokenId } = answer
  const document = expired ? null : await readable().getRecords(name).catch(() => null)
  const shown = [readField(document, 'name'), readField(document, 'job')].filter(Boolean).join(' · ')
  if (shown) lines.push(esc(shown))
  const held = fill(telegram.card.held, { holder: ownerName ?? truncateAddress(owner) })
  lines.push(esc(held))

  const reachable = !expired && target && !isAddressEqual(target, zeroAddress)
  if (reachable) {
    lines.push(fill(esc(telegram.card.pointsTo), { address: `<code>${esc(target)}</code>` }))
    const agentWallet = tokenBoundAccountOf(tokenId)
    if (agentWallet && isAddressEqual(target, agentWallet)) lines.push(esc(fill(telegram.card.agentWallet, { chain: chainNameFor(registry.chainId) })))
  } else if (!expired) {
    lines.push(esc(telegram.card.nowhere))
  }
  const endpoint = readField(document, 'agent.endpoint')
  if (endpoint) lines.push(esc(fill(telegram.card.agent, { endpoint })))
  lines.push(esc(fill(expired ? telegram.card.expired : telegram.card.expires, { date: formatDate(expiresAt, locale) })))

  const page = link(namePath(candidate.namespace, candidate.label))
  const action = reachable ? telegram.buttons.pay : telegram.buttons.view
  return { name, summary: held, text: lines.join('\n'), markup: button(fill(action, { name }), page) }
}

/** The card of what `query` names first, or a line saying why it names nothing. */
async function lookup(query, locale) {
  const candidates = await candidatesFor(query)
  const found = candidates.find((candidate) => candidate.checkable)
  if (found) return cardOf(found, locale)
  // A number or a name the registry could never hold says why, as the search does
  const refused = candidates.find((candidate) => candidate.reason)
  if (refused) return { text: `<b>${esc(refused.name)}</b>\n${esc(refused.reason)}`, markup: null }
  return { text: esc(fill(telegram.notAName, { query })), markup: null }
}

async function agentsText() {
  const { agents } = await readAgents()
  const lines = [`<b>${esc(telegram.agentsTitle)}</b>`]
  if (agents.length === 0) return { text: [...lines, esc(site.agents.empty)].join('\n\n'), markup: null }
  const entries = agents.slice(0, telegram.agentsLimit).map(({ name, path, title, endpoint }) => {
    const head = `<a href="${esc(link(path))}">${esc(name)}</a>${title ? ` · ${esc(title)}` : ''}`
    return endpoint ? `${head}\n<code>${esc(endpoint)}</code>` : head
  })
  return { text: [...lines, ...entries].join('\n\n'), markup: button(telegram.buttons.agents, link(site.agents.path)) }
}

const helpText = () => telegram.help.map((line) => fill(line, { bot: telegram.username })).join('\n\n')

// --- Updates ---

// `/who@bot +0 4242` is { name: 'who', args: '+0 4242' }; false when it is meant for another bot
function readCommand(text) {
  const match = /^\/([a-z0-9_]+)(?:@([a-z0-9_]+))?(?:\s+([\s\S]*))?$/i.exec(text)
  if (!match) return null
  if (match[2] && match[2].toLowerCase() !== telegram.username.toLowerCase()) return false
  return { name: match[1].toLowerCase(), args: match[3]?.trim() ?? '' }
}

// Seconds until this Telegram account may read the chain again, or 0, counting this lookup
function throttled(from) {
  const account = String(from?.id ?? 'unknown')
  const wait = waitFor('telegram', account, telegram.throttle)
  if (!wait) countHit('telegram', account, telegram.throttle)
  return wait > 0
}

async function answerMessage(message) {
  const text = message.text?.trim()
  // Messages it posted inline come back through groups it is in; those are its own
  if (!text || message.via_bot) return null
  const privateChat = message.chat.type === 'private'
  const reply = ({ text: body, markup }) => ({
    method: 'sendMessage',
    chat_id: message.chat.id,
    text: body,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...(markup && { reply_markup: markup }),
    // In a group, the answer quotes the command it answers
    ...(!privateChat && { reply_parameters: { message_id: message.message_id, allow_sending_without_reply: true } }),
  })
  const say = (body) => reply({ text: esc(body), markup: null })

  const command = readCommand(text)
  if (command === false) return null
  // A group shows the bot its commands alone; a private chat sends names as they are
  if (!command && !privateChat) return null

  let query = text
  if (command) {
    if (command.name === 'start' || command.name === 'help') return reply({ text: helpText(), markup: null })
    if (!registryEnabled) return say(telegram.unconfigured)
    if (command.name === 'agents') return reply(await agentsText().catch(() => ({ text: esc(site.agents.unreachable), markup: null })))
    if (command.name !== 'who' && command.name !== 'check') return privateChat ? reply({ text: helpText(), markup: null }) : null
    if (!command.args) return say(fill(telegram.usage, { command: command.name }))
    query = command.args
  }
  if (!registryEnabled) return say(telegram.unconfigured)
  if (throttled(message.from)) return say(telegram.throttled)

  try {
    return reply(await lookup(query, message.from?.language_code))
  } catch (error) {
    console.error('TELEGRAM_LOOKUP_FAILED:', error?.shortMessage ?? error?.message)
    return say(telegram.unreachable)
  }
}

async function answerInline(inline) {
  const query = inline.query.trim()
  const answer = (results, cacheSeconds = telegram.inlineCacheSeconds) => ({
    method: 'answerInlineQuery',
    inline_query_id: inline.id,
    results,
    cache_time: cacheSeconds,
    is_personal: false,
    // Opens a chat with the bot, which says how it is used
    ...(results.length === 0 && { button: { text: telegram.inline.prompt, start_parameter: 'inline' } }),
  })
  if (!query || !registryEnabled) return answer([])
  if (throttled(inline.from)) return answer([], 0)

  try {
    const candidates = (await candidatesFor(query)).filter((candidate) => candidate.checkable).slice(0, telegram.inlineLimit)
    const cards = await Promise.all(candidates.map((candidate) => cardOf(candidate, inline.from?.language_code)))
    return answer(
      cards.map((card, index) => ({
        type: 'article',
        id: String(index),
        title: card.name,
        description: card.summary,
        input_message_content: { message_text: card.text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
        ...(card.markup && { reply_markup: card.markup }),
      }))
    )
  } catch (error) {
    console.error('TELEGRAM_INLINE_FAILED:', error?.shortMessage ?? error?.message)
    return answer([], 0)
  }
}

/** The Bot API call that answers one update, `{ method, ...params }`, or null when it needs none. */
export function answerUpdate(update) {
  if (update?.message) return answerMessage(update.message)
  if (update?.inline_query) return answerInline(update.inline_query)
  return null
}
