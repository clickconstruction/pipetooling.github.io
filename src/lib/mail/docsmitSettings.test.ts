import { describe, expect, it } from 'vitest'
import { DOCSMIT_SETTINGS_DEFAULT, DOCSMIT_SETTING_KEY_LIST, docsmitSettingRows, docsmitSettingsFrom } from './docsmitSettings'

describe('Docsmit’s switches and numbers from app_settings', () => {
  it('no rows: every default; a row sets its field; a blank or malformed row keeps the default', () => {
    expect(docsmitSettingsFrom([])).toEqual(DOCSMIT_SETTINGS_DEFAULT)
    const s = docsmitSettingsFrom([
      { key: 'docsmit_env', value_text: 'prod' },
      { key: 'docsmit_paused', value_text: 'true' },
      { key: 'docsmit_run_default', value_text: 'paper' },
      { key: 'docsmit_return_receipt', value_text: 'card' },
      { key: 'docsmit_cutoff_local', value_text: '9:30' },
      { key: 'docsmit_send_by_buffer_days', value_text: '2' },
      { key: 'docsmit_credit_warn', value_num: 40 },
      { key: 'docsmit_poll_minutes', value_text: '1' },
      { key: 'docsmit_match_site', value_text: 'on' },
      { key: 'something_else', value_text: 'x' },
    ])
    expect(s).toEqual({ ...DOCSMIT_SETTINGS_DEFAULT, env: 'prod', paused: true, runDefault: 'paper', returnReceipt: 'card', cutoffLocal: '09:30', sendByBufferDays: 2, creditWarn: 40, pollMinutes: 5, matchSite: true })
    expect(docsmitSettingsFrom([{ key: 'docsmit_cutoff_local', value_text: '25:00' }, { key: 'docsmit_env', value_text: '' }, { key: 'docsmit_paused', value_text: 'maybe' }])).toEqual(DOCSMIT_SETTINGS_DEFAULT)
  })

  it('writes back one row per field, and reading them gives the same settings', () => {
    const s = { ...DOCSMIT_SETTINGS_DEFAULT, paused: true, returnReceipt: 'card' as const, cutoffLocal: '14:00', creditWarn: 12.5 }
    const rows = docsmitSettingRows(s)
    expect(rows.map((r) => r.key)).toEqual(DOCSMIT_SETTING_KEY_LIST)
    expect(rows.find((r) => r.key === 'docsmit_return_receipt')!.value_text).toBe('err'.replace('err', 'card'))
    expect(docsmitSettingsFrom(rows)).toEqual(s)
    expect(docsmitSettingsFrom(docsmitSettingRows(DOCSMIT_SETTINGS_DEFAULT))).toEqual(DOCSMIT_SETTINGS_DEFAULT)
  })
})
