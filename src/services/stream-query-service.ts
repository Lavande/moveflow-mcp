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
      console.log(`查询地址 ${normalizedAddress} 的所有流...`);
      
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
        console.log(`API响应错误，状态码: ${userTxResponse.status}`);
        return JSON.stringify({
          success: false,
          error: `获取地址 ${normalizedAddress} 的交易失败: 服务器返回状态码 ${userTxResponse.status}`
        });
      }
      
      const transactions = await userTxResponse.json();
      
      // 确保transactions是一个数组
      if (!Array.isArray(transactions)) {
        console.log(`API返回的交易记录不是数组:`, transactions);
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
      
      console.log(`找到 ${moveflowTxns.length} 个与MoveFlow相关的交易`);
      
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
      console.log(`从交易中提取出 ${streamEvents.length} 个流相关事件`);
      
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
      for (const [_, event] of streamEventsMap.entries()) {
        try {
          // 直接使用事件数据
          const formattedStream = this.streamUtils.formatStreamData(event.data);
          streams.push(formattedStream);
        } catch (error) {
          console.error(`格式化流事件失败:`, error);
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