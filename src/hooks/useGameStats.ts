import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ABI, CONTRACT_ADDRESS, RPC_URL } from '../config/contract';

interface GameStats {
  totalGamesPlayed: number;
  uniquePlayers: number;
  lastGameTimestamp: number | null;
}

export function useGameStats() {
  const [stats, setStats] = useState<GameStats>({
    totalGamesPlayed: 0,
    uniquePlayers: 0,
    lastGameTimestamp: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

        // Get the game stats
        const [totalGames, totalPlayers, averageScore, highestScore] = await Promise.all([
          contract.totalGames(),
          contract.totalPlayers(),
          contract.averageScore(),
          contract.highestScore()
        ]);

        setStats({
          totalGamesPlayed: Number(totalGames),
          uniquePlayers: Number(totalPlayers),
          lastGameTimestamp: Date.now()
        });
      } catch (err) {
        console.error('Error fetching game stats:', err);
        setError('Failed to load game statistics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, isLoading, error };
} 