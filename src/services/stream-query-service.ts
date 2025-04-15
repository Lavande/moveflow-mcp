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
      const transactions = await userTxResponse.json();
      
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
      
      // 3. 从事件中提取流ID
      const streamIds = new Set<string>();
      streamEvents.forEach(event => {
        const possibleIdFields = ['id', 'stream_id', 'streamId'];
        for (const field of possibleIdFields) {
          if (event.data?.[field]) {
            streamIds.add(event.data[field]);
            break;
          }
        }
      });
      
      // 4. 获取每个流的详情
      const streamIdsArray = Array.from(streamIds);
      console.log(`找到 ${streamIdsArray.length} 个流ID，开始获取详细信息...`);
      
      // 限制处理的流数量以避免请求过多
      const maxStreamsToProcess = config.MAX_STREAMS_TO_PROCESS || 5;
      const limitedStreamIds = streamIdsArray.slice(0, maxStreamsToProcess);
      
      // 并行获取所有流的详情
      const streams = [];
      for (const streamId of limitedStreamIds) {
        try {
          // 使用SDK方法获取流信息
          const streamInfo = await this.stream.fetchStream(streamId);
          if (streamInfo) {
            // 格式化流信息
            const formattedStream = this.streamUtils.formatStreamData(streamInfo);
            streams.push(formattedStream);
          }
          // 添加短暂延迟，避免请求过于频繁
          await delay(200);
        } catch (error) {
          console.error(`获取流 ${streamId} 详情失败:`, error);
        }
      }
      
      return JSON.stringify({
        success: true,
        streams,
        total: streamIdsArray.length,
        processed: streams.length
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
    return config.CONTRACT_ADDRESS;
  }
}