import { Stream, aptos } from "@moveflow/aptos-sdk";
import { Network } from "../models/types";
import { config } from "../config";

export class BaseService {
  protected stream: Stream;
  protected network: Network;
  protected account: aptos.Account;

  constructor() {
    const privateKey = config.APTOS_PRIVATE_KEY;
    const networkStr = config.APTOS_NETWORK;
    
    if (!privateKey) {
      throw new Error("APTOS_PRIVATE_KEY is not set in .env file");
    }

    this.network = networkStr;

    // 初始化账户和Stream对象
    try {
      const pair = new aptos.Ed25519PrivateKey(privateKey);
      this.account = aptos.Account.fromPrivateKey({
        privateKey: pair,
      });
      // 直接传递字符串作为网络名称
      this.stream = new Stream(this.account, networkStr as any);
    } catch (error) {
      throw new Error(`Failed to initialize MoveFlow: ${error}`);
    }
  }
} 