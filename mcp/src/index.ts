import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createTodoApiClient, getApiOrigin } from './client.js';
import { registerTodoTools } from './tools.js';

const server = new McpServer({
  name: 'todo-app',
  version: '1.0.0'
});

registerTodoTools(server, createTodoApiClient());

async function main(): Promise<void> {
  // Avoid stdout noise — MCP stdio uses stdout for the protocol.
  console.error(`todo-app MCP listening (stdio); API ${getApiOrigin()}`);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
