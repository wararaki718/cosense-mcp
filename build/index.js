#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { z } from "zod";
const SCRAPBOX_PROJECTS = (process.env.SCRAPBOX_PROJECT || "").split(",").map(p => p.trim()).filter(p => p !== "");
const CONNECT_SID = process.env.SCRAPBOX_CONNECT_SID;
if (SCRAPBOX_PROJECTS.length === 0) {
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
    server;
    constructor() {
        this.server = new Server({
            name: "cosense-mcp",
            version: "0.1.0",
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupToolHandlers();
        // Error handling
        this.server.onerror = (error) => console.error("[MCP Error]", error);
        process.on("SIGINT", async () => {
            await this.server.close();
            process.exit(0);
        });
    }
    setupToolHandlers() {
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
                            project: {
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
                            project: {
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
                    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
            }
        });
    }
    async handleGetPage(args) {
        const { title, project } = z.object({
            title: z.string(),
            project: z.string().optional().default(SCRAPBOX_PROJECTS[0])
        }).parse(args);
        try {
            const response = await apiClient.get(`/pages/${project}/${encodeURIComponent(title)}`);
            const lines = response.data.lines.map((l) => l.text).join("\n");
            return {
                content: [
                    {
                        type: "text",
                        text: lines,
                    },
                ],
            };
        }
        catch (error) {
            if (error.response?.status === 404) {
                throw new McpError(ErrorCode.InvalidRequest, `Page "${title}" not found in project "${project}".`);
            }
            throw new McpError(ErrorCode.InternalError, `Failed to get page: ${error.message}`);
        }
    }
    async handleCreatePage(args) {
        const { title, body, project, appendIfExists } = z.object({
            title: z.string(),
            body: z.string(),
            project: z.string().optional().default(SCRAPBOX_PROJECTS[0]),
            appendIfExists: z.boolean().optional().default(false)
        }).parse(args);
        try {
            // Check if project is authorized
            if (!SCRAPBOX_PROJECTS.includes(project)) {
                throw new McpError(ErrorCode.InvalidParams, `Project "${project}" is not in the allowed list.`);
            }
            // Check if page exists first
            let existingPage = null;
            try {
                const checkRes = await apiClient.get(`/pages/${project}/${encodeURIComponent(title)}`);
                existingPage = checkRes.data;
            }
            catch (e) {
                if (e.response?.status !== 404)
                    throw e;
            }
            if (existingPage && !appendIfExists) {
                throw new McpError(ErrorCode.InvalidRequest, `Page "${title}" already exists in project "${project}".`);
            }
            const lines = body.split("\n");
            if (existingPage && appendIfExists) {
                // Appending to existing page
                const newLines = [...existingPage.lines.map((l) => l.text), ...lines];
                await apiClient.post(`/pages/${project}`, {
                    title,
                    lines: newLines,
                });
                return {
                    content: [{ type: "text", text: `Successfully appended to page "${title}" in project "${project}".` }],
                };
            }
            else {
                // Create new page
                await apiClient.post(`/pages/${project}`, {
                    title,
                    lines: [title, ...lines],
                });
                return {
                    content: [{ type: "text", text: `Successfully created page "${title}" in project "${project}".` }],
                };
            }
        }
        catch (error) {
            if (error instanceof McpError)
                throw error;
            throw new McpError(ErrorCode.InternalError, `Failed to create/update page: ${error.message}`);
        }
    }
    async handleSearchPages(args) {
        const { query } = z.object({ query: z.string() }).parse(args);
        try {
            const results = await Promise.all(SCRAPBOX_PROJECTS.map(async (project) => {
                try {
                    const response = await apiClient.get(`/pages/${project}/search/query`, {
                        params: { q: query },
                    });
                    return response.data.pages.map((p) => `[${project}] ${p.title}`);
                }
                catch (e) {
                    console.error(`Search failed for project ${project}:`, e);
                    return [];
                }
            }));
            const allTitles = results.flat();
            return {
                content: [
                    {
                        type: "text",
                        text: allTitles.length > 0 ? allTitles.join("\n") : "No pages found in any project.",
                    },
                ],
            };
        }
        catch (error) {
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
