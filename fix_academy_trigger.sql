-- FIX: Handle New User Trigger to ensure Academy Creation and Default Ranks

create or replace function public.handle_new_user() 
returns trigger as $$
declare
  new_academy_id uuid;
  new_academy_code text;
  meta_academy_name text;
  meta_role text;
  meta_academy_id uuid;
  default_ranks jsonb;
begin
  -- 1. Extract metadata safely
  -- Try 'academy_name' (snake_case) and 'academyName' (camelCase) just in case
  meta_academy_name := coalesce(
    new.raw_user_meta_data->>'academy_name', 
    new.raw_user_meta_data->>'academyName'
  );
  
  meta_role := coalesce(new.raw_user_meta_data->>'role', 'student');
  meta_academy_id := (new.raw_user_meta_data->>'academy_id')::uuid;

  -- Define Default Ranks
  default_ranks := jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'name', 'Cinturón Blanco', 'color', 'white', 'order', 1, 'requiredAttendance', 0),
      jsonb_build_object('id', gen_random_uuid(), 'name', 'Cinturón de Color', 'color', 'yellow', 'order', 2, 'requiredAttendance', 24),
      jsonb_build_object('id', gen_random_uuid(), 'name', 'Cinturón Negro', 'color', 'black', 'order', 3, 'requiredAttendance', 100)
  );

  -- 2. If role is MASTER and Name is provided, create Academy first
  -- Use strict check for 'master'
  if meta_role = 'master' then
      -- Fallback if name is somehow missing but role is master (should not happen in app)
      if meta_academy_name is null or meta_academy_name = '' then
         meta_academy_name := 'Academia Sin Nombre';
      end if;

      new_academy_code := 'ACAD-' || floor(1000 + random() * 9000)::text;
      
      insert into public.academies (name, code, owner_id, payment_settings, modules, ranks)
      values (
        meta_academy_name, 
        new_academy_code, 
        new.id, 
        '{}'::jsonb, 
        '{"library": true, "payments": true, "attendance": true}'::jsonb, 
        default_ranks -- FIX: Insert default ranks
      )
      returning id into new_academy_id;
      
      -- Override the academy_id to be this new one
      meta_academy_id := new_academy_id;
  end if;

  -- 3. Create Profile
  insert into public.profiles (id, email, name, role, academy_id)
  values (
    new.id, 
    new.email, 
    coalesce(new.raw_user_meta_data->>'name', 'Usuario Nuevo'),
    meta_role,
    meta_academy_id
  );

  return new;
exception
  when others then
    -- Log error (visible in Supabase logs) but try to allow user creation to avoid hard block?
    -- No, strictly re-raise to debug why it fails
    raise exception 'Error handling new user: %', SQLERRM;
end;
$$ language plpgsql security definer;

-- Re-apply trigger just to be safe (idempotent)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
