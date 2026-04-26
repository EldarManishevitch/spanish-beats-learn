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
      lyric_lines: {
        Row: {
          end_seconds: number
          english_translation: string | null
          hebrew_translation: string | null
          id: string
          is_chorus: boolean
          line_index: number
          song_id: string
          spanish_text: string
          start_seconds: number
        }
        Insert: {
          end_seconds: number
          english_translation?: string | null
          hebrew_translation?: string | null
          id?: string
          is_chorus?: boolean
          line_index: number
          song_id: string
          spanish_text: string
          start_seconds: number
        }
        Update: {
          end_seconds?: number
          english_translation?: string | null
          hebrew_translation?: string | null
          id?: string
          is_chorus?: boolean
          line_index?: number
          song_id?: string
          spanish_text?: string
          start_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "lyric_lines_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_flags: {
        Row: {
          id: string
          last_missed_at: string
          miss_count: number
          song_id: string
          user_id: string
          word: string
        }
        Insert: {
          id?: string
          last_missed_at?: string
          miss_count?: number
          song_id: string
          user_id: string
          word: string
        }
        Update: {
          id?: string
          last_missed_at?: string
          miss_count?: number
          song_id?: string
          user_id?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_flags_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          learning_level: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          learning_level?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          learning_level?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          completed_at: string
          id: string
          score: number
          song_id: string
          total: number
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          score: number
          song_id: string
          total: number
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          score?: number
          song_id?: string
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_vocab: {
        Row: {
          created_at: string
          hebrew: string
          id: string
          is_slang: boolean
          source_song_id: string | null
          user_id: string
          word: string
        }
        Insert: {
          created_at?: string
          hebrew: string
          id?: string
          is_slang?: boolean
          source_song_id?: string | null
          user_id: string
          word: string
        }
        Update: {
          created_at?: string
          hebrew?: string
          id?: string
          is_slang?: boolean
          source_song_id?: string | null
          user_id?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_vocab_source_song_id_fkey"
            columns: ["source_song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      slang_dictionary: {
        Row: {
          contextual_meaning: string
          created_at: string
          example_song_artist: string | null
          example_song_title: string | null
          example_usage: string | null
          id: string
          is_urban_slang: boolean
          lyrics_snippet: string | null
          term: string
        }
        Insert: {
          contextual_meaning: string
          created_at?: string
          example_song_artist?: string | null
          example_song_title?: string | null
          example_usage?: string | null
          id?: string
          is_urban_slang?: boolean
          lyrics_snippet?: string | null
          term: string
        }
        Update: {
          contextual_meaning?: string
          created_at?: string
          example_song_artist?: string | null
          example_song_title?: string | null
          example_usage?: string | null
          id?: string
          is_urban_slang?: boolean
          lyrics_snippet?: string | null
          term?: string
        }
        Relationships: []
      }
      songs: {
        Row: {
          album_art_url: string | null
          artist: string
          created_at: string
          difficulty: string | null
          genre: string
          id: string
          title: string
          youtube_id: string
        }
        Insert: {
          album_art_url?: string | null
          artist: string
          created_at?: string
          difficulty?: string | null
          genre: string
          id?: string
          title: string
          youtube_id: string
        }
        Update: {
          album_art_url?: string | null
          artist?: string
          created_at?: string
          difficulty?: string | null
          genre?: string
          id?: string
          title?: string
          youtube_id?: string
        }
        Relationships: []
      }
      translations_cache: {
        Row: {
          created_at: string
          hebrew: string
          id: string
          pronunciation_hint: string | null
          word: string
        }
        Insert: {
          created_at?: string
          hebrew: string
          id?: string
          pronunciation_hint?: string | null
          word: string
        }
        Update: {
          created_at?: string
          hebrew?: string
          id?: string
          pronunciation_hint?: string | null
          word?: string
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
