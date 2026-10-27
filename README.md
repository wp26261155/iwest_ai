# 현장 일정 날씨판

오늘 현장 일정과 지역별 날씨를 한 화면에서 보고, 날씨 때문에 주의 · 중지를 검토할 일정을 표시합니다. (교육용 가상 데이터)

## 여는 법
- 아래 Supabase 설정을 마친 뒤 `index.html` 더블클릭 (인터넷 연결 필요)
- 인터넷 : (배포 후 Vercel 주소를 여기에 적기)

## Supabase 설정 (F-06)
1. Supabase 프로젝트의 SQL Editor에서 `setup.sql` 전체를 한 번 실행합니다. `public.wx_tasks` 표, 지역/구분 제약, 공개 조회/추가 정책, 가상 일정 6건이 만들어집니다. 기존 `wx_tasks` 표가 있으면 생성이 중단되며 기존 데이터는 변경하지 않습니다.
2. 프로젝트의 Connect 또는 API Keys 화면에서 Project URL과 publishable 공개용 키를 확인합니다. 기존 프로젝트의 anon 공개용 키도 사용할 수 있습니다.
3. `config.js`의 두 빈 문자열에 주소와 공개용 키를 각각 입력합니다. 키를 채팅에 보내지 않아도 됩니다. 비밀 키, secret 키, service_role 키는 넣지 않습니다.
4. `index.html`을 열거나 배포 주소를 새로고침합니다. 설정이 비어 있거나 SDK/DB 연결에 실패하면 화면 아래에 안내가 나옵니다.

로그인 없는 교육용 표이므로 공개 키를 가진 누구나 가상 일정을 조회·추가할 수 있습니다. RLS와 DB 권한은 조회·추가만 허용하며 수정·삭제는 허용하지 않습니다. `setup.sql`은 앱이 실행하지 않으며 사용자가 SQL Editor에서 실행합니다.

일정은 Supabase에서 읽고 저장합니다. 다른 화면에서 추가한 일정은 새로고침하면 보입니다. 예전 `data/tasks.json`과 브라우저 `wx_added`의 일정은 자동 이관하지 않습니다. 브라우저에 남은 기존 데이터도 삭제하지 않습니다.

## 확인 방법
- T-01: 설정 후 첫 실행에서 가상 일정 6건을 확인합니다.
- T-02: 가상 일정을 추가하고 새로고침 또는 다른 브라우저에서 같은 목록을 확인합니다.
- T-03: 날씨와 판단 값이 보이는지 확인합니다. 날씨 API가 실패해도 일정 목록은 유지됩니다.
- T-04: 주소 끝에 `?test=wind`를 붙이고 날씨 수신 후 고소 일정 2건이 ‘중지 검토 (강풍)’인지 확인합니다.
- T-05: ‘오늘 판단 md로 저장’을 눌러 현재 표와 판단 기준이 저장되는지 확인합니다.
- T-06: SQL Editor에서 아래 문장을 각각 실행하면 지역/구분 `CHECK` 제약으로 거절됩니다. 두 문장 모두 가상 데이터이며 저장되지 않습니다.

```sql
insert into public.wx_tasks (title, region, kind, owner)
values ('가상 제약 시험', '서울', '야외', '가상담당');
```

```sql
insert into public.wx_tasks (title, region, kind, owner)
values ('가상 제약 시험', '세종', '잠수', '가상담당');
```

## 파일
| 파일 | 역할 |
|---|---|
| index.html | 화면 구조 |
| style.css | 디자인 |
| logic.js | 판단 규칙 |
| app.js | 화면 동작 |
| config.js | Supabase 주소·공개용 키 (두 줄) |
| setup.sql | 표·제약·RLS 정책·가상 일정 초기화 |
| PRD.md | 무엇을 · 왜 만드는지 |
| CLAUDE.md | AI가 지킬 작업 규칙 |
| AGENTS.md | Codex가 지킬 작업 규칙 |
| .gitignore | GitHub에 올리지 않을 파일 목록 |
