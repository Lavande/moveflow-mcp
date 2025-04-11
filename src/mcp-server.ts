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
        },
        interval: {
          type: "integer",
          description: "释放时间间隔（秒），默认为86400（每天）"
        },
        start_delay: {
          type: "integer",
          description: "开始前延迟时间（秒），默认为300（5分钟）"
        },
        cliff_time_enabled: {
          type: "boolean",
          description: "是否启用悬崖时间，默认为true"
        },
        pauseable: {
          type: "string",
          description: "谁可以暂停流：sender（发送方）、recipient（接收方）、both（双方）",
          enum: ["sender", "recipient", "both"]
        },
        closeable: {
          type: "string",
          description: "谁可以关闭流：sender（发送方）、recipient（接收方）、both（双方）",
          enum: ["sender", "recipient", "both"]
        },
        recipient_modifiable: {
          type: "string",
          description: "谁可以修改接收方：sender（发送方）、recipient（接收方）、both（双方）、none（无人）",
          enum: ["sender", "recipient", "both", "none"]
        },
        remark: {
          type: "string",
          description: "备注信息"
        }
      }
    }
  },
  {
    // 批量创建支付流工具
    name: "batch_create_stream",
    description: "批量创建多个支付流，一次最多创建200个",
    inputSchema: {
      type: "object",
      required: ["recipients", "amounts", "token_type", "duration"],
      properties: {
        recipients: {
          type: "array",
          items: {
            type: "string"
          },
          description: "接收方地址列表"
        },
        amounts: {
          type: "array",
          items: {
            type: "string"
          },
          description: "对应的支付金额列表，长度必须与地址列表相同"
        },
        token_type: {
          type: "string",
          description: "代币类型"
        },
        duration: {
          type: "integer",
          description: "持续时间（秒）"
        },
        names: {
          type: "array",
          items: {
            type: "string"
          },
          description: "可选的支付流名称列表，若不提供则自动生成"
        },
        interval: {
          type: "integer",
          description: "释放时间间隔（秒），默认为86400（每天）"
        },
        start_delay: {
          type: "integer",
          description: "开始前延迟时间（秒），默认为300（5分钟）"
        },
        cliff_time_enabled: {
          type: "boolean",
          description: "是否启用悬崖时间，默认为true"
        },
        pauseable: {
          type: "string",
          description: "谁可以暂停流：sender（发送方）、recipient（接收方）、both（双方）",
          enum: ["sender", "recipient", "both"]
        },
        closeable: {
          type: "string",
          description: "谁可以关闭流：sender（发送方）、recipient（接收方）、both（双方）",
          enum: ["sender", "recipient", "both"]
        },
        recipient_modifiable: {
          type: "string",
          description: "谁可以修改接收方：sender（发送方）、recipient（接收方）、both（双方）、none（无人）",
          enum: ["sender", "recipient", "both", "none"]
        },
        remark: {
          type: "string",
          description: "备注信息"
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
  },
  {
    // 查询钱包余额工具
    name: "get_wallet_balance",
    description: "查询指定钱包地址的余额，支持使用简化的代币名称如'APT'或完整的类型名称如'0x1::aptos_coin::AptosCoin'",
    inputSchema: {
      type: "object",
      required: [],
      properties: {
        address: {
          type: "string",
          description: "钱包地址，如果不提供则使用当前账户"
        },
        token_type: {
          type: "string",
          description: "代币类型，可使用简称如'APT'或完整名称，默认为APT代币"
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
      case "create_stream":
        const createResult = await moveflowService.createStream(
          args.recipient as string,
          args.amount as string,
          args.token_type as string,
          args.duration as number,
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
          result: parseServiceResult(createResult)
        };
      
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
          result: parseServiceResult(batchCreateResult)
        };
      
      case "get_stream":
        // 设置操作超时
        try {
          const streamPromise = moveflowService.getStream(args.stream_id as string);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("获取流信息请求超时")), 20000)
          );
          
          const streamResult = await Promise.race([streamPromise, timeoutPromise]);
          return {
            result: parseServiceResult(streamResult as string)
          };
        } catch (error: any) {
          return {
            result: {
              success: false,
              error: `操作超时或失败: ${error.message || String(error)}`,
              建议: "请尝试使用更小的查询范围或稍后再试"
            }
          };
        }
      
      case "get_account_streams":
        // 设置更长的超时，带进度反馈
        try {
          // 使用Promise.race处理可能的超时
          const streamsPromise = moveflowService.getAccountStreams(args.address as string);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("获取账户流请求超时(40秒)")), 40000)
          );
          
          // 添加进度反馈
          let feedbackSent = false;
          const feedbackPromise = new Promise(async (resolve) => {
            // 等待10秒后发送进度反馈
            await new Promise(r => setTimeout(r, 10000));
            if (!feedbackSent) {
              console.log("操作仍在进行中，正在等待结果...");
              feedbackSent = true;
            }
            // 继续等待结果
            await new Promise(r => setTimeout(r, 10000));
            if (!feedbackSent) {
              console.log("操作仍在进行，可能需要更长时间...");
            }
            // 这个Promise不应该resolve，它只是用来反馈进度
          });
          
          const streamsResult = await Promise.race([streamsPromise, timeoutPromise, feedbackPromise]);
          return {
            result: parseServiceResult(streamsResult as string)
          };
        } catch (error: any) {
          return {
            result: {
              success: false,
              error: `获取账户流失败: ${error.message || String(error)}`,
              建议: "请尝试减少查询范围或提供具体的账户地址",
              推荐操作: "尝试先获取单个流信息，或查询特定时间段内的流"
            }
          };
        }
      
      case "cancel_stream":
        const cancelResult = await moveflowService.cancelStream(args.stream_id as string);
        return {
          result: parseServiceResult(cancelResult)
        };
      
      case "get_wallet_balance":
        const balanceResult = await moveflowService.getWalletBalance(args.address as string, args.token_type as string);
        result = parseServiceResult(balanceResult);
        break;
      
      default:
        throw new Error(`工具不存在: ${name}`);
    }

    // 返回符合MCP规范的格式
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
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