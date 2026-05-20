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
      agents: {
        Row: {
          activo: boolean
          created_at: string
          email: string | null
          id: string
          nombre: string
          role: Database["public"]["Enums"]["agent_role"]
        }
        Insert: {
          activo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nombre: string
          role?: Database["public"]["Enums"]["agent_role"]
        }
        Update: {
          activo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string
          role?: Database["public"]["Enums"]["agent_role"]
        }
        Relationships: []
      }
      appointments: {
        Row: {
          costo: number | null
          created_at: string
          fecha_hora: string
          id: string
          notas: string | null
          patient_id: string | null
          recordatorio_enviado_at: string | null
          service_id: string | null
          status: Database["public"]["Enums"]["appointment_status"]
        }
        Insert: {
          costo?: number | null
          created_at?: string
          fecha_hora: string
          id?: string
          notas?: string | null
          patient_id?: string | null
          recordatorio_enviado_at?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
        }
        Update: {
          costo?: number | null
          created_at?: string
          fecha_hora?: string
          id?: string
          notas?: string | null
          patient_id?: string | null
          recordatorio_enviado_at?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_info: {
        Row: {
          created_at: string
          direccion: string | null
          email: string | null
          facturacion: string | null
          faq: Json | null
          formas_pago: string | null
          horario: string | null
          id: string
          mapa_url: string | null
          nombre: string | null
          sitio_web: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          direccion?: string | null
          email?: string | null
          facturacion?: string | null
          faq?: Json | null
          formas_pago?: string | null
          horario?: string | null
          id?: string
          mapa_url?: string | null
          nombre?: string | null
          sitio_web?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          direccion?: string | null
          email?: string | null
          facturacion?: string | null
          faq?: Json | null
          formas_pago?: string | null
          horario?: string | null
          id?: string
          mapa_url?: string | null
          nombre?: string | null
          sitio_web?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          assigned_agent_id: string | null
          channel: Database["public"]["Enums"]["channel_type"]
          created_at: string
          id: string
          last_message_at: string
          mode: Database["public"]["Enums"]["conversation_mode"]
          patient_id: string | null
          status: Database["public"]["Enums"]["conversation_status"]
        }
        Insert: {
          assigned_agent_id?: string | null
          channel: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          id?: string
          last_message_at?: string
          mode?: Database["public"]["Enums"]["conversation_mode"]
          patient_id?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
        }
        Update: {
          assigned_agent_id?: string | null
          channel?: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          id?: string
          last_message_at?: string
          mode?: Database["public"]["Enums"]["conversation_mode"]
          patient_id?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          contenido: string
          conversation_id: string | null
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          id: string
          metadata: Json | null
          sender: Database["public"]["Enums"]["message_sender"]
        }
        Insert: {
          contenido: string
          conversation_id?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          id?: string
          metadata?: Json | null
          sender: Database["public"]["Enums"]["message_sender"]
        }
        Update: {
          contenido?: string
          conversation_id?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          id?: string
          metadata?: Json | null
          sender?: Database["public"]["Enums"]["message_sender"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          channel: Database["public"]["Enums"]["channel_type"]
          channel_user_id: string | null
          created_at: string
          email: string | null
          id: string
          nombre: string
          notas: string | null
          telefono: string | null
        }
        Insert: {
          channel?: Database["public"]["Enums"]["channel_type"]
          channel_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nombre: string
          notas?: string | null
          telefono?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["channel_type"]
          channel_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      services: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          duracion_min: number | null
          id: string
          nombre: string
          precio: number
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          duracion_min?: number | null
          id?: string
          nombre: string
          precio: number
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          duracion_min?: number | null
          id?: string
          nombre?: string
          precio?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      agent_role: "admin" | "recepcion" | "odontologo"
      appointment_status:
        | "programada"
        | "confirmada"
        | "cancelada"
        | "completada"
        | "no_asistio"
      channel_type: "telegram" | "whatsapp"
      conversation_mode: "bot" | "humano"
      conversation_status: "abierta" | "pendiente" | "cerrada"
      message_direction: "entrante" | "saliente"
      message_sender: "paciente" | "bot" | "agente"
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
      agent_role: ["admin", "recepcion", "odontologo"],
      appointment_status: [
        "programada",
        "confirmada",
        "cancelada",
        "completada",
        "no_asistio",
      ],
      channel_type: ["telegram", "whatsapp"],
      conversation_mode: ["bot", "humano"],
      conversation_status: ["abierta", "pendiente", "cerrada"],
      message_direction: ["entrante", "saliente"],
      message_sender: ["paciente", "bot", "agente"],
    },
  },
} as const
