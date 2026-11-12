/**
 * An estimate started from a First look draws the customer's photos beside the price (punch list #319 PR 5). The
 * office's editor mounts it unconditionally, as it does the field photos' strip: it reads the look the estimate
 * remembers (`estimates.first_look_id`) and draws nothing when there is none. A photo opens full size, a video plays in
 * place, and the customer's own words sit under them. The customer's page never draws these.
 */
import { useEffect, useState } from 'react'
import { LOOK_CARD_WORDS, LOOK_STRIP_WORDS, lookAskedWords, type ThreadLook, type ThreadLookFile } from '../../lib/firstLook/card'
import { driveFolderUrl, LOOK_DRIVE_WORDS } from '../../lib/firstLook/drive'
import { supabaseFirstLookThreadIo, type FirstLookThreadIo } from '../../lib/firstLook/threadIo'
import { formatDenverCalendarDayShort } from '../../utils/dateUtils'
import { LookFile } from './FirstLookCards'

const DEFAULT_IO = supabaseFirstLookThreadIo()

export function EstimateFirstLookStrip({ estimateId, io = DEFAULT_IO }: { estimateId: string; io?: FirstLookThreadIo }) {
  const [read, setRead] = useState<{ look: ThreadLook; files: ThreadLookFile[]; urls: Record<string, string> } | null>(null)

  useEffect(() => {
    let live = true
    setRead(null)
    void (async () => {
      try {
        const lookId = await io.lookOfEstimate(estimateId)
        if (!lookId) return
        const got = await io.lookById(lookId)
        if (!got || !live) return
        const urls = await io.signLookFiles(got.files.map((f) => f.storage_path)).catch(() => ({}))
        if (live) setRead({ ...got, urls })
      } catch {
        // The strip is an extra: an estimate reads as it always did when the look does not.
      }
    })()
    return () => {
      live = false
    }
  }, [estimateId, io])

  if (!read) return null
  const { look, files, urls } = read
  let photoAt = 0
  let videoAt = 0
  return (
    <div data-estimate-first-look={look.id} style={{ marginBottom: '1rem' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
        📷 {LOOK_STRIP_WORDS.head} · {LOOK_CARD_WORDS.title}, {lookAskedWords(look, formatDenverCalendarDayShort(Date.parse(look.made_at))).toLowerCase()}
      </div>
      {files.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {files.map((f) => (
            <LookFile key={f.id} kind={f.kind} url={urls[f.storage_path]} label={f.kind === 'photo' ? `Photo ${++photoAt}` : `Video ${++videoAt}`} texted={false} />
          ))}
        </div>
      )}
      {(look.words?.trim() || look.place?.trim()) && (
        <div style={{ fontSize: '0.85rem', marginTop: 6 }}>
          <span style={{ color: 'var(--text-muted)' }}>{look.place?.trim() ? `${look.place.trim()}. ` : ''}</span>
          {look.words?.trim() && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>{LOOK_CARD_WORDS.theirWords}: </span>
              {look.words.trim()}
            </>
          )}
        </div>
      )}
      {look.drive_folder_id && (
        <div style={{ fontSize: '0.8rem', marginTop: 6 }}>
          <a href={driveFolderUrl(look.drive_folder_id)} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
            {LOOK_DRIVE_WORDS.open}
          </a>
        </div>
      )}
    </div>
  )
}
