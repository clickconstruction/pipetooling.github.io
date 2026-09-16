/**
 * The Submittals tab (Submittals stage 2b — to-dos/submittals/README.md):
 * a lens on the product decisions already made on the Pricing compare. One
 * revision at a time, one row per fixture tag: the specified product from the
 * plan's schedule (`bid_specified_products`), the submitted product from the
 * picked quote line, the status, the reason and lead time typed at the pick,
 * the cut-sheet pages, and — after a second revision — what changed. Rows are
 * BUILT from the picks (`buildSubmittalRows`), never typed from scratch;
 * every cell can be edited in place; a new revision carries every row and
 * marks the diff. The package PDF (2c), the page strip (3a) and Share (4a)
 * hang off this same screen. Stage 2c adds the package: the cover table and
 * every row's sheet pages, stamped, as one PDF stored on the revision. Stage
 * 3a adds the sheet strip: the vendor PDF's pages as thumbnails, a tap per
 * page onto a row, and Done with this file — the PDF trimmed to the pages on
 * rows (`trimPdf`), the rows' page numbers rewritten from the map. Stage 4a
 * adds Share: the bid's one review room (a durable link the GC forwards),
 * the people on it, the trail, and Close.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useAuth } from '../../hooks/useAuth'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import type { useBidPreview } from '../../contexts/BidPreviewModalContext'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { bidDisplayName, bidWorkflowTabHeading } from '../../lib/bids/bidFormatting'
import { bidDetailCloseXStyle } from '../../lib/bids/bidStyles'
import { bidNumberMatchesQuery } from '../../lib/ledgerDisplayPrefixes'
import { BidPickerStandardList } from './BidPickerStandardList'
import { BidPickerSortToggle } from './BidPickerSortToggle'
import { MyBidsToggle } from './MyBidsToggle'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'
import { ProductStatusChip } from './ProductStatusChip'
import { SubmittalItemEditDialog, type SubmittalItemPatch } from './SubmittalItemEditDialog'
import { SubmittalSheetStrip, type ThumbState } from './SubmittalSheetStrip'
import { SubmittalShareModal } from './SubmittalShareModal'
import { anonymousOpens, asPersonHow, describeHow, describeRoomLine, describeTrail, personTrail, roomLink, ROOM_ROLE_LABELS, asRoomRole, type SubmittalEventRow, type SubmittalPersonRow, type SubmittalRoomRow } from '../../lib/submittals/submittalRoom'
import { APP_CALENDAR_TZ as ROOM_TZ } from '../../utils/dateUtils'
import { keptPages, remapAfterTrim } from '../../lib/submittals/sheetAssignment'
import { assignmentsFromItems } from '../../lib/submittals/sheetStripModel'
import { buildSubmittalRows, changeNoteFor, summarizeChanges, type PickInput, type SpecifiedInput } from '../../lib/submittals/buildSubmittalRows'
import { needsReason, REASON_LABELS, type StatusOverride } from '../../lib/submittals/productStatus'
import { describeLeadTime } from '../../lib/submittals/leadTime'
import { buildCoverModel, buildSubmittalPackage, packageFileName, planPackage, renderCoverPdf, type PackageRowInput } from '../../lib/submittals/submittalPackage'
import { fetchTestReportSettings } from '../../lib/jobs/testReportSettings'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { fixtureKey, PICK_COLS_ANNOTATED, PICK_COLS_BASE, picksFromQuotes, type RawQuote } from '../../lib/submittals/picksFromQuotes'
import {
  asReason,
  asRevisionStatus,
  asStatus,
  describeRevision,
  describeRevisionChip,
  draftToItemInsert,
  formatPages,
  itemToPrevious,
  needsSheet,
  parseSourceFiles,
  revisionTiles,
  serializeSourceFiles,
  SUBMITTALS_BUCKET,
  type SourceFile,
  type SubmittalItemRow,
  type SubmittalRevisionRow,
} from '../../lib/submittals/submittalRevision'

// The stage 1–2 tables are hand-typed until the regen chore; the untyped client keeps a checkout ahead of the push honest.
const db = supabase as unknown as SupabaseClient

const smallMuted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const btn: CSSProperties = { padding: '0.4rem 0.8rem', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 500 }
const btnPrimary: CSSProperties = { ...btn, background: '#2563eb', borderColor: '#2563eb', color: 'white', fontWeight: 600 }
const btnGreen: CSSProperties = { ...btn, background: '#16a34a', borderColor: '#16a34a', color: 'white', fontWeight: 600 }
const th: CSSProperties = { textAlign: 'left', fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '0.5rem 0.5rem', borderBottom: '1px solid var(--bg-muted)', verticalAlign: 'top', fontSize: '0.8125rem', color: 'var(--text-base)' }
const sub: CSSProperties = { display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }

function Tile({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'green' | 'amber' | 'red' }) {
  const bg = tone === 'green' ? 'var(--bg-green-tint)' : tone === 'amber' ? 'var(--bg-yellow-tint)' : tone === 'red' ? 'var(--bg-red-tint)' : 'var(--surface)'
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.7rem', background: bg, minWidth: 0 }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: '1.15rem', fontWeight: 700, lineHeight: 1.2, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {note ? <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{note}</div> : null}
    </div>
  )
}

export type BidsSubmittalsTabProps = {
  bids: BidWithBuilder[]
  selectedBid: BidWithBuilder | null
  narrowViewport640: boolean
  bidPreview: ReturnType<typeof useBidPreview>
  onSelectBid: (bid: BidWithBuilder) => void
  onClose: () => void
  /** The door to the Pricing tab, where the fixture schedule is plugged in and the prices picked. */
  onOpenPricing?: (bid: BidWithBuilder) => void
  onlyMyBids: boolean
  setOnlyMyBids: (next: boolean) => void
  isMyBid: (bid: BidWithBuilder) => boolean
}

