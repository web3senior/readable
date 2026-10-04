import { nftHeaders, nftMetadata, notFound, readNft } from '@/lib/nft'

// The registry's tokenURI: its base URI followed by the token id
export async function GET(request, { params }) {
  const { tokenId } = await params
  const nft = await readNft(tokenId)
  if (!nft) return notFound()
  return new Response(JSON.stringify(nftMetadata(nft)), { headers: nftHeaders('application/json; charset=utf-8') })
}
