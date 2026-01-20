import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { apiClient, targetProjects } from "./constants.js";
import {
  GetPageArgsSchema,
  CreatePageArgsSchema,
  SearchPagesArgsSchema,
} from "./types.js";

export async function handleGetPage(args: any) {
  const { title, projectName } = GetPageArgsSchema.parse(args);

  try {
    const response = await apiClient.get(
      `/pages/${projectName}/${encodeURIComponent(title)}`
    );
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
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Page "${title}" not found in project "${projectName}".`
      );
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get page: ${error.message}`
    );
  }
}

export async function handleCreatePage(args: any) {
  const { title, body, projectName, appendIfExists } =
    CreatePageArgsSchema.parse(args);

  try {
    if (!targetProjects.includes(projectName)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Project "${projectName}" is not in the allowed list.`
      );
    }

    let existingPage = null;
    try {
      const checkRes = await apiClient.get(
        `/pages/${projectName}/${encodeURIComponent(title)}`
      );
      existingPage = checkRes.data;
    } catch (e: any) {
      if (e.response?.status !== 404) throw e;
    }

    if (existingPage && !appendIfExists) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Page "${title}" already exists in project "${projectName}".`
      );
    }

    const lines = body.split("\n");

    if (existingPage && appendIfExists) {
      const newLines = [
        ...existingPage.lines.map((l: any) => l.text),
        ...lines,
      ];
      await apiClient.post(`/pages/${projectName}`, {
        title,
        lines: newLines,
      });
      return {
        content: [
          {
            type: "text",
            text: `Successfully appended to page "${title}" in project "${projectName}".`,
          },
        ],
      };
    } else {
      await apiClient.post(`/pages/${projectName}`, {
        title,
        lines: [title, ...lines],
      });
      return {
        content: [
          {
            type: "text",
            text: `Successfully created page "${title}" in project "${projectName}".`,
          },
        ],
      };
    }
  } catch (error: any) {
    if (error instanceof McpError) throw error;
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to create/update page: ${error.message}`
    );
  }
}

export async function handleSearchPages(args: any) {
  const { query, projectName } = SearchPagesArgsSchema.parse(args);

  try {
    const projectsToSearch = projectName ? [projectName] : targetProjects;
    const results = await Promise.all(
      projectsToSearch.map(async (project) => {
        try {
          const response = await apiClient.get(`/pages/${project}/search/query`, {
            params: { q: query },
          });
          return response.data.pages.map((p: any) => `[${project}] ${p.title}`);
        } catch (e) {
          console.error(`Search failed for project ${project}:`, e);
          return [];
        }
      })
    );

    const allTitles = results.flat();
    return {
      content: [
        {
          type: "text",
          text:
            allTitles.length > 0 ? allTitles.join("\n") : "No pages found.",
        },
      ],
    };
  } catch (error: any) {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to search pages: ${error.message}`
    );
  }
}

export async function handleSearchAll(args: any) {
  const { query } = SearchPagesArgsSchema.parse(args);

  try {
    const results = await Promise.all(
      targetProjects.map(async (project) => {
        try {
          const response = await apiClient.get(`/pages/${project}/search/query`, {
            params: { q: query },
          });
          return response.data.pages.map((p: any) => `[${project}] ${p.title}`);
        } catch (e) {
          console.error(`Search failed for project ${project}:`, e);
          return [];
        }
      })
    );

    const allTitles = results.flat();
    return {
      content: [
        {
          type: "text",
          text:
            allTitles.length > 0 ? allTitles.join("\n") : "No pages found in any project.",
        },
      ],
    };
  } catch (error: any) {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to search all projects: ${error.message}`
    );
  }
}
