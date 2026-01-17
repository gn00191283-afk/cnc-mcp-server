import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";

const server = new McpServer({
  name: "CNC-Automation-Planner",
  version: "1.0.0",
});

// 核心工具：1臂3機產能模擬 (1 OP1 + 2 OP2)
server.tool("calculate-cnc-capacity", 
  {
    op1_cycle_time: { type: "number", description: "OP1 機台加工時間 (秒)" },
    op2_cycle_time: { type: "number", description: "OP2 機台加工時間 (秒)" },
    robot_move_time: { type: "number", description: "機械臂上下料平均時間 (秒)" }
  },
  async ({ op1_cycle_time, op2_cycle_time, robot_move_time }) => {
    // 邏輯：由於有 2 台 OP2，OP2 的產出效率是單台兩倍
    const effective_op2_time = op2_cycle_time / 2;
    const bottleneck_time = Math.max(op1_cycle_time, effective_op2_time) + robot_move_time;
    const hourly_output = (3600 / bottleneck_time).toFixed(2);
    
    return {
      content: [{ 
        type: "text", 
        text: `【CNC 自动化模拟结果】\n瓶頸節拍: ${bottleneck_time} 秒\n預計時產: ${hourly_output} 件/小時\n配置方案: 1台OP1 + 2台OP2 + 1機械臂` 
      }]
    };
  }
);

const app = express();
let transport;

app.get("/sse", async (req, res) => {
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("No active SSE connection");
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`MCP Server 正在端口 ${PORT} 運行`));
