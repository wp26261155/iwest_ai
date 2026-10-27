// app.js – 화면 동작 (목록 그리기, 일정 추가)

let tasks = [];
let tasksLoading = true;
let taskSaving = false;
let taskDatabase = null;
let weatherByRegion = {};

function connectTaskDatabase() {
  if (taskDatabase) return '';
  if (typeof SUPABASE_URL !== 'string' || !SUPABASE_URL.trim() ||
      typeof SUPABASE_PUBLIC_KEY !== 'string' || !SUPABASE_PUBLIC_KEY.trim()) {
    return 'config.js에 Supabase 주소와 공개용 키를 입력해 주세요.';
  }
  try {
    if (new URL(SUPABASE_URL).protocol !== 'https:') throw new Error();
  } catch (error) {
    return 'config.js의 Supabase 주소를 https:// 형식으로 확인해 주세요.';
  }
  let publicKey = SUPABASE_PUBLIC_KEY.startsWith('sb_publishable_');
  if (!publicKey) {
    try {
      const payload = SUPABASE_PUBLIC_KEY.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      publicKey = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))).role === 'anon';
    } catch (error) {
      publicKey = false;
    }
  }
  if (!publicKey) return 'config.js에는 publishable 또는 anon 공개용 키만 입력해 주세요.';
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    return 'Supabase 연결 스크립트를 불러오지 못했습니다. 인터넷 연결 후 새로고침해 주세요.';
  }
  try {
    taskDatabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return '';
  } catch (error) {
    return 'Supabase 연결을 준비하지 못했습니다. config.js 설정을 확인해 주세요.';
  }
}

async function loadWeather() {
  const status = document.getElementById('weatherStatus');
  const testWind = new URLSearchParams(window.location.search).get('test') === 'wind';
  const testNotice = testWind ? '시험 모드: 풍속 12m/s 적용 · ' : '';
  const regions = Object.keys(REGIONS);
  const failed = new Set();
  status.textContent = testNotice + '오늘 날씨를 불러오는 중입니다.';

  await Promise.all(regions.map(async (region) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(buildWeatherUrl(region), { signal: controller.signal });
      if (!response.ok) throw new Error('날씨 요청 실패');
      const weather = parseWeather(await response.json(), testWind);
      if (!weather) throw new Error('날씨 값 누락');
      weatherByRegion[region] = weather;
      renderTasks();
    } catch (error) {
      failed.add(region);
    } finally {
      clearTimeout(timeout);
    }
  }));

  const count = Object.keys(weatherByRegion).length;
  const failureNotice = failed.size
    ? ' · 불러오기 실패: ' + regions.filter(region => failed.has(region)).join(', ') + ' (새로고침해 다시 시도해 주세요.)'
    : '';
  status.textContent = testNotice + '오늘 날씨 ' + count + '/4개 지역 확인' + failureNotice;
}

function isTaskList(value) {
  return Array.isArray(value) && value.every(task => task &&
    ['title', 'region', 'kind', 'owner'].every(key => typeof task[key] === 'string'));
}

async function loadTasks() {
  const message = document.getElementById('msgBox');
  const button = document.querySelector('#taskForm button');
  tasksLoading = true;
  button.disabled = true;
  const setupError = connectTaskDatabase();
  if (setupError) {
    message.textContent = setupError;
    tasksLoading = false;
    return;
  }
  message.textContent = '일정을 불러오는 중입니다.';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const { data, error } = await taskDatabase.from('wx_tasks')
      .select('id,title,region,kind,owner')
      .order('id', { ascending: true })
      .abortSignal(controller.signal);
    if (error || !isTaskList(data)) throw new Error('일정 조회 실패');
    tasks = data;
    renderTasks();
    message.textContent = '';
  } catch (error) {
    message.textContent = '일정을 불러오지 못했습니다. 연결 설정과 setup.sql 실행 여부를 확인하고 새로고침해 주세요.';
  } finally {
    clearTimeout(timeout);
    tasksLoading = false;
    button.disabled = false;
  }
}

function weatherText(w) {
  return w ? w.tempMax + '℃ · ' + w.windMax + 'm/s · ' + w.rainProb + '%' : '-';
}

function renderTasks() {
  const body = document.getElementById('taskList');
  body.innerHTML = '';
  for (const t of tasks) {
    const w = weatherByRegion[t.region];
    const r = judge(t.kind, w);
    const tr = document.createElement('tr');
    for (const v of [t.title, t.region, t.kind, t.owner, weatherText(w)]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    const td = document.createElement('td');
    td.textContent = r.text;
    td.className = r.level;
    tr.appendChild(td);
    body.appendChild(tr);
  }
}

async function addTask(e) {
  e.preventDefault();
  if (tasksLoading || taskSaving || !taskDatabase) return;
  const t = {
    title: document.getElementById('titleInput').value.trim(),
    region: document.getElementById('regionInput').value,
    kind: document.getElementById('kindInput').value,
    owner: document.getElementById('ownerInput').value.trim(),
  };
  if (!t.title || !t.owner) return;
  const message = document.getElementById('msgBox');
  const button = document.querySelector('#taskForm button');
  taskSaving = true;
  button.disabled = true;
  message.textContent = '일정을 저장하는 중입니다.';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const { data, error } = await taskDatabase.from('wx_tasks')
      .insert(t)
      .select('id,title,region,kind,owner')
      .single()
      .abortSignal(controller.signal);
    if (error || !isTaskList([data])) throw new Error('일정 저장 실패');
    tasks.push(data);
    e.target.reset();
    renderTasks();
    message.textContent = '일정을 저장했습니다.';
  } catch (error) {
    message.textContent = '저장 결과를 확인하지 못했습니다. 새로고침해 목록을 확인하고 연결 설정과 입력값을 확인해 주세요.';
  } finally {
    clearTimeout(timeout);
    taskSaving = false;
    button.disabled = false;
  }
}

function saveJudgmentMarkdown() {
  const table = document.getElementById('taskList').closest('table');
  const headers = Array.from(table.querySelectorAll('thead th'), cell => cell.textContent);
  const rows = Array.from(table.querySelectorAll('tbody tr'), row =>
    Array.from(row.cells, cell => cell.textContent));
  const markdown = makeJudgmentMarkdown(headers, rows);
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const datePart = type => parts.find(part => part.type === type).value;
  const date = datePart('year') + '-' + datePart('month') + '-' + datePart('day');
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = '현장일정_판단_' + date + '.md';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.getElementById('saveMarkdownButton').addEventListener('click', saveJudgmentMarkdown);
document.getElementById('taskForm').addEventListener('submit', addTask);
loadTasks();
renderTasks();
loadWeather();
