'use client'

import { EyeIcon } from '@phosphor-icons/react'
import Button from '@/components/ui/Button'
import { toast } from '@/components/NextToast'
import { site } from '@/config/site'
import useWatchlist from '@/hooks/useWatchlist'

const { watch: copy } = site

/** Adds a name to the watch list kept in this browser, or takes it off. */
export default function WatchButton({ name, size = 'sm', block = false }) {
  const { isWatching, watch, unwatch } = useWatchlist()
  const watching = isWatching(name)

  const toggle = () => {
    if (watching) return unwatch(name)
    watch(name)
    toast(copy.added.replace('{name}', name), 'success')
  }

  return (
    <Button
      variant="secondary"
      size={size}
      block={block}
      aria-pressed={watching}
      icon={<EyeIcon size={14} weight={watching ? 'fill' : 'regular'} />}
      onClick={toggle}
    >
      {watching ? copy.remove : copy.add}
    </Button>
  )
}
