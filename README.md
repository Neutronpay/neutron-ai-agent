# Neutron AI Agent

An AI agent with Bitcoin Lightning wallet capabilities. Clone, add your keys, and you have an AI that can send and receive Bitcoin.

Built with [Claude](https://anthropic.com) + [Neutron SDK](https://www.npmjs.com/package/neutron-sdk).

## Quick Start (2 minutes)

### 1. Clone & Install

```bash
git clone https://github.com/Neutronpay/neutron-ai-agent.git
cd neutron-ai-agent
npm install
```

### 2. Add Your Keys

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
NEUTRON_API_KEY=your-neutron-key       # Get at https://neutron.me
NEUTRON_API_SECRET=your-neutron-secret
ANTHROPIC_API_KEY=your-anthropic-key   # Get at https://console.anthropic.com
```

### 3. Run

```bash
npm start
```

That's it. You're chatting with an AI that has a Bitcoin wallet.

## What Can It Do?

```
You: Check my balance
Agent: Your BTC balance is 0.00150000 BTC (150,000 sats).

You: Create an invoice for 10,000 sats
Agent: Here's your Lightning invoice:
       lnbc100u1p... [invoice string]
       QR page: https://...
       Share this with the payer — it expires in 1 hour.

You: Send 500 sats to alice@getalby.com
Agent: I'll send 500 sats to alice@getalby.com.
       ✓ Payment sent! Transaction ID: abc123...

You: What's the BTC price?
Agent: Current rates:
       BTCUSD: $97,500
       BTCEUR: €89,200
       BTCUSDT: 97,480

You: Show my last 5 transactions
Agent: [shows recent transaction history]

You: Convert 0.001 BTC to USDT
Agent: Converted 0.001 BTC → 97.50 USDT at rate 97,500.
```

## Available Tools (10)

| Tool | Description |
|------|-------------|
| `check_balance` | All wallet balances (BTC, USDT, fiat) |
| `create_invoice` | Generate Lightning invoice to receive BTC |
| `pay_invoice` | Pay a BOLT11 Lightning invoice |
| `send_to_address` | Send to a Lightning Address (user@domain.com) |
| `get_exchange_rate` | Current BTC rates against major currencies |
| `list_transactions` | Recent transaction history with filters |
| `check_transaction` | Status of a specific transaction |
| `decode_invoice` | Inspect an invoice before paying |
| `get_deposit_address` | BTC on-chain or USDT deposit address |
| `convert_currency` | Swap between BTC, USDT, fiat |

## How It Works

```
User Input → Claude (with tool definitions) → Tool Call → Neutron SDK → Wallet Action → Response
```

1. You type a message
2. Claude decides which wallet tool(s) to use
3. The tool handler calls the Neutron SDK
4. Results are returned to Claude
5. Claude formats a natural language response

The agent supports **multi-step tool use** — Claude can chain multiple tools in a single turn (e.g., check balance, then create an invoice).

## Customization

### Change the AI Model

```bash
MODEL=claude-sonnet-4-20250514 npm start   # Faster, cheaper
MODEL=claude-opus-4-20250514 npm start   # Most capable
```

### Use Sandbox for Testing

```bash
NEUTRON_API_URL=https://enapi.npay.dev npm start
```

### Customize the System Prompt

Edit the `SYSTEM_PROMPT` in `src/agent.ts` to change the agent's personality and behavior:

```typescript
const SYSTEM_PROMPT = `You are a Bitcoin payment assistant for my coffee shop.
When creating invoices, always add the memo "Coffee Shop Payment".
Be friendly and casual.`;
```

### Add Custom Tools

Add new tools in `src/tools.ts` and handlers in `src/handlers.ts`:

```typescript
// tools.ts — add to the tools array
{
  name: "my_custom_tool",
  description: "Does something cool",
  input_schema: {
    type: "object",
    properties: { /* ... */ },
    required: [],
  },
}

// handlers.ts — add a case in handleTool
case "my_custom_tool": {
  // Your logic here using neutron SDK
  return "Result";
}
```

## Project Structure

```
neutron-ai-agent/
├── src/
│   ├── agent.ts      # Main CLI agent loop + Claude integration
│   ├── tools.ts      # Tool definitions (what the AI can do)
│   └── handlers.ts   # Tool handlers (executes wallet actions)
├── .env.example      # Template for API keys
├── package.json
└── tsconfig.json
```

## Use Cases

- **Personal Bitcoin assistant** — Manage your Lightning wallet conversationally
- **Customer support bot** — Help users make payments (add safety checks)
- **Trading assistant** — Monitor rates and execute swaps
- **Payment automation** — Build workflows that involve Bitcoin payments
- **Learning tool** — Understand Lightning Network through conversation

## Security Notes

- API keys are loaded from environment variables — never committed to git
- The agent confirms with the user before sending payments
- Use sandbox (`enapi.npay.dev`) for testing with fake funds
- In production, add spending limits and approval flows for sends

## Links

- [Neutron SDK](https://www.npmjs.com/package/neutron-sdk) — TypeScript SDK
- [Neutron MCP](https://www.npmjs.com/package/neutron-mcp) — MCP server for AI coding tools
- [Neutron React](https://github.com/Neutronpay/neutron-react-payment-component) — React payment component
- [Docs](https://docs.neutron.me)

## License

MIT
