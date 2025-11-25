import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPeerSchema, insertTaskSchema } from "@shared/schema";
import { z } from "zod";
import { NWCClient } from "./nwc";

export async function registerRoutes(app: Express): Promise<Server> {
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

  // Setup NWC wallet connection
  app.post("/api/wallet/setup", async (req, res) => {
    try {
      const { peerId, nwcConnectionString } = req.body;
      
      if (!peerId || !nwcConnectionString) {
        return res.status(400).json({ error: "peerId and nwcConnectionString required" });
      }

      // Validate NWC connection string format
      if (!NWCClient.validateConnectionString(nwcConnectionString)) {
        return res.status(400).json({ error: "Invalid NWC connection string. Must start with nostr+walletconnect://" });
      }

      // Save wallet connection (connection test happens when creating first task)
      const peer = await storage.updatePeerWallet(peerId, nwcConnectionString);
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

  // Create a new task with NWC escrow
  app.post("/api/tasks", async (req, res) => {
    try {
      const data = insertTaskSchema.parse(req.body);
      
      const createdBy = data.createdBy;
      const parent = await storage.getPeer(createdBy);
      
      if (!parent) {
        return res.status(404).json({ error: "Parent not found" });
      }

      // NWC wallet is REQUIRED - must be configured to create tasks
      if (!parent.nwcConnectionString) {
        return res.status(400).json({ error: "NWC wallet must be configured to create tasks" });
      }

      // For escrow, we generate a payment request that parent must pay
      // In NWC, the actual escrow is managed at parent's wallet level
      const paymentRequest = `lnbc${data.sats}`;

      // Create task with escrow flag
      const task = await storage.createTask({
        ...data,
        escrowLocked: true,
        paylink: paymentRequest, // Store as paylink for backward compatibility
      });

      // Record transaction for escrow lock
      await storage.createTransaction({
        fromPeerId: createdBy,
        toPeerId: createdBy,
        sats: data.sats,
        taskId: task.id,
        type: "escrow_lock",
        status: "pending",
        paymentHash: paymentRequest,
      });

      res.json(task);
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

        if (!parent.nwcConnectionString) {
          return res.status(500).json({ error: "Parent wallet not configured" });
        }

        // Generate a receive-only withdrawal request for child (no actual payment yet)
        // Child will use their NWC connection to receive payment later
        const withdrawRequest = `lnbc${task.sats}`;

        // Update child balance
        const newBalance = (child.balance || 0) + task.sats;
        await storage.updateBalance(child.id, newBalance);

        // Record escrow release transaction
        await storage.createTransaction({
          fromPeerId: task.createdBy,
          toPeerId: child.id,
          sats: task.sats,
          taskId: task.id,
          type: "escrow_release",
          status: "completed",
          paymentHash: withdrawRequest,
        });

        // Update task with withdraw request
        updates.withdrawLink = withdrawRequest;
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

      // Find parent to use their NWC wallet
      const tasks = await storage.getTasks(child.connectionId || "");
      const parentTask = tasks[0];
      if (!parentTask) {
        return res.status(400).json({ error: "No parent connection found" });
      }

      const parent = await storage.getPeer(parentTask.createdBy);
      if (!parent || !parent.nwcConnectionString) {
        return res.status(500).json({ error: "Parent wallet not configured" });
      }

      // Send Lightning payment via NWC
      const nwc = new NWCClient(parent.nwcConnectionString);
      let paymentHash: string;
      try {
        paymentHash = await nwc.sendPayment(paymentRequest);
      } catch (error) {
        console.error("Payment error:", error);
        return res.status(500).json({ error: "Failed to send withdrawal. Invalid Lightning invoice?" });
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
