import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { SignedAmountSmallCents } from '../AmountSmallCents'
import { CopyLinkIcon } from '../icons/CopyLinkIcon'
import { ValueLine, ValueLines, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'
import { useOptionalToastContext } from '../../contexts/ToastContext'
import { useIsNarrowScreen } from '../../hooks/useIsNarrowScreen'
import { useMeasuredWidth } from '../../hooks/useMeasuredWidth'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { SUPPLY_INVOICE_WORDS, invoiceDayWords, lineHoldsWord, markWords as cutAtWords } from '../../lib/jobs/supplyInvoiceList'
import { billLinkHref } from '../../lib/materials/bills/billLink'
import { BILL_VIEWER_WORDS as WORDS, billEditHref, billLinesToList, billViewerKey, billViewerPosition, type BillFactLine, type BillFacts, type BillViewerItem } from '../../lib/materials/bills/billViewer'
import { supabaseBillViewerIo, type BillBytes, type BillLoad, type BillViewerIo } from '../../lib/materials/bills/billViewerIo'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { BillPdfPages } from './BillPdfPages'

export interface BillViewerProps {
  /** The list the viewer flips through, as it is searched right now. */
  items: readonly BillViewerItem[]
  /** The bill on show. It may have left `items` when the search was narrowed past it. */
  openId: string
  onOpen: (invoiceId: string) => void
  onClose: () => void
  /** The job the list is of: what of a bill is on it shows beside the paper. */
  jobId?: string | null
  /** The list's own search, when it has one. The viewer's box types into it, so Previous and Next follow it. */
  search?: { query: string; onQuery: (query: string) => void } | null
  /** The link the share press copies for a bill. */
  shareUrlOf: (invoiceId: string) => string
  /** The plain words of the list's search, marked where the bill's lines hold them. */
  markWords?: readonly string[]
  io?: BillViewerIo
  /** A page of its own, opened from a bill's link: there is no screen behind it to press. */
  standalone?: boolean
}

const NO_WORDS: readonly string[] = []

const TONE_COLOR: Record<BillFacts['linesTone'], string> = { ok: 'var(--text-green-700)', accepted: 'var(--text-green-700)', off: 'var(--text-amber-800)', none: 'var(--text-muted)' }

/**
 * The bill viewer (punch list #431, PR 2): a supply house bill drawn in place over the list it came from, so a person
 * flips through a job's bills with no new tab each. The list sits beside the paper on a desk; Previous and Next, the
 * arrow keys and Escape work everywhere, and they follow the list as it is searched. The bill's facts sit beside the
 * paper. **Open in Drive** is the way out to a tab of its own. On a phone the viewer is the whole screen, with
 * Previous and Next under the thumb. The rules are `billViewer.ts`, the reads `billViewerIo.ts`.
 */
export function BillViewer({ items, openId, onOpen, onClose, jobId = null, search = null, shareUrlOf, markWords = NO_WORDS, io = supabaseBillViewerIo, standalone = false }: BillViewerProps) {
  const toast = useOptionalToastContext()
  const narrow = useIsNarrowScreen()
  const todayYmd = useMemo(() => todayYmdInAppTz(), [])
  const [cardRef, cardWidth] = useMeasuredWidth<HTMLDivElement>()
  const [paneRef, paneWidth] = useMeasuredWidth<HTMLDivElement>()
  const railRef = useRef<HTMLDivElement>(null)

  const [load, setLoad] = useState<{ id: string; got: BillLoad } | null>(null)
  const [file, setFile] = useState<{ id: string; got: BillBytes } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [allLines, setAllLines] = useState<{ id: string } | null>(null)

  useEffect(() => {
    let live = true
    io.loadBill(openId, jobId).then(
      (got) => {
        if (live) setLoad({ id: openId, got })
      },
      () => {
        if (live) setLoad({ id: openId, got: { problem: 'notHere' } })
      },
    )
    return () => {
      live = false
    }
  }, [io, openId, jobId])

  const got = load?.id === openId ? load.got : null
  const facts = got && 'facts' in got ? got.facts : null
  const driveHref = facts ? billLinkHref(facts.link) : null
  const hasPdf = !!facts && (!!facts.ownCopyPath || !!driveHref)

  useEffect(() => {
    if (!facts || !hasPdf) return
    let live = true
    io.loadBillBytes(facts).then(
      (bytes) => {
        if (live) setFile({ id: facts.invoiceId, got: bytes })
      },
      () => {
        if (live) setFile({ id: facts.invoiceId, got: { problem: WORDS.cannotOpenBody, why: null, retry: true } })
      },
    )
    return () => {
      live = false
    }
  }, [io, facts, hasPdf, attempt])

  const paper = file?.id === openId ? file.got : null
  const pos = useMemo(() => billViewerPosition(items, openId), [items, openId])
  const item = pos.index >= 0 ? items[pos.index]! : null

  // The next bill's paper is asked for while this one is read, so Next draws at once.
  useEffect(() => {
    if (!paper || !('bytes' in paper) || !pos.nextId) return
    let live = true
    void io.loadBill(pos.nextId, jobId).then((next) => {
      if (live && 'facts' in next && (next.facts.ownCopyPath || billLinkHref(next.facts.link))) void io.loadBillBytes(next.facts)
    })
    return () => {
      live = false
    }
  }, [io, paper, pos.nextId, jobId])

  const flip = (id: string | null) => {
    if (id) onOpen(id)
  }

  // The newest handlers, for the one key listener.
  const keys = useRef({ onClose, flip, prevId: pos.prevId, nextId: pos.nextId })
  keys.current = { onClose, flip, prevId: pos.prevId, nextId: pos.nextId }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable === true)
      const act = billViewerKey(e.key, typing)
      if (!act) return
      // Taken in the capture phase and stopped, so Escape closes this window and not the one under it.
      e.preventDefault()
      e.stopPropagation()
      if (act === 'close') keys.current.onClose()
      else keys.current.flip(act === 'next' ? keys.current.nextId : keys.current.prevId)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // A new bill starts at the top of its paper, and the list keeps it in view.
  useEffect(() => {
    if (paneRef.current) paneRef.current.scrollTop = 0
    const rail = railRef.current
    const cur = rail?.querySelector<HTMLElement>('[aria-current="true"]')
    if (rail && cur) {
      if (cur.offsetTop < rail.scrollTop) rail.scrollTop = cur.offsetTop
      else if (cur.offsetTop + cur.offsetHeight > rail.scrollTop + rail.clientHeight) rail.scrollTop = cur.offsetTop + cur.offsetHeight - rail.clientHeight
    }
  }, [openId, paneRef])

  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true })
  }, [cardRef])

  const copyLink = async () => {
    const url = shareUrlOf(openId)
    try {
      await navigator.clipboard.writeText(url)
      toast?.showToast(SUPPLY_INVOICE_WORDS.copied, 'success')
    } catch {
      toast?.showToast(SUPPLY_INVOICE_WORDS.copyByHand(url), 'info')
    }
  }

  const number = facts?.number || item?.number || ''
  const house = facts?.house || item?.house || ''
  const dateYmd = facts?.dateYmd || item?.dateYmd || ''
  const amount = facts ? (facts.onJob?.amount ?? facts.total) : (item?.amount ?? null)
  const showRail = !narrow && (items.length > 1 || !!search)
  const wide = !narrow && (cardWidth ?? 1200) >= 980
  const pageWidth = Math.max(220, Math.min((paneWidth ?? 640) - (narrow ? 20 : 28), 860))
  const showNav = items.length > 1 || pos.index < 0

  const btn: CSSProperties = { padding: narrow ? '0 0.9rem' : '0.3rem 0.65rem', minHeight: narrow ? 44 : undefined, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', fontFamily: 'inherit', fontSize: narrow ? '0.9375rem' : '0.8125rem', cursor: 'pointer', whiteSpace: 'nowrap' }
  const dead: CSSProperties = { ...btn, border: `1px solid ${DEAD_PRESS_FILL}`, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' }
  const iconBtn: CSSProperties = { width: narrow ? 44 : 32, height: narrow ? 44 : 30, flex: 'none', display: 'inline-grid', placeItems: 'center', padding: 0, border: narrow ? 'none' : '1px solid var(--border)', borderRadius: 6, background: narrow ? 'none' : 'var(--surface)', color: 'var(--text-700)', fontFamily: 'inherit', fontSize: '0.9375rem', cursor: 'pointer' }
  const muted: CSSProperties = { color: 'var(--text-muted)' }
  const hole: CSSProperties = { width: '100%', maxWidth: 540, border: '1px dashed var(--border-strong)', borderRadius: 8, background: 'var(--surface)', padding: '1.5rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.875rem' }

  const nav = (where: 'top' | 'bottom') => (
    <div data-testid={`bill-nav-${where}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', ...(where === 'bottom' ? { flex: 1, justifyContent: 'space-between' } : {}) }}>
      <button type="button" disabled={!pos.prevId} onClick={() => flip(pos.prevId)} style={pos.prevId ? btn : dead}>
        ‹ {WORDS.previous}
      </button>
      <span data-testid="bill-position" style={{ ...muted, fontSize: '0.8125rem', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {pos.words}
      </span>
      <button type="button" disabled={!pos.nextId} onClick={() => flip(pos.nextId)} style={pos.nextId ? btn : dead}>
        {WORDS.next} ›
      </button>
    </div>
  )

  // The lines read from the paper, beside it: with a search on, the lines that hold its words come alone and marked.
  const linesBody = (lines: readonly BillFactLine[]) => {
    const holds = (line: BillFactLine) => markWords.some((word) => word.length >= 2 && lineHoldsWord(line, word))
    const list = billLinesToList(lines, holds, allLines?.id === openId)
    return (
      <div data-testid="bill-lines" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        <div style={{ ...muted, fontSize: '0.75rem' }}>{list.found > 0 && list.more > 0 ? WORDS.linesFound : WORDS.linesTitle}</div>
        <div>
          {list.lines.map((line) => {
            const found = holds(line)
            return (
              <div
                key={line.lineNo}
                data-found={found ? 'true' : undefined}
                style={{ display: 'grid', gridTemplateColumns: '2.2rem minmax(0, 1fr) auto', columnGap: '0.4rem', padding: '0.2rem 0.25rem', paddingLeft: line.component ? '0.9rem' : '0.25rem', borderTop: '1px solid var(--border)', background: found ? 'var(--bg-amber-100)' : undefined, fontSize: '0.75rem' }}
              >
                <span style={{ ...muted, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{line.qty ?? ''}</span>
                <span style={{ minWidth: 0, overflowWrap: 'anywhere', color: found ? 'var(--text-amber-800)' : undefined }}>
                  {cutAtWords(line.description || line.code, markWords).map((piece, i) => (piece.hit ? <b key={i}>{piece.text}</b> : <span key={i}>{piece.text}</span>))}
                  {line.code && line.description ? <span style={{ ...(found ? {} : muted), marginLeft: '0.35rem', fontSize: '0.92em' }}>{line.code}</span> : null}
                </span>
                <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: found ? 'var(--text-amber-800)' : undefined }}>
                  {line.extendedCents == null ? '' : <SignedAmountSmallCents value={line.extendedCents / 100} />}
                </span>
              </div>
            )
          })}
        </div>
        {list.more > 0 ? (
          <button type="button" onClick={() => setAllLines({ id: openId })} style={{ alignSelf: 'flex-start', margin: 0, padding: 0, border: 'none', background: 'none', fontFamily: 'inherit', fontSize: '0.75rem', color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' }}>
            Show all {lines.length} lines
          </button>
        ) : null}
      </div>
    )
  }

  let paperBody: ReactNode
  if (!got) paperBody = <p style={muted}>{WORDS.opening}</p>
  else if ('problem' in got) paperBody = <p data-testid="bill-problem">{got.problem === 'notYours' ? WORDS.notYours : WORDS.notHere}</p>
  else if (!hasPdf) {
    paperBody = (
      <div data-testid="bill-no-pdf" style={hole}>
        <b style={{ color: 'var(--text-strong)' }}>{WORDS.noPdfTitle}</b>
        <span style={muted}>{WORDS.noPdfBody}</span>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link to={billEditHref(openId)} style={{ ...btn, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
            {WORDS.openTheBill}
          </Link>
          {got.facts.houseSite ? (
            <button type="button" onClick={() => openInExternalBrowser(got.facts.houseSite!)} style={btn}>
              {WORDS.supplierSite} ↗
            </button>
          ) : null}
        </div>
      </div>
    )
  } else if (!paper) paperBody = <p style={muted}>{WORDS.reading}</p>
  else if ('problem' in paper) {
    paperBody = (
      <div data-testid="bill-cannot-open" style={hole}>
        <b style={{ color: 'var(--text-strong)' }}>{WORDS.cannotOpenTitle}</b>
        <span style={muted}>
          {paper.problem} {driveHref ? WORDS.cannotOpenBody : ''}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {paper.retry ? (
            <button type="button" onClick={() => setAttempt((n) => n + 1)} style={btn}>
              {WORDS.tryAgain}
            </button>
          ) : null}
          {driveHref ? (
            <button type="button" onClick={() => openInExternalBrowser(driveHref)} style={btn}>
              {WORDS.openInDrive} ↗
            </button>
          ) : null}
        </div>
      </div>
    )
  } else paperBody = <BillPdfPages bytes={paper.bytes} pageFrom={got.facts.pageFrom} pageTo={got.facts.pageTo} width={pageWidth} />

  const factsBody = facts ? (
    <>
      {narrow && driveHref ? (
        // On a phone the header has no room for it, so the way out to a tab of its own sits with the facts.
        <button type="button" onClick={() => openInExternalBrowser(driveHref)} style={{ ...btn, alignSelf: 'flex-start' }}>
          {WORDS.openInDrive} ↗
        </button>
      ) : null}
      <ValueLines>
        <ValueLine label="Supply house">
          <WorkedOutValue>{facts.house || '—'}</WorkedOutValue>
        </ValueLine>
        <ValueLine label="Invoice">
          <WorkedOutValue>{facts.number || '—'}</WorkedOutValue>
        </ValueLine>
        <ValueLine label="Date">
          <WorkedOutValue>{invoiceDayWords(facts.dateYmd, todayYmd)}</WorkedOutValue>
        </ValueLine>
        {facts.poText ? (
          <ValueLine label="PO">
            <WorkedOutValue>{facts.poText}</WorkedOutValue>
          </ValueLine>
        ) : null}
        <ValueLine label="Bill total">
          <WorkedOutValue>
            <SignedAmountSmallCents value={facts.total} />
          </WorkedOutValue>
        </ValueLine>
        {facts.onJob ? (
          <ValueLine label="On this job">
            <WorkedOutValue>{facts.onJob.pct}%</WorkedOutValue>
            {' · '}
            <WorkedOutValue>
              <SignedAmountSmallCents value={facts.onJob.amount} />
            </WorkedOutValue>
            {facts.onJob.pct < 100 ? <div style={{ ...muted, fontSize: '0.75rem' }}>The rest is not on this job.</div> : null}
          </ValueLine>
        ) : null}
        <ValueLine label="Lines read">
          <span style={{ color: TONE_COLOR[facts.linesTone], fontWeight: facts.linesTone === 'none' ? 400 : 600 }}>{facts.linesWords}</span>
        </ValueLine>
        {facts.kind !== 'credit' ? (
          <ValueLine label="Paid">
            <WorkedOutValue>{facts.paid ? (facts.paidOnYmd ? invoiceDayWords(facts.paidOnYmd, todayYmd) : 'Yes') : 'Not yet'}</WorkedOutValue>
          </ValueLine>
        ) : null}
      </ValueLines>
      {facts.lines.length > 0 ? linesBody(facts.lines) : null}
      <p style={{ ...muted, fontSize: '0.75rem', margin: 0 }}>{WORDS.factsNote}</p>
    </>
  ) : null

  return createPortal(
    <div
      data-testid="bill-viewer"
      // A click outside the window closes it, on the release and not the press, as every window does (the page-wide
      // guard drops a click whose press or release was elsewhere). The list this opened from sits inside rows that open
      // on a press or a key: neither should hear this window, so the click stops here either way.
      onClick={(e) => {
        e.stopPropagation()
        if (!standalone && e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => e.stopPropagation()}
      style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', background: 'rgba(0,0,0,0.45)', padding: narrow ? 0 : 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Invoice ${number}`}
        tabIndex={-1}
        style={{ flex: 1, minWidth: 0, minHeight: 0, maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface)', color: 'var(--text-base)', borderRadius: narrow ? 0 : 10, boxShadow: '0 20px 60px rgba(0,0,0,0.35)', outline: 'none', paddingTop: narrow ? 'env(safe-area-inset-top, 0px)' : undefined }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem 0.9rem', flexWrap: narrow ? 'nowrap' : 'wrap', padding: narrow ? '0.15rem 0.25rem 0.15rem 0.75rem' : '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{number}</div>
            <div style={{ ...muted, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {house}
              {dateYmd ? ` · ${invoiceDayWords(dateYmd, todayYmd)}` : ''}
              {amount != null ? (
                <>
                  {' · '}
                  <SignedAmountSmallCents value={amount} />
                </>
              ) : null}
            </div>
          </div>
          {!narrow && showNav ? nav('top') : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: narrow ? 0 : '0.4rem' }}>
            <button type="button" onClick={() => void copyLink()} title={SUPPLY_INVOICE_WORDS.shareTitle} aria-label={SUPPLY_INVOICE_WORDS.shareTitle} style={iconBtn}>
              <CopyLinkIcon />
            </button>
            {driveHref && !narrow ? (
              <button type="button" onClick={() => openInExternalBrowser(driveHref)} style={btn}>
                {WORDS.openInDrive} ↗
              </button>
            ) : null}
            <button type="button" onClick={onClose} aria-label={WORDS.close} style={iconBtn}>
              ✕
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          {showRail ? (
            <aside style={{ flex: '0 0 236px', minHeight: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
              {search ? (
                <input
                  type="search"
                  value={search.query}
                  onChange={(e) => search.onQuery(e.target.value)}
                  // The list beside the paper is narrow, so its box says less than the list's own does.
                  placeholder={WORDS.searchPlaceholder}
                  aria-label={SUPPLY_INVOICE_WORDS.searchLabel}
                  autoComplete="off"
                  style={{ margin: '0.5rem', padding: '0.3rem 0.5rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontSize: '0.75rem' }}
                />
              ) : null}
              <div ref={railRef} data-testid="bill-rail" style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' }}>
                {items.length === 0 ? (
                  <div style={{ ...muted, padding: '0.75rem', fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                    {WORDS.nothingMatches}
                    {search ? (
                      <button type="button" onClick={() => search.onQuery('')} style={btn}>
                        {SUPPLY_INVOICE_WORDS.clearSearch}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  items.map((it) => {
                    const cur = it.invoiceId === openId
                    return (
                      <button
                        key={it.invoiceId}
                        type="button"
                        aria-current={cur ? 'true' : undefined}
                        onClick={() => onOpen(it.invoiceId)}
                        style={{ width: '100%', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: '0.5rem', padding: '0.35rem 0.6rem', border: 'none', borderTop: '1px solid var(--border)', background: cur ? 'var(--bg-blue-200)' : 'none', color: 'var(--text-base)', fontFamily: 'inherit', fontSize: '0.75rem', textAlign: 'left', cursor: 'pointer' }}
                      >
                        <b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-strong)' }}>{it.number}</b>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                          <SignedAmountSmallCents value={it.amount} />
                        </span>
                        <span style={{ ...muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.house}</span>
                        <span style={{ ...muted, whiteSpace: 'nowrap' }}>{invoiceDayWords(it.dateYmd, todayYmd)}</span>
                      </button>
                    )
                  })
                )}
              </div>
            </aside>
          ) : null}

          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: wide ? 'row' : 'column', overflowY: wide ? undefined : 'auto' }}>
            <div
              ref={paneRef}
              data-testid="bill-paper"
              style={{ flex: wide ? 1 : 'none', minWidth: 0, overflowY: wide ? 'auto' : undefined, background: 'var(--bg-muted)', padding: narrow ? '0.6rem' : '0.85rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', fontSize: '0.875rem' }}
            >
              {paperBody}
            </div>
            {factsBody ? (
              <aside
                data-testid="bill-facts"
                style={{ flex: wide ? '0 0 264px' : 'none', overflowY: wide ? 'auto' : undefined, borderLeft: wide ? '1px solid var(--border)' : undefined, borderTop: wide ? undefined : '1px solid var(--border)', padding: '0.75rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8125rem' }}
              >
                {factsBody}
              </aside>
            ) : null}
          </div>
        </div>

        {narrow ? (
          showNav ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem calc(0.4rem + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--border)' }}>{nav('bottom')}</div>
          ) : null
        ) : showNav ? (
          <div style={{ ...muted, padding: '0.35rem 0.75rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem' }}>
            <kbd>←</kbd> <kbd>→</kbd> {WORDS.keysHint} · <kbd>Esc</kbd> closes
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
