import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { AmountSmallCents } from '../AmountSmallCents'
import { EmptyState } from '../EmptyState'
import { CopyLinkIcon } from '../icons/CopyLinkIcon'
import { BillViewer } from '../materials/BillViewer'
import { WorkedOutValue } from '../valuesInPlace/ValuesInPlace'
import { useOptionalToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { useIsNarrowScreen } from '../../hooks/useIsNarrowScreen'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import {
  SUPPLY_INVOICE_SEARCH_FROM,
  SUPPLY_INVOICE_WORDS as WORDS,
  canShareSupplyInvoice,
  invoiceDayWords,
  markWords,
  searchSupplyInvoices,
  supplierSiteHref,
  supplyHouseChips,
  supplyInvoiceCountWords,
  supplyInvoicePdfHref,
  supplyInvoiceSearchWords,
  supplyInvoiceShareUrl,
  type InvoiceLinesById,
  type SupplyInvoiceRow,
} from '../../lib/jobs/supplyInvoiceList'
import { supabasePaperIo, type PaperIo } from '../../lib/materials/lines/paperIo'
import type { BillViewerItem } from '../../lib/materials/bills/billViewer'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { todayYmdInAppTz } from '../../utils/dateUtils'

const linkStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  border: 'none',
  background: 'none',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  color: 'var(--text-link)',
  textDecoration: 'underline',
  cursor: 'pointer',
  textAlign: 'left',
}

/**
 * A job's supply house invoices on the Job Summary (punch list #431): the list the Parts Cost section opens. For the
 * office an invoice number opens the bill in place, in the bill viewer, with this list beside the paper so Previous
 * and Next follow it as it is searched (PR 2). An icon to its left copies the app's own link to the bill and says so
 * in a toast. Anyone else who sees the list keeps the bill's Drive link, in a tab of its own. A list of eight or more
 * grows a search box over the house, the number, the date and the amount, with a chip per supply house and a count and
 * a total of what is left. Cents are drawn small and a date drops this year. The kernel is
 * `lib/jobs/supplyInvoiceList.ts`; this file draws it.
 *
 * For the office the search also reaches the lines read from each bill's paper (PR 3): a list with a box reads its
 * bills' lines once, under the office's own read of them, and a row a part found says which line found it.
 */
