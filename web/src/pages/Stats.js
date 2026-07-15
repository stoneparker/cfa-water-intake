import { useState, useEffect, useCallback } from 'react';
import { getDailyStats, getPeriodStats, getHourlyStats } from '../services/api';
import { onReminder, onIntake } from '../services/socket';

const PERIODS = [{ label: '7 dias', days: 7 }, { label: '14 dias', days: 14 }, { label: '30 dias', days: 30 }];

function dateNDaysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - (n - 1)); return d.toISOString().slice(0, 10);
}

export default function Stats() {
  const [daily, setDaily] = useState(null);
  const [hourly, setHourly] = useState([]);
  const [period, setPeriod] = useState(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reminder, setReminder] = useState(null);

  const load = useCallback(async (d = days) => {
    setLoading(true);
    setError('');
    try {
      const [dy, hr, pr] = await Promise.all([
        getDailyStats(),
        getHourlyStats(),
        getPeriodStats(dateNDaysAgo(d)),
      ]);
      setDaily(dy);
      setHourly(hr.hourly || []);
      setPeriod(pr);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(days); }, [days]);

  useEffect(() => {
    const unsub = onIntake((data) => {
      setDaily(data);
      load();
    });
    return unsub;
  }, [load]);

  useEffect(() => {
    const unsub = onReminder((data) => setReminder({ diffMinutes: data?.diffMinutes }));
    return unsub;
  }, []);

  const maxMl = Math.max(...hourly.map(h => h.total_ml), 1);
  const daysHit = period?.daily?.filter(d => d.goal_reached).length ?? 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="page-title" style={{ marginBottom: 0 }}>Estatísticas</div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {reminder && (
        <div style={{
          background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af',
          borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 16, fontSize: 14,
        }}>
          💧 Faz {reminder.diffMinutes} min desde o último gole. Hora de se hidratar!
        </div>
      )}

      {/* Hourly chart */}
      <div className="card">
        <div className="card-title">Consumo por hora — hoje</div>
        {loading ? <div style={{ color: 'var(--sub)', fontSize: 14 }}>Carregando...</div> : (
          <>
            <div className="chart-bars">
              {hourly.map(h => (
                <div
                  key={h.hour}
                  className={`chart-bar ${h.total_ml > 0 ? 'active' : ''}`}
                  style={{ height: `${Math.max((h.total_ml / maxMl) * 100, h.total_ml > 0 ? 5 : 0)}%` }}
                  title={`${h.hour}h: ${h.total_ml}ml`}
                />
              ))}
            </div>
            <div className="chart-labels">
              {[0, 6, 12, 18, 23].map(h => <span key={h} className="chart-lbl">{String(h).padStart(2,'0')}h</span>)}
            </div>
            {daily && (
              <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 13, color: 'var(--sub)' }}>
                <span>Primeiro: <b style={{ color: 'var(--text)' }}>
                  {daily.first_intake ? new Date(daily.first_intake).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                </b></span>
                <span>Último: <b style={{ color: 'var(--text)' }}>
                  {daily.last_intake ? new Date(daily.last_intake).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                </b></span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Period */}
      <div className="period-tabs">
        {PERIODS.map(p => (
          <button key={p.days} className={`period-tab ${days === p.days ? 'active' : ''}`} onClick={() => setDays(p.days)}>
            {p.label}
          </button>
        ))}
      </div>

      {!loading && period && (
        <>
          <div className="stat-row">
            <div className="stat-box">
              <div className="stat-val">{(period.overall_total_ml / 1000).toFixed(1)} L</div>
              <div className="stat-lbl">total no período</div>
            </div>
            <div className="stat-box">
              <div className="stat-val">{period.overall_avg_daily_ml} ml</div>
              <div className="stat-lbl">média diária</div>
            </div>
            <div className="stat-box">
              <div className="stat-val">{daysHit}/{period.days_with_data}</div>
              <div className="stat-lbl">metas atingidas</div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Por dia</div>
            {[...(period.daily ?? [])].reverse().map(d => {
              const pct = d.goal_percent ?? 0;
              const label = new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
              return (
                <div key={d.date} className="day-row">
                  <div className="day-date">
                    <div style={{ textTransform: 'capitalize' }}>{label}</div>
                    <div className="day-ml">{d.total_ml} ml</div>
                  </div>
                  <div className="day-bar-wrap">
                    <div className="day-bar-bg">
                      <div className={`day-bar-fill ${d.goal_reached ? 'ok' : ''}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <span className={`day-pct ${d.goal_reached ? 'ok' : ''}`}>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}