import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { BunproClient, readTokenFromFile } from "./client.js";
import { tools } from "./tools.js";

const frontendToken = process.env.BUNPRO_API_TOKEN;
const legacyKey = process.env.BUNPRO_API_KEY;

// The frontend token is resolved per call (file first), so the server may start
// when only the token file carries it — not just the spawn-time env.
if (!frontendToken && !legacyKey && !readTokenFromFile()) {
  console.error(
    "Error: Set at least one of:\n" +
      "  BUNPRO_API_TOKEN  — frontend JWT token (full access)\n" +
      "  BUNPRO_API_KEY    — legacy API key (study_queue + recent_items only)\n\n" +
      "To get BUNPRO_API_TOKEN:\n" +
      "  1. Log in to bunpro.jp\n" +
      "  2. Open DevTools → Application → Cookies → bunpro.jp\n" +
      "  3. Copy the value of 'frontend_api_token'"
  );
  process.exit(1);
}

const client = new BunproClient(frontendToken, legacyKey);

const server = new McpServer({
  name: "bunpro",
  version: "1.0.0",
});

// Register all tools
for (const tool of tools) {
  // Extract the shape from a ZodObject, or use empty object for z.object({})
  const schema = tool.inputSchema as z.ZodObject<z.ZodRawShape>;
  const shape = schema instanceof z.ZodObject ? schema.shape : {};

  server.tool(tool.name, tool.description, shape, async (args) => {
    try {
      const result = await tool.handler(client, args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  });
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Bunpro MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
