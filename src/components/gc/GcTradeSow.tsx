/**
 * GC mode, the real build (the Board's B6-a-ii): a trade's statement of work on the trade's block of its project's card,
 * from the design spike's Contracts tab card (`GcOfficeTabs.tsx`, `GcContractsTab`) and `GcSovSideBySide`. Award in
 * Compare quotes drafts it (`gc_award`). **Send to their portal to sign** marks it sent; once the Portal's sign screen
 * is live (`SOW_SIGN_SCREEN_LIVE`), a dev may email it too, a box that starts off. The money team reads the card since
 * O9, read only: the press is for those who write the statement of work (`canUseGcBoardWrites`). The papers that must be in before
 * it goes (the master agreement, insurance, the W-9) come with B6-b, and how far the money claimed reaches on their
 * lines with Building's draws (U6). Since B6-c-ii the send waits on those papers (`partnerBlockers`), saying "Cannot send
 * yet." and what is missing, with **Send the master agreement** beside it while none has gone (the company window's send),
 * and the company's paperwork chips beside its name, as the spike's Contracts tab has them.
 */
import { useState } from 'react'
import { partnerBlockers } from '../../lib/gc/bench'
import { unitPriceWords } from '../../lib/gc/exclusions'
import { partnerById, planLabel } from '../../lib/gc/lookups'
import { SOW_SIGN_SCREEN_LIVE } from '../../lib/gc/sowEmail'
import { theirSovGap } from '../../lib/gc/theirSov'
import type { GcState, Sow } from '../../lib/gc/types'
import { money, shortDate } from '../../lib/gc/words'
import { useCompanyOpener } from './gcCompanyOpener'
import { PartnerName } from './GcPartnerName'
import { PaperworkChips } from './GcPaperworkChips'
import { Btn, Chip, Stat, td, th as thBase, type Tone } from './gcUi'

/** What the card writes. */
export interface SowWrites {
  /** Mark the drafted statement of work sent and, with `email`, email it to the company awarded. */
  send: (packageId: string, email: boolean) => Promise<void>
}

