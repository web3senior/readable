import { nftHeaders, nftImage, notFound, readNft } from '@/lib/nft'

export async function GET(request, { params }) {
  const { tokenId } = await params
  const nft = await readNft(tokenId)
  if (!nft) return notFound()
  return new Response(await nftImage(nft), { headers: nftHeaders('image/svg+xml; charset=utf-8') })
}
