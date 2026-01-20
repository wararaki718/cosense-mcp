import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { z } from "zod";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mcpServerPath = path.resolve(__dirname, "../../mcp/build/index.js");

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3001;

async function setupAgent() {
  // 1. Initialize MCP Client
  const transport = new StdioClientTransport({
    command: "node",
    args: [mcpServerPath],
    env: process.env as Record<string, string>,
  });

  const mcpClient = new Client(
    {
      name: "cosense-backend-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  await mcpClient.connect(transport);
  console.log("Connected to MCP Server");

  // 2. Fetch tools from MCP Server
  console.log("Fetching tools...");
  const { tools: mcpTools } = await mcpClient.listTools();
  console.log(`Successfully fetched ${mcpTools.length} tools`);

  // 3. Convert to LangChain tools
  const langchainTools = mcpTools.map((tool) => {
    // Define a basic schema based on known tools to improve reliability
    let schema: z.ZodObject<any> = z.object({});
    if (tool.name === "search_pages" || tool.name === "search_all") {
      schema = z.object({ query: z.string().describe("検索キーワード") });
    } else if (tool.name === "get_page") {
      schema = z.object({ 
        title: z.string().describe("ページタイトル"),
        projectName: z.string().optional().describe("プロジェクト名")
      });
    } else if (tool.name === "create_page") {
      schema = z.object({
        title: z.string().describe("ページタイトル"),
        body: z.string().describe("本文"),
        projectName: z.string().optional().describe("プロジェクト名"),
        appendIfExists: z.boolean().optional().describe("既存ページがある場合に追記するか")
      });
    } else {
      schema = z.object({}).passthrough();
    }

    return new DynamicStructuredTool({
      name: tool.name,
      description: tool.description || "",
      schema: schema,
      func: async (args: any) => {
        try {
          console.log(`Tool calling: ${tool.name}`, JSON.stringify(args));
          
          const result = await mcpClient.callTool({
            name: tool.name,
            arguments: args,
          });
          
          console.log(`Tool result (${tool.name}): Success`);
          return JSON.stringify(result.content);
        } catch (error: any) {
          console.error(`Error in tool ${tool.name}:`, error);
          return `Error calling tool ${tool.name}: ${error.message}`;
        }
      },
    });
  });

  // 4. Setup Agent
  console.log("Initializing Agent...");
  const llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash-lite",
    apiKey: process.env.GEMINI_API_KEY,
    temperature: 0.3,
    maxRetries: 5,
  });

  const agentCheckpointer = new MemorySaver();
  const agent = createReactAgent({
    llm,
    tools: langchainTools,
    checkpointSaver: agentCheckpointer,
  });
  console.log("Agent fully initialized and ready");

  return agent;
}

const agentPromise = setupAgent();

app.post("/chat", async (req, res) => {
  try {
    const { message, threadId = "default" } = req.body;
    const agent = await agentPromise;

    const result = await agent.invoke(
      {
        messages: [{ role: "user", content: message }],
      },
      { configurable: { thread_id: threadId } }
    );

    const lastMessage = result.messages[result.messages.length - 1];
    res.json({ response: lastMessage.content });
  } catch (error: any) {
    console.error("Error in /chat:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
});
