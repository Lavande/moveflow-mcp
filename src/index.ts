import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { mcpTools } from "./tools/definitions";
import { ToolHandlers } from "./tools/handlers";
import { ExecuteToolRequest, ListToolsRequest } from "./models/types";

// 定义执行工具的请求模式
const ExecuteToolRequestSchema = z.object({
  method: z.literal("tools/call"),
  params: z.object({
    name: z.string(),
    arguments: z.record(z.unknown()).optional()
  })
});

// 添加tools/list请求的Schema
const ListToolsRequestSchema = z.object({
  method: z.literal("tools/list"),
  params: z.object({}).optional()
});

/**
 * 主入口函数
 */
async function main() {
  // 初始化工具处理程序
  const toolHandlers = new ToolHandlers();

  // 创建MCP服务器
  const server = new Server({
    name: "moveflow-mcp-server",
    version: "1.0.1"
  }, {
    capabilities: {
      // 使用tools能力，并直接在这里定义工具
      tools: {
        tools: mcpTools
      }
    }
  });

  // 添加tools/list方法的处理程序
  server.setRequestHandler(ListToolsRequestSchema, async (_request: ListToolsRequest) => {
    return {
      tools: mcpTools
    };
  });

  // 设置工具处理函数
  server.setRequestHandler(ExecuteToolRequestSchema, async (request: ExecuteToolRequest) => {
    const { name, arguments: args = {} } = request.params;
    
    // 调用工具处理程序
    return toolHandlers.handleToolCall(name, args);
  });

  // 连接到stdio传输
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// 启动服务器
main().catch(error => {
  process.stderr.write(`服务器启动失败: ${error}\n`);
  process.exit(1);
}); 