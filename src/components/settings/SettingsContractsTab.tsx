import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth, type UserRole } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { customerJourneys, findStep } from '../../lib/customerJourneys'
import {
  COMPARE_MAX,
  CONTRACT_AREA_LABELS,
  CONTRACT_AUDIENCE_LABELS,
  CONTRACT_STATUS_LABELS,
  CUSTOMER_CONTRACT_CATALOG,
  contractAnchorId,
  contractCatalogCounts,
  contractCountsLine,
  contractEditAction,
  contractSettingKeys,
  contractSourceLine,
  resolveContractTexts,
  toggleCompare,
  type ContractBookDoc,
  type ContractCatalogData,
  type ContractCatalogEntry,
  type ContractStepRef,
  type ContractTextStatus,
  type ResolvedContractText,
} from '../../lib/contracts/customerContractCatalog'
import { EMPTY_LAST_SENT, contractLastSent, lastSentDiffers, sentCompareKey, type ContractLastSent, type ContractLastSentData } from '../../lib/contracts/contractLastSent'
import { fetchContractLastSent } from '../../lib/contracts/fetchContractLastSent'
import {
  contractSourceRef,
  lastChanged,
  reviewCounts,
  reviewCountsLine,
  reviewState,
  versionCompareKey,
  versionLine,
  versionsFor,
  type ContractTextVersion,
  type LastChanged,
  type ReviewState,
} from '../../lib/contracts/contractTextHistory'
import { EMPTY_CONTRACT_HISTORY, fetchContractHistory, markContractReviewed, removeContractReview, type ContractHistoryData } from '../../lib/contracts/fetchContractHistory'
import { ContractCardHistory } from './ContractCardHistory'
import { ContractCardReview } from './ContractCardReview'
import { ContractBodyDisplay } from '../contracts/ContractBodyDisplay'
import StandardTermsEditModal from '../jobs/StandardTermsEditModal'
import ContractReaderModal, { type ContractReaderEditDoor } from './ContractReaderModal'
import { readerSurfacesFor } from '../../lib/contracts/contractReader'
import { CONTRACT_AREA_HINTS, CONTRACT_AREA_ORDER, CONTRACT_LENS_ORDER, contractLensCounts, contractLensLabel, entryIdFromHash, indexSection, needsLookReasons, NEEDS_LOOK_LABELS, reviewWord, type ContractLens } from '../../lib/contracts/contractsIndex'

/**
 * Settings → Contracts & terms: every contract text a customer accepts or signs, and every
 * notice they receive, as cards — the wording as it stands today, where it is kept, where it is
 * edited and where the customer meets it. Tick two or three to read them side by side. The
 * registry is `customerContractCatalog.ts`; this tab reads the Settings texts and the Contract
 * Book's customer documents and writes nothing of its own (the Book's editor opens on the card).
 * **Last sent** sets each card against the copy frozen the last time it went out
 * (`contractLastSent.ts`), and that copy can take a column of its own. **History** and
 * **Mark reviewed** read `contract_text_versions` and `contract_text_reviews`
 * (`contractTextHistory.ts`); a review is the one row this tab writes.
 */

