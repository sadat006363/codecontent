// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ✅ کلاینت سمت سرور با تایپ Database
export const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);