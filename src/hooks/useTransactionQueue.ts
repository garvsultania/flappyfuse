import { useEffect, useState, useCallback } from 'react';

export interface QueuedTransaction {
  id: string;
  type: 'start' | 'end' | 'jump';
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
  hash?: string;
  data?: any;
  error?: string;
}

const TRANSACTION_STORAGE_KEY = 'flappyFuse_transactionQueue';

export function useTransactionQueue() {
  const [queue, setQueue] = useState<QueuedTransaction[]>([]);
  const [isPending, setIsPending] = useState(false);

  // Load queue from localStorage on mount
  useEffect(() => {
    try {
      const savedQueue = localStorage.getItem(TRANSACTION_STORAGE_KEY);
      if (savedQueue) {
        const parsedQueue = JSON.parse(savedQueue);
        setQueue(parsedQueue);
        
        // Check if any transaction is pending
        const hasPending = parsedQueue.some(tx => tx.status === 'pending');
        setIsPending(hasPending);
      }
    } catch (error) {
      console.error('Failed to load transaction queue:', error);
    }
  }, []);

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(TRANSACTION_STORAGE_KEY, JSON.stringify(queue));
      
      // Update pending status
      const hasPending = queue.some(tx => tx.status === 'pending');
      setIsPending(hasPending);
    } catch (error) {
      console.error('Failed to save transaction queue:', error);
    }
  }, [queue]);

  // Add function to check and fix pending state
  const checkAndFixPendingState = useCallback(() => {
    const actuallyHasPending = queue.some(tx => tx.status === 'pending');
    if (isPending !== actuallyHasPending) {
      console.log('Fixed pending status mismatch:', { isPending, actuallyHasPending });
      setIsPending(actuallyHasPending);
      return actuallyHasPending;
    }
    return isPending;
  }, [queue, isPending]);

  // Update queue management
  const addToQueue = useCallback((transaction: QueuedTransaction) => {
    setQueue(prev => {
      const newQueue = [...prev, transaction];
      const hasPending = newQueue.some(tx => tx.status === 'pending');
      setIsPending(hasPending);
      return newQueue;
    });
  }, []);

  const updateTransaction = useCallback((id: string, updates: Partial<QueuedTransaction>) => {
    setQueue(prev => {
      const newQueue = prev.map(tx => 
        tx.id === id ? { ...tx, ...updates } : tx
      );
      const hasPending = newQueue.some(tx => tx.status === 'pending');
      setIsPending(hasPending);
      return newQueue;
    });
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setIsPending(false);
  }, []);

  // Add effect to periodically check and fix pending state
  useEffect(() => {
    const intervalId = setInterval(() => {
      checkAndFixPendingState();
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(intervalId);
  }, [checkAndFixPendingState]);

  // Check if we can process a transaction of given type
  const canProcessTransaction = useCallback((type: string) => {
    // Don't allow new transactions if any transaction is pending
    return !isPending;
  }, [isPending]);

  // Clear old transactions
  const clearOldTransactions = useCallback(() => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    setQueue(prevQueue => {
      // Keep transactions that are either pending or recent
      return prevQueue.filter(tx => 
        tx.status === 'pending' || tx.timestamp > oneHourAgo
      );
    });
  }, []);

  // Force save queue to localStorage
  const forceSave = useCallback(() => {
    // Get the current queue directly from state
    setQueue(currentQueue => {
      console.log('Force saving transaction queue to localStorage:', currentQueue);
      try {
        localStorage.setItem(TRANSACTION_STORAGE_KEY, JSON.stringify(currentQueue));
        console.log('Transaction queue force-saved successfully, queue size:', currentQueue.length);
      } catch (error) {
        console.error('Failed to force save transaction queue:', error);
      }
      return currentQueue;
    });
  }, []);

  // Fix for localStorage persistence issues
  useEffect(() => {
    // Force update localStorage with current queue every minute
    const interval = setInterval(() => {
      try {
        forceSave();
      } catch (error) {
        console.error('Failed to update localStorage in interval:', error);
      }
    }, 10000); // Reduce interval to 10 seconds for faster debugging
    
    return () => clearInterval(interval);
  }, [queue, forceSave]);

  // Setup interval to clear old transactions
  useEffect(() => {
    const interval = setInterval(clearOldTransactions, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [clearOldTransactions]);

  return {
    queue,
    isPending,
    addToQueue,
    updateTransaction,
    canProcessTransaction,
    clearOldTransactions,
    clearQueue,
    forceSave,
    checkAndFixPendingState
  };
} 