const CARD: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '0.85rem 1rem' }
const MUTED: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const PILL: CSSProperties = { font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.65rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }
const PILL_ON: CSSProperties = { ...PILL, background: 'var(--bg-blue-50)', borderColor: 'var(--border-blue)', color: 'var(--text-blue-700)' }
const CHIP: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, padding: '0.05rem 0.45rem', borderRadius: 9999, whiteSpace: 'nowrap', background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
const WORDING: CSSProperties = { margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', font: 'inherit', fontSize: '0.8rem', lineHeight: 1.5, color: 'var(--text-700)' }
const WORDING_BOX: CSSProperties = { background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.7rem', overflowY: 'auto' }
const COLLAPSED_HEIGHT = 200

const STATUS_CHIP: Readonly<Record<ContractTextStatus, CSSProperties>> = {
  yours: { ...CHIP, background: 'var(--bg-green-tint)', color: 'var(--text-green-700)', border: '1px solid transparent' },
  built_in: { ...CHIP, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', border: '1px solid transparent' },
  blank: { ...CHIP, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px solid transparent' },
  fixed: CHIP,
  per_record: CHIP,
  in_settings: CHIP,
  external: CHIP,
}

/** `first`: the entry's first text carries the card's anchor (a Book with two documents makes two cards). */
type CardModel = {
  entry: ContractCatalogEntry
  text: ResolvedContractText
  first: boolean
  sent: ContractLastSent | null
  /** Newest first; empty for wording with no history. */
  versions: ContractTextVersion[]
  changed: LastChanged | null
  review: ReviewState
}

/** One column of Side by side: a card's wording, or what last went out for it. */
type Column = { key: string; title: string; sub: string; body: ReactNode }

export type SettingsContractsTabProps = {
  role: UserRole | null
  /** v2.4108: a card to open on arrival (What customers see's door); the page's `#settings-contract-<id>` hash does the same. */
  openEntryId?: string | null
  /** Open a section on another Settings tab. */
  onOpenEditor: (tabId: string, anchorId: string) => void
  /** Open a step on What customers see. */
  onOpenStep: (ref: ContractStepRef) => void
}

export function SettingsContractsTab({ role, openEntryId = null, onOpenEditor, onOpenStep }: SettingsContractsTabProps) {
  const [data, setData] = useState<ContractCatalogData | null>(null)
  // null until it is read; the cards show without it.
  const [lastSent, setLastSent] = useState<ContractLastSentData | null>(null)
  const [history, setHistory] = useState<ContractHistoryData | null>(null)
  const [historyOpen, setHistoryOpen] = useState<ReadonlySet<string>>(() => new Set())
  /** v2.4098: the card being read as the customer sees it. */
  const [reading, setReading] = useState<{ entry: ContractCatalogEntry; text: ResolvedContractText } | null>(null)
  /** v2.4108: the index — which rows are open into their card, the lens over the list, and the find box. */
  const [openRows, setOpenRows] = useState<ReadonlySet<string>>(() => new Set())
  const [lens, setLens] = useState<ContractLens>('all')
  const [query, setQuery] = useState('')
  const toggleRow = (key: string) =>
    setOpenRows((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const { user, profileName } = useAuth()
  const { showToast } = useToastContext()
  const [loadError, setLoadError] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())
  const [editing, setEditing] = useState<ContractBookDoc | null>(null)
  const journeys = useMemo(() => customerJourneys(), [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [settings, docs] = await Promise.all([
          withSupabaseRetry(() => supabase.from('app_settings').select('key, value_text').in('key', contractSettingKeys()), 'contracts tab: settings texts'),
          withSupabaseRetry(
            () => supabase.from('contract_template_documents').select('id, document_name, book_body_html, book_body_format, book_version_date, updated_at').eq('audience', 'customer').order('document_name'),
            'contracts tab: customer documents',
          ),
        ])
        if (cancelled) return
        const map = new Map<string, string | null>()
        for (const r of (settings ?? []) as Array<{ key: string; value_text: string | null }>) map.set(r.key, r.value_text)
        setData({ settings: map, bookDocs: ((docs ?? []) as ContractBookDoc[]).map((d) => ({ ...d })) })
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not read the wording.')
      }
    })()
    void fetchContractLastSent()
      .then((rows) => {
        if (!cancelled) setLastSent(rows)
      })
      .catch(() => {
        if (!cancelled) setLastSent(EMPTY_LAST_SENT)
      })
    void fetchContractHistory()
      .then((rows) => {
        if (!cancelled) setHistory(rows)
      })
      .catch(() => {
        if (!cancelled) setHistory(EMPTY_CONTRACT_HISTORY)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const names = history?.names
  const nameOf = useMemo(() => (id: string | null) => (id ? names?.get(id) ?? null : null), [names])
  const todayYmd = todayYmdInAppTz()

  const cards = useMemo((): CardModel[] => {
    if (!data) return []
    return CUSTOMER_CONTRACT_CATALOG.flatMap((entry) =>
      resolveContractTexts(entry, data).map((text, i) => {
        const versions = versionsFor(contractSourceRef(entry, text), history?.versions ?? [])
        const changed = lastChanged(versions, nameOf)
        return {
          entry,
          text,
          first: i === 0,
          sent: lastSent ? contractLastSent(entry, text, lastSent) : null,
          versions,
          changed,
          // A Book document's own version date dates the wording when the history cannot.
          review: reviewState({ entryId: entry.id, reviews: history?.reviews ?? [], lastChangedYmd: changed?.ymd ?? text.doc?.book_version_date ?? null, todayYmd, nameOf }),
        }
      }),
    )
  }, [data, lastSent, history, nameOf, todayYmd])

  // A card named by the page's hash or by What customers see's door opens on arrival; the shell scrolls to it.
  const wantedEntryId = openEntryId ?? (typeof window !== 'undefined' ? entryIdFromHash(window.location.hash) : null)
  useEffect(() => {
    if (!wantedEntryId || cards.length === 0) return
    const keys = cards.filter((c) => c.entry.id === wantedEntryId).map((c) => c.text.key)
    if (keys.length === 0) return
    setOpenRows((prev) => (keys.every((k) => prev.has(k)) ? prev : new Set([...prev, ...keys])))
  }, [wantedEntryId, cards])

  /** One review per entry: a Book with two documents shows it on both cards and counts it once. */
  const reviewLine = history ? reviewCountsLine(reviewCounts(cards.filter((c) => c.first).map((c) => c.review))) : null

  const markReviewed = async (entryId: string, note: string): Promise<boolean> => {
    if (!user?.id) return false
    try {
      const row = await markContractReviewed({ entryId, userId: user.id, note })
      setHistory((prev) => {
        const base = prev ?? EMPTY_CONTRACT_HISTORY
        // The names were read before this review existed; the person who just marked it is the one looking.
        const names = new Map(base.names)
        const me = (profileName ?? '').trim()
        if (me && !names.has(row.reviewed_by)) names.set(row.reviewed_by, me)
        return { ...base, names, reviews: [row, ...base.reviews] }
      })
      showToast('Review saved.', 'success')
      return true
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the review'), 'error')
      return false
    }
  }

  const takeBackReview = async (reviewId: string): Promise<boolean> => {
    try {
      await removeContractReview(reviewId)
      setHistory((prev) => (prev ? { ...prev, reviews: prev.reviews.filter((r) => r.id !== reviewId) } : prev))
      showToast('Review taken back.', 'success')
      return true
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not take the review back'), 'error')
      return false
    }
  }

  const compared = picked
    .map((key): Column | null => {
      const card = cards.find((c) => c.text.key === key)
      if (card) {
        return {
          key,
          title: card.text.title,
          sub: `${CONTRACT_AREA_LABELS[card.entry.area]} · ${CONTRACT_STATUS_LABELS[card.text.status]}${card.text.versionLabel ? ` · ${card.text.versionLabel}` : ''}`,
          body: <Wording entry={card.entry} text={card.text} />,
        }
      }
      const from = cards.find((c) => sentCompareKey(c.text.key) === key)
      if (from?.sent?.sentText) return { key, title: from.text.title, sub: `What went out · ${from.sent.sentLabel ?? ''}`, body: <Body text={from.sent.sentText} format={from.sent.sentFormat} /> }
      for (const c of cards) {
        const v = c.versions.find((x) => versionCompareKey(x.id) === key)
        if (v) return { key, title: c.text.title, sub: `Before · ${versionLine(v, nameOf)}`, body: <Body text={v.body} format={v.body_format === 'html' || v.body_format === 'markdown' ? v.body_format : 'plain'} /> }
      }
      return null
    })
    .filter((c): c is Column => c != null)
  const differing = lastSentDiffers(cards.map((c) => c.sent))
  const stepLabel = (ref: ContractStepRef) => findStep(journeys, ref.journeyId, ref.stepId)?.label ?? ref.stepId

  if (loadError) {
    return (
      <div style={{ ...CARD, color: 'var(--text-red-700)', fontSize: '0.85rem' }} role="alert">
        The wording could not be read: {loadError}
      </div>
    )
  }
  if (!data) return <div style={{ ...CARD, ...MUTED }}>Reading the wording…</div>

  const lensCounts = contractLensCounts(cards)
  const visible = CONTRACT_AREA_ORDER.flatMap((area) => indexSection(cards, area, lens, query))
  const allOpen = visible.length > 0 && visible.every((c) => openRows.has(c.text.key))

  return (
    <div>
      <div style={{ ...CARD, padding: '0.55rem 1rem', marginBottom: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.9rem', alignItems: 'center', fontSize: '0.82rem' }} data-testid="contracts-counts">
        <strong style={{ color: 'var(--text-strong)' }}>{contractCountsLine(contractCatalogCounts(cards.map((c) => c.text)))}</strong>
        {reviewLine ? (
          <span style={{ ...STATUS_CHIP.blank, fontSize: '0.72rem' }} data-testid="contracts-reviews">
            {reviewLine}
          </span>
        ) : null}
        {differing > 0 ? (
          <span style={{ ...STATUS_CHIP.blank, fontSize: '0.72rem' }} data-testid="contracts-differing">
            {differing === 1 ? '1 card where what went out is not what the card says' : `${differing} cards where what went out is not what the card says`}
          </span>
        ) : null}
        <span style={MUTED}>
          The wording as it stands today, one line per contract in the order a customer meets them. Open a line for its card; tick <em>Compare</em> on two or three to read them side by side.
        </span>
      </div>

      {compared.length > 0 ? (
        <section id="contracts-compare" style={{ ...CARD, marginBottom: '0.9rem', borderColor: 'var(--border-blue)', scrollMarginTop: '0.75rem' }} aria-label="Side by side" data-testid="contracts-compare">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.9rem', alignItems: 'baseline', marginBottom: '0.6rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Side by side</h3>
            <span style={MUTED}>
              {compared.length === 1 ? `Tick one or two more (up to ${COMPARE_MAX}).` : `${compared.length} texts. A column headed What went out is the copy kept from the last send.`}
            </span>
            <button type="button" style={{ ...PILL, marginLeft: 'auto' }} onClick={() => setPicked([])}>
              Clear
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${compared.length}, minmax(260px, 1fr))`, gap: '0.75rem', alignItems: 'start' }}>
              {compared.map((col) => (
                <div key={col.key} style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-strong)', marginBottom: '0.3rem' }}>
                    {col.title}
                    <span style={{ ...MUTED, display: 'block', fontWeight: 400 }}>{col.sub}</span>
                  </div>
                  <div style={{ ...WORDING_BOX, maxHeight: '70vh' }}>{col.body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* v2.4108: the toolbar — the find box, the lens, Open all — and the jump line. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', marginBottom: '0.6rem' }} data-testid="contracts-toolbar">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a contract…"
          aria-label="Find a contract"
          style={{ font: 'inherit', fontSize: '0.82rem', padding: '0.35rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', width: 'min(100%, 240px)' }}
        />
        {CONTRACT_LENS_ORDER.filter((l) => l === 'all' || lensCounts[l] > 0).map((l) => (
          <button
            key={l}
            type="button"
            style={lens === l ? PILL_ON : l === 'needs_look' ? { ...PILL, borderColor: 'var(--text-amber-800)', color: 'var(--text-amber-800)' } : PILL}
            aria-pressed={lens === l}
            onClick={() => setLens(l)}
            data-testid={`contract-lens-${l}`}
          >
            {contractLensLabel(l)} · {lensCounts[l]}
          </button>
        ))}
        <button type="button" style={{ ...PILL, marginLeft: 'auto' }} onClick={() => setOpenRows(allOpen ? new Set() : new Set(visible.map((c) => c.text.key)))} data-testid="contracts-open-all">
          {allOpen ? 'Close all' : 'Open all'}
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.55rem', alignItems: 'center', marginBottom: '0.7rem', fontSize: '0.78rem' }} data-testid="contracts-jump">
        <span style={{ ...MUTED, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.68rem' }}>Jump to</span>
        {CONTRACT_AREA_ORDER.map((area) => {
          const n = indexSection(cards, area, lens, query).length
          return (
            <button
              key={area}
              type="button"
              disabled={n === 0}
              style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, color: n === 0 ? 'var(--text-faint)' : 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: n === 0 ? 'default' : 'pointer' }}
              onClick={() => document.getElementById(`contracts-area-${area}`)?.scrollIntoView({ block: 'start', behavior: 'auto' })}
            >
              {CONTRACT_AREA_LABELS[area]} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{n}</span>
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? <p style={{ ...CARD, ...MUTED, margin: 0 }}>No contract matches — clear the find box or pick another lens.</p> : null}

      {CONTRACT_AREA_ORDER.map((area) => {
        const inArea = indexSection(cards, area, lens, query)
        if (inArea.length === 0) return null
        return (
          <section key={area} style={{ ...CARD, padding: 0, marginBottom: '0.9rem', overflow: 'hidden', scrollMarginTop: '0.75rem' }} aria-label={CONTRACT_AREA_LABELS[area]} id={`contracts-area-${area}`}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.3rem 0.6rem', padding: '0.5rem 0.85rem', background: 'var(--bg-subtle)' }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem' }}>{CONTRACT_AREA_LABELS[area]}</h3>
              <span style={MUTED}>{CONTRACT_AREA_HINTS[area]}</span>
              <span style={{ ...MUTED, marginLeft: 'auto' }}>{inArea.length === 1 ? '1 contract' : `${inArea.length} contracts`}</span>
            </div>
            <div>
              {inArea.map((card) => {
                const { entry, text, first, sent, versions, changed, review } = card
                const action = contractEditAction(entry, text, role)
                const showHistory = historyOpen.has(text.key)
                const canTakeBack = review.last != null && review.last.reviewed_by === user?.id && review.last.reviewed_on === todayYmd
                const isOpen = open.has(text.key)
                const isPicked = picked.includes(text.key)
                const sentKey = sentCompareKey(text.key)
                const sentPicked = picked.includes(sentKey)
                const sentOff = sent != null && (sent.status === 'differs' || sent.staleDrafts > 0)
                const hasWording = text.text.trim() !== ''
                const rowOpen = openRows.has(text.key)
                const reasons = needsLookReasons(card)
                const canRead = readerSurfacesFor(entry).length > 0
                return (
                  <article key={text.key} id={first ? contractAnchorId(entry.id) : undefined} style={{ borderTop: '1px solid var(--border)', scrollMarginTop: '0.75rem', background: rowOpen ? 'var(--bg-blue-50)' : undefined }} data-testid={`contract-card-${text.key}`} data-open={rowOpen ? 'true' : undefined}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem 0.4rem 0.45rem' }}>
                      <button
                        type="button"
                        aria-expanded={rowOpen}
                        onClick={() => toggleRow(text.key)}
                        style={{ font: 'inherit', flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem 0.6rem', background: 'none', border: 'none', padding: '0.15rem 0', textAlign: 'left', cursor: 'pointer', color: 'inherit' }}
                        data-testid={`contract-row-${text.key}`}
                      >
                        <span aria-hidden="true" style={{ color: 'var(--text-muted)', width: 12, display: 'inline-flex', justifyContent: 'center', fontSize: '0.7rem' }}>{rowOpen ? '▾' : '▸'}</span>
                        <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-strong)', minWidth: 0, flex: '1 1 220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text.title}</span>
                        <span style={{ display: 'inline-flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          <span style={CHIP}>{CONTRACT_AUDIENCE_LABELS[entry.audience]}</span>
                          <span style={STATUS_CHIP[text.status]}>{CONTRACT_STATUS_LABELS[text.status]}</span>
                          {entry.group === 'notice' ? <span style={CHIP}>Notice</span> : null}
                        </span>
                        <span style={{ ...MUTED, fontSize: '0.74rem', flex: '1 1 160px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title="Last changed">
                          {changed?.line ?? lastChangedLine(text)}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: review.status === 'ok' ? 'var(--text-muted)' : 'var(--text-amber-800)', whiteSpace: 'nowrap' }} title="Reviewed">
                          {reviewWord(review)}
                        </span>
                        {sent ? (
                          <span style={{ fontSize: '0.74rem', color: sentOff ? 'var(--text-amber-800)' : 'var(--text-muted)', flex: '2 1 200px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title="Last sent">
                            {sent.line}
                          </span>
                        ) : null}
                        {reasons.length > 0 ? (
                          <span style={{ ...STATUS_CHIP.blank, fontSize: '0.66rem' }} title={reasons.map((r) => NEEDS_LOOK_LABELS[r]).join(' · ')}>
                            Needs a look
                          </span>
                        ) : null}
                      </button>
                      {canRead ? (
                        <button type="button" style={PILL_ON} onClick={() => setReading({ entry, text })} title="Read it as the customer sees it — the customer's own page, with sample information, and this wording lit on it" data-testid={`contract-read-${text.key}`}>
                          Read it
                        </button>
                      ) : null}
                    </div>
                    {rowOpen ? (
                  <div style={{ display: 'grid', gap: '0.55rem', minWidth: 0, padding: '0.1rem 0.85rem 0.85rem 1.6rem', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-700)', lineHeight: 1.45 }}>{entry.what}</p>

                    <div style={{ ...WORDING_BOX, maxHeight: isOpen ? undefined : COLLAPSED_HEIGHT }}>
                      <Wording entry={entry} text={text} />
                    </div>

                    <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.2rem 0.6rem', fontSize: '0.76rem', lineHeight: 1.4 }}>
                      <dt style={{ color: 'var(--text-muted)' }}>The customer</dt>
                      <dd style={{ margin: 0, color: 'var(--text-700)' }}>{entry.customerAction}</dd>
                      <dt style={{ color: 'var(--text-muted)' }}>Kept in</dt>
                      <dd style={{ margin: 0, color: 'var(--text-700)' }}>{contractSourceLine(entry)}</dd>
                      <dt style={{ color: 'var(--text-muted)' }}>Last changed</dt>
                      <dd style={{ margin: 0, color: 'var(--text-700)' }} data-testid={`contract-last-changed-${text.key}`}>
                        {changed?.line ?? lastChangedLine(text)}
                      </dd>
                      <dt style={{ color: 'var(--text-muted)' }}>Their copy</dt>
                      <dd style={{ margin: 0, color: 'var(--text-700)' }}>{entry.copyKept ?? 'None is kept.'}</dd>
                      {history ? (
                        <>
                          <dt style={{ color: 'var(--text-muted)' }}>Reviewed</dt>
                          <dd style={{ margin: 0, color: review.status === 'ok' ? 'var(--text-700)' : 'var(--text-amber-800)' }} data-testid={`contract-review-${text.key}`}>
                            {review.line}
                            {review.last?.note ? <span style={{ display: 'block', color: 'var(--text-muted)' }}>“{review.last.note}”</span> : null}
                          </dd>
                        </>
                      ) : null}
                      {sent ? (
                        <>
                          <dt style={{ color: 'var(--text-muted)' }}>Last sent</dt>
                          <dd style={{ margin: 0, color: sentOff ? 'var(--text-amber-800)' : 'var(--text-700)' }} data-testid={`contract-last-sent-${text.key}`}>
                            {sent.line}
                          </dd>
                        </>
                      ) : null}
                    </dl>

                    {action.kind === 'note' || action.kind === 'link' ? <p style={{ ...MUTED, margin: 0 }}>{action.kind === 'note' ? action.text : action.note}</p> : null}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                      {canRead ? (
                        <button type="button" style={PILL_ON} onClick={() => setReading({ entry, text })} title="The customer's own page, with sample information, and this wording lit on it" data-testid={`contract-read-full-${text.key}`}>
                          Read it as the customer sees it
                        </button>
                      ) : null}
                      {hasWording ? (
                        <button type="button" style={isPicked ? PILL_ON : PILL} aria-pressed={isPicked} onClick={() => setPicked((prev) => toggleCompare(prev, text.key))}>
                          {isPicked ? '✓ Comparing' : 'Compare'}
                        </button>
                      ) : null}
                      {hasWording ? (
                        <button
                          type="button"
                          style={PILL}
                          aria-expanded={isOpen}
                          onClick={() =>
                            setOpen((prev) => {
                              const next = new Set(prev)
                              if (next.has(text.key)) next.delete(text.key)
                              else next.add(text.key)
                              return next
                            })
                          }
                        >
                          {isOpen ? 'Show less' : 'Show all'}
                        </button>
                      ) : null}
                      {sent?.sentText ? (
                        <button type="button" style={sentPicked ? PILL_ON : PILL} aria-pressed={sentPicked} onClick={() => setPicked((prev) => toggleCompare(prev, sentKey))} title="Put what last went out in a column of its own">
                          {sentPicked ? '✓ What went out' : 'Compare what went out'}
                        </button>
                      ) : null}
                      {action.kind === 'modal' && text.doc ? (
                        <button type="button" style={PILL} onClick={() => setEditing(text.doc)}>
                          {action.label}
                        </button>
                      ) : null}
                      {action.kind === 'settings' ? (
                        <button type="button" style={PILL} onClick={() => onOpenEditor(action.tabId, action.anchorId)}>
                          {action.label} →
                        </button>
                      ) : null}
                      {action.kind === 'page' ? (
                        <Link to={action.to} style={PILL}>
                          {action.label} →
                        </Link>
                      ) : null}
                      {action.kind === 'link' ? (
                        <a href={action.href} target="_blank" rel="noopener noreferrer" style={PILL} title={action.href} data-testid={`contract-live-page-${text.key}`}>
                          {action.label} ↗
                        </a>
                      ) : null}
                      {entry.guide ? (
                        <Link to={`/help?g=${encodeURIComponent(entry.guide)}`} style={PILL} title="The help guide that covers it">
                          Guide →
                        </Link>
                      ) : null}
                      {versions.length > 0 ? (
                        <button
                          type="button"
                          style={showHistory ? PILL_ON : PILL}
                          aria-expanded={showHistory}
                          onClick={() =>
                            setHistoryOpen((prev) => {
                              const next = new Set(prev)
                              if (next.has(text.key)) next.delete(text.key)
                              else next.add(text.key)
                              return next
                            })
                          }
                        >
                          History ({versions.length})
                        </button>
                      ) : null}
                      {history && user?.id ? (
                        <ContractCardReview
                          name={entry.name}
                          state={review}
                          canTakeBack={canTakeBack}
                          cardKey={text.key}
                          onMark={(note) => markReviewed(entry.id, note)}
                          onTakeBack={() => (review.last ? takeBackReview(review.last.id) : Promise.resolve(false))}
                        />
                      ) : null}
                    </div>

                    {showHistory && versions.length > 0 ? (
                      <ContractCardHistory versions={versions} nameOf={nameOf} picked={picked} onToggleCompare={(key) => setPicked((prev) => toggleCompare(prev, key))} cardKey={text.key} />
                    ) : null}

                    {entry.seenOn.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                        <span style={MUTED}>As the customer sees it:</span>
                        {entry.seenOn.map((ref) => (
                          <button key={`${ref.journeyId}/${ref.stepId}`} type="button" style={PILL} onClick={() => onOpenStep(ref)}>
                            {stepLabel(ref)} →
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}

      {/* The cards are ticked far below the columns they fill — the bar keeps the way back in reach. */}
      {compared.length > 0 ? (
        <div style={{ position: 'sticky', bottom: '4.5rem', zIndex: 5, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }} data-testid="contracts-compare-bar">
          <div style={{ ...CARD, padding: '0.4rem 0.7rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.6rem', alignItems: 'center', fontSize: '0.8rem', borderColor: 'var(--border-blue)', boxShadow: '0 4px 14px rgba(0, 0, 0, 0.18)', pointerEvents: 'auto' }}>
            <strong style={{ color: 'var(--text-strong)' }}>Comparing {compared.length}</strong>
            <button type="button" style={PILL_ON} onClick={() => document.getElementById('contracts-compare')?.scrollIntoView({ block: 'start', behavior: 'auto' })}>
              Read side by side ↑
            </button>
            <button type="button" style={PILL} onClick={() => setPicked([])}>
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {reading ? (
        <ContractReaderModal
          entry={reading.entry}
          text={reading.text}
          surfaces={readerSurfacesFor(reading.entry)}
          editDoor={readerEditDoor(contractEditAction(reading.entry, reading.text, role), reading.text, {
            edit: (doc) => {
              setReading(null)
              setEditing(doc)
            },
            settings: (tabId, anchorId) => {
              setReading(null)
              onOpenEditor(tabId, anchorId)
            },
          })}
          onClose={() => setReading(null)}
        />
      ) : null}

      {editing ? (
        <StandardTermsEditModal
          doc={editing}
          openJobs={0}
          fromSettings
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setData((prev) => (prev ? { ...prev, bookDocs: prev.bookDocs.map((d) => (d.id === saved.id ? { ...d, ...saved } : d)) } : prev))
            setEditing(null)
          }}
        />
      ) : null}
    </div>
  )
}

/** The card's edit door, as the reader's footer carries it (v2.4098): a press closes the reader and opens the door. */
function readerEditDoor(
  action: ReturnType<typeof contractEditAction>,
  text: ResolvedContractText,
  go: { edit: (doc: ContractBookDoc) => void; settings: (tabId: string, anchorId: string) => void },
): ContractReaderEditDoor | null {
  if (action.kind === 'modal' && text.doc) {
    const doc = text.doc
    return { label: action.label, onClick: () => go.edit(doc) }
  }
  if (action.kind === 'settings') return { label: action.label, onClick: () => go.settings(action.tabId, action.anchorId) }
  if (action.kind === 'page') return { label: action.label, to: action.to }
  return null
}

function lastChangedLine(text: ResolvedContractText): string {
  if (text.versionLabel) return text.versionLabel
  if (text.status === 'fixed') return 'Only with an app update.'
  if (text.status === 'per_record') return 'With each record.'
  if (text.status === 'in_settings') return 'No date is kept.'
  if (text.status === 'built_in') return 'Never — it is the wording the app came with.'
  return 'No date is kept.'
}

/** The wording itself, or the sentence that says why there is none to show. */
function Wording({ entry, text }: { entry: ContractCatalogEntry; text: ResolvedContractText }) {
  if (text.text.trim() === '') {
    const why =
      text.status === 'per_record' && entry.source.kind === 'per_record'
        ? entry.source.startsFrom
        : text.status === 'blank'
          ? 'Nothing is set, so the customer sees nothing here.'
          : text.status === 'in_settings'
            ? 'Set in Settings, in a form of its own. Open it as the customer sees it to read a sample.'
            : 'Built around the facts of each record. Open it as the customer sees it to read a sample.'
    return <p style={{ ...WORDING, color: 'var(--text-muted)' }}>{why}</p>
  }
  return <Body text={text.text} format={text.format} />
}

function Body({ text, format }: { text: string; format: 'plain' | 'html' | 'markdown' }) {
  // v2.4150: plain goes through the renderer too, so a `**statutory sentence**` reads on the card as it prints.
  if (format === 'plain') return <ContractBodyDisplay format="plain" bodyHtml={text} scrollStyles={{ fontSize: '0.8rem', lineHeight: 1.5, color: 'var(--text-700)', overflowWrap: 'anywhere' }} />
  return <ContractBodyDisplay format={format} bodyHtml={text} scrollStyles={{ fontSize: '0.8rem', color: 'var(--text-700)' }} />
}
