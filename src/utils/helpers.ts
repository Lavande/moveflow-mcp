import { OperateUser } from "@moveflow/aptos-sdk";
import { config } from "../config";

/**
 * 解析服务返回的JSON字符串为对象
 */
export const parseServiceResult = (resultStr: string) => {
  try {
    return JSON.parse(resultStr);
  } catch (error) {
    return { 
      success: false, 
      error: `解析结果失败: ${error}`, 
      raw: resultStr 
    };
  }
};

/**
 * 转换权限设置为SDK需要的枚举值
 */
export const convertPermission = (permission?: string): OperateUser => {
  switch(permission) {
    case 'sender': return OperateUser.Sender;
    case 'recipient': return OperateUser.Recipient;
    case 'both': return OperateUser.Both;
    case 'none': return OperateUser.Sender; // 使用Sender替代None，因为SDK可能没有None选项
    default: return OperateUser.Sender; // 默认使用发送方
  }
};

/**
 * 将代币简称转换为完整格式
 */
export const normalizeTokenType = (tokenType: string): string => {
  if (!tokenType || tokenType.trim() === "") {
    return config.COINS.APT;
  }
  
  // 已经是完整格式
  if (tokenType.includes("::")) {
    return tokenType;
  }
  
  // 查找常见代币简称
  const upperToken = tokenType.toUpperCase();
  return (config.COINS as Record<string, string>)[upperToken] || tokenType;
};

/**
 * 从完整代币类型提取短名称
 */
export const getTokenShortName = (tokenType: string): string => {
  const parts = tokenType.split("::");
  return parts[parts.length - 1] || tokenType;
};

/**
 * 格式化金额
 */
export const formatAmount = (amount: string, tokenType: string): string => {
  const numAmount = Number(amount);
  if (isNaN(numAmount)) return amount;
  
  // 对于Aptos币，通常有8位小数
  if (tokenType === config.COINS.APT) {
    return (numAmount / 100000000).toFixed(8) + ' APT';
  }
  
  return numAmount.toLocaleString();
};

/**
 * 创建延迟Promise
 */
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 标准化地址格式
 */
export const normalizeAddress = (addr: string): string => {
  if (!addr) return '';
  addr = addr.trim().toLowerCase();
  if (!addr.startsWith('0x')) addr = '0x' + addr;
  return addr;
};

/**
 * 安全获取对象路径值
 */
export const safeGet = (obj: any, path: string, defaultValue: any = '未知') => {
  try {
    return path.split('.').reduce((o, p) => o?.[p], obj) ?? defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

/**
 * 获取当前时间（秒）
 */
export const getCurrentTimeInSeconds = (): number => {
  return Math.floor(Date.now() / 1000);
};

/**
 * 带超时控制的fetch请求
 */
export const fetchWithTimeout = async (url: string, options = {}, timeout = config.TIMEOUT.FETCH_REQUEST) => {
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