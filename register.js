import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const APP_ID = process.env.DISCORD_APP_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

if (!APP_ID || !BOT_TOKEN) {
  console.error(
    "❌ Thiếu DISCORD_APP_ID hoặc DISCORD_BOT_TOKEN trong file .env",
  );
  process.exit(1);
}

const commands = [
  { name: "start", description: "Bật máy ảo Azure VM" },
  { name: "stop", description: "Tắt máy ảo Azure VM" },
  { name: "status", description: "Kiểm tra trạng thái máy ảo Azure VM" },
];

async function registerCommands() {
  try {
    console.log("🔄 Đang đăng ký Slash Commands...");
    await axios.put(
      `https://discord.com/api/v10/applications/${APP_ID}/commands`,
      commands,
      {
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );
    console.log("✅ Đăng ký thành công!");
  } catch (error) {
    console.error(
      "❌ Lỗi đăng ký:",
      error.response
        ? JSON.stringify(error.response.data, null, 2)
        : error.message,
    );
  }
}

registerCommands();
