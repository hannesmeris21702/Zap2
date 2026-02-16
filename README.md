# SUI Cetus CLMM ZAP Bot

A specialized bot for executing ZAP operations on SUI mainnet using the Cetus CLMM DEX.

## Features

- **Network**: SUI Mainnet only
- **DEX**: Cetus CLMM (official Cetus SDK)
- **Operation**: ZAP only (add liquidity with automatic swaps)
- **Simplicity**: No rebalancing, no position closing, no complex calculations

## Prerequisites

- Node.js 18+ and npm
- SUI wallet with private key
- SUI tokens for gas fees
- Tokens for the target Cetus CLMM pool

## Important Notes

⚠️ **SDK Version**: This bot uses `@mysten/sui.js` v0.34.1 for compatibility with the Cetus SDK. This is the version that Cetus CLMM SDK depends on. Do not upgrade to `@mysten/sui` without testing compatibility.

## Installation

1. Clone the repository:
```bash
git clone https://github.com/hannesmeris21702/Zap2.git
cd Zap2
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
SUI_RPC_URL=https://fullnode.mainnet.sui.io:443
PRIVATE_KEY=your_sui_wallet_private_key_here
POOL_ID=your_cetus_clmm_pool_id_here
RANGE_PERCENT=5
```

## Configuration

### Environment Variables

- **SUI_RPC_URL**: SUI mainnet RPC endpoint (default: `https://fullnode.mainnet.sui.io:443`)
- **PRIVATE_KEY**: Your SUI wallet private key (hex format, 64 characters, without 0x prefix)
- **POOL_ID**: The Cetus CLMM pool ID where you want to add liquidity
- **RANGE_PERCENT**: The percentage range around current price for the position (e.g., 5 means ±5%)
- **SLIPPAGE_TOLERANCE** (optional): Maximum slippage tolerance (default: 0.05 = 5%)

### Finding Pool IDs

You can find Cetus CLMM pool IDs on:
- Cetus DEX website: https://app.cetus.zone/
- SUI Explorer: https://suiscan.xyz/

## Usage

### Build the project:
```bash
npm run build
```

### Run the bot:
```bash
npm start
```

### Development mode:
```bash
npm run dev
```

## How It Works

The bot follows this precise execution flow:

1. **Connect** to SUI mainnet using the provided RPC URL
2. **Initialize** Cetus CLMM SDK with mainnet configuration
3. **Fetch** wallet balances for the pool's token pair
4. **Fetch** current pool price and tick from Cetus
5. **Calculate** active tick range using RANGE_PERCENT around current price
6. **Execute** Cetus SDK ZAP operation:
   - Uses all available wallet balances
   - Targets the specified pool
   - Creates position in calculated tick range
   - Cetus SDK handles internal swaps automatically
7. **Sign** and execute the transaction on SUI
8. **Report** success or failure

## Success Criteria

- ✅ Transaction successfully executed on SUI
- ✅ Transaction digest received
- ⚠️ No Position NFT validation (not required)
- ⚠️ No post-ZAP position queries

## Limitations

This bot is intentionally simple and focused:

- ❌ No rebalancing logic
- ❌ No position closing
- ❌ No position searching or validation
- ❌ No complex tick math
- ❌ No ratio calculations
- ❌ No manual swaps
- ❌ No NFT detection after transaction

## Error Handling

The bot will exit with:
- Exit code 0: Success
- Exit code 1: Failure (with error details logged)

## Security Notes

⚠️ **Never commit your `.env` file or share your private key!**

- Keep your `PRIVATE_KEY` secure
- Use a dedicated wallet for bot operations
- Start with small amounts for testing
- Monitor your transactions on SUI Explorer

## Troubleshooting

### "SUI_RPC_URL is required"
Make sure your `.env` file exists and contains all required variables.

### "Pool not found"
Verify the POOL_ID is correct and exists on Cetus mainnet.

### "No tokens available in wallet"
Ensure your wallet has tokens for at least one side of the pool pair.

### "PRIVATE_KEY must be a 64-character hex string"
Your private key should be exactly 64 hexadecimal characters (32 bytes). Remove any `0x` prefix if present.

### Transaction fails
- Check you have enough SUI for gas fees
- Verify pool is active and not paused
- Adjust SLIPPAGE_TOLERANCE if needed (default: 5%)
- Ensure you have sufficient token balance for the calculated amounts

## License

MIT

## Disclaimer

This software is provided "as is" without warranty. Use at your own risk. Always test with small amounts first.
