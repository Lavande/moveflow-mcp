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
      
      // 提取基本信息 - 检查多个可能的ID字段名
      const streamId = safeGetFromStreamData('id') !== '未知' 
        ? safeGetFromStreamData('id') 
        : (safeGetFromStreamData('stream_id') !== '未知' 
          ? safeGetFromStreamData('stream_id') 
          : (safeGetFromStreamData('streamId') !== '未知' 
            ? safeGetFromStreamData('streamId') 
            : '未知'));
            
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
}
