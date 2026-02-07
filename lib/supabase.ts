/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase URL or Key is missing. Check your .env setup.');
}

export const supabase = createClient<Database>(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder-key'
);
