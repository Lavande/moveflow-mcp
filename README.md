# MoveFlow MCP 服务器

这是一个用于通过LLM操作[MoveFlow](https://github.com/Move-Flow/moveflow-sdk-aptos)功能的MCP服务器。通过该服务器，LLM可以创建、查询和管理Aptos区块链上的MoveFlow支付流。

## 功能

- 创建支付流
- 获取支付流详情
- 获取账户所有支付流
- 取消支付流

## 安装

```bash
# 克隆仓库
git clone https://github.com/your-username/moveflow-mcp.git
cd moveflow-mcp

# 安装依赖
npm install
```

## 配置

在项目根目录创建`.env`文件：

```
# MoveFlow Aptos配置
APTOS_PRIVATE_KEY=your_private_key_here
APTOS_NETWORK=testnet  # 可选：mainnet, testnet, devnet
```

## 使用

### 构建项目

```bash
npm run build
```

### 运行服务器

```bash
npm start
```

### 开发模式

```bash
npm run dev
```

## 工具说明

服务器提供以下MCP工具：

1. `create_stream` - 创建支付流
   - 参数：
     - `recipient`: 接收方地址
     - `amount`: 支付金额
     - `token_type`: 代币类型
     - `duration`: 持续时间（秒）

2. `get_stream` - 获取支付流详情
   - 参数：
     - `stream_id`: 支付流ID

3. `get_account_streams` - 获取账户所有支付流
   - 参数：
     - `address`: 账户地址（可选）

4. `cancel_stream` - 取消支付流
   - 参数：
     - `stream_id`: 支付流ID

## 与LLM集成

可以通过MCP协议将此服务器与支持MCP的LLM客户端集成，例如：

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// 初始化客户端
const client = new Client({ name: "mcp-client", version: "1.0.0" });

// 连接到服务器
const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/mcp-server.js"]
});
await client.connect(transport);

// 获取工具列表
const toolsResult = await client.listTools();
console.log("可用工具:", toolsResult.tools.map(({ name }) => name));

// 现在可以将这些工具提供给LLM使用
```

## 许可证

ISC 