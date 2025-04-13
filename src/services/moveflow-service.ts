import { StreamOptions } from "../models/types";
import { BaseService } from "./base-service";
import { StreamCreationService } from "./stream-creation-service";
import { StreamQueryService } from "./stream-query-service";
import { StreamManagementService } from "./stream-management-service";
import { WalletService } from "./wallet-service";

export class MoveFlowService extends BaseService {
  private streamCreationService: StreamCreationService;
  private streamQueryService: StreamQueryService;
  private streamManagementService: StreamManagementService;
  private walletService: WalletService;

  constructor() {
    super();
    this.streamCreationService = new StreamCreationService();
    this.streamQueryService = new StreamQueryService();
    this.streamManagementService = new StreamManagementService();
    this.walletService = new WalletService();
  }

  // 创建支付流
  async createStream(
    recipient: string,
    amount: string,
    tokenType: string,
    durationInSeconds: number,
    options?: StreamOptions
  ): Promise<string> {
    return this.streamCreationService.createStream(
      recipient,
      amount,
      tokenType,
      durationInSeconds,
      options
    );
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
    return this.streamCreationService.batchCreateStream(
      recipients,
      amounts,
      tokenType,
      durationInSeconds,
      names,
      options
    );
  }

  // 获取支付流信息
  async getStream(streamId: string): Promise<string> {
    return this.streamQueryService.getStream(streamId);
  }

  // 获取账户的所有流
  async getAccountStreams(address?: string): Promise<string> {
    return this.streamQueryService.getAccountStreams(address);
  }

  // 取消支付流
  async cancelStream(streamId: string): Promise<string> {
    return this.streamManagementService.cancelStream(streamId);
  }

  // 查询钱包余额
  async getWalletBalance(address?: string, tokenType: string = "0x1::aptos_coin::AptosCoin"): Promise<string> {
    return this.walletService.getWalletBalance(address, tokenType);
  }
} 