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
  formatStreamData(streamData: any, fromEvent: boolean = false): any {
    try {
      // 格式化时间
      const formatDate = (timestamp: string) => {
        try {
          if (!timestamp) return null;
          const date = new Date(parseInt(timestamp) * 1000);
          return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        } catch (e) {
          return null; // 时间戳无效时返回null而不是"未知"
        }
      };
      
      // 获取状态文本
      const getStatusText = (paused: boolean, closed: boolean) => {
        // 首先检查明确的状态标志 - closed优先级最高
        if (closed) return '已关闭';
        if (paused) return '已暂停';
        
        // 然后基于时间判断其他状态
        try {
          const now = getCurrentTimeInSeconds();
          const startTime = parseInt(safeGet(streamData, 'start_time', '0'));
          const stopTime = parseInt(safeGet(streamData, 'stop_time', '0'));
          
          // 确保时间戳有效
          if (startTime && stopTime) {
            if (now < startTime) return '未开始';
            if (now >= stopTime) return '已完成';
          }
          
          // 如果上述条件都不满足，则流正在进行中
          return '活跃中';
        } catch (e) {
          return '活跃中'; // 出错时默认为活跃状态
        }
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
          // 获取必要的时间信息
          const now = getCurrentTimeInSeconds();
          const startTime = parseInt(safeGet(streamData, 'start_time', '0'));
          const stopTime = parseInt(safeGet(streamData, 'stop_time', '0'));
          const closed = safeGet(streamData, 'closed', false);
          
          // 流已关闭，显示为100%
          if (closed) return '100%';
          
          // 检查时间戳是否有效
          if (!startTime || !stopTime) return null;
          
          // 流尚未开始
          if (now < startTime) return '0%';
          
          // 流已完成
          if (now >= stopTime) return '100%';
          
          // 计算流进度
          const totalDuration = stopTime - startTime;
          if (totalDuration <= 0) return '0%'; // 避免除以零
          
          const elapsed = now - startTime;
          if (elapsed < 0) return '0%'; // 时间计算出错
          
          const percentage = Math.min(100, Math.floor((elapsed / totalDuration) * 100));
          return `${percentage}%`;
        } catch (e) {
          return null; // 计算失败时不返回进度
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
      
      // 获取分析后剩余金额
      const remainingAmount = formatAmount(safeGetFromStreamData('remaining_amount', '0'));
      
      // 计算可提取金额 - 直接使用remaining_amount作为可提取金额
      // 若未找到可直接使用的remaining_amount，则进行计算
      let availableAmount;
      if (safeGetFromStreamData('remaining_amount', null) !== null) {
        availableAmount = remainingAmount;
      } else {
        // 计算未提取金额 = 已释放 - 已提取
        availableAmount = formatAmount(
          (BigInt(safeGetFromStreamData('computed_amount', '0')) - BigInt(safeGetFromStreamData('withdrawn_amount', '0'))).toString()
        );
      }
      
      // 获取代币类型 - 检查多个可能的字段名
      const coinType = safeGetFromStreamData('asset_type') !== '未知' 
        ? safeGetFromStreamData('asset_type')
        : (safeGetFromStreamData('coin_type') !== '未知'
          ? safeGetFromStreamData('coin_type')
          : '0x1::aptos_coin::AptosCoin'); // 默认为APT
          
      const shortCoinType = getTokenShortName(coinType);
      
      // 获取时间信息
      const createdAt = formatDate(safeGetFromStreamData('create_at') || safeGetFromStreamData('created_at'));
      const startTime = formatDate(safeGetFromStreamData('start_time'));
      const stopTime = formatDate(safeGetFromStreamData('stop_time'));
      const interval = safeGetFromStreamData('interval', '0');
      
      // 获取暂停状态 - 支持新旧格式
      let paused = false;
      if (typeof safeGetFromStreamData('paused') === 'boolean') {
        paused = safeGetFromStreamData('paused');
      } else if (safeGetFromStreamData('pause_info') !== '未知') {
        paused = safeGet(safeGetFromStreamData('pause_info'), 'paused', false);
      }
      
      // 获取关闭状态
      const closed = safeGetFromStreamData('closed', false);
      
      // 确定状态文本
      const statusText = getStatusText(paused, closed);
      
      // 获取权限设置 - 支持新版返回格式
      let pauseable, closeable, recipientModifiable;
      
      if (safeGetFromStreamData('feature_info') !== '未知') {
        // 新版格式
        const featureInfo = safeGetFromStreamData('feature_info', {});
        pauseable = formatPermission(safeGet(featureInfo, 'pauseable', 'SENDER').toUpperCase());
        closeable = formatPermission(safeGet(featureInfo, 'closeable', 'SENDER').toUpperCase());
        recipientModifiable = formatPermission(safeGet(featureInfo, 'recipient_modifiable', 'NONE').toUpperCase());
      } else {
        // 旧版格式
        pauseable = formatPermission(safeGetFromStreamData('pauseable', 'SENDER'));
        closeable = formatPermission(safeGetFromStreamData('closeable', 'SENDER'));
        recipientModifiable = formatPermission(safeGetFromStreamData('recipient_modifiable', 'NONE'));
      }
      
      // 进度计算
      const progress = calculateProgress();
      
      // 构建times对象，只包含有效时间字段
      const times: Record<string, string> = {};
      
      if (createdAt) times.created = createdAt;
      if (startTime) times.start = startTime;
      if (stopTime) times.end = stopTime;
      if (interval && interval !== '0') times.interval = `${interval}秒`;
      
      // 返回格式化后的数据结构
      const result: any = {
        stream_id: streamId,
        sender: sender,
        recipient: recipient,
        amounts: {
          total: `${depositAmount} ${shortCoinType}`,
          withdrawn: `${withdrawnAmount} ${shortCoinType}`,
          available: `${availableAmount} ${shortCoinType}`,
          remaining: `${remainingAmount} ${shortCoinType}`
        },
        token: {
          type: coinType,
          name: shortCoinType
        },
        times: times,
        permissions: {
          pauseable: pauseable,
          closeable: closeable,
          recipient_modifiable: recipientModifiable
        },
        remark: safeGetFromStreamData('_remark', '') || safeGetFromStreamData('name', '')
      };
      
      // 从事件获取的数据可能不完整，只有在数据足够可信时才添加状态
      if (!fromEvent || closed || paused || 
          (safeGetFromStreamData('start_time', null) && safeGetFromStreamData('stop_time', null))) {
        result.status = statusText;
      }
      
      // 只有当progress有值时才添加到结果中
      if (progress) {
        result.progress = progress;
      }
      
      return result;
    } catch (error) {
      console.error("流数据格式化失败:", error);
      return {
        error: `流数据格式化失败: ${error}`,
        raw_data: streamData
      };
    }
  }
}
