/**
 * A GC proposes a stricter setting for a job's paper (punch list #389, step 6): under the block that says what the
 * paper asks. One press opens the panel: the notice with its box where the list has one, then each topic on the
 * office's own slider, with every stop looser than the job's greyed. A typed name and one press send it.
 *
 * It changes no paper. The office takes it or declines, and the line above the press says where the last one stands.
 * The page is not read again after a send, so the block shows the proposal it just sent itself. The database decides
 * every rule, and `gcPaperPropose.ts` says them before the press. Light always, as their page is.
 */
import { useMemo, useState } from 'react'
import { sampleStateFromToken } from '../../lib/customerSampleMode'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { stricterChoices } from '../../lib/contracts/jobPaperProposal'
import type { PaperPicks } from '../../lib/contracts/paperSettings'
import type { GcJobPaper, GcPaperProposal } from '../../lib/portal/gcJobPapers'
import { GC_PROPOSE, gcProposalLine, gcProposeGround, gcProposePickAt, gcProposeProblem, gcProposeTopic } from '../../lib/portal/gcPaperPropose'
import { portalFailure, portalFailureCause, portalFailureKind, type PortalFailureCause } from '../../lib/portal/portalFailure'
import { formatPortalDate } from '../../lib/portal/portalPayload'
import { CARD, HAIR, INK, MUTED, PAPER } from '../../lib/portal/portalTheme'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { DocumentBuilderSlider } from '../documentBuilder/DocumentBuilderSlider'
import { Chip } from '../gc/gcUi'
import { PortalFailureNote } from './PortalFailureNote'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const FUNCTION_URL = `${supabaseUrl}/functions/v1/submit-portal-request`

type Ui = { kind: 'idle' } | { kind: 'sending' } | { kind: 'failed'; failure: PortalFailureCause }

const dayOf = (iso: string | null): string | null => (iso ? formatPortalDate(calendarYmdInAppTzFromIso(iso)) : null)

const FIELD = { minHeight: 44, boxSizing: 'border-box', border: `1px solid ${HAIR}`, borderRadius: 6, background: CARD, color: INK, padding: '8px 10px', fontSize: '1rem', fontFamily: 'inherit', width: '100%' } as const
const OUTLINE = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, boxSizing: 'border-box', border: `1px solid ${INK}`, background: CARD, color: INK, borderRadius: 6, padding: '10px 18px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as const
const SOLID = { ...OUTLINE, background: INK, color: PAPER } as const
const DEAD = { ...OUTLINE, background: DEAD_PRESS_FILL, borderColor: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'not-allowed' } as const

