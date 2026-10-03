import { useState, type Dispatch } from 'react'
import { GC_COMPANY, type GcAction, type Partner } from '../../lib/gcMode/gcModel'
import { Btn, input } from './gcUi'
import { PortalWindow } from './GcPortalUi'

/**
 * GC mode design spike: the master agreement a trade reads before signing it in the portal. The
 * terms are only the rules the prototype keeps, in plain words. The real build shows the Master
 * Subcontract Agreement from the contract library here.
 */

const TERMS = (gc: string): { title: string; body: string }[] => [
  {
    title: 'Each job',
    body: `A job starts with a statement of work. You sign it in this portal. It says the work, the price and the plans it is based on. Nothing is owed on a job without one.`,
  },
  {
    title: 'The plans',
    body: `Your price is based on one set of plans. When a new set changes your trade, ${gc} tells you. You confirm your number or send a new one.`,
  },
  {
    title: 'Changes',
    body: `Work outside the statement of work needs a change in writing first. ${gc} adds it to the statement of work before you start it.`,
  },
  {
    title: 'Your paperwork',
    body: `Keep your insurance current and a W-9 on file. ${gc} cannot send a statement of work or pay a draw without them.`,
  },
  {
    title: 'Getting paid',
    body: `Report how far along each line of the work is. Then ask for a draw in this portal. ${gc} holds back part of each draw until the job is done. Each statement of work says how much.`,
  },
  {
    title: 'Lien waivers',
    body: 'Sign a conditional waiver when you ask for a draw. Sign the unconditional waiver once that draw is paid.',
  },
]

export function GcPortalAgreement({ partner, onClose, dispatch }: { partner: Partner; onClose: () => void; dispatch: Dispatch<GcAction> }) {
  const [name, setName] = useState('')
  const [agree, setAgree] = useState(false)
  const gc = GC_COMPANY.shortName

  return (
    <PortalWindow
      title="Master agreement"
      sub={`Between ${partner.company} and ${GC_COMPANY.name}`}
      onClose={onClose}
      width={620}
      footer={
        <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
          <label style={{ display: 'grid', gap: '0.2rem' }}>
            Type your full name to sign
            <input style={input} value={name} placeholder={partner.contact} onChange={(e) => setName(e.target.value)} />
          </label>
          <label style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            I read the master agreement and I agree to it.
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Btn
              kind="primary"
              disabled={!agree || name.trim() === ''}
              onClick={() => {
                dispatch({ type: 'tradeSignMsa', partnerId: partner.id })
                onClose()
              }}
            >
              Sign the master agreement
            </Btn>
            <Btn kind="quiet" onClick={onClose}>Not now</Btn>
          </div>
        </div>
      }
    >
      <div style={{ padding: '0.9rem', display: 'grid', gap: '0.75rem', fontSize: '0.92rem', lineHeight: 1.45 }}>
        <p style={{ margin: 0 }}>
          You sign this once. It covers every job you do for {gc}. Each job then gets a short statement of work.
        </p>
        {TERMS(gc).map((t, i) => (
          <div key={t.title}>
            <div style={{ fontWeight: 700 }}>
              {i + 1}. {t.title}
            </div>
            <div>{t.body}</div>
          </div>
        ))}
        <div style={{ fontSize: '0.78rem', opacity: 0.7 }}>
          Prototype. The real portal shows the Master Subcontract Agreement from the contract library here.
        </div>
      </div>
    </PortalWindow>
  )
}
