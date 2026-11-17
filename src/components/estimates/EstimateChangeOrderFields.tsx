import { type ReactNode } from 'react'
import { estInputBase } from './estimatesPageStyles'
import AutosizeTextarea from '../AutosizeTextarea'
import type { Dispatch, SetStateAction } from 'react'
import type { EstimateChangeOrderFields } from '../../lib/estimateChangeOrder'

export interface EstimateChangeOrderFieldsProps {
  /** The step rail just jumped here: the block pulses. */
  flash: boolean
  /** The rail's numbered dot for this step. */
  stepDot: ReactNode
  coFields: EstimateChangeOrderFields
  setCoFields: Dispatch<SetStateAction<EstimateChangeOrderFields>>
}

/**
 * The change order's own fields on a draft: what is changing, why, the impact on schedule and the day
 * a response is asked by. Moved whole from `EstimateDetail` (v2.7633, punch list #46 row 3, cut 8 of
 * the Estimates map); the markup is the page's own, and the fields stay the page's, saved with the draft.
 */
export default function EstimateChangeOrderFieldsBlock({ flash, stepDot, coFields, setCoFields }: EstimateChangeOrderFieldsProps) {
  return (
    <div
      id="est-step-change"
      className={'est-region-tint' + (flash ? ' estimate-customer-search-highlight' : '')}
      style={{
        border: '1px solid #f59e0b',
        borderRadius: 8,
        padding: '0.6rem 0.8rem 0.8rem',
        marginBottom: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
      }}
    >
      <h2 style={{ fontSize: '1.1rem', margin: 0 }}>{stepDot}Change order</h2>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 600 }}>
        Description of change
        <AutosizeTextarea
          value={coFields.description_of_change}
          onChange={(e) => setCoFields((prev) => ({ ...prev, description_of_change: e.target.value }))}
          placeholder="What is changing — scope, plan reference…"
          minRows={2}
          style={{ ...estInputBase, fontWeight: 400, width: '100%', padding: '0.5rem' }}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 600 }}>
        Reason for change
        <AutosizeTextarea
          value={coFields.reason_for_change}
          onChange={(e) => setCoFields((prev) => ({ ...prev, reason_for_change: e.target.value }))}
          placeholder="Owner directive, field condition, plan revision…"
          minRows={1}
          style={{ ...estInputBase, fontWeight: 400, width: '100%', padding: '0.5rem' }}
        />
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 600, flex: '1 1 200px' }}>
          Impact on schedule
          <input
            value={coFields.impact_on_schedule}
            onChange={(e) => setCoFields((prev) => ({ ...prev, impact_on_schedule: e.target.value }))}
            placeholder='"+2 working days", "none"…'
            style={{ ...estInputBase, fontWeight: 400, padding: '0.5rem' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 600, flex: '0 1 180px' }}>
          Response requested by
          <input
            type="date"
            value={coFields.response_requested_by}
            onChange={(e) => setCoFields((prev) => ({ ...prev, response_requested_by: e.target.value }))}
            style={{ ...estInputBase, fontWeight: 400, padding: '0.5rem' }}
          />
        </label>
      </div>
    </div>
  )
}
