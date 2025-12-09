import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mwhugjpcikwnrjswdexq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13aHVnanBjaWt3bnJqc3dkZXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMDgwMzQsImV4cCI6MjA4MDg4NDAzNH0.NDFXXY767PaMOEEiOuMguZ6mTPnlFsuolfM46j7hcwc';

export const supabase = createClient(supabaseUrl, supabaseKey);