import { ethers } from 'ethers';

/**
 * Convert an address to properly checksummed format
 * Prevents "bad address checksum" errors in ethers v5
 */
export function toChecksumAddress(address: string): string {
  try {
    return ethers.utils.getAddress(address.toLowerCase());
  } catch (error) {
    throw new Error(`Invalid address format: ${address}`);
  }
}

/**
 * Safe address validation and checksumming
 */
export function validateAndChecksumAddress(address: string): string {
  if (!address || typeof address !== 'string') {
    throw new Error('Address must be a non-empty string');
  }
  
  if (!address.startsWith('0x') || address.length !== 42) {
    throw new Error(`Invalid address length: ${address}`);
  }
  
  return toChecksumAddress(address);
}
