import { answerUpdate, botProfile, fromTelegram, telegramEnabled } from '@/lib/telegram'

// The Telegram bot's webhook. Telegram posts each update here with the webhook's secret, and
// carries out the one Bot API call the reply names. GET tells scripts/telegram.mjs what to set on
// the bot: its menu and descriptions, and whether this server holds the token

export function GET() {
  return Response.json(botProfile(), { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request) {
  if (!telegramEnabled()) return new Response(null, { status: 404 })
  if (!fromTelegram(request)) return new Response(null, { status: 401 })

  const update = await request.json().catch(() => null)
  try {
    const call = await answerUpdate(update)
    return call ? Response.json(call) : new Response(null, { status: 200 })
  } catch (error) {
    // Telegram sends an update again until it is taken, so a failure is taken and logged
    console.error('TELEGRAM_UPDATE_FAILED:', error?.shortMessage ?? error?.message)
    return new Response(null, { status: 200 })
  }
}
