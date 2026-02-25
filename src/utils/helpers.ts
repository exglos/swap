import { ethers } from 'ethers';

export const formatAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatAmount = (amount: string | number, decimals: number = 6): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0';
  return num.toFixed(decimals);
};

export const isValidAddress = (address: string): boolean => {
  try {
    return ethers.utils.isAddress(address);
  } catch {
    return false;
  }
};

export const parseInputAmount = (amount: string, decimals: number): bigint => {
  try {
    return BigInt(ethers.utils.parseUnits(amount, decimals).toString());
  } catch {
    return BigInt(0);
  }
};

export const formatUnitsToString = (amount: bigint, decimals: number): string => {
  try {
    return ethers.utils.formatUnits(amount, decimals);
  } catch {
    return '0';
  }
};

export const calculateDeadline = (minutes: number = 20): number => {
  return Math.floor(Date.now() / 1000) + minutes * 60;
};
