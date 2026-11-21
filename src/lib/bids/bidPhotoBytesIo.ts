/**
 * A filed bid photo's bytes (punch list #306): its thumbnail and its full picture, streamed through the `bid-photos`
 * function, since the bid's folder is not public. The function answers whoever can read the bid, and only for a
 * picture inside that bid's photo folder. Kept apart from `bidPhotosIo.ts` so the photo lists that read the
 * `uploaded_photos` view (Documents → Photos, the job's photo window) can draw a bid's photo without loading the
 * bid window's writes. Browser io, not pure.
 */
import { supabase } from '../supabase'
import { makeBytesQueue, type BytesQueue } from '../photos/photoBytesQueue'

const FN = 'bid-photos'

let thumbQueue: BytesQueue = makeBytesQueue({ concurrency: 6, retries: 4, cacheSize: 300 })
let fullQueue: BytesQueue = makeBytesQueue({ concurrency: 2, retries: 4, cacheSize: 6 })

/** Forget every kept picture, with a sleep of the test's own when given. */
export function resetBidPhotoBytes(sleep?: (ms: number) => Promise<void>): void {
  thumbQueue = makeBytesQueue({ concurrency: 6, retries: 4, cacheSize: 300, sleep })
  fullQueue = makeBytesQueue({ concurrency: 2, retries: 4, cacheSize: 6, sleep })
}

/**
 * A filed photo's thumbnail or full picture as an object URL, or null when the function refuses. A plain fetch under
 * the caller's sign-in, as `jobPhotosIo` does it: `functions.invoke` reads an image answer as text. The caller revokes
 * its own URL; the bytes stay kept in the queue.
 */
async function photoBytes(bidId: string, fileId: string, action: 'thumb' | 'full'): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  const jwt = data.session?.access_token
  if (!jwt) return null
  const queue = action === 'thumb' ? thumbQueue : fullQueue
  const bytes = await queue.get(`${action}:${bidId}:${fileId}`, async () => {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      body: JSON.stringify({ action, bid_id: bidId, file_id: fileId }),
    })
    const retryAfter = Number(res.headers?.get?.('Retry-After') ?? '')
    return { status: res.status, blob: res.ok ? await res.blob() : null, retryAfterSec: Number.isFinite(retryAfter) ? retryAfter : null }
  })
  return bytes ? URL.createObjectURL(bytes) : null
}

/** An object URL for a filed bid photo's thumbnail, or null; the caller revokes it. */
export function bidPhotoThumb(bidId: string, fileId: string): Promise<string | null> {
  return photoBytes(bidId, fileId, 'thumb')
}

/** An object URL for a filed bid photo at full size, or null; the caller revokes it. */
export function bidPhotoFull(bidId: string, fileId: string): Promise<string | null> {
  return photoBytes(bidId, fileId, 'full')
}
