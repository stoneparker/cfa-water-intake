import { useState, useEffect } from 'react';
import Home from './pages/Home';
import Stats from './pages/Stats';

import { connectDevice } from './services/socket';

const TABS = [
  { id: 'home', label: 'Início' },
  { id: 'stats', label: 'Estatísticas' },
];

export default function App() {
  const [tab, setTab] = useState('home');

  useEffect(() => {
    const deviceId = new URLSearchParams(window.location.search).get('device_id');
    connectDevice(deviceId);
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
      </main>
    </div>
  );
}
