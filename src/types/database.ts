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
        Insert: { id?: string; master_user_id: string; name: string; address?: string | null; contact_info?: Json | null; date_met?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; master_user_id?: string; name?: string; address?: string | null; contact_info?: Json | null; date_met?: string | null; created_at?: string | null; updated_at?: string | null }
      }
      projects: {
        Row: { id: string; customer_id: string; master_user_id: string | null; name: string; description: string | null; status: 'awaiting_start' | 'active' | 'completed' | 'on_hold'; housecallpro_number: string | null; plans_link: string | null; street_name: string | null; project_type: string | null; address: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; customer_id: string; master_user_id?: string | null; name: string; description?: string | null; status?: 'awaiting_start' | 'active' | 'completed' | 'on_hold'; housecallpro_number?: string | null; plans_link?: string | null; street_name?: string | null; project_type?: string | null; address?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; customer_id?: string; master_user_id?: string | null; name?: string; description?: string | null; status?: 'awaiting_start' | 'active' | 'completed' | 'on_hold'; housecallpro_number?: string | null; plans_link?: string | null; street_name?: string | null; project_type?: string | null; address?: string | null; created_at?: string | null; updated_at?: string | null }
      }
      master_assistants: {
        Row: { master_id: string; assistant_id: string; created_at: string | null }
        Insert: { master_id: string; assistant_id: string; created_at?: string | null }
        Update: { master_id?: string; assistant_id?: string; created_at?: string | null }
      }
      master_shares: {
        Row: { sharing_master_id: string; viewing_master_id: string; created_at: string | null }
        Insert: { sharing_master_id: string; viewing_master_id: string; created_at?: string | null }
        Update: { sharing_master_id?: string; viewing_master_id?: string; created_at?: string | null }
      }
      project_workflows: {
        Row: { id: string; project_id: string; template_id: string | null; name: string; status: 'draft' | 'active' | 'completed'; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; project_id: string; template_id?: string | null; name: string; status?: 'draft' | 'active' | 'completed'; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; project_id?: string; name?: string; template_id?: string | null; status?: 'draft' | 'active' | 'completed'; created_at?: string | null; updated_at?: string | null }
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
      }
      step_subscriptions: {
        Row: { id: string; step_id: string; user_id: string; notify_when_started: boolean; notify_when_complete: boolean; notify_when_reopened: boolean; created_at: string | null }
        Insert: { id?: string; step_id: string; user_id: string; notify_when_started?: boolean; notify_when_complete?: boolean; notify_when_reopened?: boolean; created_at?: string | null }
        Update: { id?: string; step_id?: string; user_id?: string; notify_when_started?: boolean; notify_when_complete?: boolean; notify_when_reopened?: boolean; created_at?: string | null }
      }
      project_workflow_step_actions: {
        Row: { id: string; step_id: string; action_type: 'started' | 'completed' | 'approved' | 'rejected' | 'reopened'; performed_by: string; performed_at: string; notes: string | null; created_at: string | null }
        Insert: { id?: string; step_id: string; action_type: 'started' | 'completed' | 'approved' | 'rejected' | 'reopened'; performed_by: string; performed_at?: string; notes?: string | null; created_at?: string | null }
        Update: { id?: string; step_id?: string; action_type?: 'started' | 'completed' | 'approved' | 'rejected' | 'reopened'; performed_by?: string; performed_at?: string; notes?: string | null; created_at?: string | null }
      }
      workflow_step_line_items: {
        Row: { id: string; step_id: string; memo: string; amount: number; sequence_order: number; purchase_order_id: string | null; link: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; step_id: string; memo: string; amount: number; sequence_order?: number; purchase_order_id?: string | null; link?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; step_id?: string; memo?: string; amount?: number; sequence_order?: number; purchase_order_id?: string | null; link?: string | null; created_at?: string | null; updated_at?: string | null }
      }
      workflow_projections: {
        Row: { id: string; workflow_id: string; stage_name: string; memo: string; amount: number; sequence_order: number; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; workflow_id: string; stage_name: string; memo: string; amount: number; sequence_order?: number; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; workflow_id?: string; stage_name?: string; memo?: string; amount?: number; sequence_order?: number; created_at?: string | null; updated_at?: string | null }
      }
      supply_houses: {
        Row: { id: string; name: string; contact_name: string | null; phone: string | null; email: string | null; address: string | null; notes: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; name: string; contact_name?: string | null; phone?: string | null; email?: string | null; address?: string | null; notes?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; name?: string; contact_name?: string | null; phone?: string | null; email?: string | null; address?: string | null; notes?: string | null; created_at?: string | null; updated_at?: string | null }
      }
      material_parts: {
        Row: { id: string; name: string; manufacturer: string | null; fixture_type: string | null; notes: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; name: string; manufacturer?: string | null; fixture_type?: string | null; notes?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; name?: string; manufacturer?: string | null; fixture_type?: string | null; notes?: string | null; created_at?: string | null; updated_at?: string | null }
      }
      material_part_prices: {
        Row: { id: string; part_id: string; supply_house_id: string; price: number; effective_date: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; part_id: string; supply_house_id: string; price: number; effective_date?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; part_id?: string; supply_house_id?: string; price?: number; effective_date?: string | null; created_at?: string | null; updated_at?: string | null }
      }
      material_part_price_history: {
        Row: { id: string; part_id: string; supply_house_id: string; old_price: number | null; new_price: number; price_change_percent: number | null; effective_date: string | null; changed_at: string; changed_by: string | null; notes: string | null; created_at: string | null }
        Insert: { id?: string; part_id: string; supply_house_id: string; old_price?: number | null; new_price: number; price_change_percent?: number | null; effective_date?: string | null; changed_at?: string; changed_by?: string | null; notes?: string | null; created_at?: string | null }
        Update: { id?: string; part_id?: string; supply_house_id?: string; old_price?: number | null; new_price?: number; price_change_percent?: number | null; effective_date?: string | null; changed_at?: string; changed_by?: string | null; notes?: string | null; created_at?: string | null }
      }
      material_templates: {
        Row: { id: string; name: string; description: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; name: string; description?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; name?: string; description?: string | null; created_at?: string | null; updated_at?: string | null }
      }
      material_template_items: {
        Row: { id: string; template_id: string; item_type: 'part' | 'template'; part_id: string | null; nested_template_id: string | null; quantity: number; sequence_order: number; notes: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; template_id: string; item_type: 'part' | 'template'; part_id?: string | null; nested_template_id?: string | null; quantity?: number; sequence_order?: number; notes?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; template_id?: string; item_type?: 'part' | 'template'; part_id?: string | null; nested_template_id?: string | null; quantity?: number; sequence_order?: number; notes?: string | null; created_at?: string | null; updated_at?: string | null }
      }
      purchase_orders: {
        Row: { id: string; name: string; status: 'draft' | 'finalized'; created_by: string; finalized_at: string | null; notes: string | null; notes_added_by: string | null; notes_added_at: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; name: string; status?: 'draft' | 'finalized'; created_by: string; finalized_at?: string | null; notes?: string | null; notes_added_by?: string | null; notes_added_at?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; name?: string; status?: 'draft' | 'finalized'; created_by?: string; finalized_at?: string | null; notes?: string | null; notes_added_by?: string | null; notes_added_at?: string | null; created_at?: string | null; updated_at?: string | null }
      }
      purchase_order_items: {
        Row: { id: string; purchase_order_id: string; part_id: string; quantity: number; selected_supply_house_id: string | null; price_at_time: number; sequence_order: number; notes: string | null; price_confirmed_at: string | null; price_confirmed_by: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; purchase_order_id: string; part_id: string; quantity?: number; selected_supply_house_id?: string | null; price_at_time: number; sequence_order?: number; notes?: string | null; price_confirmed_at?: string | null; price_confirmed_by?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; purchase_order_id?: string; part_id?: string; quantity?: number; selected_supply_house_id?: string | null; price_at_time?: number; sequence_order?: number; notes?: string | null; price_confirmed_at?: string | null; price_confirmed_by?: string | null; created_at?: string | null; updated_at?: string | null }
      }
    }
  }
}
