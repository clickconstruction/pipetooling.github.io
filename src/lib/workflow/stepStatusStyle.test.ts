import { describe, expect, it } from 'vitest'
import { getStepStatusStyle } from './stepStatusStyle'
import { forecastBarSwatch } from '../projectsForecastColors'

describe('getStepStatusStyle', () => {
  it('is green for a finished step', () => {
    expect(getStepStatusStyle('completed')).toEqual({ color: 'var(--text-green-600)', fontWeight: 'normal' })
    expect(getStepStatusStyle('approved')).toEqual({ color: 'var(--text-green-600)', fontWeight: 'normal' })
  })

  it('is bold orange while in progress', () => {
    expect(getStepStatusStyle('in_progress')).toEqual({ color: '#E87600', fontWeight: 'bold' })
  })

  it('is red when rejected', () => {
    expect(getStepStatusStyle('rejected')).toEqual({ color: 'var(--text-red-700)', fontWeight: 'normal' })
  })

  it('is muted for pending, skipped and no status', () => {
    const muted = { color: 'var(--text-muted)', fontWeight: 'normal' }
    expect(getStepStatusStyle('pending')).toEqual(muted)
    expect(getStepStatusStyle('skipped')).toEqual(muted)
    expect(getStepStatusStyle(null)).toEqual(muted)
  })

  it('shares its in-progress orange with the Forecast bar', () => {
    expect(forecastBarSwatch('in_progress').borderColor).toBe(getStepStatusStyle('in_progress').color)
  })
})
