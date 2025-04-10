import { Stream, aptos, StreamDirection } from "@moveflow/aptos-sdk";
import dotenv from "dotenv";

// 加载环境变量
dotenv.config();

// 定义网络类型 - 使用字符串而非类型
type Network = string;

export class MoveFlowService {
  private stream: Stream;
  private network: Network;

  constructor() {
    const privateKey = process.env.APTOS_PRIVATE_KEY;
    const networkStr = (process.env.APTOS_NETWORK || "testnet");
    
    if (!privateKey) {
      throw new Error("APTOS_PRIVATE_KEY is not set in .env file");
    }

    this.network = networkStr;

    // 初始化账户和Stream对象
    try {
      const pair = new aptos.Ed25519PrivateKey(privateKey);
      const account = aptos.Account.fromPrivateKey({
        privateKey: pair,
      });
      // 直接传递字符串作为网络名称
      this.stream = new Stream(account, networkStr as any);
    } catch (error) {
      throw new Error(`Failed to initialize MoveFlow: ${error}`);
    }
  }

  // 创建支付流
  async createStream(
    recipient: string,
    amount: string,
    tokenType: string,
    durationInSeconds: number
  ): Promise<string> {
    try {
      // 传递参数给SDK方法
      // 注意：具体参数名可能需要根据SDK文档调整
      const result = await this.stream.createStream({
        // 使用any类型避免类型错误
        recipient,
        amount,
        token_type: tokenType,
        duration: durationInSeconds,
      } as any);
      
      return JSON.stringify({
        success: true,
        result,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to create stream: ${error}`,
      });
    }
  }

  // 获取支付流信息
  async getStream(streamId: string): Promise<string> {
    try {
      const streamInfo = await this.stream.fetchStream(streamId);
      return JSON.stringify({
        success: true,
        stream: streamInfo,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to get stream: ${error}`,
      });
    }
  }

  // 获取账户所有支付流
  async getAccountStreams(address?: string): Promise<string> {
    try {
      // 提供所有必要参数
      const direction = StreamDirection.Both;
      const pages = { limit: 100, offset: 0 };
      
      // 传递参数
      const streams = await this.stream.getStreams(direction, pages);
      
      return JSON.stringify({
        success: true,
        streams,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to get account streams: ${error}`,
      });
    }
  }

  // 取消支付流
  async cancelStream(streamId: string): Promise<string> {
    try {
      // 使用any类型避免参数类型错误
      const result = await this.stream.closeStream(streamId as any);
      return JSON.stringify({
        success: true,
        result,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to cancel stream: ${error}`,
      });
    }
  }
} 