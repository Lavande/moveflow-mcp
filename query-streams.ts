// MoveFlow流查询脚本
// 基于SDK中的实现方法，直接使用API查询链上数据

// 常量定义
const ADDRESS = "0xa53c93f1a39dcf1bf32fe507b03058d8166c48896ee197b1ff3534a6d5a70c6"; // 要查询的地址
const CONTRACT = "0x15a5484b9f8369dd3d60c43e4530e7c1bb82eef041bf4cf8a2090399bebde5d4"; // MoveFlow合约地址
const API_URL = "https://fullnode.mainnet.aptoslabs.com/v1"; // Aptos主网API

// 工具函数
const normalizeAddress = (addr: string): string => {
  if (!addr) return '';
  addr = addr.trim().toLowerCase();
  if (!addr.startsWith('0x')) addr = '0x' + addr;
  return addr;
};

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

// 1. 尝试查询用户作为发送者的流事件
async function getSenderStreams(address: string) {
  try {
    console.log(`正在查询地址 ${address} 作为发送者的流事件...`);
    const response = await fetchWithTimeout(
      `${API_URL}/accounts/${CONTRACT}/events/${CONTRACT}::stream::SenderEvents/create_events`
    );
    const events = await response.json();
    
    // 过滤与指定地址相关的事件
    const filteredEvents = Array.isArray(events) 
      ? events.filter(event => 
          normalizeAddress(event.data?.sender) === normalizeAddress(address))
      : [];
    
    console.log(`找到 ${filteredEvents.length} 个发送流事件`);
    return filteredEvents;
  } catch (error) {
    console.error(`获取发送流失败:`, error);
    return [];
  }
}

// 2. 尝试查询用户作为接收者的流事件
async function getReceiverStreams(address: string) {
  try {
    console.log(`正在查询地址 ${address} 作为接收者的流事件...`);
    const response = await fetchWithTimeout(
      `${API_URL}/accounts/${CONTRACT}/events/${CONTRACT}::stream::RecipientEvents/receive_events`
    );
    const events = await response.json();
    
    // 过滤与指定地址相关的事件
    const filteredEvents = Array.isArray(events) 
      ? events.filter(event => 
          normalizeAddress(event.data?.recipient) === normalizeAddress(address))
      : [];
    
    console.log(`找到 ${filteredEvents.length} 个接收流事件`);
    return filteredEvents;
  } catch (error) {
    console.error(`获取接收流失败:`, error);
    return [];
  }
}

// 3. 尝试直接查询链上所有的流创建事件
async function getAllStreamCreateEvents() {
  try {
    console.log(`正在查询所有流创建事件...`);
    
    // 查询最近的交易
    const response = await fetchWithTimeout(
      `${API_URL}/transactions?limit=100`
    );
    const transactions = await response.json();
    
    // 找出与MoveFlow合约相关的交易
    const moveflowTxns = transactions.filter((tx: any) => {
      // 检查交易是否与MoveFlow合约相关
      return tx.payload?.function?.includes(CONTRACT) || 
             tx.payload?.function?.includes('stream') ||
             (tx.events && tx.events.some((event: any) => 
               event.type.includes(CONTRACT) || event.type.includes('stream')));
    });
    
    console.log(`找到 ${moveflowTxns.length} 个与MoveFlow相关的交易`);
    
    // 从这些交易中提取事件
    let allEvents: any[] = [];
    for (const tx of moveflowTxns) {
      if (tx.events && Array.isArray(tx.events)) {
        const streamEvents = tx.events.filter((event: any) => 
          event.type.includes('stream') || 
          event.type.includes('Stream'));
        
        allEvents = [...allEvents, ...streamEvents];
      }
    }
    
    console.log(`从交易中提取出 ${allEvents.length} 个流相关事件`);
    return allEvents;
  } catch (error) {
    console.error(`获取所有流创建事件失败:`, error);
    return [];
  }
}

