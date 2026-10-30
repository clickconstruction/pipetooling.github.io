/// <reference lib="webworker" />
/**
 * The shrink off the main thread (punch list #189, PR 5b): decode the shot with its orientation applied, draw it
 * at the plan's frame on an OffscreenCanvas, read it back as a JPEG. One message in, one answer out; the page
 * terminates the worker after each shot. `lib/photos/shrink.ts` is the only sender.
 */
import { formatErrorMessage } from '../../utils/errorHandling'
import { shrinkPlan, type WorkerShrinkAnswer, type WorkerShrinkRequest } from './shrink'

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = async (ev: MessageEvent<WorkerShrinkRequest>) => {
  const { file, maxEdge, quality } = ev.data
  let bitmap: ImageBitmap | null = null
  try {
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // An older engine without the orientation option: decode plainly, and the drawing keeps what it can.
      bitmap = await createImageBitmap(file)
    }
    const size = shrinkPlan(bitmap.width, bitmap.height, maxEdge)
    const canvas = new OffscreenCanvas(size.width, size.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('The phone could not draw the picture.')
    ctx.drawImage(bitmap, 0, 0, size.width, size.height)
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality })
    const answer: WorkerShrinkAnswer = { ok: true, blob, width: size.width, height: size.height }
    scope.postMessage(answer)
  } catch (e) {
    const answer: WorkerShrinkAnswer = { ok: false, error: formatErrorMessage(e, 'The phone could not shrink the picture.') }
    scope.postMessage(answer)
  } finally {
    bitmap?.close()
  }
}
