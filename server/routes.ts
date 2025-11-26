import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPeerSchema, insertTaskSchema, insertFamilyEventSchema } from "@shared/schema";
import { z } from "zod";
import { LNBitsClient } from "./lnbits";
import { NWCClient } from "./nwc";

export async function registerRoutes(app: Express): Promise<Server> {
  // Test LNBits connection
  app.post("/api/wallet/test", async (req, res) => {
    try {
      const { lnbitsUrl, lnbitsAdminKey } = req.body;
      
      if (!lnbitsUrl || !lnbitsAdminKey) {
        return res.status(400).json({ error: "lnbitsUrl and lnbitsAdminKey required" });
      }

      // Test invoice creation
      const response = await fetch(`${lnbitsUrl}/api/v1/invoices`, {
        method: "POST",
        headers: {
          "X-Api-Key": lnbitsAdminKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: 1,
          memo: "Test invoice",
          out: false,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json({ 
          error: `LNBits API error: ${response.status}`,
          details: data 
        });
      }

      res.json({ 
        success: true, 
        message: "LNBits wallet is working",
        invoice: data
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Peer Registration
  app.post("/api/peers/register", async (req, res) => {
    try {
      const { name, role, pin, familyName } = req.body;
      
      if (!name || !role || !pin) {
        return res.status(400).json({ error: "Name, role, and pin required" });
      }

      const connectionId = `BTC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const peer = await storage.createPeer({
        name,
        role,
        pin,
        connectionId,
        familyName: familyName && role === "parent" ? familyName : undefined,
      });
      res.json(peer);
    } catch (error) {
      if ((error as any).message?.includes("unique constraint")) {
        return res.status(400).json({ error: "Name und PIN Kombination existiert bereits" });
      }
      console.error("Register error:", error);
      res.status(500).json({ error: "Failed to register peer" });
    }
  });

  // Peer Login by PIN
  app.post("/api/peers/login", async (req, res) => {
    try {
      const { name, pin, role } = req.body;
      
      if (!name || !pin || !role) {
        return res.status(400).json({ error: "Name, pin, and role required" });
      }
      
      const peer = await storage.getPeerByNameAndPin(name, pin, role);
      
      if (!peer) {
        return res.status(404).json({ error: "Peer not found. Please register first." });
      }
      
      res.json(peer);
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Setup NWC wallet
  app.post("/api/wallet/setup", async (req, res) => {
    try {
      const { peerId, nwcConnectionString } = req.body;
      
      if (!peerId || !nwcConnectionString) {
        return res.status(400).json({ error: "peerId and nwcConnectionString required" });
      }

      // Validate NWC connection string
      if (!NWCClient.validateConnectionString(nwcConnectionString)) {
        return res.status(400).json({ error: "Invalid NWC connection string. Must be: nostr+walletconnect://pubkey?relay=...&secret=..." });
      }

      // Test NWC connection
      try {
        const nwc = new NWCClient(nwcConnectionString);
        await nwc.getWalletInfo();
      } catch (error) {
        return res.status(400).json({ error: `NWC connection failed: ${error}` });
      }

      // Save NWC credentials
      const peer = await storage.updatePeerNWC(peerId, nwcConnectionString);
      res.json(peer);
    } catch (error) {
      console.error("Wallet setup error:", error);
      res.status(500).json({ error: "Failed to setup wallet" });
    }
  });

  // Setup LNbits wallet for Parent
  app.post("/api/wallet/setup-lnbits", async (req, res) => {
    try {
      const { peerId, lnbitsUrl, lnbitsAdminKey } = req.body;
      
      if (!peerId || !lnbitsUrl || !lnbitsAdminKey) {
        return res.status(400).json({ error: "peerId, lnbitsUrl, and lnbitsAdminKey required" });
      }

      // Normalize URL (remove trailing slash)
      const normalizedUrl = lnbitsUrl.replace(/\/$/, "");

      // Test LNbits connection by creating a test invoice
      try {
        const lnbits = new LNBitsClient(normalizedUrl, lnbitsAdminKey);
        await lnbits.createInvoice(1, "Test connection");
      } catch (error) {
        console.error("LNbits connection test failed:", error);
        return res.status(400).json({ error: `LNbits connection failed: ${error}` });
      }

      // Save LNbits credentials
      const peer = await storage.updatePeerWallet(peerId, normalizedUrl, lnbitsAdminKey);
      res.json(peer);
    } catch (error) {
      console.error("LNbits wallet setup error:", error);
      res.status(500).json({ error: "Failed to setup LNbits wallet" });
    }
  });

  // Setup Child Lightning Address
  app.post("/api/wallet/setup-child-address", async (req, res) => {
    try {
      const { peerId, lightningAddress } = req.body;
      
      if (!peerId || !lightningAddress) {
        return res.status(400).json({ error: "peerId and lightningAddress required" });
      }

      // Validate lightning address format
      if (!lightningAddress.includes("@")) {
        return res.status(400).json({ error: "Invalid lightning address format (should be name@domain)" });
      }

      const peer = await storage.updateChildLightningAddress(peerId, lightningAddress);
      res.json(peer);
    } catch (error) {
      console.error("Child address setup error:", error);
      res.status(500).json({ error: "Failed to setup child lightning address" });
    }
  });

  // Link child to parent by connection ID
  app.post("/api/peers/link", async (req, res) => {
    try {
      const { childId, parentConnectionId } = req.body;
      
      if (!childId || !parentConnectionId) {
        return res.status(400).json({ error: "childId and parentConnectionId required" });
      }

      const parent = await storage.getPeerByConnectionId(parentConnectionId, "parent");
      
      if (!parent) {
        return res.status(404).json({ error: "Parent connection not found. Check the connection code." });
      }

      const updatedChild = await storage.linkChildToParent(childId, parentConnectionId);
      res.json(updatedChild);
    } catch (error) {
      console.error("Link error:", error);
      res.status(500).json({ error: "Failed to link child to parent" });
    }
  });

  // Get all parents
  app.get("/api/peers/parents", async (req, res) => {
    try {
      const parents = await storage.getAllParents();
      res.json(parents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch parents" });
    }
  });

  // Get all peers by connection ID
  app.get("/api/peers/connection/:connectionId", async (req, res) => {
    try {
      const { connectionId } = req.params;
      const peers = await storage.getPeersByConnectionId(connectionId);
      res.json(peers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch peers" });
    }
  });

  // Get all tasks for a connection
  app.get("/api/tasks/:connectionId", async (req, res) => {
    try {
      const { connectionId } = req.params;
      const tasks = await storage.getTasks(connectionId);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  // Create a new task (with optional escrow via wallet)
  app.post("/api/tasks", async (req, res) => {
    try {
      const data = insertTaskSchema.parse(req.body);
      
      const createdBy = data.createdBy;
      const parent = await storage.getPeer(createdBy);
      
      if (!parent) {
        return res.status(404).json({ error: "Parent not found" });
      }

      let invoice = "";
      let escrowLocked = false;

      // Try to create escrow invoice if wallet is configured
      if (parent.lnbitsUrl && parent.lnbitsAdminKey) {
        try {
          const lnbits = new LNBitsClient(parent.lnbitsUrl, parent.lnbitsAdminKey);
          invoice = await lnbits.createPaylink(data.sats, `Task: ${data.title}`);
          escrowLocked = true;
        } catch (error) {
          console.warn("LNbits invoice creation failed, creating task without escrow:", error);
        }
      } else if (parent.nwcConnectionString) {
        try {
          const nwc = new NWCClient(parent.nwcConnectionString);
          invoice = await nwc.createPaymentRequest(data.sats, `Task: ${data.title}`);
          escrowLocked = true;
        } catch (error) {
          console.warn("NWC invoice creation failed, creating task without escrow:", error);
        }
      }

      // Create task
      const task = await storage.createTask({
        ...data,
        status: "open",
      });

      // Record escrow lock transaction if applicable
      if (escrowLocked && invoice) {
        await storage.createTransaction({
          fromPeerId: createdBy,
          toPeerId: createdBy,
          sats: data.sats,
          taskId: task.id,
          type: "escrow_lock",
          status: "pending",
          paymentHash: invoice,
        });
      }

      res.json({ 
        task,
        escrowLocked: escrowLocked,
        paymentInfo: escrowLocked ? {
          invoice: invoice,
          sats: data.sats,
          description: `Task: ${data.title}`,
        } : undefined
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error("Create task error:", error);
        res.status(500).json({ error: "Failed to create task" });
      }
    }
  });

  // Delete task
  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const task = await storage.getTask(id);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const deleted = await storage.deleteTask(id);
      if (deleted) {
        res.json({ success: true, message: "Task deleted" });
      } else {
        res.status(500).json({ error: "Failed to delete task" });
      }
    } catch (error) {
      console.error("Delete task error:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // Update task and send payment to child's lightning address
  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      
      const task = await storage.getTask(id);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // If approving, send sats to child's lightning address
      if (updates.status === "approved" && task.status !== "approved") {
        const child = await storage.getPeer(task.assignedTo!);
        const parent = await storage.getPeer(task.createdBy);
        
        if (!child || !parent) {
          return res.status(404).json({ error: "Child or parent not found" });
        }

        if (!child.lightningAddress) {
          return res.status(400).json({ error: "Child has no lightning address configured" });
        }

        if (!parent.lnbitsUrl || !parent.lnbitsAdminKey) {
          return res.status(400).json({ error: "Parent wallet not configured" });
        }

        // Send payment to child's lightning address
        try {
          const parentLnbits = new LNBitsClient(parent.lnbitsUrl, parent.lnbitsAdminKey);
          const paymentHash = await parentLnbits.payToLightningAddress(
            task.sats,
            child.lightningAddress,
            `Task: ${task.title}`
          );

          // Record transaction
          await storage.createTransaction({
            fromPeerId: task.createdBy,
            toPeerId: child.id,
            sats: task.sats,
            taskId: task.id,
            type: "task_payment",
            status: "completed",
            paymentHash: paymentHash,
          });

          updates.paymentHash = paymentHash;
        } catch (error) {
          console.error("Payment error:", error);
          return res.status(500).json({ error: `Payment failed: ${error}` });
        }
      }

      const updatedTask = await storage.updateTask(id, updates);
      res.json(updatedTask);
    } catch (error) {
      console.error("Update task error:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // Withdraw sats via child's Lightning wallet
  app.post("/api/withdraw", async (req, res) => {
    try {
      const { peerId, sats, paymentRequest } = req.body;
      
      if (!peerId || !sats || !paymentRequest) {
        return res.status(400).json({ error: "peerId, sats, and paymentRequest required" });
      }

      const child = await storage.getPeer(peerId);
      if (!child) {
        return res.status(404).json({ error: "Child not found" });
      }

      if ((child.balance || 0) < sats) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      let paymentHash: string = "";

      // Use parent's wallet for withdrawal
      const tasks = await storage.getTasks(child.connectionId || "");
      const parentTask = tasks[0];
      if (!parentTask) {
        return res.status(400).json({ error: "No parent connection found" });
      }

      const parent = await storage.getPeer(parentTask.createdBy);
      if (!parent || !parent.lnbitsUrl || !parent.lnbitsAdminKey) {
        return res.status(500).json({ error: "Parent wallet not configured" });
      }

      const parentLnbits = new LNBitsClient(parent.lnbitsUrl, parent.lnbitsAdminKey);
      try {
        paymentHash = await parentLnbits.payInvoice(paymentRequest);
      } catch (error) {
        console.error("Payment error:", error);
        return res.status(500).json({ error: "Failed to send withdrawal. Invalid Lightning address?" });
      }

      // Deduct from balance
      const newBalance = (child.balance || 0) - sats;
      await storage.updateBalance(peerId, newBalance);

      // Record withdrawal
      await storage.createTransaction({
        fromPeerId: peerId,
        toPeerId: peerId,
        sats,
        type: "withdrawal",
        status: "completed",
        paymentHash,
      });

      res.json({ success: true, newBalance });
    } catch (error) {
      console.error("Withdraw error:", error);
      res.status(500).json({ error: "Failed to process withdrawal" });
    }
  });

  // Family Events
  app.get("/api/events/:connectionId", async (req, res) => {
    try {
      const { connectionId } = req.params;
      const events = await storage.getFamilyEvents(connectionId);
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.post("/api/events", async (req, res) => {
    try {
      const data = insertFamilyEventSchema.parse(req.body);
      
      // Ensure dates are properly formatted
      const eventData = {
        ...data,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      };
      
      const event = await storage.createEvent(eventData);
      res.json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error("Create event error:", error);
        res.status(500).json({ error: "Failed to create event" });
      }
    }
  });

  app.patch("/api/events/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const event = await storage.getEvent(id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      const updated = await storage.updateEvent(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Update event error:", error);
      res.status(500).json({ error: "Failed to update event" });
    }
  });

  app.delete("/api/events/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteEvent(id);
      if (deleted) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Event not found" });
      }
    } catch (error) {
      console.error("Delete event error:", error);
      res.status(500).json({ error: "Failed to delete event" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
