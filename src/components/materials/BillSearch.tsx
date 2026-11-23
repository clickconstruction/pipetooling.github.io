import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { SignedAmountSmallCents } from '../AmountSmallCents'
import { EmptyState } from '../EmptyState'
import { CopyLinkIcon } from '../icons/CopyLinkIcon'
import { WorkedOutValue } from '../valuesInPlace/ValuesInPlace'
import { useOptionalToastContext } from '../../contexts/ToastContext'
import { useIsNarrowScreen } from '../../hooks/useIsNarrowScreen'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { SUPPLY_INVOICE_WORDS, invoiceDayWords, markWords, supplyInvoiceShareUrl } from '../../lib/jobs/supplyInvoiceList'
import { BILL_SEARCH_LIMIT, BILL_SEARCH_WAIT_MS, BILL_SEARCH_WORDS as WORDS, billSearchArgs, billSearchJobsWords, billSearchViewerItems, type BillSearchHit } from '../../lib/materials/bills/billSearch'
import { supabaseBillSearchIo, type BillSearchIo } from '../../lib/materials/bills/billSearchIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { BillViewer } from './BillViewer'

const NO_HITS: BillSearchHit[] = []

type Found = { key: string; state: 'found'; hits: BillSearchHit[] } | { key: string; state: 'failed'; why: string }

/**
 * One search across every supply house bill (punch list #431, PR 5), on Materials → Supply houses. A person types a
 * number, a supply house, a PO, an amount, a day or a part printed on a bill, and the bills that hold every word are
 * listed newest first, each with its house, its day, its amount and the jobs it is on. A bill found by a part says
 * which line found it. A press opens the bill in the bill viewer, with the bills found beside the paper, and a link
 * icon copies the bill's own link. The database does the finding as the reader (`search_supply_bills`); the rules for
 * what is asked are `billSearch.ts`.
 */
