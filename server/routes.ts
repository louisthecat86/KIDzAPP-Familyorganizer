import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPeerSchema, insertTaskSchema } from "@shared/schema";
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
      const { name, role, pin } = req.body;
      
      if (!name || !role || !pin) {
        return res.status(400).json({ error: "Name, role, and pin required" });
      }

      const connectionId = `BTC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const peer = await storage.createPeer({
        name,
        role,
        pin,
        connectionId,
      });
      res.json(peer);
    } catch (error) {
      if ((error as any).message?.includes("unique constraint")) {
        return res.status(400).json({ error: "PIN already in use" });
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

  // Create a new task with escrow lock
  app.post("/api/tasks", async (req, res) => {
    try {
      const data = insertTaskSchema.parse(req.body);
      
      const createdBy = data.createdBy;
      const parent = await storage.getPeer(createdBy);
      
      if (!parent) {
        return res.status(404).json({ error: "Parent not found" });
      }

      // NWC wallet is REQUIRED
      if (!parent.nwcConnectionString) {
        return res.status(400).json({ error: "NWC wallet must be configured to create tasks" });
      }

      // Create BOLT11 invoice for escrow via NWC
      const nwc = new NWCClient(parent.nwcConnectionString);
      let invoice = "";
      try {
        const nwcInvoice = await nwc.createInvoice(data.sats, `Task: ${data.title}`);
        invoice = nwcInvoice.invoice;
      } catch (error) {
        console.error("Invoice creation error:", error);
        return res.status(500).json({ error: "Failed to create payment invoice for escrow" });
      }

      // Create task with BOLT11 invoice as paylink
      const task = await storage.createTask({
        ...data,
        status: "open",
        paylink: invoice, // BOLT11 invoice
        escrowLocked: true,
      });

      // Record escrow lock transaction
      await storage.createTransaction({
        fromPeerId: createdBy,
        toPeerId: createdBy,
        sats: data.sats,
        taskId: task.id,
        type: "escrow_lock",
        status: "pending",
        paymentHash: invoice,
      });

      res.json({ 
        task,
        requiresPayment: true,
        paymentInfo: {
          invoice: invoice,
          sats: data.sats,
          description: `Task: ${data.title}`,
          escrowRequired: true
        }
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

  // Update task and release escrow
  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      
      const task = await storage.getTask(id);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // If approving, release escrow sats to child
      if (updates.status === "approved" && task.status !== "approved") {
        const child = await storage.getPeer(task.assignedTo!);
        const parent = await storage.getPeer(task.createdBy);
        
        if (!child || !parent) {
          return res.status(404).json({ error: "Child or parent not found" });
        }

        // Release escrow sats to child balance
        const newBalance = (child.balance || 0) + task.sats;
        await storage.updateBalance(child.id, newBalance);

        // Create virtual withdraw link
        const withdrawLink = `withdraw:${task.id}:${task.sats}:${task.title}`;
        
        // Record escrow release transaction
        await storage.createTransaction({
          fromPeerId: task.createdBy,
          toPeerId: child.id,
          sats: task.sats,
          taskId: task.id,
          type: "escrow_release",
          status: "completed",
          paymentHash: withdrawLink,
        });

        // Update task with withdraw link
        updates.withdrawLink = withdrawLink;
      }

      const updatedTask = await storage.updateTask(id, updates);
      res.json(updatedTask);
    } catch (error) {
      console.error("Update task error:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // Withdraw sats
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

      // Find parent to use their LNBits wallet
      const tasks = await storage.getTasks(child.connectionId || "");
      const parentTask = tasks[0];
      if (!parentTask) {
        return res.status(400).json({ error: "No parent connection found" });
      }

      const parent = await storage.getPeer(parentTask.createdBy);
      if (!parent || !parent.lnbitsUrl || !parent.lnbitsAdminKey) {
        return res.status(500).json({ error: "Parent wallet not configured" });
      }

      // Send Lightning payment
      const lnbits = new LNBitsClient(parent.lnbitsUrl, parent.lnbitsAdminKey);
      let paymentHash: string;
      try {
        paymentHash = await lnbits.payInvoice(paymentRequest);
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

  const httpServer = createServer(app);
  return httpServer;
}
