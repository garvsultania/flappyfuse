import { ethers } from 'ethers';

export const shortenAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatEther = (wei: ethers.BigNumber): string => {
  return ethers.utils.formatEther(wei);
};

export const parseEther = (ether: string): ethers.BigNumber => {
  return ethers.utils.parseEther(ether);
};

export const isValidAddress = (address: string): boolean => {
  try {
    ethers.utils.getAddress(address);
    return true;
  } catch {
    return false;
  }
};

export const getNetworkName = (chainId: number): string => {
  switch (chainId) {
    case 1:
      return 'Ethereum Mainnet';
    case 5:
      return 'Goerli Testnet';
    case 137:
      return 'Polygon Mainnet';
    case 80001:
      return 'Mumbai Testnet';
    default:
      return 'Unknown Network';
  }
};

export const getExplorerUrl = (chainId: number, hash: string, type: 'tx' | 'address' = 'tx'): string => {
  let baseUrl = '';
  switch (chainId) {
    case 1:
      baseUrl = 'https://etherscan.io';
      break;
    case 5:
      baseUrl = 'https://goerli.etherscan.io';
      break;
    case 137:
      baseUrl = 'https://polygonscan.com';
      break;
    case 80001:
      baseUrl = 'https://mumbai.polygonscan.com';
      break;
    default:
      return '';
  }
  return `${baseUrl}/${type}/${hash}`;
};

export const formatGasPrice = (gasPrice: ethers.BigNumber): string => {
  const gweiValue = ethers.utils.formatUnits(gasPrice, 'gwei');
  return `${parseFloat(gweiValue).toFixed(2)} Gwei`;
};

export const estimateTransactionCost = (
  gasPrice: ethers.BigNumber,
  gasLimit: ethers.BigNumber
): ethers.BigNumber => {
  return gasPrice.mul(gasLimit);
};

export const waitForTransaction = async (
  provider: ethers.providers.Provider,
  txHash: string,
  confirmations = 1
): Promise<ethers.providers.TransactionReceipt> => {
  return provider.waitForTransaction(txHash, confirmations);
};

export const getContractEvents = async (
  contract: ethers.Contract,
  eventName: string,
  fromBlock: number,
  toBlock: number | 'latest' = 'latest'
): Promise<ethers.Event[]> => {
  const filter = contract.filters[eventName]();
  return contract.queryFilter(filter, fromBlock, toBlock);
}; 