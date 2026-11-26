import { describe, expect, it } from 'vitest'
import { FORM_DELETE_REFUSED_WORDS, formDeleteHoldWords, formHoldsByForm, isFormHeldByJobs } from './formDeleteHold'

describe('formHoldsByForm (#389, the Form Studio’s Delete)', () => {
  it('counts the jobs that hold each form, a job once however many of its papers point at the form', () => {
    const holds = formHoldsByForm([
      { form_template_id: 'f1', job_id: 'j1' },
      { form_template_id: 'f1', job_id: 'j1' },
      { form_template_id: 'f1', job_id: 'j2' },
      { form_template_id: 'f2', job_id: 'j1' },
      { form_template_id: null, job_id: 'j3' },
    ])
    expect(holds.get('f1')).toBe(2)
    expect(holds.get('f2')).toBe(1)
    expect(holds.has('f3')).toBe(false)
    expect(formHoldsByForm([]).size).toBe(0)
  })
})

describe('formDeleteHoldWords', () => {
  it('says how many jobs keep the form, in whole words', () => {
    expect(formDeleteHoldWords(1)).toBe('1 job requires this form or once required it. Its record keeps it, so it stays.')
    expect(formDeleteHoldWords(3)).toBe('3 jobs require this form or once required it. Their records keep it, so it stays.')
  })
})

describe('isFormHeldByJobs', () => {
  it('reads the foreign-key refusal from job_required_papers, as a result’s error or an Error, and nothing else', () => {
    const message = 'update or delete on table "contract_form_templates" violates foreign key constraint "job_required_papers_form_template_id_fkey" on table "job_required_papers"'
    expect(isFormHeldByJobs({ code: '23503', message, details: 'Key is still referenced.' })).toBe(true)
    expect(isFormHeldByJobs(Object.assign(new Error(message), { code: '23503' }))).toBe(true)
    // Another table's hold, another code, or no code: not this refusal.
    expect(isFormHeldByJobs({ code: '23503', message: 'violates foreign key constraint "person_contract_documents_form_fkey" on table "person_contract_documents"' })).toBe(false)
    expect(isFormHeldByJobs({ code: '42501', message: 'permission denied for table job_required_papers' })).toBe(false)
    expect(isFormHeldByJobs(new Error(message))).toBe(false)
    expect(isFormHeldByJobs(null)).toBe(false)
    expect(isFormHeldByJobs('23503')).toBe(false)
    expect(FORM_DELETE_REFUSED_WORDS).toBe('The form stays. A job requires it or once required it, and that record keeps it.')
  })
})
