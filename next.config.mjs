/** @type {import('next').NextConfig} */
const nextConfig = {
  // The NFT picture reads its backdrop (site.nft.art.backdrop) from public/ on the server
  outputFileTracingIncludes: {
    '/nft/**': ['./public/*.svg'],
  },
}

export default nextConfig
