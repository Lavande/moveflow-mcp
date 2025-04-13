import { StreamDirection } from "@moveflow/aptos-sdk";
import { normalizeAddress, delay } from "../utils/helpers";
import { BaseService } from "./base-service";
import { StreamUtils } from "./stream-utils";

export class StreamQueryService extends BaseService {
  private streamUtils: StreamUtils;

  constructor() {
    super();
    this.streamUtils = new StreamUtils();
  }

  // 获取支付流信息
  async getStream(streamId: string): Promise<string> {
    try {
      // 获取流信息
      const streamInfo = await this.stream.fetchStream(streamId);
      
      if (!streamInfo) {
        return JSON.stringify({
          success: false,
          error: `Stream not found with ID: ${streamId}`
        });
      }
      
      // 格式化流信息
      const formattedStream = this.streamUtils.formatStreamData(streamInfo);
      
      return JSON.stringify({
        success: true,
        stream: formattedStream
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `获取流信息失败: ${error}`
      });
    }
  }

  // 获取账户的所有流
  async getAccountStreams(address?: string): Promise<string> {
    try {
      // 获取有效地址
      const effectiveAddress = address ? normalizeAddress(address) : this.stream.getSenderAddress().toString();
      
      // 用于捕获可能的错误，但允许流程继续
      let error = null;
      
      // 获取账户发送和接收的流
      let outgoingStreams: any[] = [];
      let incomingStreams: any[] = [];
      
      try {
        // 获取发送流 - 使用类型断言绕过类型检查
        const outgoing = await (this.stream as any).fetchAccountStreams(StreamDirection.Outgoing);
        outgoingStreams = outgoing || [];
        
        // 如果查询的不是当前账户，需要过滤
        if (address && normalizeAddress(this.stream.getSenderAddress().toString()) !== effectiveAddress) {
          outgoingStreams = outgoingStreams.filter((stream: any) => {
            try {
              const recipient = stream?.recipient?.toString?.() || '';
              return normalizeAddress(recipient) === effectiveAddress;
            } catch (e) {
              return false;
            }
          });
        }
      } catch (err) {
        console.error("获取发送流失败:", err);
        error = err;
      }
      
      try {
        // 等待一秒再发出下一个请求，避免速率限制
        await delay(1000);
        
        // 获取接收流 - 使用类型断言绕过类型检查
        if (!address || normalizeAddress(this.stream.getSenderAddress().toString()) === effectiveAddress) {
          // 直接查询当前账户的接收流
          const incoming = await (this.stream as any).fetchAccountStreams(StreamDirection.Incoming);
          incomingStreams = incoming || [];
        } else {
          // 需要使用其他方法获取指定地址的接收流
          // 这里可能需要API支持或额外的查询逻辑
        }
      } catch (err) {
        console.error("获取接收流失败:", err);
        error = error || err;
      }
      
      // 合并所有流
      const allStreams = [...outgoingStreams, ...incomingStreams];
      
      // 如果没有获取到任何流，尝试备用方法
      if (allStreams.length === 0) {
        try {
          console.log("主要方法没有返回流，尝试备用方法...");
          const fallbackStreams = await this.streamUtils.getFallbackStreams(address);
          
          if (fallbackStreams.length > 0) {
            // 格式化备用流信息
            const formattedFallbackStreams = fallbackStreams.map(stream => {
              try {
                return this.streamUtils.formatStreamData(stream);
              } catch (formatErr) {
                return { error: `格式化流失败: ${formatErr}`, raw_data: stream };
              }
            });
            
            return JSON.stringify({
              success: true,
              streams: formattedFallbackStreams,
              total_count: formattedFallbackStreams.length,
              查询地址: effectiveAddress || "当前账户",
              查询方式: "使用备用API方法获取流信息",
              说明: `通过备用方法获取了与地址 ${effectiveAddress || "当前账户"} 相关的流信息。`,
              提示: "由于主要API不可用，使用了备用方法获取数据，可能不包含所有最新信息。"
            });
          }
        } catch (fallbackError) {
          console.error("备用方法也失败:", fallbackError);
          // 继续使用原来的错误信息
        }
        
        return JSON.stringify({
          success: false,
          error: `获取账户流失败: ${error}`,
          说明: "API查询失败，可能是由于Indexer服务暂时不可用。请稍后再试。",
          建议: "如果问题持续存在，可以尝试减少查询的数据量或直接访问节点API。"
        });
      }
      
      // 格式化流信息
      const formattedStreams = allStreams.map((stream: any) => {
        try {
          const streamData = stream.decoded_value || stream;
          return this.streamUtils.formatStreamData(streamData);
        } catch (formatError) {
          return { error: `格式化流时出错: ${formatError}`, raw: stream };
        }
      });
      
      // 返回格式化后的结果
      return JSON.stringify({
        success: true,
        streams: formattedStreams,
        total_count: formattedStreams.length,
        incoming_count: incomingStreams.length,
        outgoing_count: outgoingStreams.length,
        查询地址: effectiveAddress || "当前账户",
        查询方式: !address || normalizeAddress(this.stream.getSenderAddress().toString()) === effectiveAddress
          ? "直接查询当前账户的发送和接收流"
          : "查询并过滤特定地址的相关流",
        说明: `已显示与地址 ${effectiveAddress || "当前账户"} 相关的流信息，包括${incomingStreams.length}条接收流和${outgoingStreams.length}条发送流。`,
        提示: error ? "部分查询可能失败，结果可能不完整。" : undefined,
      });
    } catch (error) {
      console.error("getAccountStreams发生严重错误:", error);
      return JSON.stringify({
        success: false,
        error: `获取账户流失败: ${error}`,
        建议: "API查询失败，请检查网络连接或Aptos测试网状态。"
      });
    }
  }
} 