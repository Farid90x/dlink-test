// @ts-nocheck
// src/agent/runAgentOnce.ts
import OpenAI from "openai";
import { getPoolLayoutTool } from "../agentTools/getPoolLayout";
import { executeBuyTool } from "../agentTools/executeBuyTool";
import "dotenv/config";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const tools = [
  {
    type: "function",
    function: {
      name: "getPoolLayout",
      description: "Derive all PumpSwap BUY accounts.",
      parameters: {
        type: "object",
        properties: {
          pool: { type: "string" },
          baseMint: { type: "string" },
          quoteMint: { type: "string" },
          user: { type: "string" },
        },
        required: ["pool", "baseMint", "quoteMint", "user"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "executeBuy",
      description: "Execute a real BUY on PumpSwap.",
      parameters: {
        type: "object",
        properties: {
          rpcUrl: { type: "string" },
          pool: { type: "string" },
          baseMint: { type: "string" },
          quoteMint: { type: "string" },
          userSecret: { type: "string" },
          amountIn: { type: "number" },
          prioritize: { type: "boolean" }
        },
        required: [
          "rpcUrl",
          "pool",
          "baseMint",
          "quoteMint",
          "userSecret",
          "amountIn"
        ]
      }
    }
  },
  {
    type: "function",
    function: {
        name: "executeSell",
        description: "Execute a SELL on PumpSwap.",
        parameters: {
        type: "object",
        properties: {
            rpcUrl: { type: "string" },
            pool: { type: "string" },
            baseMint: { type: "string" },
            quoteMint: { type: "string" },
            userSecret: { type: "string" },
            amountIn: { type: "number" },
            prioritize: { type: "boolean" }
        },
        required: ["rpcUrl", "pool", "baseMint", "quoteMint", "userSecret", "amountIn"]
        }
    }
  }
];

export async function runAgentOnce() {
  const res = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    tools,
    messages: [
      {
        role: "user",
        content: "برای این pool، لطفاً BUY را انجام بده."
      }
    ]
  });

  const msg = res.choices[0].message;

  if (!msg.tool_calls) {
    console.log("❌ No tool call.");
    return;
  }

  const toolCall = msg.tool_calls[0];

  if (toolCall.type !== "function") {
    console.log("❌ Unsupported tool type");
    return;
  }

  // =============================
  // 🔥 Handler برای getPoolLayout
  // =============================
  if (toolCall.name === "getPoolLayout") {
    const args = JSON.parse(toolCall.arguments);
    const result = await getPoolLayoutTool(args);

    const res2 = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      tools,
      messages: [
        { role: "assistant", tool_calls: [toolCall] },
        {
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        }
      ]
    });

    console.log("FINAL RESPONSE:");
    console.log(res2.choices[0].message);
    return;
  }

  // =============================
  // 🔥 Handler برای executeBuy
  // =============================
  if (toolCall.name === "executeBuy") {
    const args = JSON.parse(toolCall.arguments);
    const result = await executeBuyTool(args);

    const res2 = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      tools,
      messages: [
        { role: "assistant", tool_calls: [toolCall] },
        {
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        }
      ]
    });

    console.log("BUY RESPONSE:");
    console.log(res2.choices[0].message);
    return;
  }

  // =============================
  // 🔥 Handler برای executeSell
  // =============================
  if (toolCall.name === "executeSell") {
    const args = JSON.parse(toolCall.arguments);
    const result = await executeSellTool(args);

    const res2 = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        tools,
        messages: [
        { role: "assistant", tool_calls: [toolCall] },
        {
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
        }
        ]
    });

    console.log("SELL RESPONSE:", res2.choices[0].message);
    return;
    }

}
