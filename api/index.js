import axios from "axios";
import { verifyKey } from "discord-interactions";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  // Fallback to JSON.stringify if req.body is already parsed by Vercel
  const rawBody =
    typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});

  const signature = req.headers["x-signature-ed25519"];
  const timestamp = req.headers["x-signature-timestamp"];

  if (!process.env.DISCORD_PUBLIC_KEY) {
    return res
      .status(500)
      .send(
        "Lỗi Server: Thiếu DISCORD_PUBLIC_KEY trong Environment Variables của Vercel.",
      );
  }

  // Verify Discord Request
  let isValidRequest = false;
  try {
    isValidRequest = verifyKey(
      rawBody,
      signature,
      timestamp,
      process.env.DISCORD_PUBLIC_KEY,
    );
  } catch (err) {
    return res.status(500).send("Lỗi Xác Thực Vercel: " + err.message);
  }

  if (!isValidRequest) {
    return res.status(401).send("Bad request signature");
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { type, data, member, user } = body;

  // Discord connection ping
  if (type === 1) {
    return res.status(200).json({ type: 1 });
  }

  // Slash commands
  if (type === 2) {
    // Basic user extraction (member.user in servers, user in DMs)
    const interactionUser = member ? member.user : user;

    // Security check: Only allow specific user ID if it is set. If empty, allow everyone.
    if (
      process.env.ALLOWED_USER_ID &&
      interactionUser.id !== process.env.ALLOWED_USER_ID
    ) {
      return res.status(200).json({
        type: 4,
        data: { content: "❌ Bạn không có quyền sử dụng bot này!" },
      });
    }

    if (data.name === "start") {
      try {
        await startVM();
        return res.status(200).json({
          type: 4,
          data: { content: "🚀 Yêu cầu BẬT VM đã được gửi..." },
        });
      } catch (error) {
        return res.status(200).json({
          type: 4,
          data: { content: `❌ Lỗi khi bật VM: ${error.message}` },
        });
      }
    }

    if (data.name === "stop") {
      try {
        await stopVM();
        return res.status(200).json({
          type: 4,
          data: { content: "🛑 Yêu cầu TẮT VM đã được gửi..." },
        });
      } catch (error) {
        return res.status(200).json({
          type: 4,
          data: { content: `❌ Lỗi khi tắt VM: ${error.message}` },
        });
      }
    }

    if (data.name === "status") {
      try {
        const isRunning = await checkVMStatus();
        return res.status(200).json({
          type: 4,
          data: { content: isRunning ? "🟢 VM ĐANG CHẠY" : "🔴 VM ĐANG TẮT" },
        });
      } catch (error) {
        return res.status(200).json({
          type: 4,
          data: { content: `❌ Lỗi khi kiểm tra status VM: ${error.message}` },
        });
      }
    }
  }
}

// ============== AZURE LOGIC =================
async function getAzureToken() {
  const response = await axios.post(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/token`,
    new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.AZURE_CLIENT_ID,
      client_secret: process.env.AZURE_CLIENT_SECRET,
      resource: "https://management.azure.com/",
    }),
  );
  return response.data.access_token;
}

async function startVM() {
  const token = await getAzureToken();
  await axios.post(
    `https://management.azure.com/subscriptions/${process.env.SUBSCRIPTION_ID}/resourceGroups/${process.env.RESOURCE_GROUP}/providers/Microsoft.Compute/virtualMachines/${process.env.VM_NAME}/start?api-version=2023-03-01`,
    {},
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

async function stopVM() {
  const token = await getAzureToken();
  await axios.post(
    `https://management.azure.com/subscriptions/${process.env.SUBSCRIPTION_ID}/resourceGroups/${process.env.RESOURCE_GROUP}/providers/Microsoft.Compute/virtualMachines/${process.env.VM_NAME}/powerOff?api-version=2023-03-01`,
    {},
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

async function checkVMStatus() {
  const token = await getAzureToken();
  const response = await axios.get(
    `https://management.azure.com/subscriptions/${process.env.SUBSCRIPTION_ID}/resourceGroups/${process.env.RESOURCE_GROUP}/providers/Microsoft.Compute/virtualMachines/${process.env.VM_NAME}/instanceView?api-version=2023-03-01`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  const statuses = response.data.statuses;
  const powerState = statuses.find((s) => s.code.startsWith("PowerState/"));
  // Example of powerState.code: 'PowerState/running' or 'PowerState/deallocated'
  return powerState && powerState.code === "PowerState/running";
}