// 4. 尝试查询所有流事件，然后过滤与地址相关的
async function getAllStreamEvents(address: string) {
  try {
    console.log(`正在查询所有流事件并筛选与地址 ${address} 相关的...`);
    
    // 查询StreamEvent事件
    const response = await fetchWithTimeout(
      `${API_URL}/accounts/${CONTRACT}/events/${CONTRACT}::stream::StreamEvent`
    );
    
    // 如果无法直接查询StreamEvent，则查询所有可能的事件类型
    let events = [];
    try {
      events = await response.json();
    } catch (e) {
      console.log("无法直接查询StreamEvent，尝试查询更多特定事件类型...");
      
      // 查询更多可能的事件类型
      const eventTypes = [
        "create_events", 
        "withdraw_events", 
        "pause_events", 
        "resume_events", 
        "close_events"
      ];
      
      for (const eventType of eventTypes) {
        try {
          const typeResponse = await fetchWithTimeout(
            `${API_URL}/accounts/${CONTRACT}/events/${CONTRACT}::stream::StreamEvent/${eventType}`
          );
          const typeEvents = await typeResponse.json();
          if (Array.isArray(typeEvents)) {
            events = [...events, ...typeEvents];
          }
        } catch (typeError) {
          console.log(`查询事件类型 ${eventType} 失败:`, typeError);
        }
      }
    }
    
    // 过滤与指定地址相关的事件
    const normalizedAddr = normalizeAddress(address);
    const filteredEvents = Array.isArray(events) 
      ? events.filter(event => {
          const data = event.data || {};
          const sender = normalizeAddress(data.sender || '');
          const recipient = normalizeAddress(data.recipient || '');
          return sender === normalizedAddr || recipient === normalizedAddr;
        })
      : [];
    
    console.log(`从所有事件中找到 ${filteredEvents.length} 个与地址相关的流事件`);
    return filteredEvents;
  } catch (error) {
    console.error(`获取所有流事件失败:`, error);
    return [];
  }
}

// 5. 查询用户地址的交易历史，找出与MoveFlow相关的交易
async function getUserTransactions(address: string) {
  try {
    console.log(`正在查询地址 ${address} 的交易历史...`);
    const response = await fetchWithTimeout(
      `${API_URL}/accounts/${address}/transactions?limit=50`
    );
    const transactions = await response.json();
    
    // 找出与MoveFlow合约相关的交易
    const moveflowTxns = transactions.filter((tx: any) => {
      // 检查交易是否与MoveFlow合约相关
      return tx.payload?.function?.includes(CONTRACT) || 
             tx.payload?.function?.includes('stream') ||
             (tx.events && tx.events.some((event: any) => 
               event.type.includes(CONTRACT) || event.type.includes('stream')));
    });
    
    console.log(`找到 ${moveflowTxns.length} 个与MoveFlow相关的交易`);
    
    // 从这些交易中提取事件
    let streamEvents: any[] = [];
    for (const tx of moveflowTxns) {
      if (tx.events && Array.isArray(tx.events)) {
        const events = tx.events.filter((event: any) => 
          event.type.includes('stream') || 
          event.type.includes('Stream'));
        
        streamEvents = [...streamEvents, ...events];
      }
    }
    
    console.log(`从用户交易中提取出 ${streamEvents.length} 个流相关事件`);
    return streamEvents;
  } catch (error) {
    console.error(`获取用户交易失败:`, error);
    return [];
  }
}

// 6. 查询合约资源表中的流数据
async function queryContractResources() {
  try {
    console.log(`正在查询合约资源，寻找流表...`);
    const response = await fetchWithTimeout(
      `${API_URL}/accounts/${CONTRACT}/resources`
    );
    const resources = await response.json();
    
    // 查找包含流表信息的资源
    const streamTableResources = resources.filter((resource: any) => 
      resource.type.includes('Table') && 
      (resource.type.includes('stream') || resource.type.includes('Stream'))
    );
    
    console.log(`找到 ${streamTableResources.length} 个可能包含流信息的表资源`);
    return streamTableResources;
  } catch (error) {
    console.error(`查询合约资源失败:`, error);
    return [];
  }
}

