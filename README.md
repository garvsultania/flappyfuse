# 🎮 Flappy Fuse

A blockchain-powered version of the classic Flappy Bird game, built on the Fuse Flash Network. This game demonstrates the power of on-chain gaming by recording player actions and scores while providing an engaging gaming experience.


## 🌟 Features

### Core Game Mechanics
- **Classic Flappy Bird Gameplay**: Navigate through pipes using space bar or mouse clicks
- **Smooth Physics**: Realistic gravity and jump mechanics
- **Dynamic Difficulty**: Balanced for better playability
- **Responsive Controls**: Space bar or mouse click to jump

### Blockchain Integration
- **On-Chain Score Recording**: All game scores are recorded on the Fuse Flash Network
- **Transaction Batching**: Efficient gas usage by batching all game actions
- **Wallet Integration**: Connect your wallet to start playing
- **Verifiable Gameplay**: All actions are recorded and verifiable on-chain

### UI Features
- **Polished Interface**: Clean, modern design with Fuse branding
- **Detailed Game Over Screen**: 
  - Final score display
  - Total jumps
  - Game ID
  - Transaction status
- **Responsive Design**: Works on both desktop and mobile devices
- **Visual Effects**: 
  - Dynamic backgrounds
  - Smooth transitions
  - Loading states

## 🔧 Technical Stack

- **Frontend**:
  - React 18
  - TypeScript
  - Vite
  - Tailwind CSS
  - Lucide React Icons

- **Smart Contract Integration**:
  ```solidity
  // Core Functions
  function startGame(address player) external returns (uint256 gameId);
  function endGame(
      uint256 gameId,
      uint256 finalScore,
      uint256 totalJumps,
      JumpData[] calldata jumps
  ) external;
  ```

## 🎯 Game Data Structure

### Jump Data
```typescript
interface JumpData {
  timestamp: number;
  scoreAtJump: number;
  multiplierAtJump: number;
}
```

### Game State
```typescript
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
```

## 🚀 Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Connect your wallet to start playing

## 🎮 How to Play

1. Connect your wallet using the "Connect Wallet" button
2. Get FUSE tokens from the faucet if needed
3. Click "Start Game" to begin
4. Press SPACE or click to make the bird jump
5. Avoid pipes and collect points
6. Game ends when you hit a pipe or leave the screen
7. View your final score and statistics

## 🏆 Scoring System

- **Base Points**: 1 point per pipe cleared
- **Simple Scoring**: Focus on achieving the highest score possible

## 🔗 Blockchain Features

### Transaction Batching
Instead of sending individual transactions for each jump, the game batches all actions and sends them together at the end of each game session. This approach:
- Reduces gas costs
- Improves user experience
- Maintains game state integrity

### Data Recording
Each game session records:
- Total score
- Number of jumps
- Timestamp of each jump
- Score at each jump

## 🛠 Development

### Running Tests
```bash
npm run test
```

### Building for Production
```bash
npm run build
```

## 🔜 Future Enhancements

- Global leaderboard
- Achievement system
- Power-ups and special abilities
- Multiplayer challenges
- Social sharing features
- Enhanced visual effects

## 📝 License

MIT License - feel free to use this code for your own projects!

## 🌐 Network Details

- **Network**: Fuse Network
- **Chain ID**: 122
- **RPC URL**: https://rpc.fuse.io
- **Explorer**: https://explorer.fuse.io
- **Faucet**: https://stakely.io/faucet/fuse-network
- **Bridge**: https://app.voltage.finance/bridge
- **Currency**: FUSE