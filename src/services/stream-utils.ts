import { config } from "../config";
import { 
  getTokenShortName, 
  safeGet,
  fetchWithTimeout,
  getCurrentTimeInSeconds
} from "../utils/helpers";
import { BaseService } from "./base-service";

export class StreamUtils extends BaseService {
  // 格式化流数据
  formatStreamData(streamData: any): any {
    try {
      // 格式化时间
      const formatDate = (timestamp: string) => {
        try {
          if (!timestamp) return '未设置';
          const date = new Date(parseInt(timestamp) * 1000);
          return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        } catch (e) {
          return timestamp || '未知';
        }
      };
      
      // 获取状态文本
      const getStatusText = (paused: boolean, closed: boolean) => {
        if (closed) return '已关闭';
        if (paused) return '已暂停';
        return '活跃中';
      };
      
      // 格式化权限
      const formatPermission = (permission: string) => {
        switch (permission) {
          case 'SENDER': return '发送方';
          case 'RECIPIENT': return '接收方';
          case 'BOTH': return '双方';
          case 'NONE': return '无人';
          default: return permission;
        }
      };
      
      // 格式化金额（转换为有小数点的表示）
      const formatAmount = (amount: string) => {
        try {
          const num = BigInt(amount);
          return (Number(num) / 100000000).toFixed(8);
        } catch (e) {
          return amount || '0';
        }
      };
      
      // 计算流进度
      const calculateProgress = () => {
        try {
          const now = getCurrentTimeInSeconds();
          const startTime = parseInt(safeGet(streamData, 'start_time', '0'));
          const stopTime = parseInt(safeGet(streamData, 'stop_time', '0'));
          
          if (now < startTime) return '0%'; // 未开始
          if (now >= stopTime) return '100%'; // 已完成
          
          // 计算进度百分比
          const totalDuration = stopTime - startTime;
          const elapsed = now - startTime;
          const percentage = Math.floor((elapsed / totalDuration) * 100);
          
          return `${percentage}%`;
        } catch (e) {
          return '计算错误';
        }
      };
      
      // 安全地获取嵌套属性
      const safeGetFromStreamData = (path: string, defaultValue: any = '未知') => {
        return safeGet(streamData, path, defaultValue);
      };
      
      // 提取基本信息
      const streamId = safeGetFromStreamData('stream_id');
      const sender = safeGetFromStreamData('sender', '未知发送方')?.toString?.() || '未知发送方';
      const recipient = safeGetFromStreamData('recipient', '未知接收方')?.toString?.() || '未知接收方';
      
      // 提取和格式化金额
      const depositAmount = formatAmount(safeGetFromStreamData('deposit_amount', '0'));
      const withdrawnAmount = formatAmount(safeGetFromStreamData('withdrawn_amount', '0'));
      
      // 计算未提取金额 = 已释放 - 已提取
      const availableAmount = formatAmount(
        (BigInt(safeGetFromStreamData('computed_amount', '0')) - BigInt(safeGetFromStreamData('withdrawn_amount', '0'))).toString()
      );
      
      // 计算剩余释放金额 = 总金额 - 已释放
      const remainingAmount = formatAmount(
        (BigInt(safeGetFromStreamData('deposit_amount', '0')) - BigInt(safeGetFromStreamData('computed_amount', '0'))).toString()
      );
      
      // 获取代币类型
      const coinType = safeGetFromStreamData('coin_type', '未知代币');
      const shortCoinType = getTokenShortName(coinType);
      
      // 获取时间信息
      const createdAt = formatDate(safeGetFromStreamData('created_at'));
      const startTime = formatDate(safeGetFromStreamData('start_time'));
      const stopTime = formatDate(safeGetFromStreamData('stop_time'));
      
      // 获取状态
      const paused = safeGetFromStreamData('paused', false);
      const closed = safeGetFromStreamData('closed', false);
      const statusText = getStatusText(paused, closed);
      
      // 获取权限设置
      const pauseable = formatPermission(safeGetFromStreamData('pauseable', 'SENDER'));
      const closeable = formatPermission(safeGetFromStreamData('closeable', 'SENDER'));
      const recipientModifiable = formatPermission(safeGetFromStreamData('recipient_modifiable', 'NONE'));
      
      // 进度计算
      const progress = calculateProgress();
      
      // 返回格式化后的数据结构
      return {
        stream_id: streamId,
        name: safeGetFromStreamData('name', `流 ${streamId}`),
        status: statusText,
        progress: progress,
        sender: sender,
        recipient: recipient,
        amounts: {
          total: `${depositAmount} ${shortCoinType}`,
          withdrawn: `${withdrawnAmount} ${shortCoinType}`,
          available: `${availableAmount} ${shortCoinType}`,
          remaining: `${remainingAmount} ${shortCoinType}`,
        },
        token: {
          type: coinType,
          name: shortCoinType
        },
        times: {
          created: createdAt,
          start: startTime,
          end: stopTime,
          interval: `${safeGetFromStreamData('interval', '0')}秒`
        },
        permissions: {
          pauseable: pauseable,
          closeable: closeable,
          recipient_modifiable: recipientModifiable
        },
        remark: safeGetFromStreamData('_remark', '')
      };
    } catch (error) {
      console.error("流数据格式化失败:", error);
      return {
        error: `流数据格式化失败: ${error}`,
        raw_data: streamData
      };
    }
  }

  // 备用方法：使用节点API直接获取流信息
  async getFallbackStreams(address?: string): Promise<any[]> {
    try {
      // 获取当前网络的API端点
      const aptosEndpoint = this.network === "mainnet" 
        ? config.MAINNET_API
        : config.TESTNET_API;
      
      // 获取有效地址
      const effectiveAddress = address || this.stream.getSenderAddress().toString();
      
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
      const maxStreamsToProcess = config.MAX_STREAMS_TO_PROCESS;
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
            setTimeout(() => reject(new Error(`获取流 ${streamId} 信息超时`)), config.TIMEOUT.FALLBACK_FETCH)
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