// app.js – 화면 동작 (목록 그리기, 일정 추가)

let baseTasks = [];    // data/tasks.json에서 읽은 기본 일정
let addedTasks = [];   // 화면에서 추가해 브라우저에 저장한 일정
let tasks = [];
let tasksLoading = true;
let weatherByRegion = {};

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
  const warnings = [];
  tasksLoading = true;
  button.disabled = true;
  message.textContent = '일정을 불러오는 중입니다.';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('data/tasks.json', { signal: controller.signal });
    if (!response.ok) throw new Error('일정 요청 실패');
    const data = await response.json();
    if (!isTaskList(data)) throw new Error('일정 형식 오류');
    baseTasks = data;
  } catch (error) {
    baseTasks = [];
    warnings.push(window.location.protocol === 'file:'
      ? '배포 주소로 열어 주세요'
      : '기본 일정을 불러오지 못했습니다. 새로고침해 다시 시도해 주세요.');
  } finally {
    clearTimeout(timeout);
  }

  // 기본 JSON을 먼저 읽고, 브라우저에는 사용자가 추가한 일정만 따로 둔다.
  try {
    const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
    if (!isTaskList(saved)) throw new Error('저장된 일정 형식 오류');
    addedTasks = saved;
  } catch (error) {
    addedTasks = [];
    warnings.push('브라우저에 저장된 추가 일정을 읽지 못했습니다.');
  }
  tasks = baseTasks.concat(addedTasks);
  renderTasks();
  message.textContent = warnings.join(' ');
  tasksLoading = false;
  button.disabled = false;
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

function addTask(e) {
  e.preventDefault();
  if (tasksLoading) return;
  const t = {
    title: document.getElementById('titleInput').value.trim(),
    region: document.getElementById('regionInput').value,
    kind: document.getElementById('kindInput').value,
    owner: document.getElementById('ownerInput').value.trim(),
  };
  if (!t.title || !t.owner) return;
  const saved = addedTasks.concat(t);
  try {
    localStorage.setItem('wx_added', JSON.stringify(saved));
  } catch (error) {
    document.getElementById('msgBox').textContent = '추가 일정을 저장하지 못했습니다. 브라우저 저장 공간 설정을 확인해 주세요.';
    return;
  }
  addedTasks = saved;
  tasks = baseTasks.concat(addedTasks);
  e.target.reset();
  renderTasks();
}

document.getElementById('taskForm').addEventListener('submit', addTask);
loadTasks();
renderTasks();
loadWeather();
