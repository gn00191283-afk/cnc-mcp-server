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
 */
server.tool("calculate-cnc-capacity", 
  {
    op1_cycle_time: { type: "number", description: "OP1 機台加工時間 (秒)" },
    op2_cycle_time: { type: "number", description: "OP2 機台加工時間 (秒)" },
    robot_move_time: { type: "number", description: "機械臂平均每次搬運時間 (秒)" }
  },
  async ({ op1_cycle_time, op2_cycle_time, robot_move_time }) => {
    const effective_op2_time = op2_cycle_time / 2; // OP2 有兩台，時間折半
    const bottleneck_time = Math.max(op1_cycle_time, effective_op2_time) + robot_move_time;
    const hourly_output = (3600 / bottleneck_time).toFixed(2);
    
    return {
      content: [{ 
        type: "text", 
        text: `【CNC 產能模擬分析】\n` +
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

// 強制開啟 CORS 與 JSON 解析，解決 n8n 連線握手失敗
app.use(cors());
app.use(express.json());

let transport;

app.get("/sse", async (req, res) => {
  // 強制設定 Header 以符合 SSE 規範，避免 Zeabur 網關斷開連線
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
  console.log("n8n 連線成功");
});

app.post("/messages", async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("無效的連線");
  }
});

// 最終修正的 app.listen：監聽 0.0.0.0 並使用環境變數
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`MCP Server 正在端口 ${PORT} 運行`);
});
