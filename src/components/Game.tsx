import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Bird, Cloud, Settings, ChevronRight, Trophy, Coins } from 'lucide-react';
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
}

const INITIAL_STATE: GameState = {
  isPlaying: false,
  birdPosition: 250,
  pipePositions: [],
  gameSpeed: 1.5,
  totalJumps: 0,
  jumps: [],
  score: 0,
};

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

export function Game() {
  // Move all refs and state declarations outside the try block
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number>();
  
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [velocity, setVelocity] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [transactionPending, setTransactionPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [hasStartedMoving, setHasStartedMoving] = useState(false);

  const { address, startGame, endGame, connectWallet, error: contractError, resetGameStateAndReconnect } = useFlappyContract();
  const { 
    addJumpToBatch, 
    transactions, 
    wallet, 
    isLoading: walletLoading,
    initializeWallet,
    addTransaction,
    resetGameState,
    handleEndGame: custodialHandleEndGame,
    pendingJumps,
    uniqueUsers,
    updateUniqueUsers,
    hasPendingTransactions
  } = useCustodialWallet();

  // Get transaction queue directly to show pending transactions
  const { queue: transactionQueue, addToQueue, clearQueue, forceSave } = useTransactionQueue();

  useEffect(() => {
      console.log('Canvas ref:', canvasRef.current);
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

      // Initial render to verify canvas is working
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(0, 0, 800, 600);
      console.log('Initial canvas render complete');

      if (!gameState.isPlaying) return;

    const gameLoop = () => {
        try {
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
          // Bird's x position is fixed at 100
          // If pipe just passed the bird's position, increment score
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
          y: -10, // Extend slightly above screen
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

      // Draw game
      drawGame(ctx);

          // Schedule next frame
      gameLoopRef.current = requestAnimationFrame(gameLoop);
        } catch (error) {
          console.error('Game loop error:', error);
          // Reset game state on error
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
        
        // Check for pending transactions first
        if (hasPendingTransactions) {
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

        // Create a unique ID for this start game transaction
        const startTxId = `start-${Date.now()}`;
        
        // Add start game transaction to the queue as pending
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
        let gameResult;
        try {
          gameResult = await startGame();
          console.log('Game started with ID:', gameResult.gameId);
          
          // Update the start transaction to confirmed with game ID
          addToQueue({
            id: startTxId,
            type: 'start',
            status: 'confirmed',
            timestamp: Date.now(),
            data: {
              gameId: gameResult.gameId.toString(),
              walletAddress: address.substring(0, 8) + '...' + address.substring(address.length - 6)
            }
          });
        } catch (startErr) {
          console.error('Start game function failed:', startErr);
          // Add more user-friendly error messages
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
          
          // Update the transaction as failed
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

        // Then do the countdown
        setCountdown(3);
        for (let i = 2; i >= 1; i--) {
          await new Promise(resolve => setTimeout(resolve, 800));
          setCountdown(i);
        }
        await new Promise(resolve => setTimeout(resolve, 800));
        setCountdown(null);

        // Start game immediately after countdown
        setGameState({
          ...INITIAL_STATE,
          isPlaying: true,
          gameId: gameResult.gameId.toString(),
          birdPosition: 250,
        });
      } catch (err) {
        console.error('Failed to start game:', err);
        setError(err instanceof Error ? err.message : 'Failed to start game');
      } finally {
        setIsLoading(false);
      }
    };

  const handleEndGame = async () => {
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = undefined;
    }

    // Keep the final game state
    const finalGameState = {
      ...gameState,
      isPlaying: false
    };

    setGameState(finalGameState);
    setIsLoading(true);
    setTransactionPending(true);
    setError(null);

    try {
      if (!finalGameState.gameId) {
        throw new Error('No game ID found');
      }

      // Generate a transaction ID for this end game event
      const gameId = parseInt(finalGameState.gameId);
      const endTxId = `end-${gameId}-${Date.now()}`;
      
      // Add an initial end game transaction to the queue
      addToQueue({
        id: endTxId,
        type: 'end',
        status: 'pending',
        timestamp: Date.now(),
        data: {
          gameId,
          finalScore: finalGameState.score,
          totalJumps: finalGameState.totalJumps
        }
      });

      console.log('End game transaction created:', endTxId);

      // Call the custodial wallet's handleEndGame function
      const receipt = await custodialHandleEndGame(
        gameId,
        finalGameState.score
      );

      // Update the transaction with hash if we got a receipt
      if (receipt && receipt.hash) {
        console.log('End game transaction confirmed with hash:', receipt.hash);
        
        // Use addToQueue instead of updateTransaction for consistency
        addToQueue({
          id: endTxId,
          type: 'end',
          status: 'confirmed',
          timestamp: Date.now(),
          hash: receipt.hash,
          data: {
            gameId,
            finalScore: finalGameState.score,
            totalJumps: finalGameState.totalJumps
          }
        });
        
        // Force save the queue to ensure it's stored in localStorage
        forceSave();
      }

      // Set the final game state
      setGameState(finalGameState);

    } catch (err) {
      console.error('End game error:', err);
      
      const gameId = finalGameState.gameId ? parseInt(finalGameState.gameId) : 0;
      const endTxId = `end-${gameId}-${Date.now()}`;
      
      // Mark the transaction as failed
      addToQueue({
        id: endTxId,
        type: 'end',
        status: 'failed',
        timestamp: Date.now(),
        error: err instanceof Error ? err.message : 'Unknown error',
        data: {
          gameId,
          finalScore: finalGameState.score,
          totalJumps: finalGameState.totalJumps
        }
      });
      
      setError(err instanceof Error ? err.message : 'Failed to save game data');
      
      // Still end the game even if save failed
      setGameState(finalGameState);
    } finally {
      setIsLoading(false);
      setTransactionPending(false);
      
      // Force save one more time to ensure all data is persisted
      forceSave();
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
                    href={`https://explorer.fuse.io/tx/${tx.hash}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="tx-link"
                  >
                    View
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
              
              {/* Show transaction hash in pending state */}
              {tx.hash && (
                <div className="mt-2 text-xs text-gray-400 bg-gray-800/30 p-2 rounded-md overflow-hidden font-mono">
                  <div className="truncate">
                    <span className="text-gray-500">Tx: </span>
                    <span>{tx.hash.slice(0, 8)}...{tx.hash.slice(-6)}</span>
                  </div>
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

  // Return the JSX directly without try/catch wrapping the return
  return (
    <div className="relative min-h-screen bg-[#1a1a2e] text-white flex overflow-hidden">
      {/* Left side - How it works */}
      <div className="w-96 p-6 bg-[#16162a]/50 backdrop-blur-sm border-r border-[#6C5DD3]/20 overflow-y-auto max-h-screen scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#6C5DD3]/10 hover:scrollbar-thumb-[#6C5DD3]/20">
        <div className="sticky top-6 space-y-8">
          <div className="flex items-center gap-3 mb-8">
            <Bird className="w-8 h-8 text-[#00D13F]" />
            <h2 className="text-2xl font-bold bg-gradient-to-r from-[#00D13F] to-[#4ADE80] bg-clip-text text-transparent">
              Flappy Fuse
            </h2>
          </div>

          {/* How to Play Section - Simplified */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <div className="w-1 h-6 bg-[#00D13F] rounded-full" />
              How to Play
            </h3>
            <div className="bg-[#1a1a2e]/50 rounded-xl p-4 border border-[#6C5DD3]/20 shadow-xl">
              <div className="flex items-center gap-3 text-gray-300">
                <kbd className="px-3 py-1.5 bg-[#16162a] rounded-lg text-sm font-mono border border-gray-700">SPACE</kbd>
                <span>or</span>
                <kbd className="px-3 py-1.5 bg-[#16162a] rounded-lg text-sm font-mono border border-gray-700">CLICK</kbd>
                <span>to jump</span>
              </div>
            </div>
          </div>

          {/* Leaderboard Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <div className="w-1 h-6 bg-yellow-400 rounded-full" />
              Leaderboard
            </h3>
            <div className="bg-[#1a1a2e]/50 rounded-xl p-4 border border-[#6C5DD3]/20 shadow-xl">
              <Leaderboard />
            </div>
          </div>
        </div>
      </div>

      {/* Center - Game Canvas */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen py-8 relative">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="bg-gradient-to-b from-[#1a1a2e] to-[#16162a] rounded-2xl shadow-2xl border border-[#6C5DD3]/20 backdrop-blur-sm"
            onClick={handleJump}
          />

          {/* Countdown Overlay */}
          {countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm rounded-2xl z-50">
              <div className="text-center space-y-4">
                <div className="text-8xl font-bold bg-gradient-to-r from-sky-400 to-purple-400 bg-clip-text text-transparent animate-pulse">
                  {countdown}
                </div>
                <div className="text-xl text-gray-400 font-medium">
                  Get Ready to Jump!
                </div>
              </div>
            </div>
          )}

          {/* Start Game Overlay */}
          {!gameState.isPlaying && !gameState.totalJumps && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm rounded-2xl">
              <div className="text-center space-y-6 max-w-md px-8">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Bird className="w-12 h-12 text-purple-400" />
                  <h2 className="text-5xl font-bold bg-gradient-to-r from-sky-400 to-purple-400 bg-clip-text text-transparent">
                    Flappy Fuse
                  </h2>
                </div>
                
                <div className="space-y-2">
                  <p className="text-gray-400 text-lg">
                    Every jump is recorded on-chain
                  </p>
                  <p className="text-sm text-gray-500">
                    Powered by Fuse Ember Network
                  </p>
                </div>

                {!address && (
                  <div className="text-sm text-gray-400 space-y-3">
                    <p>👋 Connect your wallet to play!</p>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => {
                          // Clear any previous error
                          setError(null);
                          try {
                            // Call the connect function and handle errors
                            connectWallet().catch(err => {
                              console.error('Connection error:', err);
                              setError(err.message || 'Failed to connect wallet');
                            });
                          } catch (err) {
                            console.error('Connection error:', err);
                            setError(err instanceof Error ? err.message : 'Failed to connect wallet');
                          }
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg flex items-center space-x-2 transition-colors"
                      >
                        <Settings className="w-6 h-6" />
                        <span>{contractError && contractError.includes('Connecting') ? 'Connecting...' : 'Connect Wallet'}</span>
                      </button>
                      <a 
                        href="https://fuse-flash.quicknode.com/faucet" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                      >
                        <Coins className="w-5 h-5" />
                        <span>Get FUSE Tokens</span>
                      </a>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Need FUSE tokens?{' '}
                      <a 
                        href="https://faucet.quicknode.com/fuse/flash" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[#6C5DD3] hover:text-[#8F7FF7] underline"
                      >
                        Get them from the faucet
                      </a>
                    </div>
                    
                    {/* Add Reset button below the wallet display */}
                    <div className="mt-3">
                      <button
                        onClick={() => {
                          // Clear any game state and force reconnection
                          resetGameState();
                          window.location.reload();
                        }}
                        className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        Reset Connection
                      </button>
                    </div>
                  </div>
                )}

                {address && (
                  <div className="text-sm text-white space-y-3">
                    <div className="bg-[#2A2A3A] rounded-lg p-3 mb-2">
                      <div className="text-gray-400 text-xs mb-1">Your Address:</div>
                      <div className="text-[#6C5DD3] text-sm font-mono overflow-hidden text-ellipsis">
                        {`${address.substring(0, 8)}...${address.substring(address.length - 6)}`}
                      </div>
                    </div>
                    
                    <button
                      onClick={handleStartGame}
                      disabled={isLoading || transactionPending}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 hover:from-green-600 hover:to-emerald-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      <Bird className="w-5 h-5" />
                      {transactionPending ? 'Confirming...' : 
                       isLoading ? 'Starting...' : 'Start Game'}
                    </button>
                    
                    {error && (
                      <div className="mt-2 p-3 bg-red-900/20 rounded-lg border border-red-500/20 text-red-400 text-xs">
                        {error}
                      </div>
                    )}
                  </div>
                )}

                {/* Game Instructions */}
                {gameState.isPlaying && !countdown && (
                  <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg text-gray-300 text-sm">
                    <div className="flex items-center gap-2">
                      <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">SPACE</kbd>
                      <span>or</span>
                      <span>CLICK</span>
                      <span>to jump</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Game Over Overlay */}
          {!gameState.isPlaying && gameState.totalJumps > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm rounded-2xl">
              <div className="text-center space-y-6 p-8 bg-gray-900/50 rounded-2xl border border-green-500/20 max-w-md mx-auto transform scale-90">
                <div>
                  <h2 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent mb-2">
                    Game Over!
                  </h2>
                  <p className="text-gray-400">Your jumps are being recorded on-chain</p>
                </div>

                {/* Game Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-900/80 p-4 rounded-xl border border-green-500/20">
                    <p className="text-sm text-gray-400 mb-1">Final Score</p>
                    <p className="text-3xl font-bold text-green-400">{gameState.score}</p>
                  </div>
                  <div className="bg-gray-900/80 p-4 rounded-xl border border-emerald-500/20">
                    <p className="text-sm text-gray-400 mb-1">Total Jumps</p>
                    <p className="text-3xl font-bold text-emerald-400">{gameState.totalJumps}</p>
                  </div>
                  <div className="col-span-2 bg-gray-900/80 p-4 rounded-xl border border-purple-500/20">
                    <p className="text-sm text-gray-400 mb-1">Game ID</p>
                    <p className="text-2xl font-bold text-purple-400">#{gameState.gameId || '-'}</p>
                  </div>
                </div>

                {/* Transaction Progress */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Processing Status</span>
                    {transactionPending ? (
                      <span className="text-yellow-400 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                        Processing...
                      </span>
                    ) : (
                      <span className="text-green-400 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-current" />
                        Complete
                      </span>
                    )}
                  </div>
                </div>

                {/* Play Again Button */}
                <button
                  onClick={handleStartGame}
                  disabled={isLoading || transactionPending}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 mx-auto hover:from-green-600 hover:to-emerald-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
                >
                  <Bird className="w-5 h-5" />
                  {transactionPending ? 'Finishing Up...' : 
                   isLoading ? 'Starting...' : 'Play Again'}
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Powered by Fuse */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-gray-400">
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
          <div className="text-xs text-gray-500">
            Built with ❤️ on Fuse Ember Network
          </div>
        </div>
      </div>

      {/* Right - Wallet & Transactions */}
      <div className="w-96 p-6 bg-[#16162a]/50 backdrop-blur-sm border-l border-[#6C5DD3]/20 overflow-y-auto max-h-screen scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#6C5DD3]/10 hover:scrollbar-thumb-[#6C5DD3]/20">
        <div className="sticky top-6 space-y-8">
          <div className="space-y-6">
            {/* Wallet Status Section */}
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <div className="w-1 h-6 bg-[#00D13F] rounded-full" />
                Wallet Status
              </h3>
              
              <div className="bg-[#1a1a2e]/50 rounded-xl p-4 border border-[#6C5DD3]/20 space-y-4">
                {/* Add Unique Users Counter */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Unique Players</span>
                  <span className="text-xl font-bold bg-gradient-to-r from-[#00D13F] to-[#4ADE80] bg-clip-text text-transparent">
                    {uniqueUsers}
                  </span>
                </div>

                {/* Wallet Connection Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Wallet</span>
                  <span className={`font-medium ${address ? 'text-green-400' : 'text-gray-500'}`}>
                    {address ? 'Connected' : 'Not Connected'}
                  </span>
                </div>

                {/* Existing wallet status content */}
                {!address && (
                  <div className="text-sm text-gray-400 space-y-3">
                    <p>👋 Connect your wallet to play!</p>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => {
                          // Clear any previous error
                          setError(null);
                          try {
                            // Call the connect function and handle errors
                            connectWallet().catch(err => {
                              console.error('Connection error:', err);
                              setError(err.message || 'Failed to connect wallet');
                            });
                          } catch (err) {
                            console.error('Connection error:', err);
                            setError(err instanceof Error ? err.message : 'Failed to connect wallet');
                          }
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg flex items-center space-x-2 transition-colors"
                      >
                        <Settings className="w-6 h-6" />
                        <span>{contractError && contractError.includes('Connecting') ? 'Connecting...' : 'Connect Wallet'}</span>
                      </button>
                      <a 
                        href="https://fuse-flash.quicknode.com/faucet" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                      >
                        <Coins className="w-5 h-5" />
                        <span>Get FUSE Tokens</span>
                      </a>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Need FUSE tokens?{' '}
                      <a 
                        href="https://faucet.quicknode.com/fuse/flash" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[#6C5DD3] hover:text-[#8F7FF7] underline"
                      >
                        Get them from the faucet
                      </a>
                    </div>
                    
                    {/* Add Reset button below the wallet display */}
                    <div className="mt-3">
                      <button
                        onClick={() => {
                          // Clear any game state and force reconnection
                          resetGameState();
                          window.location.reload();
                        }}
                        className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        Reset Connection
                      </button>
                    </div>
                  </div>
                )}

                {address && (
                  <div className="text-sm text-white space-y-3">
                    <div className="bg-[#2A2A3A] rounded-lg p-3 mb-2">
                      <div className="text-gray-400 text-xs mb-1">Your Address:</div>
                      <div className="text-[#6C5DD3] text-sm font-mono overflow-hidden text-ellipsis">
                        {`${address.substring(0, 8)}...${address.substring(address.length - 6)}`}
                      </div>
                    </div>
                    
                    <button
                      onClick={handleStartGame}
                      disabled={isLoading || transactionPending}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 hover:from-green-600 hover:to-emerald-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      <Bird className="w-5 h-5" />
                      {transactionPending ? 'Confirming...' : 
                       isLoading ? 'Starting...' : 'Start Game'}
                    </button>
                    
                    {error && (
                      <div className="mt-2 p-3 bg-red-900/20 rounded-lg border border-red-500/20 text-red-400 text-xs">
                        {error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <div className="w-1 h-6 bg-[#00D13F] rounded-full" />
                Recent Activity
                <div className="ml-auto flex gap-2">
                  <button 
                    onClick={() => {
                      console.log('Forcing transaction queue save');
                      forceSave();
                    }}
                    className="text-xs text-blue-400 bg-blue-400/10 px-2 py-1 rounded hover:bg-blue-400/20"
                  >
                    Save
                  </button>
                  <button 
                    onClick={() => {
                      console.log('Clearing transaction queue for debugging');
                      clearQueue();
                    }}
                    className="text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded hover:bg-red-400/20"
                  >
                    Clear
                  </button>
                </div>
              </h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {/* Use the transaction queue instead of the old transactions array */}
                {transactionQueue.slice(0, 10).map((tx) => {
                  // Debug output to console
                  console.log(`Rendering tx: ${tx.id}, type: ${tx.type}, status: "${tx.status}"`, {
                    statusType: typeof tx.status,
                    status: tx.status,
                    isConfirmed: tx.status === 'confirmed',
                    isPending: tx.status === 'pending'
                  });
                  return (
                  <div 
                    key={tx.id} 
                    className="bg-[#1a1a2e]/50 rounded-xl p-4 border border-[#6C5DD3]/20 hover:border-[#6C5DD3]/40 transition-all"
                  >
                    {/* Debug status info */}
                    <div className="text-xs text-gray-600 mb-1">
                      Status: "{tx.status}" | ID: {tx.id.substring(0, 8)}...
                    </div>
                    {/* Header with status badge */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {/* Transaction Type Icon */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          tx.type === 'jump' ? 'bg-[#6C5DD3]/10' :
                          tx.type === 'start' ? 'bg-green-500/10' :
                          'bg-purple-500/10'
                        }`}>
                          {tx.type === 'jump' ? 
                            <Cloud className="w-4 h-4 text-[#6C5DD3]" /> :
                            tx.type === 'start' ? 
                            <Bird className="w-4 h-4 text-green-400" /> :
                            <Trophy className="w-4 h-4 text-purple-400" />
                          }
                        </div>
                        {/* Transaction Info */}
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
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            {new Date(tx.timestamp).toLocaleTimeString()}
                            {tx.data?.batchNumber && (
                              <span className="text-gray-600">
                                • Batch {tx.data.batchNumber}/{tx.data.totalBatches}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Status Badge - force string comparison */}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1
                        ${tx.status === 'confirmed' ? 'bg-green-500/10 text-green-400' : 
                          tx.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 animate-pulse' : 
                          'bg-red-500/10 text-red-400'}`}>
                        {tx.status === 'pending' && <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                        {tx.status === 'confirmed' ? 'Confirmed' : 
                         tx.status === 'pending' ? 'Pending' : 
                         'Failed'}
                      </span>
                    </div>
                    
                    {/* Add transaction hash as explorer link when available */}
                    {tx.hash && (
                      <div className="mt-2 pt-2 border-t border-[#6C5DD3]/10">
                        <a 
                          href={`https://explorer.fuse.io/tx/${tx.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between text-xs text-[#6C5DD3] hover:text-[#8F7FF7] transition-colors px-2 py-1.5 bg-[#6C5DD3]/10 rounded-md"
                        >
                          <span className="flex items-center gap-1">
                            <ChevronRight className="w-3 h-3" />
                            View on Explorer
                          </span>
                          <span className="font-mono text-gray-400">
                            {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                          </span>
                        </a>
                      </div>
                    )}
                    
                    {/* Add game details when available */}
                    {tx.type === 'end' && tx.data && (
                      <div className="mt-2 pt-2 border-t border-[#6C5DD3]/10 text-xs text-gray-400">
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
                        {tx.data.totalJumps !== undefined && (
                          <div className="flex justify-between">
                            <span>Jumps:</span>
                            <span className="text-[#6C5DD3]">{tx.data.totalJumps}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
                
                {transactionQueue.length === 0 && (
                  <div className="text-center py-6 text-gray-500 text-sm">
                    No transactions yet. Start a game to see activity.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Powered by Section */}
          <div className="text-center space-y-2 py-4 border-t border-[#6C5DD3]/20">
            <p className="text-sm text-gray-400">
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
            <div className="text-xs text-gray-500">
              Built with ❤️ on Fuse Ember Network
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}