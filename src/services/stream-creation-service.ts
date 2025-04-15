import { CreateStreamParams, StreamType, BatchCreateParams, aptos } from "@moveflow/aptos-sdk";
import { StreamOptions } from "../models/types";
import { config } from "../config";
import { convertPermission, getCurrentTimeInSeconds } from "../utils/helpers";
import { BaseService } from "./base-service";

export class StreamCreationService extends BaseService {
  // 创建支付流
  async createStream(
    recipient: string,
    amount: string,
    tokenType: string,
    durationInSeconds: number,
    options?: StreamOptions
  ): Promise<string> {
    try {
      // 获取当前时间（秒）
      const now = getCurrentTimeInSeconds();
      
      // 使用用户提供的参数或默认值
      const interval = options?.interval || config.DEFAULT_INTERVAL;
      const startDelay = options?.start_delay || config.DEFAULT_START_DELAY;
      const cliffTimeEnabled = options?.cliff_time_enabled !== false; // 默认启用悬崖时间
      
      // 转换权限设置为SDK需要的枚举值
      const pauseable = convertPermission(options?.pauseable);
      const closeable = convertPermission(options?.closeable);
      const recipientModifiable = convertPermission(options?.recipient_modifiable);
      
      // 备注信息
      const remark = options?.remark || config.DEFAULT_REMARK;

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
    options?: StreamOptions
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
      const now = getCurrentTimeInSeconds();
      
      // 使用用户提供的参数或默认值
      const interval = options?.interval || config.DEFAULT_INTERVAL;
      const startDelay = options?.start_delay || config.DEFAULT_START_DELAY;
      const cliffTimeEnabled = options?.cliff_time_enabled !== false; // 默认启用悬崖时间
      
      // 转换权限设置为SDK需要的枚举值
      const pauseable = convertPermission(options?.pauseable);
      const closeable = convertPermission(options?.closeable);
      const recipientModifiable = convertPermission(options?.recipient_modifiable);
      
      // 备注信息
      const remark = options?.remark || config.DEFAULT_REMARK;
      
      // 准备批量创建参数
      const recipientAddresses = recipients.map(addr => aptos.AccountAddress.from(addr));
      const depositAmounts = amounts.map(amount => {
        const floatAmount = parseFloat(amount);
        if (isNaN(floatAmount)) {
          throw new Error(`无效的金额: ${amount}`);
        }
        // 确保返回的是数值类型
        return Math.floor(floatAmount * 100000000); // 8位小数
      });
      const cliffAmounts = new Array(recipients.length).fill(0); // 无悬崖释放金额
      
      // 生成默认的流名称列表，如果没有提供
      const streamNames = names || recipients.map((_, index) => `MCP创建的支付流${index+1}`);
      
      // 设置时间点
      const cliffTime = cliffTimeEnabled ? now + startDelay : 0;
      const startTime = now + startDelay;
      const stopTime = now + startDelay + durationInSeconds;
      
      // 创建数组形式的参数
      const cliffTimes = new Array(recipients.length).fill(cliffTime);
      const startTimes = new Array(recipients.length).fill(startTime);
      const stopTimes = new Array(recipients.length).fill(stopTime);
      
      // 统一的权限和时间间隔设置
      const pauseables = new Array(recipients.length).fill(pauseable);
      const closeables = new Array(recipients.length).fill(closeable);
      const recipientModifiables = new Array(recipients.length).fill(recipientModifiable);
      const intervals = new Array(recipients.length).fill(interval);
      
      // 创建批量参数 - 使用BatchCreateParams构造器
      const batchParams = new BatchCreateParams({
        execute: true,
        names: streamNames,
        recipients: recipientAddresses,
        deposit_amounts: depositAmounts,
        cliff_amounts: cliffAmounts,
        cliff_time: cliffTime,
        start_time: startTime,
        stop_time: stopTime,
        interval: interval,
        pauseable: pauseable,
        closeable: closeable,
        recipient_modifiable: recipientModifiable,
        is_fa: false,
        auto_withdraw: false,
        auto_withdraw_interval: 2592000,
        _remark: remark,
        stream_type: StreamType.TypeStream,
        coin_type: tokenType === "APT" ? "0x1::aptos_coin::AptosCoin" : tokenType,
      });
      
      // 调用SDK批量创建流 - 使用正确的方法名
      const result = await this.stream.batchCreateSteam(batchParams);
      
      return JSON.stringify({
        success: true,
        result,
        recipients: recipients,
        amounts: amounts,
        streams_created: recipients.length,
        time_settings: {
          start_time: new Date((now + startDelay) * 1000).toISOString(),
          end_time: new Date((now + startDelay + durationInSeconds) * 1000).toISOString(),
          duration_seconds: durationInSeconds,
          interval_seconds: interval
        }
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `批量创建流失败: ${error}`,
      });
    }
  }
} 