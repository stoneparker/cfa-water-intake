import { useState, useEffect } from 'react';
import { getGoal, updateGoal } from '../services/api';

const PRESETS = [1500, 2000, 2500, 3000];

export default function Settings() {
  const [goal, setGoal] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const d = await getGoal();
        setGoal(d);
        setInput(String(d.daily_goal_ml));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    const ml = Number(input);
    if (!ml || ml <= 0) return setError('Informe um valor maior que zero.');
    setSaving(true); setError(''); setMsg('');
    try {
      const updated = await updateGoal(ml);
      setGoal(updated);
      setMsg(`Meta atualizada para ${updated.daily_goal_ml} ml/dia.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const updatedAt = goal?.updated_at
    ? new Date(goal.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div>
      <div className="page-title">Configurações</div>

      {error && <div className="error-msg">{error}</div>}
      {msg   && <div style={{ background: 'var(--success-lt)', border: '1px solid #bbf7d0', color: 'var(--success)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 16, fontSize: 14 }}>{msg}</div>}

      <div className="card">
        <div className="card-title">Meta diária</div>

        {loading ? <div style={{ color: 'var(--sub)', fontSize: 14 }}>Carregando...</div> : (
          <>
            {goal && (
              <div style={{ marginBottom: 16, fontSize: 14, color: 'var(--sub)' }}>
                Meta atual: <b style={{ color: 'var(--text)' }}>{goal.daily_goal_ml} ml/dia</b>
                {updatedAt && <span> · definida em {updatedAt}</span>}
              </div>
            )}

            <form onSubmit={handleSave}>
              <div className="field">
                <label>Atalhos</label>
                <div className="presets">
                  {PRESETS.map(ml => (
                    <button
                      key={ml} type="button"
                      className={`preset-btn ${String(ml) === input ? 'active' : ''}`}
                      onClick={() => setInput(String(ml))}
                    >
                      {ml} ml
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>Valor personalizado</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="number" min="1" value={input}
                    onChange={e => setInput(e.target.value)}
                    style={{ maxWidth: 180 }}
                  />
                  <span style={{ color: 'var(--sub)', fontSize: 14 }}>ml / dia</span>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar meta'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
