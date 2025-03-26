import React from 'react';
import { GameTransaction } from '../types/transactions';

interface Props {
  transactions: GameTransaction[];
}

export function TransactionTable({ transactions }: Props) {
  if (transactions.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 bg-gray-800/90 rounded-lg p-6 max-w-2xl mx-auto backdrop-blur-sm border border-gray-700">
      <h3 className="text-xl font-bold mb-4 text-white">Recent Transactions</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700 bg-gray-800/50">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-gray-700/50 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`capitalize font-medium ${
                    tx.type === 'start' ? 'text-green-400' :
                    tx.type === 'end' ? 'text-red-400' :
                    'text-blue-400'
                  }`}>
                    {tx.type}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${tx.status === 'confirmed' ? 'bg-green-100 text-green-800' : 
                      tx.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-red-100 text-red-800'}`}>
                    {tx.status}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  {new Date(tx.timestamp).toLocaleTimeString()}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {tx.hash ? (
                    <a 
                      href={`https://testnet.monadexplorer.com/tx/${tx.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      View
                    </a>
                  ) : tx.error ? (
                    <span className="text-red-400">{tx.error}</span>
                  ) : (
                    tx.data && `${tx.data.jumps} jumps`
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 