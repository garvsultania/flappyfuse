import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ABI, CONTRACT_ADDRESS, RPC_URL, RPC_ENDPOINTS } from '../config/contract';

interface LeaderboardEntry {
  address: string;
  score: number;
  timestamp: number;
}

// Local storage key for caching leaderboard data
const LEADERBOARD_CACHE_KEY = 'flappyFuse_leaderboardCache';

// Helper function to save to local storage
const saveToLocalStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error(`Failed to save ${key} to localStorage:`, error);
  }
};

// Helper function to get from local storage with expiry check
const getFromLocalStorage = (key: string, maxAgeMs = 5 * 60 * 1000) => {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    
    const { data, timestamp } = JSON.parse(item);
    const isExpired = Date.now() - timestamp > maxAgeMs;
    
    if (isExpired) {
      localStorage.removeItem(key);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error(`Failed to retrieve ${key} from localStorage:`, error);
    return null;
  }
};

export function useLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track if we're using real data or mock data
  const [isRealData, setIsRealData] = useState(false);

  // Function to update leaderboard with local scores
  const updateWithLocalScores = (currentEntries: LeaderboardEntry[]) => {
    try {
      const mergedEntries = [...currentEntries];

      // 1. First check local transaction queue
      const txQueue = localStorage.getItem('flappyFuse_transactionQueue');
      if (txQueue) {
        try {
          const transactions = JSON.parse(txQueue);
          
          // Find end game transactions with scores
          const endGameTxs = transactions.filter((tx: any) => 
            tx.type === 'end' && 
            tx.status === 'confirmed' && 
            tx.data?.finalScore !== undefined &&
            tx.data?.gameId !== undefined
          );
          
          if (endGameTxs.length > 0) {
            // Extract unique scores by gameId (in case there are duplicates)
            const localScores: Record<string, { score: number, timestamp: number, address: string }> = {};
            endGameTxs.forEach((tx: any) => {
              const gameId = tx.data.gameId.toString();
              if (!localScores[gameId] || tx.data.finalScore > localScores[gameId].score) {
                localScores[gameId] = {
                  score: tx.data.finalScore,
                  timestamp: Math.floor(tx.timestamp / 1000),
                  address: String(tx.data.address)
                };
                console.log("localScores: ", localScores, tx);
              }
            });
            
            // Add scores from transaction queue
            Object.values(localScores).forEach(score => {
              mergedEntries.push({
                address: score.address.toString(),
                score: score.score,
                timestamp: score.timestamp
              });
            });
          }
        } catch (error) {
          console.error('Failed to process transaction queue:', error);
        }
      }
      
      // 2. Now check explicit local scores storage
      const localScoresJson = localStorage.getItem('flappyFuse_localScores');
      if (localScoresJson) {
        try {
          const localScores = JSON.parse(localScoresJson);
          
          // Add scores from the dedicated local scores storage
          localScores.forEach((score: any) => {
            if (score.score !== undefined) {
              mergedEntries.push({
                address: typeof score.address === 'string' ? score.address : 'local_player',
                score: score.score,
                timestamp: score.timestamp || Math.floor(Date.now() / 1000)
              });
            }
          });
        } catch (error) {
          console.error('Failed to process local scores:', error);
        }
      }
      
      // Make sure all entries have valid address strings
      const validEntries = mergedEntries.map(entry => ({
        ...entry,
        address: typeof entry.address === 'string' ? entry.address : 'local_player'
      }));
      
      // Sort by score (highest first)
      validEntries.sort((a, b) => b.score - a.score);
      
      // Take top 10
      return validEntries.slice(0, 10);
      
    } catch (error) {
      console.error('Failed to update with local scores:', error);
      return currentEntries;
    }
  };

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        console.log('Fetching leaderboard data...');
        
        // First check for cached data
        const cachedData = getFromLocalStorage(LEADERBOARD_CACHE_KEY);
        if (cachedData) {
          console.log('Using cached leaderboard data');
          setEntries(updateWithLocalScores(cachedData));
          setLoading(false);
          // Still try to fetch fresh data in the background
        }
        
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
            
            let leaderboardData: any[] = [];
            
            // Try different methods to get leaderboard data
            try {
              // First try calling getAllGames
              if (Object.keys(contract.functions).includes('getAllGames')) {
                console.log('Using getAllGames method');
                const games = await contract.getAllGames();
                
                // Process games to extract scores
                const processedGames = games
                  .filter((game: any) => game.ended && game.finalScore > 0)
                  .map((game: any) => ({
                    address: game.player,
                    score: Number(game.finalScore),
                    timestamp: Number(game.endTime)
                  }));
                
                leaderboardData = processedGames;
              }
              // If getAllGames doesn't exist or returns no data, try getLeaderboard
              else if (Object.keys(contract.functions).includes('getLeaderboard')) {
                console.log('Using getLeaderboard method');
                leaderboardData = await contract.getLeaderboard();
                console.log("leaderboardData: ", leaderboardData);
                
                leaderboardData = leaderboardData.map((entry: any) => ({
                  address: entry.player,
                  score: Number(entry.score),
                  timestamp: Number(entry.timestamp)
                }));
              }
              // As a last resort, try getTopScores
              else if (Object.keys(contract.functions).includes('getTopScores')) {
                console.log('Using getTopScores method');
                leaderboardData = await contract.getTopScores();
                
                leaderboardData = leaderboardData.map((entry: any) => ({
                  address: entry.player,
                  score: Number(entry.score),
                  timestamp: Number(entry.timestamp)
                }));
              } else {
                throw new Error('No leaderboard methods available');
              }
              
              // Sort by score (highest first)
              leaderboardData.sort((a, b) => b.score - a.score);
              
              // Take top 10
              leaderboardData = leaderboardData.slice(0, 10);
              
              console.log('Leaderboard data loaded successfully:', leaderboardData);
              
              // Cache the data
              saveToLocalStorage(LEADERBOARD_CACHE_KEY, leaderboardData);
              
              // Update with local scores
              const finalData = updateWithLocalScores(leaderboardData);
              
              setEntries(finalData);
              setIsRealData(true);
              success = true;
              break;
            } catch (methodError) {
              console.error('Error calling contract methods:', methodError);
              lastError = methodError;
            }
          } catch (endpointError) {
            console.warn(`Failed to load leaderboard from endpoint ${endpoint}:`, endpointError);
            lastError = endpointError;
          }
        }
        
        if (!success) {
          console.warn('All endpoints failed, using local data if available');
          
          // If we already have cached data, don't show an error
          if (!cachedData) {
            const localScores = updateWithLocalScores([]);
            
            if (localScores.length > 0) {
              console.log('Using local transaction data for leaderboard');
              setEntries(localScores);
              setError('Using local game data');
            } else {
              console.log('No leaderboard data available');
              setEntries([]);
              setError('No leaderboard data available');
            }
          }
        }
      } catch (err) {
        console.error('Error in leaderboard hook:', err);
        
        // Try to use local data first
        const localScores = updateWithLocalScores([]);
        
        if (localScores.length > 0) {
          console.log('Using local transaction data for leaderboard after error');
          setEntries(localScores);
          setError('Using local game data');
        } else {
          // Show empty leaderboard with error
          console.log('No leaderboard data available after error');
          setEntries([]);
          setError('Failed to load leaderboard data');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  return { entries, loading, error, isRealData };
} 