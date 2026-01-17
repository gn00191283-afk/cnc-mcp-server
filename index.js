import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";

const server = new McpServer({
  name: "CNC-Automation-Planner",
  version: "1.0.0",
});

/**
 * 核心工具：CNC 1臂3機產能模擬
 * 邏輯：1台機械臂負責上下料，供應 1台 OP1 與 2台 OP2 [cite: 2026-01-14]
 */
server.tool("calculate-cnc-capacity", 
  {
    op1_cycle_time: { type: "number", description: "OP1 機台加工時間 (秒)" },
    op2_cycle_time: { type: "number", description: "OP2 機台加工時間 (秒)" },
    robot_move_time: { type: "number", description: "機械臂每次上下料平均時間 (秒)" }
  },
  async ({ op1_cycle_time, op2_cycle_time, robot_move_time }) => {
    // 由於有 2 台 OP2，等效加工時間折半
    const effective_op2_time = op2_cycle_time / 2;
    
    // 計算瓶頸節拍 (Bottleneck Time)
    const bottleneck_time = Math.max(op1_cycle_time, effective_op2_time) + robot_move_time;
    
    // 計算每小時產出
    const hourly_output = (3600 / bottleneck_time).toFixed(2);
    
    return {
      content: [{ 
        type: "text", 
        text: `【CNC 產能模擬分析】\n` +
              `--------------------------\n` +
              `● 瓶頸節拍 (Takt Time): ${bottleneck_time} 秒\n` +
              `● 預計時產 (Output): ${hourly_output} 件/小時\n` +
              `--------------------------\n` +
              `配置：1台 OP1 + 2台 OP2 + 1台機械臂`
      }]
    };
  }
);

const app = express();
let transport;

// SSE 端點：增加強制 Header 以解決 n8n 連線失敗問題
app.get("/sse", async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
  console.log("n8n 已嘗試透過 SSE 連線");
});

app.post("/messages", async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("尚未建立 SSE 連線");
  }
});

// 埠號設定：Zeabur 使用 8080
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`MCP Server 正在端口 ${PORT} 運行`);
});
