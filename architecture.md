# Cosense MCP Server Architecture

This document describes the architecture and data flow of the `cosense-mcp` server.

## Architecture Diagram

```mermaid
graph TD
    subgraph "External Resources (Cosense/Scrapbox)"
        API[Scrapbox API: https://scrapbox.io/api]
    end

    subgraph "MCP Server (cosense-mcp)"
        subgraph "Entry Point"
            Index[index.ts: CosenseServer]
        end

        subgraph "Business Logic"
            Handlers[handlers.ts: Tool Handlers]
            Types[types.ts: Zod Schemas]
            Constants[constants.ts: Config & Axios Client]
        end
    end

    subgraph "MCP Client (VS Code, etc.)"
        Client[MCP Client]
    end

    %% Interactions
    Client -- "JSON-RPC via Stdio" --> Index
    Index -- "ListTools / CallTool" --> Client
    
    Index -- "Routes calls" --> Handlers
    Handlers -- "Validates arguments" --> Types
    Handlers -- "Uses shared config" --> Constants
    
    Handlers -- "HTTP GET/POST (Cookie authentication)" --> API
    API -- "JSON Response" --> Handlers
    Handlers -- "Formatted Text Result" --> Index
    Index -- "JSON-RPC Message" --> Client

    %% Configuration
    ENV[(Environment Variables)]
    ENV -- "SCRAPBOX_PROJECTS" --> Constants
    ENV -- "SCRAPBOX_CONNECT_SID" --> Constants
```

## Component Breakdown

1.  **[index.ts](src/index.ts) (CosenseServer)**:
    *   Manages the MCP server lifecycle.
    *   Defines tools (metadata, input schemas) and exposes them to the client.
    *   Routes incoming tool requests to the appropriate handler.

2.  **[handlers.ts](src/handlers.ts)**:
    *   Implements the core logic for each tool (`get_page`, `create_page`, `search_pages`, `search_all`).
    *   Handles Scrapbox API interaction, data parsing, and response formatting.

3.  **[constants.ts](src/constants.ts)**:
    *   Loads and processes configuration from environment variables (`SCRAPBOX_PROJECTS`, `SCRAPBOX_CONNECT_SID`).
    *   Initializes the shared `axios` instance for API communication.

4.  **[types.ts](src/types.ts)**:
    *   Defines Zod schemas for validating tool input parameters.

## Data Flow

1.  The **MCP Client** (e.g., GitHub Copilot or another AI assistant) sends a tool call request.
2.  **`index.ts`** receives the request and routes it to the correct function in **`handlers.ts`**.
3.  **`handlers.ts`** validates the arguments using schemas from **`types.ts`** and makes HTTP requests to the **Scrapbox API** using the client from **`constants.ts`**.
4.  The results are formatted into text and returned through the server to the client via JSON-RPC.
