import { useEffect, useState, useCallback } from 'react';
import { Contract, Wallet } from 'ethers';
import { ethers } from 'ethers';
import { 
  CONTRACT_ABI, 
  CONTRACT_ADDRESS, 
  RPC_URL, 
  CHAIN_ID,
  RPC_ENDPOINTS,
  switchToFuseFlash
} from '../config/contract';
import { useCustodialWallet } from './useCustodialWallet';
import { GameTransaction } from '../types/transactions';
import { useTransactionQueue } from './useTransactionQueue';

interface ContractState {
  contract: Contract | null;
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.providers.JsonRpcSigner | null;
  isConnected: boolean;
  isInitialized: boolean;
  error: string | null;
}

interface JumpData {
  timestamp: number;
  scoreAtJump: number;
  multiplierAtJump: number;
  processed: boolean;
}

// Add a function to validate transaction parameters
const validateTransaction = (method: string, args: any[], options: any) => {
  console.log('Validating transaction:', {
    method,
    args,
    options
  });

  // Ensure BigInt values are properly formatted
  if (method === 'endGame') {
    args = args.map(arg => {
      if (typeof arg === 'number') {
        return BigInt(arg);
      }
      return arg;
    });
  }

  // Ensure gas parameters are BigInt
  if (options.maxFeePerGas) {
    options.maxFeePerGas = BigInt(options.maxFeePerGas.toString());
  }
  if (options.maxPriorityFeePerGas) {
    options.maxPriorityFeePerGas = BigInt(options.maxPriorityFeePerGas.toString());
  }

  return { args, options };
};