export function PortalJobPaperPropose({ paper, token, phone = null }: { paper: GcJobPaper; token: string; phone?: string | null }) {
  const ground = useMemo(() => gcProposeGround(paper), [paper])
  const [open, setOpen] = useState(false)
  const [picks, setPicks] = useState<PaperPicks>(() => ground?.picks ?? {})
  const [name, setName] = useState('')
  const [ticked, setTicked] = useState(false)
  const [ui, setUi] = useState<Ui>({ kind: 'idle' })
  // What this visit sent: the page is not read again after a send.
  const [sent, setSent] = useState<GcPaperProposal | null>(null)

  const last = sent ?? paper.proposal
  const status = last ? gcProposalLine(last, dayOf) : null
  // The sample statement's made-up links send nothing.
  const real = token !== '' && !sampleStateFromToken(token)
  const can = ground !== null && real
  if (!status && !can) return null

  const problem = ground ? gcProposeProblem(ground, picks, name, ticked) : null
  const busy = ui.kind === 'sending'

  const start = () => {
    if (!ground) return
    setPicks(ground.picks)
    setUi({ kind: 'idle' })
    setOpen(true)
  }
  const send = async () => {
    if (!ground || problem || busy) return
    setUi({ kind: 'sending' })
    try {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, kind: 'job_paper_proposal', requiredPaperId: paper.id, picks, name: name.trim(), noticeRead: ground.hasNotice && ticked }),
      })
      const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
      if (!res.ok || !json?.ok) {
        setUi({ kind: 'failed', failure: portalFailureCause(res.status, json, 'send') })
        return
      }
      setSent({ state: 'waiting', byName: name.trim(), proposedAt: typeof json.proposedAt === 'string' ? json.proposedAt : null, decidedAt: null, why: null, picks })
      setUi({ kind: 'idle' })
      setOpen(false)
    } catch (e) {
      setUi({ kind: 'failed', failure: portalFailureKind(e) })
    }
  }

  return (
    <div data-portal-job-paper-propose="" style={{ display: 'grid', gap: '0.6rem', borderTop: `1px solid ${HAIR}`, paddingTop: '0.7rem' }}>
      {status ? (
        <div data-portal-job-paper-proposal={last?.state} style={{ display: 'grid', gap: '0.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.6rem', alignItems: 'center' }}>
            <Chip tone={status.tone}>{status.chip}</Chip>
            <span style={{ fontSize: '0.92rem' }}>{status.line}</span>
          </div>
          {status.why ? <div style={{ fontSize: '0.86rem', color: MUTED }}>{status.why}</div> : null}
        </div>
      ) : null}

      {can && !open ? (
        <div style={{ display: 'grid', justifyItems: 'start' }}>
          <button type="button" onClick={start} style={OUTLINE} data-portal-job-paper-propose-open="">
            {GC_PROPOSE.press}
          </button>
        </div>
      ) : null}

      {can && open && ground ? (
        <div role="group" aria-label={GC_PROPOSE.title} style={{ display: 'grid', gap: '0.8rem', border: `1px solid ${HAIR}`, padding: '0.8rem 0.9rem' }}>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <b style={{ fontSize: '0.95rem' }}>{GC_PROPOSE.title}</b>
            <div style={{ fontSize: '0.86rem', color: MUTED }}>{GC_PROPOSE.lead}</div>
          </div>

          {ground.hasNotice ? (
            <div data-portal-job-paper-propose-notice="" style={{ display: 'grid', gap: '0.3rem', borderLeft: `3px solid ${INK}`, paddingLeft: '0.7rem' }}>
              {ground.def.notice?.title ? <b style={{ fontSize: '0.9rem' }}>{ground.def.notice.title}</b> : null}
              {(ground.def.notice?.lines ?? []).map((l, at) => (
                <div key={at} style={{ fontSize: '0.86rem' }}>
                  {l}
                </div>
              ))}
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: '0.9rem', fontWeight: 600, minHeight: 44, cursor: 'pointer' }}>
                <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} style={{ width: 20, height: 20, margin: 0, accentColor: INK }} />
                <span>{ground.def.notice?.tick || GC_PROPOSE.tick}</span>
              </label>
            </div>
          ) : null}

          {ground.def.settings.map((s) => {
            const topic = gcProposeTopic(ground, s, picks[s.key])
            return (
              <div key={s.key} data-portal-job-paper-propose-topic={s.key} style={{ display: 'grid', gap: '0.4rem', borderTop: `1px solid ${HAIR}`, paddingTop: '0.6rem' }}>
                <b style={{ fontSize: '0.92rem' }}>{s.label}</b>
                {ground.flow && topic.stop !== null ? (
                  <DocumentBuilderSlider
                    def={ground.flow}
                    value={topic.stop}
                    label={s.label}
                    floor={topic.floor}
                    floorWhy={GC_PROPOSE.floorWhy}
                    basis={ground.basis ?? undefined}
                    onPick={(next) => {
                      const key = gcProposePickAt(ground, s, next)
                      if (key) setPicks((p) => ({ ...p, [s.key]: key }))
                    }}
                  />
                ) : (
                  <select aria-label={s.label} value={picks[s.key] ?? ''} onChange={(e) => setPicks((p) => ({ ...p, [s.key]: e.target.value }))} style={FIELD}>
                    {stricterChoices(ground.def, s, ground.picks[s.key]).map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                )}
                <div style={{ fontSize: '0.86rem', color: MUTED }}>
                  <b style={{ color: INK }}>{topic.label}.</b> {topic.says}
                </div>
              </div>
            )
          })}

          <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.86rem' }}>
            <span style={{ fontWeight: 600 }}>{GC_PROPOSE.nameLabel}</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" placeholder={GC_PROPOSE.namePlaceholder} style={FIELD} />
          </label>

          <div style={{ display: 'grid', gap: '0.4rem' }}>
            <div data-portal-job-paper-propose-line="" style={{ fontSize: '0.86rem', color: MUTED }}>
              {problem ?? GC_PROPOSE.nothingChanges}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button type="button" onClick={() => void send()} disabled={problem !== null || busy} style={problem !== null || busy ? DEAD : SOLID} data-portal-job-paper-propose-send="">
                {busy ? GC_PROPOSE.sending : GC_PROPOSE.send}
              </button>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} style={OUTLINE}>
                {GC_PROPOSE.cancel}
              </button>
            </div>
            <PortalFailureNote failure={ui.kind === 'failed' ? portalFailure(ui.failure, 'send', 'en', { phone }) : null} onTryAgain={() => void send()} busy={busy} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default PortalJobPaperPropose
