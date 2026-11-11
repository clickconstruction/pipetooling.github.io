/**
 * The way in to a supply house's prices (punch list #308, PR 4 and 7): one press, and two ways that
 * need no press. A file dropped anywhere on the tab, or pasted, is read as a price sheet; a row
 * pasted from a mail opens as one price. A chip says when a sheet still has rows waiting, and opens
 * it where it was left.
 *
 * On Takeoffs it sits in the tab's title row with a bid behind it, so a sheet's fixtures can land on
 * the takeoff. On the Parts Book it has no bid: a house's general list, part prices only.
 */
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { supabase } from '../../lib/supabase'
import { loadPartsCatalog } from '../../lib/materials/partsCatalog'
import { loadBidAskedHouseIds } from '../../lib/materials/priceSheet/priceRowIo'
import { findSheetByHash, findSheetByNumber, listSheets, loadSheet, saveSheet, type SheetSummary } from '../../lib/materials/priceSheet/priceSheetIo'
import { allRows, parsePasted } from '../../lib/materials/priceSheet/pastedRow'
import { shortDay } from '../../lib/materials/priceSheet/rowCard'
import { houseVerdict, letterheadHouse, sheetHeader } from '../../lib/materials/priceSheet/sheetHouse'
import { revisionWords, sheetRevision } from '../../lib/materials/priceSheet/sheetPlan'
import { readSheetFile, sha256Hex } from '../../lib/materials/priceSheet/sheetText'
import type { KnownPart } from './PriceRowCardView'
import { PRICE_SHEET_DOCK_MIN_WINDOW, PRICE_SHEET_DOCK_WIDTH, PriceSheetPanel, type PriceSheetRowOffer, type PriceSheetTakeoff } from './PriceSheetPanel'
import { QuickPriceWindow } from './QuickPriceWindow'
import { EmptyState } from '../EmptyState'

type House = { id: string; name: string }
type OpenSheet = { paperId: string; firstRead: { letterhead: { houseId: string | null; printed: string | null } | null; fileName: string | null } | null }

const isTyping = (el: EventTarget | null): boolean => {
  const node = el as HTMLElement | null
  return !!node && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'SELECT' || node.isContentEditable)
}

