import { useEffect, useMemo, useState } from 'react'
import type { ArReturnCaseView } from '../lib/jobs/arReturnCase'
import { payoffReturnedView, type PayoffReturnedView } from '../lib/jobs/payoffReturned'
import { readReturnedCaseLiens } from '../lib/jobs/payoffReturnedIo'
import { formatErrorMessage } from '../utils/errorHandling'

/** What the case pane draws of the liens on a returned check's jobs. `view` null with `ready`: none of them is liened. */
export type ReturnedCaseLiens = { status: 'reading' | 'ready' | 'failed'; view: PayoffReturnedView | null; why: string | null }

/**
 * A check that came back: the bank sent it back, or the office marked it returned by hand. A check the bank could
 * not read, and one typed in and never deposited, did not come back: each is deposited again, and reads nothing here.
 */
const CAME_BACK_SOURCES: ReadonlyArray<ArReturnCaseView['source']> = ['bank', 'hand']

/**
 * The filed liens on the jobs of the case in the pane, each with where its release stands (punch list #435,
 * piece 6; the rule is `payoffReturned.ts`). Read again when the case changes or its jobs do, as after a take off.
 * A Stripe case is not a check and reads nothing. Null while no such case is open or the seat may not apply.
 */
export function useReturnedCaseLiens(view: ArReturnCaseView | null, enabled: boolean, read: typeof readReturnedCaseLiens = readReturnedCaseLiens): ReturnedCaseLiens | null {
  const isCheck = view != null && CAME_BACK_SOURCES.includes(view.source)
  // The case's jobs as one string, so the read follows a take off and nothing else.
  const key = useMemo(() => {
    if (!view || !isCheck) return null
    const jobs = { on: (view.takeOff?.jobs ?? []).map((j) => j.jobId), rec: view.recorded?.jobId ?? null, off: view.billsItPaid.map((b) => b.jobId), last: view.promiseJob?.jobId ?? null }
    return `${view.id}|${JSON.stringify(jobs)}`
  }, [view, isCheck])
  const [state, setState] = useState<{ key: string; liens: ReturnedCaseLiens } | null>(null)
  useEffect(() => {
    if (!key || !view || !enabled) return
    let live = true
    // A bank or hand case's id is its deposit's.
    read({ takeOff: view.takeOff, recorded: view.recorded, billsItPaid: view.billsItPaid, promiseJob: view.promiseJob }, view.id)
      .then((input) => {
        if (live) setState({ key, liens: { status: 'ready', view: payoffReturnedView(input), why: null } })
      })
      .catch((e: unknown) => {
        if (live) setState({ key, liens: { status: 'failed', view: null, why: formatErrorMessage(e, '') || null } })
      })
    return () => {
      live = false
    }
    // `view` rides on `key`: the same case with the same jobs is not read twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, read])
  if (!key || !enabled) return null
  return state?.key === key ? state.liens : { status: 'reading', view: null, why: null }
}