export function BillSearch({ io = supabaseBillSearchIo, waitMs = BILL_SEARCH_WAIT_MS }: { io?: BillSearchIo; /** How long the box waits after a key; a smoke passes 0. */ waitMs?: number }) {
  const toast = useOptionalToastContext()
  const narrow = useIsNarrowScreen()
  const todayYmd = useMemo(() => todayYmdInAppTz(), [])
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Found | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)

  const args = useMemo(() => billSearchArgs(query), [query])
  // What is asked, as one string: the same words in the same order with the same date is the same search.
  const key = args ? JSON.stringify(args) : ''
  const asked = useRef(args)
  asked.current = args

  useEffect(() => {
    if (!key) return
    let live = true
    const timer = window.setTimeout(() => {
      const now = asked.current
      if (!now) return
      io.search(now).then(
        (hits) => {
          if (live) setFound({ key, state: 'found', hits })
        },
        (e) => {
          if (live) setFound({ key, state: 'failed', why: formatErrorMessage(e, WORDS.failed) })
        },
      )
    }, waitMs)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [io, key, waitMs, attempt])

  // The answer on show is the one to the search in the box: an older answer is not drawn under newer words.
  const answer = key && found?.key === key ? found : null
  const hits = useMemo(() => (answer?.state === 'found' ? answer.hits : NO_HITS), [answer])
  const items = useMemo(() => billSearchViewerItems(hits), [hits])
  const words = args?.words ?? []

  const copyLink = async (invoiceId: string) => {
    const url = supplyInvoiceShareUrl(invoiceId, null)
    try {
      await navigator.clipboard.writeText(url)
      toast?.showToast(SUPPLY_INVOICE_WORDS.copied, 'success')
    } catch {
      toast?.showToast(SUPPLY_INVOICE_WORDS.copyByHand(url), 'info')
    }
  }

  const press = narrow ? 44 : 28
  const muted: CSSProperties = { color: 'var(--text-muted)' }
  const linkPress: CSSProperties = { margin: 0, padding: 0, border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 'inherit', color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer', textAlign: 'left' }

  return (
    <section data-testid="bill-search" style={{ marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={WORDS.placeholder}
          aria-label={WORDS.label}
          autoComplete="off"
          style={{ flex: narrow ? '1 1 100%' : '1 1 320px', maxWidth: narrow ? undefined : 460, minWidth: 0, padding: narrow ? '0.6rem' : '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontSize: narrow ? '16px' : '0.875rem' }}
        />
        {key ? (
          <span data-testid="bill-search-count" style={{ ...muted, fontSize: '0.8125rem' }}>
            {!answer ? WORDS.searching : answer.state === 'found' && hits.length > 0 ? <WorkedOutValue>{WORDS.count(hits.length, hits.length >= BILL_SEARCH_LIMIT)}</WorkedOutValue> : null}
          </span>
        ) : null}
      </div>

      {answer?.state === 'failed' ? (
        <div data-testid="bill-search-failed" style={{ marginTop: '0.5rem', fontSize: '0.875rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>
            {WORDS.failed} {answer.why === WORDS.failed ? '' : answer.why}
          </span>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} style={{ padding: '0.3rem 0.65rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', fontFamily: 'inherit', fontSize: '0.8125rem', cursor: 'pointer' }}>
            {WORDS.tryAgain}
          </button>
        </div>
      ) : null}

      {answer?.state === 'found' && hits.length === 0 ? <EmptyState compact {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'bills', query }), { onPress: () => setQuery('') })} /> : null}

      {hits.length > 0 ? (
        <div style={{ marginTop: '0.5rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', maxWidth: 860 }}>
          {hits.map((hit, i) => (
            <div
              key={hit.invoice_id}
              data-testid="bill-search-hit"
              style={{ display: 'grid', gridTemplateColumns: `${press}px minmax(0, 1fr) auto`, columnGap: '0.5rem', alignItems: 'start', padding: narrow ? '0.15rem 0.5rem 0.45rem 0.1rem' : '0.35rem 0.6rem 0.4rem 0.3rem', borderTop: i === 0 ? undefined : '1px solid var(--border)', fontSize: '0.8125rem' }}
            >
              <button
                type="button"
                onClick={() => void copyLink(hit.invoice_id)}
                title={SUPPLY_INVOICE_WORDS.shareTitle}
                aria-label={SUPPLY_INVOICE_WORDS.shareLabel(hit.invoice_number)}
                style={{ width: press, height: press, display: 'inline-grid', placeItems: 'center', margin: 0, padding: 0, border: 'none', borderRadius: 6, background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <CopyLinkIcon />
              </button>
              <div style={{ minWidth: 0, paddingTop: narrow ? '0.7rem' : '0.25rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 0.5rem', alignItems: 'baseline' }}>
                  <button type="button" onClick={() => setOpenId(hit.invoice_id)} style={{ ...linkPress, fontWeight: 600 }}>
                    {hit.invoice_number}
                  </button>
                  <span>{hit.supply_house_name}</span>
                  <span style={muted}>{invoiceDayWords(hit.invoice_date, todayYmd)}</span>
                  {hit.has_pdf ? null : <span style={{ padding: '0 0.3rem', borderRadius: 4, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', fontSize: '0.92em' }}>{WORDS.noPdf}</span>}
                  {hit.is_paid ? <span style={muted}>{WORDS.paid}</span> : null}
                </div>
                <div style={{ ...muted, overflowWrap: 'anywhere' }}>
                  {billSearchJobsWords(hit)}
                  {hit.purchase_order_number?.trim() ? ` · PO ${hit.purchase_order_number.trim()}` : ''}
                </div>
                {hit.on_paper ? (
                  <div data-testid="bill-search-on-paper" style={{ ...muted, overflowWrap: 'anywhere' }}>
                    {WORDS.onThePaper}{' '}
                    {markWords(hit.on_paper, words).map((piece, j) =>
                      piece.hit ? (
                        <mark key={j} style={{ background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderRadius: 2, padding: '0 1px' }}>
                          {piece.text}
                        </mark>
                      ) : (
                        <span key={j}>{piece.text}</span>
                      ),
                    )}
                    {hit.on_paper_code && hit.on_paper_code !== hit.on_paper ? <span style={{ marginLeft: '0.35rem' }}>{hit.on_paper_code}</span> : null}
                  </div>
                ) : null}
              </div>
              <div style={{ paddingTop: narrow ? '0.7rem' : '0.25rem', fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                <SignedAmountSmallCents value={Number(hit.amount) || 0} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {openId ? <BillViewer items={items} openId={openId} onOpen={setOpenId} onClose={() => setOpenId(null)} shareUrlOf={(id) => supplyInvoiceShareUrl(id, null)} markWords={words} /> : null}
    </section>
  )
}