export function BidsSubmittalsTab({ bids, selectedBid, narrowViewport640, bidPreview, onSelectBid, onClose, onOpenPricing, onlyMyBids, setOnlyMyBids, isMyBid }: BidsSubmittalsTabProps) {
  const { showToast } = useToastContext()
  const confirm = useConfirmDialog()
  const { user } = useAuth()
  const prefixMap = useLedgerPrefixMap()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [specified, setSpecified] = useState<SpecifiedInput[]>([])
  const [picks, setPicks] = useState<PickInput[]>([])
  const [overridesByFixture, setOverridesByFixture] = useState<Map<string, StatusOverride>>(() => new Map())
  const [revisions, setRevisions] = useState<SubmittalRevisionRow[]>([])
  const [selectedRevId, setSelectedRevId] = useState<string | null>(null)
  const [items, setItems] = useState<SubmittalItemRow[]>([])
  const [prevItems, setPrevItems] = useState<SubmittalItemRow[]>([])
  const [editing, setEditing] = useState<SubmittalItemRow | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)
  /** Stage 3a: page thumbnails per vendor file, keyed by bucket path; drawn on demand. */
  const [thumbs, setThumbs] = useState<Record<string, ThumbState>>({})
  /** Stage 4a: the bid's review room, the people on it, the events behind the trail. */
  const [room, setRoom] = useState<SubmittalRoomRow | null>(null)
  const [people, setPeople] = useState<SubmittalPersonRow[]>([])
  const [events, setEvents] = useState<SubmittalEventRow[]>([])
  const [sharing, setSharing] = useState(false)

  const bidId = selectedBid?.id ?? null

  const loadRevisions = useCallback(async (id: string): Promise<SubmittalRevisionRow[]> => {
    try {
      const { data, error } = await db.from('bid_submittals').select('*').eq('bid_id', id).order('rev_number', { ascending: false })
      if (error) return []
      return (data ?? []) as SubmittalRevisionRow[]
    } catch {
      return []
    }
  }, [])

  const loadItems = useCallback(async (revId: string): Promise<SubmittalItemRow[]> => {
    try {
      const { data, error } = await db.from('bid_submittal_items').select('*').eq('submittal_id', revId).order('sequence_order')
      if (error) return []
      return (data ?? []) as SubmittalItemRow[]
    } catch {
      return []
    }
  }, [])

  const loadRoom = useCallback(async (id: string) => {
    try {
      const { data: r } = await db.from('bid_submittal_rooms').select('*').eq('bid_id', id).maybeSingle()
      const theRoom = (r as SubmittalRoomRow | null) ?? null
      setRoom(theRoom)
      if (!theRoom) {
        setPeople([])
        setEvents([])
        return
      }
      const [{ data: ps }, { data: es }] = await Promise.all([
        db.from('bid_submittal_people').select('*').eq('room_id', theRoom.id).order('created_at'),
        db.from('bid_submittal_events').select('id, room_id, person_id, submittal_id, event_type, metadata, client_ip, user_agent, occurred_at').eq('room_id', theRoom.id).order('occurred_at', { ascending: false }).limit(500),
      ])
      setPeople((ps ?? []) as SubmittalPersonRow[])
      setEvents((es ?? []) as SubmittalEventRow[])
    } catch {
      setRoom(null)
    }
  }, [])

  const load = useCallback(
    async (id: string) => {
      setLoading(true)
      try {
        // The schedule (a checkout ahead of the stage 1 push reads none).
        try {
          const { data } = await db.from('bid_specified_products').select('tag, fixture, manufacturer, model, description').eq('bid_id', id).order('tag')
          setSpecified(((data ?? []) as SpecifiedInput[]).map((r) => ({ tag: r.tag, fixture: r.fixture, manufacturer: r.manufacturer, model: r.model, description: r.description })))
        } catch {
          setSpecified([])
        }
        // The picks, widest line shape first.
        const selectQuotes = (cols: string) => db.from('bid_quotes').select(`id, supply_house_id, received_at, supply_house:supply_houses(name), bid_quote_lines(${cols})`).eq('bid_id', id).order('received_at')
        let q = await selectQuotes(PICK_COLS_ANNOTATED)
        if (q.error) q = await selectQuotes(PICK_COLS_BASE)
        const derived = picksFromQuotes(((q.error ? [] : q.data) ?? []) as unknown as RawQuote[])
        setPicks(derived.picks)
        setOverridesByFixture(derived.overridesByFixture)
        const revs = await loadRevisions(id)
        setRevisions(revs)
        await loadRoom(id)
        const keep = revs.find((r) => r.id === selectedRevId) ?? revs[0] ?? null
        setSelectedRevId(keep?.id ?? null)
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not load the submittal.', 'error')
      } finally {
        setLoading(false)
      }
    },
    // selectedRevId is read for "keep the selection", never a reason to reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadRevisions, loadRoom, showToast],
  )

  useEffect(() => {
    if (!bidId) {
      setRevisions([])
      setItems([])
      setPrevItems([])
      setSelectedRevId(null)
      return
    }
    void load(bidId)
  }, [bidId, load])

  const selectedRev = useMemo(() => revisions.find((r) => r.id === selectedRevId) ?? null, [revisions, selectedRevId])
  const previousRev = useMemo(() => (selectedRev ? revisions.find((r) => r.rev_number === selectedRev.rev_number - 1) ?? null : null), [revisions, selectedRev])
  const newestRev = revisions[0] ?? null

  useEffect(() => {
    let cancelled = false
    if (!selectedRev) {
      setItems([])
      setPrevItems([])
      return
    }
    void (async () => {
      const [its, prev] = await Promise.all([loadItems(selectedRev.id), previousRev ? loadItems(previousRev.id) : Promise.resolve([] as SubmittalItemRow[])])
      if (cancelled) return
      setItems(its)
      setPrevItems(prev)
    })()
    return () => {
      cancelled = true
    }
  }, [selectedRev, previousRev, loadItems])

  const sourceFiles: SourceFile[] = useMemo(() => parseSourceFiles(selectedRev?.source_files ?? null), [selectedRev])
  const tiles = useMemo(() => revisionTiles(items), [items])
  const prevById = useMemo(() => new Map(prevItems.map((p) => [p.id, p])), [prevItems])
  const overridesByTag = useMemo(() => {
    const out: Record<string, StatusOverride> = {}
    for (const s of specified) {
      const ov = overridesByFixture.get(fixtureKey(s.fixture))
      if (ov) out[s.tag] = ov
    }
    return out
  }, [specified, overridesByFixture])

  /** Build the rows for a revision from today's picks; `previous` carries sheets, reasons and the diff. */
  async function writeRows(revId: string, previous: SubmittalItemRow[]): Promise<number> {
    const rows = buildSubmittalRows({ specified, picks, previous: previous.map(itemToPrevious), overrides: overridesByTag })
    if (rows.length === 0) return 0
    const { error } = await db.from('bid_submittal_items').insert(rows.map((r) => draftToItemInsert(r, revId)))
    if (error) throw error
    return rows.length
  }

  async function createFirstRevision() {
    if (!bidId) return
    setBusy(true)
    try {
      const { data, error } = await db.from('bid_submittals').insert({ bid_id: bidId, rev_number: 1, status: 'draft', created_by: user?.id ?? null }).select('id').single()
      if (error) throw error
      const revId = (data as { id: string }).id
      const n = await writeRows(revId, [])
      setSelectedRevId(revId)
      await load(bidId)
      showToast(`Rev 1 built · ${n} row${n === 1 ? '' : 's'} from the picks.`, 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not build the submittal.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function newRevision() {
    if (!bidId || !newestRev) return
    const previous = newestRev.id === selectedRev?.id ? items : await loadItems(newestRev.id)
    const preview = buildSubmittalRows({ specified, picks, previous: previous.map(itemToPrevious), overrides: overridesByTag })
    const ok = await confirm({
      title: `Rev ${newestRev.rev_number + 1} from today's picks`,
      message: `${summarizeChanges(preview)} against Rev ${newestRev.rev_number}. Sheets, reasons and lead times carry where the product is unchanged.${asRevisionStatus(newestRev.status) === 'draft' ? ` Rev ${newestRev.rev_number} was never shared and will read superseded.` : ''}`,
      confirmLabel: `Build Rev ${newestRev.rev_number + 1}`,
    })
    if (!ok) return
    setBusy(true)
    try {
      const { data, error } = await db
        .from('bid_submittals')
        .insert({ bid_id: bidId, rev_number: newestRev.rev_number + 1, status: 'draft', title: newestRev.title, source_files: newestRev.source_files, created_by: user?.id ?? null })
        .select('id')
        .single()
      if (error) throw error
      const revId = (data as { id: string }).id
      await writeRows(revId, previous)
      if (asRevisionStatus(newestRev.status) === 'draft') {
        const { error: supErr } = await db.from('bid_submittals').update({ status: 'superseded' }).eq('id', newestRev.id)
        if (supErr) throw supErr
      }
      setSelectedRevId(revId)
      await load(bidId)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not build the revision.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function rebuildRows() {
    if (!bidId || !selectedRev) return
    const ok = await confirm({
      title: 'Rebuild the rows from the picks',
      message: 'Rows are rebuilt from today\'s picks on the Pricing compare. Sheets, reasons and lead times carry where the product is unchanged; a row whose product changed starts over.',
      confirmLabel: 'Rebuild',
    })
    if (!ok) return
    setBusy(true)
    try {
      const { error } = await db.from('bid_submittal_items').delete().eq('submittal_id', selectedRev.id)
      if (error) throw error
      await writeRows(selectedRev.id, items)
      setItems(await loadItems(selectedRev.id))
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not rebuild the rows.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function deleteDraft() {
    if (!bidId || !selectedRev) return
    const ok = await confirm({ title: `Delete Rev ${selectedRev.rev_number}`, message: 'This draft and its rows go; files stay in the bucket until the bid is deleted.', confirmLabel: 'Delete', danger: true })
    if (!ok) return
    setBusy(true)
    try {
      const { error } = await db.from('bid_submittals').delete().eq('id', selectedRev.id)
      if (error) throw error
      setSelectedRevId(null)
      await load(bidId)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not delete the draft.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function dropVendorPdf(file: File) {
    if (!bidId || !selectedRev) return
    if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Drop the vendor\'s PDF — other files are not read.', 'error')
      return
    }
    setBusy(true)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const { pageCount } = await import('../../lib/submittals/trimPdf')
      const pages = await pageCount(bytes)
      const index = sourceFiles.length
      const path = `${bidId}/${selectedRev.id}/${index}.pdf`
      const up = await supabase.storage.from(SUBMITTALS_BUCKET).upload(path, bytes, { contentType: 'application/pdf', upsert: true })
      if (up.error) throw up.error
      const next: SourceFile[] = [...sourceFiles, { path, houseId: null, houseName: null, name: file.name, pages, trimmedAt: null, droppedPages: null }]
      const { error } = await db.from('bid_submittals').update({ source_files: serializeSourceFiles(next) }).eq('id', selectedRev.id)
      if (error) throw error
      await load(bidId)
      showToast(`${file.name} · ${pages} page${pages === 1 ? '' : 's'} — tap Show the pages, then a page and its row.`, 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not store the file.', 'error')
    } finally {
      setBusy(false)
    }
  }

  /** The package (stage 2c): cover table + every row's sheet pages, stamped; stored at package-rev<N>.pdf and opened. */
  async function buildPackage(open = true) {
    if (!bidId || !selectedRev) return
    setBusy(true)
    try {
      const settings = await fetchTestReportSettings()
      const rowsIn: PackageRowInput[] = items.map((it) => {
        const reason = asReason(it.reason_kind)
        return {
          tag: it.tag,
          status: asStatus(it.status),
          specified: [it.specified_manufacturer, it.specified_model].filter(Boolean).join(' ') || it.specified_description || '',
          submitted: it.submitted_label ?? it.submitted_model ?? '',
          house: null,
          reason: [reason ? REASON_LABELS[reason] : '', it.reason_note ?? ''].filter(Boolean).join(' · '),
          leadTime: describeLeadTime(it.lead_time_days) ?? '',
          sheetFile: it.sheet_file != null && sourceFiles[it.sheet_file] ? it.sheet_file : null,
          sheetPages: [...(it.sheet_pages ?? [])],
        }
      })
      const coverInput = {
        companyName: settings.companyName,
        companyTagline: settings.companyTagline,
        officePhone: settings.officePhone,
        bidLabel: bidWorkflowTabHeading(bid, prefixMap),
        projectAddress: bid.address ?? null,
        gcName: bid.customers?.name ?? bid.bids_gc_builders?.name ?? null,
        revNumber: selectedRev.rev_number,
        dateLabel: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: APP_CALENDAR_TZ }),
        note: selectedRev.note,
      }
      // The cover's page count decides the sheets' page numbers; render twice only if the cover ran long.
      let plan = planPackage(rowsIn, 1)
      let cover = await renderCoverPdf(buildCoverModel(coverInput, plan), settings)
      if (cover.pages !== plan.coverPages) {
        plan = planPackage(rowsIn, cover.pages)
        cover = await renderCoverPdf(buildCoverModel(coverInput, plan), settings)
      }
      const needed = new Set(plan.rows.filter((r) => r.startPage != null).map((r) => r.sheetFile as number))
      const files: Array<Uint8Array | ArrayBuffer> = []
      for (const i of needed) {
        const f = sourceFiles[i]
        if (!f) continue
        const { data, error } = await supabase.storage.from(SUBMITTALS_BUCKET).download(f.path)
        if (error || !data) continue
        files[i] = await data.arrayBuffer()
      }
      const sheets = plan.rows.filter((r) => r.startPage != null).map((r) => ({ tag: r.tag, status: r.status, title: r.submitted, fileIndex: r.sheetFile as number, pages: r.sheetPages }))
      const result = await buildSubmittalPackage(cover.blob, files, sheets)
      const path = `${bidId}/${selectedRev.id}/package-rev${selectedRev.rev_number}.pdf`
      const up = await supabase.storage.from(SUBMITTALS_BUCKET).upload(path, result.blob, { contentType: 'application/pdf', upsert: true })
      if (up.error) throw up.error
      const { error } = await db.from('bid_submittals').update({ package_path: path }).eq('id', selectedRev.id)
      if (error) throw error
      const skipped = result.skipped.length > 0 ? ` · could not read the sheet for ${result.skipped.join(', ')}` : ''
      const owed = plan.rowsWithoutSheet.length > 0 ? ` · ${plan.rowsWithoutSheet.length} row${plan.rowsWithoutSheet.length === 1 ? '' : 's'} still owe a sheet` : ''
      showToast(`Rev ${selectedRev.rev_number} package · ${result.totalPages} page${result.totalPages === 1 ? '' : 's'} · ${result.manifest.length} sheet${result.manifest.length === 1 ? '' : 's'}${owed}${skipped}`, 'success')
      if (open) await openStoredPackage(path, selectedRev.rev_number, result.blob)
      await load(bidId)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not build the package.', 'error')
    } finally {
      setBusy(false)
    }
  }

  /** A five-minute signed link to the stored package; the fresh blob as the fallback when the link cannot be minted. */
  async function openStoredPackage(path: string, revNumber: number, fallback?: Blob) {
    const name = packageFileName(revNumber, bidWorkflowTabHeading(bid, prefixMap))
    const { data } = await supabase.storage.from(SUBMITTALS_BUCKET).createSignedUrl(path, 300, { download: name })
    const url = data?.signedUrl ?? (fallback ? URL.createObjectURL(fallback) : null)
    if (!url) {
      showToast('The package is stored, but the link could not be opened right now.', 'error')
      return
    }
    window.open(url, '_blank', 'noopener')
  }

  // ---------- stage 3a · the sheet strip ----------

  async function downloadFile(path: string): Promise<ArrayBuffer> {
    const { data, error } = await supabase.storage.from(SUBMITTALS_BUCKET).download(path)
    if (error || !data) throw error ?? new Error('Could not read the file.')
    return data.arrayBuffer()
  }

  async function showPages(fileIndex: number) {
    const f = sourceFiles[fileIndex]
    if (!f) return
    setThumbs((t) => ({ ...t, [f.path]: 'loading' }))
    try {
      const bytes = await downloadFile(f.path)
      const { renderPdfThumbnails } = await import('../../lib/submittals/pdfThumbnails')
      const urls = await renderPdfThumbnails(bytes)
      setThumbs((t) => ({ ...t, [f.path]: urls }))
    } catch {
      setThumbs((t) => ({ ...t, [f.path]: 'error' }))
      showToast('Could not draw the pages — the file may not be a readable PDF.', 'error')
    }
  }

  async function writeItemPages(itemId: string, fileIndex: number | null, pages: number[]) {
    const { error } = await db.from('bid_submittal_items').update({ sheet_file: pages.length > 0 ? fileIndex : null, sheet_pages: pages, sheet_source: pages.length > 0 ? 'estimator' : null }).eq('id', itemId)
    if (error) throw error
  }

  /** A page joins the row's sheet; a row's sheet lives in one file, so a page from another file starts it over. */
  async function assignPageToItem(fileIndex: number, page: number, itemId: string) {
    const it = items.find((i) => i.id === itemId)
    if (!it || !selectedRev) return
    const sameFile = it.sheet_file === fileIndex
    const pages = sameFile ? [...new Set([...(it.sheet_pages ?? []), page])].sort((a, b) => a - b) : [page]
    try {
      await writeItemPages(itemId, fileIndex, pages)
      setItems(await loadItems(selectedRev.id))
      if (!sameFile && (it.sheet_pages ?? []).length > 0) showToast(`${it.tag.trim() || 'The accessory'} now reads from ${sourceFiles[fileIndex]?.name ?? 'this file'}; its earlier pages were let go.`, 'info')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save the page.', 'error')
    }
  }

  async function unassignPageFromItem(fileIndex: number, page: number, itemId: string) {
    const it = items.find((i) => i.id === itemId)
    if (!it || !selectedRev || it.sheet_file !== fileIndex) return
    const pages = (it.sheet_pages ?? []).filter((p) => p !== page)
    try {
      await writeItemPages(itemId, fileIndex, pages)
      setItems(await loadItems(selectedRev.id))
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save the page.', 'error')
    }
  }

  /**
   * Done with this file: keep the pages on rows, let the rest go, rewrite the rows' page
   * numbers. Takes the files and rows as arguments (not state) so Share can trim several
   * files in a row without a stale closure overwriting the first trim's record; returns
   * the next files and rows.
   */
  async function trimFile(files: SourceFile[], rows: SubmittalItemRow[], fileIndex: number): Promise<{ files: SourceFile[]; rows: SubmittalItemRow[] }> {
    const f = files[fileIndex]
    if (!f || !selectedRev) return { files, rows }
    const state = assignmentsFromItems(rows)
    const kept = keptPages(state, fileIndex)
    if (kept.length === 0) return { files, rows }
    const bytes = await downloadFile(f.path)
    const { trimPdf } = await import('../../lib/submittals/trimPdf')
    const result = await trimPdf(bytes, kept)
    const up = await supabase.storage.from(SUBMITTALS_BUCKET).upload(f.path, result.bytes, { contentType: 'application/pdf', upsert: true })
    if (up.error) throw up.error
    const next = remapAfterTrim(state, fileIndex, result.map)
    const nextRows: SubmittalItemRow[] = []
    for (const it of rows) {
      if (it.sheet_file !== fileIndex) {
        nextRows.push(it)
        continue
      }
      const pages = next.filter((a) => a.fileIndex === fileIndex && a.tag === it.id).map((a) => a.page)
      await writeItemPages(it.id, fileIndex, pages)
      nextRows.push({ ...it, sheet_pages: pages, sheet_file: pages.length > 0 ? fileIndex : null })
    }
    const nextFiles: SourceFile[] = files.map((sf, i) => (i === fileIndex ? { ...sf, pages: result.kept, trimmedAt: new Date().toISOString(), droppedPages: result.dropped } : sf))
    const { error } = await db.from('bid_submittals').update({ source_files: serializeSourceFiles(nextFiles) }).eq('id', selectedRev.id)
    if (error) throw error
    setThumbs((t) => {
      const copy = { ...t }
      delete copy[f.path]
      return copy
    })
    showToast(`${f.name}: ${result.kept} page${result.kept === 1 ? '' : 's'} kept on rows · ${result.dropped} let go.`, 'success')
    return { files: nextFiles, rows: nextRows }
  }

  async function doneWithFile(fileIndex: number) {
    if (!bidId || !selectedRev) return
    setBusy(true)
    try {
      await trimFile(sourceFiles, items, fileIndex)
      await load(bidId)
      setItems(await loadItems(selectedRev.id))
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not trim the file.', 'error')
    } finally {
      setBusy(false)
    }
  }

  /** Remove a file nothing landed from; later files shift down one and their rows follow. */
  async function removeFile(fileIndex: number) {
    const f = sourceFiles[fileIndex]
    if (!f || !bidId || !selectedRev) return
    const ok = await confirm({ title: `Remove ${f.name}`, message: 'Nothing from this file is on a row. The file leaves the revision.', confirmLabel: 'Remove', danger: true })
    if (!ok) return
    setBusy(true)
    try {
      await supabase.storage.from(SUBMITTALS_BUCKET).remove([f.path])
      const files = sourceFiles.filter((_, i) => i !== fileIndex)
      for (const it of items) {
        if (it.sheet_file == null) continue
        if (it.sheet_file > fileIndex) await writeItemPages(it.id, it.sheet_file - 1, it.sheet_pages ?? [])
        else if (it.sheet_file === fileIndex) await writeItemPages(it.id, null, [])
      }
      const { error } = await db.from('bid_submittals').update({ source_files: serializeSourceFiles(files) }).eq('id', selectedRev.id)
      if (error) throw error
      await load(bidId)
      setItems(await loadItems(selectedRev.id))
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not remove the file.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // ---------- stage 4a · the room ----------

  async function setMayDecide(personId: string, mayDecide: boolean) {
    try {
      const { error } = await db.from('bid_submittal_people').update({ may_decide: mayDecide }).eq('id', personId)
      if (error) throw error
      if (bidId) await loadRoom(bidId)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save.', 'error')
    }
  }

  async function closePerson(personId: string) {
    const p = people.find((x) => x.id === personId)
    if (!p || !bidId) return
    const ok = await confirm({ title: `Close ${p.name}'s link`, message: 'Their personal link stops working; the room link is untouched. Their decisions stay on the record.', confirmLabel: 'Close it', danger: true })
    if (!ok) return
    try {
      const { error } = await db.from('bid_submittal_people').update({ closed_at: new Date().toISOString() }).eq('id', personId)
      if (error) throw error
      await loadRoom(bidId)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not close the link.', 'error')
    }
  }

  async function closeRoom() {
    if (!room || !bidId) return
    const ok = await confirm({ title: 'Close the review room', message: 'Every link to this bid\'s submittals reads "this review is closed". The decisions and the packages stay on the record. Reopen from here if you need to.', confirmLabel: 'Close the room', danger: true })
    if (!ok) return
    try {
      const { error } = await db.from('bid_submittal_rooms').update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: user?.id ?? null }).eq('id', room.id)
      if (error) throw error
      await db.from('bid_submittal_events').insert({ room_id: room.id, event_type: 'closed', metadata: { by: user?.id ?? null } })
      await loadRoom(bidId)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not close the room.', 'error')
    }
  }

  async function reopenRoom() {
    if (!room || !bidId) return
    try {
      const { error } = await db.from('bid_submittal_rooms').update({ status: 'open', closed_at: null, closed_by: null }).eq('id', room.id)
      if (error) throw error
      await loadRoom(bidId)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not reopen the room.', 'error')
    }
  }

  /** Share's "before it goes": Done with this file for every untrimmed vendor file that has pages on rows. */
  async function doneWithAllFiles() {
    if (!bidId || !selectedRev) return
    let snap = { files: sourceFiles, rows: items }
    for (let i = 0; i < snap.files.length; i++) {
      const f = snap.files[i]
      if (!f || f.trimmedAt) continue
      if (keptPages(assignmentsFromItems(snap.rows), i).length === 0) continue
      snap = await trimFile(snap.files, snap.rows, i)
    }
    await load(bidId)
    setItems(await loadItems(selectedRev.id))
  }

  async function saveItem(patch: SubmittalItemPatch) {
    if (!editing || !selectedRev) return
    try {
      const { error } = await db.from('bid_submittal_items').update(patch).eq('id', editing.id)
      if (error) throw error
      setEditing(null)
      setItems(await loadItems(selectedRev.id))
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save the row.', 'error')
    }
  }

  const visibleBids = (onlyMyBids ? bids.filter(isMyBid) : bids).filter((b) => {
    const q = query.toLowerCase()
    if (!q) return true
    return bidDisplayName(b).toLowerCase().includes(q) || (b.customers?.name ?? '').toLowerCase().includes(q) || (b.bids_gc_builders?.name ?? '').toLowerCase().includes(q) || bidNumberMatchesQuery(b, query, prefixMap)
  })

  if (!selectedBid) {
    return (
      <div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          <input type="text" placeholder="Search bids (bid #, project name, or GC/Builder)..." value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }} />
          <BidPickerSortToggle />
          <MyBidsToggle active={onlyMyBids} onChange={setOnlyMyBids} />
        </div>
        <BidPickerStandardList bids={visibleBids} prefixMap={prefixMap} onSelectBid={onSelectBid} emptyMessage={bids.length === 0 ? 'No bids yet.' : onlyMyBids ? 'No bids you are the account manager or estimator for.' : 'No bids match your search.'} />
      </div>
    )
  }

  const bid = selectedBid
  const isDraft = selectedRev ? asRevisionStatus(selectedRev.status) === 'draft' : false
  const isNewest = selectedRev != null && newestRev != null && selectedRev.id === newestRev.id

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <BidWorkflowTabTitleWithPreview bid={bid} previewEnabled={bidPreview != null} onOpenPreview={() => bidPreview?.openBidPreviewFromBid(bid)} h2Style={{ margin: 0, fontSize: '1.15rem' }} />
          <p style={{ margin: '0.2rem 0 0', ...smallMuted }}>
            Submittals · plumbing fixtures &amp; equipment · {specified.length} tag{specified.length === 1 ? '' : 's'} on the schedule · {picks.length} picked line{picks.length === 1 ? '' : 's'}
            {onOpenPricing ? (
              <>
                {' · '}
                <button type="button" onClick={() => onOpenPricing(bid)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' }}>
                  {specified.length === 0 ? 'plug in the fixture schedule on Pricing' : 'the picks on Pricing'}
                </button>
              </>
            ) : null}
          </p>
        </div>
        {!narrowViewport640 ? (
          <button type="button" onClick={onClose} title="Close" aria-label="Close" style={bidDetailCloseXStyle}>
            ×
          </button>
        ) : null}
      </div>

      {loading ? <p style={smallMuted}>Loading…</p> : null}

      {!loading && revisions.length === 0 ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', maxWidth: 640 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-strong)' }}>No submittal on this bid yet</h3>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-base)', lineHeight: 1.45 }}>
            Rev 1 is built from what Pricing already knows: one row per tag on the fixture schedule, the product from the house you picked, the status against the schedule, and the reason and lead time you gave at the pick. Picks that match no tag become accessory rows.
          </p>
          {specified.length === 0 ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-amber-700)' }}>No fixture schedule on this bid — plug it in on Pricing first, or Rev 1 will be accessories only.</p> : null}
          {picks.length === 0 ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-amber-700)' }}>No picked quote lines — every tag will read missing until a house is picked on the compare.</p> : null}
          <div>
            <button type="button" disabled={busy || (specified.length === 0 && picks.length === 0)} onClick={() => void createFirstRevision()} style={{ ...btnPrimary, opacity: busy || (specified.length === 0 && picks.length === 0) ? 0.6 : 1 }}>
              Build Rev 1 from the picks
            </button>
          </div>
        </div>
      ) : null}

      {selectedRev ? (
        <>
          {room ? (
            <div style={{ border: '1px solid var(--border-blue)', background: room.status === 'closed' ? 'var(--bg-muted)' : 'var(--bg-blue-tint)', borderRadius: 8, padding: '0.55rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }} data-testid="room-line">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>{describeRoomLine(room, events.filter((e) => e.event_type === 'view').length, ROOM_TZ)}</span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {room.status === 'open' ? (
                    <>
                      <button type="button" onClick={() => void navigator.clipboard.writeText(roomLink(window.location.origin, room.token)).then(() => showToast('Link copied.', 'success'), () => showToast(roomLink(window.location.origin, room.token), 'info'))} style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}>
                        Copy link
                      </button>
                      <button type="button" onClick={() => void closeRoom()} style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Close the room
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => void reopenRoom()} style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}>
                      Reopen
                    </button>
                  )}
                </div>
              </div>
              {people.filter((p) => !p.closed_at).length > 0 || anonymousOpens(events) > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '0.3rem 0.75rem', alignItems: 'center', fontSize: '0.78rem' }} data-testid="room-people">
                  {people.filter((p) => !p.closed_at).map((p) => {
                    const t = personTrail(p.id, events, items.filter((it) => it.reviewed_by_person_id === p.id).length)
                    return (
                      <div key={p.id} style={{ display: 'contents' }}>
                        <span><b style={{ color: 'var(--text-strong)' }}>{p.name}</b> <span style={smallMuted}>· {ROOM_ROLE_LABELS[asRoomRole(p.role)]}</span></span>
                        <span style={smallMuted}>{describeHow(asPersonHow(p.how))} · {describeTrail(t, ROOM_TZ)}</span>
                        <span style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden', fontSize: '0.7rem' }} role="group" aria-label={`${p.name} may`}>
                          <button type="button" aria-pressed={p.may_decide} onClick={() => void setMayDecide(p.id, true)} style={{ padding: '0.15rem 0.5rem', border: 'none', cursor: 'pointer', font: 'inherit', background: p.may_decide ? '#16a34a' : 'var(--surface)', color: p.may_decide ? 'white' : 'var(--text-muted)', fontWeight: p.may_decide ? 700 : 500 }}>deciding</button>
                          <button type="button" aria-pressed={!p.may_decide} onClick={() => void setMayDecide(p.id, false)} style={{ padding: '0.15rem 0.5rem', border: 'none', cursor: 'pointer', font: 'inherit', background: !p.may_decide ? 'var(--text-strong)' : 'var(--surface)', color: !p.may_decide ? 'white' : 'var(--text-muted)', fontWeight: !p.may_decide ? 700 : 500 }}>watching</button>
                        </span>
                        <span style={{ display: 'flex', gap: '0.3rem' }}>
                          {p.token ? (
                            <button type="button" onClick={() => void navigator.clipboard.writeText(roomLink(window.location.origin, p.token as string)).then(() => showToast('Personal link copied.', 'success'), () => showToast(roomLink(window.location.origin, p.token as string), 'info'))} style={{ ...btn, padding: '0.1rem 0.45rem', fontSize: '0.7rem' }}>
                              Personal link
                            </button>
                          ) : null}
                          <button type="button" aria-label={`Close ${p.name}'s link`} onClick={() => void closePerson(p.id)} style={{ ...btn, padding: '0.1rem 0.45rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            ×
                          </button>
                        </span>
                      </div>
                    )
                  })}
                  {anonymousOpens(events) > 0 ? (
                    <div style={{ display: 'contents' }}>
                      <span style={smallMuted}>+ {anonymousOpens(events)} open{anonymousOpens(events) === 1 ? '' : 's'}</span>
                      <span style={smallMuted}>by people who did not say who they were</span>
                      <span />
                      <span />
                    </div>
                  ) : null}
                </div>
              ) : (
                <span style={smallMuted}>Nobody has identified themselves yet. Anyone with the link can read; deciding or asking asks who they are.</span>
              )}
            </div>
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }} data-testid="revision-strip">
              {revisions.map((r) => {
                const on = r.id === selectedRev.id
                return (
                  <button key={r.id} type="button" data-testid="revision-chip" aria-pressed={on} onClick={() => setSelectedRevId(r.id)} style={{ ...btn, padding: '0.25rem 0.65rem', borderRadius: 999, fontSize: '0.75rem', background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', borderColor: on ? '#2563eb' : 'var(--border-strong)', color: on ? 'var(--text-blue-700)' : 'var(--text-muted)', fontWeight: on ? 700 : 500 }}>
                    {describeRevisionChip(r)}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {isDraft ? (
                <button type="button" disabled={busy} onClick={() => void rebuildRows()} style={btn} title="Rebuild every row from today's picks; edits carry where the product is unchanged">
                  Rebuild rows from picks
                </button>
              ) : null}
              <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} style={btn} title="Store the house's submittal PDF on this revision; name each row's pages with Edit">
                Drop a vendor PDF
              </button>
              <input ref={fileInput} type="file" accept="application/pdf,.pdf" aria-label="Vendor PDF" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void dropVendorPdf(f) }} />
              {items.length > 0 ? (
                <button type="button" disabled={busy} onClick={() => void buildPackage()} style={btn} title="The cover table, then every row's sheet pages stamped with tag and status — stored on this revision and opened">
                  {selectedRev.package_path ? 'Rebuild package' : 'Build package'}
                </button>
              ) : null}
              {selectedRev.package_path ? (
                <button type="button" disabled={busy} onClick={() => void openStoredPackage(selectedRev.package_path as string, selectedRev.rev_number)} style={btn}>
                  Open package
                </button>
              ) : null}
              {isDraft && isNewest ? (
                <button type="button" disabled={busy} onClick={() => void deleteDraft()} style={{ ...btn, color: 'var(--text-red-700)' }}>
                  Delete draft
                </button>
              ) : null}
              {items.length > 0 && isNewest ? (
                <button type="button" disabled={busy || room?.status === 'closed'} onClick={() => setSharing(true)} style={btnPrimary} title={room ? 'Mark this revision shared; the room link shows it' : 'Mint the bid\'s review room and copy its link'}>
                  {asRevisionStatus(selectedRev.status) === 'shared' ? 'Shared · share again' : 'Share'}
                </button>
              ) : null}
              <button type="button" disabled={busy || !isNewest} onClick={() => void newRevision()} style={{ ...btnGreen, opacity: !isNewest ? 0.5 : 1 }} title={isNewest ? 'Carry every row into a new draft and mark what changed' : 'Only the newest revision can be revised'}>
                New revision
              </button>
            </div>
          </div>

          <div data-testid="submittal-tiles" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.5rem' }}>
            <Tile label="Rows" value={String(tiles.rows)} note={`${tiles.tagged} on the schedule · ${tiles.accessories} accessor${tiles.accessories === 1 ? 'y' : 'ies'}`} />
            <Tile label="As specified" value={String(tiles.asSpecified)} note={tiles.superseded + tiles.equal > 0 ? `+ ${tiles.superseded} superseded · ${tiles.equal} equal` : undefined} tone="green" />
            <Tile label="Alternates" value={String(tiles.alternates)} note={tiles.alternatesWithoutReason > 0 ? `${tiles.alternatesWithoutReason} still need a reason` : tiles.alternates > 0 ? 'every one has a reason' : undefined} tone={tiles.alternatesWithoutReason > 0 ? 'amber' : undefined} />
            <Tile label="Design change" value={String(tiles.designChanges)} note={tiles.designChangesWithoutReason > 0 ? `${tiles.designChangesWithoutReason} still need a reason` : undefined} tone={tiles.designChanges > 0 ? 'red' : undefined} />
            <Tile label="Missing" value={String(tiles.missing)} note={tiles.missing > 0 ? 'specified, nobody quoted it' : undefined} tone={tiles.missing > 0 ? 'red' : undefined} />
            <Tile label="Cut sheets in" value={`${tiles.sheetsIn} of ${tiles.sheetsWanted}`} note={tiles.sheetsNeeded > 0 ? `${tiles.sheetsNeeded} needed` : tiles.sheetsWanted > 0 ? 'all in' : undefined} tone={tiles.sheetsNeeded > 0 && tiles.sheetsIn > 0 ? 'amber' : undefined} />
          </div>

          <p style={{ margin: 0, ...smallMuted }} data-testid="revision-line">
            <b style={{ color: 'var(--text-strong)' }}>{describeRevisionChip(selectedRev)}</b> · {describeRevision(tiles)}
            {selectedRev.note ? ` · ${selectedRev.note}` : ''}
            {selectedRev.package_path ? <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}> · package built</span> : null}
          </p>

          {sourceFiles.length > 0 ? (
            <SubmittalSheetStrip files={sourceFiles} items={items} thumbnails={thumbs} busy={busy} onNeedThumbnails={(i) => void showPages(i)} onAssign={(f, p, id) => void assignPageToItem(f, p, id)} onUnassign={(f, p, id) => void unassignPageFromItem(f, p, id)} onDone={(i) => void doneWithFile(i)} onRemove={(i) => void removeFile(i)} />
          ) : null}

          <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflowX: 'auto', background: 'var(--surface)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={th}>Tag</th>
                  <th style={th}>Specified</th>
                  <th style={th}>Submitted</th>
                  <th style={th}>Status</th>
                  <th style={th}>Reason</th>
                  <th style={th}>Lead time</th>
                  <th style={th}>Sheet</th>
                  {previousRev ? <th style={th}>Since Rev {previousRev.rev_number}</th> : null}
                  <th style={th} />
                </tr>
              </thead>
              <tbody data-testid="submittal-rows">
                {items.length === 0 ? (
                  <tr>
                    <td style={td} colSpan={9}>
                      <span style={smallMuted}>No rows on this revision.</span>
                    </td>
                  </tr>
                ) : null}
                {items.map((it) => {
                  const status = asStatus(it.status)
                  const reason = asReason(it.reason_kind)
                  const lead = describeLeadTime(it.lead_time_days)
                  const file = it.sheet_file != null ? sourceFiles[it.sheet_file] ?? null : null
                  const prev = it.carried_from_item_id ? prevById.get(it.carried_from_item_id) ?? null : null
                  const note = previousRev ? changeNoteFor(prev ? itemToPrevious(prev) : null, { submittedModel: it.submitted_model, submittedLabel: it.submitted_label, status, reasonKind: reason }) : null
                  const specText = [it.specified_manufacturer, it.specified_model].filter(Boolean).join(' ')
                  return (
                    <tr key={it.id} data-testid="submittal-row" style={{ background: status === 'design_change' ? 'var(--bg-red-tint)' : undefined }}>
                      <td style={{ ...td, fontWeight: 700, color: it.tag.trim() ? 'var(--text-strong)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{it.tag.trim() || '—'}</td>
                      <td style={td}>
                        {specText || (it.tag.trim() ? '—' : <span style={smallMuted}>not on the schedule</span>)}
                        {it.specified_description ? <span style={sub}>{it.specified_description}</span> : null}
                      </td>
                      <td style={td}>
                        {it.submitted_label ?? it.submitted_model ?? <span style={{ color: 'var(--text-faint)' }}>—</span>}
                        {it.submitted_label && it.submitted_model && it.submitted_label !== it.submitted_model ? <span style={sub}>{it.submitted_model}</span> : null}
                      </td>
                      <td style={td}>
                        <ProductStatusChip status={status} size="md" />
                      </td>
                      <td style={td}>
                        {reason ? REASON_LABELS[reason] : needsReason(status) ? <span style={{ color: 'var(--text-amber-700)', fontWeight: 600 }}>say why</span> : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                        {it.reason_note ? <span style={sub}>{it.reason_note}</span> : null}
                      </td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{lead ?? <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                      <td style={td}>
                        {file && (it.sheet_pages ?? []).length > 0 ? (
                          <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>
                            ✓ {formatPages(it.sheet_pages)}
                            <span style={sub}>{file.name}</span>
                          </span>
                        ) : needsSheet(it) ? (
                          <span style={{ color: 'var(--text-amber-700)', fontWeight: 600 }}>sheet needed</span>
                        ) : (
                          <span style={{ color: 'var(--text-faint)' }}>—</span>
                        )}
                      </td>
                      {previousRev ? <td style={{ ...td, color: note ? 'var(--text-amber-700)' : 'var(--text-faint)', fontWeight: note ? 600 : 400 }}>{note ?? 'carried'}</td> : null}
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button type="button" aria-label={`Edit ${it.tag.trim() || 'accessory'}`} onClick={() => setEditing(it)} style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {editing ? <SubmittalItemEditDialog item={editing} sourceFiles={sourceFiles} onSave={(p) => void saveItem(p)} onClose={() => setEditing(null)} /> : null}
      {sharing && selectedRev && bidId ? (
        <SubmittalShareModal
          bidId={bidId}
          revision={selectedRev}
          room={room}
          untrimmedFiles={sourceFiles.filter((f, i) => !f.trimmedAt && keptPages(assignmentsFromItems(items), i).length > 0).length}
          onClose={() => setSharing(false)}
          onDoneWithFiles={doneWithAllFiles}
          onBuildPackage={() => buildPackage(false)}
          onShared={(r) => {
            setSharing(false)
            setRoom(r)
            void load(bidId)
          }}
        />
      ) : null}
    </div>
  )
}
