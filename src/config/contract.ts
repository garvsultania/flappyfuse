// Define RPC endpoints first
export const RPC_ENDPOINTS = [
  'https://ancient-quiet-shape.fuse-flash.quiknode.pro/0dacde97e109a50913bcc7fae9ee69d964f84fe2/',
  'wss://ancient-quiet-shape.fuse-flash.quiknode.pro/0dacde97e109a50913bcc7fae9ee69d964f84fe2/'
];

// Then use it for RPC_URL
export const RPC_URL = RPC_ENDPOINTS[0];

export const CHAIN_ID = '0x2AA8';
export const ROLLUP_ID = '1';
export const GAS_TOKEN = {
  name: 'FUSE',
  symbol: 'FUSE',
  sepoliaContract: '0x9dB48D9FB1E306B14c7bB1336e4D0A0E6b5753eb'
};

export const NETWORK_CONFIG = {
  chainId: '0x2AA8',
  chainName: 'Fuse-Flash',
  nativeCurrency: {
    name: 'FUSE',
    symbol: 'FUSE',
    decimals: 18
  },
  rpcUrls: RPC_ENDPOINTS,
  blockExplorerUrls: ['https://fuse-flash.explorer.quicknode.com']
};

export const CONTRACT_ADDRESS = '0xFE00F7fA21e5cF4568eA6A2Ecb7C15B8b2A6101d';

export const CONTRACT_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "gameId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "player",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "endTime",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "finalScore",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalJumps",
        "type": "uint256"
      }
    ],
    "name": "GameEnded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "gameId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "player",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "startTime",
        "type": "uint256"
      }
    ],
    "name": "GameStarted",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "currentGameId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "gameId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "finalScore",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "totalJumps",
        "type": "uint256"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "scoreAtJump",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "multiplierAtJump",
            "type": "uint256"
          }
        ],
        "internalType": "struct FlappyFuse.JumpData[]",
        "name": "jumps",
        "type": "tuple[]"
      }
    ],
    "name": "endGame",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "gameJumps",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "scoreAtJump",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "multiplierAtJump",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "games",
    "outputs": [
      {
        "internalType": "address",
        "name": "player",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "startTime",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "endTime",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "finalScore",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "totalJumps",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "ended",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "gameId",
        "type": "uint256"
      }
    ],
    "name": "getGameInfo",
    "outputs": [
      {
        "internalType": "address",
        "name": "player",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "startTime",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "endTime",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "finalScore",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "totalJumps",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "ended",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "gameId",
        "type": "uint256"
      }
    ],
    "name": "getGameJumps",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "scoreAtJump",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "multiplierAtJump",
            "type": "uint256"
          }
        ],
        "internalType": "struct FlappyFuse.JumpData[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "player",
        "type": "address"
      }
    ],
    "name": "startGame",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "gameId",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalGames",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getLeaderboard",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "player",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "score",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
          }
        ],
        "internalType": "struct FlappyFuse.LeaderboardEntry[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Update network details
export const NETWORK_DETAILS = {
  name: 'Fuse-Flash',
  chainId: '0x2AA8',
  rollupId: ROLLUP_ID,
  nativeCurrency: {
    name: 'FUSE',
    symbol: 'FUSE',
    decimals: 18,
    sepoliaContract: GAS_TOKEN.sepoliaContract
  },
  rpcUrls: RPC_ENDPOINTS,
  blockExplorerUrls: ['https://fuse-flash.explorer.quicknode.com'],
  faucet: 'https://faucet.quicknode.com/fuse/flash',
  bridge: 'https://fuse-flash.bridge.quicknode.com/',
  bridgeApi: 'https://fuse-flash-api.bridge.quicknode.com/'
};

// Update the switchToFuseFlash function for better error handling and network management
export const switchToFuseFlash = async () => {
  try {
    console.log('Switching to Fuse-Flash network...');
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    // Get current chain ID first
    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
    console.log('Current chain ID:', currentChainId);
    
    // Target chain ID - always stored in lowercase for comparison
    const targetChainIdLower = '0x2aa8';
    const currentChainIdLower = currentChainId ? currentChainId.toString().toLowerCase() : '';
    
    // If already on correct network (case-insensitive comparison), return early
    if (currentChainIdLower === targetChainIdLower) {
      console.log('Already on Fuse-Flash network');
      return;
    }

    try {
      // Attempt to switch to the network first
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2AA8' }],
      });
      console.log('Successfully switched to Fuse-Flash network');
    } catch (switchError: any) {
      console.log('Switch error:', switchError);
      
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        console.log('Network not found in MetaMask, adding it...');
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x2AA8',
              chainName: 'Fuse-Flash',
              nativeCurrency: {
                name: 'FUSE',
                symbol: 'FUSE',
                decimals: 18
              },
              rpcUrls: RPC_ENDPOINTS,
              blockExplorerUrls: ['https://fuse-flash.explorer.quicknode.com']
            }],
          });
          
          // Verify the network was added and selected (case-insensitive)
          const newChainId = await window.ethereum.request({ method: 'eth_chainId' });
          const newChainIdLower = newChainId ? newChainId.toString().toLowerCase() : '';
          
          if (newChainIdLower !== targetChainIdLower) {
            console.error('Network was added but not selected. Current chain:', newChainId);
            throw new Error('Please select the Fuse-Flash network in MetaMask');
          }
          
          console.log('Fuse-Flash network successfully added and selected');
        } catch (addError) {
          console.error('Error adding Fuse-Flash network:', addError);
          throw new Error('Failed to add Fuse-Flash network to MetaMask. Please add it manually.');
        }
      } else if (switchError.code === 4001) {
        // User rejected the request
        throw new Error('Please approve the network switch request in MetaMask');
      } else {
        console.error('Error switching to Fuse-Flash network:', switchError);
        throw new Error('Failed to switch to Fuse-Flash network. Please try manually switching in MetaMask.');
      }
    }
    
    // Final verification (case-insensitive)
    const finalChainId = await window.ethereum.request({ method: 'eth_chainId' });
    const finalChainIdLower = finalChainId ? finalChainId.toString().toLowerCase() : '';
    
    if (finalChainIdLower !== targetChainIdLower) {
      throw new Error(`Network switch failed. Current chain: ${finalChainId}, expected: 0x2AA8`);
    }
  } catch (error: any) {
    console.error('Network switch failed:', error);
    throw error;
  }
};

// Keep the old function name for backward compatibility
export const switchToFuseTestnet = switchToFuseFlash;