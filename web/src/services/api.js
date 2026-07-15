const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

async function request(method, path, body = null) {
  const deviceId = new URLSearchParams(window.location.search).get('device_id');

  const options = {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Device-Id': deviceId },
  };

  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    if (!body) body = {};
    body.device_id = deviceId;
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, options);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Erro HTTP ${res.status}`);
  return json.data ?? json;
}

export const setGlobalDeviceId = (id) => {  deviceId = id; };

export const getGoal = () => request('GET', '/goal');
export const updateGoal = (ml) => request('PUT', '/goal', { daily_goal_ml: ml });
export const registerIntake = (ml, notes) => request('POST', '/intake', { amount_ml: ml });
export const getIntakes = (date) => request('GET', `/intake${date ? `?date=${date}` : ''}`);
export const deleteIntake = (id) => request('DELETE', `/intake/${id}`);
export const getDailyStats = (date) => request('GET', `/stats/daily${date ? `?date=${date}` : ''}`);
export const getPeriodStats = (start, end) => {
  const q = new URLSearchParams();
  if (start) q.append('start_date', start);
  if (end)   q.append('end_date', end);
  return request('GET', `/stats/period${q.toString() ? `?${q}` : ''}`);
};
export const getHourlyStats = (date) => request('GET', `/stats/hourly${date ? `?date=${date}` : ''}`);
