const { SUPABASE_URL, SUPABASE_PUBLIC_KEY } = require('../config.js');
const { KMA_GRIDS, getKmaForecastContext, buildKmaUrl, parseKmaWeather, judge } = require('../logic.js');

function isPublicKey(key) {
  if (typeof key !== 'string' || !key.trim()) return false;
  if (key.startsWith('sb_publishable_')) return true;
  try {
    const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))).role === 'anon';
  } catch (error) {
    return false;
  }
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error('외부 요청 실패');
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function readTasks(region) {
  const url = new URL('/rest/v1/wx_tasks', SUPABASE_URL);
  url.search = new URLSearchParams({
    select: 'id,title,region,kind,owner', region: 'eq.' + region, order: 'id.asc',
  }).toString();
  const data = await fetchJson(url, { headers: {
    apikey: SUPABASE_PUBLIC_KEY, Authorization: 'Bearer ' + SUPABASE_PUBLIC_KEY,
  } });
  if (!Array.isArray(data) || !data.every(task => task && task.region === region &&
      ['title', 'kind', 'owner'].every(key => typeof task[key] === 'string'))) {
    throw new Error('일정 응답 형식 오류');
  }
  return data;
}

async function readWeather(region, context) {
  // 키를 응답이나 로그에 포함하지 않는다. 외부 오류 원문도 반환하지 않는다.
  const key = process.env.KMA_KEY;
  if (typeof key !== 'string' || !key.trim()) return null;
  try {
    const data = await fetchJson(buildKmaUrl(region, key, context));
    return parseKmaWeather(data, context.date);
  } catch (error) {
    return null;
  }
}

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'GET 요청만 지원합니다.' });
  }
  const region = request.query && request.query.region;
  if (typeof region !== 'string' || !Object.hasOwn(KMA_GRIDS, region)) {
    return response.status(400).json({ error: 'region은 세종, 대전, 태안, 보령 중 하나여야 합니다.' });
  }
  if (typeof SUPABASE_URL !== 'string' || !SUPABASE_URL.trim() ||
      !isPublicKey(SUPABASE_PUBLIC_KEY)) {
    return response.status(503).json({ error: 'Supabase 공개 연결 설정이 필요합니다.' });
  }
  const context = getKmaForecastContext();
  try {
    const [tasks, weather] = await Promise.all([readTasks(region), readWeather(region, context)]);
    return response.status(200).json({
      region,
      date: context.date,
      source: '기상청 단기예보',
      baseDate: context.baseDate,
      baseTime: context.baseTime,
      weatherStatus: weather ? 'ok' : 'unavailable',
      ...(weather ? {} : { warning: '오늘 전체 예보를 확인하지 못했습니다. KMA_KEY 설정·활용 승인·호출 상태를 확인해 주세요.' }),
      weather,
      tasks: tasks.map(task => ({ ...task, weather, judgment: judge(task.kind, weather) })),
    });
  } catch (error) {
    return response.status(502).json({ error: '일정을 조회하지 못했습니다. Supabase 연결과 wx_tasks 조회 권한을 확인해 주세요.' });
  }
};
