import { ethers } from 'ethers';
import { UNIVERSAL_ROUTER_ADDRESS } from './constants';

/**
 * V4 Security Utilities
 * 
 * Production-ready security features including Permit2 integration,
 * transaction simulation, and error handling.
 */

/**
 * Permit2 signature for gasless approvals
 */
export interface Permit2Signature {
  token: string;
  amount: string;
  deadline: number;
  nonce: number;
  signature: string;
}

/**
 * Simulate a transaction before sending
 * 
 * This prevents failed transactions and provides detailed error messages
 */
export async function simulateTransaction(
  contract: ethers.Contract,
  method: string,
  args: any[],
  overrides: any = {}
): Promise<{ success: boolean; error?: string; gasEstimate?: bigint }> {
  try {
    // Use staticCall to simulate the transaction
    await contract[method].staticCall(...args, overrides);
    
    // If simulation succeeds, estimate gas
    const gasEstimate = await contract[method].estimateGas(...args, overrides);
    
    return {
      success: true,
      gasEstimate: gasEstimate + (gasEstimate * 20n / 100n), // Add 20% buffer
    };
  } catch (error: any) {
    // Parse the error to provide user-friendly feedback
    const errorMessage = parseContractError(error);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Parse contract revert errors into user-friendly messages
 */
export function parseContractError(error: any): string {
  if (error.data) {
    try {
      // Try to decode the error using common error selectors
      const errorData = error.data;
      
      // Common Uniswap errors
      if (errorData.includes('0x')) {
        const selector = errorData.slice(0, 10);
        
        const knownErrors: Record<string, string> = {
          '0x025dbdd4': 'Insufficient liquidity',
          '0xf4844814': 'Price slippage too high',
          '0x4e487b71': 'Arithmetic overflow/underflow',
          '0x08c379a0': 'Generic revert', // Standard revert
        };
        
        if (knownErrors[selector]) {
          return knownErrors[selector];
        }
      }
    } catch (e) {
      // Fall through to generic error
    }
  }
  
  // Extract message from error
  if (error.reason) return error.reason;
  if (error.message) return error.message;
  
  return 'Transaction would fail';
}

/**
 * Check token approval and return approval transaction if needed
 */
export async function checkAndApproveToken(
  tokenAddress: string,
  owner: string,
  amount: bigint,
  signer: ethers.Signer
): Promise<ethers.ContractTransaction | null> {
  const tokenContract = new ethers.Contract(
    tokenAddress,
    [
      'function allowance(address owner, address spender) view returns (uint256)',
      'function approve(address spender, uint256 amount) returns (bool)',
    ],
    signer
  );

  const allowance = await tokenContract.allowance(owner, UNIVERSAL_ROUTER_ADDRESS);
  
  if (allowance < amount) {
    // Approve max uint256 for better UX (one-time approval)
    const approveTx = await tokenContract.approve(
      UNIVERSAL_ROUTER_ADDRESS,
      ethers.constants.MaxUint256
    );
    return approveTx;
  }
  
  return null;
}

/**
 * Create Permit2 signature for gasless approval
 * 
 * This is the recommended way to handle approvals with Universal Router
 */
export async function createPermit2Signature(
  token: string,
  amount: string,
  deadline: number,
  signer: ethers.Signer,
  chainId: number
): Promise<Permit2Signature> {
  const PERMIT2_ADDRESS = '0x000000000022d473030f116ddee9f6b43ac78ba3';
  
  const domain = {
    name: 'Permit2',
    chainId,
    verifyingContract: PERMIT2_ADDRESS,
  };

  const types = {
    PermitSingle: [
      { name: 'details', type: 'PermitDetails' },
      { name: 'spender', type: 'address' },
      { name: 'sigDeadline', type: 'uint256' },
    ],
    PermitDetails: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
      { name: 'nonce', type: 'uint48' },
    ],
  };

  const nonce = Math.floor(Math.random() * 1000000);
  
  const value = {
    details: {
      token,
      amount,
      expiration: deadline,
      nonce,
    },
    spender: UNIVERSAL_ROUTER_ADDRESS,
    sigDeadline: deadline,
  };

  const signature = await (signer as any)._signTypedData(domain, types, value);

  return {
    token,
    amount,
    deadline,
    nonce,
    signature,
  };
}

/**
 * Calculate safe deadline based on network conditions
 */
export function calculateSafeDeadline(
  baseMinutes: number = 20,
  networkCongestion: 'low' | 'medium' | 'high' = 'medium'
): number {
  const congestionMultiplier = {
    low: 1,
    medium: 1.5,
    high: 2,
  };
  
  const adjustedMinutes = baseMinutes * congestionMultiplier[networkCongestion];
  return Math.floor(Date.now() / 1000) + (adjustedMinutes * 60);
}

/**
 * Validate transaction parameters before sending
 */
export function validateTransactionParams(params: {
  amount: string;
  minAmount: string;
  deadline: number;
  recipient: string;
}): { valid: boolean; error?: string } {
  const { amount, minAmount, deadline, recipient } = params;
  
  // Check amounts
  if (BigInt(amount) <= 0n) {
    return { valid: false, error: 'Amount must be greater than 0' };
  }
  
  if (BigInt(minAmount) > BigInt(amount)) {
    return { valid: false, error: 'Minimum amount cannot exceed input amount' };
  }
  
  // Check deadline
  const now = Math.floor(Date.now() / 1000);
  if (deadline <= now) {
    return { valid: false, error: 'Deadline has already passed' };
  }
  
  // Check recipient
  if (!ethers.utils.isAddress(recipient)) {
    return { valid: false, error: 'Invalid recipient address' };
  }
  
  return { valid: true };
}

/**
 * Retry failed transactions with exponential backoff
 */
export async function retryTransaction<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (i === maxRetries - 1) throw error;
      
      // Don't retry on user rejection or invalid params
      if (error.code === 'ACTION_REJECTED' || error.code === 'INVALID_ARGUMENT') {
        throw error;
      }
      
      // Exponential backoff
      const delay = baseDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Max retries exceeded');
}
