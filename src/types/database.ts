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
        Row: { id: string; master_user_id: string; name: string; address: string | null; contact_info: Json | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; master_user_id: string; name: string; address?: string | null; contact_info?: Json | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; master_user_id?: string; name?: string; address?: string | null; contact_info?: Json | null; created_at?: string | null; updated_at?: string | null }
      }
      projects: {
        Row: { id: string; customer_id: string; name: string; description: string | null; status: 'active' | 'completed' | 'on_hold'; housecallpro_number: string | null; plans_link: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; customer_id: string; name: string; description?: string | null; status?: 'active' | 'completed' | 'on_hold'; housecallpro_number?: string | null; plans_link?: string | null; created_at?: string | null; updated_at?: string | null }
        Update: { id?: string; customer_id?: string; name?: string; description?: string | null; status?: 'active' | 'completed' | 'on_hold'; housecallpro_number?: string | null; plans_link?: string | null; created_at?: string | null; updated_at?: string | null }
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
          created_at: string | null; updated_at: string | null;
          assigned_skill: string | null;
          notify_assigned_when_started: boolean | null; notify_assigned_when_complete: boolean | null; notify_assigned_when_reopened: boolean | null;
        }
        Insert: {
          id?: string; workflow_id: string; template_step_id?: string | null; sequence_order: number; name: string;
          step_type?: 'delivery' | 'count' | 'work' | 'inspection' | 'billing' | null;
          assigned_to_name?: string | null; inspector_name?: string | null;
          scheduled_start_date?: string | null; scheduled_end_date?: string | null;
          started_at?: string | null; ended_at?: string | null;
          status?: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'approved';
          inspection_notes?: string | null; rejection_reason?: string | null;
          created_at?: string | null; updated_at?: string | null;
          assigned_skill?: string | null;
          notify_when_started?: boolean | null; notify_when_complete?: boolean | null; notify_when_reopened?: boolean | null;
        }
        Update: {
          id?: string; workflow_id?: string; template_step_id?: string | null; sequence_order?: number; name?: string;
          step_type?: 'delivery' | 'count' | 'work' | 'inspection' | 'billing' | null;
          assigned_to_name?: string | null; inspector_name?: string | null;
          scheduled_start_date?: string | null; scheduled_end_date?: string | null;
          started_at?: string | null; ended_at?: string | null;
          status?: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'approved';
          inspection_notes?: string | null; rejection_reason?: string | null;
          created_at?: string | null; updated_at?: string | null;
          assigned_skill?: string | null;
          notify_when_started?: boolean | null; notify_when_complete?: boolean | null; notify_when_reopened?: boolean | null;
        }
      }
      step_subscriptions: {
        Row: { id: string; step_id: string; user_id: string; notify_when_started: boolean; notify_when_complete: boolean; notify_when_reopened: boolean; created_at: string | null }
        Insert: { id?: string; step_id: string; user_id: string; notify_when_started?: boolean; notify_when_complete?: boolean; notify_when_reopened?: boolean; created_at?: string | null }
        Update: { id?: string; step_id?: string; user_id?: string; notify_when_started?: boolean; notify_when_complete?: boolean; notify_when_reopened?: boolean; created_at?: string | null }
      }
    }
  }
}
