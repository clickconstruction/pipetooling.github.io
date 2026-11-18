import { useEffect, useState } from 'react'
import { JOB_PAPERS_CHANGED_EVENT, jobPapersChip } from '../../lib/jobs/jobPapers'
import { supabaseJobPapersIo, type JobPapersIo } from '../../lib/jobs/jobPapersIo'

/**
 * The chip on a job that requires papers: how many everyone signs before it opens to them. Drawn for the office in
 * the job window's head. It counts again when the Documents tab's section saves or takes a paper off. A job that
 * requires none, or a count that cannot be read, draws nothing: the section on the Documents tab is the record.
 */
export function JobPapersChip({ jobId, io = supabaseJobPapersIo }: { jobId: string; io?: JobPapersIo }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let live = true
    const read = () => {
      io.countRequired(jobId).then(
        (n) => {
          if (live) setCount(n)
        },
        () => {
          if (live) setCount(0)
        },
      )
    }
    read()
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<string>).detail === jobId) read()
    }
    window.addEventListener(JOB_PAPERS_CHANGED_EVENT, onChanged)
    return () => {
      live = false
      window.removeEventListener(JOB_PAPERS_CHANGED_EVENT, onChanged)
    }
  }, [io, jobId])

  const chip = jobPapersChip(count)
  if (!chip) return null
  return (
    <span
      data-testid="job-papers-chip"
      title={chip.title}
      style={{ display: 'inline-block', padding: '0.05rem 0.5rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }}
    >
      {chip.label}
    </span>
  )
}

export default JobPapersChip
