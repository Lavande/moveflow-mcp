import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MoveFlowService } from "./moveflow-service";
import { z } from "zod";

// 工具定义
const tools = [
  {
    // 创建支付流工具
    name: "create_stream",
    description: "创建一个新的支付流",
    inputSchema: {
      type: "object",
      required: ["recipient", "amount", "token_type", "duration"],
      properties: {
        recipient: {
          type: "string",
          description: "接收方地址"
        },
        amount: {
          type: "string",
          description: "支付金额"
        },
        token_type: {
          type: "string",
          description: "代币类型"
        },
        duration: {
          type: "integer",
          description: "持续时间（秒）"
        }
      }
    }
  },
  {
    // 获取支付流信息工具
    name: "get_stream",
    description: "获取支付流详情",
    inputSchema: {
      type: "object",
      required: ["stream_id"],
      properties: {
        stream_id: {
          type: "string",
          description: "支付流ID"
        }
      }
    }
  },
  {
    // 获取账户的所有支付流工具
    name: "get_account_streams",
    description: "获取指定账户的所有支付流",
    inputSchema: {
      type: "object",
      required: [],
      properties: {
        address: {
          type: "string",
          description: "账户地址，如果不提供则使用当前账户"
        }
      }
    }
  },
  {
    // 取消支付流工具
    name: "cancel_stream",
    description: "取消支付流",
    inputSchema: {
      type: "object",
      required: ["stream_id"],
      properties: {
        stream_id: {
          type: "string",
          description: "支付流ID"
        }
      }
    }
  }
];

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

// 类型定义，匹配schema
type ExecuteToolRequest = {
  method: "tools/call";
  params: {
    name: string;
    arguments?: Record<string, unknown>;
  };
};

// 添加ListToolsRequest类型
type ListToolsRequest = {
  method: "tools/list";
  params?: Record<string, never>;
};

async function main() {
  // 初始化MoveFlow服务
  const moveflowService = new MoveFlowService();

  // 创建MCP服务器
  const server = new Server({
    name: "moveflow-mcp-server",
    version: "1.0.0"
  }, {
    capabilities: {
      // 使用tools能力，并直接在这里定义工具
      tools: {
        tools: tools
      }
    }
  });

  // 添加tools/list方法的处理程序
  server.setRequestHandler(ListToolsRequestSchema, async (_request: ListToolsRequest) => {
    return {
      tools: tools
    };
  });

  // 设置工具处理函数 - 使用类型定义
  server.setRequestHandler(ExecuteToolRequestSchema, async (request: ExecuteToolRequest) => {
    const { name, arguments: args = {} } = request.params;

    // 根据工具名称调用相应的功能
    switch (name) {
      case "create_stream":
        return {
          result: await moveflowService.createStream(
            args.recipient as string,
            args.amount as string,
            args.token_type as string,
            args.duration as number
          )
        };
      
      case "get_stream":
        return {
          result: await moveflowService.getStream(args.stream_id as string)
        };
      
      case "get_account_streams":
        return {
          result: await moveflowService.getAccountStreams(args.address as string)
        };
      
      case "cancel_stream":
        return {
          result: await moveflowService.cancelStream(args.stream_id as string)
        };
      
      default:
        throw new Error(`工具不存在: ${name}`);
    }
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