// src/agent/tools-def.ts

export const tools = [
  {
    type: "function" as const,
    function: {
      name: "getPoolLayout",
      description: "Returns full account layout needed for PumpSwap BUY",
      parameters: {
        type: "object",
        properties: {
          pool: { type: "string" },
          baseMint: { type: "string" },
          quoteMint: { type: "string" },
          user: { type: "string" }
        },
        required: ["pool", "baseMint", "quoteMint", "user"]
      }
    }
  },

  {
    type: "function" as const,
    function: {
      name: "executeBuy",
      description: "Executes a BUY on PumpSwap AMM",
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
    type: "function" as const,
    function: {
      name: "executeSell",
      description: "Executes a SELL on PumpSwap AMM",
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
  }
];
