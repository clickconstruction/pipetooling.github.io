import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { getPdfDocument } from '../../lib/pdfjsDocument'
import { BILL_VIEWER_WORDS as WORDS, billFileKind, billPageNote, billPageRange, billPagesToDraw } from '../../lib/materials/bills/billViewer'

/**
 * A bill's paper for the bill viewer (punch list #431, PR 2): the pages of a PDF that are this bill, one under the
 * other and each as wide as the pane, so page two needs no press. The file is opened once with pdf.js (loaded on first
 * use, so no other screen pays for it) and kept by its bytes, since one file often stands behind several bills. A bill
 * that is part of a longer file says so and offers the whole file. A picture is drawn as a picture.
 */

const docs = new WeakMap<ArrayBuffer, Promise<PDFDocumentProxy>>()

function openDoc(bytes: ArrayBuffer): Promise<PDFDocumentProxy> {
  const kept = docs.get(bytes)
  if (kept) return kept
  const opening = getPdfDocument(bytes)
  docs.set(bytes, opening)
  return opening
}

/** One page of an open document on a canvas, as wide as `width` CSS pixels. */
function DocPage({ doc, pageNo, width }: { doc: PDFDocumentProxy; pageNo: number; width: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let cancelled = false
    let task: { cancel(): void } | null = null
    void (async () => {
      try {
        const page = await doc.getPage(pageNo)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: width / base.width })
        const canvas = canvasRef.current
        if (!canvas) return
        const ratio = Math.min(2, window.devicePixelRatio || 1)
        canvas.width = Math.floor(viewport.width * ratio)
        canvas.height = Math.floor(viewport.height * ratio)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
        const render = page.render({ canvas, canvasContext: ctx, viewport })
        task = render
        await render.promise
      } catch (e) {
        if (!cancelled && !(e instanceof Error && /cancel/i.test(e.message))) console.error('bill page render failed', e)
      }
    })()
    return () => {
      cancelled = true
      try {
        task?.cancel()
      } catch {
        /* already done */
      }
    }
  }, [doc, pageNo, width])
  // A page is white paper in both themes, as the supplier printed it.
  return <canvas ref={canvasRef} aria-label={`Page ${pageNo}`} data-theme="light" style={{ display: 'block', width, minHeight: Math.round(width * 1.29), background: 'var(--surface)', boxShadow: '0 1px 6px rgba(0,0,0,0.22)' }} />
}

export function BillPdfPages({ bytes, pageFrom, pageTo, width }: { bytes: ArrayBuffer; pageFrom: number | null; pageTo: number | null; width: number }) {
  const kind = useMemo(() => billFileKind(bytes), [bytes])
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [failed, setFailed] = useState(false)
  const [whole, setWhole] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    setDoc(null)
    setFailed(false)
    setWhole(false)
    setShowAll(false)
    if (kind !== 'pdf') return
    let live = true
    openDoc(bytes).then(
      (d) => {
        if (live) setDoc(d)
      },
      () => {
        if (live) setFailed(true)
      },
    )
    return () => {
      live = false
    }
  }, [bytes, kind])

  const imageUrl = useMemo(() => (kind === 'image/jpeg' || kind === 'image/png' ? URL.createObjectURL(new Blob([bytes], { type: kind })) : null), [bytes, kind])
  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl)
  }, [imageUrl])

  const note: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }
  const linkPress: CSSProperties = { margin: 0, padding: 0, border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 'inherit', color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' }

  if (imageUrl) return <img src={imageUrl} alt="The bill" data-testid="bill-picture" style={{ display: 'block', width, maxWidth: '100%', boxShadow: '0 1px 6px rgba(0,0,0,0.22)' }} />
  if (kind !== 'pdf' || failed) return <p style={note}>{WORDS.notAPdf}</p>
  if (!doc) return <p style={note}>{WORDS.reading}</p>

  const own = billPageRange(pageFrom, pageTo, doc.numPages)
  const range = whole ? { from: 1, to: own.of } : own
  const draw = billPagesToDraw(range.from, range.to, showAll)
  const ownNote = billPageNote(own)

  return (
    <div data-testid="bill-pages" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
      {draw.pages.map((pageNo) => (
        <DocPage key={pageNo} doc={doc} pageNo={pageNo} width={width} />
      ))}
      {draw.more > 0 ? (
        <button type="button" onClick={() => setShowAll(true)} style={{ ...linkPress, fontSize: '0.8125rem' }}>
          Show {draw.more} more {draw.more === 1 ? 'page' : 'pages'}
        </button>
      ) : null}
      {ownNote ? (
        <p style={{ ...note, margin: 0 }}>
          {ownNote}{' '}
          <button
            type="button"
            onClick={() => {
              setWhole((w) => !w)
              setShowAll(false)
            }}
            style={linkPress}
          >
            {whole ? WORDS.ownPages : WORDS.wholeFile}
          </button>
        </p>
      ) : null}
    </div>
  )
}
