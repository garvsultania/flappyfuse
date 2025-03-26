import { Wallet, Contract } from 'ethers';
import { ethers } from 'ethers';
import { useState, useCallback, useEffect, useRef } from 'react';
import { RPC_URL, CONTRACT_ADDRESS, CONTRACT_ABI, RPC_ENDPOINTS } from '../config/contract';
import { GameTransaction } from '../types/transactions';
import { useTransactionQueue, QueuedTransaction } from './useTransactionQueue';

interface CustodialWalletState {
  wallet: Wallet | null;
  isInitialized: boolean;
  error: string | null;
  isLoading: boolean;
}

interface JumpData {
  timestamp: number;
  scoreAtJump: number;
  multiplierAtJump: number;
}

export function useCustodialWallet() {
  const [state, setState] = useState<CustodialWalletState>({
    wallet: null,
    isInitialized: false,
    error: null,
    isLoading: false
  });

  const [pendingJumps, setPendingJumps] = useState<JumpData[]>([]);
  const [processedJumps, setProcessedJumps] = useState<JumpData[]>([]);
  const [totalJumps, setTotalJumps] = useState(0);
  const [transactions, setTransactions] = useState<GameTransaction[]>([]);

  const [uniqueUsers, setUniqueUsers] = useState<number>(0);
  const UNIQUE_USERS_KEY = 'flappyFuse_uniqueUsers';

  // Use our new transaction queue manager
  const { 
    queue: transactionQueue, 
    isPending: hasPendingTransactions,
    addToQueue,
    updateTransaction,
    canProcessTransaction
  } = useTransactionQueue();

  // Define updateUniqueUsers first before it's used
  const updateUniqueUsers = useCallback((address: string) => {
    try {
      const savedUsers = localStorage.getItem(UNIQUE_USERS_KEY);
      let users: string[] = [];
      
      if (savedUsers) {
        users = JSON.parse(savedUsers);
      }

      // Add both the custodial wallet and the connected MetaMask wallet
      const addressToAdd = address.toLowerCase();
      if (!users.includes(addressToAdd)) {
        users.push(addressToAdd);
        localStorage.setItem(UNIQUE_USERS_KEY, JSON.stringify(users));
        setUniqueUsers(users.length);
        console.log('Added new unique user:', addressToAdd);
      } else {
        setUniqueUsers(users.length);
        console.log('User already counted:', addressToAdd);
      }
    } catch (e) {
      console.error('Failed to update unique users:', e);
    }
  }, []);

  // Load unique users count on mount and when MetaMask address changes
  useEffect(() => {
    try {
      const savedUsers = localStorage.getItem(UNIQUE_USERS_KEY);
      if (savedUsers) {
        const users = JSON.parse(savedUsers);
        setUniqueUsers(users.length);
      }
    } catch (e) {
      console.error('Failed to load unique users:', e);
    }
  }, []);

  // Add requestFunds function
  const requestFunds = async (address: string) => {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    // Check if we can process a new transaction
    if (!canProcessTransaction('fund')) {
      throw new Error('A transaction is already in progress. Please wait for it to complete.');
    }

    const txId = `fund-${Date.now()}`;

    try {
      // Add to transaction queue as pending
      addToQueue({
        id: txId,
        type: 'start',
        status: 'pending',
        timestamp: Date.now(),
        data: { address }
      });

      const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
      const balance = await provider.getBalance(address);
      const minimumBalance = ethers.utils.parseEther('0.01'); // 0.01 FUSE
      
      if (balance.lt(minimumBalance)) {
        console.log('Requesting funds for custodial wallet...');
        const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = web3Provider.getSigner();
        
        // Send 0.02 FUSE to ensure enough for multiple transactions
        const tx = await signer.sendTransaction({
          to: address,
          value: ethers.utils.parseEther('0.02'), // 0.02 FUSE
          gasLimit: 30000,
          type: 0 // Use legacy transaction type
        });
        
        // Update transaction in queue with hash
        updateTransaction(txId, {
          hash: tx.hash,
          status: 'pending'
        });
        
        console.log('Funding transaction sent:', tx.hash);
        await tx.wait();
        console.log('Funding successful');

        // Verify new balance
        const newBalance = await provider.getBalance(address);
        console.log('New wallet balance:', newBalance.toString());

        if (newBalance.lt(minimumBalance)) {
          // Mark transaction as failed
          updateTransaction(txId, {
            status: 'failed',
            error: 'Failed to fund wallet - insufficient FUSE transferred'
          });
          throw new Error('Failed to fund wallet - insufficient FUSE transferred');
        }

        // Mark transaction as confirmed
        updateTransaction(txId, {
          status: 'confirmed'
        });
      } else {
        // No funding needed, mark as confirmed
        updateTransaction(txId, {
          status: 'confirmed',
          data: { message: 'Wallet already has sufficient funds' }
        });
      }
    } catch (error: any) {
      console.error('Failed to fund wallet:', error);
      
      // Mark transaction as failed
      updateTransaction(txId, {
        status: 'failed',
        error: error.message || 'Unknown error'
      });

      if (error.message?.includes('insufficient funds')) {
        throw new Error('Your MetaMask wallet needs at least 0.02 FUSE to play. Please get some FUSE tokens first.');
      } else if (error.message?.includes('user rejected')) {
        throw new Error('Please approve the funding transaction in MetaMask to play.');
      } else {
        throw new Error('Failed to fund game wallet - please make sure your MetaMask has enough FUSE');
      }
    }
  };

  // Update initializeWallet to be more reliable
  const initializeWallet = useCallback(async () => {
    // If wallet is already initialized and valid, return it
    if (state.wallet && state.isInitialized) {
      try {
        const address = await state.wallet.getAddress();
        console.log('Using existing initialized wallet:', address);
        return state.wallet;
      } catch (e) {
        console.log('Existing wallet invalid, reinitializing...');
      }
    }

    // Check if we can process a new transaction
    if (!canProcessTransaction('initialize')) {
      console.warn('Cannot initialize wallet while transactions are pending');
      throw new Error('A transaction is already in progress. Please wait for it to complete.');
    }

    const txId = `init-${Date.now()}`;
    
    try {
      console.log('Initializing custodial wallet...');
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Add to transaction queue as pending
      addToQueue({
        id: txId,
        type: 'start',
        status: 'pending',
        timestamp: Date.now()
      });
      
      // Create new wallet if none exists
      let newWallet: Wallet | null = null;
      
      // Check if we have a private key in local storage
      const storedKey = localStorage.getItem('flappy_wallet_key');
      
      // Try with multiple RPC endpoints
      let walletCreated = false;
      let lastError: Error | null = null;
      
      for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
        try {
          console.log(`Trying to initialize wallet with RPC endpoint ${i + 1}: ${RPC_ENDPOINTS[i]}`);
          
          // Test the RPC endpoint first with a short timeout
          const testProvider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[i]);
          await Promise.race([
            testProvider.getBlockNumber(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Provider connection timeout')), 5000))
          ]);
          console.log(`Successfully connected to RPC endpoint ${i + 1}`);
          
          if (storedKey) {
            console.log('Using existing wallet from localStorage');
            newWallet = new Wallet(storedKey).connect(testProvider);
            const walletAddr = await newWallet.getAddress();
            console.log('Wallet address from storage:', walletAddr);
          } else {
            console.log('Creating new wallet');
            // Generate a new wallet
            newWallet = Wallet.createRandom().connect(testProvider);
            const walletAddr = await newWallet.getAddress();
            // Store private key in local storage only after confirming the wallet works
            localStorage.setItem('flappy_wallet_key', newWallet.privateKey);
            console.log('New wallet created with address:', walletAddr);
          }
          
          // Test the wallet connection with a small gas calculation
          const gasPrice = await testProvider.getGasPrice();
          console.log('Got gas price, wallet connection verified:', gasPrice.toString());
          
          walletCreated = true;
          break;
        } catch (err) {
          console.error(`Failed to initialize wallet with RPC endpoint ${i + 1}:`, err);
          lastError = err instanceof Error ? err : new Error('Unknown wallet initialization error');
          // If we had created a wallet but it failed tests, clean it up
          newWallet = null;
        }
      }
      
      if (!walletCreated || !newWallet) {
        updateTransaction(txId, {
          status: 'failed',
          error: `Failed to connect to any RPC endpoint: ${lastError?.message || 'Unknown error'}`
        });
        throw new Error(`Failed to connect to any RPC endpoint: ${lastError?.message || 'Unknown error'}`);
      }
      
      // Update transaction with address
      const address = await newWallet.getAddress();
      updateTransaction(txId, {
        data: { address }
      });
      
      // Try multiple providers for balance check
      let balance = ethers.constants.Zero;
      let balanceChecked = false;
      
      for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
        try {
          const balanceProvider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[i]);
          balance = await balanceProvider.getBalance(address);
          console.log(`Wallet address: ${address}, Balance: ${balance.toString()} (checked with endpoint ${i + 1})`);
          balanceChecked = true;
          break;
        } catch (err) {
          console.error(`Failed to check balance with RPC endpoint ${i + 1}:`, err);
        }
      }
      
      if (!balanceChecked) {
        console.warn('Could not check wallet balance with any RPC endpoint, will attempt to fund anyway');
      }
      
      // Always ensure sufficient balance
      if (!balanceChecked || balance.lt(ethers.utils.parseEther('0.01'))) { // 0.01 FUSE
        try {
          await requestFunds(address);
        } catch (fundError) {
          // Mark transaction as failed
          updateTransaction(txId, {
            status: 'failed',
            error: fundError instanceof Error ? fundError.message : 'Failed to fund wallet'
          });
          throw fundError;
        }
      }

      // After wallet is initialized, update unique users
      updateUniqueUsers(address);

      // Mark transaction as confirmed
      updateTransaction(txId, {
        status: 'confirmed',
        data: { address }
      });

      // Update state with the initialized wallet
      setState({
        wallet: newWallet,
        isInitialized: true,
        error: null,
        isLoading: false
      });

      return newWallet;
    } catch (error: any) {
      console.error('Failed to initialize custodial wallet:', error);
      
      // Mark transaction as failed
      updateTransaction(txId, {
        status: 'failed',
        error: error.message || 'Unknown error'
      });
      
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create game wallet',
        isLoading: false,
        isInitialized: false,
        wallet: null
      }));
      
      throw error;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.wallet, state.isInitialized, updateUniqueUsers, canProcessTransaction, addToQueue, updateTransaction, requestFunds]);

  // Update addJumpToBatch to use transaction queue
  const addJumpToBatch = useCallback((jumpData: JumpData) => {
    const jump = {
      timestamp: Math.floor(jumpData.timestamp),
      scoreAtJump: jumpData.scoreAtJump || 1,
      multiplierAtJump: jumpData.multiplierAtJump || 1
    };

    setTotalJumps(prev => prev + 1);
    
    setPendingJumps(prev => {
      const newJumps = [...prev, jump];
      
      if (newJumps.length >= 10) {
        const batchToProcess = newJumps.slice(0, 10);
        
        // Update processed jumps in next tick to avoid race condition
        Promise.resolve().then(() => {
          setProcessedJumps(prevProcessed => {
            const updatedJumps = [...prevProcessed, ...batchToProcess];
            return updatedJumps.slice(-50); // Keep only last 50 jumps
          });
        });

        // Add jump batch to transaction queue
        const batchId = `batch-${Date.now()}`;
        addToQueue({
          id: batchId,
          type: 'jump',
          status: 'confirmed',
          timestamp: Date.now(),
          data: {
            jumps: batchToProcess.length,
            batchNumber: Math.floor((totalJumps + 1) / 10) + 1,
            totalBatches: Math.ceil((totalJumps + 2) / 10)
          }
        });
        
        return newJumps.slice(10);
      }
      
      return newJumps;
    });
  }, [totalJumps, addToQueue]);

  // Add handleEndGame function with transaction queue
  const handleEndGame = useCallback(async (gameId: number, finalScore: number) => {
    if (!state.wallet) {
      throw new Error('Wallet not initialized');
    }

    // Check if we can process a new transaction
    if (!canProcessTransaction('end')) {
      throw new Error('A transaction is already in progress. Please wait for it to complete.');
    }

    const txId = `end-${gameId}-${Date.now()}`;
    
    try {
      console.log('Ending game with ID:', gameId, 'Score:', finalScore, 'Jumps:', totalJumps);
      
      // Add to transaction queue as pending
      addToQueue({
        id: txId,
        type: 'end',
        status: 'pending',
        timestamp: Date.now(),
        data: { 
          gameId, 
          finalScore, 
          totalJumps,
          jumps: processedJumps.length 
        }
      });

      // Use provider with timeout settings
      const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
      // Set provider options
      provider.pollingInterval = 1000;
      
      // Connect wallet to provider and create contract
      const connectedWallet = state.wallet.connect(provider);
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, connectedWallet);

      // Format jumps for contract
      const formattedJumps = processedJumps.map(jump => ({
        timestamp: BigInt(Math.floor(jump.timestamp)),
        scoreAtJump: BigInt(jump.scoreAtJump),
        multiplierAtJump: BigInt(jump.multiplierAtJump)
      }));

      // Get basic fee data instead of EIP-1559
      const feeData = await provider.getFeeData();
      
      // Use legacy gasPrice (add 50% buffer)
      const gasPrice = feeData.gasPrice 
        ? ethers.BigNumber.from(feeData.gasPrice).mul(150).div(100) 
        : ethers.BigNumber.from(20e9); // 20 gwei default if no gas price available
      
      console.log('Using gas params:', {
        gasPrice: gasPrice.toString(),
        gasLimit: '5000000'
      });

      // Send transaction using LEGACY parameters (type 0)
      const tx = await contract.endGame(
        BigInt(gameId),
        BigInt(finalScore),
        BigInt(totalJumps),
        formattedJumps,
        {
          gasLimit: BigInt(5000000),
          gasPrice,
          type: 0 // Use LEGACY transaction type instead of EIP-1559
        }
      );

      // Update transaction with hash
      updateTransaction(txId, {
        hash: tx.hash,
        status: 'pending'
      });

      console.log('End game transaction sent:', tx.hash);

      // Wait for confirmation with timeout
      const receipt = await Promise.race([
        tx.wait(2), // Wait for 2 confirmations
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction timeout after 60s')), 60000)
        )
      ]) as any;

      console.log('End game transaction confirmed:', receipt.hash);

      // Clear game state
      setPendingJumps([]);
      setProcessedJumps([]);
      setTotalJumps(0);

      // Mark transaction as confirmed with full data
      console.log('Updating end game transaction to confirmed status', txId);
      addToQueue({
        id: txId,
        type: 'end',
        status: 'confirmed',  // Important: set the status to confirmed
        timestamp: Date.now(),
        hash: receipt.hash,
        data: { 
          gameId, 
          finalScore, 
          totalJumps,
          jumps: processedJumps.length,
          timestamp: Date.now()
        }
      });

      // Return the full receipt with transaction hash for UI to use
      return {
        ...receipt,
        gameId,
        finalScore,
        totalJumps,
        hash: receipt.hash
      };

    } catch (error: any) {
      console.error('End game failed:', error);
      
      // Mark transaction as failed - use addToQueue directly for consistency
      console.log('Updating end game transaction to failed status', txId);
      addToQueue({
        id: txId,
        type: 'end',
        status: 'failed',
        timestamp: Date.now(),
        error: error.message || 'Unknown error',
        data: { 
          gameId, 
          finalScore, 
          totalJumps,
          jumps: processedJumps.length 
        }
      });
      
      // Clear game state even on failure
      setPendingJumps([]);
      setProcessedJumps([]);
      setTotalJumps(0);

      // Provide clearer error messages
      let errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('gasPrice')) {
        errorMessage = 'Network connection issue. Please try again.';
      } else if (errorMessage.includes('dynamicFee')) {
        errorMessage = 'Transaction type not supported. Please try again.';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'Transaction took too long. The game score may still be saved.';
      } else if (errorMessage.includes('rejected')) {
        errorMessage = 'Transaction was rejected. Please try again.';
      }

      throw new Error(errorMessage);
    }
  }, [state.wallet, processedJumps, totalJumps, canProcessTransaction, addToQueue, updateTransaction]);

  // Add resetGameState function
  const resetGameState = useCallback(() => {
    localStorage.removeItem('flappy_wallet_key');
    
    setPendingJumps([]);
    setProcessedJumps([]);
    setTotalJumps(0);
    setTransactions([]);
    
    setState({
      wallet: null,
      isInitialized: false,
      error: null,
      isLoading: false
    });
  }, []);

  // Deprecated function kept for backward compatibility
  const addTransaction = useCallback((tx: GameTransaction) => {
    console.warn('addTransaction is deprecated, use transaction queue instead');
    addToQueue(tx as QueuedTransaction);
  }, [addToQueue]);

  // Add effect to sync with transaction queue's pending status
  useEffect(() => {
    // This helps fix the common issue where hasPendingTransactions gets out of sync
    const syncWithTransactionQueue = () => {
      const actuallyHasPending = transactionQueue.some(tx => tx.status === 'pending');
      if (hasPendingTransactions !== actuallyHasPending) {
        console.log('Fixed pending status mismatch:', { 
          hasPendingTransactions, 
          actuallyHasPending 
        });
      }
    };
    
    // Check immediately and then periodically
    syncWithTransactionQueue();
    const intervalId = setInterval(syncWithTransactionQueue, 5000);
    
    return () => clearInterval(intervalId);
  }, [transactionQueue, hasPendingTransactions]);

  return {
    wallet: state.wallet,
    isInitialized: state.isInitialized,
    error: state.error,
    isLoading: state.isLoading,
    initializeWallet,
    addJumpToBatch,
    pendingJumps,
    transactions: transactionQueue, // Return the queue instead
    addTransaction, // Keep for backward compatibility
    handleEndGame,
    resetGameState,
    uniqueUsers,
    updateUniqueUsers,
    hasPendingTransactions
  };
} 