import { ethers } from 'ethers';
import { Token } from '@uniswap/sdk-core';
import { Actions, V4Planner } from '@uniswap/v4-sdk';
import { CommandType, RoutePlanner } from '@uniswap/universal-router-sdk';
import { UNIVERSAL_ROUTER_ADDRESS, UNIVERSAL_ROUTER_ABI, DEFAULT_SLIPPAGE } from './constants';

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
  fee: number;
  recipient: string;
  poolId: string;
  isBuying: boolean;
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
    amountOut,
    fee,
    recipient,
    isBuying,
  } = params;

  // Calculate deadline (20 minutes from now)
  const deadline = Math.floor(Date.now() / 1000) + 1200;

  // Parse amounts (convert BigNumber to bigint for v5)
  const amountInWei = BigInt(ethers.utils.parseUnits(amountIn, tokenIn.decimals).toString());
  const amountOutWei = BigInt(ethers.utils.parseUnits(amountOut, tokenOut.decimals).toString());
  
  // Calculate minimum amount out with slippage
  const slippageTolerance = DEFAULT_SLIPPAGE / 10000; // 0.5%
  const minAmountOut = amountOutWei - (amountOutWei * BigInt(Math.floor(slippageTolerance * 10000)) / 10000n);

  // Official V4Planner and RoutePlanner usage
  // Create PoolKey (V4's pool identifier structure)
  const poolKey: PoolKey = {
    currency0: tokenIn.address < tokenOut.address ? tokenIn.address : tokenOut.address,
    currency1: tokenIn.address < tokenOut.address ? tokenOut.address : tokenIn.address,
    fee,
    tickSpacing: 60, // Standard tick spacing for most pools
    hooks: ethers.constants.AddressZero, // No hooks for basic swap
  };

  // Determine swap direction (zeroForOne)
  const zeroForOne = tokenIn.address < tokenOut.address;

  // Create V4Planner instance for batching V4 operations
  const v4Planner = new V4Planner();

  // Create swap configuration for V4Planner
  const swapConfig = {
    poolKey,
    zeroForOne,
    amountIn: amountInWei.toString(),
    amountOutMinimum: minAmountOut.toString(),
    hookData: '0x00',
  };

  // Add V4 actions using official V4Planner
  v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [swapConfig]);
  v4Planner.addAction(Actions.SETTLE_ALL, [poolKey.currency0, amountInWei.toString()]);
  v4Planner.addAction(Actions.TAKE_ALL, [poolKey.currency1, minAmountOut.toString()]);

  // Finalize V4 plan to get encoded actions
  const encodedV4Actions = v4Planner.finalize();

  // Create RoutePlanner for Universal Router
  const routePlanner = new RoutePlanner();
  
  // Add V4_SWAP command to route planner
  routePlanner.addCommand(CommandType.V4_SWAP, [encodedV4Actions]);

  // Create Universal Router contract instance
  const universalRouter = new ethers.Contract(
    UNIVERSAL_ROUTER_ADDRESS,
    UNIVERSAL_ROUTER_ABI,
    signer
  );

  // Handle token approval for non-ETH swaps
  if (!isBuying) {
    const tokenContract = new ethers.Contract(
      tokenIn.address,
      [
        'function allowance(address owner, address spender) view returns (uint256)',
        'function approve(address spender, uint256 amount) returns (bool)',
      ],
      signer
    );

    const allowance = await tokenContract.allowance(recipient, UNIVERSAL_ROUTER_ADDRESS);
    
    // Check if approval is needed (BigNumber comparison)
    if (allowance.lt(amountInWei)) {
      const approveTx = await tokenContract.approve(UNIVERSAL_ROUTER_ADDRESS, amountInWei);
      await approveTx.wait();
    }
  }

  // Execute swap through Universal Router using RoutePlanner
  const tx = await universalRouter.execute(
    routePlanner.commands,
    routePlanner.inputs,
    deadline,
    {
      value: isBuying ? amountInWei : 0,
    }
  );

  return tx;
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
