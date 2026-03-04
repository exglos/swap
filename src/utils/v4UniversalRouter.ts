import { ethers } from 'ethers';
import { Token } from '@uniswap/sdk-core';
import { Actions, V4Planner } from '@uniswap/v4-sdk';
import { CommandType, RoutePlanner } from '@uniswap/universal-router-sdk';
import { UNIVERSAL_ROUTER_ADDRESS, UNIVERSAL_ROUTER_ABI, PERMIT2_ADDRESS, PERMIT2_ABI } from './constants';

/**
 * V4 Universal Router Helper
 * 
 * Handles V4 swap execution through Universal Router with official V4Planner.
 * V4 requires batched operations using the Universal Router - direct pool calls are not supported.
 * 
 * Uses official V4Planner and RoutePlanner classes from @uniswap/v4-sdk and @uniswap/universal-router-sdk.
 */

/**
 * V4 PoolKey structure
 * Required for V4 swap operations
 */
interface PoolKey {
  currency0: string;
  currency1: string;
  fee: number;
  tickSpacing: number;
  hooks: string;
}

interface V4SwapParams {
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  amountOut: string;
  minAmountOut?: string;
  fee: number;
  poolId: string;
  isBuying: boolean;
  deadline?: number;
}

/**
 * Execute a V4 swap through Universal Router
 * 
 * V4 Architecture:
 * 1. Create V4Planner to batch operations
 * 2. Add swap with SETTLE (pay) and TAKE (receive) patterns
 * 3. Encode commands and inputs
 * 4. Send to Universal Router
 */
