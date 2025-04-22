import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Game } from './components/Game';
import './App.css';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#1e1e2f] text-white">
        <header className="App-header" role="banner">
          <h1 className="text-4xl font-bold text-center py-4" tabIndex={0}>
            Flappy Fuse
          </h1>
        </header>
        <main className="App-main" role="main">
          <Game />
        </main>
        <footer className="App-footer" role="contentinfo">
          <p className="text-sm text-gray-400 text-center py-4">
            © {new Date().getFullYear()} Flappy Fuse. All rights reserved.
          </p>
        </footer>
      </div>
    </ErrorBoundary>
  );
};

export default App;
