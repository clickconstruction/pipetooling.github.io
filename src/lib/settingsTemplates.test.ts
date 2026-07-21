import { describe, expect, it } from 'vitest'
import {
  EMAIL_TEMPLATE_DEFAULTS,
  NOTIFICATION_VARIABLE_HINT,
  replaceTemplateVariables,
  substituteNotificationVariables,
  VARIABLE_HINT,
  WORKFLOW_FN_EMAIL_TEST_OPTIONS,
  WORKFLOW_FN_TEST_PLACEHOLDER_STEP_ID,
} from './settingsTemplates'

describe('substituteNotificationVariables', () => {
  it('uses the trimmed name as display name across all name-like placeholders', () => {
    const result = substituteNotificationVariables(
      { push_title: 'Hi {{name}}', push_body: '{{assignee_name}} / {{assigned_to_name}}' },
      { name: '  Jane Doe  ', email: 'jane@example.com' },
    )
    expect(result.title).toBe('Hi Jane Doe')
    expect(result.body).toBe('Jane Doe / Jane Doe')
  })

  it('falls back to email when name is blank/whitespace', () => {
    const result = substituteNotificationVariables(
      { push_title: '{{name}}', push_body: '' },
      { name: '   ', email: 'fallback@example.com' },
    )
    expect(result.title).toBe('fallback@example.com')
  })

  it('falls back to email when name is null', () => {
    const result = substituteNotificationVariables(
      { push_title: '{{name}}', push_body: '' },
      { name: null, email: 'nn@example.com' },
    )
    expect(result.title).toBe('nn@example.com')
  })

  it('falls back to "Test User" when both name and email are empty', () => {
    const result = substituteNotificationVariables(
      { push_title: '{{name}}', push_body: '{{assignee_name}}' },
      { name: null, email: null },
    )
    expect(result.title).toBe('Test User')
    expect(result.body).toBe('Test User')
  })

  it('replaces the non-name sample placeholders with fixed sample values', () => {
    const result = substituteNotificationVariables(
      {
        push_title: '{{item_title}} · {{stage_name}}',
        push_body: '{{project_name}} → {{next_stage_name}} ({{rejection_reason}})',
      },
      { name: 'Bob', email: 'bob@example.com' },
    )
    expect(result.title).toBe('Sample checklist item · Sample stage')
    expect(result.body).toBe('Sample project → Next stage (Sample rejection reason)')
  })

  it('replaces every occurrence of a repeated placeholder', () => {
    const result = substituteNotificationVariables(
      { push_title: '{{name}} {{name}} {{name}}', push_body: '' },
      { name: 'Al', email: 'al@example.com' },
    )
    expect(result.title).toBe('Al Al Al')
  })

  it('leaves unknown placeholders untouched', () => {
    const result = substituteNotificationVariables(
      { push_title: '{{name}} {{unknown}}', push_body: '' },
      { name: 'Cat', email: 'c@example.com' },
    )
    expect(result.title).toBe('Cat {{unknown}}')
  })
})

describe('settings templates constants', () => {
  it('exposes the email and notification variable hints', () => {
    expect(VARIABLE_HINT).toContain('{{name}}')
    expect(VARIABLE_HINT).toContain('{{link}}')
    expect(NOTIFICATION_VARIABLE_HINT).toContain('{{assignee_name}}')
    expect(NOTIFICATION_VARIABLE_HINT).toContain('{{rejection_reason}}')
  })

  it('uses a non-null placeholder step id for the workflow-fn test', () => {
    expect(WORKFLOW_FN_TEST_PLACEHOLDER_STEP_ID).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('lists workflow-fn email test options with unique types and labels', () => {
    expect(WORKFLOW_FN_EMAIL_TEST_OPTIONS).toHaveLength(8)
    const types = WORKFLOW_FN_EMAIL_TEST_OPTIONS.map((o) => o.type)
    expect(new Set(types).size).toBe(types.length)
    for (const opt of WORKFLOW_FN_EMAIL_TEST_OPTIONS) {
      expect(opt.label.length).toBeGreaterThan(0)
    }
  })
})

describe('EMAIL_TEMPLATE_DEFAULTS', () => {
  it('covers all 11 email template types with non-empty subject and body', () => {
    const types = Object.keys(EMAIL_TEMPLATE_DEFAULTS)
    expect(types).toHaveLength(11)
    for (const [type, def] of Object.entries(EMAIL_TEMPLATE_DEFAULTS)) {
      expect(def.subject.length, type).toBeGreaterThan(0)
      expect(def.body.length, type).toBeGreaterThan(0)
    }
  })

  it('link-bearing transactional defaults include the {{link}} placeholder', () => {
    for (const type of ['invitation', 'sign_in', 'login_as'] as const) {
      expect(EMAIL_TEMPLATE_DEFAULTS[type].body).toContain('{{link}}')
    }
  })

  it('workflow stage defaults include stage/project/workflow-link placeholders', () => {
    for (const type of [
      'stage_assigned_started',
      'stage_assigned_complete',
      'stage_assigned_reopened',
      'stage_me_started',
      'stage_me_complete',
      'stage_me_reopened',
      'stage_next_complete_or_approved',
      'stage_prior_rejected',
    ] as const) {
      const def = EMAIL_TEMPLATE_DEFAULTS[type]
      expect(def.subject).toContain('{{stage_name}}')
      expect(def.body).toContain('{{project_name}}')
      expect(def.body).toContain('{{workflow_link}}')
    }
  })

  it('rejection default carries the rejection reason; next-stage default the previous stage', () => {
    expect(EMAIL_TEMPLATE_DEFAULTS.stage_prior_rejected.body).toContain('{{rejection_reason}}')
    expect(EMAIL_TEMPLATE_DEFAULTS.stage_next_complete_or_approved.body).toContain('{{previous_stage_name}}')
  })
})

describe('replaceTemplateVariables', () => {
  it('replaces every occurrence of each variable in subject and body', () => {
    const result = replaceTemplateVariables(
      { subject: '{{stage_name}} for {{name}}', body: '{{stage_name}} / {{stage_name}} — {{name}}' },
      { stage_name: 'Rough-in', name: 'Pat' },
    )
    expect(result.subject).toBe('Rough-in for Pat')
    expect(result.body).toBe('Rough-in / Rough-in — Pat')
  })

  it('leaves unknown placeholders untouched and ignores unused variables', () => {
    const result = replaceTemplateVariables(
      { subject: 'Hi {{name}}', body: '{{mystery}} stays' },
      { name: 'Sam', unused: 'nope' },
    )
    expect(result.subject).toBe('Hi Sam')
    expect(result.body).toBe('{{mystery}} stays')
  })

  it('handles empty variables map as a no-op', () => {
    const result = replaceTemplateVariables({ subject: 'A {{b}}', body: 'C' }, {})
    expect(result).toEqual({ subject: 'A {{b}}', body: 'C' })
  })
})
