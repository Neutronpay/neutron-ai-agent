import Anthropic from "@anthropic-ai/sdk";
import { Neutron } from "neutron-sdk";
import { createInterface } from "readline";
import { tools } from "./tools.js";
import { handleTool } from "./handlers.js";

// ── Config ──────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a helpful AI assistant with access to a Bitcoin Lightning wallet via Neutron.

You can:
- Check wallet balances (BTC, USDT, fiat)
- Create Lightning invoices to receive Bitcoin
- Pay Lightning invoices and Lightning Addresses
- Send Bitcoin on-chain
- Convert between currencies (BTC ↔ USDT)
- Check exchange rates
- View transaction history
- Get deposit addresses

Guidelines:
- Always confirm with the user before sending payments
- Show amounts in both sats and BTC when relevant (1 BTC = 100,000,000 sats)
- When creating invoices, share the invoice string and QR page URL
- Be concise but informative about transaction details
- If a transaction fails, explain what went wrong and suggest solutions

You're a financial assistant — be precise with numbers and transparent about fees.`;

// ── Initialize ──────────────────────────────────────────────

function initNeutron(): Neutron {
  const apiKey = process.env.NEUTRON_API_KEY;
  const apiSecret = process.env.NEUTRON_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error("\n❌ Missing environment variables:");
    console.error("   NEUTRON_API_KEY and NEUTRON_API_SECRET are required.\n");
    console.error("   Set them in .env or export them:\n");
    console.error('   export NEUTRON_API_KEY="your-key"');
    console.error('   export NEUTRON_API_SECRET="your-secret"\n');
    console.error("   Get credentials at: https://neutron.me\n");
    process.exit(1);
  }

  return new Neutron({
    apiKey,
    apiSecret,
    baseUrl: process.env.NEUTRON_API_URL,
  });
}

function initAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("\n❌ Missing ANTHROPIC_API_KEY environment variable.\n");
    console.error("   Get your API key at: https://console.anthropic.com\n");
    process.exit(1);
  }

  return new Anthropic();
}

// ── Agent loop ──────────────────────────────────────────────

type Message = Anthropic.MessageParam;

async function chat(
  anthropic: Anthropic,
  neutron: Neutron,
  messages: Message[]
): Promise<string> {
  const model = process.env.MODEL || "claude-sonnet-4-20250514";

  // Initial API call
  let response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools,
    messages,
  });

  // Tool use loop — keep going until the model stops calling tools
  while (response.stop_reason === "tool_use") {
    const assistantContent = response.content;
    messages.push({ role: "assistant", content: assistantContent });

    // Process all tool calls
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of assistantContent) {
      if (block.type === "tool_use") {
        console.log(`  🔧 ${block.name}...`);
        const result = await handleTool(neutron, block.name, block.input as Record<string, any>);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });

    // Continue the conversation
    response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });
  }

  // Extract text response
  const assistantContent = response.content;
  messages.push({ role: "assistant", content: assistantContent });

  const textBlocks = assistantContent.filter((b) => b.type === "text");
  return textBlocks.map((b) => (b as Anthropic.TextBlock).text).join("\n");
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  ⚡ Neutron AI Agent — Bitcoin Lightning     ║");
  console.log("║                                              ║");
  console.log("║  Commands:                                   ║");
  console.log("║  • Check my balance                          ║");
  console.log("║  • Create an invoice for 10,000 sats         ║");
  console.log("║  • Send 500 sats to user@getalby.com         ║");
  console.log("║  • What's the BTC price?                     ║");
  console.log("║  • Show my recent transactions               ║");
  console.log("║  • Type 'exit' to quit                       ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  const neutron = initNeutron();
  const anthropic = initAnthropic();
  const messages: Message[] = [];

  // Verify connection
  try {
    await neutron.authenticate();
    const wallets = await neutron.account.wallets();
    const btc = wallets.find((w) => w.ccy === "BTC");
    console.log(`✅ Connected to Neutron`);
    console.log(`   BTC Balance: ${btc?.amount || 0} BTC (${btc ? Math.round(btc.amount * 100_000_000).toLocaleString() : "0"} sats)\n`);
  } catch (err) {
    console.error(`❌ Failed to connect to Neutron: ${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question("You: ", async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      if (trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "quit") {
        console.log("\n👋 Goodbye!\n");
        rl.close();
        process.exit(0);
      }

      messages.push({ role: "user", content: trimmed });

      // Keep conversation history bounded (last 50 messages)
      if (messages.length > 50) {
        messages.splice(0, messages.length - 50);
      }

      try {
        const reply = await chat(anthropic, neutron, messages);
        console.log(`\nAgent: ${reply}\n`);
      } catch (err) {
        console.error(`\n❌ Error: ${err instanceof Error ? err.message : err}\n`);
      }

      prompt();
    });
  };

  prompt();
}

main();
