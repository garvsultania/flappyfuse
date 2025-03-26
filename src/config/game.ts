import { GameConfig } from '../types';

export const DEFAULT_GAME_CONFIG: GameConfig = {
  // Canvas dimensions
  canvasWidth: 800,
  canvasHeight: 600,
  groundHeight: 100,

  // Bird properties
  birdWidth: 40,
  birdHeight: 30,
  birdStartX: 200,
  birdStartY: 300,
  jumpForce: 400,
  gravity: 1200,
  maxVelocity: 600,

  // Pipe properties
  pipeWidth: 60,
  pipeGap: 150,
  pipeSpawnInterval: 2000,
  minPipeHeight: 100,
  maxPipeHeight: 400,
  pipeSpeed: 200,

  // Game settings
  difficultyIncrease: 0.1,
  scoreMultiplier: 1,
  maxFPS: 60,
  soundVolume: 0.7,
  musicVolume: 0.3,
};

export const GAME_DIFFICULTY_LEVELS = {
  EASY: {
    pipeGap: 180,
    pipeSpeed: 150,
    gravity: 1000,
    jumpForce: 350,
  },
  NORMAL: {
    pipeGap: 150,
    pipeSpeed: 200,
    gravity: 1200,
    jumpForce: 400,
  },
  HARD: {
    pipeGap: 120,
    pipeSpeed: 250,
    gravity: 1400,
    jumpForce: 450,
  },
};

export const GAME_ASSET_PATHS = {
  bird: '/assets/bird.png',
  pipe: '/assets/pipe.png',
  background: '/assets/background.png',
  ground: '/assets/ground.png',
};

export const GAME_SOUND_PATHS = {
  jump: '/sounds/jump.mp3',
  score: '/sounds/score.mp3',
  hit: '/sounds/hit.mp3',
  gameOver: '/sounds/game-over.mp3',
  background: '/sounds/background.mp3',
};

export const GAME_ACHIEVEMENTS = [
  {
    id: 'first_flight',
    name: 'First Flight',
    description: 'Play your first game',
    icon: '🐣',
    requirement: 1,
  },
  {
    id: 'high_flyer',
    name: 'High Flyer',
    description: 'Score 50 points in a single game',
    icon: '🦅',
    requirement: 50,
  },
  {
    id: 'marathon_bird',
    name: 'Marathon Bird',
    description: 'Play 100 games',
    icon: '🏃',
    requirement: 100,
  },
  {
    id: 'master_pilot',
    name: 'Master Pilot',
    description: 'Score 100 points in a single game',
    icon: '👨‍✈️',
    requirement: 100,
  },
  {
    id: 'legendary_bird',
    name: 'Legendary Bird',
    description: 'Score 200 points in a single game',
    icon: '🌟',
    requirement: 200,
  },
];

export const GAME_RANKS = [
  { tier: 'Bronze', minPoints: 0, icon: '🥉' },
  { tier: 'Silver', minPoints: 1000, icon: '🥈' },
  { tier: 'Gold', minPoints: 5000, icon: '🥇' },
  { tier: 'Platinum', minPoints: 10000, icon: '💎' },
  { tier: 'Diamond', minPoints: 25000, icon: '👑' },
  { tier: 'Master', minPoints: 50000, icon: '🌟' },
  { tier: 'Grandmaster', minPoints: 100000, icon: '🔥' },
]; 