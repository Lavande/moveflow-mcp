import { Stream, aptos, StreamDirection, CreateStreamParams, StreamType, OperateUser, BatchCreateParams } from "@moveflow/aptos-sdk";
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
    durationInSeconds: number,
    options?: {
      interval?: number,
      start_delay?: number,
      cliff_time_enabled?: boolean,
      pauseable?: string,
      closeable?: string,
      recipient_modifiable?: string,
      remark?: string
    }
  ): Promise<string> {
    try {
      // 获取当前时间（秒）
      const now = Math.floor(Date.now() / 1000);
      
      // 使用用户提供的参数或默认值
      const interval = options?.interval || 86400; // 默认每天释放一次
      const startDelay = options?.start_delay || 300; // 默认5分钟后开始
      const cliffTimeEnabled = options?.cliff_time_enabled !== false; // 默认启用悬崖时间
      
      // 转换权限设置为SDK需要的枚举值
      const convertPermission = (permission?: string): OperateUser => {
        switch(permission) {
          case 'sender': return OperateUser.Sender;
          case 'recipient': return OperateUser.Recipient;
          case 'both': return OperateUser.Both;
          case 'none': return OperateUser.Sender; // 使用Sender替代None，因为SDK可能没有None选项
          default: return OperateUser.Sender; // 默认使用发送方
        }
      };
      
      const pauseable = convertPermission(options?.pauseable);
      const closeable = convertPermission(options?.closeable);
      const recipientModifiable = convertPermission(options?.recipient_modifiable);
      
      // 备注信息
      const remark = options?.remark || "remarks";

      // 计算存款总额（将APT转换为基本单位）
      const depositAmount = Math.floor(parseFloat(amount) * 100000000); // 8位小数

      // 设置时间点
      const cliffTime = cliffTimeEnabled ? now + startDelay : 0;
      const startTime = now + startDelay;
      const stopTime = startTime + durationInSeconds;

      // 创建正确的参数对象
      const streamParams = new CreateStreamParams({
        execute: true,
        coin_type: tokenType === "APT" ? "0x1::aptos_coin::AptosCoin" : tokenType,
        _remark: remark,
        name: "MCP创建的支付流",
        is_fa: false, // 假设使用标准代币
        stream_type: StreamType.TypeStream,
        recipient: aptos.AccountAddress.from(recipient),
        deposit_amount: depositAmount,
        cliff_amount: 0, // 无悬崖释放
        cliff_time: cliffTime,
        start_time: startTime,
        stop_time: stopTime,
        interval,
        auto_withdraw: false,
        auto_withdraw_interval: 2592000, // 自动提取间隔，设为一个月
        pauseable,
        closeable,
        recipient_modifiable: recipientModifiable,
      });

      // 调用SDK创建流
      const result = await this.stream.createStream(streamParams);
      
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

  // 批量创建支付流
  async batchCreateStream(
    recipients: string[],
    amounts: string[],
    tokenType: string,
    durationInSeconds: number,
    names?: string[],
    options?: {
      interval?: number,
      start_delay?: number,
      cliff_time_enabled?: boolean,
      pauseable?: string,
      closeable?: string,
      recipient_modifiable?: string,
      remark?: string
    }
  ): Promise<string> {
    try {
      // 参数验证
      if (recipients.length === 0) {
        return JSON.stringify({
          success: false,
          error: "接收方地址列表不能为空"
        });
      }
      
      if (recipients.length !== amounts.length) {
        return JSON.stringify({
          success: false,
          error: "接收方地址数量与金额数量不匹配"
        });
      }
      
      // 获取当前时间（秒）
      const now = Math.floor(Date.now() / 1000);
      
      // 使用用户提供的参数或默认值
      const interval = options?.interval || 86400; // 默认每天释放一次
      const startDelay = options?.start_delay || 300; // 默认5分钟后开始
      const cliffTimeEnabled = options?.cliff_time_enabled !== false; // 默认启用悬崖时间
      
      // 转换权限设置为SDK需要的枚举值
      const convertPermission = (permission?: string): OperateUser => {
        switch(permission) {
          case 'sender': return OperateUser.Sender;
          case 'recipient': return OperateUser.Recipient;
          case 'both': return OperateUser.Both;
          case 'none': return OperateUser.Sender; // 使用Sender替代None，因为SDK可能没有None选项
          default: return OperateUser.Sender; // 默认使用发送方
        }
      };
      
      const pauseable = convertPermission(options?.pauseable);
      const closeable = convertPermission(options?.closeable);
      const recipientModifiable = convertPermission(options?.recipient_modifiable);
      
      // 备注信息
      const remark = options?.remark || "remarks";
      
      // 准备批量创建参数
      const recipientAddresses = recipients.map(addr => aptos.AccountAddress.from(addr));
      const depositAmounts = amounts.map(amount => Math.floor(parseFloat(amount) * 100000000)); // 8位小数
      const cliffAmounts = new Array(recipients.length).fill(0); // 无悬崖释放金额
      
      // 生成默认的流名称列表，如果没有提供
      const streamNames = names || recipients.map((_, index) => `MCP创建的支付流${index+1}`);
      
      // 设置时间点
      const cliffTime = cliffTimeEnabled ? now + startDelay : 0;
      const startTime = now + startDelay;
      const stopTime = startTime + durationInSeconds;
      
      // 创建批量参数对象
      const batchParams = new BatchCreateParams({
        execute: true,
        is_fa: false,
        coin_type: tokenType === "APT" ? "0x1::aptos_coin::AptosCoin" : tokenType,
        _remark: remark,
        names: streamNames,
        stream_type: StreamType.TypeStream,
        recipients: recipientAddresses,
        deposit_amounts: depositAmounts,
        cliff_amounts: cliffAmounts,
        cliff_time: cliffTime,
        start_time: startTime,
        stop_time: stopTime,
        interval,
        auto_withdraw: false,
        auto_withdraw_interval: 2592000, // 设置为一个月的秒数
        pauseable,
        closeable,
        recipient_modifiable: recipientModifiable,
      });
      
      // 调用SDK创建批量流
      const result = await this.stream.batchCreateSteam(batchParams);
      
      return JSON.stringify({
        success: true,
        result,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `创建批量支付流失败: ${error}`,
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
      
      // 准备重试逻辑的参数
      const maxRetries = 3;
      const retryDelay = 1000; // ms
      let retryCount = 0;
      let incomingStreams: any[] = [];
      let outgoingStreams: any[] = [];
      let error = null;
      
      // 辅助函数：延迟指定毫秒
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      
      // 辅助函数：带重试的查询流
      const fetchStreamsWithRetry = async (direction: StreamDirection, pagesArg: any): Promise<any> => {
        let currentRetry = 0;
        while (currentRetry < maxRetries) {
          try {
            // 添加超时控制
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('API请求超时')), 15000)
            );
            const fetchPromise = this.stream.getStreams(direction, pagesArg);
            
            // 使用Promise.race竞争，谁先完成用谁的结果
            const result = await Promise.race([fetchPromise, timeoutPromise]);
            
            // 解析结果
            return typeof result === 'string' ? JSON.parse(result) : result;
          } catch (err) {
            console.error(`尝试 ${currentRetry + 1}/${maxRetries} 失败:`, err);
            currentRetry++;
            if (currentRetry >= maxRetries) throw err;
            await delay(retryDelay * currentRetry); // 指数退避
          }
        }
      };
      
      // 尝试使用SDK的查询方法
      try {
        // 减小每次查询的数据量，更容易成功
        const pages = { limit: 5, offset: 0 }; 
        
        // 设置进度状态
        let totalProgress = 0;
        let progressMessage = '';
        
        if (!effectiveAddress || normalizeAddress(this.stream.getSenderAddress().toString()) === effectiveAddress) {
          // 尝试获取当前用户作为接收方的流
          try {
            progressMessage = '正在获取接收流...';
            console.log(progressMessage);
            
            const incomingData = await fetchStreamsWithRetry(StreamDirection.Incoming, pages);
            totalProgress = 50;
            
            if (incomingData.success && Array.isArray(incomingData.streams)) {
              incomingStreams = incomingData.streams;
            }
          } catch (err) {
            console.warn("获取接收流失败，将继续尝试获取发送流:", err);
          }
          
          // 尝试获取当前用户作为发送方的流
          try {
            progressMessage = '正在获取发送流...';
            console.log(progressMessage);
            
            const outgoingData = await fetchStreamsWithRetry(StreamDirection.Outgoing, pages);
            totalProgress = 100;
            
            if (outgoingData.success && Array.isArray(outgoingData.streams)) {
              outgoingStreams = outgoingData.streams;
            }
          } catch (err) {
            console.warn("获取发送流失败:", err);
          }
        } else {
          // 如果是查询其他用户的流，减少请求量并分批处理
          try {
            progressMessage = '正在查询相关流数据...';
            console.log(progressMessage);
            
            // 批量查询，每批次查询更少的数据
            const batchSize = 25;
            const batches = 2; // 只获取前2批，总共最多50条记录
            
            for (let i = 0; i < batches; i++) {
              try {
                const batchPages = { 
                  limit: batchSize, 
                  offset: i * batchSize 
                };
                
                progressMessage = `正在获取第${i+1}/${batches}批流数据...`;
                console.log(progressMessage);
                
                const batchData = await fetchStreamsWithRetry(StreamDirection.Both, batchPages);
                totalProgress = (i + 1) * 50;
                
                if (batchData.success && Array.isArray(batchData.streams)) {
                  // 过滤与目标地址相关的流
                  const filteredBatchStreams = batchData.streams.filter((stream: any) => {
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
                      return false;
                    }
                  });
                  
                  // 分类并添加到对应的数组
                  for (const stream of filteredBatchStreams) {
                    const streamData = stream.decoded_value || stream;
                    const sender = normalizeAddress(streamData.sender || '');
                    
                    if (sender === effectiveAddress) {
                      outgoingStreams.push(stream);
                    } else {
                      incomingStreams.push(stream);
                    }
                  }
                  
                  // 如果找到了足够多的相关流，就提前结束
                  if (filteredBatchStreams.length === 0) {
                    console.log("当前批次没有找到相关流，提前结束批量查询");
                    break;
                  }
                }
              } catch (batchError) {
                console.warn(`获取第${i+1}批数据失败:`, batchError);
                // 继续下一批
              }
            }
          } catch (err) {
            console.warn("批量获取流失败:", err);
            error = err;
          }
        }
      } catch (indexerError) {
        console.error("通过Indexer API获取流失败:", indexerError);
        error = indexerError;
      }
      
      // 合并结果
      const allStreams = [...incomingStreams, ...outgoingStreams];
      
      // 如果没有找到任何流并且有错误，尝试使用替代方法
      if (allStreams.length === 0 && error) {
        // 尝试使用直接的节点API查询（作为备用方案）
        try {
          console.log("尝试使用备用方法获取流信息...");
          const fallbackStreams = await this.getFallbackStreams(effectiveAddress);
          
          if (fallbackStreams && fallbackStreams.length > 0) {
            // 格式化流信息
            const formattedFallbackStreams = fallbackStreams.map((stream: any) => {
              try {
                return this.formatStreamData(stream);
              } catch (formatError) {
                return { error: `格式化流时出错: ${formatError}`, raw: stream };
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
        查询方式: !effectiveAddress || normalizeAddress(this.stream.getSenderAddress().toString()) === effectiveAddress
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
      
      // 转换代币类型简称为完整格式
      const normalizedTokenType = this.normalizeTokenType(tokenType);
      
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
      
      // 查找指定代币的余额 - 使用更灵活的匹配方式
      const coinResourcePatterns = [
        normalizedTokenType,                              // 完整格式
        `0x1::coin::CoinStore<${normalizedTokenType}>`,  // 完整格式包装在CoinStore中
        new RegExp(`CoinStore<.*${this.getTokenShortName(normalizedTokenType)}.*>$`)  // 使用正则匹配部分名称
      ];
      
      let coinResource = null;
      
      // 尝试多种匹配方式
      for (const pattern of coinResourcePatterns) {
        if (pattern instanceof RegExp) {
          coinResource = data.find((resource: any) => pattern.test(resource.type));
        } else {
          coinResource = data.find((resource: any) => resource.type === pattern);
        }
        
        if (coinResource) break;
      }
      
      // 如果找不到，尝试寻找任何CoinStore资源
      if (!coinResource) {
        coinResource = data.find((resource: any) => resource.type.includes('::coin::CoinStore<'));
      }
      
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
      
      // 获取实际的代币类型
      const actualTokenType = coinResource.type.includes('<') 
        ? coinResource.type.match(/<(.+)>/)?.[1] || normalizedTokenType
        : normalizedTokenType;
      
      // 格式化余额
      const formattedBalance = this.formatAmount(balance, actualTokenType);
      
      return JSON.stringify({
        success: true,
        balance: formattedBalance,
        raw_balance: balance,
        address: effectiveAddress,
        token_type: actualTokenType,
        resource_type: coinResource.type
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `查询余额失败: ${error}`,
      });
    }
  }
  
  // 将代币简称转换为完整格式
  private normalizeTokenType(tokenType: string): string {
    if (!tokenType || tokenType.trim() === "") {
      return "0x1::aptos_coin::AptosCoin";
    }
    
    // 已经是完整格式
    if (tokenType.includes("::")) {
      return tokenType;
    }
    
    // 常见代币简称转换
    const tokenMap: Record<string, string> = {
      "APT": "0x1::aptos_coin::AptosCoin",
      "USDT": "0x2::usdt::USDT", // 这是示例，根据实际情况修改
      "USDC": "0x2::usdc::USDC"  // 这是示例，根据实际情况修改
    };
    
    return tokenMap[tokenType.toUpperCase()] || tokenType;
  }
  
  // 从完整代币类型提取短名称
  private getTokenShortName(tokenType: string): string {
    // 从完整路径中提取最后一部分
    const parts = tokenType.split("::");
    return parts[parts.length - 1] || tokenType;
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

  // 备用方法：使用节点API直接获取流信息
  private async getFallbackStreams(address?: string): Promise<any[]> {
    try {
      // 获取当前网络的API端点
      const aptosEndpoint = this.network === "mainnet" 
        ? "https://fullnode.mainnet.aptoslabs.com/v1"
        : "https://fullnode.testnet.aptoslabs.com/v1";
      
      // 标准化地址
      const normalizeAddress = (addr: string): string => {
        if (!addr) return '';
        addr = addr.trim().toLowerCase();
        if (!addr.startsWith('0x')) addr = '0x' + addr;
        return addr;
      };
      
      // 获取有效地址
      const effectiveAddress = normalizeAddress(address || this.stream.getSenderAddress().toString());
      
      // 设置请求超时
      const fetchWithTimeout = async (url: string, options = {}, timeout = 10000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        
        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal
          });
          clearTimeout(id);
          return response;
        } catch (error) {
          clearTimeout(id);
          throw error;
        }
      };
      
      console.log("正在使用备用方法查询流信息...");
      
      // 尝试获取流事件，使用有超时控制的fetch
      const eventsUrl = `${aptosEndpoint}/accounts/${effectiveAddress}/events`;
      console.log(`请求账户事件: ${eventsUrl}`);
      
      const eventsResponse = await fetchWithTimeout(eventsUrl);
      const eventsData = await eventsResponse.json();
      
      // 筛选与流相关的事件
      console.log("筛选流相关事件...");
      const streamEvents = Array.isArray(eventsData) 
        ? eventsData.filter((event: any) => 
            event.type?.includes('stream') || 
            event.data?.stream_id || 
            event.data?.recipient === effectiveAddress ||
            event.data?.sender === effectiveAddress)
        : [];
      
      // 从事件中提取流ID
      const streamIds = new Set<string>();
      streamEvents.forEach((event: any) => {
        if (event.data?.stream_id) {
          streamIds.add(event.data.stream_id);
        }
      });
      
      console.log(`找到 ${streamIds.size} 个潜在的流ID`);
      
      // 限制处理的流ID数量，避免请求过多
      const maxStreamsToProcess = 5;
      const limitedStreamIds = Array.from(streamIds).slice(0, maxStreamsToProcess);
      
      if (limitedStreamIds.length < streamIds.size) {
        console.log(`为避免超时，仅处理前 ${maxStreamsToProcess} 个流`);
      }
      
      // 获取这些流的详细信息
      const streamDetails: any[] = [];
      let processedCount = 0;
      
      // 使用Promise.all并行处理多个请求，提高效率
      await Promise.all(limitedStreamIds.map(async (streamId) => {
        try {
          console.log(`处理流 ${++processedCount}/${limitedStreamIds.length}: ${streamId}`);
          
          // 使用超时控制获取流信息
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`获取流 ${streamId} 信息超时`)), 5000)
          );
          const fetchPromise = this.stream.fetchStream(streamId);
          
          const streamInfo = await Promise.race([fetchPromise, timeoutPromise]);
          
          if (streamInfo) {
            const parsedInfo = typeof streamInfo === 'string' 
              ? JSON.parse(streamInfo) 
              : streamInfo;
            streamDetails.push(parsedInfo);
          }
        } catch (err) {
          console.warn(`获取流 ${streamId} 的详细信息失败:`, err);
        }
      }));
      
      console.log(`备用方法成功获取了 ${streamDetails.length} 条流信息`);
      return streamDetails;
    } catch (error) {
      console.error("备用获取流方法失败:", error);
      return [];
    }
  }
} 