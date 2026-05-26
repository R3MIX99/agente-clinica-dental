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
          clinica_id: string
          created_at: string
          email: string | null
          id: string
          nombre: string
          role: Database["public"]["Enums"]["agent_role"]
        }
        Insert: {
          activo?: boolean
          clinica_id: string
          created_at?: string
          email?: string | null
          id?: string
          nombre: string
          role?: Database["public"]["Enums"]["agent_role"]
        }
        Update: {
          activo?: boolean
          clinica_id?: string
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string
          role?: Database["public"]["Enums"]["agent_role"]
        }
        Relationships: [
          {
            foreignKeyName: "agents_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          clinica_id: string
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
          clinica_id: string
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
          clinica_id?: string
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
            foreignKeyName: "appointments_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
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
          clinica_id: string
          contenido: string
          created_at: string
          id: string
          patient_id: string
        }
        Insert: {
          clinica_id: string
          contenido: string
          created_at?: string
          id?: string
          patient_id: string
        }
        Update: {
          clinica_id?: string
          contenido?: string
          created_at?: string
          id?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_notes_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      clinicas: {
        Row: {
          activa: boolean
          created_at: string
          cuenta_id: string
          direccion: string | null
          email: string | null
          facturacion: string | null
          faq: Json | null
          formas_pago: string | null
          horario: string | null
          id: string
          mapa_url: string | null
          nombre: string | null
          onboarding_completado: boolean
          sitio_web: string | null
          telefono: string | null
          updated_at: string
          zona_horaria: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          cuenta_id: string
          direccion?: string | null
          email?: string | null
          facturacion?: string | null
          faq?: Json | null
          formas_pago?: string | null
          horario?: string | null
          id?: string
          mapa_url?: string | null
          nombre?: string | null
          onboarding_completado?: boolean
          sitio_web?: string | null
          telefono?: string | null
          updated_at?: string
          zona_horaria?: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          cuenta_id?: string
          direccion?: string | null
          email?: string | null
          facturacion?: string | null
          faq?: Json | null
          formas_pago?: string | null
          horario?: string | null
          id?: string
          mapa_url?: string | null
          nombre?: string | null
          onboarding_completado?: boolean
          sitio_web?: string | null
          telefono?: string | null
          updated_at?: string
          zona_horaria?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinicas_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_agent_id: string | null
          channel: Database["public"]["Enums"]["channel_type"]
          clinica_id: string
          created_at: string
          deleted_at: string | null
          id: string
          intencion: string | null
          last_message_at: string
          mode: Database["public"]["Enums"]["conversation_mode"]
          patient_id: string | null
          sentimiento: string | null
          status: Database["public"]["Enums"]["conversation_status"]
        }
        Insert: {
          assigned_agent_id?: string | null
          channel: Database["public"]["Enums"]["channel_type"]
          clinica_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          intencion?: string | null
          last_message_at?: string
          mode?: Database["public"]["Enums"]["conversation_mode"]
          patient_id?: string | null
          sentimiento?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
        }
        Update: {
          assigned_agent_id?: string | null
          channel?: Database["public"]["Enums"]["channel_type"]
          clinica_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          intencion?: string | null
          last_message_at?: string
          mode?: Database["public"]["Enums"]["conversation_mode"]
          patient_id?: string | null
          sentimiento?: string | null
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
            foreignKeyName: "conversations_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
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
      cuentas: {
        Row: {
          created_at: string
          email_contacto: string | null
          estado: string
          id: string
          nombre: string
        }
        Insert: {
          created_at?: string
          email_contacto?: string | null
          estado?: string
          id?: string
          nombre: string
        }
        Update: {
          created_at?: string
          email_contacto?: string | null
          estado?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      doctor_schedules: {
        Row: {
          clinica_id: string
          created_at: string
          dia_semana: number
          doctor_id: string
          hora_fin: string
          hora_inicio: string
          id: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          dia_semana: number
          doctor_id: string
          hora_fin: string
          hora_inicio: string
          id?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          dia_semana?: number
          doctor_id?: string
          hora_fin?: string
          hora_inicio?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_schedules_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
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
          clinica_id: string
          created_at: string | null
          email: string | null
          especialidades: string[] | null
          fecha_ingreso: string | null
          id: string
          nombre: string
        }
        Insert: {
          clinica_id: string
          created_at?: string | null
          email?: string | null
          especialidades?: string[] | null
          fecha_ingreso?: string | null
          id?: string
          nombre: string
        }
        Update: {
          clinica_id?: string
          created_at?: string | null
          email?: string | null
          especialidades?: string[] | null
          fecha_ingreso?: string | null
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctors_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      membresias: {
        Row: {
          activa: boolean
          clinica_id: string | null
          created_at: string
          cuenta_id: string
          id: string
          rol: string
          user_id: string
        }
        Insert: {
          activa?: boolean
          clinica_id?: string | null
          created_at?: string
          cuenta_id: string
          id?: string
          rol: string
          user_id: string
        }
        Update: {
          activa?: boolean
          clinica_id?: string | null
          created_at?: string
          cuenta_id?: string
          id?: string
          rol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membresias_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membresias_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          clinica_id: string | null
          contenido: string
          conversation_id: string | null
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          id: string
          metadata: Json | null
          sender: Database["public"]["Enums"]["message_sender"]
        }
        Insert: {
          clinica_id?: string | null
          contenido: string
          conversation_id?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          id?: string
          metadata?: Json | null
          sender: Database["public"]["Enums"]["message_sender"]
        }
        Update: {
          clinica_id?: string | null
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
            foreignKeyName: "messages_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
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
          clinica_id: string
          created_at: string | null
          doctor_id: string
          id: string
          orden: number
          patient_id: string
        }
        Insert: {
          clinica_id: string
          created_at?: string | null
          doctor_id: string
          id?: string
          orden?: number
          patient_id: string
        }
        Update: {
          clinica_id?: string
          created_at?: string | null
          doctor_id?: string
          id?: string
          orden?: number
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_doctors_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
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
          clinica_id: string
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
          clinica_id: string
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
          clinica_id?: string
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
        Relationships: [
          {
            foreignKeyName: "patients_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      planes: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          max_clinicas: number
          max_doctores: number
          max_recordatorios_mes: number
          max_usuarios: number
          nombre: string
          precio_anual_mxn: number
          precio_mensual_mxn: number
          saldo_ia_incluido_mxn: number
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          max_clinicas: number
          max_doctores: number
          max_recordatorios_mes: number
          max_usuarios: number
          nombre: string
          precio_anual_mxn: number
          precio_mensual_mxn: number
          saldo_ia_incluido_mxn: number
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          max_clinicas?: number
          max_doctores?: number
          max_recordatorios_mes?: number
          max_usuarios?: number
          nombre?: string
          precio_anual_mxn?: number
          precio_mensual_mxn?: number
          saldo_ia_incluido_mxn?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activo: boolean
          clinica_id: string | null
          created_at: string
          cuenta_id: string | null
          doctor_id: string | null
          email: string | null
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          clinica_id?: string | null
          created_at?: string
          cuenta_id?: string | null
          doctor_id?: string | null
          email?: string | null
          id: string
          nombre: string
          rol?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          clinica_id?: string | null
          created_at?: string
          cuenta_id?: string | null
          doctor_id?: string | null
          email?: string | null
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
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
          clinica_id: string
          created_at: string
          descripcion: string | null
          duracion_min: number | null
          id: string
          nombre: string
          precio: number
        }
        Insert: {
          activo?: boolean
          clinica_id: string
          created_at?: string
          descripcion?: string | null
          duracion_min?: number | null
          id?: string
          nombre: string
          precio: number
        }
        Update: {
          activo?: boolean
          clinica_id?: string
          created_at?: string
          descripcion?: string | null
          duracion_min?: number | null
          id?: string
          nombre?: string
          precio?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      studies: {
        Row: {
          clinica_id: string
          created_at: string | null
          descripcion: string | null
          fecha_indicacion: string | null
          id: string
          nombre: string
          patient_id: string
          status: string
        }
        Insert: {
          clinica_id: string
          created_at?: string | null
          descripcion?: string | null
          fecha_indicacion?: string | null
          id?: string
          nombre: string
          patient_id: string
          status?: string
        }
        Update: {
          clinica_id?: string
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
            foreignKeyName: "studies_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studies_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      suscripciones: {
        Row: {
          created_at: string
          cuenta_id: string
          estado: string
          fin_periodo: string | null
          id: string
          inicio_periodo: string | null
          mp_subscription_id: string | null
          periodo: string
          plan_id: string
          recordatorios_enviados: number
          saldo_ia_disponible_mxn: number
        }
        Insert: {
          created_at?: string
          cuenta_id: string
          estado?: string
          fin_periodo?: string | null
          id?: string
          inicio_periodo?: string | null
          mp_subscription_id?: string | null
          periodo?: string
          plan_id: string
          recordatorios_enviados?: number
          saldo_ia_disponible_mxn?: number
        }
        Update: {
          created_at?: string
          cuenta_id?: string
          estado?: string
          fin_periodo?: string | null
          id?: string
          inicio_periodo?: string | null
          mp_subscription_id?: string | null
          periodo?: string
          plan_id?: string
          recordatorios_enviados?: number
          saldo_ia_disponible_mxn?: number
        }
        Relationships: [
          {
            foreignKeyName: "suscripciones_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suscripciones_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "planes"
            referencedColumns: ["id"]
          },
        ]
      }
      uso_metering: {
        Row: {
          cantidad: number
          clinica_id: string
          created_at: string
          cuenta_id: string
          id: string
          referencia_id: string | null
          tipo: string
        }
        Insert: {
          cantidad: number
          clinica_id: string
          created_at?: string
          cuenta_id: string
          id?: string
          referencia_id?: string | null
          tipo: string
        }
        Update: {
          cantidad?: number
          clinica_id?: string
          created_at?: string
          cuenta_id?: string
          id?: string
          referencia_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "uso_metering_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uso_metering_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
        ]
      }
      config_sistema: {
        Row: {
          clave: string
          valor: string
          descripcion: string | null
          updated_at: string
        }
        Insert: {
          clave: string
          valor: string
          descripcion?: string | null
          updated_at?: string
        }
        Update: {
          clave?: string
          valor?: string
          descripcion?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      consumos_ia: {
        Row: {
          id: string
          cuenta_id: string
          clinica_id: string
          suscripcion_id: string
          conversacion_id: string | null
          modelo: string
          tokens_entrada: number
          tokens_salida: number
          costo_api_usd: number
          tipo_cambio: number
          markup: number
          costo_descontado_mxn: number
          created_at: string
        }
        Insert: {
          id?: string
          cuenta_id: string
          clinica_id: string
          suscripcion_id: string
          conversacion_id?: string | null
          modelo?: string
          tokens_entrada?: number
          tokens_salida?: number
          costo_api_usd?: number
          tipo_cambio?: number
          markup?: number
          costo_descontado_mxn?: number
          created_at?: string
        }
        Update: {
          id?: string
          cuenta_id?: string
          clinica_id?: string
          suscripcion_id?: string
          conversacion_id?: string | null
          modelo?: string
          tokens_entrada?: number
          tokens_salida?: number
          costo_api_usd?: number
          tipo_cambio?: number
          markup?: number
          costo_descontado_mxn?: number
          created_at?: string
        }
        Relationships: []
      }
      recargas_saldo: {
        Row: {
          id: string
          cuenta_id: string
          clinica_id: string
          suscripcion_id: string
          monto_mxn: number
          estado: string
          referencia_pago: string | null
          vigencia_fin: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cuenta_id: string
          clinica_id: string
          suscripcion_id: string
          monto_mxn: number
          estado?: string
          referencia_pago?: string | null
          vigencia_fin?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cuenta_id?: string
          clinica_id?: string
          suscripcion_id?: string
          monto_mxn?: number
          estado?: string
          referencia_pago?: string | null
          vigencia_fin?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      es_superadmin: { Args: never; Returns: boolean }
      usuario_en_clinica: { Args: { p_clinica_id: string }; Returns: boolean }
      registrar_consumo_ia: {
        Args: {
          p_clinica_id: string
          p_conversacion_id: string | null
          p_tokens_entrada: number
          p_tokens_salida: number
          p_modelo?: string
        }
        Returns: Json
      }
      ia_disponible: {
        Args: { p_clinica_id: string }
        Returns: Json
      }
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

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
