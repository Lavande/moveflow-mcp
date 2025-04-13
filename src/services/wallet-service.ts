import { config } from "../config";
import { normalizeTokenType, getTokenShortName, formatAmount } from "../utils/helpers";
import { BaseService } from "./base-service";

export class WalletService extends BaseService {
  // 查询钱包余额
  async getWalletBalance(address?: string, tokenType: string = "0x1::aptos_coin::AptosCoin"): Promise<string> {
    try {
      // 如果没有提供地址，使用当前账户地址
      const effectiveAddress = address || this.stream.getSenderAddress().toString();
      
      // 转换代币类型简称为完整格式
      const normalizedTokenType = normalizeTokenType(tokenType);
      
      // 获取网络API端点
      const aptosEndpoint = this.network === "mainnet" 
        ? config.MAINNET_API
        : config.TESTNET_API;
         
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
        new RegExp(`CoinStore<.*${getTokenShortName(normalizedTokenType)}.*>$`)  // 使用正则匹配部分名称
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
      const formattedBalance = formatAmount(balance, actualTokenType);
      
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
} 