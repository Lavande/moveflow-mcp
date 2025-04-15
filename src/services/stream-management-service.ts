import { BaseService } from "./base-service";
import { StreamOperateParams } from "@moveflow/aptos-sdk";

export class StreamManagementService extends BaseService {
  // 取消支付流
  async cancelStream(streamId: string): Promise<string> {
    try {
      const result = await this.stream.closeStream(
        new StreamOperateParams({
          stream_id: streamId,
          execute: true,
          is_fa: false, // 使用标准代币，如果需要FA代币则设为true
          coin_type: "0x1::aptos_coin::AptosCoin", // 默认使用Aptos币，可根据实际情况修改
        })
      );
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
} 