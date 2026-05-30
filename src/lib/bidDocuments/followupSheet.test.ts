import { describe, expect, it } from 'vitest'
import {
  buildFollowupSheetHtml,
  type FollowupGroups,
  type FollowupProject,
} from './followupSheet'

function project(overrides: Partial<FollowupProject> = {}): FollowupProject {
  return {
    projectName: 'Acme Tower',
    address: '123 Main St',
    builderName: 'BuildCo',
    builderAddress: '456 Builder Rd',
    builderPhone: '(555) 123-4567',
    builderEmail: 'bob@buildco.com',
    projectContact: 'Jane Doe',
    projectContactPhone: '(555) 987-6543',
    projectContactEmail: 'jane@gc.com',
    outcome: null,
    bidDate: '26-01-15',
    bidDateSent: '26-01-10',
    designDrawingPlanDate: '26-01-05',
    bidValue: '$12,000',
    agreedValue: '$11,500',
    distance: '39.0 mi',
    notes: 'Some notes',
    submissionEntries: [],
    ...overrides,
  }
}

function groups(overrides: Partial<FollowupGroups> = {}): FollowupGroups {
  return { notYetWonOrLost: [], won: [], ...overrides }
}

describe('buildFollowupSheetHtml — outcome labels', () => {
  const labelFor = (outcome: string | null): string => {
    const html = buildFollowupSheetHtml({
      mode: 'manager',
      title: 'T',
      name: 'M',
      groups: groups({ notYetWonOrLost: [project({ outcome })] }),
    })
    const m = html.match(/Win\/ Loss:<\/span> ([^<]*)</)
    return m?.[1]?.trim() ?? ''
  }

  it('maps each known outcome and falls back to the em dash', () => {
    expect(labelFor('won')).toBe('Won')
    expect(labelFor('lost')).toBe('Lost')
    expect(labelFor('started_or_complete')).toBe('Started/Complete')
    expect(labelFor(null)).toBe('—')
    expect(labelFor('mystery')).toBe('—')
  })
})

describe('buildFollowupSheetHtml — project rendering', () => {
  const render = (p: FollowupProject) =>
    buildFollowupSheetHtml({ mode: 'manager', title: 'T', name: 'M', groups: groups({ notYetWonOrLost: [p] }) })

  it('escapes free-text fields', () => {
    const html = render(project({ projectName: 'A & <b>', notes: '"quoted" & <tag>' }))
    expect(html).toContain('Project: A &amp; &lt;b&gt;')
    expect(html).toContain('&quot;quoted&quot; &amp; &lt;tag&gt;')
  })

  it('builds tel/mailto links for the builder and strips non-digits from the href', () => {
    const html = render(project({ builderPhone: '(555) 123-4567', builderEmail: 'bob@buildco.com' }))
    expect(html).toContain('<a href="tel:5551234567">(555) 123-4567</a>')
    expect(html).toContain('<a href="mailto:bob@buildco.com">bob@buildco.com</a>')
  })

  it('renders an em dash (no link) when builder phone/email are "—"', () => {
    const html = render(
      project({ builderPhone: '—', builderEmail: '—', projectContactPhone: null, projectContactEmail: null }),
    )
    expect(html).toContain('<span class="label">Builder Phone:</span> —')
    expect(html).toContain('<span class="label">Builder Email:</span> —')
    expect(html).not.toContain('href="tel:')
    expect(html).not.toContain('href="mailto:')
  })

  it('handles the project-contact guard (value && value !== "—")', () => {
    const withLinks = render(project({ projectContactPhone: '555.111.2222', projectContactEmail: 'x@y.com' }))
    expect(withLinks).toContain('<a href="tel:5551112222">555.111.2222</a>')
    expect(withLinks).toContain('<a href="mailto:x@y.com">x@y.com</a>')

    const nullCase = render(project({ projectContactPhone: null, projectContactEmail: null }))
    expect(nullCase).toContain('<span class="label">Project Contact Phone:</span> —')
    expect(nullCase).toContain('<span class="label">Project Contact Email:</span> —')

    const dashCase = render(project({ projectContactPhone: '—', projectContactEmail: '—' }))
    expect(dashCase).toContain('<span class="label">Project Contact Phone:</span> —')
  })

  it('inserts pre-formatted trusted fields verbatim (no escaping)', () => {
    const html = render(project({ bidDate: '26-01-15', bidValue: '$12,000', distance: '39.0 mi' }))
    expect(html).toContain('Bid Date:</span> 26-01-15')
    expect(html).toContain('Bid Value:</span> $12,000')
    expect(html).toContain('Distance to Office:</span> 39.0 mi')
  })

  it('omits the submission block when there are no entries', () => {
    expect(render(project({ submissionEntries: [] }))).not.toContain('Recent Contact Attempts:')
  })

  it('renders numbered submission entries with escaped author and verbatim time', () => {
    const html = render(
      project({
        submissionEntries: [
          { contactMethod: 'Call', notes: 'left vm', time: '01/15 9:00a', author: 'A & B' },
          { contactMethod: 'Email', notes: null, time: '01/16 10:00a', author: 'C' },
        ],
      }),
    )
    expect(html).toContain('Recent Contact Attempts:')
    expect(html).toContain('<span class="submission-label">1.</span>')
    expect(html).toContain('<span class="submission-label">2.</span>')
    expect(html).toContain('Contact Method:</span> Call')
    expect(html).toContain('Notes:</span> left vm')
    expect(html).toContain('Notes:</span> —') // second entry's null notes
    expect(html).toContain('Time:</span> 01/15 9:00a')
    expect(html).toContain('Author:</span> A &amp; B')
  })
})

