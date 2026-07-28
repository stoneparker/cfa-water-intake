import { useState, useEffect } from 'react';
import Home from './pages/Home';
import Stats from './pages/Stats';

import { connectDevice, onReminder } from './services/socket';
import Settings from './pages/Settings';

const TABS = [
  { id: 'home', label: 'Início' },
  { id: 'stats', label: 'Estatísticas' },
  { id: 'settings', label: 'Configurações' },
];

export default function App() {
  const [tab, setTab] = useState('home');

  useEffect(() => {
    const deviceId = new URLSearchParams(window.location.search).get('device_id');
    connectDevice(deviceId);
  }, []);


  useEffect(() => {
    const unsub = onReminder((data) => alert(`Atenção! Já faz ${data?.diffMinutes} minutos desde sua última ingestão de água. Hora de se hidratar!`));
    return unsub;
  }, []);

  return (
    <div className="app">
      <nav>
        <div className="brand">💧 WI</div>
        {TABS.map(t => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <main>
        {tab === 'home' && <Home />}
        {tab === 'stats' && <Stats />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  );
}
