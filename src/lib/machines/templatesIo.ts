/**
 * Equipment pre-use check (punch list #270): the templates the office edits at Settings, a kind of machine at a size
 * with its gauges and the questions its walk asks, and the questions every machine gets. Reads and writes only; the
 * editor's rules are in the card.
 */
import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import type { LevelDef, MachineKind, MachineQuestion } from './machines'
import { questionFromRow, templateFromRow, type MachineTemplate } from './machinesIo'

export interface TemplatesRead {
  templates: MachineTemplate[]
  /** Every machine's, each template's and the leaving check's; a machine's own are not here. */
  questions: MachineQuestion[]
}

export interface TemplatesIo {
  load(): Promise<TemplatesRead>
  saveTemplate(t: { id: string | null; name: string; kind: MachineKind; size: MachineTemplate['size']; levels: LevelDef[]; sort: number }): Promise<string>
  retireTemplate(id: string): Promise<void>
  /** The questions for one owner, in order: every machine's (templateId null) or a template's. Rows gone are made inactive, rows new are inserted. */
  saveQuestions(templateId: string | null, rows: { id: string | null; words: string; holdsMachine: boolean; when: MachineQuestion['when'] }[]): Promise<void>
}

export function supabaseTemplatesIo(): TemplatesIo {
  return {
    async load() {
      const [templates, questions] = await Promise.all([
        supabase.from('machine_templates').select('*').eq('active', true).order('sort', { ascending: true }),
        supabase.from('machine_check_questions').select('*').eq('active', true).is('vehicle_id', null).order('sort', { ascending: true }),
      ])
      if (templates.error) throw templates.error
      if (questions.error) throw questions.error
      return { templates: (templates.data ?? []).map(templateFromRow), questions: (questions.data ?? []).map(questionFromRow) }
    },
    async saveTemplate(t) {
      const row: Database['public']['Tables']['machine_templates']['Insert'] = { name: t.name.trim(), machine_kind: t.kind, size: t.size, levels: t.levels as unknown as Database['public']['Tables']['machine_templates']['Insert']['levels'], sort: t.sort, updated_at: new Date().toISOString() }
      if (t.id) {
        const { error } = await supabase.from('machine_templates').update(row).eq('id', t.id)
        if (error) throw error
        return t.id
      }
      const { data, error } = await supabase.from('machine_templates').insert(row).select('id').single()
      if (error) throw error
      return data.id
    },
    async retireTemplate(id) {
      const { error } = await supabase.from('machine_templates').update({ active: false, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    async saveQuestions(templateId, rows) {
      let have = supabase.from('machine_check_questions').select('id').eq('active', true).is('vehicle_id', null)
      have = templateId ? have.eq('template_id', templateId) : have.is('template_id', null)
      const { data: existing, error } = await have
      if (error) throw error
      const keep = new Set(rows.map((r) => r.id).filter((x): x is string => Boolean(x)))
      const gone = (existing ?? []).map((r) => r.id).filter((id) => !keep.has(id))
      if (gone.length) {
        const { error: off } = await supabase.from('machine_check_questions').update({ active: false }).in('id', gone)
        if (off) throw off
      }
      for (const [i, r] of rows.entries()) {
        const fields = { words: r.words.trim(), holds_machine: r.holdsMachine, asked_on: r.when, sort: (i + 1) * 10, active: true }
        if (r.id) {
          const { error: up } = await supabase.from('machine_check_questions').update(fields).eq('id', r.id)
          if (up) throw up
        } else {
          const { error: ins } = await supabase.from('machine_check_questions').insert({ ...fields, template_id: templateId, vehicle_id: null })
          if (ins) throw ins
        }
      }
    },
  }
}
