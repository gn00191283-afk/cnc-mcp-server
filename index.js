import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";

const server = new McpServer({
  name: "CNC-Automation-Planner",
  version: "1.0.0",
});

// 1臂3機產能模擬工具
server.tool("calculate-cnc-capacity", 
  {
    op1_cycle_time: { type: "number", description: "OP1 機台加工時間 (秒)" },
    op2_cycle_time: { type: "number", description: "OP2 機台加工時間 (秒)" },
    robot_move_time: { type: "number", description: "機械臂平均每次上下料時間 (秒)" }
  },
  async ({ op1_cycle_time, op2_cycle_time, robot_move_time }) => {
    const effective_op2_time = op2_cycle_time / 2;
    const bottleneck_time = Math.max(op1_cycle_time, effective_op2_time) + robot_move_time;
    const hourly_output = (3600 / bottleneck_time).toFixed(2);
    
    return {
      content: [{ 
        type: "text", 
        text: `【CNC 產能模擬】\n瓶頸節拍: ${bottleneck_time} 秒\n時產: ${hourly_output} 件/小時` 
      }]
    };
  }
);

const app = express();
let transport;

app.get("/sse", async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
  console.log("n8n 已連線");
});

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
