import { Stream, aptos, StreamDirection } from "@moveflow/aptos-sdk";
import dotenv from "dotenv";

// 加载环境变量
dotenv.config();

// 定义网络类型 - 使用字符串而非类型
type Network = string;

// 定义账户资源类型
interface AccountResource {
  type: string;
  data: {
    coin: {
      value: string;
    };
  };
}

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

  // 格式化流信息的工具函数
  private formatStreamData(streamData: any): any {
    try {
      // 安全校验，确保streamData是一个对象
      if (!streamData || typeof streamData !== 'object') {
        return { error: '无效的流数据', raw: streamData };
      }

      // 将时间戳转换为可读日期格式
      const formatDate = (timestamp: string) => {
        if (!timestamp || timestamp === '0') return '未设置';
        // 尝试转换为数字并处理日期
        try {
          return new Date(Number(timestamp) * 1000).toLocaleString();
        } catch (error) {
          return `${timestamp} (格式错误)`;
        }
      };
      
      // 格式化状态
      const getStatusText = (paused: boolean, closed: boolean) => {
        if (closed) return '已关闭';
        if (paused) return '已暂停';
        return '活跃中';
      };
      
      // 格式化权限
      const formatPermission = (permission: string) => {
        switch(permission) {
          case 'sender': return '发送方';
          case 'recipient': return '接收方';
          case 'both': return '双方';
          case 'none': return '无人';
          default: return permission || '未知';
        }
      };
      
      // 格式化金额，增加可读性
      const formatAmount = (amount: string) => {
        if (!amount) return '0';
        // 根据资产类型可以进一步处理小数位数
        const numAmount = Number(amount);
        if (isNaN(numAmount)) return amount;
        
        // 对于Aptos币，通常有8位小数
        if (streamData.asset_type === '0x1::aptos_coin::AptosCoin') {
          return (numAmount / 100000000).toFixed(8) + ' APT';
        }
        
        return numAmount.toLocaleString();
      };
      
      // 计算当前进度
      const calculateProgress = () => {
        try {
          const now = Math.floor(Date.now() / 1000);
          const start = Number(streamData.start_time || 0);
          const end = Number(streamData.stop_time || 0);
          
          if (start === 0 || end === 0) return '未知';
          if (now < start) return '未开始';
          if (now > end) return '已完成';
          
          const totalDuration = end - start;
          if (totalDuration <= 0) return '未知';
          
          const elapsed = now - start;
          const percentage = Math.floor((elapsed / totalDuration) * 100);
          
          return `${percentage}%`;
        } catch (error) {
          return '计算错误';
        }
      };
      
      // 安全获取嵌套属性
      const safeGet = (obj: any, path: string, defaultValue: any = '未知') => {
        try {
          const parts = path.split('.');
          let current = obj;
          for (const part of parts) {
            if (current === null || current === undefined || typeof current !== 'object') {
              return defaultValue;
            }
            current = current[part];
          }
          return current === undefined || current === null ? defaultValue : current;
        } catch (error) {
          return defaultValue;
        }
      };
      
      // 返回格式化后的流信息
      return {
        id: streamData.id || '未知ID',
        name: streamData.name || '未命名流',
        status: getStatusText(
          safeGet(streamData, 'pause_info.paused', false), 
          !!streamData.closed
        ),
        progress: calculateProgress(),
        sender: streamData.sender || '未知发送方',
        recipient: streamData.recipient || '未知接收方',
        asset_type: streamData.asset_type || '未知资产类型',
        是否自动提取: !!streamData.auto_withdraw ? '是' : '否',
        开始时间: formatDate(streamData.start_time),
        结束时间: formatDate(streamData.stop_time),
        创建时间: formatDate(streamData.create_at),
        上次提取时间: formatDate(streamData.last_withdraw_time),
        存入金额: formatAmount(streamData.deposit_amount),
        剩余金额: formatAmount(streamData.remaining_amount),
        已提取金额: formatAmount(streamData.withdrawn_amount),
        流类型: streamData.stream_type || '未知类型',
        权限设置: {
          可暂停方: formatPermission(safeGet(streamData, 'feature_info.pauseable')),
          可关闭方: formatPermission(safeGet(streamData, 'feature_info.closeable')),
          可修改接收方: formatPermission(safeGet(streamData, 'feature_info.recipient_modifiable'))
        }
      };
    } catch (error) {
      console.error('格式化流数据时出错:', error);
      return { 
        error: '格式化流数据时出错', 
        message: error instanceof Error ? error.message : String(error),
        rawData: streamData 
      };
    }
  }

  // 获取支付流信息
  async getStream(streamId: string): Promise<string> {
    try {
      const streamInfo = await this.stream.fetchStream(streamId);
      
      // 如果结果是字符串，解析为JSON
      let rawData;
      try {
        rawData = typeof streamInfo === 'string' 
          ? JSON.parse(streamInfo)
          : streamInfo;
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: `解析流信息失败: ${error}`,
          raw: streamInfo
        });
      }
      
      // 格式化流信息
      const formattedStream = this.formatStreamData(rawData);
      
      return JSON.stringify({
        success: true,
        stream: formattedStream,
        说明: "此格式化结果包含了流的基本信息、状态和进度。时间已转换为可读格式，金额已做适当处理。"
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `获取流信息失败: ${error}`,
      });
    }
  }

  // 获取账户所有支付流
  async getAccountStreams(address?: string): Promise<string> {
    try {
      // 标准化地址格式，确保一致性
      const normalizeAddress = (addr: string): string => {
        if (!addr) return '';
        // 去除空格并转为小写
        addr = addr.trim().toLowerCase();
        // 确保以0x开头
        if (!addr.startsWith('0x')) addr = '0x' + addr;
        return addr;
      };
      
      // 获取当前账户地址(如果未提供)
      let effectiveAddress = normalizeAddress(address || "");
      
      // 记录API调用参数，用于调试
      console.log(`调用getAccountStreams，标准化后的地址参数: ${effectiveAddress || "未指定"}`);
      
      // 直接使用针对性的查询，而不是获取所有流后再过滤
      // 如果没有提供地址，则默认获取当前账户的流
      const pages = { limit: 20, offset: 0 }; // 减小查询数量，提高效率
      
      // 为了确保我们能同时获取用户作为发送方和接收方的流，我们需要分别查询
      let incomingStreams = [];
      let outgoingStreams = [];
      
      if (!effectiveAddress || normalizeAddress(this.stream.getSenderAddress().toString()) === effectiveAddress) {
        // 获取当前用户作为接收方的流
        const incomingResult = await this.stream.getStreams(StreamDirection.Incoming, pages);
        
        // 解析结果
        const incomingData = typeof incomingResult === 'string' 
          ? JSON.parse(incomingResult)
          : incomingResult;
          
        if (incomingData.success && Array.isArray(incomingData.streams)) {
          incomingStreams = incomingData.streams;
        }
        
        // 获取当前用户作为发送方的流
        const outgoingResult = await this.stream.getStreams(StreamDirection.Outgoing, pages);
        
        // 解析结果
        const outgoingData = typeof outgoingResult === 'string' 
          ? JSON.parse(outgoingResult)
          : outgoingResult;
          
        if (outgoingData.success && Array.isArray(outgoingData.streams)) {
          outgoingStreams = outgoingData.streams;
        }
      } else {
        // 如果是查询其他用户的流，我们需要查询所有流并过滤
        // 但我们可以使用更高效的查询参数
        const bothResult = await this.stream.getStreams(StreamDirection.Both, { limit: 100, offset: 0 });
        
        // 解析结果
        const bothData = typeof bothResult === 'string' 
          ? JSON.parse(bothResult)
          : bothResult;
          
        if (bothData.success && Array.isArray(bothData.streams)) {
          // 过滤与目标地址相关的流
          const filteredStreams = bothData.streams.filter((stream: any) => {
            try {
              const streamData = stream.decoded_value || stream;
              
              // 标准化发送方和接收方地址
              const sender = normalizeAddress(streamData.sender || '');
              const recipient = normalizeAddress(streamData.recipient || '');
              
              // 判断地址是否匹配
              const matchesSender = sender === effectiveAddress;
              const matchesRecipient = recipient === effectiveAddress;
              
              return matchesSender || matchesRecipient;
            } catch (e) {
              console.error("过滤流时出错:", e);
              return false;
            }
          });
          
          // 分类为incoming和outgoing
          for (const stream of filteredStreams) {
            const streamData = stream.decoded_value || stream;
            const sender = normalizeAddress(streamData.sender || '');
            
            if (sender === effectiveAddress) {
              outgoingStreams.push(stream);
            } else {
              incomingStreams.push(stream);
            }
          }
        }
      }
      
      // 合并结果
      const allStreams = [...incomingStreams, ...outgoingStreams];
      
      // 检查每条数据的结构，输出前1条用于调试
      if (allStreams.length > 0) {
        console.log("数据结构示例:");
        console.log(JSON.stringify(allStreams[0], null, 2));
      }
      
      // 格式化流信息
      const formattedStreams = allStreams.map((stream: any) => {
        try {
          const streamData = stream.decoded_value || stream;
          return this.formatStreamData(streamData);
        } catch (error) {
          return { error: `格式化流时出错: ${error}`, raw: stream };
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
        查询方式: !effectiveAddress || normalizeAddress(this.stream.getSenderAddress().toString()) === effectiveAddress
          ? "直接查询当前账户的发送和接收流"
          : "查询并过滤特定地址的相关流",
        说明: `已显示与地址 ${effectiveAddress || "当前账户"} 相关的流信息，包括${incomingStreams.length}条接收流和${outgoingStreams.length}条发送流。`,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `获取账户流失败: ${error}`,
      });
    }
  }

  // 取消支付流
  async cancelStream(streamId: string): Promise<string> {
    try {
      const result = await this.stream.closeStream(streamId as any);
      return JSON.stringify({
        success: true,
        result,
        说明: "支付流已成功取消。"
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `取消流失败: ${error}`,
      });
    }
  }

  // 查询钱包余额
  async getWalletBalance(address?: string, tokenType: string = "0x1::aptos_coin::AptosCoin"): Promise<string> {
    try {
      // 如果没有提供地址，使用当前账户地址
      const effectiveAddress = address || this.stream.getSenderAddress().toString();
      
      // 使用SDK原生方法获取资源
      const aptosEndpoint = this.network === "mainnet" 
        ? "https://fullnode.mainnet.aptoslabs.com/v1"
        : "https://fullnode.testnet.aptoslabs.com/v1";
        
      // 构建fetch请求获取账户资源
      const url = `${aptosEndpoint}/accounts/${effectiveAddress}/resources`;
      const response = await fetch(url);
      const data = await response.json();
      
      // 检查是否是错误响应
      if (data && data.error_code === "account_not_found") {
        return JSON.stringify({
          success: false,
          error: `账户不存在: ${effectiveAddress}`,
          network: this.network,
          ledger_version: data.message?.match(/Ledger version\((\d+)\)/)?.[1] || "未知"
        });
      }
      
      if (!Array.isArray(data)) {
        return JSON.stringify({
          success: false,
          error: `获取资源失败: 返回数据不是数组`,
          raw_data: data
        });
      }
      
      // 查找指定代币的余额
      const coinResource = data.find((resource: any) => 
        resource.type === tokenType || 
        resource.type === "0x1::coin::CoinStore<" + tokenType + ">"
      );
      
      if (!coinResource) {
        return JSON.stringify({
          success: false,
          error: `账户存在，但未找到代币类型 ${tokenType} 的余额信息`,
          address: effectiveAddress,
          available_resources: data.map((r: any) => r.type).slice(0, 10) // 只显示前10个资源类型
        });
      }
      
      // 获取余额数据
      const balance = coinResource.data?.coin?.value || "0";
      
      // 格式化余额
      const formattedBalance = this.formatAmount(balance, tokenType);
      
      return JSON.stringify({
        success: true,
        balance: formattedBalance,
        raw_balance: balance,
        address: effectiveAddress,
        token_type: tokenType,
        resource_type: coinResource.type
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `查询余额失败: ${error}`,
      });
    }
  }

  // 格式化金额的辅助方法
  private formatAmount(amount: string, tokenType: string): string {
    const numAmount = Number(amount);
    if (isNaN(numAmount)) return amount;
    
    // 对于Aptos币，通常有8位小数
    if (tokenType === "0x1::aptos_coin::AptosCoin") {
      return (numAmount / 100000000).toFixed(8) + ' APT';
    }
    
    return numAmount.toLocaleString();
  }
} 