import React, { useState } from 'react';
import RiskMapPage from './pages/RiskMapPage';
import FloodReportingForm from './pages/FloodReportingForm';

export const App: React.FC = () => {
  const [view, setView] = useState<'map' | 'uplink'>('map');

  return view === 'map' ? (
    <RiskMapPage onOpenReportForm={() => setView('uplink')} />
  ) : (
    <FloodReportingForm onBackToMap={() => setView('map')} />
  );
};

export default App;
