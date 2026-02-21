export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          value_num: number | null
        }
        Insert: {
          key: string
          value_num?: number | null
        }
        Update: {
          key?: string
          value_num?: number | null
        }
        Relationships: []
      }
      assembly_types: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          name: string
          sequence_order: number
          service_type_id: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          name: string
          sequence_order?: number
          service_type_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          name?: string
          sequence_order?: number
          service_type_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assembly_types_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_pricing_assignments: {
        Row: {
          bid_id: string
          count_row_id: string
          created_at: string | null
          id: string
          is_fixed_price: boolean
          price_book_entry_id: string
          price_book_version_id: string
        }
        Insert: {
          bid_id: string
          count_row_id: string
          created_at?: string | null
          id?: string
          is_fixed_price?: boolean
          price_book_entry_id: string
          price_book_version_id: string
        }
        Update: {
          bid_id?: string
          count_row_id?: string
          created_at?: string | null
          id?: string
          is_fixed_price?: boolean
          price_book_entry_id?: string
          price_book_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_pricing_assignments_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_pricing_assignments_count_row_id_fkey"
            columns: ["count_row_id"]
            isOneToOne: false
            referencedRelation: "bids_count_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_pricing_assignments_price_book_entry_id_fkey"
            columns: ["price_book_entry_id"]
            isOneToOne: false
            referencedRelation: "price_book_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_pricing_assignments_price_book_version_id_fkey"
            columns: ["price_book_version_id"]
            isOneToOne: false
            referencedRelation: "price_book_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      bids: {
        Row: {
          account_manager_id: string | null
          address: string | null
          agreed_value: number | null
          bid_date_sent: string | null
          bid_due_date: string | null
          bid_submission_link: string | null
          bid_value: number | null
          created_at: string | null
          created_by: string
          customer_id: string | null
          design_drawing_plan_date: string | null
          distance_from_office: string | null
          drive_link: string | null
          estimated_job_start_date: string | null
          estimator_id: string | null
          gc_builder_id: string | null
          gc_contact_email: string | null
          gc_contact_name: string | null
          gc_contact_phone: string | null
          id: string
          last_contact: string | null
          loss_reason: string | null
          notes: string | null
          outcome: string | null
          plans_link: string | null
          profit: number | null
          project_name: string | null
          selected_labor_book_version_id: string | null
          selected_price_book_version_id: string | null
          selected_takeoff_book_version_id: string | null
          service_type_id: string
          updated_at: string | null
        }
        Insert: {
          account_manager_id?: string | null
          address?: string | null
          agreed_value?: number | null
          bid_date_sent?: string | null
          bid_due_date?: string | null
          bid_submission_link?: string | null
          bid_value?: number | null
          created_at?: string | null
          created_by: string
          customer_id?: string | null
          design_drawing_plan_date?: string | null
          distance_from_office?: string | null
          drive_link?: string | null
          estimated_job_start_date?: string | null
          estimator_id?: string | null
          gc_builder_id?: string | null
          gc_contact_email?: string | null
          gc_contact_name?: string | null
          gc_contact_phone?: string | null
          id?: string
          last_contact?: string | null
          loss_reason?: string | null
          notes?: string | null
          outcome?: string | null
          plans_link?: string | null
          profit?: number | null
          project_name?: string | null
          selected_labor_book_version_id?: string | null
          selected_price_book_version_id?: string | null
          selected_takeoff_book_version_id?: string | null
          service_type_id: string
          updated_at?: string | null
        }
        Update: {
          account_manager_id?: string | null
          address?: string | null
          agreed_value?: number | null
          bid_date_sent?: string | null
          bid_due_date?: string | null
          bid_submission_link?: string | null
          bid_value?: number | null
          created_at?: string | null
          created_by?: string
          customer_id?: string | null
          design_drawing_plan_date?: string | null
          distance_from_office?: string | null
          drive_link?: string | null
          estimated_job_start_date?: string | null
          estimator_id?: string | null
          gc_builder_id?: string | null
          gc_contact_email?: string | null
          gc_contact_name?: string | null
          gc_contact_phone?: string | null
          id?: string
          last_contact?: string | null
          loss_reason?: string | null
          notes?: string | null
          outcome?: string | null
          plans_link?: string | null
          profit?: number | null
          project_name?: string | null
          selected_labor_book_version_id?: string | null
          selected_price_book_version_id?: string | null
          selected_takeoff_book_version_id?: string | null
          service_type_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bids_account_manager_id_fkey"
            columns: ["account_manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_estimator_id_fkey"
            columns: ["estimator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_gc_builder_id_fkey"
            columns: ["gc_builder_id"]
            isOneToOne: false
            referencedRelation: "bids_gc_builders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_selected_labor_book_version_id_fkey"
            columns: ["selected_labor_book_version_id"]
            isOneToOne: false
            referencedRelation: "labor_book_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_selected_price_book_version_id_fkey"
            columns: ["selected_price_book_version_id"]
            isOneToOne: false
            referencedRelation: "price_book_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_selected_takeoff_book_version_id_fkey"
            columns: ["selected_takeoff_book_version_id"]
            isOneToOne: false
            referencedRelation: "takeoff_book_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      bids_count_rows: {
        Row: {
          bid_id: string
          count: number
          created_at: string | null
          fixture: string
          id: string
          page: string | null
          sequence_order: number
        }
        Insert: {
          bid_id: string
          count?: number
          created_at?: string | null
          fixture: string
          id?: string
          page?: string | null
          sequence_order?: number
        }
        Update: {
          bid_id?: string
          count?: number
          created_at?: string | null
          fixture?: string
          id?: string
          page?: string | null
          sequence_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "bids_count_rows_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
        ]
      }
      bids_gc_builders: {
        Row: {
          address: string | null
          contact_number: string | null
          created_at: string | null
          created_by: string
          email: string | null
          id: string
          name: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_number?: string | null
          created_at?: string | null
          created_by: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_number?: string | null
          created_at?: string | null
          created_by?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bids_gc_builders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bids_submission_entries: {
        Row: {
          bid_id: string
          contact_method: string | null
          created_at: string | null
          id: string
          notes: string | null
          occurred_at: string
        }
        Insert: {
          bid_id: string
          contact_method?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
        }
        Update: {
          bid_id?: string
          contact_method?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bids_submission_entries_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
        ]
      }
      bids_takeoff_template_mappings: {
        Row: {
          bid_id: string
          count_row_id: string
          created_at: string | null
          id: string
          quantity: number
          sequence_order: number
          stage: string
          template_id: string
          updated_at: string | null
        }
        Insert: {
          bid_id: string
          count_row_id: string
          created_at?: string | null
          id?: string
          quantity?: number
          sequence_order?: number
          stage: string
          template_id: string
          updated_at?: string | null
        }
        Update: {
          bid_id?: string
          count_row_id?: string
          created_at?: string | null
          id?: string
          quantity?: number
          sequence_order?: number
          stage?: string
          template_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bids_takeoff_template_mappings_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_takeoff_template_mappings_count_row_id_fkey"
            columns: ["count_row_id"]
            isOneToOne: false
            referencedRelation: "bids_count_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_takeoff_template_mappings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "material_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_instances: {
        Row: {
          assigned_to_user_id: string
          checklist_item_id: string
          completed_at: string | null
          completed_by_user_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          scheduled_date: string
        }
        Insert: {
          assigned_to_user_id: string
          checklist_item_id: string
          completed_at?: string | null
          completed_by_user_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          scheduled_date: string
        }
        Update: {
          assigned_to_user_id?: string
          checklist_item_id?: string
          completed_at?: string | null
          completed_by_user_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          scheduled_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_instances_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_instances_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_instances_completed_by_user_id_fkey"
            columns: ["completed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          assigned_to_user_id: string
          created_at: string | null
          created_by_user_id: string
          id: string
          notify_creator_on_complete: boolean
          notify_on_complete_user_id: string | null
          reminder_scope: string | null
          reminder_time: string | null
          repeat_days_after: number | null
          repeat_days_of_week: number[] | null
          repeat_end_date: string | null
          repeat_type: string
          show_until_completed: boolean
          start_date: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to_user_id: string
          created_at?: string | null
          created_by_user_id: string
          id?: string
          notify_creator_on_complete?: boolean
          notify_on_complete_user_id?: string | null
          reminder_scope?: string | null
          reminder_time?: string | null
          repeat_days_after?: number | null
          repeat_days_of_week?: number[] | null
          repeat_end_date?: string | null
          repeat_type: string
          show_until_completed?: boolean
          start_date: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to_user_id?: string
          created_at?: string | null
          created_by_user_id?: string
          id?: string
          notify_creator_on_complete?: boolean
          notify_on_complete_user_id?: string | null
          reminder_scope?: string | null
          reminder_time?: string | null
          repeat_days_after?: number | null
          repeat_days_of_week?: number[] | null
          repeat_end_date?: string | null
          repeat_type?: string
          show_until_completed?: boolean
          start_date?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_notify_on_complete_user_id_fkey"
            columns: ["notify_on_complete_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_estimate_labor_rows: {
        Row: {
          cost_estimate_id: string
          count: number
          created_at: string | null
          fixture: string
          id: string
          is_fixed: boolean
          rough_in_hrs_per_unit: number
          sequence_order: number
          top_out_hrs_per_unit: number
          trim_set_hrs_per_unit: number
        }
        Insert: {
          cost_estimate_id: string
          count?: number
          created_at?: string | null
          fixture: string
          id?: string
          is_fixed?: boolean
          rough_in_hrs_per_unit?: number
          sequence_order?: number
          top_out_hrs_per_unit?: number
          trim_set_hrs_per_unit?: number
        }
        Update: {
          cost_estimate_id?: string
          count?: number
          created_at?: string | null
          fixture?: string
          id?: string
          is_fixed?: boolean
          rough_in_hrs_per_unit?: number
          sequence_order?: number
          top_out_hrs_per_unit?: number
          trim_set_hrs_per_unit?: number
        }
        Relationships: [
          {
            foreignKeyName: "cost_estimate_labor_rows_cost_estimate_id_fkey"
            columns: ["cost_estimate_id"]
            isOneToOne: false
            referencedRelation: "cost_estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_estimates: {
        Row: {
          bid_id: string
          created_at: string | null
          driving_cost_rate: number | null
          estimator_cost_flat_amount: number | null
          estimator_cost_per_count: number | null
          hours_per_trip: number | null
          id: string
          labor_rate: number | null
          purchase_order_id_rough_in: string | null
          purchase_order_id_top_out: string | null
          purchase_order_id_trim_set: string | null
          updated_at: string | null
        }
        Insert: {
          bid_id: string
          created_at?: string | null
          driving_cost_rate?: number | null
          estimator_cost_flat_amount?: number | null
          estimator_cost_per_count?: number | null
          hours_per_trip?: number | null
          id?: string
          labor_rate?: number | null
          purchase_order_id_rough_in?: string | null
          purchase_order_id_top_out?: string | null
          purchase_order_id_trim_set?: string | null
          updated_at?: string | null
        }
        Update: {
          bid_id?: string
          created_at?: string | null
          driving_cost_rate?: number | null
          estimator_cost_flat_amount?: number | null
          estimator_cost_per_count?: number | null
          hours_per_trip?: number | null
          id?: string
          labor_rate?: number | null
          purchase_order_id_rough_in?: string | null
          purchase_order_id_top_out?: string | null
          purchase_order_id_trim_set?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_estimates_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: true
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_estimates_purchase_order_id_rough_in_fkey"
            columns: ["purchase_order_id_rough_in"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_estimates_purchase_order_id_top_out_fkey"
            columns: ["purchase_order_id_top_out"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_estimates_purchase_order_id_trim_set_fkey"
            columns: ["purchase_order_id_trim_set"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_matrix_teams_shares: {
        Row: {
          shared_with_user_id: string
        }
        Insert: {
          shared_with_user_id: string
        }
        Update: {
          shared_with_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_matrix_teams_shares_shared_with_user_id_fkey"
            columns: ["shared_with_user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_matrix_tag_colors: {
        Row: {
          tag: string
          color: string
        }
        Insert: {
          tag: string
          color?: string
        }
        Update: {
          tag?: string
          color?: string
        }
        Relationships: []
      }
      counts_fixture_group_items: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          name: string
          sequence_order: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          name: string
          sequence_order?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          name?: string
          sequence_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "counts_fixture_group_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "counts_fixture_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      counts_fixture_groups: {
        Row: {
          created_at: string | null
          id: string
          label: string
          sequence_order: number
          service_type_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          label: string
          sequence_order?: number
          service_type_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string
          sequence_order?: number
          service_type_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "counts_fixture_groups_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contact_persons: {
        Row: {
          created_at: string | null
          customer_id: string
          email: string | null
          id: string
          name: string
          note: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          email?: string | null
          id?: string
          name: string
          note?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          email?: string | null
          id?: string
          name?: string
          note?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_contact_persons_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contacts: {
        Row: {
          contact_date: string
          created_at: string | null
          created_by: string | null
          customer_id: string
          details: string | null
          id: string
        }
        Insert: {
          contact_date: string
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          details?: string | null
          id?: string
        }
        Update: {
          contact_date?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          details?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          contact_info: Json | null
          created_at: string | null
          date_met: string | null
          id: string
          master_user_id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_info?: Json | null
          created_at?: string | null
          date_met?: string | null
          id?: string
          master_user_id: string
          name: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_info?: Json | null
          created_at?: string | null
          date_met?: string | null
          id?: string
          master_user_id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_master_user_id_fkey"
            columns: ["master_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_read_completed_items: {
        Row: {
          dev_user_id: string
          checklist_instance_id: string
          read_at: string
        }
        Insert: {
          dev_user_id: string
          checklist_instance_id: string
          read_at?: string
        }
        Update: {
          dev_user_id?: string
          checklist_instance_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dev_read_completed_items_checklist_instance_id_fkey"
            columns: ["checklist_instance_id"]
            isOneToOne: false
            referencedRelation: "checklist_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string | null
          id: string
          subject: string
          template_type: string
          updated_at: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          subject: string
          template_type: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          subject?: string
          template_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fixture_labor_defaults: {
        Row: {
          fixture: string
          rough_in_hrs: number
          top_out_hrs: number
          trim_set_hrs: number
        }
        Insert: {
          fixture: string
          rough_in_hrs?: number
          top_out_hrs?: number
          trim_set_hrs?: number
        }
        Update: {
          fixture?: string
          rough_in_hrs?: number
          top_out_hrs?: number
          trim_set_hrs?: number
        }
        Relationships: []
      }
      fixture_types: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          name: string
          sequence_order: number
          service_type_id: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          name: string
          sequence_order?: number
          service_type_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          name?: string
          sequence_order?: number
          service_type_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixture_types_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs_ledger: {
        Row: {
          created_at: string | null
          hcp_number: string
          id: string
          job_address: string
          job_name: string
          master_user_id: string
          revenue: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          hcp_number?: string
          id?: string
          job_address?: string
          job_name?: string
          master_user_id: string
          revenue?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          hcp_number?: string
          id?: string
          job_address?: string
          job_name?: string
          master_user_id?: string
          revenue?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_ledger_master_user_id_fkey"
            columns: ["master_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs_ledger_materials: {
        Row: {
          amount: number
          created_at: string | null
          description: string
          id: string
          job_id: string
          sequence_order: number
        }
        Insert: {
          amount?: number
          created_at?: string | null
          description?: string
          id?: string
          job_id: string
          sequence_order?: number
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string
          id?: string
          job_id?: string
          sequence_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "jobs_ledger_materials_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs_ledger_team_members: {
        Row: {
          created_at: string | null
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_ledger_team_members_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_ledger_team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs_ledger_fixtures: {
        Row: {
          id: string
          job_id: string
          name: string
          count: number
          sequence_order: number
          created_at: string | null
        }
        Insert: {
          id?: string
          job_id: string
          name?: string
          count?: number
          sequence_order?: number
          created_at?: string | null
        }
        Update: {
          id?: string
          job_id?: string
          name?: string
          count?: number
          sequence_order?: number
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_ledger_fixtures_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs_receivables: {
        Row: {
          account_rep_name: string | null
          amount: number
          created_at: string | null
          id: string
          master_user_id: string
          payer: string
          point_of_contact: string
          updated_at: string | null
        }
        Insert: {
          account_rep_name?: string | null
          amount?: number
          created_at?: string | null
          id?: string
          master_user_id: string
          payer?: string
          point_of_contact?: string
          updated_at?: string | null
        }
        Update: {
          account_rep_name?: string | null
          amount?: number
          created_at?: string | null
          id?: string
          master_user_id?: string
          payer?: string
          point_of_contact?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_receivables_master_user_id_fkey"
            columns: ["master_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      report_enabled_users: {
        Row: {
          created_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_enabled_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      report_template_fields: {
        Row: {
          created_at: string | null
          id: string
          label: string
          sequence_order: number
          template_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          label: string
          sequence_order?: number
          template_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string
          sequence_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_template_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      report_templates: {
        Row: {
          created_at: string | null
          id: string
          name: string
          sequence_order: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          sequence_order?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          sequence_order?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          field_values: Json
          id: string
          job_ledger_id: string | null
          project_id: string | null
          template_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          field_values?: Json
          id?: string
          job_ledger_id?: string | null
          project_id?: string | null
          template_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          field_values?: Json
          id?: string
          job_ledger_id?: string | null
          project_id?: string | null
          template_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_job_ledger_id_fkey"
            columns: ["job_ledger_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_book_entries: {
        Row: {
          alias_names: string[] | null
          created_at: string | null
          fixture_type_id: string
          id: string
          rough_in_hrs: number
          sequence_order: number
          top_out_hrs: number
          trim_set_hrs: number
          version_id: string
        }
        Insert: {
          alias_names?: string[] | null
          created_at?: string | null
          fixture_type_id: string
          id?: string
          rough_in_hrs?: number
          sequence_order?: number
          top_out_hrs?: number
          trim_set_hrs?: number
          version_id: string
        }
        Update: {
          alias_names?: string[] | null
          created_at?: string | null
          fixture_type_id?: string
          id?: string
          rough_in_hrs?: number
          sequence_order?: number
          top_out_hrs?: number
          trim_set_hrs?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_book_entries_fixture_type_id_fkey"
            columns: ["fixture_type_id"]
            isOneToOne: false
            referencedRelation: "fixture_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_book_entries_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "labor_book_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_book_versions: {
        Row: {
          created_at: string | null
          id: string
          name: string
          service_type_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          service_type_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          service_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_book_versions_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      master_assistants: {
        Row: {
          assistant_id: string
          created_at: string | null
          master_id: string
        }
        Insert: {
          assistant_id: string
          created_at?: string | null
          master_id: string
        }
        Update: {
          assistant_id?: string
          created_at?: string | null
          master_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_assistants_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_assistants_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      master_shares: {
        Row: {
          created_at: string | null
          sharing_master_id: string
          viewing_master_id: string
        }
        Insert: {
          created_at?: string | null
          sharing_master_id: string
          viewing_master_id: string
        }
        Update: {
          created_at?: string | null
          sharing_master_id?: string
          viewing_master_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_shares_sharing_master_id_fkey"
            columns: ["sharing_master_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_shares_viewing_master_id_fkey"
            columns: ["viewing_master_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      material_part_price_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          created_at: string | null
          effective_date: string | null
          id: string
          new_price: number
          notes: string | null
          old_price: number | null
          part_id: string | null
          price_change_percent: number | null
          supply_house_id: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          effective_date?: string | null
          id?: string
          new_price: number
          notes?: string | null
          old_price?: number | null
          part_id?: string | null
          price_change_percent?: number | null
          supply_house_id?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          effective_date?: string | null
          id?: string
          new_price?: number
          notes?: string | null
          old_price?: number | null
          part_id?: string | null
          price_change_percent?: number | null
          supply_house_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_part_price_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_part_price_history_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "material_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_part_price_history_supply_house_id_fkey"
            columns: ["supply_house_id"]
            isOneToOne: false
            referencedRelation: "supply_houses"
            referencedColumns: ["id"]
          },
        ]
      }
      material_part_prices: {
        Row: {
          created_at: string | null
          effective_date: string | null
          id: string
          part_id: string
          price: number
          supply_house_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          effective_date?: string | null
          id?: string
          part_id: string
          price: number
          supply_house_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          effective_date?: string | null
          id?: string
          part_id?: string
          price?: number
          supply_house_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_part_prices_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "material_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_part_prices_supply_house_id_fkey"
            columns: ["supply_house_id"]
            isOneToOne: false
            referencedRelation: "supply_houses"
            referencedColumns: ["id"]
          },
        ]
      }
      material_parts: {
        Row: {
          created_at: string | null
          id: string
          manufacturer: string | null
          name: string
          notes: string | null
          part_type_id: string
          service_type_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          manufacturer?: string | null
          name: string
          notes?: string | null
          part_type_id: string
          service_type_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          manufacturer?: string | null
          name?: string
          notes?: string | null
          part_type_id?: string
          service_type_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_parts_part_type_id_fkey"
            columns: ["part_type_id"]
            isOneToOne: false
            referencedRelation: "part_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_parts_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      material_template_items: {
        Row: {
          created_at: string | null
          id: string
          item_type: string
          nested_template_id: string | null
          notes: string | null
          part_id: string | null
          quantity: number
          sequence_order: number
          template_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_type: string
          nested_template_id?: string | null
          notes?: string | null
          part_id?: string | null
          quantity?: number
          sequence_order?: number
          template_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_type?: string
          nested_template_id?: string | null
          notes?: string | null
          part_id?: string | null
          quantity?: number
          sequence_order?: number
          template_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_template_items_nested_template_id_fkey"
            columns: ["nested_template_id"]
            isOneToOne: false
            referencedRelation: "material_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_template_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "material_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "material_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      material_templates: {
        Row: {
          assembly_type_id: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          service_type_id: string
          updated_at: string | null
        }
        Insert: {
          assembly_type_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          service_type_id: string
          updated_at?: string | null
        }
        Update: {
          assembly_type_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          service_type_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_templates_assembly_type_id_fkey"
            columns: ["assembly_type_id"]
            isOneToOne: false
            referencedRelation: "assembly_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_templates_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_history: {
        Row: {
          body_preview: string | null
          channel: string
          checklist_instance_id: string | null
          id: string
          project_id: string | null
          recipient_user_id: string
          sent_at: string
          step_id: string | null
          template_type: string
          title: string
          workflow_id: string | null
        }
        Insert: {
          body_preview?: string | null
          channel: string
          checklist_instance_id?: string | null
          id?: string
          project_id?: string | null
          recipient_user_id: string
          sent_at?: string
          step_id?: string | null
          template_type: string
          title: string
          workflow_id?: string | null
        }
        Update: {
          body_preview?: string | null
          channel?: string
          checklist_instance_id?: string | null
          id?: string
          project_id?: string | null
          recipient_user_id?: string
          sent_at?: string
          step_id?: string | null
          template_type?: string
          title?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_history_checklist_instance_id_fkey"
            columns: ["checklist_instance_id"]
            isOneToOne: false
            referencedRelation: "checklist_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_history_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "project_workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_history_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "project_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          created_at: string | null
          id: string
          push_body: string
          push_title: string
          template_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          push_body: string
          push_title: string
          template_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          push_body?: string
          push_title?: string
          template_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      part_types: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          name: string
          sequence_order: number
          service_type_id: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          name: string
          sequence_order?: number
          service_type_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          name?: string
          sequence_order?: number
          service_type_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "part_types_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_approved_masters: {
        Row: {
          master_id: string
        }
        Insert: {
          master_id: string
        }
        Update: {
          master_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_approved_masters_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          kind: string
          master_user_id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          kind: string
          master_user_id: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          kind?: string
          master_user_id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_master_user_id_fkey"
            columns: ["master_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      people_hours: {
        Row: {
          created_at: string | null
          entered_by: string | null
          hours: number
          id: string
          person_name: string
          work_date: string
        }
        Insert: {
          created_at?: string | null
          entered_by?: string | null
          hours?: number
          id?: string
          person_name: string
          work_date: string
        }
        Update: {
          created_at?: string | null
          entered_by?: string | null
          hours?: number
          id?: string
          person_name?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_hours_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      people_hours_display_order: {
        Row: {
          person_name: string
          sequence_order: number
        }
        Insert: {
          person_name: string
          sequence_order?: number
        }
        Update: {
          person_name?: string
          sequence_order?: number
        }
        Relationships: []
      }
      people_cost_matrix_tags: {
        Row: {
          person_name: string
          tags: string
        }
        Insert: {
          person_name: string
          tags?: string
        }
        Update: {
          person_name?: string
          tags?: string
        }
        Relationships: []
      }
      people_labor_job_items: {
        Row: {
          count: number
          created_at: string | null
          fixture: string
          hrs_per_unit: number
          id: string
          is_fixed: boolean
          job_id: string
          sequence_order: number
        }
        Insert: {
          count?: number
          created_at?: string | null
          fixture?: string
          hrs_per_unit?: number
          id?: string
          is_fixed?: boolean
          job_id: string
          sequence_order?: number
        }
        Update: {
          count?: number
          created_at?: string | null
          fixture?: string
          hrs_per_unit?: number
          id?: string
          is_fixed?: boolean
          job_id?: string
          sequence_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "people_labor_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "people_labor_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      people_labor_jobs: {
        Row: {
          address: string
          assigned_to_name: string
          created_at: string | null
          distance_miles: number | null
          id: string
          job_date: string | null
          job_number: string | null
          labor_rate: number | null
          master_user_id: string
        }
        Insert: {
          address?: string
          assigned_to_name: string
          created_at?: string | null
          distance_miles?: number | null
          id?: string
          job_date?: string | null
          job_number?: string | null
          labor_rate?: number | null
          master_user_id: string
        }
        Update: {
          address?: string
          assigned_to_name?: string
          created_at?: string | null
          distance_miles?: number | null
          id?: string
          job_date?: string | null
          job_number?: string | null
          labor_rate?: number | null
          master_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_labor_jobs_master_user_id_fkey"
            columns: ["master_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      people_pay_config: {
        Row: {
          hourly_wage: number | null
          is_salary: boolean
          person_name: string
          show_in_cost_matrix: boolean
          show_in_hours: boolean
        }
        Insert: {
          hourly_wage?: number | null
          is_salary?: boolean
          person_name: string
          show_in_cost_matrix?: boolean
          show_in_hours?: boolean
        }
        Update: {
          hourly_wage?: number | null
          is_salary?: boolean
          person_name?: string
          show_in_cost_matrix?: boolean
          show_in_hours?: boolean
        }
        Relationships: []
      }
      people_team_members: {
        Row: {
          person_name: string
          team_id: string
        }
        Insert: {
          person_name: string
          team_id: string
        }
        Update: {
          person_name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "people_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      people_teams: {
        Row: {
          created_at: string | null
          id: string
          name: string
          sequence_order: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          sequence_order?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          sequence_order?: number
        }
        Relationships: []
      }
      price_book_entries: {
        Row: {
          created_at: string | null
          fixture_type_id: string
          id: string
          rough_in_price: number
          sequence_order: number
          top_out_price: number
          total_price: number
          trim_set_price: number
          version_id: string
        }
        Insert: {
          created_at?: string | null
          fixture_type_id: string
          id?: string
          rough_in_price?: number
          sequence_order?: number
          top_out_price?: number
          total_price?: number
          trim_set_price?: number
          version_id: string
        }
        Update: {
          created_at?: string | null
          fixture_type_id?: string
          id?: string
          rough_in_price?: number
          sequence_order?: number
          top_out_price?: number
          total_price?: number
          trim_set_price?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_book_entries_fixture_type_id_fkey"
            columns: ["fixture_type_id"]
            isOneToOne: false
            referencedRelation: "fixture_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_book_entries_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "price_book_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      price_book_versions: {
        Row: {
          created_at: string | null
          id: string
          name: string
          service_type_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          service_type_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          service_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_book_versions_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      project_workflow_step_actions: {
        Row: {
          action_type: string
          created_at: string | null
          id: string
          notes: string | null
          performed_at: string
          performed_by: string
          step_id: string
        }
        Insert: {
          action_type: string
          created_at?: string | null
          id?: string
          notes?: string | null
          performed_at?: string
          performed_by: string
          step_id: string
        }
        Update: {
          action_type?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          performed_at?: string
          performed_by?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_workflow_step_actions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "project_workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      project_workflow_steps: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assigned_skill: string | null
          assigned_to_name: string | null
          created_at: string | null
          ended_at: string | null
          id: string
          inspection_notes: string | null
          inspector_name: string | null
          name: string
          next_step_rejected_notice: string | null
          next_step_rejection_reason: string | null
          notes: string | null
          notify_assigned_when_complete: boolean | null
          notify_assigned_when_reopened: boolean | null
          notify_assigned_when_started: boolean | null
          notify_next_assignee_when_complete_or_approved: boolean | null
          notify_prior_assignee_when_rejected: boolean | null
          private_notes: string | null
          rejection_reason: string | null
          scheduled_end_date: string | null
          scheduled_start_date: string | null
          sequence_order: number
          started_at: string | null
          status: Database["public"]["Enums"]["step_status"]
          step_type: Database["public"]["Enums"]["step_type"] | null
          template_step_id: string | null
          updated_at: string | null
          workflow_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_skill?: string | null
          assigned_to_name?: string | null
          created_at?: string | null
          ended_at?: string | null
          id?: string
          inspection_notes?: string | null
          inspector_name?: string | null
          name: string
          next_step_rejected_notice?: string | null
          next_step_rejection_reason?: string | null
          notes?: string | null
          notify_assigned_when_complete?: boolean | null
          notify_assigned_when_reopened?: boolean | null
          notify_assigned_when_started?: boolean | null
          notify_next_assignee_when_complete_or_approved?: boolean | null
          notify_prior_assignee_when_rejected?: boolean | null
          private_notes?: string | null
          rejection_reason?: string | null
          scheduled_end_date?: string | null
          scheduled_start_date?: string | null
          sequence_order: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["step_status"]
          step_type?: Database["public"]["Enums"]["step_type"] | null
          template_step_id?: string | null
          updated_at?: string | null
          workflow_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_skill?: string | null
          assigned_to_name?: string | null
          created_at?: string | null
          ended_at?: string | null
          id?: string
          inspection_notes?: string | null
          inspector_name?: string | null
          name?: string
          next_step_rejected_notice?: string | null
          next_step_rejection_reason?: string | null
          notes?: string | null
          notify_assigned_when_complete?: boolean | null
          notify_assigned_when_reopened?: boolean | null
          notify_assigned_when_started?: boolean | null
          notify_next_assignee_when_complete_or_approved?: boolean | null
          notify_prior_assignee_when_rejected?: boolean | null
          private_notes?: string | null
          rejection_reason?: string | null
          scheduled_end_date?: string | null
          scheduled_start_date?: string | null
          sequence_order?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["step_status"]
          step_type?: Database["public"]["Enums"]["step_type"] | null
          template_step_id?: string | null
          updated_at?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_workflow_steps_template_step_id_fkey"
            columns: ["template_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_template_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "project_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      project_workflows: {
        Row: {
          created_at: string | null
          id: string
          name: string
          project_id: string
          status: Database["public"]["Enums"]["workflow_status"]
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          project_id: string
          status?: Database["public"]["Enums"]["workflow_status"]
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          project_id?: string
          status?: Database["public"]["Enums"]["workflow_status"]
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_workflows_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_workflows_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          created_at: string | null
          customer_id: string
          description: string | null
          housecallpro_number: string | null
          id: string
          master_user_id: string | null
          name: string
          plans_link: string | null
          project_type: string | null
          status: Database["public"]["Enums"]["project_status"]
          street_name: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          customer_id: string
          description?: string | null
          housecallpro_number?: string | null
          id?: string
          master_user_id?: string | null
          name: string
          plans_link?: string | null
          project_type?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          street_name?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          customer_id?: string
          description?: string | null
          housecallpro_number?: string | null
          id?: string
          master_user_id?: string | null
          name?: string
          plans_link?: string | null
          project_type?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          street_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_master_user_id_fkey"
            columns: ["master_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          part_id: string
          price_at_time: number
          price_confirmed_at: string | null
          price_confirmed_by: string | null
          purchase_order_id: string
          quantity: number
          selected_supply_house_id: string | null
          sequence_order: number
          source_template_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          part_id: string
          price_at_time: number
          price_confirmed_at?: string | null
          price_confirmed_by?: string | null
          purchase_order_id: string
          quantity?: number
          selected_supply_house_id?: string | null
          sequence_order?: number
          source_template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          part_id?: string
          price_at_time?: number
          price_confirmed_at?: string | null
          price_confirmed_by?: string | null
          purchase_order_id?: string
          quantity?: number
          selected_supply_house_id?: string | null
          sequence_order?: number
          source_template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "material_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_price_confirmed_by_fkey"
            columns: ["price_confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_selected_supply_house_id_fkey"
            columns: ["selected_supply_house_id"]
            isOneToOne: false
            referencedRelation: "supply_houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "material_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string | null
          created_by: string
          finalized_at: string | null
          id: string
          name: string
          notes: string | null
          notes_added_at: string | null
          notes_added_by: string | null
          service_type_id: string
          stage: string | null
          status: string
          supply_house_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          finalized_at?: string | null
          id?: string
          name: string
          notes?: string | null
          notes_added_at?: string | null
          notes_added_by?: string | null
          service_type_id: string
          stage?: string | null
          status?: string
          supply_house_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          finalized_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          notes_added_at?: string | null
          notes_added_by?: string | null
          service_type_id?: string
          stage?: string | null
          status?: string
          supply_house_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_notes_added_by_fkey"
            columns: ["notes_added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supply_house_id_fkey"
            columns: ["supply_house_id"]
            isOneToOne: false
            referencedRelation: "supply_houses"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh_key: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh_key: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh_key?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      service_types: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          sequence_order: number
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          sequence_order?: number
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          sequence_order?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      step_subscriptions: {
        Row: {
          created_at: string | null
          id: string
          notify_when_complete: boolean | null
          notify_when_reopened: boolean | null
          notify_when_started: boolean | null
          step_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notify_when_complete?: boolean | null
          notify_when_reopened?: boolean | null
          notify_when_started?: boolean | null
          step_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notify_when_complete?: boolean | null
          notify_when_reopened?: boolean | null
          notify_when_started?: boolean | null
          step_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "step_subscriptions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "project_workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "step_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_house_invoices: {
        Row: {
          amount: number
          created_at: string | null
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          is_paid: boolean
          link: string | null
          supply_house_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          due_date?: string | null
          id?: string
          invoice_date: string
          invoice_number: string
          is_paid?: boolean
          link?: string | null
          supply_house_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          is_paid?: boolean
          link?: string | null
          supply_house_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supply_house_invoices_supply_house_id_fkey"
            columns: ["supply_house_id"]
            isOneToOne: false
            referencedRelation: "supply_houses"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_houses: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      external_team_job_payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          is_paid: boolean
          note: string
          person_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          is_paid?: boolean
          note: string
          person_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          is_paid?: boolean
          note?: string
          person_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_team_job_payments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      external_team_sub_managers: {
        Row: {
          created_at: string | null
          person_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          person_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          person_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_team_sub_managers_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_team_sub_managers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      takeoff_book_entries: {
        Row: {
          alias_names: string[] | null
          created_at: string | null
          fixture_name: string
          id: string
          sequence_order: number
          version_id: string
        }
        Insert: {
          alias_names?: string[] | null
          created_at?: string | null
          fixture_name: string
          id?: string
          sequence_order?: number
          version_id: string
        }
        Update: {
          alias_names?: string[] | null
          created_at?: string | null
          fixture_name?: string
          id?: string
          sequence_order?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "takeoff_book_entries_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "takeoff_book_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      takeoff_book_entry_items: {
        Row: {
          created_at: string | null
          entry_id: string
          id: string
          sequence_order: number
          stage: string
          template_id: string
        }
        Insert: {
          created_at?: string | null
          entry_id: string
          id?: string
          sequence_order?: number
          stage: string
          template_id: string
        }
        Update: {
          created_at?: string | null
          entry_id?: string
          id?: string
          sequence_order?: number
          stage?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "takeoff_book_entry_items_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "takeoff_book_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "takeoff_book_entry_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "material_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      takeoff_book_versions: {
        Row: {
          created_at: string | null
          id: string
          name: string
          service_type_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          service_type_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          service_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "takeoff_book_versions_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pinned_tabs: {
        Row: {
          id: string
          label: string
          path: string
          tab: string | null
          user_id: string
        }
        Insert: {
          id?: string
          label: string
          path: string
          tab?: string | null
          user_id: string
        }
        Update: {
          id?: string
          label?: string
          path?: string
          tab?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_pinned_tabs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          estimator_service_type_ids: string[] | null
          id: string
          last_sign_in_at: string | null
          name: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          estimator_service_type_ids?: string[] | null
          id: string
          last_sign_in_at?: string | null
          name: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          estimator_service_type_ids?: string[] | null
          id?: string
          last_sign_in_at?: string | null
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      workflow_projections: {
        Row: {
          amount: number
          collected: boolean
          created_at: string | null
          id: string
          memo: string
          sequence_order: number
          stage_name: string
          updated_at: string | null
          workflow_id: string
        }
        Insert: {
          amount: number
          collected?: boolean
          created_at?: string | null
          id?: string
          memo: string
          sequence_order?: number
          stage_name: string
          updated_at?: string | null
          workflow_id: string
        }
        Update: {
          amount?: number
          collected?: boolean
          created_at?: string | null
          id?: string
          memo?: string
          sequence_order?: number
          stage_name?: string
          updated_at?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_projections_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "project_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_step_dependencies: {
        Row: {
          created_at: string | null
          depends_on_step_id: string
          id: string
          step_id: string
        }
        Insert: {
          created_at?: string | null
          depends_on_step_id: string
          id?: string
          step_id: string
        }
        Update: {
          created_at?: string | null
          depends_on_step_id?: string
          id?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_step_dependencies_depends_on_step_id_fkey"
            columns: ["depends_on_step_id"]
            isOneToOne: false
            referencedRelation: "project_workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_step_dependencies_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "project_workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_step_line_items: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          link: string | null
          memo: string
          purchase_order_id: string | null
          sequence_order: number
          step_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          link?: string | null
          memo: string
          purchase_order_id?: string | null
          sequence_order?: number
          step_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          link?: string | null
          memo?: string
          purchase_order_id?: string | null
          sequence_order?: number
          step_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_step_line_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_step_line_items_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "project_workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_template_steps: {
        Row: {
          created_at: string | null
          default_duration_days: number
          id: string
          name: string
          required_skill: string | null
          sequence_order: number
          step_type: Database["public"]["Enums"]["step_type"] | null
          template_id: string
        }
        Insert: {
          created_at?: string | null
          default_duration_days?: number
          id?: string
          name: string
          required_skill?: string | null
          sequence_order: number
          step_type?: Database["public"]["Enums"]["step_type"] | null
          template_id: string
        }
        Update: {
          created_at?: string | null
          default_duration_days?: number
          id?: string
          name?: string
          required_skill?: string | null
          sequence_order?: number
          step_type?: Database["public"]["Enums"]["step_type"] | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_template_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          master_user_id: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          master_user_id?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          master_user_id?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_templates_master_user_id_fkey"
            columns: ["master_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_project: {
        Args: { project_id_param: string }
        Returns: boolean
      }
      can_access_project_via_step: {
        Args: { step_id_param: string }
        Returns: boolean
      }
      can_access_project_via_workflow: {
        Args: { workflow_id_param: string }
        Returns: boolean
      }
      can_access_step_for_action: {
        Args: { step_id_param: string }
        Returns: boolean
      }
      can_see_sharing_master: {
        Args: { sharing_master_id: string }
        Returns: boolean
      }
      claim_dev_with_code: { Args: { code_input: string }; Returns: boolean }
      copy_workflow_step: {
        Args: { p_insert_after_sequence: number; p_step_id: string }
        Returns: Json
      }
      create_project_with_template: {
        Args: {
          p_address: string
          p_customer_id: string
          p_master_user_id: string
          p_name: string
          p_notes?: string
          p_template_id?: string
        }
        Returns: Json
      }
      create_takeoff_entry_with_items: {
        Args: {
          p_bid_id: string
          p_entry_data: Json
          p_items: Json
          p_page: string
        }
        Returns: Json
      }
      duplicate_purchase_order: {
        Args: { p_created_by: string; p_source_po_id: string }
        Returns: Json
      }
      estimator_can_access_service_type: {
        Args: { p_service_type_id: string }
        Returns: boolean
      }
      get_parts_ordered_by_price_count:
        | {
            Args: { ascending_order?: boolean }
            Returns: {
              part_id: string
              price_count: number
            }[]
          }
        | {
            Args: { ascending_order?: boolean; filter_service_type_id?: string }
            Returns: {
              part_id: string
              price_count: number
            }[]
          }
      get_supply_house_price_counts: {
        Args: never
        Returns: {
          price_count: number
          supply_house_id: string
          supply_house_name: string
        }[]
      }
      get_supply_house_stats_by_service_type: {
        Args: never
        Returns: {
          parts_with_multiple_prices: number
          parts_with_prices: number
          price_count: number
          service_type_id: string
          service_type_name: string
          supply_house_id: string
          supply_house_name: string
          total_parts: number
        }[]
      }
      get_job_display_for_report: {
        Args: { p_source: string; p_id: string }
        Returns: { id: string; source: string; display_name: string; hcp_number: string }[]
      }
      list_reports_with_job_info: {
        Args: never
        Returns: {
          id: string
          template_id: string
          template_name: string
          created_by_user_id: string
          created_by_name: string
          created_at: string
          updated_at: string
          field_values: Record<string, string>
          job_ledger_id: string | null
          project_id: string | null
          job_display_name: string
          job_hcp_number: string
        }[]
      }
      search_jobs_for_reports: {
        Args: { search_text?: string }
        Returns: { id: string; source: string; display_name: string; hcp_number: string }[]
      }
      is_assistant: { Args: never; Returns: boolean }
      is_assistant_of_pay_approved_master: { Args: never; Returns: boolean }
      is_cost_matrix_shared_with_current_user: { Args: never; Returns: boolean }
      is_dev: { Args: never; Returns: boolean }
      is_dev_or_master_or_assistant: { Args: never; Returns: boolean }
      is_estimator: { Args: never; Returns: boolean }
      is_master_or_dev: { Args: never; Returns: boolean }
      is_pay_approved_master: { Args: never; Returns: boolean }
      master_adopted_current_user: {
        Args: { master_user_id: string }
        Returns: boolean
      }
      master_shared_current_user: {
        Args: { sharing_master_id: string }
        Returns: boolean
      }
      touch_last_sign_in: { Args: never; Returns: undefined }
    }
    Enums: {
      project_status: "active" | "completed" | "on_hold" | "awaiting_start"
      step_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "rejected"
        | "approved"
      step_type: "delivery" | "count" | "work" | "inspection" | "billing"
      user_role:
        | "owner"
        | "master"
        | "assistant"
        | "subcontractor"
        | "master_technician"
        | "dev"
        | "estimator"
      workflow_status: "draft" | "active" | "completed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      project_status: ["active", "completed", "on_hold", "awaiting_start"],
      step_status: [
        "pending",
        "in_progress",
        "completed",
        "rejected",
        "approved",
      ],
      step_type: ["delivery", "count", "work", "inspection", "billing"],
      user_role: [
        "owner",
        "master",
        "assistant",
        "subcontractor",
        "master_technician",
        "dev",
        "estimator",
      ],
      workflow_status: ["draft", "active", "completed"],
    },
  },
} as const
