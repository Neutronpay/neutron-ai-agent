import "dotenv/config";
import * as readline from "node:readline";
import { Agent } from "./agent.js";
import { startWebhookServer } from "./webhook.js";

// ── Validate config ─────────────────────────────────────────

const required = ["NEUTRON_API_KEY", "NEUTRON_API_SECRET", "ANTHROPIC_API_KEY"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env var: ${key}`);
    console.error("   Copy .env.example to .env and fill in your keys.");
    process.exit(1);
  }
}

// ── Start ───────────────────────────────────────────────────

const agent = new Agent();

// Start webhook server
startWebhookServer({
  port: parseInt(process.env.WEBHOOK_PORT || "3000", 10),
  secret: process.env.WEBHOOK_SECRET || "change-me",
  onPayment: (event) => agent.onPaymentReceived(event),
});

// Interactive chat loop
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("\n⚡ Neutron AI Agent ready!");
console.log("   Type a message to chat. Ctrl+C to exit.\n");

function prompt() {
  rl.question("You: ", async (input) => {
    const trimmed = input.trim();
    if (!trimmed) {
      prompt();
      return;
    }

    try {
      const response = await agent.chat(trimmed);
      console.log(`\nAgent: ${response}\n`);
    } catch (err) {
      console.error(`\nError: ${(err as Error).message}\n`);
    }

    prompt();
  });
}

prompt();
