/**
 * Done with no reply this week (v2.7030, punch list #324 PR 4): the fold under Follow up's lanes. Shut until pressed.
 * Each row names the person, how the conversation was done, and offers **Reopen**; the name opens their thread. It
 * reads for itself (`doneFoldIo.ts`) when it mounts and again whenever Follow up's queue reads, so a press anywhere
 * on the page is in it. A read that fails draws nothing: the lanes above never wait on it. Words and rows are
 * `doneFold.ts`'s.
 */
import { useEffect, useState } from 'react'
import { DONE_FOLD_WHY, doneFoldLines, doneFoldTitle, REOPEN } from '../../lib/followUp/doneFold'
import type { DoneFoldRows } from '../../lib/followUp/doneFoldIo'
import { Btn } from '../gc/gcUi'

export function DoneFold({
  refreshKey,
  nowIso,
  busy = false,
  onReopen,
  onOpenThread,
  load,
}: {
  /** Changes whenever Follow up's queue reads again; the fold reads with it. */
  refreshKey: unknown
  nowIso: string
  /** A press is under way on the panel. */
  busy?: boolean
  onReopen: (contactId: string, who: string) => void
  onOpenThread: (contactId: string) => void
  /** The read (`FollowUpIo.loadDoneFold`). */
  load: () => Promise<DoneFoldRows>
}) {
  const [rows, setRows] = useState<DoneFoldRows | null>(null)
  useEffect(() => {
    let live = true
    load().then(
      (got) => {
        if (live) setRows(got)
      },
      () => {
        // The fold is a look back, never a queue: a read that fails leaves the last rows, or none.
      },
    )
    return () => {
      live = false
    }
  }, [load, refreshKey])

  const lines = rows ? doneFoldLines(rows.said, rows.filed, nowIso) : []
  if (lines.length === 0) return null
  return (
    <details data-done-fold style={{ border: '1px dashed var(--border-strong)', borderRadius: 10, padding: '0.5rem 0.8rem', background: 'var(--bg-subtle)' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>{doneFoldTitle(lines.length)}</summary>
      <div style={{ display: 'grid', gap: '0.35rem', marginTop: '0.4rem' }}>
        {lines.map((l) => (
          <div key={l.contactId} data-done-row={l.how} title={DONE_FOLD_WHY[l.how]} style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-600)' }}>
            <span style={{ flex: 1, minWidth: 160, overflowWrap: 'anywhere' }}>
              <button
                type="button"
                onClick={() => onOpenThread(l.contactId)}
                style={{ border: 'none', background: 'transparent', padding: 0, font: 'inherit', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}
              >
                {l.who}
              </button>{' '}
              · {l.words}
            </span>
            <Btn kind="quiet" onClick={() => onReopen(l.contactId, l.who)} disabled={busy}>
              {REOPEN}
            </Btn>
          </div>
        ))}
      </div>
    </details>
  )
}
