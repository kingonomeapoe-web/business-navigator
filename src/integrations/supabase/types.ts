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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      client_notifications: {
        Row: {
          body: string
          created_at: string
          customer_id: string
          id: string
          idempotency_key: string | null
          kind: string
          project_id: string
          read_at: string | null
          title: string
        }
        Insert: {
          body?: string
          created_at?: string
          customer_id: string
          id?: string
          idempotency_key?: string | null
          kind: string
          project_id: string
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          customer_id?: string
          id?: string
          idempotency_key?: string | null
          kind?: string
          project_id?: string
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      component_dependencies: {
        Row: {
          component_id: string
          created_at: string
          id: string
          kind: string
          related_component_id: string
        }
        Insert: {
          component_id: string
          created_at?: string
          id?: string
          kind: string
          related_component_id: string
        }
        Update: {
          component_id?: string
          created_at?: string
          id?: string
          kind?: string
          related_component_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "component_dependencies_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "component_dependencies_related_component_id_fkey"
            columns: ["related_component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
        ]
      }
      component_industries: {
        Row: {
          component_id: string
          created_at: string
          id: string
          industry_id: string
        }
        Insert: {
          component_id: string
          created_at?: string
          id?: string
          industry_id: string
        }
        Update: {
          component_id?: string
          created_at?: string
          id?: string
          industry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "component_industries_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "component_industries_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "industries"
            referencedColumns: ["id"]
          },
        ]
      }
      component_prices: {
        Row: {
          active: boolean
          component_id: string
          created_at: string
          currency: string
          id: string
          market_id: string | null
          one_time: number
          recurring_monthly: number
          setup_fee: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          component_id: string
          created_at?: string
          currency: string
          id?: string
          market_id?: string | null
          one_time?: number
          recurring_monthly?: number
          setup_fee?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          component_id?: string
          created_at?: string
          currency?: string
          id?: string
          market_id?: string | null
          one_time?: number
          recurring_monthly?: number
          setup_fee?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "component_prices_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "component_prices_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      components: {
        Row: {
          client_explanation: string
          conflicts_with: string[]
          created_at: string
          depends_on: string[]
          detailed_explanation: string
          display_order: number
          featured: boolean
          has_one_time: boolean
          has_recurring: boolean
          icon: string
          id: string
          image_url: string | null
          industry_tags: string[]
          internal_notes: string
          is_active: boolean
          is_core: boolean
          name: string
          pillar: string
          pricing_model: string
          priority: number
          recommendation_reason: string
          short_description: string
          slug: string
          status: string
          updated_at: string
          upsell_message: string
        }
        Insert: {
          client_explanation?: string
          conflicts_with?: string[]
          created_at?: string
          depends_on?: string[]
          detailed_explanation?: string
          display_order?: number
          featured?: boolean
          has_one_time?: boolean
          has_recurring?: boolean
          icon?: string
          id?: string
          image_url?: string | null
          industry_tags?: string[]
          internal_notes?: string
          is_active?: boolean
          is_core?: boolean
          name: string
          pillar: string
          pricing_model?: string
          priority?: number
          recommendation_reason?: string
          short_description?: string
          slug: string
          status?: string
          updated_at?: string
          upsell_message?: string
        }
        Update: {
          client_explanation?: string
          conflicts_with?: string[]
          created_at?: string
          depends_on?: string[]
          detailed_explanation?: string
          display_order?: number
          featured?: boolean
          has_one_time?: boolean
          has_recurring?: boolean
          icon?: string
          id?: string
          image_url?: string | null
          industry_tags?: string[]
          internal_notes?: string
          is_active?: boolean
          is_core?: boolean
          name?: string
          pillar?: string
          pricing_model?: string
          priority?: number
          recommendation_reason?: string
          short_description?: string
          slug?: string
          status?: string
          updated_at?: string
          upsell_message?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          business_name: string | null
          country: string | null
          created_at: string
          currency: string
          email: string
          first_name: string | null
          id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          business_name?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          email: string
          first_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          business_name?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          email?: string
          first_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      diagnostic_sessions: {
        Row: {
          answers: Json
          business_description: string | null
          business_name: string | null
          city: string | null
          classification: Json
          country: string | null
          created_at: string
          currency: string
          email: string | null
          email_captured_at: string | null
          email_consent: boolean
          first_name: string | null
          goals: string[]
          id: string
          marketing_opt_in: boolean
          region: string | null
          selected_components: string[]
          service_area: string | null
          session_token: string
          status: string
          step: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          business_description?: string | null
          business_name?: string | null
          city?: string | null
          classification?: Json
          country?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          email_captured_at?: string | null
          email_consent?: boolean
          first_name?: string | null
          goals?: string[]
          id?: string
          marketing_opt_in?: boolean
          region?: string | null
          selected_components?: string[]
          service_area?: string | null
          session_token?: string
          status?: string
          step?: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          business_description?: string | null
          business_name?: string | null
          city?: string | null
          classification?: Json
          country?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          email_captured_at?: string | null
          email_consent?: boolean
          first_name?: string | null
          goals?: string[]
          id?: string
          marketing_opt_in?: boolean
          region?: string | null
          selected_components?: string[]
          service_area?: string | null
          session_token?: string
          status?: string
          step?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_deliveries: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          id: string
          idempotency_key: string
          provider: string
          provider_message_id: string | null
          quote_id: string | null
          session_id: string | null
          status: string
          template: string
          to_email: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key: string
          provider?: string
          provider_message_id?: string | null
          quote_id?: string | null
          session_id?: string | null
          status?: string
          template: string
          to_email: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key?: string
          provider?: string
          provider_message_id?: string | null
          quote_id?: string | null
          session_id?: string | null
          status?: string
          template?: string
          to_email?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_deliveries_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_deliveries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      industries: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      internal_notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          payload: Json
          status: string
          subject: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          status?: string
          subject: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          status?: string
          subject?: string
        }
        Relationships: []
      }
      markets: {
        Row: {
          active: boolean
          code: string
          created_at: string
          currency_code: string
          display_order: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          currency_code: string
          display_order?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          currency_code?: string
          display_order?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_responses: {
        Row: {
          created_at: string
          id: string
          item_key: string
          project_id: string
          section_key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          item_key: string
          project_id: string
          section_key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          item_key?: string
          project_id?: string
          section_key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_responses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          component_slug: string
          created_at: string
          id: string
          name: string
          one_time: number
          order_id: string
          pillar: string
          quantity: number
          recurring_monthly: number
        }
        Insert: {
          component_slug: string
          created_at?: string
          id?: string
          name: string
          one_time?: number
          order_id: string
          pillar?: string
          quantity?: number
          recurring_monthly?: number
        }
        Update: {
          component_slug?: string
          created_at?: string
          id?: string
          name?: string
          one_time?: number
          order_id?: string
          pillar?: string
          quantity?: number
          recurring_monthly?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string
          currency: string
          customer_id: string
          deposit_amount: number
          id: string
          one_time_total: number
          order_number: string
          payment_plan: string
          quote_id: string
          quote_version_id: string
          recurring_total: number
          session_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          currency: string
          customer_id: string
          deposit_amount?: number
          id?: string
          one_time_total?: number
          order_number: string
          payment_plan?: string
          quote_id: string
          quote_version_id: string
          recurring_total?: number
          session_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          currency?: string
          customer_id?: string
          deposit_amount?: number
          id?: string
          one_time_total?: number
          order_number?: string
          payment_plan?: string
          quote_id?: string
          quote_version_id?: string
          recurring_total?: number
          session_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_version_id_fkey"
            columns: ["quote_version_id"]
            isOneToOne: false
            referencedRelation: "quote_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          id: string
          payload: Json
          payment_id: string | null
          processed_at: string | null
          provider: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          payload?: Json
          payment_id?: string | null
          processed_at?: string | null
          provider: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          payment_id?: string | null
          processed_at?: string | null
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          customer_id: string
          id: string
          kind: string
          order_id: string
          provider: string
          provider_reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          customer_id: string
          id?: string
          kind?: string
          order_id: string
          provider: string
          provider_reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          customer_id?: string
          id?: string
          kind?: string
          order_id?: string
          provider?: string
          provider_reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_change_log: {
        Row: {
          changed_by: string | null
          component_id: string
          created_at: string
          currency: string
          field: string
          id: string
          market_id: string | null
          new_value: number | null
          note: string | null
          previous_value: number | null
        }
        Insert: {
          changed_by?: string | null
          component_id: string
          created_at?: string
          currency: string
          field: string
          id?: string
          market_id?: string | null
          new_value?: number | null
          note?: string | null
          previous_value?: number | null
        }
        Update: {
          changed_by?: string | null
          component_id?: string
          created_at?: string
          currency?: string
          field?: string
          id?: string
          market_id?: string | null
          new_value?: number | null
          note?: string | null
          previous_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_change_log_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_change_log_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_assets: {
        Row: {
          category: string
          filename: string
          id: string
          mime_type: string
          project_id: string
          size_bytes: number
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string
          filename: string
          id?: string
          mime_type: string
          project_id: string
          size_bytes?: number
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          filename?: string
          id?: string
          mime_type?: string
          project_id?: string
          size_bytes?: number
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          project_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          project_id: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          project_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_status_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          name: string
          onboarding_completed_at: string | null
          order_id: string
          readiness: number
          ready_for_build_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          name: string
          onboarding_completed_at?: string | null
          order_id: string
          readiness?: number
          ready_for_build_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          name?: string
          onboarding_completed_at?: string | null
          order_id?: string
          readiness?: number
          ready_for_build_at?: string | null
          status?: string
          updated_at?: string
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
            foreignKeyName: "projects_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_versions: {
        Row: {
          created_at: string
          currency: string
          deposit_amount: number
          id: string
          items: Json
          one_time_total: number
          quote_id: string
          recurring_total: number
          snapshot_hash: string
          version: number
        }
        Insert: {
          created_at?: string
          currency: string
          deposit_amount?: number
          id?: string
          items?: Json
          one_time_total?: number
          quote_id: string
          recurring_total?: number
          snapshot_hash: string
          version: number
        }
        Update: {
          created_at?: string
          currency?: string
          deposit_amount?: number
          id?: string
          items?: Json
          one_time_total?: number
          quote_id?: string
          recurring_total?: number
          snapshot_hash?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_versions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          accepted_by_email: string | null
          accepted_by_name: string | null
          accepted_version: number | null
          access_token: string
          created_at: string
          currency: string
          current_version: number
          customer_id: string | null
          deposit_amount: number
          expires_at: string
          id: string
          items: Json
          one_time_total: number
          quote_number: string
          recurring_total: number
          sent_at: string | null
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_email?: string | null
          accepted_by_name?: string | null
          accepted_version?: number | null
          access_token?: string
          created_at?: string
          currency: string
          current_version?: number
          customer_id?: string | null
          deposit_amount?: number
          expires_at?: string
          id?: string
          items?: Json
          one_time_total?: number
          quote_number: string
          recurring_total?: number
          sent_at?: string | null
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_email?: string | null
          accepted_by_name?: string | null
          accepted_version?: number | null
          access_token?: string
          created_at?: string
          currency?: string
          current_version?: number
          customer_id?: string | null
          deposit_amount?: number
          expires_at?: string
          id?: string
          items?: Json
          one_time_total?: number
          quote_number?: string
          recurring_total?: number
          sent_at?: string | null
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          id: string
          subject: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          id?: string
          subject: string
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          id?: string
          subject?: string
          window_start?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          currency: string
          current_period_end: string | null
          customer_id: string
          id: string
          monthly_amount: number
          order_id: string
          provider: string
          provider_reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency: string
          current_period_end?: string | null
          customer_id: string
          id?: string
          monthly_amount?: number
          order_id: string
          provider: string
          provider_reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          current_period_end?: string | null
          customer_id?: string
          id?: string
          monthly_amount?: number
          order_id?: string
          provider?: string
          provider_reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_catalogue_admin: { Args: { _user_id: string }; Returns: boolean }
      owns_project: { Args: { _project_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "staff" | "client" | "super_admin"
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
      app_role: ["admin", "staff", "client", "super_admin"],
    },
  },
} as const
