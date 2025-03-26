import React from 'react';
import { Trophy } from 'lucide-react';
import { useLeaderboard } from '../hooks/useLeaderboard';

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
  const { entries = [], loading, error } = useLeaderboard();
  // Replace with local storage
  const [userAddress, setUserAddress] = useLocalStorage<string>("userAddress", "");

  if (loading) {
    return (
      <div className="bg-[#1A1A1A] rounded-lg p-6 shadow-lg animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1A1A1A] rounded-lg p-6 shadow-lg">
      <div className="flex items-center gap-2 mb-6">
        <Trophy className="w-6 h-6 text-[#6C5DD3]" />
        <h2 className="text-xl font-semibold text-white">Leaderboard</h2>
      </div>

      {error && (
        <div className="bg-[#2A2A2A] rounded-lg p-3 mb-4 text-xs text-gray-400">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {entries.map((entry, index) => (
          <div
            key={entry.address + index}
            className="bg-[#2A2A2A] rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-[#3A3A3A] transition-colors"
            onClick={() => onPlayerClick?.(entry.address)}
          >
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-[#6C5DD3]/10 flex items-center justify-center text-[#6C5DD3] font-semibold">
                {index + 1}
              </div>
              <div>
                <p className="text-white font-medium">
                  {entry.address === userAddress ? 'You' : `Player ${entry.address.slice(0, 6)}...`}
                </p>
                <p className="text-sm text-gray-400">Score: {entry.score}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-white">{entry.score}</p>
              <p className="text-sm text-gray-400">
                {new Date(entry.timestamp * 1000).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {entries.length === 0 && !error && (
        <div className="text-center py-8">
          <p className="text-gray-400">No games played yet</p>
        </div>
      )}
    </div>
  );
} 