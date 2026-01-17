import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";

const server = new McpServer({
  name: "CNC-Automation-Planner",
  version: "1.0.0",
});

/**
 * 核心工具：CNC 1臂3機產能模擬
 * 適用場景：1台機械臂負責上下料，供應 1台 OP1 與 2台 OP2
 */
server.tool("calculate-cnc-capacity", 
  {
    op1_cycle_time: { type: "number", description: "OP1 機台加工時間 (秒)" },
    op2_cycle_time: { type: "number", description: "OP2 機台加工時間 (秒)" },
    robot_move_time: { type: "number", description: "機械臂平均每次搬運/上下料時間 (秒)" }
  },
  async ({ op1_cycle_time, op2_cycle_time, robot_move_time }) => {
    // 邏輯說明：由於 OP2 有兩台，其等效加工能力翻倍，時間折半
    const effective_op2_time = op2_cycle_time / 2;
    
    // 計算瓶頸節拍 (Bottleneck Cycle Time)
    // 總循環時間會受到最慢的站點加上機械臂動作時間的限制
    const bottleneck_time = Math.max(op1_cycle_time, effective_op2_time) + robot_move_time;
    
    // 計算每小時產出
    const hourly_output = (3600 / bottleneck_time).toFixed(2);
    
    // 計算人員效率與機台稼動參考
    const op1_utilization = ((op1_cycle_time / bottleneck_time) * 100).toFixed(1);
    const op2_utilization = ((effective_op2_time / bottleneck_time) * 100).toFixed(1);
    
    return {
      content: [{ 
        type: "text", 
        text: `【CNC 產能模擬分析】\n` +
              `--------------------------\n` +
              `● 瓶頸節拍 (Takt Time): ${bottleneck_time} 秒\n` +
              `● 預計時產 (Output): ${hourly_output} 件/小時\n` +
              `● OP1 稼動預估: ${op1_utilization}%\n` +
              `● OP2 稼動預估: ${op2_utilization}% (兩台平均)\n` +
              `--------------------------\n` +
              `配置建議：此計算基於 1台 OP1、2台 OP2 與 1台機械臂。`
      }]
    };
  }
);

const app = express();
let transport;

// SSE 端點：增加強制 Header 以相容 n8n 連線
app.get("/sse", async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // 建立傳輸通道
  transport = new SS
