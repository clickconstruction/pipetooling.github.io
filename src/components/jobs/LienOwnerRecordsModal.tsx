import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { formatDenverCalendarDayWithYear, formatDenverTimeOnly, formatWorkDateYmdFriendly } from '../../utils/dateUtils'
import { formatCurrency, formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { fileSentCopy, printAndFile } from '../../lib/sent/sentCopiesIo'
import { saveBlobAs } from '../../lib/storageSave'
import { ownerPacketPdfBlob, ownerPacketPdfFilename } from '../../lib/jobs/ownerRecordsPdf'
import { mintCustomerPortalLink } from '../../lib/portal/mintCustomerPortalLink'
import type { SentFiling, SentHow } from '../../lib/sent/sentCopies'
import {
  EMPTY_OWNER_RECORDS,
  OWNER_RECORDS_HOW_WORDS,
  OWNER_RECORDS_LEFT_OUT,
  OWNER_RECORDS_SENT_HOW_WORDS,
  buildOwnerPacket,
  ownerRecordsSentHows,
  ownerPacketNumbers,
  ownerRecordsFootWords,
  ownerRecordsMissing,
  ownerRecordsPropertyMatches,
  ownerRecordsRowForJob,
  ownerRecordsSteps,
  type OwnerPacketJobInput,
  type OwnerRecordsFile,
  type OwnerRecordsHow,
  type OwnerRecordsPropertyRow,
  type OwnerRecordsSentHow,
  type OwnerRecordsStep,
} from '../../lib/jobs/ownerRecords'
import { OWNER_RECORDS_NO_ADDRESS, ownerAcknowledgmentHtml, ownerPacketHtml, ownerPaymentWhen, type OwnerRecordsDocFacts, type OwnerRecordsDocFormat } from '../../lib/jobs/ownerRecordsDocs'
import { loadOwnerPacketJobs, loadOwnerRecords, saveOwnerRecords } from '../../lib/jobs/ownerRecordsIo'

/**
 * An owner asked for our records (v2.4544). Opened from the Lien desk's title bar: pick the
 * owner and the property, then four checks on the left and that property's packet on the
 * right. The packet prints at any time; it is recorded as sent only once the request is in
 * writing, the leader has read our contract with the GC, and the owner's acknowledgment is
 * signed. The rules are `lib/jobs/ownerRecords`; the papers are `ownerRecordsDocs`.
 */

export type OwnerRecordsSeedJob = { jobId: string; customerId: string | null; addressId: string | null; gcId: string | null }

/** How the window's "how it went" reads in the record of what was sent. */
const SENT_HOW_OF: Record<OwnerRecordsSentHow, SentHow> = { handed: 'hand', email: 'email', mail: 'mail', portal: 'link' }

const fmt: OwnerRecordsDocFormat = {
  day: (ymd) => formatWorkDateYmdFriendly(ymd),
  dateTime: (iso) => {
    const ms = Date.parse(iso)
    return Number.isFinite(ms) ? `${formatDenverCalendarDayWithYear(ms)}, ${formatDenverTimeOnly(ms)}` : ''
  },
  money: (n) => `$${formatCurrency(n)}`,
}

const lab: CSSProperties = { fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }
const input: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', minWidth: 0 }
const btn = (kind: 'primary' | 'plain', disabled = false): CSSProperties => ({
  padding: '5px 12px',
  borderRadius: 7,
  border: `1px solid ${kind === 'plain' ? 'var(--border-strong)' : 'transparent'}`,
  background: kind === 'plain' ? 'var(--surface)' : '#2563eb',
  color: kind === 'plain' ? 'var(--text-700)' : '#fff',
  font: 'inherit',
  fontSize: '0.8125rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
})
const linkBtn: CSSProperties = { border: 'none', background: 'none', padding: 0, color: 'var(--text-link)', font: 'inherit', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }

const STEP_MARK: Record<OwnerRecordsStep['state'], { glyph: string; color: string }> = {
  done: { glyph: '✓', color: 'var(--text-green-700)' },
  todo: { glyph: '○', color: 'var(--text-muted)' },
  warn: { glyph: '!', color: 'var(--text-amber-800)' },
}

export default function LienOwnerRecordsModal({
  open,
  properties,
  seedFor,
  claimsByJob,
  company,
  todayYmd,
  authName,
  isLeader,
  isMobile = false,
  initialJobId = null,
  onClose,
}: {
  open: boolean
  /** The properties with a lien record, folded by owner and property (`ownerRecordsProperties`). */
  properties: ReadonlyArray<OwnerRecordsPropertyRow>
  /** The job behind a picked row: its owner, its saved property and its GC. */
  seedFor: (jobId: string) => OwnerRecordsSeedJob | null
  /** Each job's notice claim, by job id; absent when the job has no notice. */
  claimsByJob: Readonly<Record<string, number | null | undefined>>
  company: string
  todayYmd: string
  authName: string
  isLeader: boolean
  isMobile?: boolean
  /** A door's job (punch list #86, the Dashboard's line): open on the property holding it once the rows are in. */
  initialJobId?: string | null
  onClose: () => void
}) {
  const { showToast } = useToastContext()
  /** The packet PDF is being drawn (v2.4619). */
  const [pdfBusy, setPdfBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<OwnerRecordsPropertyRow | null>(null)
  const [jobs, setJobs] = useState<OwnerPacketJobInput[] | null>(null)
  const [gcIds, setGcIds] = useState<string[]>([])
  const [file, setFile] = useState<OwnerRecordsFile>(EMPTY_OWNER_RECORDS)
  const [rowId, setRowId] = useState<string | null>(null)
  const [available, setAvailable] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  // The two small forms: the request (step 1) and the signed acknowledgment (step 4).
  const [editing, setEditing] = useState<'request' | 'acknowledgment' | 'offer' | null>(null)
  /** Offer it on their portal (punch list #86): a second name allowed to sign, typed before the link is made. */
  const [alsoAllowed, setAlsoAllowed] = useState('')
  const [offerBusy, setOfferBusy] = useState(false)
  const [reqOn, setReqOn] = useState(todayYmd)
  const [reqHow, setReqHow] = useState<OwnerRecordsHow>('email')
  const [reqFrom, setReqFrom] = useState('')
  const [reqLink, setReqLink] = useState('')
  const [ackOn, setAckOn] = useState(todayYmd)
  const [ackLink, setAckLink] = useState('')
  const [sentHow, setSentHow] = useState<OwnerRecordsSentHow>('handed')

  useEffect(() => {
    if (open) return
    setPicked(null)
    setQuery('')
  }, [open])

  // A door's job (punch list #86): land on its property once the desk's rows hold it, once per opening.
  // A job the rows never hold leaves the picker, as the desk's own button opens it.
  const landedRef = useRef(false)
  useEffect(() => {
    if (!open) {
      landedRef.current = false
      return
    }
    if (landedRef.current || !initialJobId || picked) return
    const row = ownerRecordsRowForJob(properties, initialJobId)
    if (!row) return
    landedRef.current = true
    setPicked(row)
  }, [open, initialJobId, properties, picked])

  const seed = picked ? seedFor(picked.seedJobId) : null
  useEffect(() => {
    if (!open || !picked || !seed) return
    let cancelled = false
    setJobs(null)
    setLoadError('')
    setFile(EMPTY_OWNER_RECORDS)
    setRowId(null)
    setEditing(null)
    void (async () => {
      try {
        const loaded = await loadOwnerPacketJobs({ id: seed.jobId, customer_id: seed.customerId, customer_address_id: seed.addressId })
        if (cancelled) return
        const ids = loaded.jobs.map((j) => j.id)
        const rec = await loadOwnerRecords({ customerId: seed.customerId, addressId: seed.addressId, jobIds: ids, gcIds: loaded.gcIds })
        if (cancelled) return
        setJobs(loaded.jobs)
        setGcIds(loaded.gcIds)
        setFile(rec.file)
        setRowId(rec.rowId)
        setAvailable(rec.available)
      } catch (e) {
        if (!cancelled) setLoadError(formatErrorMessage(e, 'The records could not be read.'))
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one read per picked property
  }, [open, picked?.key])

  const packet = useMemo(() => (jobs ? buildOwnerPacket(jobs) : null), [jobs])
  const numbers = useMemo(() => (packet ? ownerPacketNumbers(packet, claimsByJob, formatUsdNoCents) : { agree: false, lines: [] }), [packet, claimsByJob])
  const steps = useMemo(() => ownerRecordsSteps(file, numbers, fmt.day), [file, numbers])
  const shownProperties = useMemo(() => properties.filter((p) => ownerRecordsPropertyMatches(p, query)), [properties, query])

  if (!open) return null

  const facts: OwnerRecordsDocFacts | null = picked ? { company: company.trim() || 'Our company', owner: picked.owner, address: picked.address || OWNER_RECORDS_NO_ADDRESS, asOfYmd: todayYmd, requestedOnYmd: file.request?.on ?? null } : null
  const missing = ownerRecordsMissing(file)

  /** Save the request's file. Resolves to the request's row id, or null when it was not saved. */
  async function save(next: OwnerRecordsFile, done: string): Promise<string | null> {
    if (!picked || !seed || !packet) return null
    setBusy(true)
    try {
      const id = await saveOwnerRecords({
        rowId,
        customerId: seed.customerId,
        addressId: seed.addressId,
        gcId: seed.gcId ?? gcIds[0] ?? null,
        seedJobId: seed.jobId,
        jobIds: packet.jobs.map((j) => j.id),
        ownerName: picked.owner,
        propertyAddress: picked.address,
        file: next,
      })
      setRowId(id)
      setFile(next)
      setEditing(null)
      showToast(done, 'success')
      return id
    } catch (e) {
      showToast(formatErrorMessage(e, 'Not saved.'), 'error')
      return null
    } finally {
      setBusy(false)
    }
  }

  async function print(what: 'packet' | 'acknowledgment') {
    if (!facts || !packet) return
    const html = what === 'packet' ? ownerPacketHtml(packet, facts, fmt) : ownerAcknowledgmentHtml(facts, fmt)
    // A print counts as a send: the page is filed as it was printed (v2.4554).
    if (!printAndFile(html, filing(what))) showToast('The print window was blocked. Allow pop-ups for this site and press it again.', 'error')
  }

  /** The packet as a PDF to keep or attach (v2.4619): the same pages the print makes; a download counts as a send, as a print does. */
  async function download() {
    if (!facts || !packet || pdfBusy) return
    setPdfBusy(true)
    try {
      const blob = await ownerPacketPdfBlob(packet, facts, fmt)
      const fileName = ownerPacketPdfFilename(facts.address, facts.asOfYmd)
      saveBlobAs(blob, fileName)
      void fileSentCopy({ ...filing('packet'), how: 'download' }, { blob, fileName, contentType: 'application/pdf' })
    } catch {
      showToast('Could not build the PDF.', 'error')
    } finally {
      setPdfBusy(false)
    }
  }

  /** What a copy of this property's packet, or of its acknowledgment, says about itself in Documents. */
  function filing(what: 'packet' | 'acknowledgment'): Omit<SentFiling, 'how'> {
    const address = picked?.address || 'this property'
    return {
      kind: what === 'packet' ? 'owner_records_packet' : 'owner_records_acknowledgment',
      title: what === 'packet' ? `Records for ${address}` : `Acknowledgment for ${address}`,
      recipientName: picked?.owner ?? '',
      jobIds: packet?.jobs.map((j) => j.id) ?? [],
      customerId: seed?.customerId ?? null,
      source: { table: 'lien_owner_record_requests', id: rowId },
    }
  }

  /** Record the packet as sent, then file the packet as it stood at that moment. */
  async function recordSent() {
    if (!facts || !packet) return
    const how = sentHow
    const html = ownerPacketHtml(packet, facts, fmt)
    // On their portal (punch list #86, PR 2): the copy is the PDF, so the owner's Download is a file; the portal reads the copy.
    const portalCopy = how === 'portal' ? await ownerPacketPdfBlob(packet, facts, fmt).catch(() => null) : null
    const id = await save({ ...file, sent: { at: new Date().toISOString(), by: authName.trim(), how, total: packet.owed, jobIds: packet.jobs.map((j) => j.id) } }, 'Recorded as sent. A copy is in Documents.')
    if (id) void fileSentCopy({ ...filing('packet'), how: SENT_HOW_OF[how], source: { table: 'lien_owner_record_requests', id } }, portalCopy ? { blob: portalCopy, fileName: ownerPacketPdfFilename(facts.address, facts.asOfYmd), contentType: 'application/pdf' } : { html })
  }

  const startRequest = () => {
    setReqOn(file.request?.on ?? todayYmd)
    setReqHow(file.request?.how ?? 'email')
    setReqFrom(file.request?.from ?? picked?.owner ?? '')
    setReqLink(file.request?.link ?? '')
    setEditing('request')
  }
  /** Offer it on their portal (punch list #86, PR 1): the owner's portal link, the offer on file, the link on the clipboard. */
  async function offerOnPortal() {
    if (!seed?.customerId || !picked || offerBusy) return
    setOfferBusy(true)
    try {
      const token = await mintCustomerPortalLink(seed.customerId, 'all', false)
      if (!token) throw new Error('No portal link came back.')
      const id = await save({ ...file, offer: { at: new Date().toISOString(), by: authName.trim(), alsoAllowed: alsoAllowed.trim() } }, 'Offered on their portal. The link is on your clipboard.')
      if (!id) return
      const url = `${window.location.origin}/portal?t=${encodeURIComponent(token)}`
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        showToast(`Copy this link for the owner: ${url}`, 'info', 12000)
      }
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not offer it on their portal.'), 'error')
    } finally {
      setOfferBusy(false)
    }
  }
  async function copyPortalLink() {
    if (!seed?.customerId) return
    try {
      const token = await mintCustomerPortalLink(seed.customerId, 'all', false)
      const url = `${window.location.origin}/portal?t=${encodeURIComponent(token ?? '')}`
      await navigator.clipboard.writeText(url)
      showToast('The portal link is on your clipboard.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not copy the link.'), 'error')
    }
  }
  const startAck = () => {
    setAckOn(file.acknowledgment?.signedOn ?? todayYmd)
    setAckLink(file.acknowledgment?.link ?? '')
    setEditing('acknowledgment')
  }

  const stepBody = (s: OwnerRecordsStep) => {
    if (s.key === 'request') {
      if (editing === 'request') {
        return (
          <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input type="date" value={reqOn} onChange={(ev) => setReqOn(ev.target.value)} aria-label="The day they asked" style={input} />
              <select value={reqHow} onChange={(ev) => setReqHow(ev.target.value as OwnerRecordsHow)} aria-label="How they asked" style={input}>
                {(Object.keys(OWNER_RECORDS_HOW_WORDS) as OwnerRecordsHow[]).map((k) => (
                  <option key={k} value={k}>
                    {OWNER_RECORDS_HOW_WORDS[k]}
                  </option>
                ))}
              </select>
            </div>
            <input value={reqFrom} onChange={(ev) => setReqFrom(ev.target.value)} placeholder="Who asked" aria-label="Who asked" style={input} />
            <input value={reqLink} onChange={(ev) => setReqLink(ev.target.value)} placeholder="Link to their email or letter (Drive)" aria-label="Link to their request" style={input} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" disabled={busy || !reqOn} onClick={() => void save({ ...file, request: { on: reqOn, how: reqHow, from: reqFrom.trim(), link: reqLink.trim() } }, 'The request is on file.')} style={btn('primary', busy || !reqOn)}>
                Save the request
              </button>
              <button type="button" onClick={() => setEditing(null)} style={btn('plain')}>
                Cancel
              </button>
            </div>
          </div>
        )
      }
      if (editing === 'offer') {
        return (
          <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
            <input value={alsoAllowed} onChange={(ev) => setAlsoAllowed(ev.target.value)} placeholder="Also allowed to sign (a spouse, a manager) — optional" aria-label="A second name allowed to sign" style={input} />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>On their portal they type their name, which must match {picked?.owner ? <b>{picked.owner}</b> : 'the owner of record'} letter for letter, or this second name. Then they sign.</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" disabled={offerBusy} onClick={() => void offerOnPortal()} style={btn('primary', offerBusy)}>
                {offerBusy ? 'Making the link…' : 'Offer it and copy the link'}
              </button>
              <button type="button" onClick={() => setEditing(null)} style={btn('plain')}>
                Cancel
              </button>
            </div>
          </div>
        )
      }
      // Signed on the portal: their signing is the request, as with check 4; nothing to change by hand.
      if (file.request?.how === 'portal') return null
      return available && !file.sent ? (
        <div style={{ display: 'flex', gap: '0.4rem 1rem', flexWrap: 'wrap', marginTop: 4 }}>
          <button type="button" onClick={startRequest} style={linkBtn}>
            {file.request ? 'Change' : 'Put it on file ›'}
          </button>
          {!file.request && seed?.customerId ? (
            file.offer ? (
              <button type="button" onClick={() => void copyPortalLink()} style={linkBtn} data-testid="owner-records-copy-link">
                Copy the portal link ›
              </button>
            ) : (
              <button type="button" onClick={() => { setAlsoAllowed(file.offer?.alsoAllowed ?? ''); setEditing('offer') }} style={linkBtn} data-testid="owner-records-offer">
                Offer it on their portal ›
              </button>
            )
          ) : null}
        </div>
      ) : null
    }
    if (s.key === 'contract') {
      if (file.contractChecked || !available || file.sent) return null
      return isLeader ? (
        <button type="button" disabled={busy} onClick={() => void save({ ...file, contractChecked: { by: authName.trim(), at: new Date().toISOString() } }, 'The contract check is on file.')} style={{ ...btn('plain', busy), marginTop: 6 }}>
          I read it. No clause stops this.
        </button>
      ) : (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>The leader ticks this.</div>
      )
    }
    if (s.key === 'acknowledgment') {
      if (editing === 'acknowledgment') {
        return (
          <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
            <input type="date" value={ackOn} onChange={(ev) => setAckOn(ev.target.value)} aria-label="The day they signed" style={input} />
            <input value={ackLink} onChange={(ev) => setAckLink(ev.target.value)} placeholder="Link to the signed copy (Drive)" aria-label="Link to the signed copy" style={input} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" disabled={busy || !ackOn} onClick={() => void save({ ...file, acknowledgment: { signedOn: ackOn, link: ackLink.trim() } }, 'The signed acknowledgment is on file.')} style={btn('primary', busy || !ackOn)}>
                It is signed
              </button>
              <button type="button" onClick={() => setEditing(null)} style={btn('plain')}>
                Cancel
              </button>
            </div>
          </div>
        )
      }
      // Signed on the portal: the name, the mode and the ink are the record; nothing to change by hand.
      if (file.acknowledgment?.printedName) return null
      return available && !file.sent ? (
        <button type="button" onClick={startAck} style={{ ...linkBtn, marginTop: 4 }}>
          {file.acknowledgment ? 'Change' : 'They signed it ›'}
        </button>
      ) : null
    }
    return null
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Records for an owner"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', paddingTop: 'var(--app-top-chrome, 0px)', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 800 }}
      onClick={(e) => {
        // The Lien desk is open behind this window: the click closes this one only.
        e.stopPropagation()
        onClose()
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: isMobile ? 0 : 10, width: isMobile ? '100vw' : 'min(980px, calc(100vw - 2rem))', maxHeight: isMobile ? '100%' : 'calc(100dvh - 2rem - var(--app-top-chrome, 0px) - var(--app-bottom-chrome, 0px))', height: isMobile ? '100%' : undefined, display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', padding: '0.8rem 1.1rem 0.6rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Records for an owner</h2>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {picked ? `${picked.owner} · ${picked.address || 'no address on the job'}${picked.gcName ? ` · GC ${picked.gcName}` : ''}` : 'An owner asked for what we billed and what was paid on their property. Pick the owner.'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
            {picked ? (
              <button type="button" onClick={() => setPicked(null)} style={linkBtn}>
                ‹ Another owner
              </button>
            ) : null}
            <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: 4 }}>
              ×
            </button>
          </div>
        </div>

        {!picked ? (
          <div style={{ overflow: 'auto', minHeight: 0, padding: '0.7rem 1.1rem 1rem' }} data-testid="owner-records-picker">
            <input value={query} onChange={(ev) => setQuery(ev.target.value)} placeholder="Owner, address or GC" aria-label="Find an owner" style={{ ...input, width: '100%', boxSizing: 'border-box', marginBottom: 8 }} />
            {properties.length === 0 ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No job on the desk has a notice yet, so there is no owner to pick.</p> : null}
            {properties.length > 0 && shownProperties.length === 0 ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No owner matches that.</p> : null}
            {shownProperties.map((p) => (
              <button key={p.key} type="button" onClick={() => setPicked(p)} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0 0.8rem', width: '100%', textAlign: 'left', padding: '0.5rem 0.2rem', border: 'none', borderTop: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit', fontSize: '0.8125rem' }}>
                <span style={{ minWidth: 0 }}>
                  <strong>{p.owner}</strong>
                  <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.address || 'no address on the job'}
                    {p.gcName ? ` · GC ${p.gcName}` : ''}
                  </span>
                  {p.sharesAddress ? <span style={{ display: 'block', color: 'var(--text-amber-800)', fontSize: '0.72rem' }}>Another row has this address. They are kept apart because the customer on the jobs differs.</span> : null}
                </span>
                <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(p.open)}</strong>
                  <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {p.jobs} {p.jobs === 1 ? 'job' : 'jobs'} on the desk
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ overflow: 'auto', minHeight: 0, display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 0.9fr) minmax(0, 1.1fr)', alignContent: 'start' }}>
            <div style={{ borderRight: isMobile ? 'none' : '1px solid var(--border)', minWidth: 0 }} data-testid="owner-records-steps">
              {steps.map((s, i) => (
                <div key={s.key} data-step={s.key} data-state={s.state} style={{ display: 'grid', gridTemplateColumns: '1.1rem minmax(0, 1fr)', gap: '0 0.5rem', padding: '0.6rem 1.1rem', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                  <span aria-hidden style={{ fontWeight: 800, color: STEP_MARK[s.state].color }}>{STEP_MARK[s.state].glyph}</span>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: '0.8125rem' }}>
                      {s.n} · {s.title}
                    </strong>
                    <div style={{ fontSize: '0.75rem', color: s.state === 'warn' ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>{jobs ? s.words : s.key === 'numbers' ? 'Reading the bills…' : s.words}</div>
                    {stepBody(s)}
                  </div>
                </div>
              ))}
              {!available ? (
                <div data-testid="owner-records-unavailable" style={{ padding: '0.6rem 1.1rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-red-600)' }}>
                  Saving is not ready yet. You can read and print the packet. The checks cannot be put on file.
                </div>
              ) : null}
            </div>
            <div style={{ padding: '0.6rem 1.1rem 1rem', minWidth: 0 }} data-testid="owner-records-packet">
              <div style={lab}>The packet · this property only</div>
              {loadError ? <p style={{ fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>{loadError}</p> : null}
              {!packet && !loadError ? <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Reading every job at this property…</p> : null}
              {packet && packet.jobs.length === 0 ? <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No job was found at this property.</p> : null}
              {packet && packet.jobs.length > 0 ? (
                <div style={{ marginTop: 6, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)', padding: '0.6rem 0.75rem', fontSize: '0.8125rem' }}>
                  <strong>
                    Statement for {picked.address || 'this property'}, as of {fmt.day(todayYmd)}
                  </strong>
                  {packet.jobs.map((j) => (
                    <div key={j.id} data-packet-job={j.number} style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <strong>{j.number}</strong> · {j.name}
                        </span>
                        <strong style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt.money(j.owed)} owed</strong>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: 10 }}>
                        Job total {fmt.money(j.total)} · paid {fmt.money(j.paid)}
                      </div>
                      {j.bills.map((b) => (
                        <div key={b.id} style={{ fontSize: '0.75rem', color: 'var(--text-700)', paddingLeft: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <span>
                              {b.label}
                              {b.billedOn ? ` · billed ${fmt.day(b.billedOn)}` : ''}
                            </span>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt.money(b.amount)}</span>
                          </div>
                          {b.payments.map((p) => (
                            <div key={p.id} data-packet-payment style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: 'var(--text-muted)', paddingLeft: 10 }}>
                              <span style={{ minWidth: 0 }}>Paid {ownerPaymentWhen(p, fmt)}</span>
                              <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt.money(p.amount)}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                      {j.loosePayments.map((p) => (
                        <div key={p.id} data-packet-payment style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: 10 }}>
                          <span style={{ minWidth: 0 }}>Paid, no bill named · {ownerPaymentWhen(p, fmt)}</span>
                          <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt.money(p.amount)}</span>
                        </div>
                      ))}
                      {j.bills.length === 0 && j.loosePayments.length === 0 ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: 10 }}>No bill has gone out on this job yet.</div> : null}
                    </div>
                  ))}
                  <div data-testid="owner-records-total" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '2px solid var(--border-strong)', marginTop: 8, paddingTop: 6, fontWeight: 700 }}>
                    <span>Owed at this property</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt.money(packet.owed)}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {fmt.money(packet.total)} job total · {fmt.money(packet.paid)} paid in {packet.payments} {packet.payments === 1 ? 'payment' : 'payments'}
                  </div>
                </div>
              ) : null}
              <div style={{ ...lab, marginTop: 12 }}>Left out, on purpose</div>
              <ul style={{ margin: '4px 0 0', paddingLeft: '1.1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {OWNER_RECORDS_LEFT_OUT.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {picked ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem 0.8rem', flexWrap: 'wrap', justifyContent: 'flex-end', padding: '0.6rem 1.1rem', borderTop: '1px solid var(--border)' }}>
            <span data-testid="owner-records-foot" style={{ flex: '1 1 14rem', minWidth: 0, fontSize: '0.78rem', color: file.sent ? 'var(--text-green-700)' : missing.length ? 'var(--text-muted)' : 'var(--text-700)' }}>
              {ownerRecordsFootWords(file, fmt.day)}
            </span>
            <button type="button" disabled={!packet} onClick={() => void print('acknowledgment')} style={btn('plain', !packet)}>
              Print the acknowledgment
            </button>
            <button type="button" disabled={!packet || packet.jobs.length === 0} onClick={() => void print('packet')} style={btn('plain', !packet || packet.jobs.length === 0)}>
              Print the packet
            </button>
            <button type="button" disabled={!packet || packet.jobs.length === 0 || pdfBusy} onClick={() => void download()} style={btn('plain', !packet || packet.jobs.length === 0 || pdfBusy)} title="The cover note and the statement as one PDF, to attach or keep">
              {pdfBusy ? 'Building…' : 'Download the packet'}
            </button>
            {!file.sent ? (
              <>
                <select value={sentHow} onChange={(ev) => setSentHow(ev.target.value as OwnerRecordsSentHow)} aria-label="How it went to them" style={input}>
                  {ownerRecordsSentHows(file).map((k) => (
                    <option key={k} value={k}>
                      {OWNER_RECORDS_SENT_HOW_WORDS[k]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy || missing.length > 0 || !packet || !available}
                  title={missing.length ? `First: ${missing.join(', ')}` : undefined}
                  onClick={() => void recordSent()}
                  style={btn('primary', busy || missing.length > 0 || !packet || !available)}
                >
                  Record it as sent
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
