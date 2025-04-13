import { McpTool } from "../models/types";

/**
 * MCP工具定义
 */
export const mcpTools: McpTool[] = [
  {
    // 批量创建支付流工具
    name: "batch_create_stream",
    description: "批量创建多个支付流，可以只创建一个或多个，一次最多创建200个",
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