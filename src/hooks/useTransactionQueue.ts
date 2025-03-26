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

  // Add a transaction to the queue
  const addToQueue = useCallback((transaction: QueuedTransaction) => {
    console.log('Adding transaction to queue:', transaction);
    
    // Ensure status is a string
    const normalizedStatus = String(transaction.status);
    
    setQueue(prevQueue => {
      // If this transaction already exists, update it
      const existingIndex = prevQueue.findIndex(tx => tx.id === transaction.id);
      
      if (existingIndex >= 0) {
        console.log('Updating existing transaction:', prevQueue[existingIndex], 'with:', transaction);
        const newQueue = [...prevQueue];
        
        // Ensure status changes from pending to confirmed are applied
        if (normalizedStatus === 'confirmed' && newQueue[existingIndex].status === 'pending') {
          console.log('Updating transaction status from pending to confirmed');
        }
        
        newQueue[existingIndex] = {
          ...newQueue[existingIndex],
          ...transaction,
          // Explicitly normalize status to string
          status: normalizedStatus,
          // Preserve hash if not provided in the update
          hash: transaction.hash || newQueue[existingIndex].hash
        };
        
        console.log('Updated transaction:', newQueue[existingIndex]);
        return newQueue;
      }
      
      // Otherwise add it
      console.log('Adding new transaction to queue');
      return [...prevQueue, {
        ...transaction,
        // Explicitly normalize status to string
        status: normalizedStatus
      }];
    });
    
    // Force save to localStorage immediately for status updates
    if (transaction.status === 'confirmed') {
      setTimeout(() => {
        console.log('Forcing save after status update to confirmed');
        localStorage.setItem(TRANSACTION_STORAGE_KEY, JSON.stringify(queue));
      }, 100);
    }
  }, [queue]);

  // Update a transaction in the queue
  const updateTransaction = useCallback((id: string, updates: Partial<QueuedTransaction>) => {
    console.log('Updating transaction with id:', id, 'Updates:', updates);
    
    // Ensure status is a string if present
    const normalizedUpdates = { 
      ...updates,
      status: updates.status ? String(updates.status) : undefined
    };
    
    setQueue(prevQueue => {
      const index = prevQueue.findIndex(tx => tx.id === id);
      if (index === -1) {
        console.log('Transaction not found:', id);
        return prevQueue;
      }
      
      console.log('Found transaction at index:', index, 'Current state:', prevQueue[index]);
      const newQueue = [...prevQueue];
      
      // Ensure we don't change confirmed status back to pending
      if (normalizedUpdates.status === 'pending' && newQueue[index].status === 'confirmed') {
        console.log('Preventing confirmed -> pending status change');
        const { status, ...otherUpdates } = normalizedUpdates;
        newQueue[index] = {
          ...newQueue[index],
          ...otherUpdates
        };
      } else {
        newQueue[index] = {
          ...newQueue[index],
          ...normalizedUpdates
        };
      }
      
      console.log('Updated transaction:', newQueue[index]);
      
      // Force save to localStorage immediately if we're updating to confirmed status
      if (normalizedUpdates.status === 'confirmed') {
        setTimeout(() => {
          console.log('Forcing save after status update to confirmed via updateTransaction');
          localStorage.setItem(TRANSACTION_STORAGE_KEY, JSON.stringify(newQueue));
        }, 100);
      }
      
      return newQueue;
    });
  }, []);

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

  // Add a function to manually clear the queue for debugging
  const clearQueue = useCallback(() => {
    console.log('Clearing transaction queue from localStorage and state');
    localStorage.removeItem(TRANSACTION_STORAGE_KEY);
    setQueue([]);
    setIsPending(false);
  }, []);

  // Add a function to force save queue to localStorage
  const forceSave = useCallback(() => {
    console.log('Force saving transaction queue to localStorage:', queue);
    localStorage.setItem(TRANSACTION_STORAGE_KEY, JSON.stringify(queue));
  }, [queue]);

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
    forceSave
  };
} 