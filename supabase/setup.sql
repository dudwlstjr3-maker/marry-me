-- marry-me: 카카오 로그인으로 둘이 함께 쓰기
-- Supabase 대시보드 → SQL Editor에 이 파일 전체를 붙여 넣고 Run 한 번. 여러 번 실행해도 안전해요.
--
-- 구조
--   plans         결혼 준비 기록 하나(앱의 저장 데이터 전체를 data에 그대로)
--   plan_members  누가 그 기록을 쓰는지(신랑·신부 최대 2명)
--   plan_invites  초대 링크 코드(7일, 한 번만)
-- 표를 직접 읽고 쓰는 것은 막고(RLS), 아래 함수로만 바꿔요. 함수는 로그인한 사람(auth.uid())이 그 기록의 멤버인지 먼저 확인해요.

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_members (
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);

create table if not exists public.plan_invites (
  code text primary key,
  plan_id uuid not null references public.plans(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz
);

alter table public.plans enable row level security;
alter table public.plan_members enable row level security;
alter table public.plan_invites enable row level security;

-- 멤버인지 확인(정책 안에서 plan_members를 다시 읽어 생기는 무한 반복을 피하려고 security definer)
create or replace function public.is_member(p uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.plan_members where plan_id = p and user_id = auth.uid());
$$;

drop policy if exists plans_select on public.plans;
create policy plans_select on public.plans for select to authenticated using (public.is_member(id));

drop policy if exists members_select on public.plan_members;
create policy members_select on public.plan_members for select to authenticated using (public.is_member(plan_id));
-- plan_invites에는 정책이 없어요: 표로는 아무도 못 읽고, 함수로만 써요.

-- 앱의 mergeInto와 같은 규칙: 둘 다 객체면 안쪽까지 합치고, 아니면 새 값으로 바꿔요.
create or replace function public.jsonb_deep_merge(a jsonb, b jsonb) returns jsonb
language plpgsql immutable as $$
declare k text; v jsonb; r jsonb;
begin
  if jsonb_typeof(a) is distinct from 'object' or jsonb_typeof(b) is distinct from 'object' then return b; end if;
  r := a;
  for k, v in select * from jsonb_each(b) loop
    if jsonb_typeof(r -> k) = 'object' and jsonb_typeof(v) = 'object' then
      r := r || jsonb_build_object(k, public.jsonb_deep_merge(r -> k, v));
    else
      r := r || jsonb_build_object(k, v);
    end if;
  end loop;
  return r;
end $$;

-- 바뀐 부분만 합쳐 저장(둘이 동시에 다른 칸을 고쳐도 서로 지우지 않아요)
create or replace function public.merge_plan(p_id uuid, p_patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_member(p_id) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  update public.plans set data = public.jsonb_deep_merge(data, p_patch), updated_at = now() where id = p_id;
end $$;

-- 내가 쓰는 기록(가장 최근에 들어간 것)
create or replace function public.my_plan() returns uuid
language sql security definer set search_path = public stable as $$
  select plan_id from public.plan_members where user_id = auth.uid() order by joined_at desc limit 1;
$$;

-- 처음 로그인: 이 기기의 기록으로 새 기록을 만들어요(이미 있으면 그걸 돌려줘요)
create or replace function public.create_plan(p_data jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if auth.uid() is null then raise exception 'login required' using errcode = '42501'; end if;
  select public.my_plan() into pid;
  if pid is not null then return pid; end if;
  insert into public.plans (data) values (coalesce(p_data, '{}'::jsonb)) returning id into pid;
  insert into public.plan_members (plan_id, user_id, role) values (pid, auth.uid(), 'owner');
  return pid;
end $$;

-- 초대 코드 만들기(멤버만)
create or replace function public.create_invite(p_plan uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if auth.uid() is null or not public.is_member(p_plan) then raise exception 'not a member' using errcode = '42501'; end if;
  c := substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
  insert into public.plan_invites (code, plan_id, created_by) values (c, p_plan, auth.uid());
  return c;
end $$;

-- 초대 받기: 코드가 살아 있고, 아직 두 사람이 아니면 멤버로 넣어요.
-- 받은 사람이 혼자 쓰던 다른 기록에서는 빠져요(그 기록 자체는 지우지 않아요).
create or replace function public.join_plan(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv public.plan_invites; n int;
begin
  if auth.uid() is null then raise exception 'login required' using errcode = '42501'; end if;
  select * into inv from public.plan_invites where code = p_code for update;
  if not found or inv.expires_at < now() then raise exception 'invalid invite'; end if;
  if public.is_member(inv.plan_id) then return inv.plan_id; end if;
  if inv.used_by is not null and inv.used_by <> auth.uid() then raise exception 'invalid invite'; end if;
  select count(*) into n from public.plan_members where plan_id = inv.plan_id;
  if n >= 2 then raise exception 'full'; end if;
  delete from public.plan_members where user_id = auth.uid();
  insert into public.plan_members (plan_id, user_id) values (inv.plan_id, auth.uid());
  update public.plan_invites set used_by = auth.uid(), used_at = now() where code = p_code;
  return inv.plan_id;
end $$;

revoke all on function public.merge_plan(uuid, jsonb), public.my_plan(), public.create_plan(jsonb), public.create_invite(uuid), public.join_plan(text), public.is_member(uuid) from public, anon;
grant execute on function public.merge_plan(uuid, jsonb), public.my_plan(), public.create_plan(jsonb), public.create_invite(uuid), public.join_plan(text), public.is_member(uuid) to authenticated;

-- 상대가 고친 내용이 바로 보이게(실시간)
do $$ begin
  alter publication supabase_realtime add table public.plans;
exception when duplicate_object then null; end $$;
