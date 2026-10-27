-- Supabase SQL Editor에서 새 wx_tasks 표를 만들 때 한 번 실행합니다.
-- 기존 표를 삭제하거나 덮어쓰지 않습니다. 가상 데이터만 사용합니다.
begin;

create table public.wx_tasks (
  id bigint generated always as identity primary key,
  title text not null check (length(btrim(title)) > 0),
  region text not null check (region in ('세종', '대전', '태안', '보령')),
  kind text not null check (kind in ('야외', '고소', '실내')),
  owner text not null check (length(btrim(owner)) > 0)
);

alter table public.wx_tasks enable row level security;

-- 로그인 없는 교육용 앱: 공개 사용자는 조회와 지정 칸 추가만 가능합니다.
revoke all privileges on table public.wx_tasks from public, anon, authenticated;
revoke all privileges on sequence public.wx_tasks_id_seq from public, anon, authenticated;
grant usage on schema public to anon;
grant select on table public.wx_tasks to anon;
grant insert (title, region, kind, owner) on public.wx_tasks to anon;
grant usage on sequence public.wx_tasks_id_seq to anon;

create policy wx_tasks_public_read on public.wx_tasks
  for select to anon using (true);
create policy wx_tasks_public_insert on public.wx_tasks
  for insert to anon with check (true);

insert into public.wx_tasks (title, region, kind, owner) values
  ('다중이용시설 안전점검', '세종', '야외', '김안전'),
  ('시민 안전체험 행사 운영', '보령', '야외', '이행사'),
  ('옥상 태양광 설비 점검', '태안', '고소', '박설비'),
  ('하천 수위계 확인', '대전', '야외', '최현장'),
  ('청사 외벽 간판 보수', '세종', '고소', '정시설'),
  ('비상연락 훈련', '대전', '실내', '한상황');

commit;
