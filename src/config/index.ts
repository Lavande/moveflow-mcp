import dotenv from "dotenv";

// 加载环境变量
dotenv.config();

// 配置选项
export const config = {
  // Aptos私钥
  APTOS_PRIVATE_KEY: process.env.APTOS_PRIVATE_KEY,
  
  // 网络配置
  APTOS_NETWORK: process.env.APTOS_NETWORK || "testnet",
  
  // API端点
  MAINNET_API: "https://fullnode.mainnet.aptoslabs.com/v1",
  TESTNET_API: "https://fullnode.testnet.aptoslabs.com/v1",
  
  // 常量定义
  DEFAULT_INTERVAL: 86400,         // 默认每天释放一次（单位：秒）
  DEFAULT_START_DELAY: 300,        // 默认5分钟后开始（单位：秒）
  DEFAULT_CLIFF_TIME_ENABLED: true, // 默认启用悬崖时间
  DEFAULT_REMARK: "remarks",        // 默认备注
  
  // 代币配置
  COINS: {
    "APT": "0x1::aptos_coin::AptosCoin",
    "USDT": "0x2::usdt::USDT", // 示例，实际地址需要更新
    "USDC": "0x2::usdc::USDC"  // 示例，实际地址需要更新
  },
  
  // 超时设置
  TIMEOUT: {
    STREAM_INFO: 20000,           // 获取流信息超时时间（毫秒）
    ACCOUNT_STREAMS: 40000,       // 获取账户流超时时间（毫秒）
    FETCH_REQUEST: 10000,         // 普通请求超时时间（毫秒）
    FALLBACK_FETCH: 5000          // 备用方法获取流信息超时时间（毫秒）
  },
  
  // 其他设置
  MAX_STREAMS_TO_PROCESS: 5,      // 备用方法处理流的最大数量
}; 