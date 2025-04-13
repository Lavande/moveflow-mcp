# MoveFlow MCP 服务器

MoveFlow MCP (Model Context Protocol) 服务器是一个基于TypeScript开发的应用程序，它提供了与MoveFlow服务交互的API接口，使AI助手能够直接创建和管理Aptos区块链上的支付流。

## 目录结构

### 根目录
- `src/` - 源代码目录
- `dist/` - 编译后的JavaScript代码
- `package.json` - 项目配置和依赖管理
- `tsconfig.json` - TypeScript编译配置

### 源代码目录 (src)

#### 主要入口文件
- `index.ts` - 应用程序主入口文件，负责启动MCP服务器

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

## 功能概述

该MCP服务器提供了以下核心功能：

1. **创建支付流** - 创建单个支付流，指定接收方、金额和时间参数
2. **批量创建支付流** - 一次操作创建多个支付流
3. **查询支付流** - 获取单个支付流的详细信息
4. **查询账户流** - 获取某个账户的所有发送和接收的支付流
5. **取消支付流** - 终止一个正在进行的支付流
6. **查询钱包余额** - 获取账户余额信息

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
            ]
        }
    }
}
```

## 许可证

ISC 