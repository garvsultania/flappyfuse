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

      console.log('MetaMask detected, attempting to switch to Fuse-Flash network...');
      
      // First switch to the correct network
      await switchToFuseFlash();
      
      console.log('Network switched, requesting accounts...');

      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      console.log('Accounts:', accounts);
      
      if (!accounts || accounts.length === 0) {
        console.error('No accounts available after request');
        throw new Error('No accounts found. Please unlock your MetaMask wallet.');
      }

      console.log('Account connected:', accounts[0]);

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
      
      // Verify contract is accessible with more detailed error handling
      try {
        const gameId = await contract.currentGameId();
        console.log('Current game ID:', gameId.toString());
        
        // Try another view function to verify full contract access
        try {
          const owner = await contract.owner();
          console.log('Contract owner:', owner);
        } catch (accessError) {
          console.warn('Could not access owner(), but contract is still usable:', accessError);
        }
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

    window.ethereum.on('chainChanged', handleChainChanged);
    return () => {
      window.ethereum.removeListener('chainChanged', handleChainChanged);
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

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, [connectWallet]);

  // Update the startGame function to use safer method access
  const startGame = async () => {
    console.log('Starting game...', {
      address: wallet?.address,
      walletExists: !!wallet,
      contract: !!state.contract,
      isConnected: state.isConnected
    });
    
    // Check if any transaction is pending
    if (hasPendingTransactions) {
      console.error('Cannot start game while transactions are pending');
      throw new Error('Please wait for pending transactions to complete before starting a new game');
    }
    
    // Initialize wallet first if needed
    let currentWallet = wallet;
    if (!currentWallet) {
      console.log('No wallet, initializing wallet...');
      try {
        const initializedWallet = await initializeWallet();
        
        if (!initializedWallet) {
          console.error('Failed to initialize wallet after attempt');
          throw new Error('Unable to initialize wallet. Please try refreshing the page.');
        }
        
        currentWallet = initializedWallet;
        console.log('Wallet successfully initialized:', initializedWallet.address);
      } catch (err) {
        console.error('Error initializing wallet:', err);
        throw new Error('Failed to initialize wallet: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    }
    
    // Then try to initialize contract if needed
    if (!state.contract) {
      console.log('Initializing contract...');
      try {
        await initializeContract();
        
        if (!state.contract) {
          console.error('Failed to initialize contract after attempt');
          throw new Error('Please connect your wallet first');
        }
        
        console.log('Contract successfully initialized');
      } catch (err) {
        console.error('Error initializing contract:', err);
        throw new Error('Failed to initialize contract: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    }

    const txId = `start-${Date.now()}`;
    try {
      // Double-check if any transaction is pending (in case one was added during initialization)
      if (hasPendingTransactions) {
        console.log('Found pending transaction in the queue');
        throw new Error('Please wait for pending transaction to complete');
      }

      // Add initial pending transaction
      addToQueue({
        id: txId,
        type: 'start',
        status: 'pending',
        timestamp: Date.now()
      });

      // Verify wallet is ready
      if (!currentWallet) {
        console.error('Wallet initialization failed - still null');
        throw new Error('Wallet not initialized properly');
      }
      
      // Get the wallet address
      const walletAddress = await currentWallet.getAddress();
      console.log('Starting game with wallet:', walletAddress);

      // Try multiple RPC endpoints for better reliability
      let provider = null;
      let connected = false;
      
      for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
        try {
          console.log(`Trying RPC endpoint ${i + 1}: ${RPC_ENDPOINTS[i]}`);
          provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[i]);
          
          // Test provider connection
          const blockNumber = await provider.getBlockNumber();
          console.log(`Provider ${i + 1} connected successfully, current block:`, blockNumber);
          connected = true;
          break;
        } catch (error) {
          console.error(`Provider ${i + 1} connection failed:`, error);
        }
      }
      
      if (!connected || !provider) {
        throw new Error('Failed to connect to any network. Please check your internet connection and try again.');
      }

      // Connect wallet to provider
      const connectedWallet = currentWallet.connect(provider);
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, connectedWallet);
      console.log('Contract connected with wallet');

      // Verify contract methods
      try {
        const currentId = await contract.currentGameId();
        console.log('Contract access verified, current game ID:', currentId.toString());
      } catch (accessErr) {
        console.error('Contract functions not accessible:', accessErr);
        throw new Error('Could not access game contract functions. Please try again.');
      }

      // Get fresh nonce
      const nonce = await provider.getTransactionCount(walletAddress, 'latest');
      console.log('Using nonce:', nonce);

      // Get current gas price and add 50% buffer using getFeeData
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice ? 
        (BigInt(feeData.gasPrice.toString()) * BigInt(150)) / BigInt(100) : 
        BigInt(20e9);
      console.log('Using gas price:', gasPrice.toString());

      // Use a fixed gas limit for startGame
      const gasLimit = BigInt(300000); // Fixed gas limit that should be sufficient
      console.log('Using fixed gas limit:', gasLimit.toString());

      console.log('Sending startGame transaction with params:', {
        walletAddress,
        nonce,
        gasPrice: gasPrice.toString(),
        gasLimit: gasLimit.toString(),
        type: 0
      });

      // Add initial pending transaction directly to the queue
      addToQueue({
        id: txId,
        type: 'start',
        status: 'pending',
        timestamp: Date.now(),
        data: { address: walletAddress }
      });

      // Prepare transaction with simplified parameters
      const tx = await contract.startGame(walletAddress, {
        nonce,
        gasPrice,
        gasLimit,
        type: 0
      });

      console.log('Transaction sent:', tx.hash);

      // Update transaction status with hash
      addToQueue({
        id: txId,
        type: 'start',
        status: 'pending',
        timestamp: Date.now(),
        hash: tx.hash
      });

      // Wait for confirmation with timeout
      console.log('Waiting for transaction confirmation...');
      const receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction timeout')), 30000)
        )
      ]);

      if (!receipt.status) {
        throw new Error('Transaction failed on chain');
      }

      console.log('Transaction confirmed:', receipt);

      // Get game ID from logs
      let gameId = 0;
      if (receipt.logs && receipt.logs[0]) {
        try {
          gameId = Number.parseInt(receipt.logs[0].topics[1].slice(2), 16);
          console.log('Parsed game ID:', gameId);
        } catch (e) {
          console.error('Failed to parse game ID:', e);
          throw new Error('Failed to get game ID');
        }
      }

      if (!gameId) {
        throw new Error('Invalid game ID');
      }

      // Update transaction as confirmed
      addToQueue({
        id: txId,
        type: 'start',
        status: 'confirmed',
        timestamp: Date.now(),
        hash: receipt.hash,
        data: { gameId }
      });

      return { gameId, startTime: Date.now() };

    } catch (error) {
      console.error('Start game error:', error);

      // If it's a nonce/replacement error, try one more time with higher gas
      if (error instanceof Error && (error.message?.includes('replacement') || error.message?.includes('nonce'))) {
        try {
          console.log('Retrying with higher gas...');
          
          // Create fresh provider
          const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
          
          // Test provider connection
          await provider.getBlockNumber();
          
          if (!currentWallet) {
            throw new Error('Wallet not initialized');
          }
          const connectedWallet = currentWallet.connect(provider);
          const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, connectedWallet);

          // Get fresh nonce and very high gas price using getFeeData
          const walletAddress = await connectedWallet.getAddress();
          const nonce = await provider.getTransactionCount(walletAddress, 'latest');
          const feeData = await provider.getFeeData();
          const gasPrice = feeData.gasPrice ? 
            (BigInt(feeData.gasPrice.toString()) * BigInt(200)) / BigInt(100) : 
            BigInt(20e9);

          // Use same fixed gas limit
          const gasLimit = BigInt(300000);

          const tx = await contract.startGame(walletAddress, {
            nonce,
            gasPrice,
            gasLimit,
            type: 0
          });

          console.log('Retry transaction sent:', tx.hash);

          const receipt = await tx.wait();
          
          if (!receipt.status) {
            throw new Error('Retry transaction failed on chain');
          }

          const gameId = receipt.logs?.[0] ? 
            Number.parseInt(receipt.logs[0].topics[1].slice(2), 16) : 
            0;

          if (!gameId) {
            throw new Error('Invalid game ID from retry');
          }

          // Retry transaction sent logic
          addToQueue({
            id: txId,
            type: 'start',
            status: 'confirmed',
            timestamp: Date.now(),
            hash: receipt.hash,
            data: { gameId }
          });

          return { gameId, startTime: Date.now() };

        } catch (retryError) {
          console.error('Retry also failed:', retryError);
          addToQueue({
            id: txId,
            type: 'start',
            status: 'failed',
            timestamp: Date.now(),
            error: 'Failed to start game after retry. Please wait a moment and try again.'
          });
          throw new Error('Failed to start game. Please wait a moment and try again.');
        }
      }

      // For other errors, mark as failed with specific messages
      addToQueue({
        id: txId,
        type: 'start',
        status: 'failed',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Throw user-friendly errors
      if (error instanceof Error) {
        if (error.message?.includes('insufficient funds')) {
          throw new Error('Not enough FUSE for gas. Please make sure you have enough FUSE.');
        } else if (error.message?.includes('timeout')) {
          throw new Error('Network is slow. Please try again in a moment.');
        } else if (error.message?.includes('pending transaction')) {
          throw new Error('Please wait for pending transaction to complete before starting a new game.');
        } else if (error.message?.includes('provider connection failed')) {
          throw new Error('Network connection failed. Please try again.');
        } else {
          throw new Error('Failed to start game. Please refresh the page and try again.');
        }
      } else {
        throw new Error('Failed to start game. Please refresh the page and try again.');
      }
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
    jumps: any[]
  ) => {
    if (!state.contract || !wallet) {
      throw new Error('Contract or wallet not initialized');
    }

    try {
      // Get wallet address
      const walletAddress = await wallet.getAddress();
      console.log('Ending game with wallet:', walletAddress);

      // Get game info
      const gameInfo = await state.contract.getGameInfo(gameId);
      console.log('Game ownership check:', {
        gamePlayer: gameInfo.player.toLowerCase(),
        custodialWallet: walletAddress.toLowerCase(),
        gameEnded: gameInfo.ended
      });

      if (gameInfo.ended) {
        throw new Error('Game has already ended');
      }

      if (gameInfo.player.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error('Must use same wallet that started the game');
      }

      // Format jumps data
      const formattedJumps = jumps.map(jump => ({
        timestamp: BigInt(Math.floor(jump.timestamp)),
        scoreAtJump: BigInt(jump.scoreAtJump || 0),
        multiplierAtJump: BigInt(1)
      }));

      console.log('Sending end game transaction:', {
        gameId,
        finalScore,
        totalJumps,
        jumpsLength: formattedJumps.length
      });

      // Create a fresh provider
      const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
      
      // Connect wallet to provider
      const connectedWallet = wallet.connect(provider);
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, connectedWallet);
      
      // Get fee data for legacy transaction
      const feeData = await provider.getFeeData();
      
      // Use legacy gasPrice with 50% buffer
      const gasPrice = feeData.gasPrice ? 
        (BigInt(feeData.gasPrice.toString()) * BigInt(150)) / BigInt(100) : 
        BigInt(20e9); // 20 gwei default
      
      console.log('Using gas params:', {
        gasPrice: gasPrice.toString(),
        gasLimit: '5000000'
      });

      const tx = await contract.endGame(
        BigInt(gameId),
        BigInt(finalScore),
        BigInt(totalJumps),
        formattedJumps,
        {
          gasLimit: BigInt(5000000),
          gasPrice,
          type: 0 // Legacy transaction type
        }
      );

      console.log('Transaction sent:', tx.hash);
      
      // Wait for confirmation with timeout
      const receipt = await Promise.race([
        tx.wait(2), // Wait for 2 confirmations
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction timeout after 60s')), 60000)
        )
      ]) as any;
      
      console.log('Transaction confirmed:', receipt);
      return receipt;

    } catch (error: any) {
      console.error('End game failed:', error);
      
      // Provide clearer error messages
      let errorMessage = 'Failed to save score';
      if (error.message?.includes('gasPrice')) {
        errorMessage = 'Network connection issue. Please try again.';
      } else if (error.message?.includes('dynamicFee')) {
        errorMessage = 'Transaction type not supported. Please try again with a different wallet.';
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Transaction took too long. The game score may still be saved.';
      } else if (error.message?.includes('rejected')) {
        errorMessage = 'Transaction was rejected. Please try again.';
      } else if (error.message?.includes('already ended')) {
        errorMessage = 'This game has already been ended.';
      }
      
      throw new Error(errorMessage);
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