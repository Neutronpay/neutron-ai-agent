import Anthropic from "@anthropic-ai/sdk";
import { toolDefinitions, executeTool } from "./tools.js";
import type { PaymentEvent } from "./webhook.js";

const SYSTEM_PROMPT = `You are a Bitcoin-powered AI agent. You can earn and spend Bitcoin over the Lightning Network using your built-in wallet.

Your capabilities:
- Create Lightning invoices to get paid
- Send Bitcoin payments to Lightning addresses
- Check your wallet balance
- Track payment status
- Quote BTC/USD exchange rates

Personality:
- You're helpful, professional, and a little excited about Bitcoin
- When users ask for paid tasks, quote the price, create an invoice, and wait for payment before delivering
- Default task price: ${process.env.TASK_PRICE_SATS || 100} sats (adjust based on complexity)
- After receiving payment confirmation, deliver the work immediately

Always be transparent about costs. Never pretend a payment happened if it didn't.`;

export class Agent {
  private anthropic: Anthropic;
  private messages: Anthropic.MessageParam[] = [];
  private model: string;
  private pendingPayments = new Map<string, (event: PaymentEvent) => void>();

  constructor() {
    this.anthropic = new Anthropic();
    this.model = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";
  }

  /**
   * Called by the webhook server when a payment arrives.
   */
  onPaymentReceived(event: PaymentEvent) {
    console.log(`💰 Payment completed: ${event.txnId}`);

    // Check if the agent is waiting for this payment
    const resolver = this.pendingPayments.get(event.txnId);
    if (resolver) {
      resolver(event);
      this.pendingPayments.delete(event.txnId);
    }

    // Also inject a message into the conversation so the agent knows
    this.messages.push({
      role: "user",
      content: `[SYSTEM: Payment received! Transaction ${event.txnId} is now completed. Deliver the work you promised.]`,
    });
  }

  /**
   * Send a user message and get the agent's response.
   * Handles tool calls in a loop until the agent produces a text response.
   */
  async chat(userMessage: string): Promise<string> {
    this.messages.push({ role: "user", content: userMessage });

    // Agent loop — keep going until we get a final text response
    while (true) {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: toolDefinitions,
        messages: this.messages,
      });

      // Collect the assistant's full response
      this.messages.push({ role: "assistant", content: response.content });

      // If the model wants to use tools, execute them and continue
      if (response.stop_reason === "tool_use") {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type === "tool_use") {
            console.log(`🔧 Tool call: ${block.name}`, block.input);
            try {
              const result = await executeTool(
                block.name,
                block.input as Record<string, unknown>
              );
              console.log(`   ✅ Result: ${result.slice(0, 120)}...`);
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: result,
              });
            } catch (err) {
              const errorMsg = `Error: ${(err as Error).message}`;
              console.error(`   ❌ ${errorMsg}`);
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: errorMsg,
                is_error: true,
              });
            }
          }
        }

        this.messages.push({ role: "user", content: toolResults });
        continue; // Loop back for the next response
      }

      // Extract final text
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      return text;
    }
  }
}
