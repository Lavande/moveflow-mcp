# MoveFlow MCP 服务器

MoveFlow MCP (Model Context Protocol) 服务器是一个基于TypeScript开发的应用程序，它提供了与MoveFlow服务交互的API接口，使AI助手能够直接创建和管理Aptos区块链上的支付流。

## 核心功能

MoveFlow MCP服务器提供以下核心功能（MCP工具）：

1. **批量创建支付流 (batch_create_stream)** - 批量创建多个支付流，可以只创建一个或多个，支持APT代币和其他代币
2. **获取支付流信息 (get_stream_info)** - 获取单个支付流的详细信息
3. **获取账户流列表 (get_account_streams)** - 获取某个账户的所有发送和接收的支付流
4. **取消支付流 (cancel_stream)** - 终止一个正在进行的支付流
5. **暂停支付流 (pause_stream)** - 暂停支付流，暂停后资金不再释放，但可以恢复继续支付
6. **恢复支付流 (resume_stream)** - 恢复被暂停的支付流，使其继续释放资金
7. **查询钱包余额 (get_wallet_balance)** - 获取账户余额信息

## 使用说明

### 安装依赖
```bash
npm install
```

### 编译代码
```bash
npm run build
```

### 运行服务器
```bash
node dist/index.js
```

### 使用MCP Inspector调试
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## 集成到Claude
可通过Claude Desktop配置文件集成此MCP服务器，让Claude AI能够直接使用MoveFlow功能：

```json
{
    "mcpServers": {
        "moveflow": {
            "command": "node",
            "args": [
                "/绝对路径/到/你的项目/dist/index.js"
            ],
            "env": {
                "APTOS_PRIVATE_KEY": "你的私钥",
                "APTOS_NETWORK": "testnet"  // 可选：mainnet, testnet, devnet
            }
        }
    }
}
```

## 目录结构

### 根目录
- `src/` - 源代码目录
- `dist/` - 编译后的JavaScript代码
- `package.json` - 项目配置和依赖管理
- `tsconfig.json` - TypeScript编译配置
- `.env` - 环境变量配置文件

### 源代码目录 (src)

#### 主要入口文件
- `index.ts` - 应用程序主入口文件，负责启动MCP服务器
- `mcp-server.ts` - MCP服务器实现

#### 配置 (src/config)
- `index.ts` - 包含全局配置项，如API端点、默认值和环境变量

#### 模型定义 (src/models)
- `types.ts` - 定义类型接口和数据模型

#### 服务 (src/services)
- `base-service.ts` - 基础服务类，提供共享的Stream实例和配置
- `moveflow-service.ts` - 主MoveFlow服务类，整合所有其他服务功能
- `stream-creation-service.ts` - 处理创建单个流和批量创建流的功能
- `stream-query-service.ts` - 提供流信息查询和账户流列表获取功能 
- `stream-management-service.ts` - 处理流管理操作，如取消流
- `wallet-service.ts` - 提供钱包相关功能，如查询余额
- `stream-utils.ts` - 流工具服务，包含格式化和数据处理辅助方法

#### 工具 (src/tools)
- `definitions.ts` - 定义MCP工具的接口结构和参数验证
- `handlers.ts` - 实现MCP工具的处理逻辑

#### 工具函数 (src/utils)
- `helpers.ts` - 提供各种辅助功能，如格式化、转换和网络请求 

## 许可证

ISC 