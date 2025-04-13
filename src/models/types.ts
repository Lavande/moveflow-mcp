import { OperateUser } from "@moveflow/aptos-sdk";

// 网络类型定义
export type Network = string;

// 账户资源类型
export interface AccountResource {
  type: string;
  data: {
    coin: {
      value: string;
    };
  };
}

// 创建流的选项
export interface StreamOptions {
  interval?: number;
  start_delay?: number;
  cliff_time_enabled?: boolean;
  pauseable?: string;
  closeable?: string;
  recipient_modifiable?: string;
  remark?: string;
}

// 流的权限设置
export type Permission = 'sender' | 'recipient' | 'both' | 'none';

// 流的状态
export interface StreamStatus {
  paused: boolean;
  closed: boolean;
}

// 工具请求类型定义
export type ExecuteToolRequest = {
  method: "tools/call";
  params: {
    name: string;
    arguments?: Record<string, unknown>;
  };
};

// 工具列表请求类型定义
export type ListToolsRequest = {
  method: "tools/list";
  params?: Record<string, never>;
};

// MCP工具定义
export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    required: string[];
    properties: Record<string, any>;
  };
} 