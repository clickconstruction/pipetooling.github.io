import { useEffect, useRef, useState } from 'react'
import { LIEN_RUN_SCAN_FORMATS, lienRunScanOutcomeFromError, lienRunScanSupport, lienRunScanWords, trackingFromScan, type LienRunScanOutcome } from '../../lib/jobs/lienRunScan'

/**
 * Scan › beside a Mailed box on a phone (v2.7331): the camera opens over the run, reads the USPS
 * receipt's barcode and the number lands in the box. The browser's own `BarcodeDetector` reads
 * where it exists (Chrome, Android); elsewhere `@zxing/browser` is fetched on the press, never
 * before. A refused camera, no camera or no reader says so under the box and leaves typing as
 * it was. Nothing is recorded here: the box's value is the run's, as typed.
 */
type Detector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> }
type DetectorCtor = new (opts: { formats: ReadonlyArray<string> }) => Detector

/** `BarcodeDetector` where the browser has it; the reader's formats are asked for, and a browser that knows none of them answers an empty list. */
function nativeDetector(): DetectorCtor | null {
  const w = window as unknown as { BarcodeDetector?: DetectorCtor }
  return typeof w.BarcodeDetector === 'function' ? w.BarcodeDetector : null
}

export default function LienRunScanPress({ onRead, label }: { onRead: (tracking: string) => void; /** "650 · AXO Schertz — owner" for the press's name. */ label: string }) {
  const [open, setOpen] = useState(false)
  const [outcome, setOutcome] = useState<LienRunScanOutcome | null>(null)
  const [read, setRead] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const stopRef = useRef<() => void>(() => {})
  const support = lienRunScanSupport({ hasMediaDevices: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia, secure: typeof window !== 'undefined' && (window.isSecureContext || window.location.hostname === 'localhost') })

  useEffect(() => () => stopRef.current(), [])

  const finish = (o: LienRunScanOutcome, value = '') => {
    stopRef.current()
    stopRef.current = () => {}
    setOpen(false)
    setOutcome(o)
    setRead(value)
    if (o === 'read' && value) onRead(value)
  }

  const start = async () => {
    setOutcome(null)
    setRead('')
    setOpen(true)
    let stream: MediaStream | null = null
    let live = true
    const stops: Array<() => void> = []
    stopRef.current = () => {
      live = false
      for (const s of stops) s()
      stream?.getTracks().forEach((t) => t.stop())
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
    } catch (err) {
      finish(lienRunScanOutcomeFromError(err))
      return
    }
    if (!live) {
      stream.getTracks().forEach((t) => t.stop())
      return
    }
    const video = videoRef.current
    if (video) {
      video.srcObject = stream
      try {
        await Promise.resolve(video.play())
      } catch {
        // jsdom and a paused tab: the frames still reach the reader when they come
      }
    }
    const Native = nativeDetector()
    if (Native && video) {
      let detector: Detector
      try {
        detector = new Native({ formats: LIEN_RUN_SCAN_FORMATS })
      } catch {
        finish('no_reader')
        return
      }
      const tick = async () => {
        if (!live) return
        try {
          const found = await detector.detect(video)
          const hit = found.find((f) => (f.rawValue ?? '').trim())
          if (hit) {
            finish('read', trackingFromScan(hit.rawValue))
            return
          }
        } catch {
          // a frame not ready yet; try again
        }
        if (live) timer = window.setTimeout(() => void tick(), 250)
      }
      let timer = window.setTimeout(() => void tick(), 250)
      stops.push(() => window.clearTimeout(timer))
      return
    }
    // No native reader: ZXing, fetched now and not before, so the run's own bundle carries none of it.
    try {
      const zxing = await import('@zxing/browser')
      if (!live || !video) return
      const reader = new zxing.BrowserMultiFormatReader()
      const controls = await reader.decodeFromVideoElement(video, (result) => {
        const text = result?.getText?.() ?? ''
        if (text.trim()) finish('read', trackingFromScan(text))
      })
      stops.push(() => controls.stop())
    } catch {
      finish('no_reader')
    }
  }

  if (support === 'none') return null
  return (
    <>
      <button type="button" onClick={() => void start()} aria-label={`${label} — scan the slip`} data-testid="run-scan" title="Read the number off the USPS receipt with the camera" style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', font: 'inherit', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        Scan ›
      </button>
      {outcome && outcome !== 'closed' ? (
        <span role="status" className="lienRunCheckShape" data-ok={outcome === 'read' ? 'yes' : 'no'} data-testid="run-scan-words">
          {lienRunScanWords(outcome, read)}
        </span>
      ) : null}
      {open ? (
        <div role="dialog" aria-modal="true" aria-label="Scan the slip" data-testid="run-scan-camera" onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', inset: 0, paddingTop: 'var(--app-top-chrome, 0px)', zIndex: 900, background: 'rgba(0,0,0,0.85)', display: 'grid', gridTemplateRows: 'auto 1fr auto', color: '#fff' }}>
          <div style={{ padding: '0.8rem 1rem', fontSize: '0.9rem', fontWeight: 700 }}>Hold the receipt’s barcode in the frame</div>
          <video ref={videoRef} muted playsInline autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: 0 }} />
          <div style={{ padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>The number lands in the box when it reads. Nothing is recorded until you press Record.</span>
            <button type="button" onClick={() => finish('closed')} data-testid="run-scan-close" style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #fff', background: 'transparent', color: '#fff', font: 'inherit', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', minHeight: 40 }}>
              Type it instead
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
