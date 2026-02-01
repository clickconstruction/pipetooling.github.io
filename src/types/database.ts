export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: { id: string; master_user_id: string; name: string; address: string | null; contact_info: Json | null; date_met: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; master_user_id?: string | null; name: string; address?: string | null; contact_info?: Json | null; date_met?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; master_user_id?: string | null; name?: string; address?: string | null; contact_info?: Json | null; date_met?: string | null; created_at?: string | null; updated_at?: string | null }
        Relationships: []
      }
      email_templates: {
        Row: { id: string; template_type: string; subject: string; body: string; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; template_type: string; subject: string; body: string; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; template_type?: string; subject?: string; body?: string; created_at?: string | null; updated_at?: string | null }
        Relationships: []
      }
      users: {
        Row: { id: string; name: string | null; email: string | null; role: string | null; last_sign_in_at: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; name?: string | null; email?: string | null; role?: string | null; last_sign_in_at?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; name?: string | null; email?: string | null; role?: string | null; last_sign_in_at?: string | null; created_at?: string | null; updated_at?: string | null }
        Relationships: []
      }
      projects: {
        Row: { id: string; customer_id: string; master_user_id: string | null; name: string; description: string | null; status: 'awaiting_start' | 'active' | 'completed' | 'on_hold'; housecallpro_number: string | null; plans_link: string | null; street_name: string | null; project_type: string | null; address: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; customer_id: string; master_user_id?: string | null; name: string; description?: string | null; status?: 'awaiting_start' | 'active' | 'completed' | 'on_hold'; housecallpro_number?: string | null; plans_link?: string | null; street_name?: string | null; project_type?: string | null; address?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; customer_id?: string; master_user_id?: string | null; name?: string; description?: string | null; status?: 'awaiting_start' | 'active' | 'completed' | 'on_hold'; housecallpro_number?: string | null; plans_link?: string | null; street_name?: string | null; project_type?: string | null; address?: string | null; created_at?: string | null; updated_at?: string | null }
        Relationships: []
      }
      master_assistants: {
        Row: { master_id: string; assistant_id: string; created_at: string | null }
        Insert: { master_id: string; assistant_id: string; created_at?: string | null }
        Update: { master_id?: string; assistant_id?: string; created_at?: string | null }
        Relationships: []
      }
      master_shares: {
        Row: { sharing_master_id: string; viewing_master_id: string; created_at: string | null }
        Insert: { sharing_master_id: string; viewing_master_id: string; created_at?: string | null }
        Update: { sharing_master_id?: string; viewing_master_id?: string; created_at?: string | null }
        Relationships: []
      }
      people: {
        Row: { id: string; master_user_id: string; kind: string; name: string; email: string | null; phone: string | null; notes: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; master_user_id: string; kind: string; name: string; email?: string | null; phone?: string | null; notes?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; master_user_id?: string; kind?: string; name?: string; email?: string | null; phone?: string | null; notes?: string | null; created_at?: string | null; updated_at?: string | null }
        Relationships: []
      }
      project_workflows: {
        Row: { id: string; project_id: string; template_id: string | null; name: string; status: 'draft' | 'active' | 'completed'; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; project_id: string; template_id?: string | null; name: string; status?: 'draft' | 'active' | 'completed'; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; project_id?: string; name?: string; template_id?: string | null; status?: 'draft' | 'active' | 'completed'; created_at?: string | null; updated_at?: string | null }
        Relationships: []
      }
      project_workflow_steps: {
        Row: {
          id: string; workflow_id: string; template_step_id: string | null; sequence_order: number; name: string;
          step_type: 'delivery' | 'count' | 'work' | 'inspection' | 'billing' | null;
          assigned_to_name: string | null; inspector_name: string | null;
          scheduled_start_date: string | null; scheduled_end_date: string | null;
          started_at: string | null; ended_at: string | null;
          status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'approved';
          inspection_notes: string | null; rejection_reason: string | null;
          notes: string | null; private_notes: string | null;
          created_at: string | null; updated_at: string | null;
          assigned_skill: string | null;
          notify_assigned_when_started: boolean | null; notify_assigned_when_complete: boolean | null; notify_assigned_when_reopened: boolean | null;
          notify_next_assignee_when_complete_or_approved: boolean | null; notify_prior_assignee_when_rejected: boolean | null;
          approved_by: string | null; approved_at: string | null;
          next_step_rejected_notice: string | null;
          next_step_rejection_reason: string | null;
        }
        Insert: {
          id?: string; workflow_id: string; template_step_id?: string | null; sequence_order: number; name: string;
          step_type?: 'delivery' | 'count' | 'work' | 'inspection' | 'billing' | null;
          assigned_to_name?: string | null; inspector_name?: string | null;
          scheduled_start_date?: string | null; scheduled_end_date?: string | null;
          started_at?: string | null; ended_at?: string | null;
          status?: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'approved';
          inspection_notes?: string | null; rejection_reason?: string | null;
          notes?: string | null; private_notes?: string | null;
          created_at?: string | null; updated_at?: string | null;
          assigned_skill?: string | null;
          notify_when_started?: boolean | null; notify_when_complete?: boolean | null; notify_when_reopened?: boolean | null;
          notify_next_assignee_when_complete_or_approved?: boolean | null; notify_prior_assignee_when_rejected?: boolean | null;
          approved_by?: string | null; approved_at?: string | null;
          next_step_rejected_notice?: string | null;
          next_step_rejection_reason?: string | null;
        }
        Update: {
          id?: string; workflow_id?: string; template_step_id?: string | null; sequence_order?: number; name?: string;
          step_type?: 'delivery' | 'count' | 'work' | 'inspection' | 'billing' | null;
          assigned_to_name?: string | null; inspector_name?: string | null;
          scheduled_start_date?: string | null; scheduled_end_date?: string | null;
          started_at?: string | null; ended_at?: string | null;
          status?: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'approved';
          inspection_notes?: string | null; rejection_reason?: string | null;
          notes?: string | null; private_notes?: string | null;
          created_at?: string | null; updated_at?: string | null;
          assigned_skill?: string | null;
          notify_when_started?: boolean | null; notify_when_complete?: boolean | null; notify_when_reopened?: boolean | null;
          notify_next_assignee_when_complete_or_approved?: boolean | null; notify_prior_assignee_when_rejected?: boolean | null;
          approved_by?: string | null; approved_at?: string | null;
          next_step_rejected_notice?: string | null;
          next_step_rejection_reason?: string | null;
        }
        Relationships: []
      }
      step_subscriptions: {
        Row: { id: string; step_id: string; user_id: string; notify_when_started: boolean; notify_when_complete: boolean; notify_when_reopened: boolean; created_at: string | null }
        Insert: { id?: string; step_id: string; user_id: string; notify_when_started?: boolean; notify_when_complete?: boolean; notify_when_reopened?: boolean; created_at?: string | null }
        Update: { id?: string; step_id?: string; user_id?: string; notify_when_started?: boolean; notify_when_complete?: boolean; notify_when_reopened?: boolean; created_at?: string | null }
        Relationships: []
      }
      project_workflow_step_actions: {
        Row: { id: string; step_id: string; action_type: 'started' | 'completed' | 'approved' | 'rejected' | 'reopened'; performed_by: string; performed_at: string; notes: string | null; created_at: string | null }
        Insert: { id?: string; step_id: string; action_type: 'started' | 'completed' | 'approved' | 'rejected' | 'reopened'; performed_by: string; performed_at?: string; notes?: string | null; created_at?: string | null }
        Update: { id?: string; step_id?: string; action_type?: 'started' | 'completed' | 'approved' | 'rejected' | 'reopened'; performed_by?: string; performed_at?: string; notes?: string | null; created_at?: string | null }
        Relationships: []
      }
      workflow_step_line_items: {
        Row: { id: string; step_id: string; memo: string; amount: number; sequence_order: number; purchase_order_id: string | null; link: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; step_id: string; memo: string; amount: number; sequence_order?: number; purchase_order_id?: string | null; link?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; step_id?: string; memo?: string; amount?: number; sequence_order?: number; purchase_order_id?: string | null; link?: string | null; created_at?: string | null; updated_at?: string | null }
        Relationships: []
      }
      workflow_projections: {
        Row: { id: string; workflow_id: string; stage_name: string; memo: string; amount: number; sequence_order: number; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; workflow_id: string; stage_name: string; memo: string; amount: number; sequence_order?: number; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; workflow_id?: string; stage_name?: string; memo?: string; amount?: number; sequence_order?: number; created_at?: string | null; updated_at?: string | null }
        Relationships: []
      }
      workflow_step_dependencies: {
        Row: { step_id: string; depends_on_step_id: string }
        Insert: { step_id: string; depends_on_step_id: string }
        Update: { step_id?: string; depends_on_step_id?: string }
        Relationships: []
      }
      workflow_templates: {
        Row: { id: string; name: string; description: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; name: string; description?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; name?: string; description?: string | null; created_at?: string | null; updated_at?: string | null }
        Relationships: []
      }
      workflow_template_steps: {
        Row: { id: string; template_id: string; sequence_order: number; name: string; step_type: 'delivery' | 'count' | 'work' | 'inspection' | 'billing' | null; required_skill: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; template_id: string; sequence_order: number; name: string; step_type?: 'delivery' | 'count' | 'work' | 'inspection' | 'billing' | null; required_skill?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; template_id?: string; sequence_order?: number; name?: string; step_type?: 'delivery' | 'count' | 'work' | 'inspection' | 'billing' | null; required_skill?: string | null; created_at?: string | null; updated_at?: string | null }
        Relationships: []
      }
      supply_houses: {
        Row: { id: string; name: string; contact_name: string | null; phone: string | null; email: string | null; address: string | null; notes: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; name: string; contact_name?: string | null; phone?: string | null; email?: string | null; address?: string | null; notes?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; name?: string; contact_name?: string | null; phone?: string | null; email?: string | null; address?: string | null; notes?: string | null; created_at?: string | null; updated_at?: string | null }
        Relationships: []
      }
      material_parts: {
        Row: { id: string; name: string; manufacturer: string | null; fixture_type: string | null; notes: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; name: string; manufacturer?: string | null; fixture_type?: string | null; notes?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; name?: string; manufacturer?: string | null; fixture_type?: string | null; notes?: string | null; created_at?: string | null; updated_at?: string | null }
        Relationships: []
      }
      material_part_prices: {
        Row: { id: string; part_id: string; supply_house_id: string; price: number; effective_date: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; part_id: string; supply_house_id: string; price: number; effective_date?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; part_id?: string; supply_house_id?: string; price?: number; effective_date?: string | null; created_at?: string | null; updated_at?: string | null }
        Relationships: []
      }
      material_part_price_history: {
        Row: { id: string; part_id: string; supply_house_id: string; old_price: number | null; new_price: number; price_change_percent: number | null; effective_date: string | null; changed_at: string; changed_by: string | null; notes: string | null; created_at: string | null }
        Insert: { id?: string; part_id: string; supply_house_id: string; old_price?: number | null; new_price: number; price_change_percent?: number | null; effective_date?: string | null; changed_at?: string; changed_by?: string | null; notes?: string | null; created_at?: string | null }
        Update: { id?: string; part_id?: string; supply_house_id?: string; old_price?: number | null; new_price?: number; price_change_percent?: number | null; effective_date?: string | null; changed_at?: string; changed_by?: string | null; notes?: string | null; created_at?: string | null }
        Relationships: []
      }
      material_templates: {
        Row: { id: string; name: string; description: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; name: string; description?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; name?: string; description?: string | null; created_at?: string | null; updated_at?: string | null }
        Relationships: []
      }
      material_template_items: {
        Row: { id: string; template_id: string; item_type: 'part' | 'template'; part_id: string | null; nested_template_id: string | null; quantity: number; sequence_order: number; notes: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; template_id: string; item_type: 'part' | 'template'; part_id?: string | null; nested_template_id?: string | null; quantity?: number; sequence_order?: number; notes?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; template_id?: string; item_type?: 'part' | 'template'; part_id?: string | null; nested_template_id?: string | null; quantity?: number; sequence_order?: number; notes?: string | null; created_at?: string | null; updated_at?: string | null }
        Relationships: []
      }
      purchase_orders: {
        Row: { id: string; name: string; status: 'draft' | 'finalized'; created_by: string; finalized_at: string | null; notes: string | null; notes_added_by: string | null; notes_added_at: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; name: string; status?: 'draft' | 'finalized'; created_by: string; finalized_at?: string | null; notes?: string | null; notes_added_by?: string | null; notes_added_at?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; name?: string; status?: 'draft' | 'finalized'; created_by?: string; finalized_at?: string | null; notes?: string | null; notes_added_by?: string | null; notes_added_at?: string | null; created_at?: string | null; updated_at?: string | null }
        Relationships: []
      }
      purchase_order_items: {
        Row: { id: string; purchase_order_id: string; part_id: string; quantity: number; selected_supply_house_id: string | null; price_at_time: number; sequence_order: number; notes: string | null; source_template_id: string | null; price_confirmed_at: string | null; price_confirmed_by: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; purchase_order_id: string; part_id: string; quantity?: number; selected_supply_house_id?: string | null; price_at_time: number; sequence_order?: number; notes?: string | null; source_template_id?: string | null; price_confirmed_at?: string | null; price_confirmed_by?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; purchase_order_id?: string; part_id?: string; quantity?: number; selected_supply_house_id?: string | null; price_at_time?: number; sequence_order?: number; notes?: string | null; source_template_id?: string | null; price_confirmed_at?: string | null; price_confirmed_by?: string | null; created_at?: string | null; updated_at?: string | null }
        Relationships: []
      }
      bids_gc_builders: {
        Row: { id: string; name: string; address: string | null; contact_number: string | null; email: string | null; notes: string | null; created_by: string; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; name: string; address?: string | null; contact_number?: string | null; email?: string | null; notes?: string | null; created_by: string; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; name?: string; address?: string | null; contact_number?: string | null; email?: string | null; notes?: string | null; created_by?: string; created_at?: string | null; updated_at?: string | null }
        Relationships: []
      }
      bids: {
        Row: { id: string; drive_link: string | null; plans_link: string | null; gc_builder_id: string | null; customer_id: string | null; project_name: string | null; address: string | null; gc_contact_name: string | null; gc_contact_phone: string | null; gc_contact_email: string | null; estimator_id: string | null; bid_due_date: string | null; estimated_job_start_date: string | null; bid_date_sent: string | null; outcome: 'won' | 'lost' | null; bid_value: number | null; agreed_value: number | null; profit: number | null; distance_from_office: string | null; last_contact: string | null; notes: string | null; created_by: string; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; drive_link?: string | null; plans_link?: string | null; gc_builder_id?: string | null; customer_id?: string | null; project_name?: string | null; address?: string | null; gc_contact_name?: string | null; gc_contact_phone?: string | null; gc_contact_email?: string | null; estimator_id?: string | null; bid_due_date?: string | null; estimated_job_start_date?: string | null; bid_date_sent?: string | null; outcome?: 'won' | 'lost' | null; bid_value?: number | null; agreed_value?: number | null; profit?: number | null; distance_from_office?: string | null; last_contact?: string | null; notes?: string | null; created_by: string; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; drive_link?: string | null; plans_link?: string | null; gc_builder_id?: string | null; customer_id?: string | null; project_name?: string | null; address?: string | null; gc_contact_name?: string | null; gc_contact_phone?: string | null; gc_contact_email?: string | null; estimator_id?: string | null; bid_due_date?: string | null; estimated_job_start_date?: string | null; bid_date_sent?: string | null; outcome?: 'won' | 'lost' | null; bid_value?: number | null; agreed_value?: number | null; profit?: number | null; distance_from_office?: string | null; last_contact?: string | null; notes?: string | null; created_by?: string; created_at?: string | null; updated_at?: string | null }
        Relationships: []
      }
      bids_count_rows: {
        Row: { id: string; bid_id: string; fixture: string; count: number; page: string | null; sequence_order: number; created_at: string | null }
        Insert: { id?: string; bid_id: string; fixture: string; count?: number; page?: string | null; sequence_order?: number; created_at?: string | null }
        Update: { id?: string; bid_id?: string; fixture?: string; count?: number; page?: string | null; sequence_order?: number; created_at?: string | null }
        Relationships: []
      }
      bids_submission_entries: {
        Row: { id: string; bid_id: string; contact_method: string | null; notes: string | null; occurred_at: string; created_at: string | null }
        Insert: { id?: string; bid_id: string; contact_method?: string | null; notes?: string | null; occurred_at?: string; created_at?: string | null }
        Update: { id?: string; bid_id?: string; contact_method?: string | null; notes?: string | null; occurred_at?: string; created_at?: string | null }
        Relationships: []
      }
      cost_estimates: {
        Row: { id: string; bid_id: string; purchase_order_id_rough_in: string | null; purchase_order_id_top_out: string | null; purchase_order_id_trim_set: string | null; labor_rate: number | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; bid_id: string; purchase_order_id_rough_in?: string | null; purchase_order_id_top_out?: string | null; purchase_order_id_trim_set?: string | null; labor_rate?: number | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; bid_id?: string; purchase_order_id_rough_in?: string | null; purchase_order_id_top_out?: string | null; purchase_order_id_trim_set?: string | null; labor_rate?: number | null; created_at?: string | null; updated_at?: string | null }
        Relationships: []
      }
      cost_estimate_labor_rows: {
        Row: { id: string; cost_estimate_id: string; fixture: string; count: number; rough_in_hrs_per_unit: number; top_out_hrs_per_unit: number; trim_set_hrs_per_unit: number; sequence_order: number; created_at: string | null }
        Insert: { id?: string; cost_estimate_id: string; fixture: string; count?: number; rough_in_hrs_per_unit?: number; top_out_hrs_per_unit?: number; trim_set_hrs_per_unit?: number; sequence_order?: number; created_at?: string | null }
        Update: { id?: string; cost_estimate_id?: string; fixture?: string; count?: number; rough_in_hrs_per_unit?: number; top_out_hrs_per_unit?: number; trim_set_hrs_per_unit?: number; sequence_order?: number; created_at?: string | null }
        Relationships: []
      }
      fixture_labor_defaults: {
        Row: { fixture: string; rough_in_hrs: number; top_out_hrs: number; trim_set_hrs: number }
        Insert: { fixture: string; rough_in_hrs?: number; top_out_hrs?: number; trim_set_hrs?: number }
        Update: { fixture?: string; rough_in_hrs?: number; top_out_hrs?: number; trim_set_hrs?: number }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      claim_dev_with_code: { Args: { code_input: string }; Returns: unknown }
      convert_master_user: { Args: { old_master_id: string; new_master_id: string; new_role: string; auto_adopt: boolean }; Returns: unknown }
      touch_last_sign_in: { Args: Record<string, never>; Returns: unknown }
    }
  }
}
