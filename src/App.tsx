import React from 'react';
import { Game } from './components/Game';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <div 
        className="min-h-screen bg-gray-900" 
        style={{ backgroundColor: '#1a202c' }}
      >
        <div style={{ color: 'white', padding: '20px' }}>
          Test Text - If you see this, React is rendering
        </div>
        <Game />
      </div>
    </ErrorBoundary>
  );
}

export default App;
