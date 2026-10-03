import { useState, type Dispatch } from 'react'
import { OwnerPayAppWindow } from './GcOwnerBillingPayApp'
import { PortalBlock } from './GcPortalUi'
import { Btn, Chip, input } from './gcUi'
import {
  GC_COMPANY_NAME,
  appCertified,
  daysUntil,
  money,
  ownerPayAppsSent,
  partnerById,
  shortDate,
  type GcAction,
  type GcProject,
  type GcState,
  type OwnerPayAppSent,
} from '../../lib/gcMode/gcModel'

/** The portal's paper look, the same as the owner's and the trade's: it stays light in both themes. */
const INK = '#16283c'
const PAPER = '#f6f3ec'
const RULE = '#d9d2c3'

/**
 * GC mode design spike: what the architect sees in their portal. They certify our pay applications
 * to the owner before the owner pays (owner's call, 2026-10-03): for what we asked, or less with the
 * reason. The trades' questions about the plans that wait on them are listed too.
 */
export function GcOwnerBillingArchitectPortal({ state, project, dispatch }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction> }) {
  const architect = state.customers.find((c) => c.id === project.architectId)
  const sent = ownerPayAppsSent(project)
  const waiting = sent.filter((a) => a.paidOn === null && appCertified(a) === null)
  const certified = [...sent].reverse().filter((a) => a.certifiedOn)
  const questions = project.questions.filter((q) => q.sentToArchitectOn && !q.answeredOn)

  return (
    <div data-theme="light" style={{ background: PAPER, color: INK, border: `1px solid ${INK}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ background: INK, color: PAPER, padding: '0.7rem 0.9rem' }}>
        <div style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.8 }}>
          What the architect sees · their portal
        </div>
        <div style={{ fontWeight: 700, marginTop: '0.15rem' }}>{project.architect}</div>
      </div>

      <div style={{ padding: '0.8rem 0.9rem', display: 'grid', gap: '0.75rem' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{project.name}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{project.address}</div>
          <div style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
            For {project.owner}. Builder: {GC_COMPANY_NAME}
            {architect ? ` · Hello, ${architect.contact}.` : ''}
          </div>
        </div>

        <PortalBlock title={waiting.length > 0 ? `Pay applications to certify · ${waiting.length}` : 'Pay applications to certify'}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.45rem' }}>
            {project.owner} pays what you certify. Check the work against each line, then certify it. Certify less when some of
            it is not done, and say why.
          </div>
          {waiting.length === 0 ? (
            <div style={{ fontSize: '0.875rem' }}>Nothing waits on you.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {waiting.map((app) => (
                <CertifyRow key={app.number} state={state} project={project} app={app} dispatch={dispatch} />
              ))}
            </div>
          )}
        </PortalBlock>

        {certified.length > 0 && (
          <PortalBlock title="You certified">
            <div style={{ display: 'grid', gap: '0.35rem' }}>
              {certified.map((app) => {
                const amount = appCertified(app) ?? 0
                const less = app.due - amount
                return (
                  <div key={app.number} style={{ fontSize: '0.85rem', borderTop: `1px solid ${RULE}`, paddingTop: '0.3rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                      <strong>{app.final ? 'Final pay application' : `Pay application ${app.number}`}</strong>
                      <span style={{ color: 'var(--text-muted)' }}>{shortDate(app.certifiedOn ?? null)}</span>
                      <span style={{ flex: 1 }} />
                      <strong>{money(amount)}</strong>
                    </div>
                    {less > 0.005 && (
                      <div style={{ color: 'var(--text-muted)' }}>
                        {money(less)} less than asked{app.certifiedNote ? `: ${app.certifiedNote.replace(/[.\s]+$/, '')}` : ''}.
                      </div>
                    )}
                    <div style={{ color: 'var(--text-muted)' }}>{app.paidOn ? `${project.owner} paid it ${shortDate(app.paidOn)}.` : `${project.owner} has not paid it yet.`}</div>
                  </div>
                )
              })}
            </div>
          </PortalBlock>
        )}

        <PortalBlock title={questions.length > 0 ? `Questions from the trades · ${questions.length}` : 'Questions from the trades'}>
          {questions.length === 0 ? (
            <div style={{ fontSize: '0.875rem' }}>No question waits on you.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.4rem' }}>
              {questions.map((q) => {
                const pkg = project.packages.find((p) => p.id === q.packageId)
                const company = partnerById(state, q.partnerId)?.company ?? 'A company'
                const waited = q.sentToArchitectOn ? daysUntil(state.today, q.sentToArchitectOn) : 0
                return (
                  <div key={q.id} style={{ fontSize: '0.85rem', borderTop: `1px solid ${RULE}`, paddingTop: '0.3rem', display: 'grid', gap: '0.15rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <Chip tone={waited >= 3 ? 'red' : 'amber'}>{waited === 1 ? '1 day' : `${waited} days`}</Chip>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {pkg?.trade ?? 'A trade'} · asked by {company}
                      </span>
                    </div>
                    <div>{q.text}</div>
                  </div>
                )
              })}
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {GC_COMPANY_NAME} records your answer and sends it to the trades.
              </div>
            </div>
          )}
        </PortalBlock>
      </div>
    </div>
  )
}

function CertifyRow({ state, project, app, dispatch }: { state: GcState; project: GcProject; app: OwnerPayAppSent; dispatch: Dispatch<GcAction> }) {
  const [less, setLess] = useState(false)
  const [amount, setAmount] = useState(String(Math.round(app.due * 100) / 100))
  const [note, setNote] = useState('')
  const [form, setForm] = useState(false)
  const amountNum = Number(amount)
  const isLess = Number.isFinite(amountNum) && amountNum < app.due - 0.005
  const ready = Number.isFinite(amountNum) && amountNum >= 0 && amountNum <= app.due + 0.005 && (!isLess || note.trim() !== '')
  const certify = (value: number, why: string) => dispatch({ type: 'architectCertify', projectId: project.id, number: app.number, amount: value, note: why })
  const label = { display: 'grid', gap: '0.2rem', fontSize: '0.8rem', color: 'var(--text-muted)' } as const

  return (
    <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: '0.45rem', display: 'grid', gap: '0.4rem', fontSize: '0.875rem' }}>
      {form && <OwnerPayAppWindow state={state} project={project} which={app.number} onClose={() => setForm(false)} />}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <strong>{app.final ? 'Final pay application' : `Pay application ${app.number}`}</strong>
        <span style={{ color: 'var(--text-muted)' }}>sent {shortDate(app.sentOn)}</span>
        <span style={{ flex: 1 }} />
        <span>
          asks <strong>{money(app.due)}</strong>
        </span>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setForm(true)}
          style={{ border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer', padding: 0, fontSize: '0.8rem' }}
        >
          ⤓ Pay application
        </button>
        {!less && (
          <>
            <Btn kind="primary" onClick={() => certify(app.due, '')}>
              Certify {money(app.due)}
            </Btn>
            <Btn onClick={() => setLess(true)}>Certify less</Btn>
          </>
        )}
      </div>
      {less && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={label}>
            Amount you certify
            <input style={{ ...input, width: '8.5rem' }} type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label style={{ ...label, flex: '1 1 12rem' }}>
            Why less
            <input style={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What is not done, in a sentence" />
          </label>
          <Btn kind="primary" disabled={!ready} onClick={() => certify(amountNum, note)}>
            Certify {Number.isFinite(amountNum) ? money(amountNum) : ''}
          </Btn>
          <Btn kind="quiet" onClick={() => setLess(false)}>
            Cancel
          </Btn>
        </div>
      )}
    </div>
  )
}
