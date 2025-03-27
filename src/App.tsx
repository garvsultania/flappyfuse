import React from 'react';
import { Game } from './components/Game';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <div 
        className="min-h-screen bg-[#1e1e2f]" 
      >
        <Game />
      </div>
    </ErrorBoundary>
  );
}

export default App;
