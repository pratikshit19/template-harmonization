-- ============================================================================
-- SUPABASE / POSTGRESQL SCHEMA INITIALIZATION SCRIPT
-- For Contract Template Harmonization Tool (Harmonize by Sirion)
-- ============================================================================

-- Enable UUID extension if not already active
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────────────────────
-- 1. USER PROFILES TABLE (Linked to auth.users)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT
);

-- Enable Row-Level Security (RLS) on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read/edit their own profile
CREATE POLICY "Allow users to read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Allow users to update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. CORPORATE EMAIL VALIDATION TRIGGER (SirionLabs Corporate Only)
-- ────────────────────────────────────────────────────────────────────────────

-- Database trigger to validate that only sirionlabs.com corporate emails can sign up
CREATE OR REPLACE FUNCTION public.check_corporate_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Regex matches: firstname.lastname@sirionlabs.com
  IF NEW.email !~* '^[a-zA-Z0-9_\-]+.[a-zA-Z0-9_\-]+@sirionlabs\.com$' THEN
    RAISE EXCEPTION 'Registration restricted. Email must be in the format: firstname.lastname@sirionlabs.com';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind validation trigger to auth.users table
CREATE OR REPLACE TRIGGER enforce_corporate_email_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.check_corporate_email();

-- Trigger to automatically create a profile row upon signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  parts text[];
BEGIN
  -- Split email by '@' to extract name parts
  parts := regexp_split_to_array(split_part(NEW.email, '@', 1), '\.');
  
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    INITCAP(parts[1]),
    CASE WHEN array_length(parts, 1) > 1 THEN INITCAP(parts[2]) ELSE NULL END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind profile creation trigger to auth.users table
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ────────────────────────────────────────────────────────────────────────────
-- 3. AUDIT LOGS / GOVERNANCE TRAIL
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb NOT NULL
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow users to view and write audit logs
CREATE POLICY "Allow authenticated users to write logs" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow users to view their own logs" ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. CONTRACT TEMPLATES
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  file_size INT NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL -- pending, parsed, error
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to manage their templates" ON public.templates
  FOR ALL USING (auth.uid() = created_by);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. SECTIONS / CLAUSES
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.template_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.templates(id) ON DELETE CASCADE NOT NULL,
  clause_id TEXT NOT NULL, -- e.g. CL001, CL002
  header TEXT NOT NULL,
  content TEXT NOT NULL,
  comments JSONB DEFAULT '[]'::jsonb NOT NULL -- DOCX comments
);

ALTER TABLE public.template_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow template owner to manage sections" ON public.template_sections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.templates t
      WHERE t.id = template_sections.template_id AND t.created_by = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 6. HARMONIZATION RESULTS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.harmonized_clauses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  workspace_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  group_name TEXT NOT NULL,
  similarity_level TEXT NOT NULL, -- high, medium, low
  standard_clause TEXT NOT NULL,
  variations JSONB DEFAULT '[]'::jsonb NOT NULL,
  annotations JSONB DEFAULT '{}'::jsonb NOT NULL, -- Smart Tags, CLIs, Assembly logic
  rationale TEXT,
  is_approved BOOLEAN DEFAULT FALSE NOT NULL
);

ALTER TABLE public.harmonized_clauses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to manage harmonized clauses" ON public.harmonized_clauses
  FOR ALL USING (auth.uid() = workspace_user_id);

-- Update trigger function to maintain updated_at column
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_harmonized_clauses_modtime
  BEFORE UPDATE ON public.harmonized_clauses
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();
