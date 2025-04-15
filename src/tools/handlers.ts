import { MoveFlowService } from "../services/moveflow-service";
import { parseServiceResult } from "../utils/helpers";
import { config } from "../config";

/**
 * 执行工具的处理程序
 */
export class ToolHandlers {
  private moveflowService: MoveFlowService;

  constructor() {
    this.moveflowService = new MoveFlowService();
  }

  /**
   * 批量创建支付流
   */
  async handleBatchCreateStream(args: any): Promise<any> {
    const batchCreateResult = await this.moveflowService.batchCreateStream(
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
  }

  /**
   * 获取支付流信息
   */
  async handleGetStream(args: any): Promise<any> {
    try {
      // 设置操作超时
      const streamPromise = this.moveflowService.getStream(args.stream_id as string);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("获取流信息请求超时")), config.TIMEOUT.STREAM_INFO)
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
  }

  /**
   * 获取账户的所有支付流
   */
  async handleGetAccountStreams(args: any): Promise<any> {
    try {
      // 使用Promise.race处理可能的超时
      const streamsPromise = this.moveflowService.getAccountStreams(args.address as string);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`获取账户流请求超时(${config.TIMEOUT.ACCOUNT_STREAMS / 1000}秒)`)), 
          config.TIMEOUT.ACCOUNT_STREAMS)
      );
      
      // 只保留必要的Promise.race处理超时
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
  }

  /**
   * 取消支付流
   */
  async handleCancelStream(args: any): Promise<any> {
    const cancelResult = await this.moveflowService.cancelStream(args.stream_id as string);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(parseServiceResult(cancelResult))
        }
      ]
    };
  }

  /**
   * 查询钱包余额
   */
  async handleGetWalletBalance(args: any): Promise<any> {
    const balanceResult = await this.moveflowService.getWalletBalance(
      args.address as string, 
      args.token_type as string
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(parseServiceResult(balanceResult))
        }
      ]
    };
  }

  /**
   * 处理工具调用请求
   */
  async handleToolCall(name: string, args: Record<string, unknown> = {}): Promise<any> {
    switch (name) {
      case "batch_create_stream":
        return this.handleBatchCreateStream(args);
      
      case "get_stream_info":
        return this.handleGetStream(args);
      
      case "get_account_streams":
        return this.handleGetAccountStreams(args);
      
      case "cancel_stream":
        return this.handleCancelStream(args);
      
      case "get_wallet_balance":
        return this.handleGetWalletBalance(args);
      
      default:
        throw new Error(`工具不存在: ${name}`);
    }
  }
} 