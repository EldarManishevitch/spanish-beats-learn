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
      daily_phrases_cache: {
        Row: {
          created_at: string
          date: string
          id: string
          payload: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          payload: Json
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
      lyric_lines: {
        Row: {
          end_seconds: number
          english_translation: string | null
          hebrew_translation: string | null
          id: string
          is_chorus: boolean
          line_index: number
          pronunciation: string | null
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
          pronunciation?: string | null
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
          pronunciation?: string | null
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
          cefr_level: string
          created_at: string
          current_streak: number
          display_name: string | null
          fav_genres: string[]
          id: string
          last_practice_date: string | null
          last_sent_variant_id: number | null
          learning_goal: string | null
          learning_level: string | null
          longest_streak: number
          mastered_count: number
          notifications_enabled: boolean
          notifications_time: string
          onboarding_completed: boolean
          total_xp: number
          unlocked_conversations: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          cefr_level?: string
          created_at?: string
          current_streak?: number
          display_name?: string | null
          fav_genres?: string[]
          id: string
          last_practice_date?: string | null
          last_sent_variant_id?: number | null
          learning_goal?: string | null
          learning_level?: string | null
          longest_streak?: number
          mastered_count?: number
          notifications_enabled?: boolean
          notifications_time?: string
          onboarding_completed?: boolean
          total_xp?: number
          unlocked_conversations?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          cefr_level?: string
          created_at?: string
          current_streak?: number
          display_name?: string | null
          fav_genres?: string[]
          id?: string
          last_practice_date?: string | null
          last_sent_variant_id?: number | null
          learning_goal?: string | null
          learning_level?: string | null
          longest_streak?: number
          mastered_count?: number
          notifications_enabled?: boolean
          notifications_time?: string
          onboarding_completed?: boolean
          total_xp?: number
          unlocked_conversations?: boolean
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
          english_equivalent: string | null
          example_song_artist: string | null
          example_song_title: string | null
          example_usage: string | null
          id: string
          is_urban_slang: boolean
          literal_meaning: string | null
          lyrics_snippet: string | null
          lyrics_snippet_translation: string | null
          term: string
        }
        Insert: {
          contextual_meaning: string
          created_at?: string
          english_equivalent?: string | null
          example_song_artist?: string | null
          example_song_title?: string | null
          example_usage?: string | null
          id?: string
          is_urban_slang?: boolean
          literal_meaning?: string | null
          lyrics_snippet?: string | null
          lyrics_snippet_translation?: string | null
          term: string
        }
        Update: {
          contextual_meaning?: string
          created_at?: string
          english_equivalent?: string | null
          example_song_artist?: string | null
          example_song_title?: string | null
          example_usage?: string | null
          id?: string
          is_urban_slang?: boolean
          literal_meaning?: string | null
          lyrics_snippet?: string | null
          lyrics_snippet_translation?: string | null
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
          is_catalog_default: boolean
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
          is_catalog_default?: boolean
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
          is_catalog_default?: boolean
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
      user_search_history: {
        Row: {
          id: string
          song_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          song_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          song_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_search_history_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_search_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_vocab_stats: {
        Row: {
          correct_count: number
          created_at: string
          fail_count: number
          id: string
          is_mastered: boolean
          last_reviewed: string
          user_id: string
          word: string
        }
        Insert: {
          correct_count?: number
          created_at?: string
          fail_count?: number
          id?: string
          is_mastered?: boolean
          last_reviewed?: string
          user_id: string
          word: string
        }
        Update: {
          correct_count?: number
          created_at?: string
          fail_count?: number
          id?: string
          is_mastered?: boolean
          last_reviewed?: string
          user_id?: string
          word?: string
        }
        Relationships: []
      }
      xp_ledger: {
        Row: {
          amount: number
          created_at: string
          event_type: string
          id: string
          ref_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          event_type: string
          id?: string
          ref_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          event_type?: string
          id?: string
          ref_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      recompute_cefr: { Args: { p_user_id: string }; Returns: Json }
      touch_streak: {
        Args: { p_tz?: string; p_user_id: string }
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
