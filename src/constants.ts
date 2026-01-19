import axios from "axios";

export const targetProjects = (process.env.SCRAPBOX_PROJECT || "")
  .split(",")
  .map((p) => p.trim())
  .filter((p) => p !== "");

export const CONNECT_SID = process.env.SCRAPBOX_CONNECT_SID;

if (targetProjects.length === 0) {
  console.error("Error: SCRAPBOX_PROJECT environment variable is required.");
  process.exit(1);
}

export const apiClient = axios.create({
  baseURL: "https://scrapbox.io/api",
  headers: {
    Cookie: CONNECT_SID ? `connect.sid=${CONNECT_SID}` : "",
    "Content-Type": "application/json",
  },
});
