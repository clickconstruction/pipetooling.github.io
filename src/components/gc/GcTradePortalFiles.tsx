import { useState } from 'react'
import { GC_COMPANY } from '../../lib/gc/company'
import { pDate, type PortalKey } from '../../lib/gc/portalI18n'
import type { PortalFileRow, PortalFileWhat } from '../../lib/gc/tradePortalPage'
import type { PickedFile } from '../../lib/gc/tradePortalFile'
import type { TradeFilePlaced } from '../../lib/gc/tradePortalSubmit'
import type { GcProject } from '../../lib/gc/types'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { HAIR, MUTED } from '../../lib/portal/portalTheme'
import { Btn, input } from './gcUi'
import { usePortalLang } from './gcTradePortalLang'
import { usePortalPress } from './gcTradePortalPress'
import { PortalFilePick } from './GcTradePortalFile'
import { PortalBlock } from './GcTradePortalUi'

/**
 * Punch list #205, row 3 (PR 4): **Your files on this job**, under the statement of work on a job awarded to the company.
 * JobTread gives a sub a Files tab; ours lets a file ride the record it belongs to and gave the company no list of what
 * it sent us. The block lists its uploads on this job by what each is, with the day and **Open ↗**, and the plan sets
 * we sent (each with its Drive link). Then **Send Click a file**: the picker, one line that says what it is, and Send,
 * for a photo or a ticket that belongs to no record. It goes up as the kind `file` with `for: 'note'`, lands under
 * Team only → From trades → the company with the note as its name, and joins the list from the answer; the slice is not
 * read again. The office opens it in Drive, where the company's other uploads already are.
 */

const GC = GC_COMPANY.shortName
const LINK = { color: 'var(--text-blue-500)', fontSize: '0.85rem' } as const
const WHAT: Record<PortalFileWhat, PortalKey> = { submittal: 'fileSubmittal', change: 'fileChange', quote: 'fileQuote', waiver: 'fileWaiver', note: 'fileNote' }

export function GcTradePortalFiles({ project, files, planUrl }: { project: GcProject; files: PortalFileRow[]; planUrl: (rev: number) => string }) {
  const { lang, t } = usePortalLang()
  const press = usePortalPress()
  // What was sent from this page since it opened, newest first, ahead of the slice's rows.
  const [sent, setSent] = useState<PortalFileRow[]>([])
  const plans = [...project.planSets].sort((a, b) => b.rev - a.rev).flatMap((set) => {
    const url = planUrl(set.rev)
    return url ? [{ rev: set.rev, label: set.label, url }] : []
  })
  const rows = [...sent, ...files]
  return (
    <div data-portal-anchor={`files:${project.id}`} style={{ scrollMarginTop: '0.5rem' }}>
      <PortalBlock title={t('filesTitle')}>
        <div style={{ display: 'grid', gap: '0.6rem', fontSize: '0.9rem' }}>
          {(rows.length > 0 || plans.length > 0) && (
            <table data-portal-files style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ color: MUTED, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' }}>
                  <th style={{ padding: '0 0 0.25rem', fontWeight: 700 }}>{t('filesWhat')}</th>
                  <th style={{ padding: '0 0 0.25rem', fontWeight: 700 }}>{t('filesDay')}</th>
                  <th style={{ padding: '0 0 0.25rem', fontWeight: 700 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.id} data-portal-file={f.what} style={{ borderTop: `1px solid ${HAIR}` }}>
                    <td style={{ padding: '0.35rem 0.5rem 0.35rem 0', minWidth: 0 }}>
                      <div style={{ overflowWrap: 'anywhere' }}>{f.name}</div>
                      <div style={{ fontSize: '0.75rem', color: MUTED }}>{t(WHAT[f.what])}</div>
                    </td>
                    <td style={{ padding: '0.35rem 0.5rem 0.35rem 0', whiteSpace: 'nowrap', color: MUTED, verticalAlign: 'top' }}>{pDate(lang, f.day)}</td>
                    <td style={{ padding: '0.35rem 0', whiteSpace: 'nowrap', verticalAlign: 'top', textAlign: 'right' }}>
                      <a href={f.url} target="_blank" rel="noopener noreferrer" style={LINK}>
                        {t('filesOpen')} ↗
                      </a>
                    </td>
                  </tr>
                ))}
                {plans.map((p) => (
                  <tr key={`plans:${p.rev}`} data-portal-file="plans" style={{ borderTop: `1px solid ${HAIR}` }}>
                    <td style={{ padding: '0.35rem 0.5rem 0.35rem 0' }} colSpan={2}>
                      {t('filePlans', { label: p.label, gc: GC })}
                    </td>
                    <td style={{ padding: '0.35rem 0', whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <a href={p.url} target="_blank" rel="noopener noreferrer" style={LINK}>
                        {t('filesOpen')} ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {press && <SendFile projectId={project.id} onSent={(row) => setSent((all) => [row, ...all])} />}
        </div>
      </PortalBlock>
    </div>
  )
}

/**
 * Send Click a file: a photo or a PDF up to 10 MB with one line that says what it is. Both are needed before Send is
 * live. The upload's answer is the row that joins the list; the sample answers ok with no file, and the pick's name stands.
 */
function SendFile({ projectId, onSent }: { projectId: string; onSent: (row: PortalFileRow) => void }) {
  const { t } = usePortalLang()
  const press = usePortalPress()
  const [picked, setPicked] = useState<PickedFile | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const ready = picked !== null && note.trim() !== '' && !busy
  const send = async () => {
    if (!press || !picked || !ready) return
    setBusy(true)
    setProblem(null)
    setDone(false)
    try {
      const placed = await press.upload({ for: 'note', projectId, name: picked.name, base64: picked.base64, note: note.trim() })
      if (placed.problem) {
        setProblem(placed.problem)
        return
      }
      const file: TradeFilePlaced | null = placed.file
      onSent({ id: file?.id ?? `sent-${Date.now()}`, what: 'note', paper: null, name: file?.name ?? `${note.trim()}`, url: file?.url ?? '', day: todayYmdInAppTz() })
      setPicked(null)
      setNote('')
      setDone(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div data-portal-send-file style={{ display: 'grid', gap: '0.45rem', borderTop: `1px solid ${HAIR}`, paddingTop: '0.5rem' }}>
      <strong>{t('sendFile', { gc: GC })}</strong>
      <div style={{ fontSize: '0.8rem', color: MUTED }}>{t('fileHint')}</div>
      <PortalFilePick label={t('sendFile', { gc: GC })} picked={picked} onPick={setPicked} disabled={busy} />
      <input aria-label={t('fileNoteHint')} placeholder={t('fileNoteHint')} value={note} maxLength={200} disabled={busy} onChange={(e) => setNote(e.target.value)} style={{ ...input, width: '100%', minWidth: 0, boxSizing: 'border-box' }} />
      {problem && <div style={{ color: 'var(--text-red-700)', fontSize: '0.8rem' }}>{problem}</div>}
      {done && <div style={{ color: 'var(--text-green-700)', fontSize: '0.85rem' }}>{t('fileSent')}</div>}
      <div>
        <Btn kind="primary" disabled={!ready} onClick={() => void send()}>
          {busy ? '…' : t('datesSend')}
        </Btn>
      </div>
    </div>
  )
}
