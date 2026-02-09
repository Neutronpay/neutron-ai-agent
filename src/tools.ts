import type Anthropic from "@anthropic-ai/sdk";

/**
 * Tool definitions for the AI agent.
 * Each tool maps to a Neutron SDK operation.
 */
export const tools: Anthropic.Tool[] = [
  {
    name: "check_balance",
    description:
      "Check all wallet balances. Returns BTC, USDT, and any fiat currency balances with available amounts.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "create_invoice",
    description:
      "Create a Lightning invoice to receive Bitcoin. Returns a BOLT11 payment string and QR code page URL. The invoice is auto-confirmed and ready for the payer immediately.",
    input_schema: {
      type: "object" as const,
      properties: {
        amount_sats: {
          type: "number",
          description: "Amount to receive in satoshis (e.g. 10000 = 10,000 sats)",
        },
        memo: {
          type: "string",
          description: "Description shown to the payer (e.g. 'Coffee order #42')",
        },
      },
      required: ["amount_sats"],
    },
  },
  {
    name: "pay_invoice",
    description:
      "Pay a Lightning invoice (BOLT11). Creates and confirms the payment. Use this when someone gives you a Lightning invoice to pay.",
    input_schema: {
      type: "object" as const,
      properties: {
        invoice: {
          type: "string",
          description: "BOLT11 Lightning invoice string (starts with lnbc...)",
        },
        confirmed: {
          type: "boolean",
          description: "Set to true only after the user has explicitly confirmed the payment. First call without this to show payment details.",
        },
      },
      required: ["invoice"],
    },
  },
  {
    name: "send_to_address",
    description:
      "Send Bitcoin to a Lightning Address (user@domain.com). Lightning Addresses are like email addresses for Bitcoin.",
    input_schema: {
      type: "object" as const,
      properties: {
        address: {
          type: "string",
          description: "Lightning Address (e.g. alice@getalby.com)",
        },
        amount_sats: {
          type: "number",
          description: "Amount to send in satoshis",
        },
        confirmed: {
          type: "boolean",
          description: "Set to true only after the user has explicitly confirmed the payment.",
        },
      },
      required: ["address", "amount_sats"],
    },
  },
  {
    name: "get_exchange_rate",
    description:
      "Get current BTC exchange rates against USD, USDT, and other supported currencies.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "list_transactions",
    description:
      "List recent transactions. Shows payment history with status, amounts, and methods.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Number of transactions to return (default: 10)",
        },
        status: {
          type: "string",
          description: "Filter by status: completed, pending, failed, expired",
        },
      },
      required: [],
    },
  },
  {
    name: "check_transaction",
    description:
      "Check the status of a specific transaction by its ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        txn_id: {
          type: "string",
          description: "Transaction ID to check",
        },
      },
      required: ["txn_id"],
    },
  },
  {
    name: "decode_invoice",
    description:
      "Decode and inspect a Lightning invoice before paying it. Shows amount, expiry, and destination.",
    input_schema: {
      type: "object" as const,
      properties: {
        invoice: {
          type: "string",
          description: "BOLT11 invoice string to decode",
        },
      },
      required: ["invoice"],
    },
  },
  {
    name: "get_deposit_address",
    description:
      "Get a Bitcoin on-chain deposit address or USDT deposit address to receive funds.",
    input_schema: {
      type: "object" as const,
      properties: {
        currency: {
          type: "string",
          enum: ["BTC", "USDT"],
          description: "Currency to get deposit address for (default: BTC)",
        },
        chain: {
          type: "string",
          enum: ["TRON", "ETH"],
          description: "For USDT only: blockchain to use (default: TRON)",
        },
      },
      required: [],
    },
  },
  {
    name: "convert_currency",
    description:
      "Convert between currencies in your wallet (e.g. BTC to USDT or USDT to BTC). Settles instantly.",
    input_schema: {
      type: "object" as const,
      properties: {
        from_currency: {
          type: "string",
          description: "Source currency (e.g. BTC, USDT)",
        },
        to_currency: {
          type: "string",
          description: "Destination currency (e.g. USDT, BTC)",
        },
        amount: {
          type: "number",
          description: "Amount in the source currency (BTC amounts in BTC, not sats)",
        },
        confirmed: {
          type: "boolean",
          description: "Set to true only after the user has explicitly confirmed the conversion.",
        },
      },
      required: ["from_currency", "to_currency", "amount"],
    },
  },
];
