import { readEvents } from '@/lib/events'

const shortestFirst = (a, b) => a.length - b.length || a.localeCompare(b)

/**
 * The labels each namespace holds reserved, by namespace id, shortest first. The registry keeps
 * only their hashes, so they are read back from its `ReservedUpdated` events, all of them: the
 * last event of a label decides. `setReserved` is the only writer and emits one for every label,
 * so the events are the whole record. Labels are stored as they would be registered (numbers as
 * bare digits). Throws rather than answer from part of the record.
 */
export async function readReservations() {
  const events = await readEvents('ReservedUpdated', { all: true })
  const reserved = new Map()
  for (const { namespaceId, label, reserved: isReserved } of events.toReversed()) {
    const key = `${namespaceId}:${label}`
    if (isReserved) reserved.set(key, { namespaceId: String(namespaceId), label })
    else reserved.delete(key)
  }

  const byNamespace = {}
  for (const { namespaceId, label } of reserved.values()) (byNamespace[namespaceId] ??= []).push(label)
  for (const labels of Object.values(byNamespace)) labels.sort(shortestFirst)
  return byNamespace
}
