# Flappy Fuse

A modern, accessible, and performant Flappy Bird-inspired game built with React, TypeScript, and Vite.

## Features

- 🎮 Classic Flappy Bird gameplay
- 🎨 Modern UI with smooth animations
- ♿️ Full accessibility support
- 📱 Responsive design
- 🚀 Optimized performance
- 🔒 Secure by default

## Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/flappy-fuse.git
cd flappy-fuse
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

4. Start the development server:
```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run tests
- `npm run coverage` - Generate test coverage report
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript type checking

## Project Structure

```
src/
├── components/     # React components
├── hooks/         # Custom React hooks
├── types/         # TypeScript type definitions
├── utils/         # Utility functions
├── config/        # Configuration files
├── App.tsx        # Main App component
└── main.tsx       # Application entry point
```

## Performance Optimization

- Code splitting with dynamic imports
- Asset compression and optimization
- Lazy loading of components
- Efficient state management
- Optimized build configuration

## Accessibility

- ARIA attributes for screen readers
- Keyboard navigation support
- High contrast mode support
- Focus management
- Semantic HTML structure

## Testing

- Unit tests with Vitest
- Component testing with React Testing Library
- End-to-end testing support
- Code coverage reporting

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Security

Please report any security issues to security@example.com.

## Support

For support, email support@example.com or open an issue in the repository.

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

- **Network**: Fuse-Flash
- **Chain ID**: 10920 (0x2AA8)
- **Rollup ID**: 1
- **Gas Token**: FUSE - Sepolia SC: 0x9dB48D9FB1E306B14c7bB1336e4D0A0E6b5753eb
- **RPC URL**: https://ancient-quiet-shape.fuse-flash.quiknode.pro/0dacde97e109a50913bcc7fae9ee69d964f84fe2/
- **Explorer**: https://fuse-flash.explorer.quicknode.com
- **Faucet**: https://faucet.quicknode.com/fuse/flash
- **Bridge**: https://fuse-flash.bridge.quicknode.com/
- **Bridge API**: https://fuse-flash-api.bridge.quicknode.com/