import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Bird, Cloud, Settings, ChevronRight, Trophy, Coins, Info } from 'lucide-react';
import { useFlappyContract } from '../hooks/useFlappyContract';
import { useCustodialWallet } from '../hooks/useCustodialWallet';
import { TransactionTable } from './TransactionTable';
import { Leaderboard } from './Leaderboard';
import { useTransactionQueue } from '../hooks/useTransactionQueue';

// Add a queue for storing jumps
interface QueuedJump {
  timestamp: number;
  processed: boolean;
  scoreAtJump: number;
  multiplierAtJump: number;
}

interface GameState {
  isPlaying: boolean;
  birdPosition: number;
  pipePositions: { x: number; gapY: number }[];
  gameSpeed: number;
  totalJumps: number;
  gameId?: string;
  jumps: QueuedJump[];
  score: number;
  showStartMessage: boolean;
}

const INITIAL_STATE: GameState = {
  isPlaying: false,
  birdPosition: 250,
  pipePositions: [
    // Add initial pipes for better visual appearance
    { x: 400, gapY: 300 },
    { x: 700, gapY: 250 },
    { x: 1000, gapY: 350 }
  ],
  gameSpeed: 1.5,
  totalJumps: 0,
  jumps: [],
  score: 0,
  showStartMessage: true, // Set to true to show the start message initially
};

// Add a constant for the localStorage keys
const TOTAL_GAMES_KEY = 'flappyFuse_totalGames';
const TUTORIAL_SHOWN_KEY = 'flappyFuse_tutorialShown';

const GRAVITY = 0.6;
const JUMP_STRENGTH = -8;
const PIPE_WIDTH = 60;
const PIPE_GAP = 200;
const BIRD_SIZE = 30;
const PIPE_SPAWN_DISTANCE = 500;

// Add interface for jump data at the top
interface JumpData {
  timestamp: number;
  scoreAtJump: number;
  multiplierAtJump: number;
}

// Update the GameStartResult interface to make hash optional
interface GameStartResult {
  hash?: string;
  gameId: string;
}

// Update the GameEndResult interface to make hash optional
interface GameEndResult {
  success: boolean;
  hash?: string;
  localOnly?: boolean;
  message?: string;
}

