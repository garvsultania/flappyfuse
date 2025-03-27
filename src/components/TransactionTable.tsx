import React from 'react';
import { ChevronRight, Bird, Trophy, Cloud } from 'lucide-react';

interface Transaction {
  id: string;
  type: 'start' | 'jump' | 'end';
  timestamp: number;
  hash?: string;
  status: 'pending' | 'confirmed' | 'failed';
  data?: {
    gameId?: string;
    finalScore?: number;
  };
}

interface TransactionTableProps {
  transactions: Transaction[];
}

export function TransactionTable({ transactions }: TransactionTableProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-white/40 text-sm">No transaction history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#1e1e2f]">
      {transactions
        .slice()
        .sort((a, b) => b.timestamp - a.timestamp)
        .map((tx) => (
          <div
            key={tx.id}
            className="bg-[#1a1a25] rounded-sm p-3 border border-white/5 hover:border-[#6C5DD3]/20 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-sm flex items-center justify-center ${
                    tx.type === 'jump'
                      ? 'bg-[#6C5DD3]/10'
                      : tx.type === 'start'
                      ? 'bg-green-500/10'
                      : 'bg-purple-500/10'
                  }`}
                >
                  {tx.type === 'jump' ? (
                    <Cloud className="w-3 h-3 text-[#6C5DD3]" />
                  ) : tx.type === 'start' ? (
                    <Bird className="w-3 h-3 text-green-400" />
                  ) : (
                    <Trophy className="w-3 h-3 text-purple-400" />
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={`text-xs font-medium ${
                      tx.type === 'jump'
                        ? 'text-[#6C5DD3]'
                        : tx.type === 'start'
                        ? 'text-green-400'
                        : 'text-purple-400'
                    }`}
                  >
                    {tx.type === 'jump'
                      ? 'Jump'
                      : tx.type === 'start'
                      ? 'Start'
                      : 'End'}
                  </span>
                  <span className="mx-1.5 text-white/30">•</span>
                  <span className="text-xs text-white/40">
                    {new Date(tx.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-sm text-xs font-medium ${
                  tx.status === 'confirmed'
                    ? 'bg-green-500/10 text-green-400'
                    : tx.status === 'pending'
                    ? 'bg-yellow-500/10 text-yellow-400'
                    : 'bg-red-500/10 text-red-400'
                }`}
              >
                {tx.status === 'confirmed'
                  ? 'Confirmed'
                  : tx.status === 'pending'
                  ? 'Pending'
                  : 'Failed'}
              </span>
            </div>

            {/* Transaction Details - Only show if exists */}
            {(tx.hash || (tx.type === 'end' && tx.data)) && (
              <div className="mt-2 pt-2 border-t border-white/5">
                {tx.hash && (
                  <a
                    href={`https://explorer.fuse.io/tx/${tx.hash}/internal-transactions`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between text-xs text-[#6C5DD3] hover:text-[#8F7FF7] transition-colors px-2 py-1 bg-[#1a1a20] rounded-sm mb-2"
                  >
                    <span className="flex items-center gap-1">
                      <ChevronRight className="w-3 h-3" />
                      View on Explorer
                    </span>
                    <span className="font-mono text-white/40 text-[10px]">
                      {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                    </span>
                  </a>
                )}

                {tx.type === 'end' && tx.data && (
                  <div className="flex flex-wrap gap-2 text-xs text-white/50">
                    {tx.data.gameId && (
                      <div className="bg-[#1a1a20] px-2 py-1 rounded-sm">
                        Game #{tx.data.gameId}
                      </div>
                    )}
                    {tx.data.finalScore !== undefined && (
                      <div className="bg-[#1a1a20] px-2 py-1 rounded-sm text-[#4ADE80]">
                        Score: {tx.data.finalScore}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
    </div>
  );
} 