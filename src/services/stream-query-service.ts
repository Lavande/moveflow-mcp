import { StreamDirection, aptos } from "@moveflow/aptos-sdk";
import { normalizeAddress, delay } from "../utils/helpers";
import { BaseService } from "./base-service";
import { StreamUtils } from "./stream-utils";
import { config } from "../config";

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
      // 使用当前账户地址或提供的地址
      let targetAddress = address;
      
      // 如果没有提供地址，使用当前账户的地址
      if (!targetAddress && this.account) {
        targetAddress = this.account.accountAddress.toString();
      }
      
      if (!targetAddress) {
        return JSON.stringify({
          success: false,
          error: "未提供有效地址"
        });
      }
      
      const normalizedAddress = normalizeAddress(targetAddress);
      
      // 获取API URL
      const apiUrl = config.APTOS_NETWORK.toLowerCase() === "mainnet" 
        ? config.MAINNET_API 
        : config.TESTNET_API;
      
      // 合约地址
      const contractAddress = this.getContractAddress();
      
      // 1. 获取用户的交易历史
      const userTxResponse = await fetch(
        `${apiUrl}/accounts/${normalizedAddress}/transactions?limit=50`
      );
      
      if (!userTxResponse.ok) {
        return JSON.stringify({
          success: false,
          error: `获取地址 ${normalizedAddress} 的交易失败: 服务器返回状态码 ${userTxResponse.status}`
        });
      }
      
      const transactions = await userTxResponse.json();
      
      // 确保transactions是一个数组
      if (!Array.isArray(transactions)) {
        return JSON.stringify({
          success: true,
          streams: [],
          total: 0,
          message: `地址 ${normalizedAddress} 可能不存在或没有交易记录`
        });
      }
      
      // 找出与MoveFlow合约相关的交易
      const moveflowTxns = transactions.filter((tx: any) => {
        return tx.payload?.function?.includes(contractAddress) || 
               tx.payload?.function?.includes('stream') ||
               (tx.events && tx.events.some((event: any) => 
                 event.type.includes(contractAddress) || event.type.includes('stream')));
      });
      
      // 2. 从这些交易中提取事件
      let streamEvents: any[] = [];
      for (const tx of moveflowTxns) {
        if (tx.events && Array.isArray(tx.events)) {
          const events = tx.events.filter((event: any) => 
            event.type.includes('stream') || 
            event.type.includes('Stream'));
          
          streamEvents = [...streamEvents, ...events];
        }
      }
      
      // 3. 从事件中获取有关流的完整信息
      
      // 使用Map去重，以流ID为键
      const streamEventsMap = new Map<string, any>();
      
      streamEvents.forEach(event => {
        if (!event.data) return;
        
        // 尝试多种可能的ID字段名
        const possibleIdFields = ['id', 'stream_id', 'streamId'];
        for (const field of possibleIdFields) {
          if (event.data[field]) {
            const streamId = event.data[field];
            
            // 如果这个流ID已经存在，且现有事件更详细，则跳过
            if (streamEventsMap.has(streamId)) {
              const existingEvent = streamEventsMap.get(streamId);
              // 通常更新事件比创建事件包含更多信息
              if (Object.keys(existingEvent.data).length > Object.keys(event.data).length) {
                continue;
              }
            }
            
            // 保存事件数据
            streamEventsMap.set(streamId, event);
            break;
          }
        }
      });
      
      // 将事件转换为流信息
      const streams = [];
      for (const [streamId, event] of streamEventsMap.entries()) {
        try {
          // 事件数据通常并不完整，可能缺少判断状态所需的关键信息
          // 我们基于事件类型进行简单的状态推断
          
          const eventData = event.data || {};
          const eventType = event.type || "";
          
          // 尝试从事件类型判断状态
          if (eventType.includes("CloseStreamEvent") || eventType.includes("close_stream")) {
            eventData.closed = true;
          } else if (eventType.includes("PauseStreamEvent") || eventType.includes("pause_stream")) {
            eventData.paused = true;
          } else if (eventType.includes("ResumeStreamEvent") || eventType.includes("resume_stream")) {
            eventData.paused = false;
          }
          
          // 确保事件数据包含ID字段
          if (!eventData.id && streamId) {
            eventData.id = streamId;
          }
          
          // 查找更多时间相关信息
          if (eventType.includes("CreateStreamEvent") || eventType.includes("create_stream")) {
            // 创建事件通常包含开始和结束时间
            // 已有的数据中这些字段保留
          }
          
          // 直接使用事件数据，现在formatStreamData可以判断是否有足够信息决定状态
          const formattedStream = this.streamUtils.formatStreamData(eventData, true); // 添加标志表明这是从事件获取的数据
          streams.push(formattedStream);
        } catch (error) {
          // 错误处理但不输出日志
        }
      }
      
      return JSON.stringify({
        success: true,
        streams,
        total: streams.length
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `获取账户流失败: ${error}`
      });
    }
  }
  
  // 获取合约地址
  private getContractAddress(): string {
    // 根据当前网络环境返回对应的合约地址
    return config.APTOS_NETWORK.toLowerCase() === "mainnet"
      ? config.NETWORK_CONTRACTS.MAINNET
      : config.NETWORK_CONTRACTS.TESTNET;
  }
}