export interface GameTransaction {
  id: string;
  type: 'jump' | 'start' | 'end';
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
  hash?: string;
  error?: string;
  data?: any;
} 