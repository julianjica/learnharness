import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";

/**
 * AgentTool registry → an in-process MCP server for Claude Code
 * (docs/claude-code-engine.md, "Mapping").
 *
 * Built on the LOW-LEVEL request handlers on purpose: the SDK's `tool()`
 * helper wants Zod shapes and validates before our handler runs. Our tools
 * are TypeBox (plain JSON Schema), and pi's own preparation — heal
 * (prepareArguments) then validation — must run exactly as it does on the
 * pi engine. So the schemas are listed verbatim and the raw arguments go
 * straight to `call`, which runs pi's runToolCall.
 */

export const MCP_SERVER_NAME = "lh";
const PREFIX = `mcp__${MCP_SERVER_NAME}__`;

/** The name Claude Code shows the model for one of our tools. */
export function mcpToolName(name: string): string {
	return `${PREFIX}${name}`;
}

/** Back to the record's tool name (prefix stripped; foreign names kept). */
export function recordToolName(name: string): string {
	return name.startsWith(PREFIX) ? name.slice(PREFIX.length) : name;
}

/** JSON Schema without TypeBox's symbol-keyed metadata. */
function plainSchema(schema: unknown): Record<string, unknown> {
	const plain = JSON.parse(JSON.stringify(schema ?? { type: "object" })) as Record<string, unknown>;
	if (plain.type !== "object") return { type: "object", properties: {}, ...plain };
	return plain;
}

export type ToolCaller = (name: string, args: unknown) => Promise<CallToolResult>;

export function createToolServer(tools: readonly AgentTool<any, any>[], call: ToolCaller): McpSdkServerConfigWithInstance {
	const server = new McpServer({ name: MCP_SERVER_NAME, version: "1.0.0" }, { capabilities: { tools: {} } });
	server.server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: tools.map((tool) => ({
			name: tool.name,
			description: tool.description,
			inputSchema: plainSchema(tool.parameters) as { type: "object"; properties?: Record<string, object> },
		})),
	}));
	server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const { name, arguments: args } = request.params;
		try {
			return await call(name, args ?? {});
		} catch (error) {
			return { content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }], isError: true };
		}
	});
	return { type: "sdk", name: MCP_SERVER_NAME, instance: server };
}
