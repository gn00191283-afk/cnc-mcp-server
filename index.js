import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import cors from "cors";

const server = new McpServer({
  name: "CNC-Automation-Planner",
  version: "1.0.0",
});

/**
 * 核心工具：CNC 1臂3機產能模擬
 * 邏輯：考慮 1台 OP1 與 2台 OP2 的產能配置 [cite: 2026-01-14]
 */
server.tool("calculate-cnc-capacity", 
  {
    op1_cycle_time: { type: "number", description: "OP1 機台加工時間 (秒)" },
    op2_cycle_time: { type: "number", description: "OP2 機台加工時間 (秒)" },
    robot_move_time: { type: "number", description: "機械臂平均每次搬運時間 (秒)" }
  },
  async ({ op1_cycle_time, op2_cycle_time, robot_move_time }) => {
    // 兩台 OP2 並行，等效加工時間折半
    const effective_op2_time = op2_cycle_time / 2; 
    
    // 計算瓶頸節拍：取加工時間較長者加上機器人搬運時間
    const bottleneck_time = Math.max(op1_cycle_time, effective_op2_time) + robot_move_time;
    
    // 計算每小時產出
    const hourly_output = (3600 / bottleneck_time).toFixed(2);
    
    return {
      content: [{ 
        type: "text", 
        text: `【CNC 產能模擬分析報告】\n` +
              `--------------------------\n` +
              `● 瓶頸節拍 (Takt Time): ${bottleneck_time} 秒\n` +
              `● 預計時產 (Output): ${hourly_output} 件/小時\n` +
              `--------------------------\n` +
              `配置明細：1台 OP1 + 2台 OP2 並行運作\n` +
              `規劃狀態：已根據機械臂搬運時間優化 [cite: 2026-01-14]`
      }]
    };
  }
);

const app = express();

// 修正 502/連線失敗：允許跨網域與解析 JSON 訊息
app.use(cors());
app.use(express.json());

let transport;

// SSE 端點：增加長連接必要的 Header 規範
app.get("/sse", async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
  console.log("n8n SSE 通道已建立");
});

app.post("/messages", async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("無效的請求：請先建立 SSE 連線");
  }
});

// 核心修正：監聽 0.0.0.0 並使用自動分配的端口
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`MCP Server 正在端口 ${PORT} 運行`);
});
