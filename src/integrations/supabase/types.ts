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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      component_prices: {
        Row: {
          component_id: string
          created_at: string
          currency: string
          id: string
          one_time: number
          recurring_monthly: number
          setup_fee: number
        }
        Insert: {
          component_id: string
          created_at?: string
          currency: string
          id?: string
          one_time?: number
          recurring_monthly?: number
          setup_fee?: number
        }
        Update: {
          component_id?: string
          created_at?: string
          currency?: string
          id?: string
          one_time?: number
          recurring_monthly?: number
          setup_fee?: number
        }
        Relationships: [
          {
            foreignKeyName: "component_prices_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
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
          display_order: number
          icon: string
          id: string
          industry_tags: string[]
          is_active: boolean
          is_core: boolean
          name: string
          pillar: string
          priority: number
          recommendation_reason: string
          short_description: string
          slug: string
          updated_at: string
        }
        Insert: {
          client_explanation?: string
          conflicts_with?: string[]
          created_at?: string
          depends_on?: string[]
          display_order?: number
          icon?: string
          id?: string
          industry_tags?: string[]
          is_active?: boolean
          is_core?: boolean
          name: string
          pillar: string
          priority?: number
          recommendation_reason?: string
          short_description?: string
          slug: string
          updated_at?: string
        }
        Update: {
          client_explanation?: string
          conflicts_with?: string[]
          created_at?: string
          depends_on?: string[]
          display_order?: number
          icon?: string
          id?: string
          industry_tags?: string[]
          is_active?: boolean
          is_core?: boolean
          name?: string
          pillar?: string
          priority?: number
          recommendation_reason?: string
          short_description?: string
          slug?: string
          updated_at?: string
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
          first_name: string | null
          goals: string[]
          id: string
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
          first_name?: string | null
          goals?: string[]
          id?: string
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
          first_name?: string | null
          goals?: string[]
          id?: string
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
      quotes: {
        Row: {
          created_at: string
          currency: string
          deposit_amount: number
          expires_at: string
          id: string
          items: Json
          one_time_total: number
          quote_number: string
          recurring_total: number
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency: string
          deposit_amount?: number
          expires_at?: string
          id?: string
          items?: Json
          one_time_total?: number
          quote_number: string
          recurring_total?: number
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          deposit_amount?: number
          expires_at?: string
          id?: string
          items?: Json
          one_time_total?: number
          quote_number?: string
          recurring_total?: number
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
