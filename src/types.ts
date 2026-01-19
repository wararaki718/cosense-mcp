import { z } from "zod";
import { targetProjects } from "./constants.js";

export const GetPageArgsSchema = z.object({
  title: z.string(),
  projectName: z.string().optional().default(targetProjects[0]),
});

export const CreatePageArgsSchema = z.object({
  title: z.string(),
  body: z.string(),
  projectName: z.string().optional().default(targetProjects[0]),
  appendIfExists: z.boolean().optional().default(false),
});

export const SearchPagesArgsSchema = z.object({
  query: z.string(),
  projectName: z.string().optional(),
});