export async function executeV4Swap(
  params: V4SwapParams,
  signer: ethers.Signer
): Promise<ethers.ContractTransaction> {
  const {
    tokenIn,
    tokenOut,
    amountIn,
    fee,
    isBuying,
  } = params;

  // Calculate deadline (20 minutes from now)
  const deadline = Math.floor(Date.now() / 1000) + 1200;

  // Parse amounts (convert BigNumber to bigint for v5)
  const amountInWei = BigInt(ethers.utils.parseUnits(amountIn, tokenIn.decimals).toString());
  
  // Calculate minimum amount out with slippage (use minAmountOut from params if provided)
  const minAmountOut = params.minAmountOut 
    ? BigInt(params.minAmountOut)
    : BigInt(0); // Will be calculated from route if not provided

  const poolKey: PoolKey = {
    currency0: tokenIn.address < tokenOut.address ? tokenIn.address : tokenOut.address,
    currency1: tokenIn.address < tokenOut.address ? tokenOut.address : tokenIn.address,
    fee,
    tickSpacing: 60, // Standard tick spacing for most pools
    hooks: ethers.constants.AddressZero, // No hooks for basic swap
  };

  // Determine swap direction (zeroForOne)
  const zeroForOne = tokenIn.address < tokenOut.address;

  // Use official V4Planner from @uniswap/v4-sdk
  const v4Planner = new V4Planner();
  const routePlanner = new RoutePlanner();

  // Add V4 actions in correct order per documentation
  v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [
    {
      poolKey,
      zeroForOne,
      amountIn: amountInWei.toString(),
      amountOutMinimum: (minAmountOut || BigInt(0)).toString(),
      hookData: '0x'
    }
  ]);
  
  // SETTLE_ALL: Pay the input currency
  // TAKE_ALL: Receive the output currency
  // These depend on swap direction (zeroForOne)
  const inputCurrency = zeroForOne ? poolKey.currency0 : poolKey.currency1;
  const outputCurrency = zeroForOne ? poolKey.currency1 : poolKey.currency0;
  
  v4Planner.addAction(Actions.SETTLE_ALL, [
    inputCurrency,
    amountInWei.toString(),
  ]);
  v4Planner.addAction(Actions.TAKE_ALL, [
    outputCurrency,
    minAmountOut?.toString() || '0',
  ]);

  // Finalize V4 planner to get encoded actions
  const encodedActions = v4Planner.finalize();

  // Add V4_SWAP command to route planner with encoded actions
  routePlanner.addCommand(CommandType.V4_SWAP, [encodedActions]);

  // Create Universal Router contract instance
  const universalRouter = new ethers.Contract(
    UNIVERSAL_ROUTER_ADDRESS,
    UNIVERSAL_ROUTER_ABI,
    signer
  );

  // Handle token approval for non-ETH swaps using Permit2
  if (!isBuying) {
    try {
      const tokenContract = new ethers.Contract(
        tokenIn.address,
        [
          'function allowance(address owner, address spender) view returns (uint256)',
          'function approve(address spender, uint256 amount) returns (bool)',
          'function balanceOf(address account) view returns (uint256)',
        ],
        signer
      );

      const accountAddress = await signer.getAddress();
      
      // Check token balance first
      const balance = await tokenContract.balanceOf(accountAddress);
      if (balance.lt(amountInWei)) {
        throw new Error(
          `Insufficient ${tokenIn.symbol} balance. ` +
          `Have: ${ethers.utils.formatUnits(balance, tokenIn.decimals)} ${tokenIn.symbol}, ` +
          `Need: ${ethers.utils.formatUnits(amountInWei, tokenIn.decimals)} ${tokenIn.symbol}`
        );
      }
      
      // Permit2 approval flow (recommended for V4)
      const permit2Contract = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, signer);
      
      // Step 1: Check if Permit2 has approval from token contract
      const permit2Allowance = await tokenContract.allowance(accountAddress, PERMIT2_ADDRESS);
      if (permit2Allowance.lt(amountInWei)) {
        const approveTx = await tokenContract.approve(PERMIT2_ADDRESS, ethers.constants.MaxUint256);
        const receipt = await approveTx.wait();
        
        if (!receipt.status) {
          throw new Error(`Permit2 approval failed for ${tokenIn.symbol}`);
        }
      }
      
      // Step 2: Check if Universal Router has approval from Permit2
      const permit2Data = await permit2Contract.allowance(accountAddress, tokenIn.address, UNIVERSAL_ROUTER_ADDRESS);
      const currentAllowance = permit2Data.amount;
      const expiration = permit2Data.expiration;
      
      // Check if we need to approve or if approval expired
      const now = Math.floor(Date.now() / 1000);
      if (currentAllowance.lt(amountInWei) || expiration < now) {
        // Set expiration to 30 days from now
        const newExpiration = now + (30 * 24 * 60 * 60);
        
        // MAX_UINT160 for amount
        const maxAmount = ethers.BigNumber.from(2).pow(160).sub(1);
        
        const permit2ApproveTx = await permit2Contract.approve(
          tokenIn.address,
          UNIVERSAL_ROUTER_ADDRESS,
          maxAmount,
          newExpiration
        );
        const receipt = await permit2ApproveTx.wait();
        
        if (!receipt.status) {
          throw new Error(`Universal Router approval on Permit2 failed for ${tokenIn.symbol}`);
        }
      }
    } catch (error: any) {
      if (error.message.includes('Insufficient')) {
        throw error;
      }
      throw new Error(`Permit2 approval failed: ${error.message}`);
    }
  }

  // Execute swap through Universal Router using official SDK
  const txOptions: any = isBuying ? { value: amountInWei.toString() } : {};

  try {
    const tx = await universalRouter.execute(
      routePlanner.commands,
      routePlanner.inputs,
      deadline,
      txOptions
    );
    return tx;
  } catch (error: any) {
    if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
      try {
        const gasEstimate = await universalRouter.estimateGas.execute(
          routePlanner.commands,
          routePlanner.inputs,
          deadline,
          txOptions
        );
        const tx = await universalRouter.execute(
          routePlanner.commands,
          routePlanner.inputs,
          deadline,
          {
            ...txOptions,
            gasLimit: gasEstimate.mul(120).div(100)
          }
        );
        return tx;
      } catch (gasError: any) {
        throw new Error(`V4 swap failed: ${gasError.message}`);
      }
    }
    
    throw error;
  }
}

/**
 * Create V4 pool key for swap routing
 * 
 * V4 uses pool keys (hashed) instead of pool addresses
 */
export function createV4PoolKey(
  token0: string,
  token1: string,
  fee: number,
  tickSpacing: number = 60,
  hooks: string = ethers.constants.AddressZero
): string {
  return ethers.utils.keccak256(ethers.utils.solidityPack(
    ['address', 'address', 'uint24', 'int24', 'address'],
    [token0, token1, fee, tickSpacing, hooks]
  ));
}

/**
 * Encode V4 swap path for multi-hop swaps
 * 
 * V4 supports efficient multi-hop routing through the Universal Router
 */
export function encodeV4SwapPath(
  tokens: Token[],
  fees: number[]
): string {
  if (tokens.length !== fees.length + 1) {
    throw new Error('Invalid path: tokens length must be fees length + 1');
  }

  const types: string[] = [];
  const values: any[] = [];

  for (let i = 0; i < fees.length; i++) {
    types.push('address', 'uint24');
    values.push(tokens[i].address, fees[i]);
  }
  types.push('address');
  values.push(tokens[tokens.length - 1].address);

  return ethers.utils.solidityPack(types, values);
}
