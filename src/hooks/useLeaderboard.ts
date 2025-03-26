import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ABI, CONTRACT_ADDRESS, RPC_URL, RPC_ENDPOINTS } from '../config/contract';

interface LeaderboardEntry {
  address: string;
  score: number;
  timestamp: number;
}

// Improved mock data with more realistic entries
const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  {
    address: '0x1234567890123456789012345678901234567890',
    score: 42,
    timestamp: Math.floor(Date.now() / 1000) - 3600
  },
  {
    address: '0x2345678901234567890123456789012345678901',
    score: 38,
    timestamp: Math.floor(Date.now() / 1000) - 7200
  },
  {
    address: '0x3456789012345678901234567890123456789012',
    score: 35,
    timestamp: Math.floor(Date.now() / 1000) - 10800
  },
  {
    address: '0x4567890123456789012345678901234567890123',
    score: 31,
    timestamp: Math.floor(Date.now() / 1000) - 14400
  },
  {
    address: '0x5678901234567890123456789012345678901234',
    score: 27,
    timestamp: Math.floor(Date.now() / 1000) - 18000
  }
];

export function useLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        console.log('Fetching leaderboard data...');
        
        // Try multiple RPC endpoints in case one fails
        let success = false;
        let lastError;
        
        for (const endpoint of RPC_ENDPOINTS) {
          if (success) break;
          
          try {
            console.log(`Trying endpoint: ${endpoint}`);
            const provider = new ethers.providers.JsonRpcProvider(endpoint);
            
            // Test basic provider connectivity
            try {
              const blockNumber = await provider.getBlockNumber();
              console.log(`Connected to endpoint ${endpoint}, block: ${blockNumber}`);
            } catch (providerError) {
              console.warn(`Provider at ${endpoint} failed connectivity test:`, providerError);
              lastError = providerError;
              continue; // Try next endpoint
            }
            
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
            
            // Check if getLeaderboard method exists
            const methods = Object.keys(contract.functions);
            if (!methods.includes('getLeaderboard')) {
              console.warn('Contract does not have getLeaderboard method, available methods:', methods);
              // Try a fallback method if available
              if (methods.includes('getTopScores')) {
                console.log('Trying fallback method getTopScores');
                const leaderboardData = await contract.getTopScores();
                
                const formattedEntries = leaderboardData.map((entry: any) => ({
                  address: entry.player,
                  score: Number(entry.score),
                  timestamp: Number(entry.timestamp)
                }));
                
                console.log('Leaderboard data loaded successfully from fallback method:', formattedEntries);
                setEntries(formattedEntries);
                success = true;
                break;
              }
              
              throw new Error('Contract does not support leaderboard functionality');
            }
            
            // Try to get the leaderboard data from the contract
            const leaderboardData = await contract.getLeaderboard();
            
            // Format the data
            const formattedEntries = leaderboardData.map((entry: any) => ({
              address: entry.player,
              score: Number(entry.score),
              timestamp: Number(entry.timestamp)
            }));

            console.log('Leaderboard data loaded successfully:', formattedEntries);
            setEntries(formattedEntries);
            success = true;
            break;
            
          } catch (endpointError) {
            console.warn(`Failed to load leaderboard from endpoint ${endpoint}:`, endpointError);
            lastError = endpointError;
          }
        }
        
        if (!success) {
          console.warn('All endpoints failed, using mock data instead:', lastError);
          // Use mock data instead when all contract calls fail
          setEntries(MOCK_LEADERBOARD);
          setError('Using demo leaderboard data');
        }
      } catch (err) {
        console.error('Error in leaderboard hook:', err);
        // Fallback to mock data in case of any errors
        setEntries(MOCK_LEADERBOARD);
        setError('Using demo leaderboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  return { entries, loading, error };
} 