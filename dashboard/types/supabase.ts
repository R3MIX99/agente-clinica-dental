export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          doctor_id: string | null
          duracion_min: number | null
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
          doctor_id?: string | null
          duracion_min?: number | null
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
          doctor_id?: string | null
          duracion_min?: number | null
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
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
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
      clinical_notes: {
        Row: {
          contenido: string
          created_at: string
          id: string
          patient_id: string
        }
        Insert: {
          contenido: string
          created_at?: string
          id?: string
          patient_id: string
        }
        Update: {
          contenido?: string
          created_at?: string
          id?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_agent_id: string | null
          channel: Database["public"]["Enums"]["channel_type"]
          created_at: string
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
      doctor_schedules: {
        Row: {
          created_at: string
          dia_semana: number
          doctor_id: string
          hora_fin: string
          hora_inicio: string
          id: string
        }
        Insert: {
          created_at?: string
          dia_semana: number
          doctor_id: string
          hora_fin: string
          hora_inicio: string
          id?: string
        }
        Update: {
          created_at?: string
          dia_semana?: number
          doctor_id?: string
          hora_fin?: string
          hora_inicio?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_schedules_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          created_at: string | null
          email: string | null
          especialidades: string[] | null
          fecha_ingreso: string | null
          id: string
          nombre: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          especialidades?: string[] | null
          fecha_ingreso?: string | null
          id?: string
          nombre: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          especialidades?: string[] | null
          fecha_ingreso?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
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
      patient_doctors: {
        Row: {
          created_at: string | null
          doctor_id: string
          id: string
          orden: number
          patient_id: string
        }
        Insert: {
          created_at?: string | null
          doctor_id: string
          id?: string
          orden?: number
          patient_id: string
        }
        Update: {
          created_at?: string | null
          doctor_id?: string
          id?: string
          orden?: number
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_doctors_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_doctors_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
          fecha_ingreso: string | null
          id: string
          laboratorio: string | null
          nombre: string
          notas: string | null
          telefono: string | null
          tiempo_cita_min: number | null
        }
        Insert: {
          channel?: Database["public"]["Enums"]["channel_type"]
          channel_user_id?: string | null
          created_at?: string
          email?: string | null
          fecha_ingreso?: string | null
          id?: string
          laboratorio?: string | null
          nombre: string
          notas?: string | null
          telefono?: string | null
          tiempo_cita_min?: number | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["channel_type"]
          channel_user_id?: string | null
          created_at?: string
          email?: string | null
          fecha_ingreso?: string | null
          id?: string
          laboratorio?: string | null
          nombre?: string
          notas?: string | null
          telefono?: string | null
          tiempo_cita_min?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activo: boolean
          created_at: string
          doctor_id: string | null
          email: string | null
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          doctor_id?: string | null
          email?: string | null
          id: string
          nombre: string
          rol?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          doctor_id?: string | null
          email?: string | null
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
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
      studies: {
        Row: {
          created_at: string | null
          descripcion: string | null
          fecha_indicacion: string | null
          id: string
          nombre: string
          patient_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          fecha_indicacion?: string | null
          id?: string
          nombre: string
          patient_id: string
          status?: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          fecha_indicacion?: string | null
          id?: string
          nombre?: string
          patient_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "studies_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
      user_role: "administrador" | "supervisor" | "doctor"
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
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
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agent_role: ["admin", "recepcion", "odontologo"],
      appointment_status: ["programada", "confirmada", "cancelada", "completada", "no_asistio"],
      channel_type: ["telegram", "whatsapp"],
      conversation_mode: ["bot", "humano"],
      conversation_status: ["abierta", "pendiente", "cerrada"],
      message_direction: ["entrante", "saliente"],
      message_sender: ["paciente", "bot", "agente"],
      user_role: ["administrador", "supervisor", "doctor"],
    },
  },
} as const
