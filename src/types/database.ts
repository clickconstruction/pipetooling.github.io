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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      address_geocodes: {
        Row: {
          address_normalized: string
          geocode_error: string | null
          geocoded_at: string
          lat: number
          lng: number
        }
        Insert: {
          address_normalized: string
          geocode_error?: string | null
          geocoded_at?: string
          lat: number
          lng: number
        }
        Update: {
          address_normalized?: string
          geocode_error?: string | null
          geocoded_at?: string
          lat?: number
          lng?: number
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          value_num: number | null
          value_text: string | null
        }
        Insert: {
          key: string
          value_num?: number | null
          value_text?: string | null
        }
        Update: {
          key?: string
          value_num?: number | null
          value_text?: string | null
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
      attendance_incidents: {
        Row: {
          created_at: string
          created_by_user_id: string
          details: string | null
          id: string
          incident_type: string
          metadata: Json
          subject_user_id: string
          work_date: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          details?: string | null
          id?: string
          incident_type?: string
          metadata?: Json
          subject_user_id: string
          work_date: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          details?: string | null
          id?: string
          incident_type?: string
          metadata?: Json
          subject_user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_incidents_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_incidents_subject_user_id_fkey"
            columns: ["subject_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      banking_user_prefs: {
        Row: {
          accounting_apply_rules_by_default: boolean | null
          accounting_approve_by_default: boolean | null
          accounting_hide_labeled: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accounting_apply_rules_by_default?: boolean | null
          accounting_approve_by_default?: boolean | null
          accounting_hide_labeled?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accounting_apply_rules_by_default?: boolean | null
          accounting_approve_by_default?: boolean | null
          accounting_hide_labeled?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "banking_user_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_count_row_custom_prices: {
        Row: {
          bid_id: string
          count_row_id: string
          created_at: string | null
          id: string
          price_book_version_id: string
          unit_price: number
        }
        Insert: {
          bid_id: string
          count_row_id: string
          created_at?: string | null
          id?: string
          price_book_version_id: string
          unit_price: number
        }
        Update: {
          bid_id?: string
          count_row_id?: string
          created_at?: string | null
          id?: string
          price_book_version_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "bid_count_row_custom_prices_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_count_row_custom_prices_count_row_id_fkey"
            columns: ["count_row_id"]
            isOneToOne: false
            referencedRelation: "bids_count_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_count_row_custom_prices_price_book_version_id_fkey"
            columns: ["price_book_version_id"]
            isOneToOne: false
            referencedRelation: "price_book_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_count_row_submission_hides: {
        Row: {
          bid_id: string
          count_row_id: string
          created_at: string
          price_book_version_id: string
        }
        Insert: {
          bid_id: string
          count_row_id: string
          created_at?: string
          price_book_version_id: string
        }
        Update: {
          bid_id?: string
          count_row_id?: string
          created_at?: string
          price_book_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_count_row_submission_hides_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_count_row_submission_hides_count_row_id_fkey"
            columns: ["count_row_id"]
            isOneToOne: false
            referencedRelation: "bids_count_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_count_row_submission_hides_price_book_version_id_fkey"
            columns: ["price_book_version_id"]
            isOneToOne: false
            referencedRelation: "price_book_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_estimators_extra_users: {
        Row: {
          added_at: string
          added_by: string | null
          user_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          user_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_estimators_extra_users_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_estimators_extra_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_payment_schedule_rows: {
        Row: {
          bid_id: string
          created_at: string
          id: string
          percent: number
          sort_order: number
          timing: string
        }
        Insert: {
          bid_id: string
          created_at?: string
          id?: string
          percent: number
          sort_order?: number
          timing: string
        }
        Update: {
          bid_id?: string
          created_at?: string
          id?: string
          percent?: number
          sort_order?: number
          timing?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_payment_schedule_rows_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
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
          unit_price_override: number | null
        }
        Insert: {
          bid_id: string
          count_row_id: string
          created_at?: string | null
          id?: string
          is_fixed_price?: boolean
          price_book_entry_id: string
          price_book_version_id: string
          unit_price_override?: number | null
        }
        Update: {
          bid_id?: string
          count_row_id?: string
          created_at?: string | null
          id?: string
          is_fixed_price?: boolean
          price_book_entry_id?: string
          price_book_version_id?: string
          unit_price_override?: number | null
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
      bid_pricing_package_sends: {
        Row: {
          bid_id: string
          created_at: string
          id: string
          plans_link: string | null
          price_book_version_id: string
          recipient_email: string
          recipient_user_id: string
          resend_id: string | null
          revenue_total_cents: number
          row_count: number
          sent_by_user_id: string
          sent_via: string
        }
        Insert: {
          bid_id: string
          created_at?: string
          id?: string
          plans_link?: string | null
          price_book_version_id: string
          recipient_email: string
          recipient_user_id: string
          resend_id?: string | null
          revenue_total_cents: number
          row_count: number
          sent_by_user_id: string
          sent_via: string
        }
        Update: {
          bid_id?: string
          created_at?: string
          id?: string
          plans_link?: string | null
          price_book_version_id?: string
          recipient_email?: string
          recipient_user_id?: string
          resend_id?: string | null
          revenue_total_cents?: number
          row_count?: number
          sent_by_user_id?: string
          sent_via?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_pricing_package_sends_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_pricing_package_sends_price_book_version_id_fkey"
            columns: ["price_book_version_id"]
            isOneToOne: false
            referencedRelation: "price_book_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_pricing_package_sends_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_pricing_package_sends_sent_by_user_id_fkey"
            columns: ["sent_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_pricing_user_prefs: {
        Row: {
          last_price_book_version_id: string | null
          service_type_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_price_book_version_id?: string | null
          service_type_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_price_book_version_id?: string | null
          service_type_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_pricing_user_prefs_last_price_book_version_id_fkey"
            columns: ["last_price_book_version_id"]
            isOneToOne: false
            referencedRelation: "price_book_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_pricing_user_prefs_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_pricing_user_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_versions: {
        Row: {
          bid_id: string
          created_at: string | null
          id: string
          include_in_submission: boolean
          name: string
          sort_order: number
          source_bid_version_id: string | null
        }
        Insert: {
          bid_id: string
          created_at?: string | null
          id?: string
          include_in_submission?: boolean
          name: string
          sort_order?: number
          source_bid_version_id?: string | null
        }
        Update: {
          bid_id?: string
          created_at?: string | null
          id?: string
          include_in_submission?: boolean
          name?: string
          sort_order?: number
          source_bid_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bid_versions_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_versions_source_bid_version_id_fkey"
            columns: ["source_bid_version_id"]
            isOneToOne: false
            referencedRelation: "bid_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_working_board_columns: {
        Row: {
          created_at: string
          id: string
          position: number
          system_key: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          position: number
          system_key?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          system_key?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_working_board_columns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_working_board_placements: {
        Row: {
          bid_id: string
          column_id: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bid_id: string
          column_id: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bid_id?: string
          column_id?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_working_board_placements_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_working_board_placements_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "bid_working_board_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_working_board_placements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
          bid_date_sent_ack_email_at: string | null
          bid_date_sent_ack_email_by: string | null
          bid_date_sent_ack_honesty_at: string | null
          bid_date_sent_ack_honesty_by: string | null
          bid_date_sent_ack_phone_at: string | null
          bid_date_sent_ack_phone_by: string | null
          bid_date_sent_attested_at: string | null
          bid_date_sent_attested_by: string | null
          bid_due_date: string | null
          bid_number: string | null
          bid_submission_link: string | null
          bid_value: number | null
          count_tooling_link: string | null
          count_tooling_plans_link: string | null
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
          include_payment_schedule: boolean
          last_contact: string | null
          loss_reason: string | null
          materials_model: string
          notes: string | null
          outcome: string | null
          plan_pages: string | null
          plans_link: string | null
          profit: number | null
          project_name: string | null
          selected_bid_version_id: string | null
          selected_labor_book_version_id: string | null
          selected_price_book_version_id: string | null
          selected_takeoff_book_version_id: string | null
          service_type_id: string
          submitted_to: string | null
          updated_at: string | null
          working_board_archived_at: string | null
          working_board_archived_by: string | null
        }
        Insert: {
          account_manager_id?: string | null
          address?: string | null
          agreed_value?: number | null
          bid_date_sent?: string | null
          bid_date_sent_ack_email_at?: string | null
          bid_date_sent_ack_email_by?: string | null
          bid_date_sent_ack_honesty_at?: string | null
          bid_date_sent_ack_honesty_by?: string | null
          bid_date_sent_ack_phone_at?: string | null
          bid_date_sent_ack_phone_by?: string | null
          bid_date_sent_attested_at?: string | null
          bid_date_sent_attested_by?: string | null
          bid_due_date?: string | null
          bid_number?: string | null
          bid_submission_link?: string | null
          bid_value?: number | null
          count_tooling_link?: string | null
          count_tooling_plans_link?: string | null
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
          include_payment_schedule?: boolean
          last_contact?: string | null
          loss_reason?: string | null
          materials_model?: string
          notes?: string | null
          outcome?: string | null
          plan_pages?: string | null
          plans_link?: string | null
          profit?: number | null
          project_name?: string | null
          selected_bid_version_id?: string | null
          selected_labor_book_version_id?: string | null
          selected_price_book_version_id?: string | null
          selected_takeoff_book_version_id?: string | null
          service_type_id: string
          submitted_to?: string | null
          updated_at?: string | null
          working_board_archived_at?: string | null
          working_board_archived_by?: string | null
        }
        Update: {
          account_manager_id?: string | null
          address?: string | null
          agreed_value?: number | null
          bid_date_sent?: string | null
          bid_date_sent_ack_email_at?: string | null
          bid_date_sent_ack_email_by?: string | null
          bid_date_sent_ack_honesty_at?: string | null
          bid_date_sent_ack_honesty_by?: string | null
          bid_date_sent_ack_phone_at?: string | null
          bid_date_sent_ack_phone_by?: string | null
          bid_date_sent_attested_at?: string | null
          bid_date_sent_attested_by?: string | null
          bid_due_date?: string | null
          bid_number?: string | null
          bid_submission_link?: string | null
          bid_value?: number | null
          count_tooling_link?: string | null
          count_tooling_plans_link?: string | null
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
          include_payment_schedule?: boolean
          last_contact?: string | null
          loss_reason?: string | null
          materials_model?: string
          notes?: string | null
          outcome?: string | null
          plan_pages?: string | null
          plans_link?: string | null
          profit?: number | null
          project_name?: string | null
          selected_bid_version_id?: string | null
          selected_labor_book_version_id?: string | null
          selected_price_book_version_id?: string | null
          selected_takeoff_book_version_id?: string | null
          service_type_id?: string
          submitted_to?: string | null
          updated_at?: string | null
          working_board_archived_at?: string | null
          working_board_archived_by?: string | null
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
            foreignKeyName: "bids_bid_date_sent_ack_email_by_fkey"
            columns: ["bid_date_sent_ack_email_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_bid_date_sent_ack_honesty_by_fkey"
            columns: ["bid_date_sent_ack_honesty_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_bid_date_sent_ack_phone_by_fkey"
            columns: ["bid_date_sent_ack_phone_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_bid_date_sent_attested_by_fkey"
            columns: ["bid_date_sent_attested_by"]
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
            foreignKeyName: "bids_selected_bid_version_id_fkey"
            columns: ["selected_bid_version_id"]
            isOneToOne: false
            referencedRelation: "bid_versions"
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
          {
            foreignKeyName: "bids_working_board_archived_by_fkey"
            columns: ["working_board_archived_by"]
            isOneToOne: false
            referencedRelation: "users"
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
          group_tag: string | null
          id: string
          page: string | null
          sequence_order: number
        }
        Insert: {
          bid_id: string
          count?: number
          created_at?: string | null
          fixture: string
          group_tag?: string | null
          id?: string
          page?: string | null
          sequence_order?: number
        }
        Update: {
          bid_id?: string
          count?: number
          created_at?: string | null
          fixture?: string
          group_tag?: string | null
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
          created_by: string | null
          id: string
          notes: string | null
          occurred_at: string
        }
        Insert: {
          bid_id: string
          contact_method?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
        }
        Update: {
          bid_id?: string
          contact_method?: string | null
          created_at?: string | null
          created_by?: string | null
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
          {
            foreignKeyName: "bids_submission_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bids_takeoff_rough_part_lines: {
        Row: {
          bid_id: string
          bid_version_id: string | null
          count_row_id: string
          created_at: string | null
          id: string
          part_id: string | null
          quantity: number
          sequence_order: number
          source_material_part_price_id: string | null
          source_template_id: string | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          bid_id: string
          bid_version_id?: string | null
          count_row_id: string
          created_at?: string | null
          id?: string
          part_id?: string | null
          quantity?: number
          sequence_order?: number
          source_material_part_price_id?: string | null
          source_template_id?: string | null
          unit_price?: number
          updated_at?: string | null
        }
        Update: {
          bid_id?: string
          bid_version_id?: string | null
          count_row_id?: string
          created_at?: string | null
          id?: string
          part_id?: string | null
          quantity?: number
          sequence_order?: number
          source_material_part_price_id?: string | null
          source_template_id?: string | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bids_takeoff_rough_part_lines_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_takeoff_rough_part_lines_bid_version_id_fkey"
            columns: ["bid_version_id"]
            isOneToOne: false
            referencedRelation: "bid_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_takeoff_rough_part_lines_count_row_id_fkey"
            columns: ["count_row_id"]
            isOneToOne: false
            referencedRelation: "bids_count_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_takeoff_rough_part_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "material_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_takeoff_rough_part_lines_source_material_part_price_i_fkey"
            columns: ["source_material_part_price_id"]
            isOneToOne: false
            referencedRelation: "material_part_prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_takeoff_rough_part_lines_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "material_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      bids_takeoff_template_mappings: {
        Row: {
          bid_id: string
          bid_version_id: string | null
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
          bid_version_id?: string | null
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
          bid_version_id?: string | null
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
            foreignKeyName: "bids_takeoff_template_mappings_bid_version_id_fkey"
            columns: ["bid_version_id"]
            isOneToOne: false
            referencedRelation: "bid_versions"
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
      checklist_instance_assignees: {
        Row: {
          checklist_instance_id: string
          user_id: string
        }
        Insert: {
          checklist_instance_id: string
          user_id: string
        }
        Update: {
          checklist_instance_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_instance_assignees_checklist_instance_id_fkey"
            columns: ["checklist_instance_id"]
            isOneToOne: false
            referencedRelation: "checklist_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_instance_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_instances: {
        Row: {
          checklist_item_id: string
          completed_at: string | null
          completed_by_user_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          scheduled_date: string
        }
        Insert: {
          checklist_item_id: string
          completed_at?: string | null
          completed_by_user_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          scheduled_date: string
        }
        Update: {
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
      checklist_item_assignees: {
        Row: {
          checklist_item_id: string
          display_order: number
          user_id: string
        }
        Insert: {
          checklist_item_id: string
          display_order?: number
          user_id: string
        }
        Update: {
          checklist_item_id?: string
          display_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_item_assignees_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_item_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          id: string
          links: string[] | null
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
          created_at?: string | null
          created_by_user_id: string
          id?: string
          links?: string[] | null
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
          created_at?: string | null
          created_by_user_id?: string
          id?: string
          links?: string[] | null
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
      checklist_tech_tree_edges: {
        Row: {
          created_at: string
          from_group_id: string
          id: string
          to_group_id: string
        }
        Insert: {
          created_at?: string
          from_group_id: string
          id?: string
          to_group_id: string
        }
        Update: {
          created_at?: string
          from_group_id?: string
          id?: string
          to_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_tech_tree_edges_from_group_id_fkey"
            columns: ["from_group_id"]
            isOneToOne: false
            referencedRelation: "checklist_tech_tree_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_tech_tree_edges_to_group_id_fkey"
            columns: ["to_group_id"]
            isOneToOne: false
            referencedRelation: "checklist_tech_tree_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_tech_tree_group_tasks: {
        Row: {
          completed_at: string | null
          completed_by_user_id: string | null
          created_at: string
          group_id: string
          id: string
          sort_index: number
          title: string
        }
        Insert: {
          completed_at?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          group_id: string
          id?: string
          sort_index?: number
          title: string
        }
        Update: {
          completed_at?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          group_id?: string
          id?: string
          sort_index?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_tech_tree_group_tasks_completed_by_user_id_fkey"
            columns: ["completed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_tech_tree_group_tasks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "checklist_tech_tree_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_tech_tree_groups: {
        Row: {
          created_at: string
          created_by_user_id: string
          id: string
          roadmap_id: string
          sort_index: number
          title: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          id?: string
          roadmap_id: string
          sort_index?: number
          title: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          id?: string
          roadmap_id?: string
          sort_index?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_tech_tree_groups_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_tech_tree_groups_roadmap_id_fkey"
            columns: ["roadmap_id"]
            isOneToOne: false
            referencedRelation: "checklist_tech_tree_roadmaps"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_tech_tree_roadmap_members: {
        Row: {
          created_at: string
          roadmap_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          roadmap_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          roadmap_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_tech_tree_roadmap_members_roadmap_id_fkey"
            columns: ["roadmap_id"]
            isOneToOne: false
            referencedRelation: "checklist_tech_tree_roadmaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_tech_tree_roadmap_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_tech_tree_roadmaps: {
        Row: {
          created_at: string
          created_by_user_id: string
          id: string
          sort_index: number
          title: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          id?: string
          sort_index?: number
          title: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          id?: string
          sort_index?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_tech_tree_roadmaps_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_tech_tree_task_assignees: {
        Row: {
          task_id: string
          user_id: string
        }
        Insert: {
          task_id: string
          user_id: string
        }
        Update: {
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_tech_tree_task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "checklist_tech_tree_group_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_tech_tree_task_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clock_sessions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          bid_id: string | null
          clock_in_lat: number | null
          clock_in_lng: number | null
          clock_in_location_source: string | null
          clock_out_lat: number | null
          clock_out_lng: number | null
          clock_out_location_source: string | null
          clocked_in_at: string
          clocked_out_at: string | null
          created_at: string | null
          id: string
          job_ledger_id: string | null
          notes: string
          origin: string
          rejected_at: string | null
          rejected_by: string | null
          revoked_at: string | null
          revoked_by: string | null
          salary_segment_index: number | null
          user_id: string
          work_date: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          bid_id?: string | null
          clock_in_lat?: number | null
          clock_in_lng?: number | null
          clock_in_location_source?: string | null
          clock_out_lat?: number | null
          clock_out_lng?: number | null
          clock_out_location_source?: string | null
          clocked_in_at: string
          clocked_out_at?: string | null
          created_at?: string | null
          id?: string
          job_ledger_id?: string | null
          notes?: string
          origin?: string
          rejected_at?: string | null
          rejected_by?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          salary_segment_index?: number | null
          user_id: string
          work_date: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          bid_id?: string | null
          clock_in_lat?: number | null
          clock_in_lng?: number | null
          clock_in_location_source?: string | null
          clock_out_lat?: number | null
          clock_out_lng?: number | null
          clock_out_location_source?: string | null
          clocked_in_at?: string
          clocked_out_at?: string | null
          created_at?: string | null
          id?: string
          job_ledger_id?: string | null
          notes?: string
          origin?: string
          rejected_at?: string | null
          rejected_by?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          salary_segment_index?: number | null
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "clock_sessions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clock_sessions_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clock_sessions_job_ledger_id_fkey"
            columns: ["job_ledger_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clock_sessions_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clock_sessions_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clock_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      common_jobs: {
        Row: {
          id: string
          job_id: string
          sequence_order: number
        }
        Insert: {
          id?: string
          job_id: string
          sequence_order?: number
        }
        Update: {
          id?: string
          job_id?: string
          sequence_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "common_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_template_documents: {
        Row: {
          book_body_format: string
          book_body_html: string | null
          canonical_document_url: string | null
          created_at: string | null
          document_name: string
          id: string
          sequence_order: number
          tags: string[]
          template_id: string
          updated_at: string
        }
        Insert: {
          book_body_format?: string
          book_body_html?: string | null
          canonical_document_url?: string | null
          created_at?: string | null
          document_name: string
          id?: string
          sequence_order?: number
          tags?: string[]
          template_id: string
          updated_at?: string
        }
        Update: {
          book_body_format?: string
          book_body_html?: string | null
          canonical_document_url?: string | null
          created_at?: string | null
          document_name?: string
          id?: string
          sequence_order?: number
          tags?: string[]
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_template_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
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
      cost_estimate_equipment_rows: {
        Row: {
          cost_estimate_id: string
          created_at: string | null
          id: string
          note: string | null
          rough_in: number
          sequence_order: number
          top_out: number
          trim_set: number
          updated_at: string | null
        }
        Insert: {
          cost_estimate_id: string
          created_at?: string | null
          id?: string
          note?: string | null
          rough_in?: number
          sequence_order?: number
          top_out?: number
          trim_set?: number
          updated_at?: string | null
        }
        Update: {
          cost_estimate_id?: string
          created_at?: string | null
          id?: string
          note?: string | null
          rough_in?: number
          sequence_order?: number
          top_out?: number
          trim_set?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_estimate_equipment_rows_cost_estimate_id_fkey"
            columns: ["cost_estimate_id"]
            isOneToOne: false
            referencedRelation: "cost_estimates"
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
      cost_estimate_other_rows: {
        Row: {
          cost_estimate_id: string
          created_at: string | null
          id: string
          note: string | null
          rough_in: number
          sequence_order: number
          top_out: number
          trim_set: number
          updated_at: string | null
        }
        Insert: {
          cost_estimate_id: string
          created_at?: string | null
          id?: string
          note?: string | null
          rough_in?: number
          sequence_order?: number
          top_out?: number
          trim_set?: number
          updated_at?: string | null
        }
        Update: {
          cost_estimate_id?: string
          created_at?: string | null
          id?: string
          note?: string | null
          rough_in?: number
          sequence_order?: number
          top_out?: number
          trim_set?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_estimate_other_rows_cost_estimate_id_fkey"
            columns: ["cost_estimate_id"]
            isOneToOne: false
            referencedRelation: "cost_estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_estimate_permit_rows: {
        Row: {
          cost_estimate_id: string
          created_at: string | null
          id: string
          note: string | null
          rough_in: number
          sequence_order: number
          top_out: number
          trim_set: number
          updated_at: string | null
        }
        Insert: {
          cost_estimate_id: string
          created_at?: string | null
          id?: string
          note?: string | null
          rough_in?: number
          sequence_order?: number
          top_out?: number
          trim_set?: number
          updated_at?: string | null
        }
        Update: {
          cost_estimate_id?: string
          created_at?: string | null
          id?: string
          note?: string | null
          rough_in?: number
          sequence_order?: number
          top_out?: number
          trim_set?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_estimate_permit_rows_cost_estimate_id_fkey"
            columns: ["cost_estimate_id"]
            isOneToOne: false
            referencedRelation: "cost_estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_estimate_subcontractor_rows: {
        Row: {
          cost_estimate_id: string
          created_at: string | null
          id: string
          note: string | null
          rough_in: number
          sequence_order: number
          top_out: number
          trim_set: number
          updated_at: string | null
        }
        Insert: {
          cost_estimate_id: string
          created_at?: string | null
          id?: string
          note?: string | null
          rough_in?: number
          sequence_order?: number
          top_out?: number
          trim_set?: number
          updated_at?: string | null
        }
        Update: {
          cost_estimate_id?: string
          created_at?: string | null
          id?: string
          note?: string | null
          rough_in?: number
          sequence_order?: number
          top_out?: number
          trim_set?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_estimate_subcontractor_rows_cost_estimate_id_fkey"
            columns: ["cost_estimate_id"]
            isOneToOne: false
            referencedRelation: "cost_estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_estimate_waste_rows: {
        Row: {
          cost_estimate_id: string
          created_at: string | null
          id: string
          note: string | null
          rough_in: number
          sequence_order: number
          top_out: number
          trim_set: number
          updated_at: string | null
        }
        Insert: {
          cost_estimate_id: string
          created_at?: string | null
          id?: string
          note?: string | null
          rough_in?: number
          sequence_order?: number
          top_out?: number
          trim_set?: number
          updated_at?: string | null
        }
        Update: {
          cost_estimate_id?: string
          created_at?: string | null
          id?: string
          note?: string | null
          rough_in?: number
          sequence_order?: number
          top_out?: number
          trim_set?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_estimate_waste_rows_cost_estimate_id_fkey"
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
          travel_hotel_rate: number | null
          travel_meals_rate: number | null
          travel_nights: number
          travel_people: number
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
          travel_hotel_rate?: number | null
          travel_meals_rate?: number | null
          travel_nights?: number
          travel_people?: number
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
          travel_hotel_rate?: number | null
          travel_meals_rate?: number | null
          travel_nights?: number
          travel_people?: number
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
      cost_matrix_tag_colors: {
        Row: {
          color: string
          tag: string
        }
        Insert: {
          color?: string
          tag: string
        }
        Update: {
          color?: string
          tag?: string
        }
        Relationships: []
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
          contact_method: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string
          details: string | null
          id: string
        }
        Insert: {
          contact_date: string
          contact_method?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          details?: string | null
          id?: string
        }
        Update: {
          contact_date?: string
          contact_method?: string | null
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
          customer_type: string | null
          date_met: string | null
          google_drive_link: string | null
          id: string
          job_pictures_link: string | null
          master_user_id: string
          name: string
          stripe_customer_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_info?: Json | null
          created_at?: string | null
          customer_type?: string | null
          date_met?: string | null
          google_drive_link?: string | null
          id?: string
          job_pictures_link?: string | null
          master_user_id: string
          name: string
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_info?: Json | null
          created_at?: string | null
          customer_type?: string | null
          date_met?: string | null
          google_drive_link?: string | null
          id?: string
          job_pictures_link?: string | null
          master_user_id?: string
          name?: string
          stripe_customer_id?: string | null
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
      dev_ignored_checklist_items: {
        Row: {
          checklist_item_id: string
          dev_user_id: string
          ignored_at: string
        }
        Insert: {
          checklist_item_id: string
          dev_user_id: string
          ignored_at?: string
        }
        Update: {
          checklist_item_id?: string
          dev_user_id?: string
          ignored_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dev_ignored_checklist_items_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_read_completed_items: {
        Row: {
          checklist_instance_id: string
          dev_user_id: string
          read_at: string
        }
        Insert: {
          checklist_instance_id: string
          dev_user_id: string
          read_at?: string
        }
        Update: {
          checklist_instance_id?: string
          dev_user_id?: string
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
      dispatch_group_members: {
        Row: {
          user_id: string
        }
        Insert: {
          user_id: string
        }
        Update: {
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_request_dismissals: {
        Row: {
          dismissed_at: string
          request_id: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string
          request_id: string
          user_id: string
        }
        Update: {
          dismissed_at?: string
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_request_dismissals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "dispatch_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_request_notes: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          id: string
          request_id: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          request_id: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_request_notes_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_request_notes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "dispatch_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_requests: {
        Row: {
          bid_id: string | null
          closed_at: string | null
          closed_by_user_id: string | null
          closed_note: string | null
          created_at: string
          from_user_id: string
          id: string
          job_ledger_id: string | null
          links: string[]
          location_lat: number | null
          location_lng: number | null
          pending_action: string | null
          reference_summary: string | null
          status: string
          title: string
        }
        Insert: {
          bid_id?: string | null
          closed_at?: string | null
          closed_by_user_id?: string | null
          closed_note?: string | null
          created_at?: string
          from_user_id: string
          id?: string
          job_ledger_id?: string | null
          links?: string[]
          location_lat?: number | null
          location_lng?: number | null
          pending_action?: string | null
          reference_summary?: string | null
          status?: string
          title: string
        }
        Update: {
          bid_id?: string | null
          closed_at?: string | null
          closed_by_user_id?: string | null
          closed_note?: string | null
          created_at?: string
          from_user_id?: string
          id?: string
          job_ledger_id?: string | null
          links?: string[]
          location_lat?: number | null
          location_lng?: number | null
          pending_action?: string | null
          reference_summary?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_requests_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_requests_closed_by_user_id_fkey"
            columns: ["closed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_requests_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_requests_job_ledger_id_fkey"
            columns: ["job_ledger_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
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
      estimate_catalog_item_events: {
        Row: {
          action: string
          edited_at: string
          editor_user_id: string
          id: string
          item_id: string
          new_amount_cents: number | null
          new_description: string | null
          new_line_item: string | null
          new_quantity: number | null
          new_unit_price_cents: number | null
          prev_amount_cents: number | null
          prev_description: string | null
          prev_line_item: string | null
          prev_quantity: number | null
          prev_unit_price_cents: number | null
        }
        Insert: {
          action: string
          edited_at?: string
          editor_user_id: string
          id?: string
          item_id: string
          new_amount_cents?: number | null
          new_description?: string | null
          new_line_item?: string | null
          new_quantity?: number | null
          new_unit_price_cents?: number | null
          prev_amount_cents?: number | null
          prev_description?: string | null
          prev_line_item?: string | null
          prev_quantity?: number | null
          prev_unit_price_cents?: number | null
        }
        Update: {
          action?: string
          edited_at?: string
          editor_user_id?: string
          id?: string
          item_id?: string
          new_amount_cents?: number | null
          new_description?: string | null
          new_line_item?: string | null
          new_quantity?: number | null
          new_unit_price_cents?: number | null
          prev_amount_cents?: number | null
          prev_description?: string | null
          prev_line_item?: string | null
          prev_quantity?: number | null
          prev_unit_price_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_catalog_item_events_editor_user_id_fkey"
            columns: ["editor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_catalog_item_events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estimate_catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_catalog_items: {
        Row: {
          amount_cents: number
          created_at: string
          deleted_at: string | null
          description: string
          id: string
          line_item: string
          quantity: number
          sort_order: number
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          deleted_at?: string | null
          description: string
          id?: string
          line_item?: string
          quantity?: number
          sort_order?: number
          unit_price_cents?: number
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          deleted_at?: string | null
          description?: string
          id?: string
          line_item?: string
          quantity?: number
          sort_order?: number
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      estimate_customer_events: {
        Row: {
          client_ip: string | null
          estimate_id: string
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          source: string
          user_agent: string | null
        }
        Insert: {
          client_ip?: string | null
          estimate_id: string
          event_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          source: string
          user_agent?: string | null
        }
        Update: {
          client_ip?: string | null
          estimate_id?: string
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          source?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_customer_events_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          accept_header_brand: string | null
          accept_notify_user_ids: string[] | null
          acceptor_consented_at: string | null
          acceptor_ip: string | null
          acceptor_printed_name: string | null
          acceptor_signature_storage_path: string | null
          acceptor_user_agent: string | null
          created_at: string
          created_by: string
          customer_attachment_label: string | null
          customer_attachment_sent: Json | null
          customer_attachment_url: string | null
          customer_email: string | null
          customer_experience_overrides: Json | null
          customer_experience_sent: Json | null
          customer_id: string | null
          estimate_number: number
          for_address: string | null
          id: string
          internal_notes: string | null
          job_ledger_id: string | null
          line_items_snapshot: Json
          master_user_id: string
          project_id: string | null
          public_token_expires_at: string | null
          public_token_hash: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["estimate_status"]
          terms_snapshot: string
          title: string
          total_cents: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          accept_header_brand?: string | null
          accept_notify_user_ids?: string[] | null
          acceptor_consented_at?: string | null
          acceptor_ip?: string | null
          acceptor_printed_name?: string | null
          acceptor_signature_storage_path?: string | null
          acceptor_user_agent?: string | null
          created_at?: string
          created_by: string
          customer_attachment_label?: string | null
          customer_attachment_sent?: Json | null
          customer_attachment_url?: string | null
          customer_email?: string | null
          customer_experience_overrides?: Json | null
          customer_experience_sent?: Json | null
          customer_id?: string | null
          estimate_number?: number
          for_address?: string | null
          id?: string
          internal_notes?: string | null
          job_ledger_id?: string | null
          line_items_snapshot?: Json
          master_user_id: string
          project_id?: string | null
          public_token_expires_at?: string | null
          public_token_hash?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["estimate_status"]
          terms_snapshot?: string
          title?: string
          total_cents?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          accept_header_brand?: string | null
          accept_notify_user_ids?: string[] | null
          acceptor_consented_at?: string | null
          acceptor_ip?: string | null
          acceptor_printed_name?: string | null
          acceptor_signature_storage_path?: string | null
          acceptor_user_agent?: string | null
          created_at?: string
          created_by?: string
          customer_attachment_label?: string | null
          customer_attachment_sent?: Json | null
          customer_attachment_url?: string | null
          customer_email?: string | null
          customer_experience_overrides?: Json | null
          customer_experience_sent?: Json | null
          customer_id?: string | null
          estimate_number?: number
          for_address?: string | null
          id?: string
          internal_notes?: string | null
          job_ledger_id?: string | null
          line_items_snapshot?: Json
          master_user_id?: string
          project_id?: string | null
          public_token_expires_at?: string | null
          public_token_hash?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["estimate_status"]
          terms_snapshot?: string
          title?: string
          total_cents?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_job_ledger_id_fkey"
            columns: ["job_ledger_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_master_user_id_fkey"
            columns: ["master_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates_thread_notes: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          estimate_id: string
          id: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          estimate_id: string
          id?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          estimate_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimates_thread_notes_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_thread_notes_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimator_group_members: {
        Row: {
          user_id: string
        }
        Insert: {
          user_id: string
        }
        Update: {
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimator_group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      estimator_request_dismissals: {
        Row: {
          dismissed_at: string
          request_id: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string
          request_id: string
          user_id: string
        }
        Update: {
          dismissed_at?: string
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimator_request_dismissals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "estimator_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      estimator_request_notes: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          id: string
          request_id: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          request_id: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimator_request_notes_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimator_request_notes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "estimator_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      estimator_requests: {
        Row: {
          bid_id: string | null
          closed_at: string | null
          closed_by_user_id: string | null
          closed_note: string | null
          created_at: string
          from_user_id: string
          id: string
          job_ledger_id: string | null
          links: string[]
          location_lat: number | null
          location_lng: number | null
          reference_summary: string | null
          status: string
          title: string
        }
        Insert: {
          bid_id?: string | null
          closed_at?: string | null
          closed_by_user_id?: string | null
          closed_note?: string | null
          created_at?: string
          from_user_id: string
          id?: string
          job_ledger_id?: string | null
          links?: string[]
          location_lat?: number | null
          location_lng?: number | null
          reference_summary?: string | null
          status?: string
          title: string
        }
        Update: {
          bid_id?: string | null
          closed_at?: string | null
          closed_by_user_id?: string | null
          closed_note?: string | null
          created_at?: string
          from_user_id?: string
          id?: string
          job_ledger_id?: string | null
          links?: string[]
          location_lat?: number | null
          location_lng?: number | null
          reference_summary?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimator_requests_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimator_requests_closed_by_user_id_fkey"
            columns: ["closed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimator_requests_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimator_requests_job_ledger_id_fkey"
            columns: ["job_ledger_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
            referencedColumns: ["id"]
          },
        ]
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
      gsa_per_diem_cache: {
        Row: {
          city: string | null
          county: string | null
          fetched_at: string
          hotel_rate_max: number | null
          meals_rate: number | null
          state: string | null
          year: number
          zip: string
        }
        Insert: {
          city?: string | null
          county?: string | null
          fetched_at?: string
          hotel_rate_max?: number | null
          meals_rate?: number | null
          state?: string | null
          year: number
          zip: string
        }
        Update: {
          city?: string | null
          county?: string | null
          fetched_at?: string
          hotel_rate_max?: number | null
          meals_rate?: number | null
          state?: string | null
          year?: number
          zip?: string
        }
        Relationships: []
      }
      help_feedback: {
        Row: {
          body: string
          closed_at: string | null
          closed_by_user_id: string | null
          closed_note: string | null
          created_at: string
          from_user_id: string
          guide_slug: string
          id: string
          status: string
        }
        Insert: {
          body: string
          closed_at?: string | null
          closed_by_user_id?: string | null
          closed_note?: string | null
          created_at?: string
          from_user_id: string
          guide_slug: string
          id?: string
          status?: string
        }
        Update: {
          body?: string
          closed_at?: string | null
          closed_by_user_id?: string | null
          closed_note?: string | null
          created_at?: string
          from_user_id?: string
          guide_slug?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_feedback_closed_by_user_id_fkey"
            columns: ["closed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_feedback_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hours_days_correct: {
        Row: {
          marked_at: string | null
          marked_by: string | null
          work_date: string
        }
        Insert: {
          marked_at?: string | null
          marked_by?: string | null
          work_date: string
        }
        Update: {
          marked_at?: string | null
          marked_by?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "hours_days_correct_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hours_reviewed: {
        Row: {
          end_date: string
          id: string
          person_id: string | null
          person_name: string
          reviewed_at: string
          reviewed_by: string
          start_date: string
        }
        Insert: {
          end_date: string
          id?: string
          person_id?: string | null
          person_name: string
          reviewed_at?: string
          reviewed_by: string
          start_date: string
        }
        Update: {
          end_date?: string
          id?: string
          person_id?: string | null
          person_name?: string
          reviewed_at?: string
          reviewed_by?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "hours_reviewed_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      housing_possessions: {
        Row: {
          created_at: string | null
          end_date: string | null
          housing_id: string
          id: string
          start_date: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          housing_id: string
          id?: string
          start_date: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          housing_id?: string
          id?: string
          start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "housing_possessions_housing_id_fkey"
            columns: ["housing_id"]
            isOneToOne: false
            referencedRelation: "housing_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housing_possessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      housing_units: {
        Row: {
          address: string
          created_at: string | null
          id: string
          insurance_per_week: number
          rent_per_week: number
          updated_at: string | null
          utilities_per_week: number
        }
        Insert: {
          address?: string
          created_at?: string | null
          id?: string
          insurance_per_week?: number
          rent_per_week?: number
          updated_at?: string | null
          utilities_per_week?: number
        }
        Update: {
          address?: string
          created_at?: string | null
          id?: string
          insurance_per_week?: number
          rent_per_week?: number
          updated_at?: string | null
          utilities_per_week?: number
        }
        Relationships: []
      }
      inspection_quick_links: {
        Row: {
          created_at: string | null
          id: string
          label: string
          sequence_order: number
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          label: string
          sequence_order?: number
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string
          sequence_order?: number
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      inspection_types: {
        Row: {
          created_at: string | null
          name: string
          sequence_order: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          name: string
          sequence_order?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          name?: string
          sequence_order?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      inspections: {
        Row: {
          address: string
          created_at: string | null
          created_by_user_id: string
          id: string
          inspection_type: string
          job_ledger_id: string | null
          project_id: string | null
          scheduled_date: string
          updated_at: string | null
        }
        Insert: {
          address: string
          created_at?: string | null
          created_by_user_id: string
          id?: string
          inspection_type: string
          job_ledger_id?: string | null
          project_id?: string | null
          scheduled_date: string
          updated_at?: string | null
        }
        Update: {
          address?: string
          created_at?: string | null
          created_by_user_id?: string
          id?: string
          inspection_type?: string
          job_ledger_id?: string | null
          project_id?: string | null
          scheduled_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_job_ledger_id_fkey"
            columns: ["job_ledger_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_type_fk"
            columns: ["inspection_type"]
            isOneToOne: false
            referencedRelation: "inspection_types"
            referencedColumns: ["name"]
          },
        ]
      }
      job_activity_events: {
        Row: {
          actor_user_id: string | null
          detail: Json
          event_type: string
          financial: boolean
          id: string
          job_id: string
          occurred_at: string
          summary: string
        }
        Insert: {
          actor_user_id?: string | null
          detail?: Json
          event_type: string
          financial?: boolean
          id?: string
          job_id: string
          occurred_at?: string
          summary?: string
        }
        Update: {
          actor_user_id?: string | null
          detail?: Json
          event_type?: string
          financial?: boolean
          id?: string
          job_id?: string
          occurred_at?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_activity_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_activity_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      job_book_entries: {
        Row: {
          created_at: string | null
          id: string
          sequence_order: number
          service_type_id: string | null
          unit_cost: number
          work_label: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          sequence_order?: number
          service_type_id?: string | null
          unit_cost: number
          work_label: string
        }
        Update: {
          created_at?: string | null
          id?: string
          sequence_order?: number
          service_type_id?: string | null
          unit_cost?: number
          work_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_book_entries_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      job_collect_payment_flows: {
        Row: {
          certified_at: string | null
          certify_mode: string | null
          correction_notes: string | null
          created_at: string
          dispatch_notes: string | null
          dispatch_reviewed_at: string | null
          dispatch_reviewed_by: string | null
          id: string
          initiated_by_user_id: string
          job_id: string
          jobs_ledger_invoice_id: string | null
          last_error: string | null
          per_line_notes: Json | null
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          certified_at?: string | null
          certify_mode?: string | null
          correction_notes?: string | null
          created_at?: string
          dispatch_notes?: string | null
          dispatch_reviewed_at?: string | null
          dispatch_reviewed_by?: string | null
          id?: string
          initiated_by_user_id: string
          job_id: string
          jobs_ledger_invoice_id?: string | null
          last_error?: string | null
          per_line_notes?: Json | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          certified_at?: string | null
          certify_mode?: string | null
          correction_notes?: string | null
          created_at?: string
          dispatch_notes?: string | null
          dispatch_reviewed_at?: string | null
          dispatch_reviewed_by?: string | null
          id?: string
          initiated_by_user_id?: string
          job_id?: string
          jobs_ledger_invoice_id?: string | null
          last_error?: string | null
          per_line_notes?: Json | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_collect_payment_flows_dispatch_reviewed_by_fkey"
            columns: ["dispatch_reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_collect_payment_flows_initiated_by_user_id_fkey"
            columns: ["initiated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_collect_payment_flows_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_collect_payment_flows_jobs_ledger_invoice_id_fkey"
            columns: ["jobs_ledger_invoice_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      job_schedule_blocks: {
        Row: {
          assignee_user_id: string
          created_at: string
          created_by: string | null
          id: string
          job_id: string
          note: string | null
          shared_block_group_id: string | null
          time_end: string
          time_start: string
          updated_at: string
          work_date: string
        }
        Insert: {
          assignee_user_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          job_id: string
          note?: string | null
          shared_block_group_id?: string | null
          time_end: string
          time_start: string
          updated_at?: string
          work_date: string
        }
        Update: {
          assignee_user_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string
          note?: string | null
          shared_block_group_id?: string | null
          time_end?: string
          time_start?: string
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_schedule_blocks_assignee_user_id_fkey"
            columns: ["assignee_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_schedule_blocks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_schedule_blocks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      job_status_events: {
        Row: {
          changed_at: string
          changed_by_user_id: string | null
          from_status: string | null
          id: string
          job_id: string
          to_status: string
        }
        Insert: {
          changed_at?: string
          changed_by_user_id?: string | null
          from_status?: string | null
          id?: string
          job_id: string
          to_status: string
        }
        Update: {
          changed_at?: string
          changed_by_user_id?: string | null
          from_status?: string | null
          id?: string
          job_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_status_events_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_status_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs_ledger: {
        Row: {
          bid_id: string | null
          click_number: string
          collections_at: string | null
          collections_by: string | null
          collections_note: string | null
          created_at: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          google_drive_link: string | null
          hcp_number: string
          id: string
          job_address: string
          job_name: string
          job_pictures_link: string | null
          job_plans_link: string | null
          last_bill_date: string | null
          last_work_date: string | null
          master_user_id: string
          payments_made: number | null
          pct_complete: number | null
          project_id: string | null
          revenue: number | null
          service_type_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          bid_id?: string | null
          click_number?: string
          collections_at?: string | null
          collections_by?: string | null
          collections_note?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          google_drive_link?: string | null
          hcp_number?: string
          id?: string
          job_address?: string
          job_name?: string
          job_pictures_link?: string | null
          job_plans_link?: string | null
          last_bill_date?: string | null
          last_work_date?: string | null
          master_user_id: string
          payments_made?: number | null
          pct_complete?: number | null
          project_id?: string | null
          revenue?: number | null
          service_type_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          bid_id?: string | null
          click_number?: string
          collections_at?: string | null
          collections_by?: string | null
          collections_note?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          google_drive_link?: string | null
          hcp_number?: string
          id?: string
          job_address?: string
          job_name?: string
          job_pictures_link?: string | null
          job_plans_link?: string | null
          last_bill_date?: string | null
          last_work_date?: string | null
          master_user_id?: string
          payments_made?: number | null
          pct_complete?: number | null
          project_id?: string | null
          revenue?: number | null
          service_type_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_ledger_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_ledger_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_ledger_master_user_id_fkey"
            columns: ["master_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_ledger_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_ledger_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs_ledger_fixtures: {
        Row: {
          count: number
          created_at: string | null
          id: string
          job_id: string
          line_description: string | null
          line_unit_price: number | null
          name: string
          sequence_order: number
        }
        Insert: {
          count?: number
          created_at?: string | null
          id?: string
          job_id: string
          line_description?: string | null
          line_unit_price?: number | null
          name?: string
          sequence_order?: number
        }
        Update: {
          count?: number
          created_at?: string | null
          id?: string
          job_id?: string
          line_description?: string | null
          line_unit_price?: number | null
          name?: string
          sequence_order?: number
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
      jobs_ledger_invoice_stripe_email_sends: {
        Row: {
          created_at: string | null
          id: string
          jobs_ledger_invoice_id: string
          sent_at: string
          stripe_invoice_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          jobs_ledger_invoice_id: string
          sent_at: string
          stripe_invoice_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          jobs_ledger_invoice_id?: string
          sent_at?: string
          stripe_invoice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_ledger_invoice_stripe_email_se_jobs_ledger_invoice_id_fkey"
            columns: ["jobs_ledger_invoice_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs_ledger_invoices: {
        Row: {
          agreed_write_down_at: string | null
          agreed_write_down_by: string | null
          agreed_write_down_note: string | null
          agreed_write_down_previous_amount: number | null
          agreed_write_down_stripe_credit_note_id: string | null
          amount: number
          billed_at: string | null
          created_at: string | null
          estimated_bill_date: string | null
          external_send_channel: string | null
          external_send_note: string | null
          hosted_invoice_url: string | null
          id: string
          is_primary_rtb_bundle: boolean
          job_id: string
          sent_to_customer_at: string | null
          sequence_order: number
          status: string
          stripe_invoice_footer: string | null
          stripe_invoice_id: string | null
          stripe_invoice_memo: string | null
          stripe_invoice_status: string | null
        }
        Insert: {
          agreed_write_down_at?: string | null
          agreed_write_down_by?: string | null
          agreed_write_down_note?: string | null
          agreed_write_down_previous_amount?: number | null
          agreed_write_down_stripe_credit_note_id?: string | null
          amount: number
          billed_at?: string | null
          created_at?: string | null
          estimated_bill_date?: string | null
          external_send_channel?: string | null
          external_send_note?: string | null
          hosted_invoice_url?: string | null
          id?: string
          is_primary_rtb_bundle?: boolean
          job_id: string
          sent_to_customer_at?: string | null
          sequence_order?: number
          status?: string
          stripe_invoice_footer?: string | null
          stripe_invoice_id?: string | null
          stripe_invoice_memo?: string | null
          stripe_invoice_status?: string | null
        }
        Update: {
          agreed_write_down_at?: string | null
          agreed_write_down_by?: string | null
          agreed_write_down_note?: string | null
          agreed_write_down_previous_amount?: number | null
          agreed_write_down_stripe_credit_note_id?: string | null
          amount?: number
          billed_at?: string | null
          created_at?: string | null
          estimated_bill_date?: string | null
          external_send_channel?: string | null
          external_send_note?: string | null
          hosted_invoice_url?: string | null
          id?: string
          is_primary_rtb_bundle?: boolean
          job_id?: string
          sent_to_customer_at?: string | null
          sequence_order?: number
          status?: string
          stripe_invoice_footer?: string | null
          stripe_invoice_id?: string | null
          stripe_invoice_memo?: string | null
          stripe_invoice_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_ledger_invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
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
      jobs_ledger_payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          invoice_id: string | null
          job_id: string
          mercury_transaction_id: string | null
          note: string | null
          paid_on: string | null
          payment_type: string | null
          reference_number: string | null
          sequence_order: number
        }
        Insert: {
          amount?: number
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          job_id: string
          mercury_transaction_id?: string | null
          note?: string | null
          paid_on?: string | null
          payment_type?: string | null
          reference_number?: string | null
          sequence_order?: number
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          job_id?: string
          mercury_transaction_id?: string | null
          note?: string | null
          paid_on?: string | null
          payment_type?: string | null
          reference_number?: string | null
          sequence_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "jobs_ledger_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_ledger_payments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_ledger_payments_mercury_transaction_id_fkey"
            columns: ["mercury_transaction_id"]
            isOneToOne: false
            referencedRelation: "mercury_transactions"
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
      jobs_ledger_thread_notes: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          id: string
          job_id: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          job_id: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_ledger_thread_notes_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_ledger_thread_notes_job_id_fkey"
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
      jobs_tally_parts: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          fixture_cost: number | null
          fixture_name: string
          id: string
          job_id: string
          part_id: string | null
          purchase_order_id: string | null
          quantity: number
          sequence_order: number
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          fixture_cost?: number | null
          fixture_name?: string
          id?: string
          job_id: string
          part_id?: string | null
          purchase_order_id?: string | null
          quantity?: number
          sequence_order?: number
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          fixture_cost?: number | null
          fixture_name?: string
          id?: string
          job_id?: string
          part_id?: string | null
          purchase_order_id?: string | null
          quantity?: number
          sequence_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "jobs_tally_parts_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_tally_parts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_tally_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "material_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_tally_parts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          created_at: string
          id: string
          master_user_id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          master_user_id: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          master_user_id?: string
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "labels_master_user_id_fkey"
            columns: ["master_user_id"]
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
      master_primaries: {
        Row: {
          created_at: string | null
          master_id: string
          primary_id: string
        }
        Insert: {
          created_at?: string | null
          master_id: string
          primary_id: string
        }
        Update: {
          created_at?: string | null
          master_id?: string
          primary_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_primaries_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_primaries_primary_id_fkey"
            columns: ["primary_id"]
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
      master_superintendents: {
        Row: {
          created_at: string | null
          master_id: string
          superintendent_id: string
        }
        Insert: {
          created_at?: string | null
          master_id: string
          superintendent_id: string
        }
        Update: {
          created_at?: string | null
          master_id?: string
          superintendent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_superintendents_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_superintendents_superintendent_id_fkey"
            columns: ["superintendent_id"]
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
          link: string | null
          manufacturer: string | null
          name: string
          notes: string | null
          part_type_id: string | null
          service_type_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          link?: string | null
          manufacturer?: string | null
          name: string
          notes?: string | null
          part_type_id?: string | null
          service_type_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          link?: string | null
          manufacturer?: string | null
          name?: string
          notes?: string | null
          part_type_id?: string | null
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
      material_po_generator_entries: {
        Row: {
          created_at: string
          created_by: string
          for_user_id: string
          id: string
          job_ledger_id: string
          notes: string | null
          po_code: number
          supply_house_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          for_user_id: string
          id?: string
          job_ledger_id: string
          notes?: string | null
          po_code: number
          supply_house_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          for_user_id?: string
          id?: string
          job_ledger_id?: string
          notes?: string | null
          po_code?: number
          supply_house_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_po_generator_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_po_generator_entries_for_user_id_fkey"
            columns: ["for_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_po_generator_entries_job_ledger_id_fkey"
            columns: ["job_ledger_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_po_generator_entries_supply_house_id_fkey"
            columns: ["supply_house_id"]
            isOneToOne: false
            referencedRelation: "supply_houses"
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
      material_template_prices: {
        Row: {
          created_at: string | null
          effective_date: string | null
          id: string
          price: number
          supply_house_id: string
          template_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          effective_date?: string | null
          id?: string
          price: number
          supply_house_id: string
          template_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          effective_date?: string | null
          id?: string
          price?: number
          supply_house_id?: string
          template_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_template_prices_supply_house_id_fkey"
            columns: ["supply_house_id"]
            isOneToOne: false
            referencedRelation: "supply_houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_template_prices_template_id_fkey"
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
      mercury_account_nicknames: {
        Row: {
          mercury_account_id: string
          nickname: string
          updated_at: string
        }
        Insert: {
          mercury_account_id: string
          nickname: string
          updated_at?: string
        }
        Update: {
          mercury_account_id?: string
          nickname?: string
          updated_at?: string
        }
        Relationships: []
      }
      mercury_accounting_label_rules: {
        Row: {
          created_at: string
          created_by: string | null
          criteria: Json
          enabled: boolean
          id: string
          label_id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          criteria?: Json
          enabled?: boolean
          id?: string
          label_id: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          criteria?: Json
          enabled?: boolean
          id?: string
          label_id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mercury_accounting_label_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercury_accounting_label_rules_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "mercury_drag_sort_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      mercury_accounting_label_suggestions: {
        Row: {
          created_at: string
          final_label_id: string | null
          id: string
          mercury_transaction_id: string
          resolved_at: string | null
          resolved_by: string | null
          rule_id: string
          status: string
          suggested_label_id: string
        }
        Insert: {
          created_at?: string
          final_label_id?: string | null
          id?: string
          mercury_transaction_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          rule_id: string
          status: string
          suggested_label_id: string
        }
        Update: {
          created_at?: string
          final_label_id?: string | null
          id?: string
          mercury_transaction_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          rule_id?: string
          status?: string
          suggested_label_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mercury_accounting_label_suggestion_mercury_transaction_id_fkey"
            columns: ["mercury_transaction_id"]
            isOneToOne: false
            referencedRelation: "mercury_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercury_accounting_label_suggestions_final_label_id_fkey"
            columns: ["final_label_id"]
            isOneToOne: false
            referencedRelation: "mercury_drag_sort_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercury_accounting_label_suggestions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercury_accounting_label_suggestions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "mercury_accounting_label_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercury_accounting_label_suggestions_suggested_label_id_fkey"
            columns: ["suggested_label_id"]
            isOneToOne: false
            referencedRelation: "mercury_drag_sort_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      mercury_debit_card_nicknames: {
        Row: {
          mercury_debit_card_id: string
          nickname: string
          updated_at: string
        }
        Insert: {
          mercury_debit_card_id: string
          nickname: string
          updated_at?: string
        }
        Update: {
          mercury_debit_card_id?: string
          nickname?: string
          updated_at?: string
        }
        Relationships: []
      }
      mercury_debit_card_user_links: {
        Row: {
          auto_assign_user_id: string | null
          created_at: string
          created_by: string | null
          mercury_debit_card_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_assign_user_id?: string | null
          created_at?: string
          created_by?: string | null
          mercury_debit_card_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_assign_user_id?: string | null
          created_at?: string
          created_by?: string | null
          mercury_debit_card_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mercury_debit_card_user_links_auto_assign_user_id_fkey"
            columns: ["auto_assign_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercury_debit_card_user_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mercury_drag_sort_labels: {
        Row: {
          account_type: string | null
          created_at: string
          default_key: string | null
          description: string | null
          id: string
          is_system_default: boolean
          name: string
          schedule_c_line: string | null
          sort_order: number
        }
        Insert: {
          account_type?: string | null
          created_at?: string
          default_key?: string | null
          description?: string | null
          id?: string
          is_system_default?: boolean
          name: string
          schedule_c_line?: string | null
          sort_order?: number
        }
        Update: {
          account_type?: string | null
          created_at?: string
          default_key?: string | null
          description?: string | null
          id?: string
          is_system_default?: boolean
          name?: string
          schedule_c_line?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      mercury_tally_payroll_flags: {
        Row: {
          created_at: string
          created_by: string | null
          is_payroll: boolean
          mercury_transaction_id: string
          rule_id: string | null
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          is_payroll: boolean
          mercury_transaction_id: string
          rule_id?: string | null
          source: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          is_payroll?: boolean
          mercury_transaction_id?: string
          rule_id?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mercury_tally_payroll_flags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercury_tally_payroll_flags_mercury_transaction_id_fkey"
            columns: ["mercury_transaction_id"]
            isOneToOne: true
            referencedRelation: "mercury_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercury_tally_payroll_flags_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "mercury_tally_payroll_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      mercury_tally_payroll_rules: {
        Row: {
          created_at: string
          created_by: string | null
          criteria: Json
          enabled: boolean
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          criteria?: Json
          enabled?: boolean
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          criteria?: Json
          enabled?: boolean
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mercury_tally_payroll_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mercury_tally_transaction_notes: {
        Row: {
          body: string
          id: string
          mercury_transaction_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          id?: string
          mercury_transaction_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          id?: string
          mercury_transaction_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mercury_tally_transaction_notes_mercury_transaction_id_fkey"
            columns: ["mercury_transaction_id"]
            isOneToOne: false
            referencedRelation: "mercury_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      mercury_transaction_ar_returned: {
        Row: {
          mercury_transaction_id: string
          returned: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          mercury_transaction_id: string
          returned?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          mercury_transaction_id?: string
          returned?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mercury_transaction_ar_returned_mercury_transaction_id_fkey"
            columns: ["mercury_transaction_id"]
            isOneToOne: true
            referencedRelation: "mercury_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercury_transaction_ar_returned_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mercury_transaction_attributions: {
        Row: {
          mercury_transaction_id: string
          person_id: string | null
          user_id: string | null
        }
        Insert: {
          mercury_transaction_id: string
          person_id?: string | null
          user_id?: string | null
        }
        Update: {
          mercury_transaction_id?: string
          person_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mercury_transaction_attributions_mercury_transaction_id_fkey"
            columns: ["mercury_transaction_id"]
            isOneToOne: true
            referencedRelation: "mercury_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercury_transaction_attributions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      mercury_transaction_drag_sort_assignments: {
        Row: {
          assigned_at: string
          label_id: string
          mercury_transaction_id: string
        }
        Insert: {
          assigned_at?: string
          label_id: string
          mercury_transaction_id: string
        }
        Update: {
          assigned_at?: string
          label_id?: string
          mercury_transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mercury_transaction_drag_sort_assig_mercury_transaction_id_fkey"
            columns: ["mercury_transaction_id"]
            isOneToOne: true
            referencedRelation: "mercury_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercury_transaction_drag_sort_assignments_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "mercury_drag_sort_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      mercury_transaction_duplicate_dismissals: {
        Row: {
          dismissed_at: string
          dismissed_by: string | null
          id_hi: string
          id_lo: string
        }
        Insert: {
          dismissed_at?: string
          dismissed_by?: string | null
          id_hi: string
          id_lo: string
        }
        Update: {
          dismissed_at?: string
          dismissed_by?: string | null
          id_hi?: string
          id_lo?: string
        }
        Relationships: [
          {
            foreignKeyName: "mercury_transaction_duplicate_dismissals_id_hi_fkey"
            columns: ["id_hi"]
            isOneToOne: false
            referencedRelation: "mercury_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercury_transaction_duplicate_dismissals_id_lo_fkey"
            columns: ["id_lo"]
            isOneToOne: false
            referencedRelation: "mercury_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      mercury_transaction_job_allocations: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          job_id: string
          mercury_transaction_id: string
          note: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          job_id: string
          mercury_transaction_id: string
          note?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string
          mercury_transaction_id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mercury_transaction_job_allocations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercury_transaction_job_allocations_mercury_transaction_id_fkey"
            columns: ["mercury_transaction_id"]
            isOneToOne: false
            referencedRelation: "mercury_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      mercury_transaction_org_notes: {
        Row: {
          body: string
          mercury_transaction_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string
          mercury_transaction_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          mercury_transaction_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mercury_transaction_org_notes_mercury_transaction_id_fkey"
            columns: ["mercury_transaction_id"]
            isOneToOne: true
            referencedRelation: "mercury_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      mercury_transaction_supply_house_invoice_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          mercury_transaction_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          mercury_transaction_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          mercury_transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mercury_transaction_supply_house_in_mercury_transaction_id_fkey"
            columns: ["mercury_transaction_id"]
            isOneToOne: false
            referencedRelation: "mercury_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercury_transaction_supply_house_invoice_links_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "supply_house_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      mercury_transactions: {
        Row: {
          amount: number
          counterparty_id: string | null
          counterparty_name: string | null
          created_at: string
          created_by: string | null
          currency: string
          dashboard_link: string | null
          duplicate_of_transaction_id: string | null
          external_memo: string | null
          id: string
          kind: string
          manual_upload_id: string | null
          mercury_account_id: string
          mercury_category: Json | null
          mercury_id: string | null
          note: string | null
          posted_at: string | null
          raw: Json | null
          source: string
          status: string
          synced_at: string
        }
        Insert: {
          amount: number
          counterparty_id?: string | null
          counterparty_name?: string | null
          created_at: string
          created_by?: string | null
          currency?: string
          dashboard_link?: string | null
          duplicate_of_transaction_id?: string | null
          external_memo?: string | null
          id?: string
          kind: string
          manual_upload_id?: string | null
          mercury_account_id: string
          mercury_category?: Json | null
          mercury_id?: string | null
          note?: string | null
          posted_at?: string | null
          raw?: Json | null
          source?: string
          status: string
          synced_at?: string
        }
        Update: {
          amount?: number
          counterparty_id?: string | null
          counterparty_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          dashboard_link?: string | null
          duplicate_of_transaction_id?: string | null
          external_memo?: string | null
          id?: string
          kind?: string
          manual_upload_id?: string | null
          mercury_account_id?: string
          mercury_category?: Json | null
          mercury_id?: string | null
          note?: string | null
          posted_at?: string | null
          raw?: Json | null
          source?: string
          status?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mercury_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercury_transactions_duplicate_of_transaction_id_fkey"
            columns: ["duplicate_of_transaction_id"]
            isOneToOne: false
            referencedRelation: "mercury_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      mercury_webhook_events: {
        Row: {
          event_key: string
          received_at: string
          resource_id: string | null
          resource_type: string | null
        }
        Insert: {
          event_key: string
          received_at?: string
          resource_id?: string | null
          resource_type?: string | null
        }
        Update: {
          event_key?: string
          received_at?: string
          resource_id?: string | null
          resource_type?: string | null
        }
        Relationships: []
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
      pay_stub_additional_lines: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          line_total: number | null
          pay_stub_id: string
          quantity: number
          rate: number
          source_clock_session_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          line_total?: number | null
          pay_stub_id: string
          quantity: number
          rate: number
          source_clock_session_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          line_total?: number | null
          pay_stub_id?: string
          quantity?: number
          rate?: number
          source_clock_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pay_stub_additional_lines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_stub_additional_lines_pay_stub_id_fkey"
            columns: ["pay_stub_id"]
            isOneToOne: false
            referencedRelation: "pay_stubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_stub_additional_lines_source_clock_session_id_fkey"
            columns: ["source_clock_session_id"]
            isOneToOne: false
            referencedRelation: "clock_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_stub_days: {
        Row: {
          created_at: string | null
          hours_at_time: number
          id: string
          job_hours: number | null
          job_rate: number | null
          office_hours: number | null
          office_rate: number | null
          paid_amount: number
          pay_stub_id: string
          person_id: string | null
          person_name: string
          rate_at_time: number
          work_date: string
        }
        Insert: {
          created_at?: string | null
          hours_at_time: number
          id?: string
          job_hours?: number | null
          job_rate?: number | null
          office_hours?: number | null
          office_rate?: number | null
          paid_amount: number
          pay_stub_id: string
          person_id?: string | null
          person_name: string
          rate_at_time: number
          work_date: string
        }
        Update: {
          created_at?: string | null
          hours_at_time?: number
          id?: string
          job_hours?: number | null
          job_rate?: number | null
          office_hours?: number | null
          office_rate?: number | null
          paid_amount?: number
          pay_stub_id?: string
          person_id?: string | null
          person_name?: string
          rate_at_time?: number
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_stub_days_pay_stub_id_fkey"
            columns: ["pay_stub_id"]
            isOneToOne: false
            referencedRelation: "pay_stubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_stub_days_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_stub_deductions: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          pay_stub_id: string
          person_offset_id: string | null
          source: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          pay_stub_id: string
          person_offset_id?: string | null
          source: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          pay_stub_id?: string
          person_offset_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_stub_deductions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_stub_deductions_pay_stub_id_fkey"
            columns: ["pay_stub_id"]
            isOneToOne: false
            referencedRelation: "pay_stubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_stub_deductions_person_offset_id_fkey"
            columns: ["person_offset_id"]
            isOneToOne: false
            referencedRelation: "person_offsets"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_stub_payments: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          id: string
          memo: string | null
          paid_at: string
          pay_stub_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          memo?: string | null
          paid_at: string
          pay_stub_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          memo?: string | null
          paid_at?: string
          pay_stub_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_stub_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_stub_payments_pay_stub_id_fkey"
            columns: ["pay_stub_id"]
            isOneToOne: false
            referencedRelation: "pay_stubs"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_stubs: {
        Row: {
          created_at: string | null
          created_by: string | null
          gross_pay: number
          hours_total: number
          id: string
          paid_at: string | null
          paid_by: string | null
          paid_note: string | null
          period_end: string
          period_start: string
          person_id: string | null
          person_name: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          gross_pay: number
          hours_total: number
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          paid_note?: string | null
          period_end: string
          period_start: string
          person_id?: string | null
          person_name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          gross_pay?: number
          hours_total?: number
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          paid_note?: string | null
          period_end?: string
          period_start?: string
          person_id?: string | null
          person_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_stubs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_stubs_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_stubs_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          account_user_id: string | null
          archived_at: string | null
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
          account_user_id?: string | null
          archived_at?: string | null
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
          account_user_id?: string | null
          archived_at?: string | null
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
            foreignKeyName: "people_account_user_id_fkey"
            columns: ["account_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_master_user_id_fkey"
            columns: ["master_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      people_cost_matrix_tags: {
        Row: {
          person_id: string | null
          person_name: string
          tags: string
        }
        Insert: {
          person_id?: string | null
          person_name: string
          tags?: string
        }
        Update: {
          person_id?: string | null
          person_name?: string
          tags?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_cost_matrix_tags_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      people_crew_bids: {
        Row: {
          bid_assignments: Json
          crew_lead_person_name: string | null
          person_id: string | null
          person_name: string
          work_date: string
        }
        Insert: {
          bid_assignments?: Json
          crew_lead_person_name?: string | null
          person_id?: string | null
          person_name: string
          work_date: string
        }
        Update: {
          bid_assignments?: Json
          crew_lead_person_name?: string | null
          person_id?: string | null
          person_name?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_crew_bids_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      people_crew_jobs: {
        Row: {
          crew_lead_person_name: string | null
          job_assignments: Json
          person_id: string | null
          person_name: string
          work_date: string
        }
        Insert: {
          crew_lead_person_name?: string | null
          job_assignments?: Json
          person_id?: string | null
          person_name: string
          work_date: string
        }
        Update: {
          crew_lead_person_name?: string | null
          job_assignments?: Json
          person_id?: string | null
          person_name?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_crew_jobs_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
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
          person_id: string | null
          person_name: string
          work_date: string
        }
        Insert: {
          created_at?: string | null
          entered_by?: string | null
          hours?: number
          id?: string
          person_id?: string | null
          person_name: string
          work_date: string
        }
        Update: {
          created_at?: string | null
          entered_by?: string | null
          hours?: number
          id?: string
          person_id?: string | null
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
          {
            foreignKeyName: "people_hours_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      people_hours_display_order: {
        Row: {
          person_id: string | null
          person_name: string
          sequence_order: number
        }
        Insert: {
          person_id?: string | null
          person_name: string
          sequence_order?: number
        }
        Update: {
          person_id?: string | null
          person_name?: string
          sequence_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "people_hours_display_order_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      people_labels: {
        Row: {
          label_id: string
          person_id: string
        }
        Insert: {
          label_id: string
          person_id: string
        }
        Update: {
          label_id?: string
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_labels_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      people_labor_job_items: {
        Row: {
          count: number
          created_at: string | null
          direct_labor_amount: number | null
          fixture: string
          hrs_per_unit: number
          id: string
          is_fixed: boolean
          job_id: string
          labor_rate: number | null
          sequence_order: number
        }
        Insert: {
          count?: number
          created_at?: string | null
          direct_labor_amount?: number | null
          fixture?: string
          hrs_per_unit?: number
          id?: string
          is_fixed?: boolean
          job_id: string
          labor_rate?: number | null
          sequence_order?: number
        }
        Update: {
          count?: number
          created_at?: string | null
          direct_labor_amount?: number | null
          fixture?: string
          hrs_per_unit?: number
          id?: string
          is_fixed?: boolean
          job_id?: string
          labor_rate?: number | null
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
      people_labor_job_payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          job_id: string
          memo: string | null
          sequence_order: number
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          job_id: string
          memo?: string | null
          sequence_order?: number
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          job_id?: string
          memo?: string | null
          sequence_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "people_labor_job_payments_job_id_fkey"
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
          invoice_link: string | null
          job_date: string | null
          job_number: string | null
          labor_rate: number | null
          master_user_id: string
          paid_at: string | null
        }
        Insert: {
          address?: string
          assigned_to_name: string
          created_at?: string | null
          distance_miles?: number | null
          id?: string
          invoice_link?: string | null
          job_date?: string | null
          job_number?: string | null
          labor_rate?: number | null
          master_user_id: string
          paid_at?: string | null
        }
        Update: {
          address?: string
          assigned_to_name?: string
          created_at?: string | null
          distance_miles?: number | null
          id?: string
          invoice_link?: string | null
          job_date?: string | null
          job_number?: string | null
          labor_rate?: number | null
          master_user_id?: string
          paid_at?: string | null
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
          office_hourly_wage: number | null
          person_id: string | null
          person_name: string
          record_hours_but_salary: boolean
          show_in_cost_matrix: boolean
          show_in_hours: boolean
        }
        Insert: {
          hourly_wage?: number | null
          is_salary?: boolean
          office_hourly_wage?: number | null
          person_id?: string | null
          person_name: string
          record_hours_but_salary?: boolean
          show_in_cost_matrix?: boolean
          show_in_hours?: boolean
        }
        Update: {
          hourly_wage?: number | null
          is_salary?: boolean
          office_hourly_wage?: number | null
          person_id?: string | null
          person_name?: string
          record_hours_but_salary?: boolean
          show_in_cost_matrix?: boolean
          show_in_hours?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "people_pay_config_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      people_team_members: {
        Row: {
          person_id: string | null
          person_name: string
          team_id: string
        }
        Insert: {
          person_id?: string | null
          person_name: string
          team_id: string
        }
        Update: {
          person_id?: string | null
          person_name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_team_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
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
      person_contract_assignments: {
        Row: {
          created_at: string | null
          id: string
          person_name: string
          template_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          person_name: string
          template_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          person_name?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_contract_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      person_contract_documents: {
        Row: {
          applied_contract_template_document_id: string | null
          canonical_document_url: string | null
          contract_lineage_id: string
          created_at: string | null
          dashboard_prompt_after_clock_in: boolean
          document_name: string
          id: string
          lineage_version: number
          note: string | null
          person_name: string
          public_token_expires_at: string | null
          public_token_hash: string | null
          sent_at: string | null
          signed_at: string | null
          signer_consented_at: string | null
          signer_ip: string | null
          signer_printed_name: string | null
          signer_signature_storage_path: string | null
          signer_user_agent: string | null
          signing_body_format: string
          signing_body_html: string | null
          status: string
          supersedes_person_contract_document_id: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          applied_contract_template_document_id?: string | null
          canonical_document_url?: string | null
          contract_lineage_id: string
          created_at?: string | null
          dashboard_prompt_after_clock_in?: boolean
          document_name: string
          id?: string
          lineage_version?: number
          note?: string | null
          person_name: string
          public_token_expires_at?: string | null
          public_token_hash?: string | null
          sent_at?: string | null
          signed_at?: string | null
          signer_consented_at?: string | null
          signer_ip?: string | null
          signer_printed_name?: string | null
          signer_signature_storage_path?: string | null
          signer_user_agent?: string | null
          signing_body_format?: string
          signing_body_html?: string | null
          status?: string
          supersedes_person_contract_document_id?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          applied_contract_template_document_id?: string | null
          canonical_document_url?: string | null
          contract_lineage_id?: string
          created_at?: string | null
          dashboard_prompt_after_clock_in?: boolean
          document_name?: string
          id?: string
          lineage_version?: number
          note?: string | null
          person_name?: string
          public_token_expires_at?: string | null
          public_token_hash?: string | null
          sent_at?: string | null
          signed_at?: string | null
          signer_consented_at?: string | null
          signer_ip?: string | null
          signer_printed_name?: string | null
          signer_signature_storage_path?: string | null
          signer_user_agent?: string | null
          signing_body_format?: string
          signing_body_html?: string | null
          status?: string
          supersedes_person_contract_document_id?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_contract_documents_applied_contract_template_docume_fkey"
            columns: ["applied_contract_template_document_id"]
            isOneToOne: false
            referencedRelation: "contract_template_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_contract_documents_supersedes_fkey"
            columns: ["supersedes_person_contract_document_id"]
            isOneToOne: false
            referencedRelation: "person_contract_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      person_license_cost_lines: {
        Row: {
          amount: number
          created_at: string | null
          date: string
          id: string
          note: string | null
          person_license_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          date: string
          id?: string
          note?: string | null
          person_license_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          date?: string
          id?: string
          note?: string | null
          person_license_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_license_cost_lines_person_license_id_fkey"
            columns: ["person_license_id"]
            isOneToOne: false
            referencedRelation: "person_licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      person_licenses: {
        Row: {
          created_at: string | null
          date_of_expiry: string
          expiry_dispatch_notified_at: string | null
          id: string
          license_type: string
          note: string | null
          person_name: string
        }
        Insert: {
          created_at?: string | null
          date_of_expiry: string
          expiry_dispatch_notified_at?: string | null
          id?: string
          license_type: string
          note?: string | null
          person_name: string
        }
        Update: {
          created_at?: string | null
          date_of_expiry?: string
          expiry_dispatch_notified_at?: string | null
          id?: string
          license_type?: string
          note?: string | null
          person_name?: string
        }
        Relationships: []
      }
      person_offsets: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          occurred_date: string
          pay_stub_id: string | null
          person_id: string | null
          person_name: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          occurred_date: string
          pay_stub_id?: string | null
          person_id?: string | null
          person_name: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          occurred_date?: string
          pay_stub_id?: string | null
          person_id?: string | null
          person_name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_offsets_pay_stub_id_fkey"
            columns: ["pay_stub_id"]
            isOneToOne: false
            referencedRelation: "pay_stubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_offsets_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
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
          bid_id: string | null
          bid_version_id: string | null
          created_at: string | null
          id: string
          include_in_submission: boolean
          name: string
          service_type_id: string
          sort_order: number
          source_version_id: string | null
        }
        Insert: {
          bid_id?: string | null
          bid_version_id?: string | null
          created_at?: string | null
          id?: string
          include_in_submission?: boolean
          name: string
          service_type_id: string
          sort_order?: number
          source_version_id?: string | null
        }
        Update: {
          bid_id?: string | null
          bid_version_id?: string | null
          created_at?: string | null
          id?: string
          include_in_submission?: boolean
          name?: string
          service_type_id?: string
          sort_order?: number
          source_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_book_versions_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_book_versions_bid_version_id_fkey"
            columns: ["bid_version_id"]
            isOneToOne: false
            referencedRelation: "bid_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_book_versions_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_book_versions_source_version_id_fkey"
            columns: ["source_version_id"]
            isOneToOne: false
            referencedRelation: "price_book_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_superintendents: {
        Row: {
          created_at: string | null
          project_id: string
          superintendent_id: string
        }
        Insert: {
          created_at?: string | null
          project_id: string
          superintendent_id: string
        }
        Update: {
          created_at?: string | null
          project_id?: string
          superintendent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_superintendents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_superintendents_superintendent_id_fkey"
            columns: ["superintendent_id"]
            isOneToOne: false
            referencedRelation: "users"
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
          percent_complete: number | null
          private_notes: string | null
          rejection_reason: string | null
          scheduled_end_date: string | null
          scheduled_start_date: string | null
          sequence_order: number
          skipped_reason: string | null
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
          percent_complete?: number | null
          private_notes?: string | null
          rejection_reason?: string | null
          scheduled_end_date?: string | null
          scheduled_start_date?: string | null
          sequence_order: number
          skipped_reason?: string | null
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
          percent_complete?: number | null
          private_notes?: string | null
          rejection_reason?: string | null
          scheduled_end_date?: string | null
          scheduled_start_date?: string | null
          sequence_order?: number
          skipped_reason?: string | null
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
          project_number: string | null
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
          project_number?: string | null
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
          project_number?: string | null
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
      prospect_callbacks: {
        Row: {
          callback_date: string
          created_at: string | null
          id: string
          note: string | null
          prospect_id: string
          title: string | null
          user_id: string
        }
        Insert: {
          callback_date: string
          created_at?: string | null
          id?: string
          note?: string | null
          prospect_id: string
          title?: string | null
          user_id: string
        }
        Update: {
          callback_date?: string
          created_at?: string | null
          id?: string
          note?: string | null
          prospect_id?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_callbacks_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_callbacks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_calling_locks: {
        Row: {
          locked_at: string | null
          prospect_id: string
          user_id: string
        }
        Insert: {
          locked_at?: string | null
          prospect_id: string
          user_id: string
        }
        Update: {
          locked_at?: string | null
          prospect_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_calling_locks_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: true
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_calling_locks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_comments: {
        Row: {
          comment_text: string
          created_at: string | null
          created_by: string
          id: string
          interaction_type: string
          prospect_id: string
        }
        Insert: {
          comment_text: string
          created_at?: string | null
          created_by: string
          id?: string
          interaction_type: string
          prospect_id: string
        }
        Update: {
          comment_text?: string
          created_at?: string | null
          created_by?: string
          id?: string
          interaction_type?: string
          prospect_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_comments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_comments_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_email_sent: {
        Row: {
          created_at: string | null
          prospect_id: string
          template_key: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          prospect_id: string
          template_key: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          prospect_id?: string
          template_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_email_sent_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_email_sent_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_timer_events: {
        Row: {
          button_name: string
          created_at: string | null
          id: string
          prospect_id: string | null
          timer_seconds: number
          user_id: string
        }
        Insert: {
          button_name: string
          created_at?: string | null
          id?: string
          prospect_id?: string | null
          timer_seconds: number
          user_id: string
        }
        Update: {
          button_name?: string
          created_at?: string | null
          id?: string
          prospect_id?: string | null
          timer_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_timer_events_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_timer_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          address: string | null
          company_name: string | null
          contact_name: string | null
          created_at: string | null
          created_by: string
          email: string | null
          id: string
          last_contact: string | null
          links_to_website: string | null
          master_user_id: string
          notes: string | null
          phone_number: string | null
          prospect_fit_status: string | null
          updated_at: string | null
          warmth_count: number | null
          warmth_value: string | null
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          created_by: string
          email?: string | null
          id?: string
          last_contact?: string | null
          links_to_website?: string | null
          master_user_id: string
          notes?: string | null
          phone_number?: string | null
          prospect_fit_status?: string | null
          updated_at?: string | null
          warmth_count?: number | null
          warmth_value?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          created_by?: string
          email?: string | null
          id?: string
          last_contact?: string | null
          links_to_website?: string | null
          master_user_id?: string
          notes?: string | null
          phone_number?: string | null
          prospect_fit_status?: string | null
          updated_at?: string | null
          warmth_count?: number | null
          warmth_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_master_user_id_fkey"
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
      quickfill_difficult_people_daily_checks: {
        Row: {
          checked_at: string
          checked_by: string | null
          item_id: string
          work_date: string
        }
        Insert: {
          checked_at?: string
          checked_by?: string | null
          item_id: string
          work_date: string
        }
        Update: {
          checked_at?: string
          checked_by?: string | null
          item_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "quickfill_difficult_people_daily_checks_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quickfill_difficult_people_daily_checks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "quickfill_difficult_people_items"
            referencedColumns: ["id"]
          },
        ]
      }
      quickfill_difficult_people_items: {
        Row: {
          action_text: string
          created_at: string
          created_by: string | null
          id: string
          person_id: string
          reason_text: string
        }
        Insert: {
          action_text: string
          created_at?: string
          created_by?: string | null
          id?: string
          person_id: string
          reason_text: string
        }
        Update: {
          action_text?: string
          created_at?: string
          created_by?: string | null
          id?: string
          person_id?: string
          reason_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "quickfill_difficult_people_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quickfill_difficult_people_items_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      quickfill_office_arriving_daily_checks: {
        Row: {
          checked_at: string
          checked_by: string | null
          item_id: string
          work_date: string
        }
        Insert: {
          checked_at?: string
          checked_by?: string | null
          item_id: string
          work_date: string
        }
        Update: {
          checked_at?: string
          checked_by?: string | null
          item_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "quickfill_office_arriving_daily_checks_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quickfill_section_mark_events: {
        Row: {
          id: string
          marked_at: string
          marked_by: string | null
          note_text: string | null
          outstanding_count: number | null
          section_id: string
        }
        Insert: {
          id?: string
          marked_at?: string
          marked_by?: string | null
          note_text?: string | null
          outstanding_count?: number | null
          section_id: string
        }
        Update: {
          id?: string
          marked_at?: string
          marked_by?: string | null
          note_text?: string | null
          outstanding_count?: number | null
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quickfill_section_mark_events_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quickfill_section_marks: {
        Row: {
          marked_at: string
          marked_by: string | null
          section_id: string
        }
        Insert: {
          marked_at?: string
          marked_by?: string | null
          section_id: string
        }
        Update: {
          marked_at?: string
          marked_by?: string | null
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quickfill_section_marks_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_job_report_dispatch_log: {
        Row: {
          dispatched_at: string
          id: string
          recipient_user_id: string
          reporting_date: string
          schedule_id: string
        }
        Insert: {
          dispatched_at?: string
          id?: string
          recipient_user_id: string
          reporting_date: string
          schedule_id: string
        }
        Update: {
          dispatched_at?: string
          id?: string
          recipient_user_id?: string
          reporting_date?: string
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_job_report_dispatch_log_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_job_report_dispatch_log_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "recurring_job_report_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_job_report_schedule_recipients: {
        Row: {
          activity_scope: string
          created_at: string
          crew_filter: string
          id: string
          include_costs: boolean
          recipient_user_id: string
          schedule_id: string
        }
        Insert: {
          activity_scope: string
          created_at?: string
          crew_filter: string
          id?: string
          include_costs?: boolean
          recipient_user_id: string
          schedule_id: string
        }
        Update: {
          activity_scope?: string
          created_at?: string
          crew_filter?: string
          id?: string
          include_costs?: boolean
          recipient_user_id?: string
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_job_report_schedule_recipients_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_job_report_schedule_recipients_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "recurring_job_report_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_job_report_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          days_of_week: number[]
          enabled: boolean
          filters: Json
          id: string
          name: string
          reporting_preset: string
          scope_master_user_id: string
          time_local: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          days_of_week: number[]
          enabled?: boolean
          filters?: Json
          id?: string
          name: string
          reporting_preset?: string
          scope_master_user_id: string
          time_local: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          days_of_week?: number[]
          enabled?: boolean
          filters?: Json
          id?: string
          name?: string
          reporting_preset?: string
          scope_master_user_id?: string
          time_local?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_job_report_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_job_report_schedules_scope_master_user_id_fkey"
            columns: ["scope_master_user_id"]
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
      report_reads: {
        Row: {
          read_at: string
          report_id: string
          user_id: string
        }
        Insert: {
          read_at?: string
          report_id: string
          user_id: string
        }
        Update: {
          read_at?: string
          report_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_reads_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_template_fields: {
        Row: {
          created_at: string | null
          id: string
          input_type: string
          label: string
          sequence_order: number
          template_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          input_type?: string
          label: string
          sequence_order?: number
          template_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          input_type?: string
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
          app_managed: boolean
          created_at: string | null
          id: string
          name: string
          sequence_order: number
          updated_at: string | null
        }
        Insert: {
          app_managed?: boolean
          created_at?: string | null
          id?: string
          name: string
          sequence_order?: number
          updated_at?: string | null
        }
        Update: {
          app_managed?: boolean
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
          bid_id: string | null
          created_at: string | null
          created_by_user_id: string
          field_values: Json
          id: string
          job_ledger_id: string | null
          project_id: string | null
          reported_at_lat: number | null
          reported_at_lng: number | null
          template_id: string
          updated_at: string | null
        }
        Insert: {
          bid_id?: string | null
          created_at?: string | null
          created_by_user_id: string
          field_values?: Json
          id?: string
          job_ledger_id?: string | null
          project_id?: string | null
          reported_at_lat?: number | null
          reported_at_lng?: number | null
          template_id: string
          updated_at?: string | null
        }
        Update: {
          bid_id?: string | null
          created_at?: string | null
          created_by_user_id?: string
          field_values?: Json
          id?: string
          job_ledger_id?: string | null
          project_id?: string | null
          reported_at_lat?: number | null
          reported_at_lng?: number | null
          template_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
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
        ]
      }
      salary_work_schedule_day_overrides: {
        Row: {
          bid_id: string | null
          created_at: string | null
          id: string
          job_ledger_id: string | null
          mode: string | null
          segment_a_duration_minutes: number | null
          segment_a_start_local: string | null
          segment_b_bid_id: string | null
          segment_b_duration_minutes: number | null
          segment_b_job_ledger_id: string | null
          segment_b_start_local: string | null
          timezone: string | null
          updated_at: string | null
          use_split_focus: boolean | null
          user_id: string
          work_date: string
        }
        Insert: {
          bid_id?: string | null
          created_at?: string | null
          id?: string
          job_ledger_id?: string | null
          mode?: string | null
          segment_a_duration_minutes?: number | null
          segment_a_start_local?: string | null
          segment_b_bid_id?: string | null
          segment_b_duration_minutes?: number | null
          segment_b_job_ledger_id?: string | null
          segment_b_start_local?: string | null
          timezone?: string | null
          updated_at?: string | null
          use_split_focus?: boolean | null
          user_id: string
          work_date: string
        }
        Update: {
          bid_id?: string | null
          created_at?: string | null
          id?: string
          job_ledger_id?: string | null
          mode?: string | null
          segment_a_duration_minutes?: number | null
          segment_a_start_local?: string | null
          segment_b_bid_id?: string | null
          segment_b_duration_minutes?: number | null
          segment_b_job_ledger_id?: string | null
          segment_b_start_local?: string | null
          timezone?: string | null
          updated_at?: string | null
          use_split_focus?: boolean | null
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_work_schedule_day_overrides_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_work_schedule_day_overrides_job_ledger_id_fkey"
            columns: ["job_ledger_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_work_schedule_day_overrides_segment_b_bid_id_fkey"
            columns: ["segment_b_bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_work_schedule_day_overrides_segment_b_job_ledger_id_fkey"
            columns: ["segment_b_job_ledger_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_work_schedule_day_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_work_schedule_templates: {
        Row: {
          bid_id: string | null
          created_at: string | null
          exclude_weekends: boolean
          job_ledger_id: string | null
          mode: string
          segment_a_duration_minutes: number
          segment_a_start_local: string
          segment_b_bid_id: string | null
          segment_b_duration_minutes: number | null
          segment_b_job_ledger_id: string | null
          segment_b_start_local: string | null
          timezone: string
          updated_at: string | null
          use_split_focus: boolean
          user_id: string
        }
        Insert: {
          bid_id?: string | null
          created_at?: string | null
          exclude_weekends?: boolean
          job_ledger_id?: string | null
          mode: string
          segment_a_duration_minutes?: number
          segment_a_start_local: string
          segment_b_bid_id?: string | null
          segment_b_duration_minutes?: number | null
          segment_b_job_ledger_id?: string | null
          segment_b_start_local?: string | null
          timezone?: string
          updated_at?: string | null
          use_split_focus?: boolean
          user_id: string
        }
        Update: {
          bid_id?: string | null
          created_at?: string | null
          exclude_weekends?: boolean
          job_ledger_id?: string | null
          mode?: string
          segment_a_duration_minutes?: number
          segment_a_start_local?: string
          segment_b_bid_id?: string | null
          segment_b_duration_minutes?: number | null
          segment_b_job_ledger_id?: string | null
          segment_b_start_local?: string | null
          timezone?: string
          updated_at?: string | null
          use_split_focus?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_work_schedule_templates_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_work_schedule_templates_job_ledger_id_fkey"
            columns: ["job_ledger_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_work_schedule_templates_segment_b_bid_id_fkey"
            columns: ["segment_b_bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_work_schedule_templates_segment_b_job_ledger_id_fkey"
            columns: ["segment_b_job_ledger_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_work_schedule_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_day_email_requests: {
        Row: {
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          recipient_user_id: string
          send_at: string
          sent_at: string | null
          status: string
          timezone: string
          work_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          recipient_user_id: string
          send_at: string
          sent_at?: string | null
          status?: string
          timezone?: string
          work_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          recipient_user_id?: string
          send_at?: string
          sent_at?: string | null
          status?: string
          timezone?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_day_email_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_day_email_requests_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_share_recurring: {
        Row: {
          created_at: string
          created_by: string | null
          days_of_week: number[]
          enabled: boolean
          id: string
          include_current_day: boolean
          recipient_user_id: string
          scope: string
          time_local: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          days_of_week: number[]
          enabled?: boolean
          id?: string
          include_current_day?: boolean
          recipient_user_id: string
          scope?: string
          time_local: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          days_of_week?: number[]
          enabled?: boolean
          id?: string
          include_current_day?: boolean
          recipient_user_id?: string
          scope?: string
          time_local?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_share_recurring_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_share_recurring_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_share_recurring_log: {
        Row: {
          error: string | null
          id: string
          run_date: string
          sent_at: string
          status: string
          subscription_id: string
        }
        Insert: {
          error?: string | null
          id?: string
          run_date: string
          sent_at?: string
          status?: string
          subscription_id: string
        }
        Update: {
          error?: string | null
          id?: string
          run_date?: string
          sent_at?: string
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_share_recurring_log_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "schedule_share_recurring"
            referencedColumns: ["id"]
          },
        ]
      }
      service_types: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          ledger_bid_prefix: string | null
          ledger_job_prefix: string | null
          name: string
          sequence_order: number
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          ledger_bid_prefix?: string | null
          ledger_job_prefix?: string | null
          name: string
          sequence_order?: number
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          ledger_bid_prefix?: string | null
          ledger_job_prefix?: string | null
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
      stripe_oob_payment_reverts: {
        Row: {
          created_at: string
          created_by_user_id: string
          id: string
          invoice_id: string
          job_id: string
          reason: string
          stripe_credit_note_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          id?: string
          invoice_id: string
          job_id: string
          reason: string
          stripe_credit_note_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          id?: string
          invoice_id?: string
          job_id?: string
          reason?: string
          stripe_credit_note_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_oob_payment_reverts_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_oob_payment_reverts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_oob_payment_reverts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          event_type: string
          received_at: string
          stripe_event_id: string
        }
        Insert: {
          event_type: string
          received_at?: string
          stripe_event_id: string
        }
        Update: {
          event_type?: string
          received_at?: string
          stripe_event_id?: string
        }
        Relationships: []
      }
      supply_house_invoice_job_allocations: {
        Row: {
          invoice_id: string
          job_id: string
          pct: number
        }
        Insert: {
          invoice_id: string
          job_id: string
          pct: number
        }
        Update: {
          invoice_id?: string
          job_id?: string
          pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "supply_house_invoice_job_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "supply_house_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_house_invoice_job_allocations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_ledger"
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
          paid_at: string | null
          purchase_order_number: string | null
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
          paid_at?: string | null
          purchase_order_number?: string | null
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
          paid_at?: string | null
          purchase_order_number?: string | null
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
          monthly_payment_day: number | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          monthly_payment_day?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          monthly_payment_day?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
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
      team_feedback_peer_ratings: {
        Row: {
          created_at: string
          id: string
          peer_likert_1: number | null
          peer_likert_2: number | null
          peer_likert_3: number | null
          peer_likert_4: number | null
          peer_likert_5: number | null
          peer_person_id: string | null
          peer_trust: number | null
          peer_user_id: string | null
          submission_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          peer_likert_1?: number | null
          peer_likert_2?: number | null
          peer_likert_3?: number | null
          peer_likert_4?: number | null
          peer_likert_5?: number | null
          peer_person_id?: string | null
          peer_trust?: number | null
          peer_user_id?: string | null
          submission_id: string
        }
        Update: {
          created_at?: string
          id?: string
          peer_likert_1?: number | null
          peer_likert_2?: number | null
          peer_likert_3?: number | null
          peer_likert_4?: number | null
          peer_likert_5?: number | null
          peer_person_id?: string | null
          peer_trust?: number | null
          peer_user_id?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_feedback_peer_ratings_peer_person_id_fkey"
            columns: ["peer_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_feedback_peer_ratings_peer_user_id_fkey"
            columns: ["peer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_feedback_peer_ratings_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "team_feedback_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      team_feedback_settings: {
        Row: {
          cadence_days: number
          comment_only_enabled: boolean
          enabled: boolean
          home_entry_enabled: boolean
          id: number
          inclusion_label_manager: string | null
          inclusion_label_open: string | null
          inclusion_label_peer: string | null
          inclusion_subtitle: string | null
          inclusion_title: string | null
          intro_copy: string | null
          manager_likert_prompts: Json | null
          manager_overall_prompt: string | null
          manager_section_enabled: boolean
          manager_step_heading: string | null
          peer_likert_prompts: Json | null
          peer_section_enabled: boolean
          peer_step_heading: string | null
          thank_you_copy: string | null
          updated_at: string
        }
        Insert: {
          cadence_days?: number
          comment_only_enabled?: boolean
          enabled?: boolean
          home_entry_enabled?: boolean
          id?: number
          inclusion_label_manager?: string | null
          inclusion_label_open?: string | null
          inclusion_label_peer?: string | null
          inclusion_subtitle?: string | null
          inclusion_title?: string | null
          intro_copy?: string | null
          manager_likert_prompts?: Json | null
          manager_overall_prompt?: string | null
          manager_section_enabled?: boolean
          manager_step_heading?: string | null
          peer_likert_prompts?: Json | null
          peer_section_enabled?: boolean
          peer_step_heading?: string | null
          thank_you_copy?: string | null
          updated_at?: string
        }
        Update: {
          cadence_days?: number
          comment_only_enabled?: boolean
          enabled?: boolean
          home_entry_enabled?: boolean
          id?: number
          inclusion_label_manager?: string | null
          inclusion_label_open?: string | null
          inclusion_label_peer?: string | null
          inclusion_subtitle?: string | null
          inclusion_title?: string | null
          intro_copy?: string | null
          manager_likert_prompts?: Json | null
          manager_overall_prompt?: string | null
          manager_section_enabled?: boolean
          manager_step_heading?: string | null
          peer_likert_prompts?: Json | null
          peer_section_enabled?: boolean
          peer_step_heading?: string | null
          thank_you_copy?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      team_feedback_submissions: {
        Row: {
          created_at: string
          cycle_period_start: string | null
          id: string
          manager_likert_1: number | null
          manager_likert_2: number | null
          manager_likert_3: number | null
          manager_likert_4: number | null
          manager_likert_5: number | null
          manager_overall_1_10: number | null
          manager_user_id: string | null
          open_fix_improve: string | null
          open_safety_tools: string | null
          open_training: string | null
          reviewer_user_id: string
          source: string
        }
        Insert: {
          created_at?: string
          cycle_period_start?: string | null
          id?: string
          manager_likert_1?: number | null
          manager_likert_2?: number | null
          manager_likert_3?: number | null
          manager_likert_4?: number | null
          manager_likert_5?: number | null
          manager_overall_1_10?: number | null
          manager_user_id?: string | null
          open_fix_improve?: string | null
          open_safety_tools?: string | null
          open_training?: string | null
          reviewer_user_id: string
          source: string
        }
        Update: {
          created_at?: string
          cycle_period_start?: string | null
          id?: string
          manager_likert_1?: number | null
          manager_likert_2?: number | null
          manager_likert_3?: number | null
          manager_likert_4?: number | null
          manager_likert_5?: number | null
          manager_overall_1_10?: number | null
          manager_user_id?: string | null
          open_fix_improve?: string | null
          open_safety_tools?: string | null
          open_training?: string | null
          reviewer_user_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_feedback_submissions_manager_user_id_fkey"
            columns: ["manager_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_feedback_submissions_reviewer_user_id_fkey"
            columns: ["reviewer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      team_feedback_user_state: {
        Row: {
          last_completed_at: string | null
          last_prompt_at: string | null
          last_skipped_at: string | null
          snooze_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          last_completed_at?: string | null
          last_prompt_at?: string | null
          last_skipped_at?: string | null
          snooze_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          last_completed_at?: string | null
          last_prompt_at?: string | null
          last_skipped_at?: string | null
          snooze_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_feedback_user_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      team_leader_assignments: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          dashboard_hours_visibility: string
          id: string
          leader_user_id: string
          member_user_id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          dashboard_hours_visibility?: string
          id?: string
          leader_user_id: string
          member_user_id: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          dashboard_hours_visibility?: string
          id?: string
          leader_user_id?: string
          member_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_leader_assignments_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_leader_assignments_leader_user_id_fkey"
            columns: ["leader_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_leader_assignments_member_user_id_fkey"
            columns: ["member_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      team_leader_clock_notify_prefs: {
        Row: {
          id: string
          notify_enabled: boolean
          team_leader_assignment_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          notify_enabled?: boolean
          team_leader_assignment_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          notify_enabled?: boolean
          team_leader_assignment_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_leader_clock_notify_prefs_team_leader_assignment_id_fkey"
            columns: ["team_leader_assignment_id"]
            isOneToOne: true
            referencedRelation: "team_leader_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_app_activity_daily: {
        Row: {
          active_seconds: number
          activity_date: string
          first_seen_at: string | null
          last_seen_at: string | null
          user_id: string
        }
        Insert: {
          active_seconds?: number
          activity_date: string
          first_seen_at?: string | null
          last_seen_at?: string | null
          user_id: string
        }
        Update: {
          active_seconds?: number
          activity_date?: string
          first_seen_at?: string | null
          last_seen_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_app_activity_daily_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_app_activity_page_daily: {
        Row: {
          active_seconds: number
          activity_date: string
          page: string
          user_id: string
        }
        Insert: {
          active_seconds?: number
          activity_date: string
          page: string
          user_id: string
        }
        Update: {
          active_seconds?: number
          activity_date?: string
          page?: string
          user_id?: string
        }
        Relationships: []
      }
      user_app_activity_viewers: {
        Row: {
          created_at: string
          granted_by: string | null
          viewer_user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          viewer_user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          viewer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_app_activity_viewers_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_app_activity_viewers_viewer_user_id_fkey"
            columns: ["viewer_user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bid_notes_read_state: {
        Row: {
          bid_id: string
          last_seen_bid_submission_at: string | null
          last_seen_customer_contact_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bid_id: string
          last_seen_bid_submission_at?: string | null
          last_seen_customer_contact_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bid_id?: string
          last_seen_bid_submission_at?: string | null
          last_seen_customer_contact_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_bid_notes_read_state_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_bid_notes_read_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_checklist_item_mute_preferences: {
        Row: {
          checklist_item_id: string
          muted_until: string
          user_id: string
        }
        Insert: {
          checklist_item_id: string
          muted_until: string
          user_id: string
        }
        Update: {
          checklist_item_id?: string
          muted_until?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_checklist_item_mute_preferences_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_daily_goals_ack: {
        Row: {
          completed_at: string
          local_date: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          local_date: string
          user_id: string
        }
        Update: {
          completed_at?: string
          local_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_daily_goals_ack_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dashboard_buttons: {
        Row: {
          button_key: string
          user_id: string
          visible: boolean
        }
        Insert: {
          button_key: string
          user_id: string
          visible?: boolean
        }
        Update: {
          button_key?: string
          user_id?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_dashboard_buttons_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dashboard_goals: {
        Row: {
          body: string
          created_at: string
          id: string
          sort_order: number
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sort_order?: number
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_dashboard_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dashboard_preferences: {
        Row: {
          quick_buttons_placement: string
          user_id: string
        }
        Insert: {
          quick_buttons_placement?: string
          user_id: string
        }
        Update: {
          quick_buttons_placement?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_dashboard_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_labels: {
        Row: {
          label_id: string
          user_id: string
        }
        Insert: {
          label_id: string
          user_id: string
        }
        Update: {
          label_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_labels_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pinned_tabs: {
        Row: {
          id: string
          label: string
          path: string
          sort_order: number
          tab: string | null
          user_id: string
        }
        Insert: {
          id?: string
          label: string
          path: string
          sort_order?: number
          tab?: string | null
          user_id: string
        }
        Update: {
          id?: string
          label?: string
          path?: string
          sort_order?: number
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
      user_prospect_copy_templates: {
        Row: {
          subject_text: string | null
          template_key: string
          updated_at: string | null
          user_id: string
          value_text: string
        }
        Insert: {
          subject_text?: string | null
          template_key: string
          updated_at?: string | null
          user_id: string
          value_text: string
        }
        Update: {
          subject_text?: string | null
          template_key?: string
          updated_at?: string | null
          user_id?: string
          value_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_prospect_copy_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_prospect_quick_notes: {
        Row: {
          created_at: string | null
          id: string
          label: string
          sequence_order: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          label: string
          sequence_order?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string
          sequence_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_prospect_quick_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_report_notification_preferences: {
        Row: {
          created_at: string | null
          template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          template_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_report_notification_preferences_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_report_notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tag_org: {
        Row: {
          master_user_id: string
          set_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          master_user_id: string
          set_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          master_user_id?: string
          set_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tag_org_master_user_id_fkey"
            columns: ["master_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tag_org_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tag_org_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_time_off: {
        Row: {
          created_at: string
          end_date: string
          id: string
          kind: string
          note: string | null
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          kind?: string
          note?: string | null
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          kind?: string
          note?: string | null
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_time_off_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          archived_at: string | null
          created_at: string | null
          email: string
          estimator_prospects_access: boolean
          estimator_service_type_ids: string[] | null
          helpers_service_type_ids: string[] | null
          id: string
          last_sign_in_at: string | null
          name: string
          notes: string | null
          phone: string | null
          primary_service_type_ids: string[] | null
          role: Database["public"]["Enums"]["user_role"]
          subcontractor_service_type_ids: string[] | null
          superintendent_service_type_ids: string[] | null
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string | null
          email: string
          estimator_prospects_access?: boolean
          estimator_service_type_ids?: string[] | null
          helpers_service_type_ids?: string[] | null
          id: string
          last_sign_in_at?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          primary_service_type_ids?: string[] | null
          role?: Database["public"]["Enums"]["user_role"]
          subcontractor_service_type_ids?: string[] | null
          superintendent_service_type_ids?: string[] | null
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string | null
          email?: string
          estimator_prospects_access?: boolean
          estimator_service_type_ids?: string[] | null
          helpers_service_type_ids?: string[] | null
          id?: string
          last_sign_in_at?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          primary_service_type_ids?: string[] | null
          role?: Database["public"]["Enums"]["user_role"]
          subcontractor_service_type_ids?: string[] | null
          superintendent_service_type_ids?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vehicle_odometer_entries: {
        Row: {
          created_at: string | null
          id: string
          odometer_value: number
          read_date: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          odometer_value: number
          read_date: string
          vehicle_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          odometer_value?: number
          read_date?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_odometer_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_possessions: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: string
          start_date: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          start_date: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          start_date?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_possessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_possessions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_replacement_value_entries: {
        Row: {
          created_at: string | null
          id: string
          read_date: string
          replacement_value: number
          vehicle_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          read_date: string
          replacement_value: number
          vehicle_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          read_date?: string
          replacement_value?: number
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_replacement_value_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          created_at: string | null
          id: string
          make: string
          model: string
          updated_at: string | null
          vin: string | null
          weekly_insurance_cost: number
          weekly_registration_cost: number
          year: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          make?: string
          model?: string
          updated_at?: string | null
          vin?: string | null
          weekly_insurance_cost?: number
          weekly_registration_cost?: number
          year?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          make?: string
          model?: string
          updated_at?: string | null
          vin?: string | null
          weekly_insurance_cost?: number
          weekly_registration_cost?: number
          year?: number | null
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
          item_date: string | null
          link: string | null
          memo: string
          purchase_order_id: string | null
          sequence_order: number
          step_id: string
          supply_house_invoice_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          item_date?: string | null
          link?: string | null
          memo: string
          purchase_order_id?: string | null
          sequence_order?: number
          step_id: string
          supply_house_invoice_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          item_date?: string | null
          link?: string | null
          memo?: string
          purchase_order_id?: string | null
          sequence_order?: number
          step_id?: string
          supply_house_invoice_id?: string | null
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
          {
            foreignKeyName: "workflow_step_line_items_supply_house_invoice_id_fkey"
            columns: ["supply_house_invoice_id"]
            isOneToOne: false
            referencedRelation: "supply_house_invoices"
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
      writeup_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          schema: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          schema?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          schema?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "writeup_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      writeups: {
        Row: {
          answers: Json
          created_at: string
          disclosure: Database["public"]["Enums"]["writeup_disclosure"] | null
          filled_by_user_id: string
          id: string
          status: string
          subject_user_id: string
          submitted_at: string | null
          template_id: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          disclosure?: Database["public"]["Enums"]["writeup_disclosure"] | null
          filled_by_user_id: string
          id?: string
          status?: string
          subject_user_id: string
          submitted_at?: string | null
          template_id: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          created_at?: string
          disclosure?: Database["public"]["Enums"]["writeup_disclosure"] | null
          filled_by_user_id?: string
          id?: string
          status?: string
          subject_user_id?: string
          submitted_at?: string | null
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "writeups_filled_by_user_id_fkey"
            columns: ["filled_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "writeups_subject_user_id_fkey"
            columns: ["subject_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "writeups_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "writeup_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _mercury_raw_debit_card_id_lower: {
        Args: { p_raw: Json }
        Returns: string
      }
      _pay_staff_bulk_insert_user_time_off_row: {
        Args: {
          p_end_date: string
          p_note: string
          p_should_sync: boolean
          p_start_date: string
          p_today: string
          p_uid: string
        }
        Returns: Json
      }
      _replace_mercury_transaction_invoice_links: {
        Args: { p_invoice_ids: string[]; p_mercury_transaction_id: string }
        Returns: undefined
      }
      add_collect_payment_fixture_from_job_book: {
        Args: { p_job_book_entry_id: string; p_job_id: string }
        Returns: Json
      }
      apply_agreed_write_down_to_billed_invoice: {
        Args: { p_invoice_id: string; p_new_amount: number; p_note: string }
        Returns: Json
      }
      apply_mercury_bank_payment_allocations: {
        Args: {
          p_allocations: Json
          p_mercury_transaction_id: string
          p_note: string
          p_paid_on: string
          p_payment_type: string
        }
        Returns: Json
      }
      approve_clock_sessions: {
        Args: { p_session_ids: string[] }
        Returns: {
          approved_count: number
          error_message: string
        }[]
      }
      approve_collect_payment_for_terminal: {
        Args: {
          p_dispatch_notes?: string
          p_job_id: string
          p_jobs_ledger_invoice_id: string
        }
        Returns: Json
      }
      assert_caller_can_merge_customer_pair: {
        Args: {
          p_survivor_master_user_id: string
          p_victim_master_user_id: string
        }
        Returns: undefined
      }
      assistants_share_master: {
        Args: { assistant_a: string; assistant_b: string }
        Returns: boolean
      }
      auth_uid_is_helpers_or_subcontractor: { Args: never; Returns: boolean }
      auth_user_can_merge_customers: { Args: never; Returns: boolean }
      auto_clock_out_eod_if_due: { Args: never; Returns: undefined }
      auto_clock_out_open_sessions_eod: { Args: never; Returns: undefined }
      backfill_mercury_auto_attributions_for_debit_card: {
        Args: { p_mercury_debit_card_id: string }
        Returns: number
      }
      bulk_apply_tally_payroll_rule_flags: {
        Args: { p_rows: Json }
        Returns: number
      }
      bulk_approve_accounting_label_suggestions: {
        Args: { p_items: Json }
        Returns: number
      }
      bulk_insert_accounting_label_suggestions: {
        Args: { p_rows: Json }
        Returns: number
      }
      bump_user_app_activity: {
        Args: { p_page?: string; p_seconds?: number }
        Returns: undefined
      }
      can_access_bid_for_pricing: {
        Args: { bid_id_param: string }
        Returns: boolean
      }
      can_access_project: {
        Args: { project_id_param: string }
        Returns: boolean
      }
      can_access_project_row:
        | { Args: { project_id_param: string }; Returns: boolean }
        | {
            Args: {
              proj_customer_id: string
              proj_master_id: string
              project_id_param: string
            }
            Returns: boolean
          }
      can_access_project_row_for_user: {
        Args: { project_id_param: string; viewer_user_id: string }
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
      can_define_task_style_checklist_items: { Args: never; Returns: boolean }
      can_edit_checklist_tech_tree_structure_for_roadmap: {
        Args: { p_roadmap_id: string }
        Returns: boolean
      }
      can_edit_clock_sessions_for_user: {
        Args: { p_target_user_id: string }
        Returns: boolean
      }
      can_manage_checklist_tech_tree_roadmap_members: {
        Args: { p_roadmap_id: string }
        Returns: boolean
      }
      can_manage_inspection_types: { Args: never; Returns: boolean }
      can_manage_schedule_share: { Args: never; Returns: boolean }
      can_manage_team_leader_assignments: { Args: never; Returns: boolean }
      can_modify_people_labor_job: {
        Args: { p_job_id: string }
        Returns: boolean
      }
      can_read_job_activity: {
        Args: { p_financial: boolean; p_job_id: string }
        Returns: boolean
      }
      can_see_sharing_master: {
        Args: { sharing_master_id: string }
        Returns: boolean
      }
      can_select_checklist_tech_tree_roadmap: {
        Args: { p_roadmap_id: string }
        Returns: boolean
      }
      check_out_project: { Args: { p_project_id: string }; Returns: Json }
      checklist_instance_parent_item_created_by_auth_user: {
        Args: { p_instance_id: string }
        Returns: boolean
      }
      checklist_item_created_by_auth_user: {
        Args: { p_item_id: string }
        Returns: boolean
      }
      clear_mercury_transaction_duplicate: {
        Args: { p_id: string }
        Returns: undefined
      }
      clone_price_book_version_to_bid: {
        Args: { p_bid_id: string; p_name: string; p_source_version_id: string }
        Returns: string
      }
      complete_job_collect_payment_flow_for_invoice: {
        Args: { p_stripe_invoice_id: string }
        Returns: Json
      }
      complete_job_collect_payment_flow_terminal: {
        Args: { p_stripe_payment_intent_id: string }
        Returns: Json
      }
      copy_workflow_step: {
        Args: { p_insert_after_sequence: number; p_step_id: string }
        Returns: Json
      }
      count_mercury_transactions_for_bank_payments: {
        Args: { p_filter?: Json }
        Returns: number
      }
      count_unlinked_mercury_transactions_for_tally: {
        Args: never
        Returns: number
      }
      count_unlinked_mercury_transactions_for_tally_stale: {
        Args: { min_age_days?: number }
        Returns: number
      }
      create_bid_version: {
        Args: {
          p_bid_id: string
          p_clone_pricing: boolean
          p_name: string
          p_pricing_source_version_id: string
          p_source_bid_version_id: string
        }
        Returns: string
      }
      create_job_from_estimate:
        | {
            Args: {
              p_customer_id?: string
              p_estimate_id: string
              p_hcp_number: string
              p_job_address?: string
              p_job_name?: string
              p_revenue?: number
            }
            Returns: string
          }
        | {
            Args: {
              p_customer_id?: string
              p_estimate_id: string
              p_fixtures?: Json
              p_hcp_number: string
              p_job_address?: string
              p_job_name?: string
              p_revenue?: number
            }
            Returns: string
          }
      create_pending_contract_versions_after_book_save: {
        Args: { p_contract_template_document_id: string }
        Returns: undefined
      }
      create_po_from_job_tally: {
        Args: { p_entries: Json; p_job_id: string }
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
      create_turnaway_trip_charge: {
        Args: {
          p_amount: number
          p_dispatch_request_id?: string
          p_job_id: string
          p_reason: string
        }
        Returns: Json
      }
      create_view_link: {
        Args: { p_expires_at?: string; p_name?: string; p_project_id: string }
        Returns: Json
      }
      debug_cost_estimate_check: { Args: { p_bid_id: string }; Returns: Json }
      debug_cost_estimate_policies: {
        Args: never
        Returns: {
          cmd: string
          policyname: string
          qual: string
          with_check: string
        }[]
      }
      delete_billed_invoice_on_send_back: {
        Args: { p_invoice_id: string }
        Returns: Json
      }
      delete_ready_to_bill_invoice: {
        Args: { p_invoice_id: string }
        Returns: Json
      }
      dev_reset_estimates_for_testing: { Args: never; Returns: number }
      dismiss_mercury_duplicate_pair: {
        Args: { p_id_a: string; p_id_b: string }
        Returns: undefined
      }
      dispatch_inbox_note_stats: {
        Args: { p_request_ids: string[] }
        Returns: {
          last_note_at: string
          note_count: number
          request_id: string
        }[]
      }
      duplicate_bid_to_service_type: {
        Args: { p_source_bid_id: string; p_target_service_type_id: string }
        Returns: string
      }
      duplicate_purchase_order: {
        Args: { p_created_by: string; p_source_po_id: string }
        Returns: Json
      }
      ensure_single_ready_to_bill_invoice_for_job: {
        Args: { p_job_id: string }
        Returns: Json
      }
      estimate_accept_notify_filter_eligible_user_ids: {
        Args: { p_candidate_ids: string[]; p_master_user_id: string }
        Returns: string[]
      }
      estimates_thread_note_stats: {
        Args: { p_estimate_ids: string[] }
        Returns: {
          estimate_id: string
          last_note_at: string
          last_note_author_name: string
          last_note_body: string
          note_count: number
        }[]
      }
      estimator_can_access_service_type: {
        Args: { p_service_type_id: string }
        Returns: boolean
      }
      estimator_inbox_note_stats: {
        Args: { p_request_ids: string[] }
        Returns: {
          last_note_at: string
          note_count: number
          request_id: string
        }[]
      }
      find_possible_duplicate_mercury_transactions: {
        Args: {
          p_limit?: number
          p_manual_only?: boolean
          p_window_days?: number
        }
        Returns: {
          a_amount: number
          a_counterparty_name: string
          a_created_at: string
          a_id: string
          a_kind: string
          a_mercury_account_id: string
          a_posted_at: string
          a_raw: Json
          a_source: string
          b_amount: number
          b_counterparty_name: string
          b_created_at: string
          b_id: string
          b_kind: string
          b_mercury_account_id: string
          b_posted_at: string
          b_raw: Json
          b_source: string
          days_apart: number
          manual_involved: boolean
        }[]
      }
      get_archived_user_names: { Args: never; Returns: string[] }
      get_assigned_steps_for_dashboard: {
        Args: { p_user_name: string }
        Returns: {
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
          percent_complete: number | null
          private_notes: string | null
          rejection_reason: string | null
          scheduled_end_date: string | null
          scheduled_start_date: string | null
          sequence_order: number
          skipped_reason: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["step_status"]
          step_type: Database["public"]["Enums"]["step_type"] | null
          template_step_id: string | null
          updated_at: string | null
          workflow_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "project_workflow_steps"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_assigned_steps_with_projects_for_dashboard: {
        Args: { p_user_name: string }
        Returns: Json[]
      }
      get_bids_by_ids: {
        Args: { p_bid_ids: string[] }
        Returns: {
          address: string
          bid_number: string
          id: string
          project_name: string
          service_type_id: string
        }[]
      }
      get_collect_payment_certify_payload: {
        Args: { p_job_id: string }
        Returns: Json
      }
      get_invoice_allocation_lines_for_jobs: {
        Args: { p_job_ids: string[] }
        Returns: {
          allocated_amount: number
          invoice_date: string
          invoice_id: string
          invoice_link: string
          invoice_number: string
          invoice_total_amount: number
          job_id: string
          pct: number
          supply_house_name: string
          website_url: string
        }[]
      }
      get_invoice_amounts_for_jobs: {
        Args: { p_job_ids: string[] }
        Returns: {
          invoice_amount: number
          job_id: string
        }[]
      }
      get_job_display_for_report: {
        Args: { p_id: string; p_source: string }
        Returns: {
          display_name: string
          hcp_number: string
          id: string
          source: string
        }[]
      }
      get_jobs_ledger_by_hcp_numbers: {
        Args: { p_hcp_numbers: string[] }
        Returns: {
          click_number: string
          hcp_number: string
          id: string
          job_address: string
          job_name: string
          pct_complete: number
          revenue: number
          service_type_id: string
        }[]
      }
      get_jobs_ledger_by_hcp_numbers_paid_only: {
        Args: { p_hcp_numbers: string[] }
        Returns: {
          click_number: string
          hcp_number: string
          id: string
          job_address: string
          job_name: string
          pct_complete: number
          revenue: number
          service_type_id: string
        }[]
      }
      get_jobs_ledger_by_ids: {
        Args: { p_job_ids: string[] }
        Returns: {
          click_number: string
          hcp_number: string
          id: string
          job_address: string
          job_name: string
          pct_complete: number
          revenue: number
          service_type_id: string
        }[]
      }
      get_jobs_ledger_by_ids_paid_only: {
        Args: { p_job_ids: string[] }
        Returns: {
          click_number: string
          hcp_number: string
          id: string
          job_address: string
          job_name: string
          pct_complete: number
          revenue: number
          service_type_id: string
        }[]
      }
      get_jobs_ledger_by_status: {
        Args: { p_status: string }
        Returns: {
          click_number: string
          created_at: string
          customer_id: string
          google_drive_link: string
          hcp_number: string
          id: string
          job_address: string
          job_name: string
          job_plans_link: string
          payments_made: number
          revenue: number
        }[]
      }
      get_jobs_ledger_office: {
        Args: never
        Returns: {
          hcp_number: string
          id: string
          job_address: string
          job_name: string
        }[]
      }
      get_man_hours_by_job: {
        Args: never
        Returns: {
          job_id: string
          man_hours: number
          person_name: string
        }[]
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
      get_projects_by_ids: {
        Args: { p_ids: string[] }
        Returns: {
          address: string
          id: string
          name: string
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
      humanize_job_status: { Args: { p: string }; Returns: string }
      insert_accounting_label_suggestion_service: {
        Args: { p_rows: Json }
        Returns: number
      }
      insert_material_po_generator_entry: {
        Args: {
          p_for_user_id: string
          p_job_ledger_id: string
          p_notes?: string
          p_supply_house_id?: string
        }
        Returns: {
          out_id: string
          out_po_code: number
        }[]
      }
      insert_report:
        | {
            Args: {
              p_field_values: Json
              p_job_ledger_id: string
              p_project_id: string
              p_template_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_bid_id?: string
              p_field_values: Json
              p_job_ledger_id: string
              p_project_id: string
              p_reported_at_lat?: number
              p_reported_at_lng?: number
              p_template_id: string
            }
            Returns: string
          }
      is_assistant: { Args: never; Returns: boolean }
      is_assistant_of_pay_approved_master: { Args: never; Returns: boolean }
      is_bid_pricing_user: { Args: never; Returns: boolean }
      is_checklist_tech_tree_staff_or_primary: { Args: never; Returns: boolean }
      is_cost_matrix_shared_with_current_user: { Args: never; Returns: boolean }
      is_dev: { Args: never; Returns: boolean }
      is_dev_or_master_or_assistant: { Args: never; Returns: boolean }
      is_dispatch_group_member: { Args: never; Returns: boolean }
      is_estimator: { Args: never; Returns: boolean }
      is_estimator_group_member: { Args: never; Returns: boolean }
      is_master_or_dev: { Args: never; Returns: boolean }
      is_pay_approved_master: { Args: never; Returns: boolean }
      is_team_lead_for_member: {
        Args: { p_leader: string; p_member: string }
        Returns: boolean
      }
      is_team_lead_for_person_name: {
        Args: { p_person_name: string }
        Returns: boolean
      }
      is_user_notes_editor: { Args: never; Returns: boolean }
      jobs_ledger_row_visible_for_tally_assign: {
        Args: { p_job_id: string; p_user_id: string }
        Returns: boolean
      }
      jobs_ledger_thread_note_stats: {
        Args: { p_job_ids: string[] }
        Returns: {
          job_id: string
          last_note_at: string
          last_note_author_name: string
          last_note_body: string
          last_report_at: string
          last_report_author_name: string
          last_report_preview: string
          last_report_template_name: string
          note_count: number
          report_count: number
        }[]
      }
      leader_replace_clock_session_cluster_mixed: {
        Args: { p_segments: Json; p_session_ids: string[] }
        Returns: {
          error_message: string
          inserted_ids: string[]
        }[]
      }
      leader_split_clock_session_cluster: {
        Args: { p_segments: Json; p_session_ids: string[] }
        Returns: {
          error_message: string
          inserted_ids: string[]
        }[]
      }
      leader_split_clock_session_segments: {
        Args: { p_segments: Json; p_session_id: string }
        Returns: {
          error_message: string
          inserted_ids: string[]
        }[]
      }
      list_ar_allocations_for_mercury_transaction: {
        Args: { p_mercury_transaction_id: string }
        Returns: {
          amount: number
          hcp_number: string
          invoice_id: string
          invoice_sequence_order: number
          job_id: string
          job_name: string
          note: string
          paid_on: string
          payment_id: string
        }[]
      }
      list_assigned_jobs_for_dashboard: {
        Args: never
        Returns: {
          created_at: string
          google_drive_link: string
          hcp_number: string
          id: string
          in_progress_stage_name: string
          in_progress_step_id: string
          job_address: string
          job_name: string
          job_pictures_link: string
          job_plans_link: string
          last_clock_activity_at: string
          last_job_activity_at: string
          last_report_at: string
          last_schedule_activity_at: string
          last_thread_note_at: string
          master_user_id: string
          my_last_report_at: string
          project_id: string
          revenue: number
          service_type_id: string
          service_type_name: string
          status: string
        }[]
      }
      list_bid_estimators_all_time_hours: {
        Args: { p_bid_ids: string[] }
        Returns: {
          bid_id: string
          hours: number
        }[]
      }
      list_bid_estimators_window_hours: {
        Args: { p_end_date: string; p_start_date: string; p_user_ids: string[] }
        Returns: {
          bid_id: string
          hours: number
          user_id: string
          work_date: string
        }[]
      }
      list_customer_review_job_hours: {
        Args: never
        Returns: {
          customer_id: string
          customer_name: string
          hours: number
        }[]
      }
      list_feedback_peer_candidates: {
        Args: never
        Returns: {
          peer_name: string
          peer_user_id: string
          person_id: string
          shared_tag_count: number
        }[]
      }
      list_job_activity_events: {
        Args: { p_job_id: string }
        Returns: {
          actor_name: string
          actor_user_id: string
          detail: Json
          event_type: string
          financial: boolean
          id: string
          occurred_at: string
          summary: string
        }[]
      }
      list_job_counts_by_master_for_dev_settings: {
        Args: never
        Returns: {
          job_count: number
          master_user_id: string
        }[]
      }
      list_job_schedule_blocks_for_schedule_email: {
        Args: { p_recipient: string; p_work_date: string }
        Returns: {
          assignee_name: string
          assignee_user_id: string
          id: string
          job_address: string
          job_hcp_number: string
          job_id: string
          job_name: string
          note: string
          time_end: string
          time_start: string
          work_date: string
        }[]
      }
      list_jobs_for_tally: {
        Args: never
        Returns: {
          hcp_number: string
          id: string
          job_address: string
          job_name: string
        }[]
      }
      list_latest_report_completion_pct: {
        Args: { p_job_ids: string[] }
        Returns: {
          job_ledger_id: string
          pct: number
        }[]
      }
      list_manual_bank_accounts: {
        Args: never
        Returns: {
          mercury_account_id: string
          name: string
          net_total: number
          newest_posted: string
          oldest_posted: string
          tx_count: number
        }[]
      }
      list_mercury_drag_sort_label_assignment_counts: {
        Args: never
        Returns: {
          assignment_count: number
          label_id: string
        }[]
      }
      list_mercury_transactions_for_bank_payments: {
        Args: { p_filter?: Json }
        Returns: {
          amount: number
          consumed: number
          counterparty_name: string
          external_memo: string
          kind: string
          mercury_account_id: string
          mercury_id: string
          mercury_transaction_id: string
          note: string
          posted_at: string
          raw: Json
          remaining_available: number
          returned: boolean
        }[]
      }
      list_mercury_transactions_keyset: {
        Args: {
          p_after_id?: string
          p_after_posted_at?: string
          p_limit?: number
        }
        Returns: {
          amount: number
          counterparty_id: string | null
          counterparty_name: string | null
          created_at: string
          created_by: string | null
          currency: string
          dashboard_link: string | null
          duplicate_of_transaction_id: string | null
          external_memo: string | null
          id: string
          kind: string
          manual_upload_id: string | null
          mercury_account_id: string
          mercury_category: Json | null
          mercury_id: string | null
          note: string | null
          posted_at: string | null
          raw: Json | null
          source: string
          status: string
          synced_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "mercury_transactions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_mercury_transactions_keyset_before: {
        Args: {
          p_before_id?: string
          p_before_posted_at?: string
          p_limit?: number
        }
        Returns: {
          amount: number
          counterparty_id: string | null
          counterparty_name: string | null
          created_at: string
          created_by: string | null
          currency: string
          dashboard_link: string | null
          duplicate_of_transaction_id: string | null
          external_memo: string | null
          id: string
          kind: string
          manual_upload_id: string | null
          mercury_account_id: string
          mercury_category: Json | null
          mercury_id: string | null
          note: string | null
          posted_at: string | null
          raw: Json | null
          source: string
          status: string
          synced_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "mercury_transactions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_my_accessible_job_activity_events: {
        Args: { p_job_id: string; p_limit?: number }
        Returns: {
          activity_at: string
          kind: string
          summary: string
        }[]
      }
      list_my_contract_dashboard_prompts: {
        Args: never
        Returns: {
          document_name: string
          id: string
          status: string
        }[]
      }
      list_my_linked_mercury_debit_cards_for_tally: {
        Args: never
        Returns: {
          mercury_debit_card_id: string
          nickname: string
        }[]
      }
      list_my_linked_mercury_transactions_for_tally: {
        Args: never
        Returns: {
          amount: number
          counterparty_name: string
          currency: string
          invoices_summary: string
          job_splits: Json
          jobs_summary: string
          mercury_account_id: string
          mercury_account_nickname: string
          mercury_debit_card_id: string
          mercury_id: string
          mercury_transaction_id: string
          note: string
          person_label: string
          posted_at: string
          raw: Json
          tally_user_note: string
        }[]
      }
      list_my_reports: {
        Args: never
        Returns: {
          bid_id: string
          created_at: string
          created_by_name: string
          created_by_user_id: string
          field_values: Json
          id: string
          job_display_name: string
          job_hcp_number: string
          job_ledger_id: string
          project_id: string
          reported_at_lat: number
          reported_at_lng: number
          template_id: string
          template_name: string
          updated_at: string
        }[]
      }
      list_people_for_banking_attribution: {
        Args: never
        Returns: {
          id: string
          name: string
        }[]
      }
      list_people_with_kind_for_banking_attribution: {
        Args: never
        Returns: {
          id: string
          kind: string
          name: string
        }[]
      }
      list_present_mercury_ids: { Args: { p_ids: string[] }; Returns: string[] }
      list_ready_to_bill_assigned_jobs_for_dashboard: {
        Args: never
        Returns: {
          created_at: string
          google_drive_link: string
          hcp_number: string
          id: string
          job_address: string
          job_name: string
          job_pictures_link: string
          job_plans_link: string
          last_clock_activity_at: string
          last_job_activity_at: string
          last_report_at: string
          last_schedule_activity_at: string
          last_thread_note_at: string
          master_user_id: string
          my_last_report_at: string
          revenue: number
          status: string
        }[]
      }
      list_reports_for_bid: {
        Args: { p_bid_id: string }
        Returns: {
          bid_id: string
          created_at: string
          created_by_name: string
          created_by_user_id: string
          field_values: Json
          id: string
          job_display_name: string
          job_hcp_number: string
          reported_at_lat: number
          reported_at_lng: number
          template_id: string
          template_name: string
          updated_at: string
        }[]
      }
      list_reports_for_job_ledger: {
        Args: { p_job_id: string }
        Returns: {
          created_at: string
          created_by_name: string
          created_by_user_id: string
          field_values: Json
          id: string
          job_display_name: string
          job_hcp_number: string
          job_ledger_id: string
          project_id: string
          reported_at_lat: number
          reported_at_lng: number
          template_id: string
          template_name: string
          updated_at: string
        }[]
      }
      list_reports_with_job_info: {
        Args: never
        Returns: {
          bid_id: string
          created_at: string
          created_by_name: string
          created_by_user_id: string
          field_values: Json
          id: string
          job_address: string
          job_display_name: string
          job_google_drive_link: string
          job_hcp_number: string
          job_job_pictures_link: string
          job_ledger_id: string
          project_id: string
          reported_at_lat: number
          reported_at_lng: number
          template_id: string
          template_name: string
          updated_at: string
        }[]
      }
      list_schedule_blocks_for_share: {
        Args: { p_end: string; p_start: string; p_viewer: string }
        Returns: {
          assignee_name: string
          assignee_user_id: string
          id: string
          job_address: string
          job_hcp_number: string
          job_id: string
          job_name: string
          note: string
          time_end: string
          time_start: string
          work_date: string
        }[]
      }
      list_stale_unlinked_mercury_transactions_for_tally_staff: {
        Args: { include_all_unlinked?: boolean; min_age_days?: number }
        Returns: {
          amount: number
          counterparty_name: string
          currency: string
          job_splits: Json
          mercury_account_id: string
          mercury_id: string
          mercury_transaction_id: string
          note: string
          posted_at: string
          raw: Json
          target_email: string
          target_name: string
          target_phone: string
          target_user_id: string
        }[]
      }
      list_superintendent_jobs_for_dashboard: {
        Args: never
        Returns: {
          created_at: string
          google_drive_link: string
          hcp_number: string
          id: string
          in_progress_stage_name: string
          in_progress_step_id: string
          job_address: string
          job_name: string
          job_pictures_link: string
          job_plans_link: string
          my_last_report_at: string
          project_id: string
          revenue: number
        }[]
      }
      list_supply_house_invoices_for_tally_link: {
        Args: { p_mercury_transaction_id: string; search_text?: string }
        Returns: {
          already_linked: boolean
          amount: number
          counterparty_match: boolean
          due_date: string
          invoice_date: string
          invoice_id: string
          invoice_number: string
          is_paid: boolean
          job_allocation_summary: string
          link: string
          purchase_order_number: string
          supply_house_id: string
          supply_house_name: string
        }[]
      }
      list_tally_parts_with_po: {
        Args: never
        Returns: {
          created_at: string
          created_by_name: string
          created_by_user_id: string
          fixture_cost: number
          fixture_name: string
          hcp_number: string
          id: string
          job_address: string
          job_id: string
          job_name: string
          part_id: string
          part_manufacturer: string
          part_name: string
          price_at_time: number
          purchase_order_id: string
          purchase_order_name: string
          purchase_order_status: string
          quantity: number
        }[]
      }
      list_unlabeled_mercury_transactions: {
        Args: { p_limit?: number }
        Returns: {
          amount: number
          counterparty_id: string | null
          counterparty_name: string | null
          created_at: string
          created_by: string | null
          currency: string
          dashboard_link: string | null
          duplicate_of_transaction_id: string | null
          external_memo: string | null
          id: string
          kind: string
          manual_upload_id: string | null
          mercury_account_id: string
          mercury_category: Json | null
          mercury_id: string | null
          note: string | null
          posted_at: string | null
          raw: Json | null
          source: string
          status: string
          synced_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "mercury_transactions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_user_mercury_review_window: {
        Args: {
          p_end_ymd: string
          p_include_person_attributed?: boolean
          p_start_ymd: string
          p_user_id: string
        }
        Returns: {
          allocation_amount: number
          allocation_id: string
          amount: number
          attribution_person_id: string
          attribution_source: string
          counterparty_name: string
          created_at: string
          job_id: string
          label_id: string
          label_name: string
          mercury_transaction_id: string
          posted_at: string
        }[]
      }
      list_users_for_banking_attribution: {
        Args: never
        Returns: {
          id: string
          name: string
        }[]
      }
      log_bid_pricing_package_send: {
        Args: {
          p_bid_id: string
          p_plans_link: string
          p_price_book_version_id: string
          p_recipient_email: string
          p_recipient_user_id: string
          p_revenue_total_cents: number
          p_row_count: number
        }
        Returns: string
      }
      log_estimate_customer_event: {
        Args: {
          p_client_ip: string
          p_estimate_id: string
          p_event_type: string
          p_metadata?: Json
          p_source: string
          p_user_agent: string
        }
        Returns: string
      }
      mark_invoice_paid: {
        Args: {
          p_amount?: number
          p_invoice_id: string
          p_note?: string
          p_paid_on?: string
          p_payment_type?: string
          p_reference_number?: string
        }
        Returns: Json
      }
      mark_invoice_paid_from_stripe: {
        Args: {
          p_internal_note?: string
          p_invoice_id: string
          p_paid_on?: string
          p_payment_type?: string
          p_reference_number?: string
        }
        Returns: Json
      }
      mark_job_paid:
        | {
            Args: {
              p_amount?: number
              p_job_id: string
              p_note?: string
              p_paid_on?: string
              p_payment_type?: string
              p_reference_number?: string
            }
            Returns: Json
          }
        | {
            Args: { p_job_id: string; p_note?: string; p_paid_on?: string }
            Returns: Json
          }
      master_adopted_current_user: {
        Args: { master_user_id: string }
        Returns: boolean
      }
      master_shared_current_user: {
        Args: { sharing_master_id: string }
        Returns: boolean
      }
      materialize_bid_version: {
        Args: { p_bid_id: string; p_name: string }
        Returns: string
      }
      mercury_debit_card_id_from_raw: { Args: { p_raw: Json }; Returns: string }
      merge_customers: {
        Args: { p_field_choices: Json; p_survivor: string; p_victim: string }
        Returns: Json
      }
      migrate_job_ledger_costs_and_delete: {
        Args: { p_allow_billed?: boolean; p_from: string; p_to: string }
        Returns: Json
      }
      move_job_schedule_block_group: {
        Args: {
          p_job_id: string
          p_new_work_date: string
          p_shared_block_group_id: string
        }
        Returns: undefined
      }
      next_job_number_suggestion: { Args: never; Returns: string }
      next_numeric_hcp_suggestion_for_master: {
        Args: { p_master_user_id: string }
        Returns: string
      }
      notify_dispatch_license_expiry_if_needed: {
        Args: { p_license_id: string; p_link: string }
        Returns: string
      }
      pay_access_clock_week_fence_bypass: { Args: never; Returns: boolean }
      pay_staff_bulk_insert_user_time_off: {
        Args: {
          p_end_date: string
          p_note?: string
          p_start_date: string
          p_user_ids: string[]
        }
        Returns: Json
      }
      pay_staff_clear_salary_schedule_by_person_name: {
        Args: { p_person_name: string }
        Returns: Json
      }
      pay_staff_remove_not_coming_in_for_user_day: {
        Args: { p_user_id: string; p_work_date: string }
        Returns: Json
      }
      people_hours_subtract_approved_hours: {
        Args: {
          p_entered_by: string
          p_hours: number
          p_person_name: string
          p_user_id: string
          p_work_date: string
        }
        Returns: undefined
      }
      preview_merge_customers: {
        Args: { p_survivor: string; p_victim: string }
        Returns: Json
      }
      recompute_people_hours_after_session_edit: {
        Args: { p_old_work_date?: string; p_session_id: string }
        Returns: undefined
      }
      record_estimate_public_link_view: {
        Args: {
          p_client_ip?: string
          p_estimate_id: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      record_ncns_and_reject_sessions_for_day: {
        Args: {
          p_details?: string
          p_subject_user_id: string
          p_work_date: string
        }
        Returns: {
          error_message: string
          had_approved_sessions: boolean
          rejected_count: number
        }[]
      }
      refresh_jobs_ledger_last_work_date: {
        Args: { p_job_id: string }
        Returns: undefined
      }
      remove_jobs_ledger_payment_and_reconcile: {
        Args: { p_payment_id: string }
        Returns: Json
      }
      replace_estimate_catalog_payload: {
        Args: { p_payload: Json }
        Returns: undefined
      }
      replace_mercury_job_splits_for_linked_card_as_staff: {
        Args: {
          p_for_user_id: string
          p_mercury_transaction_id: string
          p_rows: Json
        }
        Returns: undefined
      }
      replace_mercury_job_splits_for_my_linked_card: {
        Args: { p_mercury_transaction_id: string; p_rows: Json }
        Returns: undefined
      }
      replace_mercury_transaction_invoice_links_as_staff: {
        Args: { p_invoice_ids: string[]; p_mercury_transaction_id: string }
        Returns: undefined
      }
      replace_mercury_transaction_invoice_links_for_my_linked_card: {
        Args: { p_invoice_ids: string[]; p_mercury_transaction_id: string }
        Returns: undefined
      }
      replace_mercury_transaction_splits: {
        Args: {
          p_mercury_transaction_id: string
          p_person_id: string
          p_rows: Json
          p_user_id?: string
        }
        Returns: undefined
      }
      replace_own_clock_session_cluster_mixed: {
        Args: { p_segments: Json; p_session_ids: string[] }
        Returns: {
          error_message: string
          inserted_ids: string[]
        }[]
      }
      report_edit_window_days: { Args: never; Returns: number }
      report_sub_visibility_months: { Args: never; Returns: number }
      reporting_window_calendar_civil_day: {
        Args: { p_civil_day: string; p_timezone: string }
        Returns: {
          reporting_date: string
          window_end_utc: string
          window_start_utc: string
        }[]
      }
      reporting_window_calendar_week_containing_anchor: {
        Args: { p_anchor_date?: string; p_timezone: string }
        Returns: {
          reporting_date: string
          window_end_utc: string
          window_start_utc: string
        }[]
      }
      reporting_window_calendar_week_prior_to_anchor: {
        Args: { p_anchor_date?: string; p_timezone: string }
        Returns: {
          reporting_date: string
          window_end_utc: string
          window_start_utc: string
        }[]
      }
      reporting_window_for_recurring_job_email: {
        Args: { p_anchor_date?: string; p_preset: string; p_timezone: string }
        Returns: {
          reporting_date: string
          window_end_utc: string
          window_start_utc: string
        }[]
      }
      resolve_pay_person_id_from_clock_user: {
        Args: { p_display_name: string; p_user_id: string }
        Returns: string
      }
      restore_rejected_clock_sessions: {
        Args: { p_session_ids: string[] }
        Returns: {
          error_message: string
          restored_count: number
        }[]
      }
      return_collect_payment_to_dispatch: {
        Args: { p_job_id: string; p_note: string }
        Returns: Json
      }
      revert_stripe_oob_invoice_payment: {
        Args: {
          p_invoice_id: string
          p_reason: string
          p_stripe_credit_note_id?: string
          p_stripe_invoice_status_after?: string
        }
        Returns: Json
      }
      revoke_clock_sessions: {
        Args: { p_session_ids: string[] }
        Returns: {
          error_message: string
          revoked_count: number
        }[]
      }
      salary_schedule_staff_or_self_target: {
        Args: { p_target_user_id: string }
        Returns: boolean
      }
      salary_sync_one_user_clock_sessions: {
        Args: { p_now: string; p_user_id: string; p_work_date: string }
        Returns: undefined
      }
      search_bids_for_clock: {
        Args: {
          p_search_text?: string
          p_service_type_id?: string
          p_service_type_ids?: string[]
        }
        Returns: {
          address: string
          bid_number: string
          customer_name: string
          id: string
          project_name: string
          service_type_id: string
          service_type_name: string
        }[]
      }
      search_estimates_for_nav: {
        Args: { search_text?: string }
        Returns: {
          customer_name: string
          estimate_number: number
          id: string
          subtitle: string
          title: string
        }[]
      }
      search_jobs_for_reports: {
        Args: { search_text?: string }
        Returns: {
          address: string
          display_name: string
          hcp_number: string
          id: string
          source: string
        }[]
      }
      search_jobs_for_tally_mercury_assign: {
        Args: { search_text?: string }
        Returns: {
          hcp_number: string
          id: string
          job_address: string
          job_name: string
        }[]
      }
      search_jobs_for_tally_mercury_assign_as_user: {
        Args: { p_for_user_id: string; search_text?: string }
        Returns: {
          hcp_number: string
          id: string
          job_address: string
          job_name: string
        }[]
      }
      search_jobs_ledger: {
        Args: { search_text?: string }
        Returns: {
          click_number: string
          hcp_number: string
          id: string
          job_address: string
          job_name: string
          service_type_id: string
          service_type_name: string
        }[]
      }
      service_apply_agreed_write_down_from_stripe: {
        Args: {
          p_actor_user_id: string
          p_invoice_id: string
          p_new_amount: number
          p_note: string
          p_stripe_credit_note_id: string
        }
        Returns: Json
      }
      set_job_collections_flag: {
        Args: { p_flagged: boolean; p_job_id: string; p_note?: string }
        Returns: Json
      }
      set_mercury_transaction_ar_returned: {
        Args: { p_mercury_transaction_id: string; p_returned: boolean }
        Returns: undefined
      }
      set_mercury_transaction_duplicate: {
        Args: { p_duplicate_id: string; p_keeper_id: string }
        Returns: undefined
      }
      set_tally_payroll_flag: {
        Args: { p_is_payroll: boolean; p_mercury_transaction_id: string }
        Returns: undefined
      }
      split_bid_into_versions: {
        Args: {
          p_bid_id: string
          p_clone_pricing: boolean
          p_current_name: string
          p_new_name: string
          p_pricing_source_version_id: string
        }
        Returns: string
      }
      split_job_ledger_fixtures_to_new_job: {
        Args: {
          p_clock_session_ids?: string[]
          p_fixture_ids: string[]
          p_new_hcp: string
          p_new_job_address: string
          p_new_job_name: string
          p_source_job_id: string
        }
        Returns: Json
      }
      split_own_clock_session_cluster: {
        Args: { p_segments: Json; p_session_ids: string[] }
        Returns: {
          error_message: string
          inserted_ids: string[]
        }[]
      }
      split_own_clock_session_segments: {
        Args: { p_segments: Json; p_session_id: string }
        Returns: {
          error_message: string
          inserted_ids: string[]
        }[]
      }
      staff_can_view_user_for_tally_followup: {
        Args: { p_target: string; p_viewer: string }
        Returns: boolean
      }
      subcontractor_can_read_jobs_ledger_row: {
        Args: { p_job_id: string }
        Returns: boolean
      }
      submit_collect_payment_certification: {
        Args: {
          p_correction_notes?: string
          p_job_id: string
          p_mode: string
          p_per_line_notes?: Json
        }
        Returns: Json
      }
      superintendent_can_access_bid: {
        Args: { b: Database["public"]["Tables"]["bids"]["Row"] }
        Returns: boolean
      }
      superintendent_can_access_estimate: {
        Args: { e: Database["public"]["Tables"]["estimates"]["Row"] }
        Returns: boolean
      }
      superintendent_report_job_anchor_allowed: {
        Args: { p_job_ledger_id: string }
        Returns: boolean
      }
      sync_crew_bids_from_clock: {
        Args: { p_person_name: string; p_work_date: string }
        Returns: undefined
      }
      sync_crew_jobs_from_clock: {
        Args: { p_person_name: string; p_work_date: string }
        Returns: undefined
      }
      sync_salary_clock_sessions_for_day: {
        Args: { p_work_date?: string }
        Returns: undefined
      }
      sync_salary_clock_sessions_for_user_day: {
        Args: { p_user_id: string; p_work_date: string }
        Returns: undefined
      }
      team_feedback_aggregates_by_manager: {
        Args: never
        Returns: {
          avg_likert_1: number
          avg_likert_2: number
          avg_likert_3: number
          avg_likert_4: number
          avg_likert_5: number
          avg_overall_1_10: number
          cycle_period_start: string
          manager_user_id: string
          submission_count: number
        }[]
      }
      update_bids_count_rows_order:
        | {
            Args: { p_bid_id: string; p_ordered_ids: string[] }
            Returns: undefined
          }
        | {
            Args: { p_bids_count_id: string; p_new_order: number }
            Returns: undefined
          }
      update_contract_book_entry: {
        Args: {
          p_book_body_format: string
          p_book_body_html: string
          p_canonical_document_url: string
          p_contract_template_document_id: string
          p_document_name: string
          p_tags: string[]
        }
        Returns: undefined
      }
      update_job_status: {
        Args: { p_job_id: string; p_to_status: string }
        Returns: Json
      }
      update_step_assigned_to: {
        Args: { p_assigned_to_name: string; p_step_id: string }
        Returns: undefined
      }
      update_step_notes: {
        Args: { p_notes: string; p_step_id: string }
        Returns: undefined
      }
      update_step_private_notes: {
        Args: { p_private_notes: string; p_step_id: string }
        Returns: undefined
      }
      upsert_mercury_org_transaction_note: {
        Args: { p_body: string; p_mercury_transaction_id: string }
        Returns: undefined
      }
      upsert_mercury_tally_transaction_note: {
        Args: { p_body: string; p_mercury_transaction_id: string }
        Returns: undefined
      }
      user_assigned_to_project_as_superintendent: {
        Args: { project_id_param: string }
        Returns: boolean
      }
      user_can_access_estimate: {
        Args: { e: Database["public"]["Tables"]["estimates"]["Row"] }
        Returns: boolean
      }
      user_can_manage_estimate_catalog: { Args: never; Returns: boolean }
      user_can_manage_recurring_job_report_scope: {
        Args: { p_scope_master_user_id: string }
        Returns: boolean
      }
      user_can_read_labels_for_master: {
        Args: { p_master_user_id: string }
        Returns: boolean
      }
      user_can_write_labels_for_master: {
        Args: { p_master_user_id: string }
        Returns: boolean
      }
      user_has_assigned_step_in_project: {
        Args: { project_id_param: string }
        Returns: boolean
      }
      user_has_prospects_staff_access: { Args: never; Returns: boolean }
      user_is_bid_estimator_or_account_manager: {
        Args: { bid_uuid: string }
        Returns: boolean
      }
      user_owns_working_board_column: {
        Args: { column_uuid: string }
        Returns: boolean
      }
      user_review_rows: {
        Args: { p_end_ymd?: string; p_start_ymd?: string }
        Returns: {
          amount: number
          counterparty_id: string
          counterparty_name: string
          created_at: string
          currency: string
          dashboard_link: string
          external_memo: string
          id: string
          kind: string
          label_id: string
          mercury_account_id: string
          mercury_category: Json
          mercury_id: string
          note: string
          person_id: string
          person_name: string
          posted_at: string
          status: string
          synced_at: string
          user_id: string
          user_name: string
        }[]
      }
      validate_pay_stub_payments_vs_net: {
        Args: { p_stub: string }
        Returns: undefined
      }
    }
    Enums: {
      estimate_status:
        | "draft"
        | "sent"
        | "customer_accepted"
        | "declined"
        | "superseded"
      project_status: "active" | "completed" | "on_hold" | "awaiting_start"
      step_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "rejected"
        | "approved"
        | "skipped"
      step_type: "delivery" | "count" | "work" | "inspection" | "billing"
      user_role:
        | "owner"
        | "master"
        | "assistant"
        | "subcontractor"
        | "master_technician"
        | "dev"
        | "estimator"
        | "primary"
        | "superintendent"
        | "helpers"
      workflow_status: "draft" | "active" | "completed"
      writeup_disclosure: "discussed_with_subject" | "withheld_from_subject"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      estimate_status: [
        "draft",
        "sent",
        "customer_accepted",
        "declined",
        "superseded",
      ],
      project_status: ["active", "completed", "on_hold", "awaiting_start"],
      step_status: [
        "pending",
        "in_progress",
        "completed",
        "rejected",
        "approved",
        "skipped",
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
        "primary",
        "superintendent",
        "helpers",
      ],
      workflow_status: ["draft", "active", "completed"],
      writeup_disclosure: ["discussed_with_subject", "withheld_from_subject"],
    },
  },
} as const
