/**
 * What the customer sent, on the Job Mode card (punch list #319 PR 6): a tech sees the photos, the video and the
 * customer's own words before the visit. It reads the looks the job was made from (`first_looks.job_id`), which
 * whoever may see the job's photos may read, and draws nothing for a job with none, so the card mounts it for every
 * job. A photo opens full size and a video plays in place.
 */
import { useEffect, useState } from 'react'
import { JOB_LOOK_WORDS, LOOK_CARD_WORDS, lookAskedLower, type ThreadLook, type ThreadLookFile } from '../../lib/firstLook/card'
import { supabaseFirstLookThreadIo, type FirstLookThreadIo } from '../../lib/firstLook/threadIo'
import { formatDenverCalendarDayShort } from '../../utils/dateUtils'
import { LookFile } from './LookFile'

const DEFAULT_IO = supabaseFirstLookThreadIo()

export function JobFirstLookStrip({ jobId, io = DEFAULT_IO }: { jobId: string; io?: FirstLookThreadIo }) {
  const [read, setRead] = useState<{ looks: ThreadLook[]; files: ThreadLookFile[]; urls: Record<string, string> } | null>(null)

  useEffect(() => {
    let live = true
    setRead(null)
    void (async () => {
      try {
        const got = await io.looksOfJob(jobId)
        if (!got.looks.length || !live) return
        const urls = await io.signLookFiles(got.files.map((f) => f.storage_path)).catch(() => ({}))
        if (live) setRead({ ...got, urls })
      } catch {
        // The strip is an extra: the card reads as it always did when the look does not.
      }
    })()
    return () => {
      live = false
    }
  }, [jobId, io])

  if (!read) return null
  return (
    <div data-job-first-look style={{ display: 'grid', gap: '0.5rem' }}>
      {read.looks.map((look) => {
        const files = read.files.filter((f) => f.look_id === look.id)
        let photoAt = 0
        let videoAt = 0
        return (
          <section key={look.id} aria-label={JOB_LOOK_WORDS.head} style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '0.6rem 0.7rem', display: 'grid', gap: '0.45rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.85rem' }}>
              <strong>📷 {JOB_LOOK_WORDS.head}</strong>
              <span style={{ color: 'var(--text-muted)' }}>
                {LOOK_CARD_WORDS.title}, {lookAskedLower(look, formatDenverCalendarDayShort(Date.parse(look.made_at)))}
              </span>
            </div>
            {files.length > 0 ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {files.map((f) => (
                  <LookFile key={f.id} kind={f.kind} url={read.urls[f.storage_path]} label={f.kind === 'photo' ? `Photo ${++photoAt}` : `Video ${++videoAt}`} texted={false} />
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{JOB_LOOK_WORDS.none}</div>
            )}
            {(look.words?.trim() || look.place?.trim()) && (
              <div style={{ fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{look.place?.trim() ? `${look.place.trim()}. ` : ''}</span>
                {look.words?.trim() && (
                  <>
                    <span style={{ color: 'var(--text-muted)' }}>{LOOK_CARD_WORDS.theirWords}: </span>
                    {look.words.trim()}
                  </>
                )}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