// 7. 从事件中提取流ID并去重
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

// 8. 获取单个流的详细信息
async function fetchStreamInfo(streamId: string) {
  try {
    console.log(`正在获取流 ${streamId} 的详细信息...`);
    
    // 构建View函数调用
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
    
    const streamInfo = await response.json();
    
    // 如果使用view函数失败，尝试通过合约模块查询
    if (!streamInfo || streamInfo.error) {
      console.log(`使用view函数查询失败，尝试通过其他方式获取流信息...`);
      return null;
    }
    
    return streamInfo;
  } catch (error) {
    console.error(`获取流详情失败:`, error);
    return null;
  }
}

// 9. 主函数：执行流查询
async function queryStreams(address: string) {
  const normalizedAddress = normalizeAddress(address);
  console.log(`开始查询地址 ${normalizedAddress} 的所有流...`);
  
  // 尝试多种方法查询与地址相关的流
  const [
    senderEvents, 
    receiverEvents, 
    allEvents, 
    userTxEvents, 
    allCreateEvents
  ] = await Promise.all([
    getSenderStreams(normalizedAddress),
    getReceiverStreams(normalizedAddress),
    getAllStreamEvents(normalizedAddress),
    getUserTransactions(normalizedAddress),
    getAllStreamCreateEvents()
  ]);
  
  // 合并并提取流ID
  const allEventsCombined = [
    ...senderEvents, 
    ...receiverEvents, 
    ...allEvents, 
    ...userTxEvents,
    ...allCreateEvents.filter(event => {
      const data = event.data || {};
      const sender = normalizeAddress(data.sender || '');
      const recipient = normalizeAddress(data.recipient || '');
      return sender === normalizedAddress || recipient === normalizedAddress;
    })
  ];
  
  // 从所有事件中提取流ID
  const streamIds = extractStreamIds(allEventsCombined);
  
  console.log(`找到 ${streamIds.length} 个流ID，开始获取详细信息...`);
  
  // 获取所有流的详细信息
  const MAX_STREAMS_TO_PROCESS = 10; // 限制处理的流数量，避免请求过多
  const limitedStreamIds = streamIds.slice(0, MAX_STREAMS_TO_PROCESS);
  
  if (limitedStreamIds.length < streamIds.length) {
    console.log(`为避免请求过多，仅处理前 ${MAX_STREAMS_TO_PROCESS} 个流`);
  }
  
  // 并行获取所有流的详情
  const streamInfoPromises = limitedStreamIds.map(id => fetchStreamInfo(id));
  const streamInfoResults = await Promise.all(streamInfoPromises);
  
  // 过滤掉获取失败的结果
  const validStreamInfos = streamInfoResults.filter(info => info !== null);
  
  console.log(`成功获取 ${validStreamInfos.length} 个流的详细信息`);
  
  // 如果没有找到任何流，查询合约资源表
  if (validStreamInfos.length === 0) {
    console.log("未找到任何流信息，尝试查询合约资源表...");
    const tableResources = await queryContractResources();
    console.log("合约资源表信息:", JSON.stringify(tableResources, null, 2));
    
    // 打印所有收集的事件，以便调试
    if (allEventsCombined.length > 0) {
      console.log("所有收集的事件:", JSON.stringify(allEventsCombined.slice(0, 3), null, 2));
    }
  } else {
    console.log("流详细信息:", JSON.stringify(validStreamInfos, null, 2));
  }
  
  return {
    senderEvents,
    receiverEvents,
    allEvents,
    userTxEvents,
    allCreateEvents,
    streamIds,
    streamDetails: validStreamInfos
  };
}

// 执行查询
queryStreams(ADDRESS)
  .then(result => {
    console.log("查询完成！");
  })
  .catch(error => {
    console.error("查询过程中发生错误:", error);
  });
