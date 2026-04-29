import { describe, expect, it } from 'vitest'
import {
  additionalReportModalBlueChipTemplate,
  additionalReportModalTemplateChipLabel,
  displayReportTemplateName,
  findStatusReportTemplateId,
} from './reportTemplateDisplayName'

describe('displayReportTemplateName', () => {
  it('maps legacy superintendent template label to Status Report', () => {
    expect(displayReportTemplateName('Superintendent Report', null)).toBe('Status Report')
    expect(displayReportTemplateName('Superintendent Report', 'superintendent')).toBe(
      'Status Report',
    )
  })

  it('passes through current DB label', () => {
    expect(displayReportTemplateName('Status Report', 'master_technician')).toBe('Status Report')
  })

  it('passes through other templates', () => {
    expect(displayReportTemplateName('Note', null)).toBe('Note')
    expect(displayReportTemplateName('Walk Report', 'assistant')).toBe('Walk Report')
  })
})

describe('additionalReportModalTemplateChipLabel', () => {
  it('maps legacy superintendent to Status then strips Report', () => {
    expect(additionalReportModalTemplateChipLabel('Superintendent Report', null)).toBe('Status')
  })

  it('strips trailing Report from status template', () => {
    expect(additionalReportModalTemplateChipLabel('Status Report', 'master_technician')).toBe('Status')
  })

  it('strips trailing Report from walk template', () => {
    expect(additionalReportModalTemplateChipLabel('Walk Report', 'assistant')).toBe('Walk')
  })

  it('leaves names without trailing Report unchanged', () => {
    expect(additionalReportModalTemplateChipLabel('Note', null)).toBe('Note')
    expect(additionalReportModalTemplateChipLabel('Job Complete', null)).toBe('Job Complete')
  })
})

describe('additionalReportModalBlueChipTemplate', () => {
  it('marks Job Complete and Status templates', () => {
    expect(additionalReportModalBlueChipTemplate('Job Complete')).toBe(true)
    expect(additionalReportModalBlueChipTemplate('Status Report')).toBe(true)
    expect(additionalReportModalBlueChipTemplate(' Superintendent Report ')).toBe(true)
  })

  it('does not mark other templates', () => {
    expect(additionalReportModalBlueChipTemplate('Walk Report')).toBe(false)
    expect(additionalReportModalBlueChipTemplate('Note')).toBe(false)
  })
})

describe('findStatusReportTemplateId', () => {
  it('finds Status Report row', () => {
    expect(
      findStatusReportTemplateId([
        { id: 'a', name: 'Walk Report' },
        { id: 'b', name: 'Status Report' },
      ]),
    ).toBe('b')
  })

  it('finds legacy Superintendent Report row', () => {
    expect(findStatusReportTemplateId([{ id: 'z', name: 'Superintendent Report' }])).toBe('z')
  })

  it('returns undefined when no status template', () => {
    expect(findStatusReportTemplateId([{ id: 'n', name: 'Note' }])).toBeUndefined()
  })
})
