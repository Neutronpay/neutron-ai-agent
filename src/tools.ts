import { Neutron, formatSats } from "neutron-sdk";
import type Anthropic from "@anthropic-ai/sdk";

// ── Neutron client (singleton) ──────────────────────────────

let _neutron: Neutron | null = null;

export function getNeutron(): Neutron {
  if (!_neutron) {
    _neutron = new Neutron({
      apiKey: process.env.NEUTRON_API_KEY!,
      apiSecret: process.env.NEUTRON_API_SECRET!,
    });
  }
  return _neutron;
}

// ── Tool definitions for Claude ─────────────────────────────

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "check_balance",
    description:
      "Get wallet balances. Returns available balance for each currency (BTC, USDT, etc.).",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "create_invoice",
    description:
      "Create a Lightning invoice to receive Bitcoin. Returns a BOLT11 invoice string the payer can use.",
    input_schema: {
      type: "object" as const,
      properties: {
        amount_sats: {
          type: "number",
          description: "Amount in satoshis (1 BTC = 100,000,000 sats)",
        },
        memo: {
          type: "string",
          description: "Description shown to the payer",
        },
      },
      required: ["amount_sats", "memo"],
    },
  },
  {
    name: "send_payment",
    description:
      "Send Bitcoin to a Lightning address (e.g. user@getalby.com). Creates and confirms the payment.",
    input_schema: {
      type: "object" as const,
      properties: {
        address: {
          type: "string",
          description: "Lightning address (e.g. alice@getalby.com)",
        },
        amount_sats: {
          type: "number",
          description: "Amount in satoshis to send",
        },
      },
      required: ["address", "amount_sats"],
    },
  },
  {
    name: "check_payment",
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
    name: "list_transactions",
    description:
      "List recent transactions. Returns the latest payments sent and received.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Number of transactions to return (default: 10, max: 50)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_exchange_rate",
    description:
      "Get current BTC exchange rates (BTC/USD, BTC/VND, etc.).",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

// ── Tool implementations ────────────────────────────────────

export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  const neutron = getNeutron();

  switch (name) {
    case "check_balance": {
      const wallets = await neutron.account.wallets();
      const lines = wallets.map(
        (w) => `${w.ccy}: ${w.availableBalance}`
      );
      return lines.length > 0
        ? lines.join("\n")
        : "No wallets found.";
    }

    case "create_invoice": {
      const amountSats = input.amount_sats as number;
      const memo = (input.memo as string) || "Payment";
      const invoice = await neutron.lightning.createInvoice({
        amountSats,
        memo,
      });
      return [
        `Invoice created for ${formatSats(amountSats)}`,
        `BOLT11: ${invoice.invoice}`,
        `Transaction ID: ${invoice.txnId}`,
        invoice.qrPageUrl ? `QR page: ${invoice.qrPageUrl}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }

    case "send_payment": {
      const address = input.address as string;
      const amountSats = input.amount_sats as number;
      const txn = await neutron.lightning.payAddress(address, {
        amountSats,
      });
      await neutron.transactions.confirm(txn.txnId);
      return `Payment of ${formatSats(amountSats)} sent to ${address}. Transaction ID: ${txn.txnId}`;
    }

    case "check_payment": {
      const txnId = input.txn_id as string;
      const txn = await neutron.transactions.get(txnId);
      return [
        `Transaction: ${txn.txnId}`,
        `State: ${txn.txnState}`,
        `Amount: ${txn.sourceReq?.amtRequested ?? "N/A"}`,
        `Created: ${txn.createdAt}`,
      ].join("\n");
    }

    case "list_transactions": {
      const limit = (input.limit as number) || 10;
      const list = await neutron.transactions.list({ limit });
      if (!list || list.length === 0) {
        return "No transactions found.";
      }
      return list
        .map(
          (t: { txnState?: string; txnId?: string; sourceReq?: { ccy?: string; amtRequested?: number } }) =>
            `[${t.txnState}] ${t.txnId} — ${t.sourceReq?.ccy ?? "?"} ${t.sourceReq?.amtRequested ?? "?"}`
        )
        .join("\n");
    }

    case "get_exchange_rate": {
      const rates = await neutron.rates.get();
      return Object.entries(rates as Record<string, number>)
        .map(([pair, rate]) => `${pair}: ${rate}`)
        .join("\n");
    }

    default:
      return `Unknown tool: ${name}`;
  }
}
