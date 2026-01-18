import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import cors from "cors";

const server = new McpServer({
  name: "CNC-Automation-Planner",
  version: "1.0.0",
});

/**
 * 核心工具：CNC 1臂3機產能模擬 (1 OP1 + 2 OP2) [cite: 2026-01-14]
 */
server.tool("calculate-cnc-capacity", 
  {
    op1_cycle_time: { type: "number", description: "OP1 加工時間 (秒)" },
    op2_cycle_time: { type: "number", description: "OP2 加工時間 (秒)" },
    robot_move_time: { type: "number", description: "機器人搬運時間 (秒)" }
  },
  async ({ op1_cycle_time, op2_cycle_time, robot_move_time }) => {
    const effective_op2_time = op2_cycle_time / 2; 
    const bottleneck_time = Math.max(op1_cycle_time, effective_op2_time) + robot_move_time;
    const hourly_output = (3600 / bottleneck_time).toFixed(2);
    
    return {
      content: [{ 
        type: "text", 
        text: `【CNC 產能模擬分析報告】\n` +
              `--------------------------\n` +
              `● 瓶頸節拍: ${bottleneck_time} 秒\n` +
              `● 預計時產: ${hourly_output} 件/小時\n` +
              `--------------------------\n` +
              `配置：1台 OP1 + 2台 OP2 + 1台機械臂`
      }]
    };
  }
);

const app = express();
app.use(cors());
app.use(express.json());

let transport;

// 添加根路徑處理 - 返回伺服器資訊
app.get("/", (req, res) => {
  res.json({
    name: "CNC-Automation-Planner MCP Server",
    version: "1.0.0",
    status: "running",
    endpoints: {
      sse: "/sse",
      messages: "/messages"
    }
  });
});

// SSE 連線端點
app.get("/sse", async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
  console.log("n8n SSE 通道已建立");
});

// 訊息處理端點
app.post("/messages", async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("無效連線");
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`MCP Server 正在端口 ${PORT} 運行`);
});
