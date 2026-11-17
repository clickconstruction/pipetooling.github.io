import { describe, expect, it } from 'vitest'
import { ESTIMATE_EXPERIENCE_FIELD_MAX_LEN } from '../estimateCustomerExperience'
import { CX_FIELD_LABELS, CX_OVERRIDE_SECTIONS, cxFooterHidden, cxOverrideFieldRows, cxOverridesAfterEdit, cxWithFooterHidden, type CxOverrideFields } from './estimateCxOverrideSections'

describe('the override sections', () => {
  it('are Email, Acceptance page and Thank you, in the order of the previews', () => {
    expect(CX_OVERRIDE_SECTIONS.map((s) => s.title)).toEqual(['Email', 'Acceptance page', 'Thank you'])
  })

  it('give every field a label and put no field in two sections', () => {
    const keys = CX_OVERRIDE_SECTIONS.flatMap((s) => s.keys)
    expect(new Set(keys).size).toBe(keys.length)
    for (const k of keys) expect(CX_FIELD_LABELS[k].length).toBeGreaterThan(0)
  })

  it('leave the email subject out: the send builds it', () => {
    expect(CX_OVERRIDE_SECTIONS.flatMap((s) => s.keys)).not.toContain('email_subject_template')
    expect(CX_OVERRIDE_SECTIONS[0].keys).toEqual(['email_body_template'])
  })

  it('give the three long fields a tall box', () => {
    expect(cxOverrideFieldRows('email_body_template')).toBe(7)
    expect(cxOverrideFieldRows('thank_you_body')).toBe(7)
    expect(cxOverrideFieldRows('accept_page_footer')).toBe(7)
    expect(cxOverrideFieldRows('accept_submit_label')).toBe(2)
  })
})

describe('the footer’s empty override', () => {
  it('reads as hidden only when the override is there and empty', () => {
    expect(cxFooterHidden({})).toBe(false)
    expect(cxFooterHidden({ accept_page_footer: 'Our footer' })).toBe(false)
    expect(cxFooterHidden({ accept_page_footer: '' })).toBe(true)
  })

  it('hides with an empty override and shows again with none', () => {
    const hidden = cxWithFooterHidden({ thank_you_title: 'Thanks' }, true)
    expect(hidden).toEqual({ thank_you_title: 'Thanks', accept_page_footer: '' })
    expect(cxWithFooterHidden(hidden, false)).toEqual({ thank_you_title: 'Thanks' })
  })

  it('hiding replaces a typed footer, and showing again does not bring it back', () => {
    const hidden = cxWithFooterHidden({ accept_page_footer: 'Our footer' }, true)
    expect(hidden).toEqual({ accept_page_footer: '' })
    expect(cxWithFooterHidden(hidden, false)).toEqual({})
  })

  it('changes nothing when it is unticked with no override', () => {
    const prev: CxOverrideFields = { thank_you_title: 'Thanks' }
    expect(cxWithFooterHidden(prev, false)).toBe(prev)
  })
})

describe('cxOverridesAfterEdit', () => {
  it('keeps a real change', () => {
    expect(cxOverridesAfterEdit({}, 'thank_you_title', 'Thank you, neighbor', 'Thank you')).toEqual({ thank_you_title: 'Thank you, neighbor' })
  })

  it('drops a field that is cleared', () => {
    expect(cxOverridesAfterEdit({ thank_you_title: 'Thank you, neighbor' }, 'thank_you_title', '   ', 'Thank you')).toEqual({})
  })

  it('drops a field typed back to the organization’s default', () => {
    expect(cxOverridesAfterEdit({ thank_you_title: 'Thank you, neighbor', thank_you_body: 'x' }, 'thank_you_title', 'Thank you', 'Thank you')).toEqual({ thank_you_body: 'x' })
  })

  it('changes nothing when a field with no override is cleared or shows its default', () => {
    const prev: CxOverrideFields = { thank_you_body: 'x' }
    expect(cxOverridesAfterEdit(prev, 'thank_you_title', '', 'Thank you')).toBe(prev)
    expect(cxOverridesAfterEdit(prev, 'thank_you_title', 'Thank you', 'Thank you')).toBe(prev)
  })

  it('cuts text past the cap', () => {
    const long = 'a'.repeat(ESTIMATE_EXPERIENCE_FIELD_MAX_LEN + 50)
    expect(cxOverridesAfterEdit({}, 'email_body_template', long, 'Hello')).toEqual({ email_body_template: 'a'.repeat(ESTIMATE_EXPERIENCE_FIELD_MAX_LEN) })
  })

  it('clearing the footer’s box drops the override; it does not hide the footer', () => {
    expect(cxOverridesAfterEdit({ accept_page_footer: 'Our footer' }, 'accept_page_footer', '', 'Company footer')).toEqual({})
  })
})
