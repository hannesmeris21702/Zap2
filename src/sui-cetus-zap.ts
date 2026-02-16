import dotenv from 'dotenv';
import { SuiClient } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import {
  CetusClmmSDK,
  SdkOptions,
  AddLiquidityParams,
  adjustForSlippage,
} from '@cetusprotocol/cetus-sui-clmm-sdk';
import BN from 'bn.js';

// Load environment variables
dotenv.config();

// Cetus mainnet configuration
const CETUS_MAINNET_PACKAGE_ID = '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb';
const CETUS_GLOBAL_CONFIG_ID = '0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f';

interface Config {
  suiRpcUrl: string;
  privateKey: string;
  poolId: string;
  rangePercent: number;
}

/**
 * Load and validate configuration from environment variables
 */
function loadConfig(): Config {
  const suiRpcUrl = process.env.SUI_RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;
  const poolId = process.env.POOL_ID;
  const rangePercent = process.env.RANGE_PERCENT;

  if (!suiRpcUrl) {
    throw new Error('SUI_RPC_URL is required');
  }
  if (!privateKey) {
    throw new Error('PRIVATE_KEY is required');
  }
  if (!poolId) {
    throw new Error('POOL_ID is required');
  }
  if (!rangePercent) {
    throw new Error('RANGE_PERCENT is required');
  }

  return {
    suiRpcUrl,
    privateKey,
    poolId,
    rangePercent: parseFloat(rangePercent),
  };
}

/**
 * Main ZAP execution function
 */
async function executeZap() {
  try {
    console.log('Starting SUI Cetus ZAP Bot...');

    // Step 1: Load configuration
    const config = loadConfig();
    console.log('Configuration loaded successfully');

    // Step 2: Connect to SUI mainnet
    const suiClient = new SuiClient({ url: config.suiRpcUrl });
    console.log('Connected to SUI mainnet');

    // Step 3: Initialize wallet keypair
    const keypair = Ed25519Keypair.fromSecretKey(
      Buffer.from(config.privateKey, 'hex')
    );
    const walletAddress = keypair.getPublicKey().toSuiAddress();
    console.log(`Wallet address: ${walletAddress}`);

    // Step 4: Initialize Cetus CLMM SDK
    const sdkOptions: SdkOptions = {
      fullRpcUrl: config.suiRpcUrl,
      simulationAccount: {
        address: walletAddress,
      },
      cetus_config: {
        package_id: CETUS_MAINNET_PACKAGE_ID,
        global_config_id: CETUS_GLOBAL_CONFIG_ID,
        pool_config: {
          pools_id: '',
          admin_cap_id: '',
        },
      },
    };

    const sdk = new CetusClmmSDK(sdkOptions);
    await sdk.init();
    console.log('Cetus CLMM SDK initialized');

    // Step 5: Fetch pool information
    const pool = await sdk.Pool.getPool(config.poolId);
    if (!pool) {
      throw new Error(`Pool not found: ${config.poolId}`);
    }
    console.log(`Pool fetched: ${pool.coinTypeA} / ${pool.coinTypeB}`);
    console.log(`Current tick: ${pool.current_tick_index}`);
    console.log(`Current sqrt price: ${pool.current_sqrt_price}`);

    // Step 6: Fetch wallet balances for pool token pair
    const coinTypeA = pool.coinTypeA;
    const coinTypeB = pool.coinTypeB;

    const coinsA = await suiClient.getCoins({
      owner: walletAddress,
      coinType: coinTypeA,
    });
    const coinsB = await suiClient.getCoins({
      owner: walletAddress,
      coinType: coinTypeB,
    });

    const balanceA = coinsA.data.reduce(
      (sum, coin) => sum + BigInt(coin.balance),
      BigInt(0)
    );
    const balanceB = coinsB.data.reduce(
      (sum, coin) => sum + BigInt(coin.balance),
      BigInt(0)
    );

    console.log(`Wallet balance A: ${balanceA}`);
    console.log(`Wallet balance B: ${balanceB}`);

    if (balanceA === BigInt(0) && balanceB === BigInt(0)) {
      throw new Error('No tokens available in wallet for this pool');
    }

    // Step 7: Calculate active range using RANGE_PERCENT around current price
    const currentTick = pool.current_tick_index;
    const tickSpacing = pool.tickSpacing;

    // Calculate tick range based on percentage
    // Note: In Cetus, tick spacing must be respected
    const rangeMultiplier = config.rangePercent / 100;
    const tickRange = Math.floor((currentTick * rangeMultiplier) / tickSpacing) * tickSpacing;

    let lowerTick = currentTick - Math.abs(tickRange);
    let upperTick = currentTick + Math.abs(tickRange);

    // Ensure ticks align with tick spacing
    lowerTick = Math.floor(lowerTick / tickSpacing) * tickSpacing;
    upperTick = Math.ceil(upperTick / tickSpacing) * tickSpacing;

    console.log(`Calculated tick range: [${lowerTick}, ${upperTick}]`);
    console.log(`Tick spacing: ${tickSpacing}`);

    // Step 8: Execute Cetus SDK ZAP (Add Liquidity)
    console.log('Preparing ZAP transaction...');

    const addLiquidityParams: AddLiquidityParams = {
      pool_id: config.poolId,
      coinTypeA: coinTypeA,
      coinTypeB: coinTypeB,
      tick_lower: lowerTick.toString(),
      tick_upper: upperTick.toString(),
      amount_a: balanceA.toString(),
      amount_b: balanceB.toString(),
      fix_amount_a: true,
      slippage: 0.05, // 5% slippage tolerance
      is_open: true, // Create new position
      collect_fee: false,
    };

    // Create transaction payload using SDK
    const createAddLiquidityTransactionPayload = await sdk.Position.createAddLiquidityTransactionPayload(
      addLiquidityParams
    );

    // Step 9: Sign and execute the transaction on SUI
    console.log('Signing and executing transaction...');

    const tx = new TransactionBlock();
    tx.setSender(walletAddress);

    // Add the liquidity transaction commands
    // Note: The SDK returns the transaction payload, we need to merge it with our transaction
    // This is a simplified approach - the actual implementation depends on SDK version
    const result = await suiClient.signAndExecuteTransactionBlock({
      transactionBlock: createAddLiquidityTransactionPayload,
      signer: keypair,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    // Step 10: Check transaction result
    if (result.effects?.status?.status === 'success') {
      console.log('ZAP_SUCCESS_ON_SUI_CETUS');
      console.log(`Transaction digest: ${result.digest}`);
      process.exit(0);
    } else {
      console.error('Transaction failed');
      console.error('Status:', result.effects?.status);
      process.exit(1);
    }
  } catch (error) {
    console.error('ZAP execution failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run the bot
if (require.main === module) {
  executeZap();
}

export { executeZap };
