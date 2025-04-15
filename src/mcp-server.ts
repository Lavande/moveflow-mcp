import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MoveFlowService } from "./services/moveflow-service";
import { z } from "zod";
import { mcpTools } from "./tools/definitions";
import { config } from "./config";

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
    version: "1.0.1"
  }, {
    capabilities: {
      // 使用tools能力，并使用导入的工具定义
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

  // 设置工具处理函数 - 使用类型定义
  server.setRequestHandler(ExecuteToolRequestSchema, async (request: ExecuteToolRequest) => {
    const { name, arguments: args = {} } = request.params;

    // 解析service返回的JSON字符串为对象
    const parseServiceResult = (resultStr: string) => {
      try {
        return JSON.parse(resultStr);
      } catch (error) {
        return { 
          success: false, 
          error: `解析结果失败: ${error}`, 
          raw: resultStr 
        };
      }
    };

    let result;
    // 根据工具名称调用相应的功能
    switch (name) {
      case "batch_create_stream":
        const batchCreateResult = await moveflowService.batchCreateStream(
          args.recipients as string[],
          args.amounts as string[],
          args.token_type as string,
          args.duration as number,
          args.names as string[] | undefined,
          {
            interval: args.interval as number,
            start_delay: args.start_delay as number,
            cliff_time_enabled: args.cliff_time_enabled as boolean,
            pauseable: args.pauseable as string,
            closeable: args.closeable as string,
            recipient_modifiable: args.recipient_modifiable as string,
            remark: args.remark as string,
          }
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(parseServiceResult(batchCreateResult))
            }
          ]
        };
      
      case "get_stream_info":
        // 设置操作超时
        try {
          const streamPromise = moveflowService.getStream(args.stream_id as string);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`获取流信息请求超时(${config.TIMEOUT.STREAM_INFO / 1000}秒)`)), 
              config.TIMEOUT.STREAM_INFO)
          );
          
          const streamResult = await Promise.race([streamPromise, timeoutPromise]);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(parseServiceResult(streamResult as string))
              }
            ]
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: `操作超时或失败: ${error.message || String(error)}`,
                  建议: "请尝试使用更小的查询范围或稍后再试"
                })
              }
            ]
          };
        }
      
      case "get_account_streams":
        try {
          // 使用配置中定义的超时时间
          const streamsPromise = moveflowService.getAccountStreams(args.address as string);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`获取账户流请求超时(${config.TIMEOUT.ACCOUNT_STREAMS / 1000}秒)`)), 
              config.TIMEOUT.ACCOUNT_STREAMS)
          );
          
          // 简化为只使用Promise.race处理超时
          const streamsResult = await Promise.race([streamsPromise, timeoutPromise]);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(parseServiceResult(streamsResult as string))
              }
            ]
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: `获取账户流失败: ${error.message || String(error)}`,
                  建议: "请尝试减少查询范围或提供具体的账户地址"
                })
              }
            ]
          };
        }
      
      case "cancel_stream":
        const cancelResult = await moveflowService.cancelStream(args.stream_id as string);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(parseServiceResult(cancelResult))
            }
          ]
        };
      
      case "get_wallet_balance":
        const balanceResult = await moveflowService.getWalletBalance(args.address as string, args.token_type as string);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(parseServiceResult(balanceResult))
            }
          ]
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