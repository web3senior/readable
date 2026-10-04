'use client'

import { useState } from 'react'
import { CalendarPlusIcon } from '@phosphor-icons/react'
import Button from '@/components/ui/Button'
import { site } from '@/config/site'
import useIsClient from '@/hooks/useIsClient'
import { downloadCalendar, releaseEvent, renewalEvents } from '@/lib/calendar'
import { formatDate } from '@/lib/format'

const { reminders } = site

/**
 * A calendar file for one name: reminders to renew it before `expiresAt`, or with `releasedAt`
 * the day it returns to the public. `path` is the name's page. Nothing when every reminder would
 * be in the past.
 */
export default function ReminderButton({ name, path, expiresAt, releasedAt, size = 'sm', variant = 'secondary', block = false }) {
  const isClient = useIsClient()
  // Fixed for the visit, so the button doesn't come and go between two renders
  const [now] = useState(() => Date.now())
  if (!isClient) return null
  const link = `${window.location.origin}${path}`
  const slug = path.split('/').pop()
  const events = releasedAt
    ? releasedAt > now
      ? [releaseEvent({ name, slug, releasedAt, link }, formatDate)]
      : []
    : renewalEvents({ name, slug, expiresAt, link, now }, formatDate)
  if (events.length === 0) return null

  return (
    <Button variant={variant} size={size} block={block} icon={<CalendarPlusIcon size={14} />} onClick={() => downloadCalendar(`${site.name}-${slug}`, events)}>
      {releasedAt ? reminders.release.action : reminders.renew.action}
    </Button>
  )
}