export function Game() {
  // Refs for canvas and game loop
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number>();
  const gameContainerRef = useRef<HTMLDivElement>(null);
  
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [velocity, setVelocity] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [transactionPending, setTransactionPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [hasStartedMoving, setHasStartedMoving] = useState(false);
  const [totalGamesPlayed, setTotalGamesPlayed] = useState<number>(0);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [showNetworkInfo, setShowNetworkInfo] = useState<boolean>(false);

  const { address, startGame, endGame, connectWallet, error: contractError, resetGameStateAndReconnect } = useFlappyContract();
  const { 
    addJumpToBatch, 
    transactions, 
    wallet, 
    isLoading: walletLoading,
    initializeWallet,
    addTransaction,
    resetGameState,
    pendingJumps,
    uniqueUsers,
    updateUniqueUsers,
    hasPendingTransactions
  } = useCustodialWallet();

  // Get transaction queue directly to show pending transactions
  const { 
    queue: transactionQueue, 
    addToQueue, 
    clearQueue, 
    forceSave,
    checkAndFixPendingState 
  } = useTransactionQueue();

  // Add initial render effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initial render of game elements
    drawGame(ctx);
  }, []); // Empty dependency array means this runs once on mount

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('Canvas element not found');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get 2D context');
      return;
    }

    const gameLoop = () => {
      try {
        // Always draw the game elements
        drawGame(ctx);

        // Only update positions and handle game logic if the game is playing
        if (gameState.isPlaying) {
          // Don't apply gravity if game hasn't started moving
          if (!hasStartedMoving) {
            return;
          }

          // Update bird position
          setGameState((prev) => ({
            ...prev,
            birdPosition: prev.birdPosition + velocity,
          }));

          // Update velocity (gravity)
          setVelocity((prev) => prev + GRAVITY);

          // Update pipe positions and check for score
          setGameState((prev) => {
            const updatedPipes = prev.pipePositions.map((pipe) => ({
              ...pipe,
              x: pipe.x - prev.gameSpeed,
            }));

            // Check if bird has passed any pipes
            let scoreIncrement = 0;
            updatedPipes.forEach(pipe => {
              if (pipe.x + PIPE_WIDTH <= 100 && pipe.x + PIPE_WIDTH > 100 - prev.gameSpeed) {
                scoreIncrement = 1;
              }
            });

            return {
              ...prev,
              pipePositions: updatedPipes.filter((pipe) => pipe.x > -PIPE_WIDTH),
              score: prev.score + scoreIncrement
            };
          });

          // Add new pipes
          if (
            gameState.pipePositions.length === 0 ||
            gameState.pipePositions[gameState.pipePositions.length - 1].x < PIPE_SPAWN_DISTANCE
          ) {
            setGameState((prev) => ({
              ...prev,
              pipePositions: [
                ...prev.pipePositions,
                {
                  x: 800 + Math.random() * 200,
                  gapY: Math.random() * (400 - PIPE_GAP) + PIPE_GAP,
                },
              ],
            }));
          }

          // Check collisions
          const bird = {
            x: 100,
            y: gameState.birdPosition,
            width: BIRD_SIZE,
            height: BIRD_SIZE,
          };

          for (const pipe of gameState.pipePositions) {
            const upperPipe = {
              x: pipe.x,
              y: -10,
              width: PIPE_WIDTH,
              height: pipe.gapY - PIPE_GAP / 2,
            };

            const lowerPipe = {
              x: pipe.x,
              y: pipe.gapY + PIPE_GAP / 2,
              width: PIPE_WIDTH,
              height: 600 - (pipe.gapY + PIPE_GAP / 2),
            };

            if (
              checkCollision(bird, upperPipe) ||
              checkCollision(bird, lowerPipe) ||
              gameState.birdPosition < 0 ||
              gameState.birdPosition > 580
            ) {
              handleEndGame();
              return;
            }
          }
        }

        // Schedule next frame
        gameLoopRef.current = requestAnimationFrame(gameLoop);
      } catch (error) {
        console.error('Game loop error:', error);
        setGameState(INITIAL_STATE);
        if (gameLoopRef.current) {
          cancelAnimationFrame(gameLoopRef.current);
          gameLoopRef.current = undefined;
        }
      }
    };

    // Start the game loop
    gameLoopRef.current = requestAnimationFrame(gameLoop);

    // Cleanup
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = undefined;
      }
    };
  }, [gameState.isPlaying, velocity, gameState.pipePositions, hasStartedMoving]);

  const checkCollision = (
    rect1: { x: number; y: number; width: number; height: number },
    rect2: { x: number; y: number; width: number; height: number }
  ) => {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  };

  const drawGame = (ctx: CanvasRenderingContext2D) => {
    // Clear canvas
    ctx.clearRect(0, 0, 800, 600);

    // Draw background with Fuse gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 600);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16162a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 600);

    // Draw Fuse logo text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.font = 'bold 120px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('FUSE', 400, 300);

    // Draw pipes with Fuse brand color
    ctx.fillStyle = '#6C5DD3';
    gameState.pipePositions.forEach((pipe) => {
      // Draw upper pipe with gradient
      const pipeGradient = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_WIDTH, 0);
      pipeGradient.addColorStop(0, '#6C5DD3');
      pipeGradient.addColorStop(1, '#8F7FF7');
      ctx.fillStyle = pipeGradient;
      
      // Upper pipe
      ctx.fillRect(pipe.x, -10, PIPE_WIDTH, pipe.gapY - PIPE_GAP / 2 + 10);
      ctx.fillRect(pipe.x - 5, pipe.gapY - PIPE_GAP / 2 - 20, PIPE_WIDTH + 10, 20);

      // Lower pipe
      ctx.fillRect(
        pipe.x,
        pipe.gapY + PIPE_GAP / 2,
        PIPE_WIDTH,
        600 - (pipe.gapY + PIPE_GAP / 2)
      );
      ctx.fillRect(pipe.x - 5, pipe.gapY + PIPE_GAP / 2, PIPE_WIDTH + 10, 20);
    });

    // Draw bird with Fuse accent color
    const birdGradient = ctx.createLinearGradient(100, gameState.birdPosition, 100 + BIRD_SIZE, gameState.birdPosition + BIRD_SIZE);
    birdGradient.addColorStop(0, '#FF7F57');
    birdGradient.addColorStop(1, '#FF9776');
    ctx.fillStyle = birdGradient;
    ctx.fillRect(100, gameState.birdPosition, BIRD_SIZE, BIRD_SIZE);
    
    // Draw bird eye
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(120, gameState.birdPosition + 10, 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw score and jump counter overlay with improved design
    // Top-right corner overlay with gradient background
    const overlayWidth = 180;
    const overlayHeight = 80;
    const overlayX = 800 - overlayWidth - 20;
    const overlayY = 20;

    // Draw overlay background with gradient
    const overlayGradient = ctx.createLinearGradient(overlayX, overlayY, overlayX + overlayWidth, overlayY + overlayHeight);
    overlayGradient.addColorStop(0, 'rgba(26, 26, 46, 0.85)');
    overlayGradient.addColorStop(1, 'rgba(22, 22, 42, 0.85)');
    ctx.fillStyle = overlayGradient;
    
    // Draw rounded rectangle for overlay
    ctx.beginPath();
    ctx.roundRect(overlayX, overlayY, overlayWidth, overlayHeight, 10);
    ctx.fill();

    // Add subtle border
    ctx.strokeStyle = 'rgba(108, 93, 211, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw score with gradient text
    const scoreGradient = ctx.createLinearGradient(overlayX, overlayY, overlayX + overlayWidth, overlayY);
    scoreGradient.addColorStop(0, '#00D13F');
    scoreGradient.addColorStop(1, '#4ADE80');
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE', overlayX + 15, overlayY + 25);
    
    ctx.fillStyle = scoreGradient;
    ctx.font = 'bold 24px Arial';
    ctx.fillText(gameState.score.toString(), overlayX + 15, overlayY + 55);

    // Draw jumps
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('JUMPS', overlayX + overlayWidth - 15, overlayY + 25);
    
    ctx.fillStyle = '#6C5DD3';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(gameState.totalJumps.toString(), overlayX + overlayWidth - 15, overlayY + 55);

    // Draw "Press Space to Start" message if needed
    if (gameState.showStartMessage) {
      // Draw semi-transparent overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, 800, 600);
      
      // Draw message
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Press SPACE to Start', 400, 300);
    }
  };

    const startCountdown = () => {
      setCountdown(3);
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownInterval);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    };

    const handleStartGame = async () => {
      try {
        console.log('handleStartGame called - Starting game flow', {
          walletAddress: address,
          custodialWalletExists: !!wallet,
          startGameExists: !!startGame,
          hasPendingTransactions
        });
        
        const actuallyHasPending = checkAndFixPendingState();
        
        if (actuallyHasPending) {
          setError('Please wait for pending transactions to complete before starting a new game');
          return;
        }
        
        setIsLoading(true);
        setHasStartedMoving(false);
        setError(null);

        if (!address) {
          console.error('No wallet address available');
          setError('Please connect your wallet first');
          setIsLoading(false);
          return;
        }

        const startTxId = `start-${Date.now()}`;
        
        // Add initial pending transaction
        addToQueue({
          id: startTxId,
          type: 'start',
          status: 'pending',
          timestamp: Date.now(),
          data: {
            walletAddress: address.substring(0, 8) + '...' + address.substring(address.length - 6)
          }
        });

        console.log('Calling startGame function...');
        let gameResult: GameStartResult;
        try {
          const result = await startGame() as { gameId: string; hash?: string };
          gameResult = {
            gameId: result.gameId,
            hash: result.hash
          };
          console.log('Game started with transaction hash:', gameResult.hash);
          
          // Update the existing transaction instead of adding a new one
          addToQueue({
            id: startTxId, // Use the same ID to update the existing transaction
            type: 'start',
            status: 'confirmed', // Change status to confirmed
            timestamp: Date.now(),
            hash: gameResult.hash,
            data: {
              walletAddress: address.substring(0, 8) + '...' + address.substring(address.length - 6)
            }
          });

          setGameState(prev => ({
            ...prev,
            isPlaying: true,
            gameId: gameResult.gameId,
            birdPosition: 250,
            showStartMessage: false
          }));
        } catch (startErr) {
          console.error('Start game function failed:', startErr);
          let errorMessage = startErr instanceof Error ? startErr.message : 'Failed to start game';
          
          if (errorMessage.includes('transaction is already in progress')) {
            errorMessage = 'Please wait for the previous transaction to complete before starting a new game.';
          } else if (errorMessage.includes('MetaMask')) {
            errorMessage = 'Please make sure MetaMask is connected and unlocked, then try again.';
          } else if (errorMessage.includes('initialize wallet')) {
            errorMessage = 'Game wallet initialization failed. Please refresh the page and try connecting your wallet again.';
          } else if (errorMessage.includes('Network connection failed')) {
            errorMessage = 'Network connection error. Please check your internet connection and try again.';
          } else if (errorMessage.includes('Wallet not initialized')) {
            errorMessage = 'Your game wallet is not ready. Please try again in a few seconds or refresh the page.';
          }
          
          // Update the existing transaction to failed state
          addToQueue({
            id: startTxId,
            type: 'start',
            status: 'failed',
            timestamp: Date.now(),
            error: errorMessage,
            data: {
              walletAddress: address.substring(0, 8) + '...' + address.substring(address.length - 6)
            }
          });
          
          setError(errorMessage);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.error('Failed to start game:', err);
        setError(err instanceof Error ? err.message : 'Failed to start game');
      } finally {
        setIsLoading(false);
      }
    };

  const handleEndGame = async () => {
    if (!gameState.gameId) {
      console.warn('No game ID found for end game');
      return;
    }

    const finalGameState = {
      ...gameState,
      isPlaying: false,
      isGameOver: true
    };

    setGameState(finalGameState);
    setIsLoading(true);
    setTransactionPending(true);
    setError(null);

    try {
      if (!finalGameState.gameId) {
        throw new Error('No game ID found');
      }

      const gameId = parseInt(finalGameState.gameId);
      
      console.log('Ending game with ID:', gameId, 'and score:', finalGameState.score);
      
      const newTotalGames = totalGamesPlayed + 1;
      setTotalGamesPlayed(newTotalGames);
      localStorage.setItem(TOTAL_GAMES_KEY, newTotalGames.toString());
      
      const result = await endGame(
        gameId,
        finalGameState.score,
        finalGameState.totalJumps,
        finalGameState.jumps
      );

      const endResult: GameEndResult = {
        success: result.success,
        hash: result.hash || undefined,
        localOnly: result.localOnly,
        message: result.message
      };

      console.log('End game result:', endResult);
      
      if (endResult.hash) {
        setTransactionHash(endResult.hash);
      }
      
      if (endResult.localOnly) {
        setError(endResult.message || 'Game saved locally only');
      }
      
      setGameState(finalGameState);

    } catch (err) {
      console.error('End game error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save game data');
      setGameState(finalGameState);
    } finally {
      setIsLoading(false);
      setTransactionPending(false);
    }
  };

    const handleJump = useCallback(() => {
      if (!gameState.isPlaying) return;

      if (!hasStartedMoving) {
        setHasStartedMoving(true);
      }

      setVelocity(JUMP_STRENGTH);

      // Create jump data with score and multiplier
      const jumpData: JumpData = {
        timestamp: Math.floor(Date.now() / 1000),
        scoreAtJump: gameState.score,
        multiplierAtJump: 1
      };

      // Add jump to batch for on-chain recording
      addJumpToBatch(jumpData);

      // Update game state with new jump
      setGameState(prev => ({
        ...prev,
        totalJumps: prev.totalJumps + 1,
        jumps: [...prev.jumps, {
          ...jumpData,
          processed: false,
          batchNumber: Math.floor((prev.totalJumps + 1) / 10) + 1,
          totalBatches: Math.ceil((prev.totalJumps + 2) / 10)
        }]
      }));

      // Add transaction for the jump using the queue directly
      addToQueue({
        id: `jump-${Date.now()}`,
        type: 'jump',
        status: 'confirmed',
        timestamp: Date.now(),
        data: {
          jumps: 1,
          score: gameState.score
        }
      });

    }, [gameState.isPlaying, hasStartedMoving, gameState.totalJumps, gameState.score, addJumpToBatch, addToQueue]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
          e.preventDefault(); // Prevent page scroll
        handleJump();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
    }, [handleJump]);

    // Add this effect to monitor transactions
    useEffect(() => {
      console.log('Current transactions:', transactions);
    }, [transactions]);

    // Update the countdown display
    const CountdownDisplay = ({ countdown }: { countdown: number | null }) => {
  return (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl font-bold text-white mb-4">
              {countdown}
            </div>
            <div className="text-xl text-gray-300">
              Get Ready!
            </div>
            <div className="text-lg text-gray-400 mt-2">
              Press SPACE or CLICK to jump
            </div>
          </div>
        </div>
      );
    };

  // Add auto-initialization for game wallet
  useEffect(() => {
    if (address && !wallet?.address && !walletLoading) {
      console.log('Auto-initializing game wallet...');
      // Update unique users when MetaMask wallet connects
      updateUniqueUsers(address);
      initializeWallet().catch(err => {
        console.error('Failed to auto-initialize wallet:', err);
        setError('Game wallet initialization failed. Please try manually.');
      });
    }
  }, [address, wallet?.address, walletLoading, updateUniqueUsers]);

  // Add a component to display pending transactions
  const PendingTransactions = () => {
    // Get only pending transactions
    const pendingTxs = transactionQueue.filter(tx => tx.status === 'pending');
    
    if (pendingTxs.length === 0) return null;
    
    return (
      <div className="pending-transactions">
        <h3>Pending Transactions</h3>
        <div className="transaction-list">
          {pendingTxs.map(tx => (
            <div key={tx.id} className="transaction-item">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {/* Transaction Type Icon */}
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
                    tx.type === 'jump' ? 'bg-[#6C5DD3]/10' :
                    tx.type === 'start' ? 'bg-green-500/10' :
                    'bg-purple-500/10'
                  }`}>
                    {tx.type === 'jump' ? 
                      <Cloud className="w-3 h-3 text-[#6C5DD3]" /> :
                      tx.type === 'start' ? 
                      <Bird className="w-3 h-3 text-green-400" /> :
                      <Trophy className="w-3 h-3 text-purple-400" />
                    }
                  </div>
                  <div>
                    <span className={`text-sm font-medium ${
                      tx.type === 'jump' ? 'text-[#6C5DD3]' :
                      tx.type === 'start' ? 'text-green-400' :
                      'text-purple-400'
                    }`}>
                      {tx.type === 'jump' ? 'Jump Data' : 
                       tx.type === 'start' ? 'Game Start' : 
                       'Game End'}
                    </span>
                    <div className="text-xs text-gray-500">
                      {new Date(tx.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                {tx.hash && (
                  <a 
                    href={`https://fuse-flash.explorer.quicknode.com/tx/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center justify-between text-xs text-[#6C5DD3] hover:text-[#8F7FF7] transition-colors px-2 py-1 bg-[#1a1a25] rounded-sm"
                  >
                    <span className="flex items-center gap-1">
                      <ChevronRight className="w-3 h-3" />
                      View
                    </span>
                    <span className="font-mono text-white/40 text-[10px]">
                      {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                    </span>
                  </a>
                )}
              </div>
              
              {/* Show transaction details for different types */}
              {tx.type === 'end' && tx.data && (
                <div className="mt-2 text-xs text-gray-400 bg-gray-800/30 p-2 rounded-md">
                  <div className="flex justify-between">
                    <span>Game ID:</span>
                    <span className="text-gray-300">#{tx.data.gameId}</span>
                  </div>
                  {tx.data.finalScore !== undefined && (
                    <div className="flex justify-between">
                      <span>Score:</span>
                      <span className="text-green-400">{tx.data.finalScore}</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Show animated spinner for pending transactions */}
              <div className="w-full mt-2 flex items-center justify-center gap-1 text-xs text-yellow-400">
                <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></div>
                <span>Processing on-chain...</span>
              </div>
            </div>
          ))}
        </div>
        <p className="tx-wait-message">Please wait for these transactions to complete before starting a new game.</p>
      </div>
    );
  };

  // Add an effect to periodically check and fix the pending state issue
  useEffect(() => {
    const intervalId = setInterval(() => {
      checkAndFixPendingState();
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(intervalId);
  }, [checkAndFixPendingState]);

  // Add effect to load and initialize total games counter
  useEffect(() => {
    try {
      const savedTotalGames = localStorage.getItem(TOTAL_GAMES_KEY);
      if (savedTotalGames) {
        setTotalGamesPlayed(parseInt(savedTotalGames, 10));
      } else {
        // Initialize with 0 if not found
        localStorage.setItem(TOTAL_GAMES_KEY, '0');
      }
    } catch (e) {
      console.error('Failed to load total games count:', e);
    }
  }, []);

  // Add effect to check if tutorial has been shown before
  useEffect(() => {
    try {
      const tutorialShown = localStorage.getItem(TUTORIAL_SHOWN_KEY);
      if (!tutorialShown) {
        // Tutorial hasn't been shown yet
        setShowTutorial(true);
      }
    } catch (e) {
      console.error('Failed to check tutorial status:', e);
    }
  }, []);

  const handleCloseTutorial = () => {
    setShowTutorial(false);
    // Save in localStorage that the tutorial has been shown
    localStorage.setItem(TUTORIAL_SHOWN_KEY, 'true');
  };

  // Game Over screen with enhanced error handling
  const GameOverScreen = () => {
    return (
      <div className="absolute inset-0 bg-[#1A1A2E]/95 backdrop-blur-sm flex flex-col items-center justify-center px-4">
        <div className="bg-[#212136] rounded-xl shadow-xl w-full max-w-md overflow-hidden">
          <div className="px-6 py-8">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-white mb-1">Game Over</h2>
              <p className="text-gray-400">Better luck next time!</p>
            </div>
            
            {error && (
              <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <p className="text-red-400 text-sm">{error}</p>
                {error.includes('insufficient funds') && (
                  <div className="mt-3 flex flex-col gap-2">
                    <p className="text-gray-400 text-xs">Need FUSE tokens?</p>
                    <a 
                      href="https://faucet.quicknode.com/fuse/flash" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm px-3 py-2 bg-green-500/20 text-green-400 rounded-md flex items-center justify-center gap-2 hover:bg-green-500/30 transition-colors"
                    >
                      Get FUSE from Faucet
                    </a>
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-4">
              <div className="bg-[#2A2A46] rounded-lg p-4 flex items-center justify-between">
                <div className="text-gray-400">Final Score</div>
                <div className="text-2xl font-bold text-white">{gameState.score}</div>
              </div>
              
              <div className="bg-[#2A2A46] rounded-lg p-4 flex items-center justify-between">
                <div className="text-gray-400">Total Jumps</div>
                <div className="text-xl font-bold text-[#6C5DD3]">{gameState.totalJumps}</div>
              </div>
              
              {gameState.gameId && (
                <div className="bg-[#2A2A46] rounded-lg p-4 flex items-center justify-between">
                  <div className="text-gray-400">Game ID</div>
                  <div className="text-sm font-mono text-white">{gameState.gameId}</div>
                </div>
              )}
              
              {transactionPending && (
                <div className="mt-4 bg-[#2A2A46] rounded-lg p-4">
                  <div className="flex items-center justify-center mb-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#6C5DD3]"></div>
                    <span className="ml-2 text-gray-300">Saving your score on-chain...</span>
                  </div>
                  <p className="text-center text-xs text-gray-500">This may take a few moments</p>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={resetGame}
                disabled={transactionPending}
                className="w-full py-3 px-4 bg-[#6C5DD3] hover:bg-[#8F7FF7] disabled:bg-gray-700 disabled:text-gray-400 text-white font-medium rounded-lg transition-colors"
              >
                Play Again
              </button>
              
              <button
                onClick={() => setShowLeaderboard(true)}
                className="py-3 px-4 bg-[#2A2A46] hover:bg-[#3A3A56] text-white font-medium rounded-lg transition-colors"
              >
                Leaderboard
              </button>
            </div>
          </div>
          
          {/* Transaction Info Section */}
          {gameState.gameId && (
            <div className="border-t border-[#3A3A56] px-6 py-4 bg-[#1A1A2E]">
              <div className="text-sm text-gray-400 mb-2 flex items-center justify-between">
                <span>Game Transaction</span>
                {transactionHash && (
                  <a 
                    href={`https://fuse-flash.explorer.quicknode.com/tx/${transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#6C5DD3] hover:text-[#8F7FF7]"
                  >
                    View on Explorer
                  </a>
                )}
              </div>
              
              <div className="text-xs text-gray-500">
                {transactionHash ? (
                  <span className="font-mono break-all">{transactionHash}</span>
                ) : transactionPending ? (
                  <span>Transaction pending...</span>
                ) : error ? (
                  <span className="text-red-400">Transaction failed</span>
                ) : (
                  <span>No transaction hash available</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const resetGame = async () => {
    console.log('Resetting game');
    setGameState(INITIAL_STATE);
    setVelocity(0);
    setHasStartedMoving(false);
    setError(null);
    setTransactionHash(null);
    await handleStartGame();
  };

  const toggleTutorial = () => {
    setShowTutorial(prev => !prev);
  };

  const NetworkInfo = () => (
    <div className="fixed bottom-4 left-4 bg-[#1A1A2E] p-4 rounded-lg shadow-lg border border-[#6C5DD3]/30 max-w-xs z-50">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></div>
        </div>
        <div>
          <h3 className="text-white font-medium mb-1">Fuse Flash Network</h3>
          <p className="text-gray-400 text-sm mb-3">Play on a lightning-fast L2 blockchain with near-instant transactions</p>
          
          <div className="space-y-2">
            <a 
              href="https://faucet.quicknode.com/fuse/flash" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-xs px-3 py-2 bg-green-500/20 text-green-400 rounded-md text-center hover:bg-green-500/30 transition-colors"
            >
              Get Free FUSE Tokens
            </a>
            
            <a 
              href="https://fuse-flash.bridge.quicknode.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-xs px-3 py-2 bg-blue-500/20 text-blue-400 rounded-md text-center hover:bg-blue-500/30 transition-colors"
            >
              Bridge to Fuse Flash
            </a>
            
            <a 
              href="https://docs.fuse.io/fuse-box/fuse-flash" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-xs px-3 py-2 bg-[#6C5DD3]/20 text-[#6C5DD3] rounded-md text-center hover:bg-[#6C5DD3]/30 transition-colors"
            >
              Learn About Fuse Flash
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  // Game component return
  return (
    <div className="relative min-h-screen bg-[#1e1e2f] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="w-full px-6 py-4 border-b border-white/5">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00D13F] to-[#4ADE80] bg-clip-text text-transparent">
              Flappy Fuse
            </h1>
            <div className="ml-2 bg-[#00D13F]/10 text-[#00D13F] text-xs px-2 py-0.5 rounded-sm">
              Beta
            </div>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => setShowNetworkInfo(prev => !prev)}
              className="flex items-center gap-1 px-3 py-1.5 text-white/70 hover:text-white transition-colors text-sm"
            >
              <Info className="w-4 h-4" />
              Network Info
            </button>

            <button 
              onClick={() => setShowLeaderboard(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-white/70 hover:text-white transition-colors text-sm"
            >
              <Trophy className="w-4 h-4" />
              Leaderboard
            </button>
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 flex flex-col md:flex-row w-full max-w-full mx-auto px-6 py-6 gap-6">
        {/* Main Content Area */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Side - Stats & Wallet Section */}
          <div className="md:col-span-3 space-y-5">
            {/* Game Stats */}
            <div className="bg-[#252538] rounded-md p-4 shadow-sm h-auto">
              <h2 className="text-base font-medium text-white mb-3 flex items-center gap-2">
                <Bird className="w-4 h-4 text-[#00D13F]" />
                Game Stats
              </h2>
              
              <div className="space-y-3">
                <div className="bg-[#1e1e2f] rounded-md p-3 border border-white/5 flex justify-between items-center">
                  <div className="text-xs text-white/50">Total Games</div>
                  <div className="text-base font-semibold bg-gradient-to-r from-[#00D13F] to-[#4ADE80] bg-clip-text text-transparent">{totalGamesPlayed}</div>
                </div>
                
                <div className="bg-[#1e1e2f] rounded-md p-3 border border-white/5 flex justify-between items-center">
                  <div className="text-xs text-white/50">Unique Players</div>
                  <div className="text-base font-semibold text-[#6C5DD3]">{uniqueUsers}</div>
                </div>
              </div>
            </div>

            {/* Wallet Section */}
            <div className="bg-[#252538] rounded-md p-4 border border-white/5 h-auto">
              <h2 className="text-base font-medium text-white mb-3">Wallet</h2>
              
              {wallet?.address ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-[#1e1e2f] rounded-md p-3 border border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-green-400 text-xs">Connected</span>
                    </div>
                    <button
                      onClick={resetGameStateAndReconnect}
                      className="text-xs text-white/40 hover:text-white"
                    >
                      Reset
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center bg-[#1e1e2f] rounded-md p-3 border border-white/5">
                    <div className="text-xs text-white/50">Address:</div>
                    <div className="text-xs text-white font-mono">
                      {address ? address.slice(0, 6) + '...' + address.slice(-4) : 'Not connected'}
                    </div>
                  </div>
                  
                  <button
                    onClick={handleStartGame}
                    disabled={isLoading || hasPendingTransactions || gameState.isPlaying}
                    className="w-full py-2 px-3 bg-[#4ADE80] hover:bg-[#3AC070] disabled:bg-white/10 disabled:text-white/30 text-white font-medium rounded-md transition-colors text-sm"
                  >
                    {isLoading ? 'Starting...' : 'Start New Game'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 bg-[#1e1e2f] rounded-md p-3 border border-white/5">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                    <span className="text-yellow-400 text-xs">Not Connected</span>
                  </div>
                  
                  <button
                    onClick={connectWallet}
                    disabled={isLoading}
                    className="w-full py-2 px-3 bg-[#4ADE80] hover:bg-[#3AC070] disabled:bg-white/10 text-white font-medium rounded-md transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>Connect Wallet</>
                    )}
                  </button>
                </div>
              )}
              
              {/* Game Stats */}
              {hasPendingTransactions && (
                <div className="mt-3 bg-yellow-500/10 text-yellow-400 text-xs p-2 rounded-sm">
                  You have pending transactions
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="bg-[#252538] rounded-md p-4 shadow-sm">
              <h2 className="text-base font-medium text-white mb-3 flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-[#6C5DD3]" />
                Recent Activity
              </h2>
              
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#1e1e2f] scrollbar-track-transparent">
                {transactionQueue
                  .slice()
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .slice(0, 5)
                  .map((tx) => (
                  <div 
                    key={tx.id} 
                    className="bg-[#1e1e2f] rounded-md p-3 border border-white/5 hover:border-[#6C5DD3]/20 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
                          tx.type === 'jump' ? 'bg-[#6C5DD3]/10' :
                          tx.type === 'start' ? 'bg-green-500/10' :
                          'bg-purple-500/10'
                        }`}>
                          {tx.type === 'jump' ? 
                            <Cloud className="w-3 h-3 text-[#6C5DD3]" /> :
                            tx.type === 'start' ? 
                            <Bird className="w-3 h-3 text-green-400" /> :
                            <Trophy className="w-3 h-3 text-purple-400" />
                          }
                        </div>
                        <div>
                          <span className={`text-xs font-medium ${
                            tx.type === 'jump' ? 'text-[#6C5DD3]' :
                            tx.type === 'start' ? 'text-green-400' :
                            'text-purple-400'
                          }`}>
                            {tx.type === 'jump' ? 'Jump' : 
                            tx.type === 'start' ? 'Start' : 
                            'End'}
                          </span>
                          <div className="text-xs text-white/40">
                            {new Date(tx.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-sm text-xs font-medium ${
                        tx.status === 'confirmed' ? 'bg-green-500/10 text-green-400' : 
                        tx.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' : 
                        'bg-red-500/10 text-red-400'
                      }`}>
                        {tx.status === 'confirmed' ? 'Confirmed' : 
                        tx.status === 'pending' ? 'Pending' : 
                        'Failed'}
                      </span>
                    </div>
                    
                    {tx.hash && (
                      <a 
                        href={`https://fuse-flash.explorer.quicknode.com/tx/${tx.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex items-center justify-between text-xs text-[#6C5DD3] hover:text-[#8F7FF7] transition-colors px-2 py-1 bg-[#1a1a25] rounded-sm"
                      >
                        <span className="flex items-center gap-1">
                          <ChevronRight className="w-3 h-3" />
                          View
                        </span>
                        <span className="font-mono text-white/40 text-[10px]">
                          {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                        </span>
                      </a>
                    )}
                    
                    {tx.type === 'end' && tx.data && (
                      <div className="mt-2 pt-2 border-t border-white/5 text-xs text-white/40">
                        {tx.data.gameId && (
                          <div className="flex justify-between">
                            <span>Game ID:</span>
                            <span className="text-white/70">#{tx.data.gameId}</span>
                          </div>
                        )}
                        {tx.data.finalScore !== undefined && (
                          <div className="flex justify-between">
                            <span>Score:</span>
                            <span className="text-green-400">{tx.data.finalScore}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                
                {transactionQueue.length === 0 && (
                  <div className="text-center py-4 text-white/40 text-sm">
                    No transactions yet
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Middle - Game Canvas Section */}
          <div className="md:col-span-6 flex flex-col justify-center">
            <div className="relative w-full h-full flex flex-col">
              {/* Main Game Canvas */}
              <div 
                ref={gameContainerRef} 
                onClick={handleJump} 
                className="relative w-full aspect-[4/3] bg-[#1a1a25] rounded-md overflow-hidden border border-white/5 shadow-sm flex-grow mx-auto"
                style={{ maxWidth: '100%', maxHeight: '100%' }}
              >
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={600}
                  className="w-full h-full object-contain"
                />

                {/* Game Specific Overlays */}
                {!gameState.isPlaying && !gameState.totalJumps && !isLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a25]/95">
                    <div className="text-center space-y-4 max-w-md">
                      <div>
                        <h2 className="text-3xl font-bold bg-gradient-to-r from-[#00D13F] to-[#4ADE80] bg-clip-text text-transparent mb-2">
                          Flappy Fuse
                        </h2>
                        <p className="text-white/50">The blockchain-powered bird game</p>
                      </div>

                      <div className="space-y-1 text-center">
                        <p className="text-white/70">Press <span className="text-white font-mono bg-[#252538] px-2 py-1 rounded-sm">SPACE</span> or <span className="text-white font-mono bg-[#252538] px-2 py-1 rounded-sm">CLICK</span> to jump</p>
                        <p className="text-white/40 text-sm">Avoid pipes and collect points!</p>
                      </div>

                      <button
                        onClick={handleStartGame}
                        disabled={isLoading}
                        className="bg-gradient-to-r from-[#00D13F] to-[#4ADE80] text-white font-medium py-2 px-6 rounded-md flex items-center gap-2 mx-auto hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center mt-4"
                      >
                        {isLoading ? 'Connecting...' : 'Start Game'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Countdown */}
                {countdown !== null && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="text-9xl font-bold text-white">{countdown}</div>
                  </div>
                )}

                {/* Game Over */}
                {!gameState.isPlaying && gameState.totalJumps > 0 && <GameOverScreen />}

                {/* Loading */}
                {isLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a25]/90">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                    <p className="mt-4 text-white/70">Connecting to blockchain...</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right - Leaderboard Section */}
          <div className="md:col-span-3 space-y-5">
            {/* Leaderboard Section */}
            <div className="bg-[#252538] rounded-md p-4 border border-white/5 h-full">
              <h2 className="text-base font-medium text-white mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#6C5DD3]" />
                Leaderboard
              </h2>
              <div className="max-h-[550px] overflow-y-auto">
                <Leaderboard onPlayerClick={(address) => console.log('Clicked player:', address)} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tutorial Overlay */}
      {showTutorial && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1e1e2f] rounded-md shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-medium text-white">How to Play</h3>
              <button 
                onClick={toggleTutorial} 
                className="text-white/40 hover:text-white"
              >
                &times;
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-[#252538] rounded-md p-4 border border-white/5">
                <h4 className="font-medium text-white mb-2">Game Controls</h4>
                <ul className="space-y-2 text-white/70">
                  <li className="flex items-center gap-2">
                    <span className="bg-[#1a1a25] px-2 py-1 rounded-sm text-xs font-mono">SPACE</span>
                    <span>or</span>
                    <span className="bg-[#1a1a25] px-2 py-1 rounded-sm text-xs font-mono">CLICK</span>
                    <span>to make the bird jump</span>
                  </li>
                  <li>Avoid hitting pipes or the ground</li>
                  <li>Each pipe passed = 1 point</li>
                </ul>
              </div>
              
              <div className="bg-[#252538] rounded-md p-4 border border-white/5">
                <h4 className="font-medium text-white mb-2">Blockchain Features</h4>
                <ul className="space-y-1 text-sm text-white/70">
                  <li>• Your scores are recorded on Fuse Flash Network</li>
                  <li>• Each game is a verifiable transaction</li>
                  <li>• Compete on the global leaderboard</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-6 text-center space-y-2">
              <p className="text-sm text-white/50">
                Powered by{' '}
                <a 
                  href="https://www.fuse.io" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-medium bg-gradient-to-r from-[#00D13F] to-[#4ADE80] bg-clip-text text-transparent hover:opacity-80 transition-opacity"
                >
                  Fuse Network
                </a>
              </p>
              <div className="text-xs text-white/30">
                Built with ❤️ on <a 
                  href="https://docs.fuse.io/fuse-box/fuse-flash" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#6C5DD3] hover:text-[#8F7FF7]"
                >
                  Fuse Flash Network
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Overlay */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1e1e2f] rounded-md shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-medium text-white">Leaderboard</h3>
              <button 
                onClick={() => setShowLeaderboard(false)} 
                className="text-white/40 hover:text-white"
              >
                &times;
              </button>
            </div>
            
            <Leaderboard onPlayerClick={(address) => console.log('Clicked player:', address)} />
            
            {/* Powered by Section */}
            <div className="text-center space-y-2 py-4 border-t border-white/5 mt-4">
              <p className="text-sm text-white/50">
                Powered by{' '}
                <a 
                  href="https://www.fuse.io" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-medium bg-gradient-to-r from-[#00D13F] to-[#4ADE80] bg-clip-text text-transparent hover:opacity-80 transition-opacity"
                >
                  Fuse Network
                </a>
              </p>
              <div className="text-xs text-white/30">
                Built with ❤️ on <a 
                  href="https://docs.fuse.io/fuse-box/fuse-flash" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#6C5DD3] hover:text-[#8F7FF7]"
                >
                  Fuse Flash Network
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Network Info */}
      {showNetworkInfo && (
        <div className="fixed bottom-4 left-4 bg-[#1e1e2f] p-4 rounded-md shadow-lg border border-white/5 max-w-xs z-50">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-1">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            </div>
            <div>
              <h3 className="text-white font-medium mb-1">Fuse Flash Network</h3>
              <p className="text-white/50 text-sm mb-3">Play on a lightning-fast L2 blockchain with near-instant transactions</p>
              
              <div className="space-y-2">
                <a 
                  href="https://faucet.quicknode.com/fuse/flash" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block text-xs px-3 py-2 bg-[#252538] text-green-400 rounded-sm text-center hover:bg-[#2a2a42] transition-colors"
                >
                  Get Free FUSE Tokens
                </a>
                
                <a 
                  href="https://fuse-flash.bridge.quicknode.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block text-xs px-3 py-2 bg-[#252538] text-blue-400 rounded-sm text-center hover:bg-[#2a2a42] transition-colors"
                >
                  Bridge to Fuse Flash
                </a>
                
                <a 
                  href="https://docs.fuse.io/fuse-box/fuse-flash" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block text-xs px-3 py-2 bg-[#252538] text-[#6C5DD3] rounded-sm text-center hover:bg-[#2a2a42] transition-colors"
                >
                  Learn About Fuse Flash
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}