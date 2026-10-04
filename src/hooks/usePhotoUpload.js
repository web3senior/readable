'use client'

import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ipfs } from '@/config/ipfs'

const MB = 1024 * 1024

/**
 * Pins a photo on IPFS through the site (`/api/ipfs`). `enabled` is false where the site has no
 * pinning set up, so the form offers no upload there. `upload` resolves with `ipfs://<cid>` or
 * throws an Error a toast can show.
 */
export default function usePhotoUpload() {
  const status = useQuery({
    queryKey: ['ipfs', 'status'],
    queryFn: async () => (await fetch(ipfs.uploadPath)).json(),
    staleTime: Infinity,
  })
  const [uploading, setUploading] = useState(false)

  const upload = useCallback(async (file) => {
    // Told here first, so a large photo isn't sent only to be refused
    if (!ipfs.photo.types[file.type]) throw new Error('Use a JPEG, PNG, WebP or GIF image')
    if (file.size > ipfs.photo.maxBytes) throw new Error(`A photo can be ${Math.floor(ipfs.photo.maxBytes / MB)} MB at most`)

    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const response = await fetch(ipfs.uploadPath, { method: 'POST', body })
      const answer = await response.json().catch(() => ({}))
      if (!response.ok || !answer.cid) throw new Error(answer.error ?? 'The photo couldn’t be uploaded')
      return answer.cid
    } finally {
      setUploading(false)
    }
  }, [])

  return { enabled: Boolean(status.data?.enabled), uploading, upload }
}
