/**
 * GC mode design spike: a trade's own crew count in its portal (G-142; mock-up
 * `to-dos/gc-mode/mockups/G-142.md`). Under each coming week of *Your next three weeks* that has its
 * work, a line per trade: how many people a day it will have on site. The superintendent's morning
 * list reads it beside the daily log's count.
 */
import { useState, type Dispatch } from 'react'
import type { GcAction, GcProject, GcState, Partner } from '../../lib/gcMode/gcModel'
import { GC_COMPANY } from '../../lib/gcMode/gcModel'
import { CREW_MAX, crewCountProblem, portalCrewAsks } from '../../lib/gcMode/gcCrewCounts'
import { PortalTag } from './GcPortalUi'
import { usePortalLang } from './gcPortalLang'
import { Btn, input } from './gcUi'

const GC = GC_COMPANY.shortName

export function GcPortalCrewCount({ state, project, partner, weekOf, dispatch }: { state: GcState; project: GcProject; partner: Partner; weekOf: string; dispatch: Dispatch<GcAction> }) {
  const week = portalCrewAsks(state, partner.id, project).find((w) => w.weekOf === weekOf)
  if (!week) return null
  const many = week.trades.length > 1
  return (
    <div data-portal-crew={weekOf} style={{ display: 'grid', gap: '0.3rem', fontSize: '0.85rem' }}>
      {week.trades.map((tr) => (
        <CrewLine key={tr.packageId} trade={tr} many={many} onSend={(count) => dispatch({ type: 'tradeSetCrewCount', projectId: project.id, partnerId: partner.id, packageId: tr.packageId, weekOf, count })} />
      ))}
    </div>
  )
}

function CrewLine({ trade, many, onSend }: { trade: { packageId: string; trade: string; now: { count: number } | null }; many: boolean; onSend: (count: number) => void }) {
  const { t } = usePortalLang()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const now = trade.now
  if (now && !editing) {
    return (
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {many && <span>{trade.trade}:</span>}
        <PortalTag tone="grey">{now.count === 0 ? t('crewSaidNone') : t('crewSaid', { n: now.count })}</PortalTag>
        <Btn
          kind="quiet"
          wrap
          onClick={() => {
            setValue(String(now.count))
            setEditing(true)
          }}
        >
          {t('crewChange')}
        </Btn>
      </div>
    )
  }
  const count = value.trim() === '' ? Number.NaN : Number(value)
  const problem = crewCountProblem(count)
  return (
    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <span>{many ? t('crewLineTrade', { trade: trade.trade }) : t('crewLine')}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={CREW_MAX}
        step={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={t('crewAria')}
        style={{ ...input, width: '4.5rem' }}
      />
      <Btn
        kind="primary"
        wrap
        disabled={problem !== null}
        onClick={() => {
          if (problem) return
          onSend(count)
          setEditing(false)
          setValue('')
        }}
      >
        {t('crewSend', { gc: GC })}
      </Btn>
      {value.trim() !== '' && problem && <span style={{ color: 'var(--text-muted)' }}>{t(problem)}</span>}
    </div>
  )
}