export function PriceSheetDoor({
  bid,
  serviceTypeId,
  supplyHouses,
  knownParts,
  onBookChanged,
  takeoff,
  onRowOffers,
  placeRef,
}: {
  /** The bid the sheets are for. Without one, a sheet files part prices only. */
  bid?: { id: string; label: string } | null
  serviceTypeId: string
  /** The supply houses and the book's parts, when the caller already holds them. Left out, the door reads them itself. */
  supplyHouses?: House[]
  knownParts?: KnownPart[]
  /** The book's prices may have moved: the caller reads its prices again. */
  onBookChanged: () => void
  /** What the panel needs to put a sheet's fixture on this bid (PR 6). */
  takeoff?: PriceSheetTakeoff
  /** The open sheet's ready fixtures, by the bid's row: Takeoffs draws each on its own row. */
  onRowOffers?: (offers: PriceSheetRowOffer[]) => void
  placeRef?: MutableRefObject<((groupId: string) => void) | null>
}) {
  const [loadedHouses, setLoadedHouses] = useState<House[]>([])
  const [loadedParts, setLoadedParts] = useState<KnownPart[] | null>(null)
  const houses = supplyHouses ?? loadedHouses
  const parts = knownParts ?? loadedParts ?? []
  const [listOpen, setListOpen] = useState(false)

  useEffect(() => {
    if (supplyHouses) return
    let cancelled = false
    void supabase.from('supply_houses').select('id,name').order('name').then(({ data }) => {
      if (!cancelled) setLoadedHouses((data ?? []) as House[])
    })
    return () => {
      cancelled = true
    }
  }, [supplyHouses])
  const [menuOpen, setMenuOpen] = useState(false)
  const [quickPrice, setQuickPrice] = useState<{ text: string } | null>(null)
  const [openSheet, setOpenSheet] = useState<OpenSheet | null>(null)
  const [sheets, setSheets] = useState<SheetSummary[]>([])
  const [note, setNote] = useState<{ tone: 'info' | 'problem'; text: string } | null>(null)
  const [reading, setReading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [wide, setWide] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth >= PRICE_SHEET_DOCK_MIN_WINDOW))
  const fileInput = useRef<HTMLInputElement>(null)
  const bidId = bid?.id ?? null

  const refreshSheets = useCallback(async () => setSheets(await listSheets(supabase, bidId ? { bidId } : {})), [bidId])
  useEffect(() => {
    setOpenSheet(null)
    setNote(null)
    void refreshSheets()
  }, [refreshSheets])

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= PRICE_SHEET_DOCK_MIN_WINDOW)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // The Parts Book holds one page of parts at a time: a sheet needs them all, read once when one opens.
  const needsParts = openSheet != null && !knownParts && loadedParts == null
  useEffect(() => {
    if (!needsParts || !serviceTypeId) return
    let cancelled = false
    loadPartsCatalog<KnownPart>(supabase, serviceTypeId, 'id,name,manufacturer,is_robot')
      .then((rows) => {
        if (!cancelled) setLoadedParts(rows)
      })
      .catch(() => {
        if (!cancelled) setNote({ tone: 'problem', text: 'The parts book could not be read, so nothing on the sheet could be matched. Open the sheet again.' })
      })
    return () => {
      cancelled = true
    }
  }, [needsParts, serviceTypeId])

  // Docked, the drawer takes the right of the window and the page keeps its width beside it.
  const docked = wide
  useEffect(() => {
    if (!openSheet || !docked) return
    const before = document.body.style.paddingRight
    document.body.style.paddingRight = `${PRICE_SHEET_DOCK_WIDTH}px`
    return () => {
      document.body.style.paddingRight = before
    }
  }, [openSheet, docked])

  /** Text off a sheet becomes a kept sheet and opens; one bare row opens as one price instead. */
  const startFromText = useCallback(
    async (text: string, from: { sha256: string | null; pages: number | null; fileName: string | null }) => {
      const parsed = parsePasted(text)
      const rows = allRows(parsed)
      if (rows.length === 0) {
        setNote({ tone: 'problem', text: 'No rows could be read from that. A row needs its words and a number or a price.' })
        return
      }
      if (!from.fileName && parsed.groups.length === 0 && rows.length <= 3) {
        setQuickPrice({ text })
        return
      }
      if (from.sha256) {
        const already = await findSheetByHash(supabase, from.sha256)
        if (already) {
          setOpenSheet({ paperId: already.id, firstRead: null })
          setNote({ tone: 'info', text: `This file was read on ${shortDay(already.createdAt.slice(0, 10))}. That read is open, where it was left.` })
          return
        }
      }
      const letterhead = letterheadHouse(text, houses)
      const asked = bidId ? await loadBidAskedHouseIds(supabase, bidId) : []
      const verdict = houseVerdict({ houses, letterhead, askedHouseIds: asked })
      const header = sheetHeader(text)
      // A quote with the same number from the same house, read before: this is a later copy, and it says what moved.
      const earlier = verdict.sure && verdict.houseId ? await findSheetByNumber(supabase, verdict.houseId, header.number) : null
      const earlierRead = earlier ? await loadSheet(supabase, earlier.id) : null
      const saved = await saveSheet(supabase, { sheet: parsed, header, supplyHouseId: verdict.sure ? verdict.houseId : null, bidId, sha256: from.sha256, pages: from.pages })
      if (!saved.ok) {
        setNote({ tone: 'problem', text: saved.error })
        return
      }
      if (earlier && earlierRead?.ok && earlierRead.sheet) {
        setNote({ tone: 'info', text: revisionWords(sheetRevision(earlierRead.sheet.lines, rows), header.number, shortDay(earlier.createdAt.slice(0, 10))) })
      } else setNote(null)
      setOpenSheet({ paperId: saved.paperId, firstRead: { letterhead, fileName: from.fileName } })
      void refreshSheets()
    },
    [houses, bidId, refreshSheets],
  )

  const startFromFile = useCallback(
    async (file: File) => {
      setReading(true)
      setNote({ tone: 'info', text: `Reading ${file.name}…` })
      const read = await readSheetFile(file)
      if (!read.ok) setNote({ tone: 'problem', text: read.error })
      else await startFromText(read.text, { sha256: read.sha256, pages: read.pages, fileName: read.fileName })
      setReading(false)
    },
    [startFromText],
  )

  // A file dropped anywhere on the tab, or pasted; text pasted outside a field.
  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragging(true)
    }
    const onDragLeave = (e: DragEvent) => {
      if (e.relatedTarget == null) setDragging(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer?.files?.[0]
      if (file) void startFromFile(file)
    }
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target) || document.querySelector('[role="dialog"]')) return
      const file = e.clipboardData?.files?.[0]
      if (file) {
        e.preventDefault()
        void startFromFile(file)
        return
      }
      const text = e.clipboardData?.getData('text/plain') ?? ''
      if (!text.trim() || allRows(parsePasted(text)).length === 0) return
      e.preventDefault()
      void (async () => startFromText(text, { sha256: await sha256Hex(new TextEncoder().encode(text).buffer as ArrayBuffer), pages: null, fileName: null }))()
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('paste', onPaste)
    }
  }, [startFromFile, startFromText])

  const houseName = (id: string | null) => houses.find((h) => h.id === id)?.name ?? 'A'
  const waiting = sheets.filter((s) => s.waiting > 0 && s.paper.id !== openSheet?.paperId)
  const item = { display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', width: '100%', textAlign: 'left' as const, padding: '0.45rem 0.6rem', background: 'none', border: 'none', borderRadius: 5, cursor: 'pointer', font: 'inherit', fontSize: '0.875rem', color: 'var(--text-base)' }

  return (
    <>
      {waiting.slice(0, 2).map((s) => (
        <button
          key={s.paper.id}
          type="button"
          data-testid="price-sheet-chip"
          onClick={() => setOpenSheet({ paperId: s.paper.id, firstRead: null })}
          title="A price sheet on this bid has rows waiting. It opens where it was left."
          style={{ padding: '0.3rem 0.7rem', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', border: '1px solid var(--border-amber)', borderRadius: 999, cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' }}
        >
          {houseName(s.paper.supplyHouseId)} sheet · {s.waiting === 1 ? '1 waits' : `${s.waiting} wait`}
        </button>
      ))}
      <span style={{ position: 'relative' }}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          title="Read a supply house's price sheet, or paste one price. You can also drop a file anywhere on this tab."
          style={{ padding: '0.5rem 0.9rem', background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
        >
          {reading ? 'Reading…' : 'Price sheet ▾'}
        </button>
        {menuOpen ? (
          <div role="menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 950, width: 320, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.16)', padding: 6, display: 'grid', gap: 2 }}>
            <button type="button" role="menuitem" style={item} onClick={() => { setMenuOpen(false); fileInput.current?.click() }}>
              <strong>Read a file…</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>a PDF from the house</span>
            </button>
            <button type="button" role="menuitem" style={item} onClick={() => { setMenuOpen(false); setQuickPrice({ text: '' }) }}>
              <strong>Paste a price</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>a row, or a call</span>
            </button>
            {sheets.length > 0 ? <div style={{ borderTop: '1px solid var(--border)', margin: '3px 0' }} /> : null}
            {sheets.slice(0, bidId ? 6 : 4).map((s) => (
              <button key={s.paper.id} type="button" role="menuitem" style={item} onClick={() => { setMenuOpen(false); setOpenSheet({ paperId: s.paper.id, firstRead: null }) }}>
                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  {houseName(s.paper.supplyHouseId)}
                  {s.paper.number ? ` · ${s.paper.number}` : ''}
                </span>
                <span style={{ color: s.waiting ? 'var(--text-amber-800)' : 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{s.waiting ? (s.waiting === 1 ? '1 waits' : `${s.waiting} wait`) : `${s.filed} filed`}</span>
              </button>
            ))}
            {!bidId || sheets.length > 6 ? (
              <button type="button" role="menuitem" style={{ ...item, color: 'var(--text-link)' }} onClick={() => { setMenuOpen(false); setListOpen(true) }}>
                All price sheets…
              </button>
            ) : null}
          </div>
        ) : null}
      </span>
      {listOpen ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div role="dialog" aria-modal="true" aria-label="Price sheets" style={{ background: 'var(--surface)', borderRadius: 8, width: 'min(820px, 100%)', maxHeight: 'min(90vh, 100%)', overflow: 'auto', padding: '1.25rem 1.5rem', display: 'grid', gap: '0.75rem', alignContent: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
              <h2 style={{ margin: 0 }}>Price sheets</h2>
              <button type="button" onClick={() => setListOpen(false)} style={{ padding: '0.4rem 0.9rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>
                Close
              </button>
            </div>
            {sheets.length === 0 ? (
              <EmptyState compact main="Nothing waiting on a price sheet." tail="Drop a supply house's quote on this tab to read one." />
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Supply house</th>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Quote</th>
                    <th style={{ padding: '0.3rem 0.5rem' }}>For</th>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Read</th>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Rows</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sheets.map((s) => (
                    <tr key={s.paper.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.4rem 0.5rem' }}>{s.paper.supplyHouseId ? houseName(s.paper.supplyHouseId) : 'Not settled yet'}</td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>{s.paper.number || '—'}</td>
                      <td style={{ padding: '0.4rem 0.5rem', overflowWrap: 'anywhere' }}>{s.bidLabel ?? 'No bid'}</td>
                      <td style={{ padding: '0.4rem 0.5rem', whiteSpace: 'nowrap' }}>{shortDay(s.paper.createdAt.slice(0, 10))}</td>
                      <td style={{ padding: '0.4rem 0.5rem', whiteSpace: 'nowrap' }}>
                        {s.filed} of {s.rows} filed{s.waiting ? ` · ${s.waiting === 1 ? '1 waits' : `${s.waiting} wait`}` : ''}
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <button type="button" onClick={() => { setListOpen(false); setOpenSheet({ paperId: s.paper.id, firstRead: null }) }} style={{ border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}
      <input
        ref={fileInput}
        type="file"
        accept=".pdf,.txt,.csv,application/pdf,text/plain"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void startFromFile(file)
        }}
      />
      {note ? (
        <span role={note.tone === 'problem' ? 'alert' : 'status'} data-testid="price-sheet-note" style={{ flexBasis: '100%', padding: '0.4rem 0.65rem', borderRadius: 6, fontSize: '0.8125rem', background: note.tone === 'problem' ? 'var(--bg-red-100)' : 'var(--bg-blue-tint)', color: note.tone === 'problem' ? 'var(--text-red-800)' : 'var(--text-blue-700)' }}>
          {note.text}{' '}
          <button type="button" onClick={() => setNote(null)} style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', textDecoration: 'underline', padding: 0, font: 'inherit' }}>
            Got it
          </button>
        </span>
      ) : null}
      {dragging ? (
        <div style={{ position: 'fixed', inset: 12, zIndex: 1500, pointerEvents: 'none', border: '3px dashed #2563eb', borderRadius: 14, background: 'rgba(37, 99, 235, 0.08)', display: 'grid', placeItems: 'center' }}>
          <span style={{ background: 'var(--surface)', color: 'var(--text-blue-700)', padding: '0.8rem 1.2rem', borderRadius: 10, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.16)' }}>
            {bid ? `Drop it to read it for ${bid.label}` : 'Drop it to read it'}
          </span>
        </div>
      ) : null}
      {quickPrice ? (
        <QuickPriceWindow
          onClose={() => {
            setQuickPrice(null)
            onBookChanged()
          }}
          serviceTypeId={serviceTypeId}
          bid={bid ?? null}
          supplyHouses={supplyHouses}
          knownParts={knownParts}
          initialText={quickPrice.text}
        />
      ) : null}
      {openSheet ? (
        <PriceSheetPanel
          paperId={openSheet.paperId}
          bid={bid ?? null}
          serviceTypeId={serviceTypeId}
          supplyHouses={houses}
          knownParts={parts}
          firstRead={openSheet.firstRead}
          docked={docked}
          takeoff={takeoff}
          onRowOffers={onRowOffers}
          placeRef={placeRef}
          onFold={() => {
            setOpenSheet(null)
            void refreshSheets()
            onBookChanged()
          }}
          onChanged={onBookChanged}
          onGone={() => {
            setOpenSheet(null)
            void refreshSheets()
          }}
        />
      ) : null}
    </>
  )
}
