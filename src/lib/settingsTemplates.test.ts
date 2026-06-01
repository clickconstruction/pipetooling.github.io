import { describe, expect, it } from 'vitest'
import {
  NOTIFICATION_VARIABLE_HINT,
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
