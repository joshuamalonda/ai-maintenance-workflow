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
      agencies: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      agency_members: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          member_role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          member_role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          member_role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_members_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_endpoints: {
        Row: {
          agency_id: string
          channel: string
          created_at: string
          id: string
          identifier: string
          identifier_key: string
          is_active: boolean
          label: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          channel: string
          created_at?: string
          id?: string
          identifier: string
          identifier_key: string
          is_active?: boolean
          label?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          channel?: string
          created_at?: string
          id?: string
          identifier?: string
          identifier_key?: string
          is_active?: boolean
          label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_endpoints_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_properties: {
        Row: {
          contractor_id: string
          created_at: string
          id: string
          property_id: string
        }
        Insert: {
          contractor_id: string
          created_at?: string
          id?: string
          property_id: string
        }
        Update: {
          contractor_id?: string
          created_at?: string
          id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_properties_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          active: boolean
          agency_id: string
          company: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          trade: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          agency_id: string
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          trade?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          agency_id?: string
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          trade?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractors_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      landlords: {
        Row: {
          agency_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landlords_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_cases: {
        Row: {
          agency_id: string
          ai_confidence: number | null
          ai_summary: string | null
          assigned_at: string | null
          call_control_id: string | null
          call_duration_secs: number | null
          call_leg_id: string | null
          call_recording_url: string | null
          call_sid: string | null
          caller_number: string | null
          communication_channel: string
          contractor_id: string | null
          contractor_required: boolean | null
          conversation_id: string | null
          created_at: string
          enrichment_attempts: number
          enrichment_last_checked_at: string | null
          enrichment_status: string
          id: string
          issue_category: string
          issue_description: string
          last_ai_action: string | null
          missing_information: string | null
          preferred_language: string | null
          priority: string | null
          property_address: string
          property_id: string | null
          recommended_action: string | null
          recording_storage_path: string | null
          reference_code: string
          reported_at: string
          source_channel: string
          status: string
          tenant_id: string | null
          tenant_name: string
          transcript: string | null
          troubleshooting: string | null
          updated_at: string
          urgency: string
        }
        Insert: {
          agency_id: string
          ai_confidence?: number | null
          ai_summary?: string | null
          assigned_at?: string | null
          call_control_id?: string | null
          call_duration_secs?: number | null
          call_leg_id?: string | null
          call_recording_url?: string | null
          call_sid?: string | null
          caller_number?: string | null
          communication_channel?: string
          contractor_id?: string | null
          contractor_required?: boolean | null
          conversation_id?: string | null
          created_at?: string
          enrichment_attempts?: number
          enrichment_last_checked_at?: string | null
          enrichment_status?: string
          id?: string
          issue_category: string
          issue_description: string
          last_ai_action?: string | null
          missing_information?: string | null
          preferred_language?: string | null
          priority?: string | null
          property_address: string
          property_id?: string | null
          recommended_action?: string | null
          recording_storage_path?: string | null
          reference_code?: string
          reported_at?: string
          source_channel?: string
          status?: string
          tenant_id?: string | null
          tenant_name: string
          transcript?: string | null
          troubleshooting?: string | null
          updated_at?: string
          urgency?: string
        }
        Update: {
          agency_id?: string
          ai_confidence?: number | null
          ai_summary?: string | null
          assigned_at?: string | null
          call_control_id?: string | null
          call_duration_secs?: number | null
          call_leg_id?: string | null
          call_recording_url?: string | null
          call_sid?: string | null
          caller_number?: string | null
          communication_channel?: string
          contractor_id?: string | null
          contractor_required?: boolean | null
          conversation_id?: string | null
          created_at?: string
          enrichment_attempts?: number
          enrichment_last_checked_at?: string | null
          enrichment_status?: string
          id?: string
          issue_category?: string
          issue_description?: string
          last_ai_action?: string | null
          missing_information?: string | null
          preferred_language?: string | null
          priority?: string | null
          property_address?: string
          property_id?: string | null
          recommended_action?: string | null
          recording_storage_path?: string | null
          reference_code?: string
          reported_at?: string
          source_channel?: string
          status?: string
          tenant_id?: string | null
          tenant_name?: string
          transcript?: string | null
          troubleshooting?: string | null
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_cases_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_cases_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_cases_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_cases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string
          agency_id: string
          created_at: string
          id: string
          landlord_id: string | null
          postcode: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          address: string
          agency_id: string
          created_at?: string
          id?: string
          landlord_id?: string | null
          postcode?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          agency_id?: string
          created_at?: string
          id?: string
          landlord_id?: string | null
          postcode?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "landlords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      telnyx_messaging_events: {
        Row: {
          direction: string | null
          event_id: string
          event_type: string
          from_number: string | null
          message_id: string | null
          occurred_at: string | null
          payload: Json
          received_at: string
          to_number: string | null
        }
        Insert: {
          direction?: string | null
          event_id: string
          event_type: string
          from_number?: string | null
          message_id?: string | null
          occurred_at?: string | null
          payload: Json
          received_at?: string
          to_number?: string | null
        }
        Update: {
          direction?: string | null
          event_id?: string
          event_type?: string
          from_number?: string | null
          message_id?: string | null
          occurred_at?: string | null
          payload?: Json
          received_at?: string
          to_number?: string | null
        }
        Relationships: []
      }
      tenants: {
        Row: {
          agency_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
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
      is_console_user: { Args: { _user_id: string }; Returns: boolean }
      next_case_reference: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "staff"
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
      app_role: ["admin", "staff"],
    },
  },
} as const