describe('buildFollowupSheetHtml — groups', () => {
  it('renders both section headings with None empty states', () => {
    const html = buildFollowupSheetHtml({ mode: 'unassigned', title: 'T', groups: groups() })
    expect(html).toContain('<h2>Not yet won or lost</h2>')
    expect(html).toContain('<h2>Won</h2>')
    expect((html.match(/<p class="empty-section">None<\/p>/g) ?? [])).toHaveLength(2)
  })

  it('lists projects when present', () => {
    const html = buildFollowupSheetHtml({
      mode: 'unassigned',
      title: 'T',
      groups: groups({
        notYetWonOrLost: [project({ projectName: 'Pending One' })],
        won: [project({ projectName: 'Won One', outcome: 'won' })],
      }),
    })
    expect(html).toContain('Pending One')
    expect(html).toContain('Won One')
    expect(html).not.toContain('None')
  })
})

describe('buildFollowupSheetHtml — modes', () => {
  it('all: one page-break div per manager, unassigned without page break', () => {
    const html = buildFollowupSheetHtml({
      mode: 'all',
      title: 'Followup Sheets - All Account Managers',
      managers: [
        { name: 'Alice', groups: groups() },
        { name: 'Bob', groups: groups() },
      ],
      unassigned: groups(),
    })
    expect((html.match(/page-break-after: always;/g) ?? [])).toHaveLength(2)
    expect(html).toContain('<h1>Followup Sheet for Alice</h1>')
    expect(html).toContain('<h1>Followup Sheet for Bob</h1>')
    expect(html).toContain('<h1>Followup Sheet for Unassigned</h1>')
    expect(html).toContain('<title>Followup Sheets - All Account Managers</title>')
  })

  it('all: omits the unassigned section when unassigned is null', () => {
    const html = buildFollowupSheetHtml({
      mode: 'all',
      title: 'T',
      managers: [{ name: 'Alice', groups: groups() }],
      unassigned: null,
    })
    expect(html).not.toContain('Followup Sheet for Unassigned')
  })

  it('all: shows "No bids found." when there are no managers and no unassigned', () => {
    const html = buildFollowupSheetHtml({ mode: 'all', title: 'T', managers: [], unassigned: null })
    expect(html).toContain('<p class="empty-section">No bids found.</p>')
  })

  it('unassigned: single leading h1, no page break', () => {
    const html = buildFollowupSheetHtml({ mode: 'unassigned', title: 'T', groups: groups() })
    expect(html).toContain('<h1>Followup Sheet for Unassigned</h1>')
    expect(html).not.toContain('page-break-after: always;')
  })

  it('manager: escapes the name exactly once in the title and heading', () => {
    const html = buildFollowupSheetHtml({
      mode: 'manager',
      title: 'Followup Sheet - A & B',
      name: 'A & B',
      groups: groups(),
    })
    expect(html).toContain('<title>Followup Sheet - A &amp; B</title>')
    expect(html).toContain('<h1>Followup Sheet for A &amp; B</h1>')
    expect(html).not.toContain('&amp;amp;')
  })
})
