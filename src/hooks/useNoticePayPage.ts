import { useEffect, useRef, useState } from 'react'
import { fetchJobWithDetailsById } from '../lib/fetchJobWithDetailsById'
import { noticeInvoiceDocs } from '../lib/jobs/noticeInvoiceEnclosure'
import { payPageRows, type PayPageAssets, type PayPageRow } from '../lib/jobs/lienNoticePayPage'
import { buildPayPageAssets } from '../lib/jobs/lienNoticePayPageAssets'

/**
 * The pay page's rows and codes for one job, for a preview (punch list #35, PR 3): the Lien
 * desk pane and the GC-run preview show the page the run will print. The job is fetched once
 * per id and kept for the life of the component, so walking ‹ › through a run's previews never
 * refetches; only the SVG is built (a preview has no PDF). The desk's own hook loads no bills,
 * and the run modal does this fetch itself when it opens — one request per job, either way.
 */
export type NoticePayPage = { rows: PayPageRow[]; assets: PayPageAssets; loading: boolean }

const EMPTY: NoticePayPage = { rows: [], assets: {}, loading: false }

type Loaded = { rows: PayPageRow[]; assets: PayPageAssets }

export async function loadNoticePayPage(jobId: string): Promise<Loaded> {
  const job = await fetchJobWithDetailsById(jobId)
  const rows = job ? payPageRows(noticeInvoiceDocs(job)) : []
  const assets = rows.some((r) => r.payable) ? await buildPayPageAssets(rows, { png: false }).catch(() => ({})) : {}
  return { rows, assets }
}

export function useNoticePayPage(jobId: string | null, enabled: boolean = true): NoticePayPage {
  const cache = useRef(new Map<string, Promise<Loaded>>())
  const [state, setState] = useState<{ jobId: string | null; page: NoticePayPage }>({ jobId: null, page: EMPTY })

  useEffect(() => {
    if (!enabled || !jobId) return
    let live = true
    let p = cache.current.get(jobId)
    if (!p) {
      p = loadNoticePayPage(jobId)
      cache.current.set(jobId, p)
    }
    setState({ jobId, page: { rows: [], assets: {}, loading: true } })
    p.then(
      (r) => {
        if (live) setState({ jobId, page: { ...r, loading: false } })
      },
      () => {
        cache.current.delete(jobId)
        if (live) setState({ jobId, page: EMPTY })
      },
    )
    return () => {
      live = false
    }
  }, [jobId, enabled])

  return enabled && jobId && state.jobId === jobId ? state.page : EMPTY
}
