import { useState } from 'react'
import { GC_COMPANY } from '../../lib/gc/company'
import { pWeekday, type PortalKey } from '../../lib/gc/portalI18n'
import type { LookAheadReason } from '../../lib/gc/schedule/types'
import { HAIR, MUTED } from '../../lib/portal/portalTheme'
import type { WorkCrewWeek, WorkLookItem, WorkLookWeek } from '../../../supabase/functions/_shared/gcTradePortalSchedule'
import { GcTradePortalCrewCount } from './GcTradePortalCrewCount'
import { Btn, Chip, input } from './gcUi'
import { usePortalLang } from './gcTradePortalLang'
import { usePress } from './gcTradePortalPress'
import { PortalBlock } from './GcTradePortalUi'

/**
 * GC mode, the trade partner portal's P5d-ii-2 (to-dos/gc-mode/mockups/portal-p5d.md): the weekly look-ahead (owner,
 * 2026-10-02), lifted from the design spike's `GcPortalLookAhead.tsx` onto `gc-trade-portal`'s answer
 * (`portalLookAhead`, worked out on the server). Three weeks of the company's work from our schedule: this week to mark
 * at its end, the next two to see coming, and last week while anything in it is unmarked (`mark_lookahead`). A mark
 * waits on our superintendent, and only a checked mark counts. The company can change its mark until then. Each coming
 * week carries its crew count (`GcTradePortalCrewCount`). Anchored `lookahead`.
 */

const GC = GC_COMPANY.shortName

const REASON_WORDS: Record<LookAheadReason, PortalKey> = {
  weather: 'reasonWeather',
  'trade before': 'reasonTradeBefore',
  materials: 'reasonMaterials',
  crew: 'reasonCrew',
  other: 'reasonOther',
}

const reasonWords = (r: string | null): PortalKey => REASON_WORDS[(r ?? 'other') as LookAheadReason] ?? 'reasonOther'

const WEEK_WORDS: Record<WorkLookWeek['when'], PortalKey> = { last: 'weekLast', this: 'weekThis', next: 'weekNext', later: 'weekLater' }

export function GcTradePortalLookAhead({ weeks, crew }: { weeks: WorkLookWeek[]; crew: WorkCrewWeek[] }) {
  const { lang, t } = usePortalLang()
  if (weeks.length === 0) return null
  const trades = new Set(weeks.flatMap((w) => w.items.map((i) => i.trade)))
  return (
    <div data-portal-anchor="lookahead" style={{ scrollMarginTop: '0.5rem' }}>
      <PortalBlock title={t('lookTitle')}>
        <div style={{ display: 'grid', gap: '0.6rem', fontSize: '0.9rem' }}>
          <div style={{ fontSize: '0.85rem', color: MUTED }}>{t('lookIntro', { gc: GC })}</div>
          {weeks.map((w) => (
            <div key={w.weekOf} data-portal-week={w.weekOf} style={{ display: 'grid', gap: '0.35rem', borderTop: `1px solid ${HAIR}`, paddingTop: '0.45rem' }}>
              <div style={{ fontWeight: 700, color: w.when === 'last' ? 'var(--text-amber-800)' : undefined }}>{t(WEEK_WORDS[w.when], { date: pWeekday(lang, w.weekOf) })}</div>
              {w.items.length === 0 && <div style={{ color: MUTED }}>{t('nothingThisWeek')}</div>}
              {w.items.map((item) => (
                <Item key={`${w.weekOf}:${item.lineId}`} weekOf={w.weekOf} item={item} showTrade={trades.size > 1} />
              ))}
              {/* How many a day it will have on site (G-142): each coming week with its work, not last week's. */}
              {w.when !== 'last' && <GcTradePortalCrewCount week={crew.find((c) => c.weekOf === w.weekOf)} />}
            </div>
          ))}
        </div>
      </PortalBlock>
    </div>
  )
}

function Item({ weekOf, item, showTrade }: { weekOf: string; item: WorkLookItem; showTrade: boolean }) {
  const { lang, t } = usePortalLang()
  const { busy, problem: refused, run } = usePress()
  const [editing, setEditing] = useState(false)
  const [notDone, setNotDone] = useState(false)
  const [reason, setReason] = useState<LookAheadReason>('weather')
  const { mark } = item
  const verified = Boolean(mark?.verifiedOn)
  const counted = verified ? (mark?.verifiedDone ?? mark?.done) : undefined
  const asking = item.canMark && (mark === null || editing)
  const send = async (done: boolean) => {
    if (await run('mark_lookahead', { activityId: item.lineId, weekOf, done, ...(done ? {} : { reason }) })) {
      setNotDone(false)
      setEditing(false)
    }
  }

  return (
    <div data-portal-look={item.lineId} style={{ display: 'grid', gap: '0.3rem' }}>
      <div>
        <strong>{item.work}</strong>
        {showTrade && <span style={{ color: MUTED }}> · {item.trade}</span>}
        <div style={{ fontSize: '0.8rem', color: MUTED }}>{t('planned', { start: pWeekday(lang, item.start), finish: pWeekday(lang, item.finish) })}</div>
      </div>

      {verified && mark && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip tone={counted ? 'green' : 'red'}>
            {counted
              ? t('checkedDone', { gc: GC })
              : (mark.verifiedReason ?? mark.reason)
                ? t('checkedNotWhy', { gc: GC, reason: t(reasonWords(mark.verifiedReason ?? mark.reason)) })
                : t('checkedNot', { gc: GC })}
          </Chip>
          {mark.verifiedDone !== null && mark.verifiedDone !== mark.done && <span style={{ fontSize: '0.8rem', color: MUTED }}>{t('checkedDiffers', { mark: t(mark.done ? 'markWordDone' : 'markWordNot') })}</span>}
        </div>
      )}

      {!verified && mark && !asking && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip tone="grey">{mark.done ? t('youMarkedDone', { gc: GC }) : t('youMarkedNot', { gc: GC, reason: t(reasonWords(mark.reason)) })}</Chip>
          {item.canMark && (
            <Btn kind="quiet" onClick={() => setEditing(true)}>
              {t('changeMark')}
            </Btn>
          )}
        </div>
      )}

      {asking && !notDone && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <Btn kind="primary" disabled={busy} onClick={() => void send(true)}>
            {t('markDone')}
          </Btn>
          <Btn onClick={() => setNotDone(true)}>{t('markNotDone')}</Btn>
        </div>
      )}

      {asking && notDone && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            {t('whyNot')}
            <select value={reason} onChange={(e) => setReason(e.target.value as LookAheadReason)} style={{ ...input, width: 'auto' }}>
              {(Object.keys(REASON_WORDS) as LookAheadReason[]).map((r) => (
                <option key={r} value={r}>
                  {t(REASON_WORDS[r])}
                </option>
              ))}
            </select>
          </label>
          <Btn kind="primary" disabled={busy} onClick={() => void send(false)}>
            {t('sendMark')}
          </Btn>
          <Btn kind="quiet" onClick={() => setNotDone(false)}>
            {t('notNow')}
          </Btn>
        </div>
      )}
      {refused && <span style={{ color: MUTED, fontSize: '0.85rem' }}>{refused}</span>}
    </div>
  )
}
