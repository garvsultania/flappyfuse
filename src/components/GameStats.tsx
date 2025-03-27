import React from 'react';
import { Users, Gamepad2, Clock } from 'lucide-react';
import { useGameStats } from '../hooks/useGameStats';

export function GameStats() {
  const { stats, isLoading, error, refreshGameStats } = useGameStats();

  if (error) {
    return (
      <div className="p-4 bg-red-900/10 rounded-sm border border-red-500/10">
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
        <h3 className="text-base font-medium text-white flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-[#6C5DD3]" />
          Game Statistics
        </h3>
        {isLoading && (
          <div className="w-3 h-3 border border-t-transparent border-[#6C5DD3] rounded-full animate-spin"></div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#1a1a25] rounded-sm p-4 border border-white/5 hover:border-white/10 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <Gamepad2 className="w-4 h-4 text-[#4ADE80]" />
            <span className="text-white/50 text-xs">Total Games</span>
          </div>
          <div className="text-xl font-medium bg-gradient-to-r from-[#00D13F] to-[#4ADE80] bg-clip-text text-transparent">
            {(stats.totalGamesPlayed || 0).toLocaleString()}
          </div>
        </div>

        <div className="bg-[#1a1a25] rounded-sm p-4 border border-white/5 hover:border-white/10 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-[#6C5DD3]" />
            <span className="text-white/50 text-xs">Unique Players</span>
          </div>
          <div className="text-xl font-medium text-[#6C5DD3]">
            {(stats.uniquePlayers || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {stats.lastGameTimestamp && (
        <div className="bg-[#1a1a25] rounded-sm p-3 border border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-white/40" />
            <span className="text-white/50 text-xs">Last Game</span>
          </div>
          <div className="text-sm text-white/80">
            {new Date(stats.lastGameTimestamp * 1000).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
} 