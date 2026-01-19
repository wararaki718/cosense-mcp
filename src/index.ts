#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { SCRAPBOX_PROJECTS } from "./constants.js";
import {
  handleGetPage,
  handleCreatePage,
  handleSearchPages,
} from "./handlers.js";

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
              projectName: {
                type: "string",
                description: `The project to get the page from. Default: ${SCRAPBOX_PROJECTS[0]}`,
              },
            },
            required: ["title"],
          },
        },
        {
          name: "create_page",
          description: "Create a new page in a Scrapbox project.",
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
              projectName: {
                type: "string",
                description: `The project to create the page in. Default: ${SCRAPBOX_PROJECTS[0]}`,
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
          description: "Search for pages in configured projects by query keywords.",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search keywords",
              },
              projectName: {
                type: "string",
                description: "Specific project to search in. If not provided, searches all configured projects.",
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
          return handleGetPage(request.params.arguments);
        case "create_page":
          return handleCreatePage(request.params.arguments);
        case "search_pages":
          return handleSearchPages(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Cosense MCP server running on stdio");
  }
}

const server = new CosenseServer();
server.run().catch(console.error);
