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
      snippets: {
        Row: {
          architectural_observations: Json | null
          avatar_url: string | null
          bugs_and_risky_cases: Json | null
          card_image_url: string | null
          card_title: string
          code: string | null
          code_walkthrough: Json | null
          complexity: Json | null
          created_at: string | null
          debug_analysis: string
          edge_cases: Json | null
          execution_overview: Json | null
          final_verdict_approved: boolean | null
          final_verdict_next_steps: string | null
          final_verdict_summary: string | null
          findings: Json | null
          generated_prompt: string | null
          github_username: string | null
          id: string
          improved_code: string | null
          is_public: boolean | null
          key_concept: string
          language: string
          limitations: string[] | null
          line_explanations: Json | null
          linkedin_post: string
          optimization: string
          performance_analysis: Json | null
          production_readiness: Json | null
          raw_code: string
          recommended_actions: Json | null
          recommended_improvements: Json | null
          scorecard: Json | null
          scorecard_new: Json | null
          security_analysis: Json | null
          slug: string
          suggested_tests: Json | null
          suggested_tests_new: Json | null
          user_id: string | null
          username: string | null
          verdict: Json | null
          what_this_code_does: string
          what_works_well: Json | null
        }
        Insert: {
          architectural_observations?: Json | null
          avatar_url?: string | null
          bugs_and_risky_cases?: Json | null
          card_image_url?: string | null
          card_title: string
          code?: string | null
          code_walkthrough?: Json | null
          complexity?: Json | null
          created_at?: string | null
          debug_analysis: string
          edge_cases?: Json | null
          execution_overview?: Json | null
          final_verdict_approved?: boolean | null
          final_verdict_next_steps?: string | null
          final_verdict_summary?: string | null
          findings?: Json | null
          generated_prompt?: string | null
          github_username?: string | null
          id?: string
          improved_code?: string | null
          is_public?: boolean | null
          key_concept: string
          language: string
          limitations?: string[] | null
          line_explanations?: Json | null
          linkedin_post: string
          optimization: string
          performance_analysis?: Json | null
          production_readiness?: Json | null
          raw_code: string
          recommended_actions?: Json | null
          recommended_improvements?: Json | null
          scorecard?: Json | null
          scorecard_new?: Json | null
          security_analysis?: Json | null
          slug: string
          suggested_tests?: Json | null
          suggested_tests_new?: Json | null
          user_id?: string | null
          username?: string | null
          verdict?: Json | null
          what_this_code_does: string
          what_works_well?: Json | null
        }
        Update: {
          architectural_observations?: Json | null
          avatar_url?: string | null
          bugs_and_risky_cases?: Json | null
          card_image_url?: string | null
          card_title?: string
          code?: string | null
          code_walkthrough?: Json | null
          complexity?: Json | null
          created_at?: string | null
          debug_analysis?: string
          edge_cases?: Json | null
          execution_overview?: Json | null
          final_verdict_approved?: boolean | null
          final_verdict_next_steps?: string | null
          final_verdict_summary?: string | null
          findings?: Json | null
          generated_prompt?: string | null
          github_username?: string | null
          id?: string
          improved_code?: string | null
          is_public?: boolean | null
          key_concept?: string
          language?: string
          limitations?: string[] | null
          line_explanations?: Json | null
          linkedin_post?: string
          optimization?: string
          performance_analysis?: Json | null
          production_readiness?: Json | null
          raw_code?: string
          recommended_actions?: Json | null
          recommended_improvements?: Json | null
          scorecard?: Json | null
          scorecard_new?: Json | null
          security_analysis?: Json | null
          slug?: string
          suggested_tests?: Json | null
          suggested_tests_new?: Json | null
          user_id?: string | null
          username?: string | null
          verdict?: Json | null
          what_this_code_does?: string
          what_works_well?: Json | null
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
