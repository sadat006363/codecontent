// types/supabase.ts
export type Database = {
  public: {
    Tables: {
      snippets: {
        Row: {
          id: string;
          slug: string;
          raw_code: string;
          language: string;
          card_title: string;
          key_concept: string;
          what_this_code_does: string;
          debug_analysis: string;
          optimization: string;
          linkedin_post: string;
          is_public: boolean;
          created_at: string;
          username: string | null;
          github_username: string | null;
          avatar_url: string | null;
          card_image_url: string | null;
          // ... سایر ستون‌ها (Legacy + New)
          code_walkthrough: any | null;
          what_works_well: any | null;
          bugs_and_risky_cases: any | null;
          edge_cases: any | null;
          performance_analysis: any | null;
          security_analysis: any | null;
          production_readiness: any | null;
          recommended_improvements: any | null;
          improved_code: string | null;
          suggested_tests: any | null;
          scorecard: any | null;
          final_verdict_summary: string | null;
          final_verdict_approved: boolean | null;
          final_verdict_next_steps: string | null;
          line_explanations: any | null;
          generated_prompt: string | null;
          findings: any | null;
          execution_overview: any | null;
          architectural_observations: any | null;
          recommended_actions: any | null;
          suggested_tests_new: any | null;
          complexity: any | null;
          scorecard_new: any | null;
          verdict: any | null;
          limitations: string[] | null;
        };
        Insert: {
          id?: string;
          slug: string;
          raw_code: string;
          language: string;
          card_title?: string;
          key_concept?: string;
          what_this_code_does?: string;
          debug_analysis?: string;
          optimization?: string;
          linkedin_post?: string;
          is_public?: boolean;
          created_at?: string;
          username?: string | null;
          github_username?: string | null;
          avatar_url?: string | null;
          card_image_url?: string | null;
          // ... سایر فیلدهای insert (همانند Row با optional بودن برخی)
          code_walkthrough?: any | null;
          what_works_well?: any | null;
          bugs_and_risky_cases?: any | null;
          edge_cases?: any | null;
          performance_analysis?: any | null;
          security_analysis?: any | null;
          production_readiness?: any | null;
          recommended_improvements?: any | null;
          improved_code?: string | null;
          suggested_tests?: any | null;
          scorecard?: any | null;
          final_verdict_summary?: string | null;
          final_verdict_approved?: boolean | null;
          final_verdict_next_steps?: string | null;
          line_explanations?: any | null;
          generated_prompt?: string | null;
          findings?: any | null;
          execution_overview?: any | null;
          architectural_observations?: any | null;
          recommended_actions?: any | null;
          suggested_tests_new?: any | null;
          complexity?: any | null;
          scorecard_new?: any | null;
          verdict?: any | null;
          limitations?: string[] | null;
        };
        Update: {
          // مشابه Insert اما همه فیلدها optional
          id?: string;
          slug?: string;
          raw_code?: string;
          language?: string;
          card_title?: string;
          key_concept?: string;
          what_this_code_does?: string;
          debug_analysis?: string;
          optimization?: string;
          linkedin_post?: string;
          is_public?: boolean;
          created_at?: string;
          username?: string | null;
          github_username?: string | null;
          avatar_url?: string | null;
          card_image_url?: string | null;
          // ... بقیه فیلدها به همین ترتیب
        };
      };
    };
  };
};