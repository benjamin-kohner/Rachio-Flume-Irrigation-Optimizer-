import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy Rachio Person Info
  app.post("/api/rachio/person", async (req, res) => {
    try {
      const { apiKey } = req.body;
      const personRes = await fetch("https://api.rach.io/1/public/person/info", {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (!personRes.ok) {
        const text = await personRes.text();
        throw new Error(`Rachio Auth Failed: ${personRes.status} ${text}`);
      }
      const personData = await personRes.json();
      
      if (!personData?.id) {
        throw new Error(`Rachio Person Info Error: Missing ID in response: ${JSON.stringify(personData)}`);
      }
      
      const detailsRes = await fetch(`https://api.rach.io/1/public/person/${personData.id}`, {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (!detailsRes.ok) throw new Error("Failed to fetch Rachio person details");
      const detailsData = await detailsRes.json();
      res.json(detailsData);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy Rachio Device Events
  app.post("/api/rachio/events", async (req, res) => {
    try {
      const { apiKey, deviceId, startTime, endTime } = req.body;
      const eventsRes = await fetch(`https://api.rach.io/1/public/device/${deviceId}/event?startTime=${startTime}&endTime=${endTime}`, {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (!eventsRes.ok) throw new Error("Failed to fetch Rachio events");
      const eventsData = await eventsRes.json();
      res.json(eventsData);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy Flume Query
  app.post("/api/flume/query", async (req, res) => {
    try {
      const { clientId, clientSecret, username, password, queries } = req.body;
      
      const authRes = await fetch("https://api.flumewater.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "password",
          client_id: clientId,
          client_secret: clientSecret,
          username: username,
          password: password
        })
      });
      if (!authRes.ok) {
        const text = await authRes.text();
        throw new Error(`Flume Auth Failed: ${authRes.status} ${text}`);
      }
      const authData = await authRes.json();
      const token = authData?.data?.[0]?.access_token;
      
      if (!token) {
        throw new Error(`Flume Auth Error: Missing token in response: ${JSON.stringify(authData)}`);
      }

      // Flume often puts the user_id inside the JWT access token payload
      let userId = authData?.data?.[0]?.user_id;

      if (!userId) {
        try {
          const payloadBase64 = token.split('.')[1];
          const payloadBuffer = Buffer.from(payloadBase64, 'base64');
          const payload = JSON.parse(payloadBuffer.toString('utf-8'));
          
          // Check common JWT fields for the user ID
          userId = payload.user_id || payload.id || payload.sub;
          
          if (!userId) {
            throw new Error(`Missing user_id in JWT payload: ${JSON.stringify(payload)}`);
          }
        } catch (err: any) {
          throw new Error(`Flume Users Error: Could not extract user ID from token. ${err.message}`);
        }
      }

      const deviceRes = await fetch(`https://api.flumewater.com/users/${userId}/devices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const deviceData = await deviceRes.json();
      const deviceId = deviceData?.data?.[0]?.id;
      
      if (!deviceId) {
        throw new Error(`Flume Devices Error: Missing device ID in response: ${JSON.stringify(deviceData)}`);
      }

      const queryRes = await fetch(`https://api.flumewater.com/users/${userId}/devices/${deviceId}/query`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ queries })
      });
      if (!queryRes.ok) {
        const text = await queryRes.text();
        throw new Error(`Flume Query Failed: ${queryRes.status} ${text}`);
      }
      const queryData = await queryRes.json();
      
      res.json(queryData);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