export function useFlappyContract() {
  const [state, setState] = useState<ContractState>({
    contract: null,
    provider: null,
    signer: null,
    isConnected: false,
    isInitialized: false,
    error: null,
  });

  const [transactionPending, setTransactionPending] = useState(false);
  const { wallet, initializeWallet, addJumpToBatch, pendingJumps, addTransaction, transactions, hasPendingTransactions } = useCustodialWallet();
  const { addToQueue } = useTransactionQueue();

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Move sendTransactionWithRetry inside the hook
  const sendTransactionWithRetry = async (
    contract: Contract,
    method: string,
    args: any[],
    options: any,
    maxAttempts = 3,
    currentEndpoint = 0
  ) => {
    try {
      console.log(`Attempting ${method} with endpoint ${RPC_ENDPOINTS[currentEndpoint]}`);
      
      if (!wallet) {
        throw new Error('Wallet not initialized');
      }

      // Create provider with timeout and retry options
      const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[currentEndpoint]);

      // Test provider connection
      try {
        await provider.getBlockNumber();
      } catch (providerError) {
        console.error(`Provider ${currentEndpoint} failed:`, providerError);
        if (currentEndpoint + 1 < RPC_ENDPOINTS.length) {
          return sendTransactionWithRetry(contract, method, args, options, maxAttempts, currentEndpoint + 1);
        }
        throw providerError;
      }

      const signer = wallet.connect(provider);
      const newContract = contract.connect(signer);
      
      // Get fresh nonce with retry
      let nonce;
      try {
        const address = await signer.getAddress();
        nonce = await provider.getTransactionCount(address, 'latest');
      } catch (nonceError) {
        console.error('Failed to get nonce:', nonceError);
        if (currentEndpoint + 1 < RPC_ENDPOINTS.length) {
          return sendTransactionWithRetry(contract, method, args, options, maxAttempts, currentEndpoint + 1);
        }
        throw nonceError;
      }

      // Get current gas price and add 50% buffer for high-priority transactions
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice ? 
        (BigInt(feeData.gasPrice.toString()) * BigInt(150)) / BigInt(100) : 
        BigInt(20e9);

      // Check wallet balance before proceeding
      const signerAddress = await signer.getAddress();
      const balance = await provider.getBalance(signerAddress);
      const formattedBalance = ethers.utils.formatEther(balance);
      const estimatedGasCost = gasPrice * BigInt(500000); // Use conservative estimate
      if (BigInt(balance.toString()) < estimatedGasCost) {
        throw new Error(`Insufficient funds. Need at least ${formattedBalance} FUSE for gas.`);
      }

      // Add transaction validation
      try {
        // Estimate gas first to check if transaction will succeed
        const gasEstimate = await newContract.estimateGas[method](...args, {
          ...options,
          nonce,
          gasPrice,
          type: 0 // Use legacy transaction type
        });
        
        console.log(`Gas estimate for ${method}:`, gasEstimate.toString());
        
        // Add 50% buffer to gas estimate for safety
        options.gasLimit = BigInt(gasEstimate.toString()) * BigInt(150) / BigInt(100);
      } catch (error: any) {
        console.error('Gas estimation failed:', error);
        if (error.message?.includes('insufficient funds')) {
          throw new Error('Not enough FUSE for gas. Please make sure your wallet has enough FUSE tokens.');
        }
        if (error.message?.includes('execution reverted')) {
          throw new Error(`Transaction would fail: ${error.message}`);
        }
        // Use a higher fixed gas limit if estimation fails
        options.gasLimit = BigInt(1000000);
      }

      // Use the contract method directly with legacy transaction type
      const tx = await newContract[method](...args, {
        ...options,
        nonce,
        gasPrice,
        type: 0, // Force legacy transaction type
        gasLimit: options.gasLimit || BigInt(1000000) // Use higher default gas limit
      });

      console.log(`${method} transaction sent:`, tx.hash);

      // Wait for transaction with timeout
      const receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction timeout')), 30000))
      ]);

      if (!receipt.status) {
        throw new Error('Transaction failed on-chain');
      }

      return receipt;

    } catch (error: any) {
      console.error(`Transaction failed on endpoint ${currentEndpoint}:`, error);

      // Add more specific error messages
      let errorMessage = 'Transaction failed';
      if (error.message?.includes('insufficient funds')) {
        errorMessage = 'Not enough FUSE for gas. Please make sure your wallet has at least 1 FUSE.';
      } else if (error.message?.includes('nonce')) {
        errorMessage = 'Transaction nonce error. Please try again.';
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Transaction timed out. Please try again.';
      } else if (error.message?.includes('user rejected')) {
        errorMessage = 'Please approve the transaction in MetaMask.';
      }

      // If we have more endpoints to try and it's a connection issue, retry
      if (currentEndpoint + 1 < RPC_ENDPOINTS.length && 
         (error.message?.includes('timeout') || error.message?.includes('network'))) {
        return sendTransactionWithRetry(contract, method, args, options, maxAttempts, currentEndpoint + 1);
      }

      throw new Error(errorMessage);
    }
  };

  // Define initializeContract function first
  const initializeContract = async () => {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed');
      }

      // Create provider
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      
      // Wait for provider to be ready
      await provider.ready;
      
      // Get signer
      const signer = provider.getSigner();
      
      // Create contract instance
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );

      // Verify contract is accessible
      await contract.currentGameId();

      setState({
        contract,
        provider,
        signer,
        isConnected: true,
        isInitialized: true,
        error: null,
      });
    } catch (error: any) {
      console.error('Failed to initialize contract:', error);
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to initialize contract',
        isInitialized: true,
      }));
    }
  };

  // Define connectWallet function
  const connectWallet = async () => {
    try {
      console.log('Starting wallet connection process...');
      
      if (!window.ethereum) {
        console.error('MetaMask not found');
        throw new Error('MetaMask is not installed. Please install MetaMask extension and refresh the page.');
      }

      // First check if we're already connected
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) {
        console.log('Already connected to account:', accounts[0]);
      } else {
        console.log('No accounts found, requesting access...');
        // Request account access
        const requestedAccounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (!requestedAccounts || requestedAccounts.length === 0) {
          throw new Error('No accounts found. Please unlock your MetaMask wallet.');
        }
        console.log('Account connected:', requestedAccounts[0]);
      }

      console.log('Switching to Fuse-Flash network...');
      
      // Switch to the correct network
      await switchToFuseFlash();
      
      // Create provider and signer
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      // Create contract instance
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );

      console.log('Contract instance created, checking access...');
      
      // Verify contract is accessible
      try {
        const gameId = await contract.currentGameId();
        console.log('Current game ID:', gameId.toString());
      } catch (accessError) {
        console.error('Failed to access contract functions:', accessError);
        throw new Error('Unable to access game contract. Please check your connection and try again.');
      }

      setState({
        contract,
        provider,
        signer,
        isConnected: true,
        isInitialized: true,
        error: null,
      });

      console.log('Wallet connection successful!');
      return contract;
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to connect wallet',
        isInitialized: true,
      }));
      throw error;
    }
  };

  // Initialize contract on mount
  useEffect(() => {
    initializeContract();
  }, []);

  // Handle network changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleChainChanged = async (chainId: string) => {
      if (chainId !== CHAIN_ID) {
        try {
          await switchToFuseFlash();
        } catch (error: any) {
          setState(prev => ({
            ...prev,
            error: error.message || 'Failed to switch network',
          }));
        }
      }
    };

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        setState(prev => ({
          ...prev,
          isConnected: false,
          error: 'Please connect your wallet',
        }));
      } else {
        try {
          await connectWallet();
        } catch (error: any) {
          setState(prev => ({
            ...prev,
            error: error.message || 'Failed to reconnect wallet',
          }));
        }
      }
    };

    // Add event listeners
    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    
    // Use an async function inside useEffect
    const setupWallet = async () => {
      try {
        // Request permissions
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        // Switch to Fuse Flash chain
        await switchToFuseFlash().catch((e: Error) => {
          console.warn('Chain switch failed:', e);
          throw new Error('Please switch to the Fuse-Flash network in MetaMask');
        });
      } catch (error: any) {
        console.error('Failed to connect wallet:', error);
        setState(prev => ({
          ...prev,
          error: error.message || 'Failed to connect wallet',
          isInitialized: true,
        }));
      }
    };
    
    // Call the async function
    setupWallet();

    return () => {
      window.ethereum.removeListener('chainChanged', handleChainChanged);
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, []);

  // Handle account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        setState(prev => ({
          ...prev,
          isConnected: false,
          error: 'Please connect your wallet',
        }));
      } else {
        try {
          await connectWallet();
        } catch (error: any) {
          setState(prev => ({
            ...prev,
            error: error.message || 'Failed to reconnect wallet',
          }));
        }
      }
    };
  }, [connectWallet]);

  // Update the startGame function to use safer method access
  const startGame = async () => {
    console.log('Starting game...');
    setTransactionPending(true);
    
    try {
      if (!state.contract) {
        throw new Error('Contract not initialized');
      }
      
      // Use MetaMask directly instead of custodial wallet
      await switchToFuseFlash();
      
      // We'll use MetaMask signer directly
      if (!state.signer) {
        throw new Error('MetaMask not connected');
      }
      
      console.log('Using address:', await state.signer.getAddress());
      
      // Create a unique transaction ID
    const txId = `start-${Date.now()}`;
      
      // Add to transaction queue as pending using direct MetaMask transaction
      addToQueue({
        id: txId,
        type: 'start',
        status: 'pending',
        timestamp: Date.now(),
        data: {
          address: await state.signer.getAddress()
        }
      });
      
      // Get gas fees with buffer to ensure transaction goes through
      const feeData = await state.provider?.getFeeData();
      const gasPrice = feeData?.gasPrice ? 
        feeData.gasPrice.mul(150).div(100) : // Add 50% buffer
        ethers.utils.parseUnits('20', 'gwei');
      
      // Call the contract method directly with MetaMask
      const tx = await state.contract.startGame(
        await state.signer.getAddress(), // Pass the player's address as the first parameter
        {
          gasLimit: 5000000,
        gasPrice,
          type: 0 // Use legacy transaction format
        }
      );
      
      // Update transaction with hash
      addToQueue({
        id: txId,
        type: 'start',
        status: 'pending',
        timestamp: Date.now(),
        hash: tx.hash,
        data: {
          address: await state.signer.getAddress()
        }
      });

      console.log('Start game transaction sent:', tx.hash);
      
      // Wait for transaction confirmation with timeout
      const receipt = await Promise.race([
        tx.wait(1),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction timeout')), 60000))
      ]);

      console.log('Transaction confirmed:', receipt);

      // Get the game ID from the event logs
      const gameStartedEvent = receipt.events?.find((e: any) => e.event === 'GameStarted');
      const gameId = gameStartedEvent?.args?.gameId.toNumber();

      if (!gameId) {
        throw new Error('Failed to get game ID from transaction');
      }

      // Mark transaction as confirmed with game ID
      addToQueue({
        id: txId,
        type: 'start',
        status: 'confirmed',
        timestamp: Date.now(),
        hash: tx.hash,
        data: {
          gameId,
          address: await state.signer.getAddress()
        }
      });
      
      return { gameId };
    } catch (error: any) {
      console.error('Start game failed:', error);
      throw error;
    } finally {
      setTransactionPending(false);
    }
  };

  // Update the getGasFees function
  const getGasFees = async () => {
    try {
      if (!wallet?.provider) {
        console.warn('Wallet or provider not initialized, using default gas values');
        return {
          maxFeePerGas: BigInt(20e9), // 20 GWEI
          maxPriorityFeePerGas: BigInt(10e9) // 10 GWEI
        };
      }

      // Get current gas price from the network
      const feeData = await wallet.provider.getFeeData();
      
      // Add 20% buffer to ensure transaction goes through
      const maxFeePerGas = feeData.maxFeePerGas ? 
        (BigInt(feeData.maxFeePerGas.toString()) * BigInt(120)) / BigInt(100) : 
        BigInt(3e9);
      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ? 
        (BigInt(feeData.maxPriorityFeePerGas.toString()) * BigInt(120)) / BigInt(100) : 
        BigInt(2e9);

      console.log('Estimated gas fees:', {
        maxFeePerGas: maxFeePerGas.toString(),
        maxPriorityFeePerGas: maxPriorityFeePerGas.toString()
      });

      return { maxFeePerGas, maxPriorityFeePerGas };
    } catch (error) {
      console.warn('Failed to estimate gas fees:', error);
      return {
        maxFeePerGas: BigInt(20e9),
        maxPriorityFeePerGas: BigInt(10e9)
      };
    }
  };

  // Update the sendBatchedJumps function
  const sendBatchedJumps = async (jumps: any[], retryCount = 3) => {
    if (!state.contract || !wallet) {
      throw new Error('Contract or wallet not initialized');
    }

    console.log('Jump batch processing is disabled in the current contract version');
    
    // Instead of sending jumps in batch, just store them locally
    jumps.forEach(jump => {
      addJumpToBatch({
        timestamp: jump.timestamp,
        scoreAtJump: jump.scoreAtJump,
        multiplierAtJump: Math.floor(jump.multiplierAtJump)
      });
    });
    
    // Log for debugging
    console.log(`Stored ${jumps.length} jumps locally. They will be sent when the game ends.`);
    
    // Add a record of this action
    const txId = `local-batch-${Date.now()}`;
    addTransaction({
      id: txId,
      type: 'jump',
      status: 'confirmed',
      timestamp: Date.now(),
      data: { jumps: jumps.length }
    });
    
    return;
  };

  // Update the endGame function with better error handling and retry logic
  const endGame = async (
    gameId: number,
    finalScore: number,
    totalJumps: number,
    jumps: JumpData[]
  ) => {
    if (!state.contract || !state.signer) {
      throw new Error('Contract not initialized');
    }

    try {
      setTransactionPending(true);
      
      // Validate inputs
      if (isNaN(gameId) || gameId <= 0) {
        console.error('Invalid game ID:', gameId);
        throw new Error('Invalid game ID');
      }
      
      if (isNaN(finalScore) || finalScore < 0) {
        console.error('Invalid score:', finalScore);
        throw new Error('Invalid score');
      }
      
      // Use MetaMask directly 
      await switchToFuseFlash();
      
      // We'll use MetaMask signer directly
      if (!state.signer) {
        throw new Error('MetaMask not connected');
      }
      
      console.log('Using address:', await state.signer.getAddress());
      
      // Create a unique transaction ID
      const txId = `end-${gameId}-${Date.now()}`;
      
      // Add to transaction queue as pending using direct MetaMask transaction
      addToQueue({
        id: txId,
        type: 'end',
        status: 'pending',
        timestamp: Date.now(),
        data: {
        gameId,
        finalScore,
          totalJumps
        }
      });
      
      // Limit the number of jumps to reduce gas costs and avoid errors
      // The contract might have limits on how many jumps it can process
      const limitedJumps = jumps.slice(0, Math.min(jumps.length, 5));
      console.log(`Using ${limitedJumps.length} jumps out of ${jumps.length} total jumps`);
      
      // Format the jump data for the contract - handle any potential errors in jump data
      const formattedJumps = limitedJumps.map(jump => ({
        timestamp: BigInt(Math.floor(jump.timestamp || Date.now() / 1000)),
        scoreAtJump: BigInt(jump.scoreAtJump || 0),
        multiplierAtJump: BigInt(jump.multiplierAtJump || 1)
      }));
      
      // Get gas fees with buffer to ensure transaction goes through
      let gasPrice;
      try {
        const feeData = await state.provider?.getFeeData();
        gasPrice = feeData?.gasPrice ? 
          feeData.gasPrice.mul(150).div(100) : // Add 50% buffer
          ethers.utils.parseUnits('20', 'gwei');
      } catch (error) {
        console.warn('Failed to get fee data, using default gas price', error);
        gasPrice = ethers.utils.parseUnits('20', 'gwei');
      }
      
      // First verify game state
      let gameVerified = false;
      try {
        const gameInfo = await state.contract.games(gameId);
        console.log('Game info:', gameInfo);
        
        if (gameInfo.ended) {
          throw new Error('Game has already ended');
        }
        
        const playerAddress = await state.signer.getAddress();
        if (gameInfo.player.toLowerCase() !== playerAddress.toLowerCase()) {
          throw new Error('You can only end games that you started');
        }
        gameVerified = true;
      } catch (error: any) {
        if (error.message.includes('already ended') || error.message.includes('only end games')) {
          throw error;
        }
        console.warn('Could not verify game state, attempting to end anyway:', error);
      }
      
      console.log('Sending endGame transaction with params:', {
        gameId,
        finalScore,
        totalJumps,
        jumpsCount: formattedJumps.length,
        gasPrice: gasPrice.toString(),
        gasLimit: 5000000,
        gameVerified
      });
      
      // Always save score locally regardless of blockchain success
      const saveScoreLocally = () => {
        // Get existing local scores
        const localScoresJson = localStorage.getItem('flappyFuse_localScores') || '[]';
        let localScores = [];
        try {
          localScores = JSON.parse(localScoresJson);
        } catch (e) {
          console.error('Failed to parse local scores:', e);
          localScores = [];
        }
        
        // Add this score
        const playerAddress = state.signer ? state.signer.getAddress().catch(() => 'unknown') : 'unknown';
        localScores.push({
          gameId,
          address: playerAddress,
          score: finalScore,
          totalJumps,
          timestamp: Math.floor(Date.now() / 1000)
        });
        
        // Save back to local storage
        localStorage.setItem('flappyFuse_localScores', JSON.stringify(localScores));
        console.log('Score saved locally:', finalScore);
      };
      
      try {
        // Call the contract method directly with MetaMask
        const tx = await state.contract.endGame(
          gameId,
          finalScore,
          totalJumps,
        formattedJumps,
        {
            gasLimit: 5000000,
          gasPrice,
            type: 0 // Use legacy transaction format
          }
        );
        
        // Update transaction with hash
        addToQueue({
          id: txId,
          type: 'end',
          status: 'pending',
          timestamp: Date.now(),
          hash: tx.hash,
          data: {
            gameId,
            finalScore,
            totalJumps
          }
        });
        
        console.log('End game transaction sent:', tx.hash);
        
        // Wait for transaction confirmation with timeout
      const receipt = await Promise.race([
          tx.wait(1),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction timeout')), 60000))
        ]);
        
        console.log('End game transaction confirmed:', receipt);
        
        // Mark transaction as confirmed
        addToQueue({
          id: txId,
          type: 'end',
          status: 'confirmed',
          timestamp: Date.now(),
          hash: tx.hash,
          data: {
            gameId,
            finalScore,
            totalJumps
          }
        });
        
        // Also save locally for redundancy
        saveScoreLocally();
        
        return { success: true, hash: tx.hash };
      } catch (txError: any) {
        console.error('Blockchain transaction failed:', txError);
        
        // Save score locally as fallback
        saveScoreLocally();
        
        // Rethrow with better message
        let userMessage = 'Failed to save your score on the blockchain, but it was recorded locally.';
        
        if (txError.message.includes('CALL_EXCEPTION') || txError.message.includes('transaction failed')) {
          userMessage = 'Game score could not be saved on-chain due to contract error, but was recorded locally.';
        } else if (txError.message.includes('already ended')) {
          userMessage = 'This game was already ended.';
        } else if (txError.message.includes('only end games')) {
          userMessage = 'You can only end games that you started.';
        } else if (txError.message.includes('timeout')) {
          userMessage = 'Network response took too long. Your score was recorded locally.';
        } else if (txError.message.includes('user rejected')) {
          userMessage = 'Transaction was rejected in your wallet. Your score was recorded locally.';
        } else if (txError.message.includes('insufficient funds')) {
          userMessage = 'Not enough FUSE tokens to pay for the transaction. Your score was recorded locally.';
        }
        
        // Mark transaction as locally completed
        const localTxId = `end-local-${gameId}-${Date.now()}`;
        addToQueue({
          id: localTxId,
          type: 'end',
          status: 'confirmed', // Mark as 'confirmed' locally
          timestamp: Date.now(),
          data: {
            gameId,
            finalScore,
            totalJumps,
            localOnly: true,
            error: userMessage
          }
        });
        
        throw new Error(userMessage);
      }
    } catch (error: any) {
      console.error('End game failed:', error);
      
      // If we reach here, something went wrong before or outside the transaction
      // Always try to save locally
      try {
        const localScoresJson = localStorage.getItem('flappyFuse_localScores') || '[]';
        let localScores = [];
        try {
          localScores = JSON.parse(localScoresJson);
        } catch (e) {
          localScores = [];
        }
        
        // Add this score
        localScores.push({
          gameId,
          score: finalScore,
          totalJumps,
          timestamp: Math.floor(Date.now() / 1000)
        });
        
        localStorage.setItem('flappyFuse_localScores', JSON.stringify(localScores));
        console.log('Score saved locally as fallback:', finalScore);
      } catch (localError) {
        console.error('Failed to save score locally:', localError);
      }
      
      // Create a nice error message
      let userMessage = 'Game ended, but score could not be saved on the blockchain.';
      if (error.message) {
        userMessage = error.message;
      }
      
      // Mark transaction as locally completed
      const txId = `end-local-${gameId}-${Date.now()}`;
      addToQueue({
        id: txId,
        type: 'end',
        status: 'confirmed', // Mark as 'confirmed' locally
        timestamp: Date.now(),
        data: {
          gameId,
          finalScore,
          totalJumps,
          localOnly: true,
          error: userMessage
        }
      });
      
      // Return success but with localOnly flag
      return { 
        success: true, 
        localOnly: true, 
        message: userMessage 
      };
    } finally {
      setTransactionPending(false);
    }
  };

  // Add a state for wallet address
  const [address, setAddress] = useState<string | null>(null);
  
  // Update address when signer changes
  useEffect(() => {
    const updateAddress = async () => {
      if (state.signer) {
        try {
          const addr = await state.signer.getAddress();
          setAddress(addr);
        } catch (error) {
          console.error('Failed to get address:', error);
          setAddress(null);
        }
      } else {
        setAddress(null);
      }
    };
    
    updateAddress();
  }, [state.signer]);

  return {
    ...state,
    startGame,
    endGame,
    connectWallet,
    transactionPending,
    address,
    resetGameStateAndReconnect: async () => {
      try {
        setState({
          contract: null,
          provider: null,
          signer: null,
          isConnected: false,
          isInitialized: false,
          error: null,
        });
        
        await delay(500);
        return await connectWallet();
      } catch (error) {
        console.error('Failed to reset and reconnect:', error);
        throw error;
      }
    }
  };
}