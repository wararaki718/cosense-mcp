#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { z } from "zod";

const SCRAPBOX_PROJECT = process.env.SCRAPBOX_PROJECT;
const CONNECT_SID = process.env.SCRAPBOX_CONNECT_SID;

if (!SCRAPBOX_PROJECT) {
  console.error("Error: SCRAPBOX_PROJECT environment variable is required.");
  process.exit(1);
}

const apiClient = axios.create({
  baseURL: "https://scrapbox.io/api",
  headers: {
    Cookie: CONNECT_SID ? `connect.sid=${CONNECT_SID}` : "",
    "Content-Type": "application/json",
  },
});

class CosenseServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "cosense-mcp",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "get_page",
          description: "Get the content of a specific Scrapbox (Cosense) page.",
          inputSchema: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "The title of the page to retrieve",
              },
            },
            required: ["title"],
          },
        },
        {
          name: "create_page",
          description: "Create a new page in the Scrapbox project.",
          inputSchema: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "The title of the new page",
              },
              body: {
                type: "string",
                description: "The content of the page",
              },
              appendIfExists: {
                type: "boolean",
                description: "If true, appends to the existing page if it exists. If false, returns an error if page exists.",
                default: false,
              }
            },
            required: ["title", "body"],
          },
        },
        {
          name: "search_pages",
          description: "Search for pages in the project by query keywords.",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search keywords",
              },
            },
            required: ["query"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case "get_page":
          return this.handleGetPage(request.params.arguments);
        case "create_page":
          return this.handleCreatePage(request.params.arguments);
        case "search_pages":
          return this.handleSearchPages(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async handleGetPage(args: any) {
    const { title } = z.object({ title: z.string() }).parse(args);
    try {
      const response = await apiClient.get(`/pages/${SCRAPBOX_PROJECT}/${encodeURIComponent(title)}`);
      const lines = response.data.lines.map((l: any) => l.text).join("\n");
      return {
        content: [
          {
            type: "text",
            text: lines,
          },
        ],
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new McpError(ErrorCode.InvalidRequest, `Page "${title}" not found.`);
      }
      throw new McpError(ErrorCode.InternalError, `Failed to get page: ${error.message}`);
    }
  }

  private async handleCreatePage(args: any) {
    const { title, body, appendIfExists } = z.object({ 
      title: z.string(), 
      body: z.string(),
      appendIfExists: z.boolean().optional().default(false)
    }).parse(args);

    try {
      // Check if page exists first
      let existingPage = null;
      try {
        const checkRes = await apiClient.get(`/pages/${SCRAPBOX_PROJECT}/${encodeURIComponent(title)}`);
        existingPage = checkRes.data;
      } catch (e: any) {
        if (e.response?.status !== 404) throw e;
      }

      if (existingPage && !appendIfExists) {
        throw new McpError(ErrorCode.InvalidRequest, `Page "${title}" already exists.`);
      }

      const lines = body.split("\n");
      
      if (existingPage && appendIfExists) {
        // Appending to existing page
        const newLines = [...existingPage.lines.map((l: any) => l.text), ...lines];
        await apiClient.post(`/pages/${SCRAPBOX_PROJECT}`, {
          title,
          lines: newLines,
        });
        return {
          content: [{ type: "text", text: `Successfully appended to page "${title}".` }],
        };
      } else {
        // Create new page
        await apiClient.post(`/pages/${SCRAPBOX_PROJECT}`, {
          title,
          lines: [title, ...lines],
        });
        return {
          content: [{ type: "text", text: `Successfully created page "${title}".` }],
        };
      }
    } catch (error: any) {
      if (error instanceof McpError) throw error;
      throw new McpError(ErrorCode.InternalError, `Failed to create/update page: ${error.message}`);
    }
  }

  private async handleSearchPages(args: any) {
    const { query } = z.object({ query: z.string() }).parse(args);
    try {
      const response = await apiClient.get(`/pages/${SCRAPBOX_PROJECT}/search/query`, {
        params: { q: query },
      });
      const titles = response.data.pages.map((p: any) => p.title);
      return {
        content: [
          {
            type: "text",
            text: titles.length > 0 ? titles.join("\n") : "No pages found.",
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(ErrorCode.InternalError, `Failed to search pages: ${error.message}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Cosense MCP server running on stdio");
  }
}

const server = new CosenseServer();
server.run().catch(console.error);
