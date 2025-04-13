import { BaseService } from "./base-service";

export class StreamManagementService extends BaseService {
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
} 