export function JobSummarySupplyInvoiceList({ rows, paperIo }: { rows: SupplyInvoiceRow[]; /** The read of the bills' lines; a smoke hands in a fake. */ paperIo?: Pick<PaperIo, 'loadForInvoices'> }) {
  const { role } = useAuth()
  const toast = useOptionalToastContext()
  const narrow = useIsNarrowScreen()
  const [query, setQuery] = useState('')
  const [house, setHouse] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const todayYmd = useMemo(() => todayYmdInAppTz(), [])

  const canShare = canShareSupplyInvoice(role)
  const searchable = rows.length >= SUPPLY_INVOICE_SEARCH_FROM
  const chips = useMemo(() => (searchable ? supplyHouseChips(rows) : []), [rows, searchable])
  // A chip whose house left the list (the rows were read again) no longer narrows it.
  const liveHouse = house != null && chips.some((c) => c.name === house) ? house : null
  // The lines on each bill's paper, for the search. Only the office reads them, and only a list long enough to have a
  // box asks. Until they come, and if they never do, the search is the four facts alone.
  const invoiceIdsKey = useMemo(() => rows.map((row) => row.invoice_id).join(','), [rows])
  const [lines, setLines] = useState<{ key: string; byId: InvoiceLinesById } | null>(null)
  useEffect(() => {
    if (!canShare || !searchable || !invoiceIdsKey) return
    let live = true
    const io = paperIo ?? supabasePaperIo()
    void io.loadForInvoices(invoiceIdsKey.split(',')).then(
      (papers) => {
        if (!live) return
        const byId = new Map<string, { description: string; code: string; mfr: string }[]>()
        for (const [invoiceId, paper] of papers) byId.set(invoiceId, paper.lines.map((line) => ({ description: line.description, code: line.houseCode, mfr: line.mfrNumber })))
        setLines({ key: invoiceIdsKey, byId })
      },
      () => {},
    )
    return () => {
      live = false
    }
  }, [canShare, searchable, invoiceIdsKey, paperIo])
  const linesById = lines?.key === invoiceIdsKey && lines.byId.size > 0 ? lines.byId : null
  const found = useMemo(() => searchSupplyInvoices(rows, searchable ? query : '', liveHouse, linesById), [rows, searchable, query, liveHouse, linesById])
  const searchWords = useMemo(() => supplyInvoiceSearchWords(searchable ? query : ''), [searchable, query])
  const narrowed = found.rows.length !== rows.length
  const jobId = rows[0]?.job_id ?? null
  // The viewer flips through the list as it is searched, so it is handed what the search left.
  const viewerItems = useMemo<BillViewerItem[]>(
    () => found.rows.map((row) => ({ invoiceId: row.invoice_id, number: row.invoice_number, house: row.supply_house_name ?? '', dateYmd: (row.invoice_date ?? '').slice(0, 10), amount: row.allocated_amount })),
    [found.rows],
  )

  const clear = () => {
    setQuery('')
    setHouse(null)
  }

  const copyLink = async (row: SupplyInvoiceRow) => {
    const url = supplyInvoiceShareUrl(row.invoice_id, row.job_id)
    try {
      await navigator.clipboard.writeText(url)
      toast?.showToast(WORDS.copied, 'success')
    } catch {
      toast?.showToast(WORDS.copyByHand(url), 'info')
    }
  }

  const press = narrow ? 44 : 24
  const shareCell = (row: SupplyInvoiceRow) => {
    if (!canShare) return null
    return (
      <button
        type="button"
        onClick={() => void copyLink(row)}
        title={WORDS.shareTitle}
        aria-label={WORDS.shareLabel(row.invoice_number)}
        data-testid="supply-invoice-share"
        style={{ width: press, height: press, flex: 'none', display: 'inline-grid', placeItems: 'center', margin: 0, padding: 0, border: 'none', borderRadius: 6, background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
      >
        <CopyLinkIcon />
      </button>
    )
  }

  const invoiceCell = (row: SupplyInvoiceRow) => {
    const pdf = supplyInvoicePdfHref(row)
    // The office opens any bill in the viewer, which says what a bill with no PDF needs. Anyone else has the Drive link.
    const site = pdf || canShare ? null : supplierSiteHref(row)
    const noPdfChip = (
      <span title={WORDS.noPdfTitle} style={{ marginLeft: '0.4rem', padding: '0 0.3rem', borderRadius: 4, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', fontSize: '0.92em', whiteSpace: 'nowrap' }}>
        {WORDS.noPdf}
      </span>
    )
    const onPaper = found.onPaper.get(row.invoice_id)
    return (
      <>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: narrow ? 0 : '0.15rem', flexWrap: 'wrap', minWidth: 0 }}>
          {shareCell(row)}
          {canShare ? (
            <>
              <button type="button" onClick={() => setOpenId(row.invoice_id)} style={{ ...linkStyle, minHeight: narrow ? 44 : undefined }}>
                {row.invoice_number}
              </button>
              {pdf ? null : noPdfChip}
            </>
          ) : pdf ? (
            <button type="button" onClick={() => openInExternalBrowser(pdf)} style={{ ...linkStyle, minHeight: narrow ? 44 : undefined }}>
              {row.invoice_number}
            </button>
          ) : (
            <>
              <span>{row.invoice_number}</span>
              {noPdfChip}
              {site ? (
                <button type="button" onClick={() => openInExternalBrowser(site)} style={{ ...linkStyle, marginLeft: '0.4rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {WORDS.supplierSite} ↗
                </button>
              ) : null}
            </>
          )}
        </span>
        {onPaper ? (
          // The line on the bill's paper that found this row, with the words of the search marked in it.
          <div data-testid="supply-invoice-on-paper" style={{ paddingLeft: press + (narrow ? 0 : 2), marginTop: narrow ? '-0.35rem' : 0, color: 'var(--text-muted)', fontSize: '0.92em' }}>
            {WORDS.onThePaper}{' '}
            {markWords(onPaper.description || onPaper.code || onPaper.mfr, searchWords).map((piece, i) =>
              piece.hit ? (
                <mark key={i} style={{ background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderRadius: 2, padding: '0 1px' }}>
                  {piece.text}
                </mark>
              ) : (
                <span key={i}>{piece.text}</span>
              ),
            )}
          </div>
        ) : null}
      </>
    )
  }

  const cell: CSSProperties = { padding: '0.25rem 0.4rem' }
  const fontSize = narrow ? '0.8125rem' : '0.75rem'

  return (
    // The list sits inside rows and folds that open on a press or a key: neither should hear what happens in here.
    <div data-testid="supply-invoice-list" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} style={{ maxWidth: 640, fontSize }}>
      {searchable ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.45rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={linesById ? WORDS.searchPlaceholderWithLines : WORDS.searchPlaceholder}
              aria-label={WORDS.searchLabel}
              autoComplete="off"
              style={{
                flex: narrow ? '1 1 100%' : '1 1 220px',
                maxWidth: narrow ? undefined : 320,
                minWidth: 0,
                padding: narrow ? '0.6rem 0.6rem' : '0.3rem 0.5rem',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--surface)',
                color: 'var(--text-strong)',
                fontFamily: 'inherit',
                // 16 px on a phone, so the screen does not zoom when the box takes the finger.
                fontSize: narrow ? '16px' : '0.75rem',
              }}
            />
            <span data-testid="supply-invoice-count" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              <WorkedOutValue>{found.rows.length}</WorkedOutValue> {supplyInvoiceCountWords(found.rows.length, rows.length)}
              {narrowed ? (
                <>
                  {' · '}
                  <WorkedOutValue>
                    <AmountSmallCents value={found.total} />
                  </WorkedOutValue>
                </>
              ) : null}
            </span>
          </div>
          {chips.length > 0 ? (
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: narrow ? 'nowrap' : 'wrap', overflowX: narrow ? 'auto' : undefined }}>
              {[{ name: null as string | null, label: WORDS.allHouses, count: rows.length }, ...chips.map((c) => ({ name: c.name as string | null, label: c.name, count: c.count }))].map((chip) => {
                const on = chip.name === liveHouse
                return (
                  <button
                    key={chip.name ?? ''}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setHouse(chip.name)}
                    style={{
                      flex: 'none',
                      padding: narrow ? '0.5rem 0.75rem' : '0.15rem 0.55rem',
                      border: `1px solid ${on ? 'var(--text-700)' : 'var(--border)'}`,
                      borderRadius: 999,
                      background: on ? 'var(--text-700)' : 'var(--surface)',
                      color: on ? 'var(--surface)' : 'var(--text-700)',
                      fontFamily: 'inherit',
                      fontSize: 'inherit',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {chip.label} <span style={{ opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{chip.count}</span>
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {found.rows.length === 0 ? (
        <EmptyState compact {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'invoices', query }), { onPress: clear })} />
      ) : narrow ? (
        <div>
          {found.rows.map((row) => (
            <div
              key={`${row.invoice_id}-${row.job_id}`}
              data-testid="supply-invoice-row"
              style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: '0.5rem', borderTop: '1px solid var(--border)', padding: '0.1rem 0 0.45rem' }}
            >
              <div style={{ minWidth: 0 }}>{invoiceCell(row)}</div>
              <div style={{ alignSelf: 'center', fontWeight: 600, fontSize: '0.9375rem', fontVariantNumeric: 'tabular-nums' }}>
                <AmountSmallCents value={row.allocated_amount} />
              </div>
              <div style={{ color: 'var(--text-muted)', paddingLeft: canShare ? press : 0, minWidth: 0 }}>{row.supply_house_name || '—'}</div>
              <div style={{ color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>{invoiceDayWords(row.invoice_date, todayYmd)}</div>
            </div>
          ))}
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-muted)' }}>
              <th style={{ ...cell, textAlign: 'left' }}>Supply house</th>
              <th style={{ ...cell, textAlign: 'left' }}>Invoice</th>
              <th style={{ ...cell, textAlign: 'left' }}>Date</th>
              <th style={{ ...cell, textAlign: 'right' }}>Allocated</th>
            </tr>
          </thead>
          <tbody>
            {found.rows.map((row) => (
              <tr key={`${row.invoice_id}-${row.job_id}`} data-testid="supply-invoice-row" style={{ borderTop: '1px solid var(--border)' }}>
                <td style={cell}>{row.supply_house_name || '—'}</td>
                <td style={cell}>{invoiceCell(row)}</td>
                <td style={{ ...cell, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{invoiceDayWords(row.invoice_date, todayYmd)}</td>
                <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  <AmountSmallCents value={row.allocated_amount} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {openId ? (
        <BillViewer
          items={viewerItems}
          openId={openId}
          onOpen={setOpenId}
          onClose={() => setOpenId(null)}
          jobId={jobId}
          search={searchable ? { query, onQuery: setQuery } : null}
          shareUrlOf={(id) => supplyInvoiceShareUrl(id, jobId)}
          markWords={searchWords}
        />
      ) : null}
    </div>
  )
}
