import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BillViewer } from '../components/materials/BillViewer'
import { FILE_OPEN_WORDS, fileHref } from '../lib/files/fileRoute'
import { SUPPLY_INVOICE_SEARCH_FROM, searchSupplyInvoices, supplyInvoiceShareUrl, type SupplyInvoiceRow } from '../lib/jobs/supplyInvoiceList'
import type { BillViewerItem } from '../lib/materials/bills/billViewer'
import { supabaseBillViewerIo, type BillViewerIo } from '../lib/materials/bills/billViewerIo'
import { supabase } from '../lib/supabase'

/** A job's supply house invoices, as the Job Summary reads them. A read that fails is no list, never half of one. */
async function loadJobRows(jobId: string): Promise<SupplyInvoiceRow[]> {
  const { data, error } = await supabase.rpc('get_invoice_allocation_lines_for_jobs', { p_job_ids: [jobId] })
  return error ? [] : ((data ?? []) as SupplyInvoiceRow[])
}

type Gate = 'opening' | 'open' | 'notYours' | 'notHere'

/**
 * A supply house bill's lasting link, `/files/bills/<invoice id>` (punch list #431, PR 2): the bill viewer as a page
 * of its own, for a teammate who was sent the link. The bill is read as the reader, so a person the office's policy
 * does not let read bills sees the same words as for any other file they may not open, and no amounts. With a job on
 * the link (`?job=`), the viewer has that job's list beside the paper, so Previous and Next work as they did for the
 * person who copied it, and the address follows the bill on show.
 */
export default function BillOpen({ invoiceId, io = supabaseBillViewerIo, loadRows = loadJobRows }: { invoiceId: string; io?: BillViewerIo; loadRows?: (jobId: string) => Promise<SupplyInvoiceRow[]> }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const jobId = params.get('job')
  const [gate, setGate] = useState<Gate>('opening')
  const [rows, setRows] = useState<SupplyInvoiceRow[]>([])
  const [own, setOwn] = useState<BillViewerItem | null>(null)
  const [query, setQuery] = useState('')
  // The bill the link named: the gate is asked once, and flipping to a neighbour does not ask it again.
  const [firstId] = useState(invoiceId)
  // The reads as handed in on this render, so a caller that makes them anew each time does not ask the gate again.
  const reads = useRef({ io, loadRows })
  reads.current = { io, loadRows }

  useEffect(() => {
    let live = true
    void (async () => {
      const [bill, jobRows] = await Promise.all([reads.current.io.loadBill(firstId, jobId), jobId ? reads.current.loadRows(jobId) : Promise.resolve([])])
      if (!live) return
      if ('problem' in bill) {
        setGate(bill.problem)
        return
      }
      setOwn({ invoiceId: bill.facts.invoiceId, number: bill.facts.number, house: bill.facts.house, dateYmd: bill.facts.dateYmd, amount: bill.facts.onJob?.amount ?? bill.facts.total })
      // The job's list is the viewer's only when this bill is on it: a link with another job's id shows the bill alone.
      setRows(jobRows.some((row) => row.invoice_id === firstId) ? jobRows : [])
      setGate('open')
    })()
    return () => {
      live = false
    }
  }, [firstId, jobId])

  const searchable = rows.length >= SUPPLY_INVOICE_SEARCH_FROM
  const items = useMemo<BillViewerItem[]>(() => {
    if (rows.length === 0) return own ? [own] : []
    return searchSupplyInvoices(rows, searchable ? query : '').rows.map((row) => ({ invoiceId: row.invoice_id, number: row.invoice_number, house: row.supply_house_name ?? '', dateYmd: (row.invoice_date ?? '').slice(0, 10), amount: row.allocated_amount }))
  }, [rows, own, searchable, query])
  const listJobId = rows.length > 0 ? jobId : null

  if (gate !== 'open') {
    return (
      <div style={{ padding: '3rem 1rem', textAlign: 'center' }} data-file-open={gate}>
        <p style={{ margin: 0, color: gate === 'opening' ? 'var(--text-muted)' : undefined }}>{gate === 'opening' ? 'Opening the file…' : FILE_OPEN_WORDS[gate]}</p>
      </div>
    )
  }

  return (
    <BillViewer
      standalone
      items={items}
      openId={invoiceId}
      // The address follows the bill on show, so the address bar is itself a link to it.
      onOpen={(id) => navigate(`${fileHref('bills', id)}${listJobId ? `?job=${encodeURIComponent(listJobId)}` : ''}`, { replace: true })}
      onClose={() => navigate(listJobId ? '/jobs?tab=job-summary' : '/materials?tab=supply-houses')}
      jobId={listJobId}
      search={searchable ? { query, onQuery: setQuery } : null}
      shareUrlOf={(id) => supplyInvoiceShareUrl(id, listJobId)}
      io={io}
    />
  )
}