/** Each table scrolls inside its own column rather than spilling into the other. */
const box = { minWidth: 0, overflowX: 'auto' } as const
/** The headings wrap, so the two columns sit side by side on a narrower card. */
const th = { ...thBase, whiteSpace: 'normal' } as const
const amount = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' } as const
const table = { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' } as const

const STATUS_TONES: Record<Sow['status'], Tone> = { draft: 'grey', sent: 'amber', signed: 'green' }

function statusWords(sow: Sow): string {
  if (sow.status === 'signed') return `signed ${shortDate(sow.signedOn)}`
  return sow.status === 'sent' ? 'waiting on their signature' : 'drafted'
}

/**
 * Our schedule of values beside the trade's own (the owner, 2026-10-04, question 4). Draws bill by percent on ours;
 * theirs is how they think of the job, usually by stage. The spike's line on how far the money claimed has reached
 * waits for the draws.
 */
function SovSideBySide({ sow }: { sow: Sow }) {
  const ours = sow.sov.filter((l) => !l.changeOrderId)
  const theirs = sow.theirSov ?? []
  const gap = theirs.length > 0 ? theirSovGap(theirs, sow.price) : 0
  const pct = (n: number) => `${Math.round((n / Math.max(1, sow.price)) * 100)}%`
  return (
    <div style={{ display: 'grid', gap: '0.4rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(17rem, 1fr))', gap: '0.75rem' }}>
        <div style={box}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Our schedule of values</th>
                <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                <th style={{ ...th, textAlign: 'right' }}>Billed</th>
              </tr>
            </thead>
            <tbody>
              {ours.map((l) => (
                <tr key={l.id}>
                  <td style={td}>{l.label}</td>
                  <td style={amount}>{money(l.amount)}</td>
                  <td style={amount}>{l.pctBilled}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={box}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Theirs, as they sent it</th>
                <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                <th style={{ ...th, textAlign: 'right' }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {theirs.length === 0 ? (
                <tr>
                  <td style={{ ...td, color: 'var(--text-muted)' }} colSpan={3}>
                    They have not sent their own yet. It comes with their quote or from their portal.
                  </td>
                </tr>
              ) : (
                theirs.map((l, i) => (
                  <tr key={`${l.label}-${i}`}>
                    <td style={td}>{l.label}</td>
                    <td style={amount}>{money(l.amount)}</td>
                    <td style={amount}>{pct(l.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {gap !== 0 && (
        <div style={{ fontSize: '0.875rem', color: 'var(--text-amber-800)' }}>
          Their lines add up to {money(sow.price + gap)}, {money(Math.abs(gap))} {gap > 0 ? 'over' : 'under'} the price.
        </div>
      )}
    </div>
  )
}

/**
 * What the statement of work says they will not do (the owner, 2026-10-04): each exclusion from the quote awarded,
 * with who does it instead when it is a Known exclusion, or its unit price.
 */
function SowExcluded({ excluded }: { excluded: NonNullable<Sow['excluded']> }) {
  return (
    <div style={{ fontSize: '0.875rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>What they will not do: </span>
      {excluded.length === 0
        ? 'nothing listed. Their quote named no exclusions.'
        : excluded.map((x) => `${x.name}${x.unitPrice ? ` (${unitPriceWords(x.unitPrice)} if it comes up)` : x.by ? ` (${x.by} does it)` : ''}`).join(' · ')}
    </div>
  )
}

export function GcTradeSow({
  state,
  projectId,
  packageId,
  writes,
  canSend = false,
  canEmail = false,
}: {
  state: GcState
  projectId: string
  packageId: string
  writes: SowWrites
  /** The reader may send it (a dev until the award door). Without it the card is read only. */
  canSend?: boolean
  /** The reader may email a trade (a dev). The box shows only once the Portal's sign screen is live. */
  canEmail?: boolean
}) {
  const [email, setEmail] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const opener = useCompanyOpener()
  const project = state.projects.find((p) => p.id === projectId)
  const pkg = project?.packages.find((k) => k.id === packageId)
  const sow = pkg?.sow
  if (!project || !pkg || !sow) return null
  const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
  const partner = invite ? partnerById(state, invite.partnerId) : undefined
  const offerEmail = SOW_SIGN_SCREEN_LIVE && canEmail
  // The papers that must be in before it goes (the spike's Contracts tab): the master agreement signed, insurance current, a W-9.
  const blockers = partner ? partnerBlockers(partner, state.today) : []
  const send = () => {
    setBusy(true)
    setProblem(null)
    writes
      .send(pkg.id, offerEmail && email)
      .catch((e: unknown) => setProblem(e instanceof Error ? e.message : 'That did not save.'))
      .finally(() => setBusy(false))
  }
  return (
    <div data-gc-trade-sow={pkg.id} style={{ borderLeft: '3px solid var(--border)', paddingLeft: '0.6rem', display: 'grid', gap: '0.55rem' }}>
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
        {partner && <PartnerName partnerId={partner.id} company={partner.company} />}
        <Chip tone={STATUS_TONES[sow.status]}>Statement of work {statusWords(sow)}</Chip>
        {partner && <PaperworkChips partner={partner} today={state.today} />}
        {pkg.awardedOn && (
          <span style={{ color: 'var(--text-muted)' }}>
            awarded {shortDate(pkg.awardedOn)}
            {pkg.awardedBy ? ` by ${pkg.awardedBy}` : ''}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <Stat label="Price" value={money(sow.price)} />
        <Stat label="Retainage" value={`${sow.retainagePct}%`} />
        <Stat label="Based on" value={planLabel(project, sow.basedOnRev)} />
      </div>
      <SovSideBySide sow={sow} />
      <SowExcluded excluded={sow.excluded ?? []} />
      {sow.status === 'draft' && !canSend && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>A dev sends it to their portal to sign.</div>}
      {sow.status === 'draft' && canSend && (
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {partner?.msa === 'none' && opener && <Btn onClick={() => opener.openPartner(partner.id, { tab: 'documents', doc: 'msa', send: true })}>Send the master agreement</Btn>}
          <Btn kind="primary" disabled={busy || blockers.length > 0} title={blockers.join(' ') || undefined} onClick={send}>
            Send to their portal to sign
          </Btn>
          {offerEmail && (
            <label style={{ fontSize: '0.85rem', display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
              <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
              Email it now
            </label>
          )}
          {blockers.length > 0 && <span style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>Cannot send yet. {blockers.join(' ')}</span>}
        </div>
      )}
      {problem && <div style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{problem}</div>}
    </div>
  )
}
