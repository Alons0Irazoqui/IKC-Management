-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. ACADEMIES (Tenants)
create table public.academies (
    id uuid primary key default uuid_generate_v4(),
    code text unique not null,
    name text not null,
    owner_id uuid, -- Link to the Master user auth.uid
    payment_settings jsonb default '{}'::jsonb, -- Late fee, tuition amount, bank details
    modules jsonb default '{"library": true, "payments": true, "attendance": true}'::jsonb,
    ranks jsonb default '[]'::jsonb, -- Array of Rank objects
    created_at timestamp with time zone default now()
);

-- 2. PROFILES (Extends auth.users)
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text,
    name text,
    role text check (role in ('master', 'student', 'admin')),
    academy_id uuid references public.academies(id),
    avatar_url text,
    student_id uuid, -- Helper to link to student record if role is student
    created_at timestamp with time zone default now()
);

-- 3. STUDENTS
create table public.students (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id), -- Optional, if student has login
    academy_id uuid references public.academies(id) not null,
    name text not null,
    email text,
    cell_phone text,
    age int,
    birth_date date,
    weight numeric,
    height numeric,
    blood_type text,
    avatar_url text,
    
    -- JSONB for complex nested objects
    guardian jsonb default '{}'::jsonb, 
    
    -- Academic Status
    rank_id text, -- ID from the academy.ranks JSON array
    rank_current text, -- Denormalized name
    stripes int default 0,
    status text default 'active', -- active, inactive, debtor
    program text,
    
    -- Metrics (Can be computed, but storing current for cache)
    balance numeric default 0,
    join_date date default CURRENT_DATE,
    
    created_at timestamp with time zone default now()
);

-- 4. CLASSES (Categories/Definitions)
create table public.classes (
    id uuid primary key default uuid_generate_v4(),
    academy_id uuid references public.academies(id) not null,
    name text not null,
    schedule_summary text, -- "Mon/Wed 7pm"
    days text[], -- ['Monday', 'Wednesday']
    start_time time,
    end_time time,
    instructor text,
    student_ids text[], -- Array of Student IDs for enrollment
    created_at timestamp with time zone default now()
);

-- 5. CLASS SESSIONS (Attendance Logs)
create table public.class_sessions (
    id uuid primary key default uuid_generate_v4(),
    academy_id uuid references public.academies(id) not null,
    class_id uuid references public.classes(id),
    date date not null,
    total_students int default 0,
    instructor text,
    created_at timestamp with time zone default now()
);

-- 6. ATTENDANCE RECORDS (Junction table for Student <-> Session)
create table public.attendance_records (
    id uuid primary key default uuid_generate_v4(),
    academy_id uuid references public.academies(id) not null,
    session_id uuid references public.class_sessions(id) on delete cascade,
    student_id uuid references public.students(id) on delete cascade,
    status text check (status in ('present', 'late', 'excused', 'absent')),
    timestamp timestamp with time zone default now()
);

-- 7. EVENTS (Calendar)
create table public.events (
    id uuid primary key default uuid_generate_v4(),
    academy_id uuid references public.academies(id) not null,
    title text not null,
    start_time timestamp with time zone not null,
    end_time timestamp with time zone not null,
    description text,
    instructor text,
    color text,
    type text, -- class, exam, tournament
    status text default 'active',
    registrants text[], -- Array of Student IDs (Simple array for now)
    created_at timestamp with time zone default now()
);

-- 8. LIBRARY
create table public.library (
    id uuid primary key default uuid_generate_v4(),
    academy_id uuid references public.academies(id) not null,
    title text not null,
    description text,
    thumbnail_url text,
    video_url text,
    duration text,
    category text,
    level text,
    completed_by text[], -- Array of Student IDs
    created_at timestamp with time zone default now()
);

-- 9. PAYMENTS (Tuition Records)
create table public.tuition_records (
    id uuid primary key default uuid_generate_v4(),
    academy_id uuid references public.academies(id) not null,
    student_id uuid references public.students(id) not null,
    
    concept text not null,
    month text, -- "2024-01"
    
    amount numeric not null,
    original_amount numeric,
    penalty_amount numeric default 0,
    
    due_date date not null,
    payment_date timestamp with time zone,
    
    status text check (status in ('pending', 'overdue', 'in_review', 'paid', 'charged', 'partial')),
    method text,
    proof_url text,
    
    category text,
    description text,
    can_be_paid_in_parts boolean default false,
    
    created_at timestamp with time zone default now()
);

-- 10. MESSAGES
create table public.messages (
    id uuid primary key default uuid_generate_v4(),
    academy_id uuid references public.academies(id) not null,
    sender_id uuid references public.profiles(id),
    sender_name text,
    recipient_id text, -- 'all' or uuid
    recipient_name text,
    subject text,
    content text,
    date timestamp with time zone default now(),
    read boolean default false,
    type text, -- announcement, personal
    created_at timestamp with time zone default now()
);

-- --- SECURITY (RLS) ---

alter table public.academies enable row level security;
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.classes enable row level security;
alter table public.class_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.events enable row level security;
alter table public.library enable row level security;
alter table public.tuition_records enable row level security;
alter table public.messages enable row level security;

-- ... Helper function ...
create or replace function get_my_academy_id()
returns uuid as $$
  select academy_id from public.profiles where id = auth.uid();
$$ language sql security definer;

-- ACADEMIES: Masters can read their own academy.
-- Note: On registration, the user might not have a profile yet, so we allow creation if authenticated.
create policy "Masters can view their own academy"
on public.academies for select
using (id = get_my_academy_id());

create policy "Masters can update their own academy"
on public.academies for update
using (id = get_my_academy_id());

-- PROFILES: Users can read/update their own profile.
create policy "Users can view own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id);

