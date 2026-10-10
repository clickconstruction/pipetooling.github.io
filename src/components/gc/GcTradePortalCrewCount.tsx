import { useState } from 'react'
import { GC_COMPANY } from '../../lib/gc/company'
import { CREW_MAX, crewCountProblem } from '../../lib/gc/schedule/crewCounts'
import { MUTED } from '../../lib/portal/portalTheme'
import type { WorkCrewWeek } from '../../../supabase/functions/_shared/gcTradePortalSchedule'
import { Btn, Chip, input } from './gcUi'
import { usePortalLang } from './gcTradePortalLang'
import { usePress } from './gcTradePortalPress'

/**
 * GC mode, the trade partner portal's P5d-ii-2 (to-dos/gc-mode/mockups/portal-p5d.md): a trade's own crew count (G-142),
 * lifted from the design spike's `GcPortalCrewCount.tsx` onto `gc-trade-portal`'s answer (`portalCrewAsks`, worked out
 * on the server). Under each coming week of *Your next three weeks* that has its work, a line per trade: how many people
 * a day it will have on site (`crew_count`). The superintendent's morning list reads it beside the daily log's count.
 */

const GC = GC_COMPANY.shortName

export function GcTradePortalCrewCount({ week }: { week: WorkCrewWeek | undefined }) {
  if (!week) return null
  const many = week.trades.length > 1
  return (
    <div data-portal-crew={week.weekOf} style={{ display: 'grid', gap: '0.3rem', fontSize: '0.85rem' }}>
      {week.trades.map((tr) => (
        <CrewLine key={tr.packageId} weekOf={week.weekOf} trade={tr} many={many} />
      ))}
    </div>
  )
}

function CrewLine({ weekOf, trade, many }: { weekOf: string; trade: WorkCrewWeek['trades'][number]; many: boolean }) {
  const { t } = usePortalLang()
  const { busy, problem: refused, run } = usePress()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  if (trade.count !== null && !editing) {
    return (
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {many && <span>{trade.trade}:</span>}
        <Chip tone="grey">{trade.count === 0 ? t('crewSaidNone') : t('crewSaid', { n: trade.count })}</Chip>
        <Btn
          kind="quiet"
          wrap
          onClick={() => {
            setValue(String(trade.count))
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
        disabled={problem !== null || busy}
        onClick={() => {
          if (problem) return
          void run('crew_count', { packageId: trade.packageId, weekOf, count }).then((ok) => {
            if (!ok) return
            setEditing(false)
            setValue('')
          })
        }}
      >
        {t('crewSend', { gc: GC })}
      </Btn>
      {value.trim() !== '' && problem && <span style={{ color: MUTED }}>{t(problem)}</span>}
      {refused && <span style={{ color: MUTED }}>{refused}</span>}
    </div>
  )
}
