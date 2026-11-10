/**
 * One tape strip as the printer's own dots (punch list #304): a canvas drawn by `tapeStripCanvas.ts`, shown at its
 * true size so the screen is what prints, and its raster lines handed up for the USB print. Draws again when the box
 * or the tape changes; reports null where there is no canvas to draw on.
 */
import { useEffect, useRef } from 'react'
import { qrSquares } from '../../lib/materials/tapeStrip'
import { drawTapeStrip } from '../../lib/materials/tapeStripCanvas'

type Props = {
  id: string
  stencil: string
  address: string
  /** What the QR carries. */
  value: string
  words: string
  /** The dots the tape prints across. */
  dots: number
  onDrawn: (id: string, lines: Uint8Array[] | null) => void
}

export default function TapeStripBitmap({ id, stencil, address, value, words, dots, onDrawn }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const report = useRef(onDrawn)
  report.current = onDrawn
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const squares = qrSquares(value)
    const drawn = squares ? drawTapeStrip(canvas, { dots, squares, stencil, address, words }) : null
    report.current(id, drawn?.lines ?? null)
  }, [id, stencil, address, value, words, dots])
  return <canvas ref={ref} data-testid="labels-tape-bitmap" aria-label={`The strip for ${stencil}`} style={{ display: 'block', height: dots, maxWidth: '100%', imageRendering: 'pixelated', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', background: 'var(--surface)' }} />
}
