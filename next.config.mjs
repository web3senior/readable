/** @type {import('next').NextConfig} */
const nextConfig = {
  // Where Farcaster and the Base app read the mini app's manifest; the route builds it from config
  rewrites() {
    return [{ source: '/.well-known/farcaster.json', destination: '/api/miniapp/manifest' }]
  },
}

export default nextConfig
