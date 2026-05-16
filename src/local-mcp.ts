import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Env } from "./types.ts";
import { registerPrivateBookingTools, registerPublicTools } from "./tool-registration.ts";

const DEFAULTS = {
  PREFERRED_CINEMAS: "babylon-kreuzberg,delphi-filmpalast,delphi-lux,filmtheater-am-friedrichshain,kant-kino,kino-international,neues-off,odeon,passage,rollberg,yorck",
  DEFAULT_FORMATS: "OmeU,OV,OmU",
  COGNITO_USER_POOL: "eu-central-1_TIusy2VuG",
  COGNITO_CLIENT_ID: "4m9hc0qk59mvcb4hfd6lep1262",
  COGNITO_REGION: "eu-central-1",
  VISTA_BASE: "https://uq8lgoj7z2.execute-api.eu-central-1.amazonaws.com/production/api/vista",
  YORCK_AUTH_BASE: "https://rbfmu7cs19.execute-api.eu-central-1.amazonaws.com/production",
  YORCK_BASE: "https://www.yorck.de",
  PUBLIC_BASE_URL: "https://yorck-mcp.isiklimahir.workers.dev",
};

type KvRecord = { value: string; expiresAt?: number };

class MemoryKv {
  private store = new Map<string, KvRecord>();

  async get(key: string, type?: "text" | "json" | "arrayBuffer" | "stream") {
    const record = this.store.get(key);
    if (!record) return null;
    if (record.expiresAt && Date.now() > record.expiresAt) {
      this.store.delete(key);
      return null;
    }
    if (type === "json") return JSON.parse(record.value);
    if (type === "arrayBuffer") return new TextEncoder().encode(record.value).buffer;
    return record.value;
  }

  async put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: { expirationTtl?: number }) {
    if (typeof value !== "string") throw new Error("local MCP MemoryKv only supports string values");
    this.store.set(key, {
      value,
      expiresAt: options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : undefined,
    });
  }
}

function envFromProcess(): Env {
  return {
    CACHE: new MemoryKv() as unknown as KVNamespace,
    MCP_OBJECT: undefined as unknown as DurableObjectNamespace,
    PUBLIC_MCP_OBJECT: undefined as unknown as DurableObjectNamespace,
    BROWSER: undefined as unknown as Fetcher,
    PREFERRED_CINEMAS: process.env.YORCK_PREFERRED_CINEMAS || DEFAULTS.PREFERRED_CINEMAS,
    DEFAULT_FORMATS: process.env.YORCK_DEFAULT_FORMATS || DEFAULTS.DEFAULT_FORMATS,
    COGNITO_USER_POOL: process.env.COGNITO_USER_POOL || DEFAULTS.COGNITO_USER_POOL,
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID || DEFAULTS.COGNITO_CLIENT_ID,
    COGNITO_REGION: process.env.COGNITO_REGION || DEFAULTS.COGNITO_REGION,
    VISTA_BASE: process.env.VISTA_BASE || DEFAULTS.VISTA_BASE,
    YORCK_AUTH_BASE: process.env.YORCK_AUTH_BASE || DEFAULTS.YORCK_AUTH_BASE,
    YORCK_BASE: process.env.YORCK_BASE || DEFAULTS.YORCK_BASE,
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || DEFAULTS.PUBLIC_BASE_URL,
    YORCK_EMAIL: process.env.YORCK_EMAIL,
    YORCK_PASSWORD: process.env.YORCK_PASSWORD,
    YORCK_UNLIMITED_CARD: process.env.YORCK_UNLIMITED_CARD,
    YORCK_MCP_AUTH_TOKEN: process.env.YORCK_MCP_AUTH_TOKEN,
  };
}

export async function runLocalMcp(): Promise<void> {
  const env = envFromProcess();
  const server = new McpServer({ name: "yorck-local", version: "0.1.0" });
  registerPublicTools(server, env);
  registerPrivateBookingTools(server, env);
  await server.connect(new StdioServerTransport());
}
