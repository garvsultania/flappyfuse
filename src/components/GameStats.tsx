import React from 'react';
import { Users, Gamepad2, Clock } from 'lucide-react';
import { useGameStats } from '../hooks/useGameStats';

export function GameStats() {
  const { stats, isLoading, error, refreshGameStats } = useGameStats();

  if (error) {
    return (
      <div className="p-4 bg-red-900/20 rounded-xl border border-red-500/20">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={refreshGameStats}
          className="mt-2 text-xs text-red-400 hover:text-red-300"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Gamepad2 className="w-5 h-5 text-purple-400" />
          Game Statistics
        </h3>
        {isLoading && (
          <div className="w-4 h-4 border-2 border-t-transparent border-purple-500 rounded-full animate-spin"></div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50 hover:border-purple-600/30 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <Gamepad2 className="w-5 h-5 text-purple-400" />
            <span className="text-gray-400 text-sm">Total Games</span>
          </div>
          <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            {(stats.totalGamesPlayed || 0).toLocaleString()}
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50 hover:border-blue-600/30 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-blue-400" />
            <span className="text-gray-400 text-sm">Unique Players</span>
          </div>
          <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            {(stats.uniquePlayers || 0).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="stat">
        <div className="stat-title">Last Game</div>
        <div className="stat-value">
          {stats.lastGameTimestamp ? 
            new Date(stats.lastGameTimestamp * 1000).toLocaleString() : 
            'No games yet'}
        </div>
      </div>
    </div>
  );
} 