import { Neutron, formatSats, satsToBtc } from "neutron-sdk";

/**
 * Execute a tool call using the Neutron SDK.
 * Returns a string result for the AI agent.
 */
export async function handleTool(
  neutron: Neutron,
  name: string,
  input: Record<string, any>
): Promise<string> {
  try {
    switch (name) {
      case "check_balance": {
        const wallets = await neutron.account.wallets();
        if (!wallets.length) return "No wallets found.";
        const lines = wallets.map(
          (w) => `${w.ccy}: ${w.amount} (available: ${w.availableBalance})`
        );
        return `Wallet Balances:\n${lines.join("\n")}`;
      }

      case "create_invoice": {
        const invoice = await neutron.lightning.createInvoice({
          amountSats: input.amount_sats,
          memo: input.memo,
        });
        return [
          `Lightning Invoice Created:`,
          `Amount: ${formatSats(invoice.amountSats)} (${invoice.amountBtc} BTC)`,
          `Invoice: ${invoice.invoice}`,
          `QR Page: ${invoice.qrPageUrl || "N/A"}`,
          `Transaction ID: ${invoice.txnId}`,
          `Status: ${invoice.status}`,
        ].join("\n");
      }

      case "pay_invoice": {
        // Decode first so AI can show the user what they're paying
        const decoded = await neutron.lightning.decodeInvoice(input.invoice);
        if (!input.confirmed) {
          return [
            `⚠️ PAYMENT REQUIRES CONFIRMATION`,
            `Amount: ${decoded.amount || "encoded in invoice"} BTC`,
            `Description: ${decoded.description || "none"}`,
            `Ask the user to confirm before calling this tool again with confirmed=true.`,
          ].join("\n");
        }
        const txn = await neutron.lightning.payInvoice(input.invoice);
        const confirmed = await neutron.transactions.confirm(txn.txnId);
        return [
          `Payment Sent:`,
          `Amount: ${decoded.amount || "encoded in invoice"} BTC`,
          `Transaction ID: ${confirmed.txnId}`,
          `Status: ${confirmed.txnState}`,
          `Fees: ${confirmed.sourceReq?.neutronpayFees || 0} BTC`,
        ].join("\n");
      }

      case "send_to_address": {
        if (!input.confirmed) {
          return [
            `⚠️ PAYMENT REQUIRES CONFIRMATION`,
            `Recipient: ${input.address}`,
            `Amount: ${formatSats(input.amount_sats)} (${satsToBtc(input.amount_sats)} BTC)`,
            `Ask the user to confirm before calling this tool again with confirmed=true.`,
          ].join("\n");
        }
        const txn = await neutron.lightning.payAddress(input.address, {
          amountSats: input.amount_sats,
        });
        const confirmed = await neutron.transactions.confirm(txn.txnId);
        return [
          `Sent to ${input.address}:`,
          `Amount: ${formatSats(input.amount_sats)} (${satsToBtc(input.amount_sats)} BTC)`,
          `Transaction ID: ${confirmed.txnId}`,
          `Status: ${confirmed.txnState}`,
        ].join("\n");
      }

      case "get_exchange_rate": {
        const rates = await neutron.rates.get();
        const important = ["BTCUSD", "BTCUSDT", "BTCEUR", "BTCGBP", "BTCVND", "BTCCAD"];
        const lines = Object.entries(rates)
          .filter(([k]) => important.includes(k))
          .map(([k, v]) => `${k}: ${Number(v).toLocaleString()}`);
        if (!lines.length) {
          // Show whatever we got
          const all = Object.entries(rates)
            .slice(0, 10)
            .map(([k, v]) => `${k}: ${Number(v).toLocaleString()}`);
          return `Exchange Rates:\n${all.join("\n")}`;
        }
        return `Exchange Rates:\n${lines.join("\n")}`;
      }

      case "list_transactions": {
        const txns = await neutron.transactions.list({
          limit: input.limit || 10,
          status: input.status,
        });
        if (!Array.isArray(txns) || !txns.length) return "No transactions found.";
        const lines = txns.map((t) => {
          const src = `${t.sourceReq?.ccy || "?"} (${t.sourceReq?.method || "?"})`;
          const dest = `${t.destReq?.ccy || "?"} (${t.destReq?.method || "?"})`;
          const amt = t.sourceReq?.amtRequested || t.destReq?.amtRequested || "?";
          return `[${t.txnState}] ${src} → ${dest} | ${amt} | ${t.txnId?.slice(0, 8)}...`;
        });
        return `Recent Transactions:\n${lines.join("\n")}`;
      }

      case "check_transaction": {
        const txn = await neutron.transactions.get(input.txn_id);
        return [
          `Transaction ${input.txn_id}:`,
          `Status: ${txn.txnState}`,
          `Source: ${txn.sourceReq?.ccy} via ${txn.sourceReq?.method}`,
          `Destination: ${txn.destReq?.ccy} via ${txn.destReq?.method}`,
          `Amount: ${txn.sourceReq?.amtRequested || txn.destReq?.amtRequested || "N/A"}`,
          `Created: ${txn.createdAt ? new Date(txn.createdAt).toISOString() : "N/A"}`,
        ].join("\n");
      }

      case "decode_invoice": {
        const decoded = await neutron.lightning.decodeInvoice(input.invoice);
        return [
          `Invoice Details:`,
          `Amount: ${decoded.amount || "not specified"} BTC`,
          `Description: ${decoded.description || "none"}`,
          `Expiry: ${decoded.expiry || "unknown"}`,
          `Destination: ${decoded.destination || "unknown"}`,
          `Status: ${decoded.status || "unknown"}`,
        ].join("\n");
      }

      case "get_deposit_address": {
        const currency = input.currency || "BTC";
        if (currency === "USDT") {
          const chain = input.chain || "TRON";
          const result = await neutron.account.usdtAddress(chain as "TRON" | "ETH");
          return `USDT Deposit Address (${result.chain}):\n${result.address}`;
        }
        const result = await neutron.account.btcAddress();
        return `Bitcoin Deposit Address:\n${result.address}`;
      }

      case "convert_currency": {
        if (!input.confirmed) {
          return [
            `⚠️ CONVERSION REQUIRES CONFIRMATION`,
            `From: ${input.amount} ${input.from_currency}`,
            `To: ${input.to_currency}`,
            `Ask the user to confirm before calling this tool again with confirmed=true.`,
          ].join("\n");
        }
        const txn = await neutron.transactions.create({
          sourceReq: {
            ccy: input.from_currency,
            method: "neutronpay",
            amtRequested: input.amount,
            reqDetails: {},
          },
          destReq: {
            ccy: input.to_currency,
            method: "neutronpay",
            reqDetails: {},
          },
        });

        const rate = txn.fxRate ? `Rate: ${txn.fxRate}` : "";
        const destAmt = txn.destReq?.amtRequested
          ? `You'll receive: ${txn.destReq.amtRequested} ${input.to_currency}`
          : "";

        // Auto-confirm the swap
        const confirmed = await neutron.transactions.confirm(txn.txnId);

        return [
          `Currency Conversion:`,
          `From: ${input.amount} ${input.from_currency}`,
          destAmt,
          rate,
          `Transaction ID: ${confirmed.txnId}`,
          `Status: ${confirmed.txnState}`,
        ]
          .filter(Boolean)
          .join("\n");
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return `Error executing ${name}: ${msg}`;
  }
}