create policy "Masters can view profiles in their academy"
on public.profiles for select
using (academy_id = get_my_academy_id());

-- GENERIC POLICY TEMPLATE for Data Tables (Students, Classes, etc.)
-- "Users can only access data belonging to their academy"

-- STUDENTS
-- Policy: Students can view their own record (matches auth.uid to user_id column)
create policy "Students can view own data"
on public.students for select
using (auth.uid() = user_id);

-- Policy: Masters can view/edit all students in their academy
create policy "Masters view academy students"
on public.students for all
using (
  academy_id IN (
    select academy_id from public.profiles 
    where id = auth.uid() and role = 'master'
  )
);

-- CLASSES
create policy "Academy isolation for classes"
on public.classes for all
using (academy_id = get_my_academy_id());

-- CLASS SESSIONS
create policy "Academy isolation for sessions"
on public.class_sessions for all
using (academy_id = get_my_academy_id());

-- ATTENDANCE
create policy "Academy isolation for attendance"
on public.attendance_records for all
using (academy_id = get_my_academy_id());

-- EVENTS
create policy "Academy isolation for events"
on public.events for all
using (academy_id = get_my_academy_id());

-- LIBRARY
create policy "Academy isolation for library"
on public.library for all
using (academy_id = get_my_academy_id());

-- PAYMENTS
-- Master: Ver todos los pagos de su academia
create policy "Masters view academy payments"
on public.tuition_records for all
using (
  academy_id IN (
    select academy_id from public.profiles 
    where id = auth.uid() and role = 'master'
  )
);

-- Estudiante: Ver SOLO sus propios pagos
create policy "Students view own payments"
on public.tuition_records for select
using (
  student_id IN (
    select id from public.students 
    where user_id = auth.uid()
  )
);

-- --- TRIGGERS ---

-- Auto-create Profile on Signup
-- Note: This trigger assumes metadata is passed during signUp or handled via a function.
-- Ideally, we call a function to register that creates both. But for basic Auth:
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  declare
    new_academy_id uuid;
    new_academy_code text;
    meta_academy_name text;
    meta_role text;
    meta_academy_id uuid;
  begin
    -- Extract metadata safely
    meta_academy_name := new.raw_user_meta_data->>'academy_name';
    meta_role := coalesce(new.raw_user_meta_data->>'role', 'student');
    meta_academy_id := (new.raw_user_meta_data->>'academy_id')::uuid;

    -- 1. If role is MASTER and Name is provided, create Academy first
    if meta_role = 'master' and meta_academy_name is not null then
        new_academy_code := 'ACAD-' || floor(1000 + random() * 9000)::text;
        
        insert into public.academies (name, code, owner_id, payment_settings, modules, ranks)
        values (meta_academy_name, new_academy_code, new.id, '{}'::jsonb, '{"library": true, "payments": true, "attendance": true}'::jsonb, '[]'::jsonb)
        returning id into new_academy_id;
        
        -- Override the academy_id to be this new one
        meta_academy_id := new_academy_id;
    end if;

    -- 2. Create Profile
    insert into public.profiles (id, email, name, role, academy_id)
    values (
      new.id, 
      new.email, 
      new.raw_user_meta_data->>'name',
      meta_role,
      meta_academy_id
    );

    return new;
  end;
end;
$$ language plpgsql security definer;

-- Note: The trigger assumes raw_user_meta_data has academy_id. 
-- In the app logic, we must ensure we pass this data.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- insert into storage.buckets (id, name, public) values ('pulse-assets', 'pulse-assets', true);
-- create policy "Authenticated users can upload" on storage.objects for insert with check (auth.role() = 'authenticated');
-- create policy "Public Access" on storage.objects for select using ( bucket_id = 'pulse-assets' );

-- --- SECURITY HARDENING (RPC & Strict Policies) ---

-- 11. RPC: Create Academy (Atomic)
create or replace function public.create_academy(
  academy_name text
) returns json as $$
declare
  new_academy_id uuid;
  new_academy_code text;
  result json;
begin
  -- Generate unique code
  new_academy_code := 'ACAD-' || floor(1000 + random() * 9000)::text;
  
  -- Insert Academy
  insert into public.academies (name, code, owner_id, payment_settings, modules, ranks)
  values (academy_name, new_academy_code, auth.uid(), '{}'::jsonb, '{"library": true, "payments": true, "attendance": true}'::jsonb, '[]'::jsonb)
  returning id into new_academy_id;
  
  -- Update Profile of the creator
  -- SECURITY DEFINER allows this function to update the profile even if restricted by RLS/Grants for normal users
  update public.profiles
  set academy_id = new_academy_id,
      role = 'master'
  where id = auth.uid();
  
  select json_build_object('id', new_academy_id, 'code', new_academy_code, 'name', academy_name) into result;
  return result;
end;
$$ language plpgsql security definer;

-- 12. Strict Column-Level Permissions
-- Revoke generic update to prevent upgrading own role/academy
revoke update on public.profiles from authenticated;
revoke update on public.profiles from anon;
-- Grant specific column updates
grant update (name, email, avatar_url) on public.profiles to authenticated;

-- Revoke INSERT on Academies (must use RPC)
revoke insert on public.academies from authenticated;
revoke insert on public.academies from anon;

-- Fix RLS for Academies Update (Only Settings)
-- Existing policy "Masters can update their own academy" allows updating all columns. 
-- We should ideally restrict changing owner_id or code, but for now strict RLS `using (id = get_my_academy_id())` keeps it to their own row.
-- No malicious handover possible unless they give it away. Accepted risk or use Column Grant.
revoke update on public.academies from authenticated;
grant update (name, payment_settings, modules, ranks) on public.academies to authenticated;

