import React from 'react';
import { Trophy } from 'lucide-react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useFlappyContract } from '../hooks/useFlappyContract';

interface LeaderboardProps {
  onPlayerClick?: (address: string) => void;
}

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  // Get from local storage then
  // parse stored json or return initialValue
  const [storedValue, setStoredValue] = React.useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.log(error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that ...
  // ... persists the new value to localStorage.
  const setValue = (value: T) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      // Save to local storage
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
      setStoredValue(valueToStore);
    } catch (error) {
      console.log(error);
    }
  };
  return [storedValue, setValue];
}

export function Leaderboard({ onPlayerClick }: LeaderboardProps) {
  const { entries = [], loading, error, isRealData } = useLeaderboard();
  const { address } = useFlappyContract(); // Get the user's wallet address

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 bg-white/5 rounded-sm w-1/3 mb-2"></div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-white/5 rounded-sm"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="bg-[#1a1a25] rounded-sm p-3 mb-3 text-xs text-white/40">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {entries.map((entry, index) => (
          <div
            key={entry.address + index}
            className="bg-[#1a1a25] rounded-sm p-3 flex items-center justify-between cursor-pointer hover:bg-[#252538] transition-colors border border-white/5"
          >
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-sm bg-[#6C5DD3]/10 flex items-center justify-center text-[#6C5DD3] font-medium text-sm">
                {index + 1}
              </div>
              <div className="font-medium text-sm text-white flex items-center gap-1">
                {entry.address === address ? (
                  <span className="text-green-400">You</span>
                ) : (
                  <span className="font-mono text-white nowrap">{entry?.address || 'local_player'}</span>
                )}
                <span className="mx-1.5 text-white/30">•</span>
                <span className="text-white/50 text-xs">{new Date(entry.timestamp * 1000).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-medium text-[#4ADE80]">{entry.score}</span>
            </div>
          </div>
        ))}
      </div>

      {entries.length === 0 && !error && (
        <div className="text-center py-4">
          <p className="text-white/40 text-sm">No games played yet</p>
        </div>
      )}
    </div>
  );
} 