import { describe, expect, it } from 'vitest'
import { canOpenDayBook } from './dayBookAccess'

describe('canOpenDayBook', () => {
  it('devs and controllers only, for now', () => {
    expect(canOpenDayBook('dev')).toBe(true)
    expect(canOpenDayBook('controller')).toBe(true)
    for (const r of ['master_technician', 'assistant', 'estimator', 'superintendent', 'subcontractor', 'helpers', 'primary', null, undefined, '']) expect(canOpenDayBook(r)).toBe(false)
  })
})
