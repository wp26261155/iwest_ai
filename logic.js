// logic.js – 판단 규칙만 (화면을 다루는 코드 금지)

// 교육용 가상 기준 (실제 작업 중지 · 행사 취소 기준은 각 기관 규정을 따름)
const RULES = { wind: 10, rain: 60, heat: 33 };

// 각 지역 중심부의 대표 좌표
const REGIONS = {
  '세종': { latitude: 36.48, longitude: 127.29 },
  '대전': { latitude: 36.35, longitude: 127.38 },
  '태안': { latitude: 36.75, longitude: 126.30 },
  '보령': { latitude: 36.33, longitude: 126.61 },
};

function buildWeatherUrl(region) {
  const point = REGIONS[region];
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: point.latitude,
    longitude: point.longitude,
    daily: 'temperature_2m_max,wind_speed_10m_max,precipitation_probability_max',
    temperature_unit: 'celsius',
    wind_speed_unit: 'ms',
    timezone: 'Asia/Seoul',
    forecast_days: '1',
  }).toString();
  return url.toString();
}

// 누락된 값을 0으로 판단하지 않고 해당 지역의 날씨를 미수신으로 처리한다.
function parseWeather(data, testWind = false) {
  const daily = data && data.daily;
  if (!daily) return null;
  const tempMax = daily.temperature_2m_max?.[0];
  const windMax = daily.wind_speed_10m_max?.[0];
  const rainProb = daily.precipitation_probability_max?.[0];
  if (![tempMax, windMax, rainProb].every(Number.isFinite)) return null;
  if (windMax < 0 || rainProb < 0 || rainProb > 100) return null;
  return { tempMax, windMax: testWind ? 12 : windMax, rainProb };
}

// 실내는 날씨와 관계없이 '영향 없음', 나머지는 날씨를 받은 뒤 판단한다.
function judge(kind, w) {
  if (kind === '실내') return { level: 'ok', text: '영향 없음' };
  if (!w) return { level: 'none', text: '날씨 확인 전' };
  if (kind === '고소' && w.windMax >= RULES.wind) return { level: 'stop', text: '중지 검토 (강풍)' };
  if (w.tempMax >= RULES.heat) return { level: 'warn', text: '폭염 휴식' };
  if (w.rainProb >= RULES.rain) return { level: 'warn', text: '우천 주의' };
  return { level: 'ok', text: '진행' };
}

// 화면에서 읽은 표 데이터를 받아 마크다운 문자열만 만든다.
function makeJudgmentMarkdown(headers, rows) {
  function escapeCell(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/[\\`*_{}\[\]]/g, '\\$&')
      .replace(/\|/g, '\\|')
      .replace(/\r\n|\r|\n/g, '<br>');
  }
  const tableRow = cells => '| ' + cells.map(escapeCell).join(' | ') + ' |';
  return [
    '# 오늘 판단',
    '',
    tableRow(headers),
    tableRow(headers.map(() => '---')),
    ...rows.map(tableRow),
    '',
    '판단 기준 (교육용 가상 기준): 고소 작업 최대 풍속 ' + RULES.wind + 'm/s 이상 → 중지 검토 · 최대 강수확률 ' + RULES.rain + '% 이상 → 우천 주의 · 최고 기온 ' + RULES.heat + '℃ 이상 → 폭염 휴식 (실내는 영향 없음, 여러 조건에 해당하면 강풍 → 폭염 → 우천 순서)',
    '',
  ].join('\n');
}

if (typeof module !== 'undefined') module.exports = { RULES, REGIONS, buildWeatherUrl, parseWeather, judge, makeJudgmentMarkdown };
