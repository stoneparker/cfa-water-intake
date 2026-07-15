import { useState, useEffect, useCallback } from 'react';
import Ring from '../components/Ring';
import { getDailyStats, registerIntake } from '../services/api';
import { onReminder, onIntake } from '../services/socket';

const QUICK = [150, 200, 250, 350, 500];

export default function Home() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');
  const [reminder, setReminder] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError('');
      const d = await getDailyStats();
      setStats(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const unsub = onIntake((data) => setStats(data));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onReminder((data) => setReminder({ diffMinutes: data?.diffMinutes }));
    return unsub;
  }, []);

  const add = async (ml) => {
    setAdding(true);
    setError('');
    try {
      await registerIntake(ml);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleCustom = (e) => {
    e.preventDefault();
    const ml = Number(custom);
    if (!ml || ml <= 0) return setError('Informe uma quantidade válida.');
    setCustom('');
    add(ml);
  };

  const pct = stats?.goal_percent ?? 0;
  const totalMl = stats?.total_ml ?? 0;
  const goalMl = stats?.goal_ml ?? 2000;
  const remaining = stats?.remaining_ml ?? goalMl;
  const reached = stats?.goal_reached ?? false;
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div className="page-title" style={{ marginBottom: 2 }}>Hoje</div>
          <div style={{ fontSize: 15, color: 'var(--sub)', textTransform: 'capitalize' }}>{today}</div>
        </div>
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

      {/* Ring */}
      <div className="card">
        {loading ? (
          <div className="ring-wrap"><div style={{ color: 'var(--sub)', padding: 40 }}>Carregando...</div></div>
        ) : (
          <div className="ring-wrap">
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Ring percent={pct} />
              <div style={{ position: 'absolute', textAlign: 'center' }}>
                <div className="ring-main">{totalMl.toFixed(0)}</div>
                <div className="ring-label">ml bebidos</div>
                <div className={`ring-pct ${reached ? 'ok' : ''}`}>{pct}%</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Goal info */}
      <div className="goal-row">
        <div className="goal-box">
          <div className="goal-val">{goalMl} ml</div>
          <div className="goal-lbl">meta do dia</div>
        </div>
        <div className="goal-box">
          <div className={`goal-val ${reached ? 'ok' : ''}`}>
            {reached ? 'Atingida!' : `${remaining} ml`}
          </div>
          <div className="goal-lbl">{reached ? 'parabéns' : 'faltam'}</div>
        </div>
        {stats && (
          <div className="goal-box">
            <div className="goal-val">{stats.total_records}</div>
            <div className="goal-lbl">registros</div>
          </div>
        )}
      </div>

      {/* Quick add */}
      <div className="card">
        <div className="card-title">Registro manual</div>
        <div className="quick-row">
          {QUICK.map(ml => (
            <button key={ml} className="quick-btn" onClick={() => add(ml)} disabled={adding}>
              {ml}ml
            </button>
          ))}
        </div>
        <form className="custom-row" onSubmit={handleCustom}>
          <input
            name="custom-input"
            type="number"
            placeholder="Quantidade personalizada (ml)"
            value={custom}
            onChange={e => setCustom(e.target.value)}
            min="1"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary" disabled={adding || !custom}>
            {adding ? '...' : 'Adicionar'}
          </button>
        </form>
      </div>
    </div>
  );
}