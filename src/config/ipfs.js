/**
 * Photos for a name's records are pinned on IPFS through Filebase, as Hup pins its uploads
 * (`hupsocial/src/lib/filebase.js`). The token is the server's alone (FILEBASE_IPFS_RPC_TOKEN, the
 * same variable as Hup's); without it the upload is off and a photo is a link the holder pastes.
 */

const FILEBASE_GATEWAY = 'https://ipfs.filebase.io/ipfs/'

// A gateway as the code appends a CID to it: https, ending in a slash
const normalize = (gateway) => {
  const secure = gateway.trim().replace(/^http:\/\//, 'https://')
  return secure.endsWith('/') ? secure : `${secure}/`
}

export const ipfs = {
  uploadPath: '/api/ipfs',
  // Filebase's IPFS RPC: `add` answers the CID of what it pinned. Server-only, so the browser
  // never sees where uploads go
  rpcAddUrl: process.env.FILEBASE_IPFS_RPC_URL || 'https://rpc.filebase.io/api/v0/add',
  // Where an ipfs:// photo is shown from. Filebase's own gateway holds what it pinned before any
  // other host has heard of the CID; a dedicated one (https://<name>.myfilebase.com/ipfs/) can
  // take over from the environment, as on Hup
  gateway: normalize(process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL_PRIMARY || FILEBASE_GATEWAY),
  photo: {
    // Under the 4.5 MB a serverless function takes in one request
    maxBytes: 4 * 1024 * 1024,
    // The formats every browser and wallet shows, told apart by their first bytes, never by name
    types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' },
  },
  // A brake on strangers filling the pinning account, per visitor and per server instance
  throttle: { max: 20, windowMs: 60 * 60 * 1000 },
  // Filebase is asked again after a dropped connection, a 5xx or a 429; each try is bounded
  retry: { attempts: 3, backoffMs: [400, 1200], timeoutMs: 12_000 },
}
