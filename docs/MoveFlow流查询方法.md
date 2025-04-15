# MoveFlow流查询方法总结

## 1. 概述

MoveFlow是一个在Aptos区块链上的流支付协议，允许用户创建定时支付流。虽然官方提供了SDK，但在某些情况下我们可能需要直接查询链上数据。以下是不使用SDK查询MoveFlow流的多种方法。

## 2. 核心查询方法

查询流的核心思路是：先获取流ID，再根据流ID查询详细信息。

### 2.1 流ID获取方法

以下是获取与特定地址相关的流ID的方法：

#### a) 查询账户作为发送者的流事件

```typescript
async function getSenderStreams(address: string) {
  const response = await fetch(
    `${API_URL}/accounts/${CONTRACT}/events/${CONTRACT}::stream::SenderEvents/create_events`
  );
  const events = await response.json();
  
  return events.filter(event => 
    normalizeAddress(event.data?.sender) === normalizeAddress(address));
}
```

#### b) 查询账户作为接收者的流事件

```typescript
async function getReceiverStreams(address: string) {
  const response = await fetch(
    `${API_URL}/accounts/${CONTRACT}/events/${CONTRACT}::stream::RecipientEvents/receive_events`
  );
  const events = await response.json();
  
  return events.filter(event => 
    normalizeAddress(event.data?.recipient) === normalizeAddress(address));
}
```

#### c) 查询账户的交易历史

```typescript
async function getUserTransactions(address: string) {
  const response = await fetch(
    `${API_URL}/accounts/${address}/transactions?limit=50`
  );
  const transactions = await response.json();
  
  // 筛选与MoveFlow相关的交易
  const moveflowTxns = transactions.filter(tx => 
    tx.payload?.function?.includes(CONTRACT) || 
    tx.payload?.function?.includes('stream') ||
    (tx.events && tx.events.some(event => 
      event.type.includes(CONTRACT) || event.type.includes('stream'))));
    
  // 提取流事件
  let streamEvents = [];
  for (const tx of moveflowTxns) {
    if (tx.events && Array.isArray(tx.events)) {
      const events = tx.events.filter(event => 
        event.type.includes('stream') || event.type.includes('Stream'));
      streamEvents = [...streamEvents, ...events];
    }
  }
  return streamEvents;
}
```

#### d) 从事件中提取流ID

```typescript
function extractStreamIds(events: any[]): string[] {
  const streamIds = new Set<string>();
  
  events.forEach(event => {
    // 处理不同的字段名
    const possibleIdFields = ['id', 'stream_id', 'streamId'];
    for (const field of possibleIdFields) {
      if (event.data?.[field]) {
        streamIds.add(event.data[field]);
        break;
      }
    }
  });
  
  return Array.from(streamIds);
}
```

### 2.2 流详情获取方法

获取到流ID后，可以使用以下方法查询详细信息：

#### a) 使用View函数查询（可能受限）

```typescript
async function fetchStreamInfo(streamId: string) {
  const response = await fetch(`${API_URL}/view`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      function: `${CONTRACT}::stream::get_stream`,
      type_arguments: [],
      arguments: [streamId]
    })
  });
  
  return await response.json();
}
```

#### b) 直接从事件中提取流信息

如果View函数不可用，可以直接从事件数据中提取流信息：

```typescript
// 从流创建事件中提取流信息
function extractStreamInfoFromEvents(events, streamId) {
  return events.find(event => 
    event.data?.id === streamId || event.data?.stream_id === streamId)?.data;
}
```

## 3. 完整查询流程

### 3.1 流程概述

1. 获取地址相关的所有流事件（发送、接收、交易历史）
2. 提取流ID
3. 查询每个流的详细信息
4. 格式化和过滤结果

### 3.2 工具函数

```typescript
// 地址格式化
const normalizeAddress = (addr: string): string => {
  if (!addr) return '';
  addr = addr.trim().toLowerCase();
  if (!addr.startsWith('0x')) addr = '0x' + addr;
  return addr;
};

// 带超时的fetch
const fetchWithTimeout = async (url: string, options = {}, timeout = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};
```

## 4. 查询结果分析

### 4.1 事件数据结构

一个典型的流创建事件数据结构如下：

```json
{
  "asset_type": "0x1::aptos_coin::AptosCoin",
  "cliff_amount": "0",
  "current_time": "1744518713",
  "deposit_amount": "1000000",
  "event_type": 100,
  "extend_amount": "0",
  "id": "0x8c785f4d0f40a85e6d84b616f817a1182179698f6b236f61ee21742071f05a75",
  "last_withdraw_time": "1744522620",
  "recipient": "0xfcc016c535e94e38751e094377e55535d3e702dd413200b9b40763b73a655d55",
  "remaining_amount": "1000000",
  "sender": "0xa53c93f1a39dcf1bf32fe507b03058d8166c48896ee197b1ff3534a6d5a70c6",
  "withdraw_amount": "0"
}
```

### 4.2 View函数限制

我们发现MoveFlow合约不提供公开的View函数`get_stream`，调用时返回错误：
```
"message": "could not find entry function by 0x15a5484b9f8369dd3d60c43e4530e7c1bb82eef041bf4cf8a2090399bebde5d4::stream::get_stream"
```

因此，流信息需要主要从事件数据中获取。

## 5. 最佳实践与建议

1. **地址格式化**：确保地址格式一致，比较时使用正规化处理
2. **分层查询**：先查询事件获取流ID，再获取详情
3. **错误处理**：实现稳健的错误处理和超时机制
4. **批量处理**：对大量流ID，分批查询以避免请求超时
5. **备用方案**：如View函数不可用，从事件数据中直接提取信息

## 6. 限制与注意事项

1. 链上查询受到节点RPC限制，可能需要分页处理
2. 某些详细信息可能只能通过SDK获取
3. 事件可能不包含流的完整状态，如已提取金额等
4. 对于大规模应用，考虑建立索引或使用图表索引协议
5. 地址格式可能有多种表示形式（有无0x前缀、大小写等）

## 7. 代码示例

完整的查询代码示例见附录的`query-streams.ts`文件，它实现了多种方法查询流，并整合结果。

## 8. 总结

虽然MoveFlow提供了SDK，但直接查询链上数据提供了更大的灵活性，特别是在需要自定义查询逻辑的场景。最有效的方法是结合查询用户交易历史和合约事件，然后从中提取流信息。对于生产环境，建议实现缓存和索引机制，以提高查询效率。 