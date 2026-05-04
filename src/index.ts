/**
 * tldraw MCP Server
 *
 * Entry point for the MCP server that provides programmatic
 * control over tldraw canvases via the Model Context Protocol.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const EXPRESS_SERVER_URL =
  process.env.EXPRESS_SERVER_URL || "http://127.0.0.1:3000";

async function main() {
  const server = new Server(
    {
      name: "tldraw-mcp-server",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // TODO: Register tools (create_element, get_element, update_element, etc.)
  // TODO: Register resources (diagram guide, etc.)
  // TODO: Connect to canvas server at EXPRESS_SERVER_URL

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`tldraw MCP server running (canvas: ${EXPRESS_SERVER_URL})`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
