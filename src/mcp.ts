import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "./types.ts";
import { registerPrivateBookingTools, registerPublicTools } from "./tool-registration.ts";

export { registerPrivateBookingTools, registerPublicTools } from "./tool-registration.ts";

export class PublicYorckMcp extends McpAgent<Env> {
  server = new McpServer({
    name: "yorck-public",
    version: "0.1.0",
  });

  async init() {
    registerPublicTools(this.server, this.env);
  }
}

export class YorckMcp extends McpAgent<Env> {
  server = new McpServer({
    name: "yorck-private",
    version: "0.1.0",
  });

  async init() {
    const env = this.env;
    registerPublicTools(this.server, env);
    registerPrivateBookingTools(this.server, env);
  }
}
