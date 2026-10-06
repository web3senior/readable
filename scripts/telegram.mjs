// The Telegram bot's setup, run from this machine with TELEGRAM_BOT_TOKEN in .env.local:
//
//   node scripts/telegram.mjs info             the bot, and where its updates go now
//   node scripts/telegram.mjs setup [origin]   sends the bot's updates to <origin>/api/telegram, and
//                                              sets its menu and descriptions from there. The origin
//                                              is NEXT_PUBLIC_BASE_URL unless given, and must hold
//                                              the same token
//   node scripts/telegram.mjs poll [origin]    for a dev server: reads the bot's updates here and
//                                              passes each to <origin> (https://localhost:3005
//                                              unless given). Works only while no webhook is set
//   node scripts/telegram.mjs off              removes the webhook, so poll can run
import { createHash } from 'node:crypto'

try {
  process.loadEnvFile(new URL('../.env.local', import.meta.url))
} catch {
  // No .env.local: the token may come from the environment
}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
// site.telegram.path
const PATH = '/api/telegram'

const fail = (message) => {
  console.error(message)
  process.exit(1)
}
if (!TOKEN) fail('Set TELEGRAM_BOT_TOKEN in .env.local first.')

// As src/lib/telegram.js derives it: the secret Telegram sends with each update
const SECRET = createHash('sha256').update(`readable-telegram-webhook:${TOKEN}`).digest('hex')

async function api(method, params = {}) {
  const response = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
  })
  const body = await response.json()
  if (!body.ok) throw new Error(`${method}: ${body.description}`)
  return body.result
}

const originOf = (value) => value.replace(/\/+$/, '')

// A dev server's certificate is self-signed
const trustLocal = (origin) => {
  if (/^https:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(origin)) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

const inlineHint = (me) => {
  if (!me.supports_inline_queries) {
    console.log('Inline mode is off. In @BotFather: /setinline, pick @' + me.username + ', and give the placeholder "+0 4242".')
  }
}

async function info() {
  const [me, hook, commands] = await Promise.all([api('getMe'), api('getWebhookInfo'), api('getMyCommands')])
  console.log(`@${me.username} (${me.id}), inline mode ${me.supports_inline_queries ? 'on' : 'off'}`)
  console.log(`Updates go to: ${hook.url || 'nowhere (no webhook; poll reads them)'}, ${hook.pending_update_count} waiting`)
  if (hook.last_error_message) console.log(`Last error: ${hook.last_error_message} (${new Date(hook.last_error_date * 1000).toISOString()})`)
  console.log(`Menu: ${commands.map(({ command }) => `/${command}`).join(' ') || 'none'}`)
  inlineHint(me)
}

async function setup(given) {
  const origin = originOf(given || process.env.NEXT_PUBLIC_BASE_URL || '')
  if (!origin.startsWith('https://')) fail(`Telegram sends updates to https only, not to "${origin}". Give the site's origin: setup https://readable.name`)
  trustLocal(origin)

  const response = await fetch(`${origin}${PATH}`).catch((error) => fail(`${origin} didn't answer: ${error.message}`))
  if (!response.ok) fail(`${origin}${PATH} answered ${response.status}. Deploy the bot there first.`)
  const profile = await response.json()
  const me = await api('getMe')
  if (!profile.enabled) fail(`${origin} doesn't hold TELEGRAM_BOT_TOKEN. Set it on that server, then run this again.`)
  if (profile.botId !== String(me.id)) fail(`${origin} holds the token of another bot (${profile.botId}).`)

  await api('setMyCommands', { commands: profile.commands })
  await api('setMyDescription', { description: profile.description })
  await api('setMyShortDescription', { short_description: profile.shortDescription })
  await api('setWebhook', { url: `${origin}${profile.path}`, secret_token: SECRET, allowed_updates: profile.updates, drop_pending_updates: true })
  console.log(`@${me.username} now sends its updates to ${origin}${profile.path}, with its menu and descriptions set.`)
  inlineHint(me)
}

async function poll(given) {
  const origin = originOf(given || 'https://localhost:3005')
  trustLocal(origin)
  const [me, hook] = await Promise.all([api('getMe'), api('getWebhookInfo')])
  if (hook.url) fail(`@${me.username} sends its updates to ${hook.url}. Run "off" to read them here; "setup" puts the webhook back.`)

  console.log(`Passing @${me.username}'s updates to ${origin}${PATH}. Ctrl+C stops.`)
  let offset = 0
  for (;;) {
    const updates = await api('getUpdates', { offset, timeout: 30, allowed_updates: ['message', 'inline_query'] }).catch((error) => {
      console.error(error.message)
      return []
    })
    for (const update of updates) {
      offset = update.update_id + 1
      const kind = Object.keys(update).find((key) => key !== 'update_id')
      try {
        const response = await fetch(`${origin}${PATH}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': SECRET },
          body: JSON.stringify(update),
        })
        if (!response.ok) throw new Error(`${origin} answered ${response.status}`)
        const text = await response.text()
        if (!text) {
          console.log(`${kind}: no answer`)
          continue
        }
        // The reply names the one call that answers the update, as Telegram carries it out
        const { method, ...params } = JSON.parse(text)
        await api(method, params)
        console.log(`${kind}: ${method}`)
      } catch (error) {
        console.error(`${kind}: ${error.message}`)
      }
    }
  }
}

const [command, argument] = process.argv.slice(2)
const commands = { info, setup, poll, off: async () => console.log((await api('deleteWebhook')) && 'Webhook removed.') }
if (!commands[command]) fail('Usage: node scripts/telegram.mjs info | setup [origin] | poll [origin] | off')
await commands[command](argument)
