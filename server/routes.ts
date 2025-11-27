import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPeerSchema, insertTaskSchema, insertFamilyEventSchema, insertEventRsvpSchema, insertChatMessageSchema, peers } from "@shared/schema";
import { z } from "zod";
import { LNBitsClient } from "./lnbits";
import { NWCClient } from "./nwc";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Test LNBits connection - with multiple endpoint attempts
  app.post("/api/wallet/test", async (req, res) => {
    try {
      const { lnbitsUrl, lnbitsAdminKey } = req.body;
      
      if (!lnbitsUrl || !lnbitsAdminKey) {
        return res.status(400).json({ error: "lnbitsUrl and lnbitsAdminKey required" });
      }

      const normalizedUrl = lnbitsUrl.replace(/\/$/, "");
      const attempts = [];

      // Try different endpoints
      const endpoints = [
        `${normalizedUrl}/api/v1/invoices`,
        `${normalizedUrl}/invoices`,
        `${normalizedUrl}/api/v1/wallet`,
        `${normalizedUrl}/wallet`,
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`Testing endpoint: ${endpoint}`);
          const response = await fetch(endpoint, {
            method: endpoint.includes("wallet") ? "GET" : "POST",
            headers: {
              "X-Api-Key": lnbitsAdminKey,
              "Content-Type": "application/json",
            },
            body: endpoint.includes("wallet") ? undefined : JSON.stringify({
              amount: 1,
              memo: "Test invoice",
              out: false,
            }),
          });

          attempts.push({
            endpoint,
            status: response.status,
            ok: response.ok,
            responseText: response.ok ? "OK" : await response.text(),
          });

          if (response.ok) {
            return res.json({ 
              success: true, 
              message: "LNBits verbunden!",
              workingEndpoint: endpoint,
              attempts,
            });
          }
        } catch (e) {
          attempts.push({
            endpoint,
            error: String(e),
          });
        }
      }

      return res.status(400).json({ 
        error: "Keine gültigen LNbits-Endpunkte gefunden. Überprüfe URL und Admin Key.",
        attempts,
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Generate Recovery Code (single code - format: XXXX-XXXX)
  const generateRecoveryCode = (): string => {
    const block1 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const block2 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${block1}-${block2}`;
  };

  // Peer Registration
  app.post("/api/peers/register", async (req, res) => {
    try {
      const { name, role, pin, familyName, joinParentConnectionId, securityQuestion, securityAnswer } = req.body;
      
      if (!name || !role || !pin) {
        return res.status(400).json({ error: "Name, role, and pin required" });
      }

      // For parent: require security question and answer
      if (role === "parent" && (!securityQuestion || !securityAnswer)) {
        return res.status(400).json({ error: "Sicherheitsfrage und Antwort erforderlich" });
      }

      let connectionId = joinParentConnectionId;
      let familyNameToUse = familyName;

      // Wenn Parent einer Familie beitreten möchte
      if (role === "parent" && joinParentConnectionId) {
        // Verifiziere dass die Familie existiert
        const existingParent = await db.select().from(peers)
          .where(and(eq(peers.connectionId, joinParentConnectionId), eq(peers.role, "parent")))
          .limit(1);
        
        if (!existingParent || existingParent.length === 0) {
          return res.status(404).json({ error: "Familie mit dieser ID nicht gefunden" });
        }
        
        // Übernehme Familiennamen vom existierenden Parent
        familyNameToUse = existingParent[0].familyName;
      } else {
        // Neue Familie erstellen
        connectionId = `BTC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      }

      // Hash security answer
      let hashedAnswer: string | undefined;
      if (role === "parent" && securityAnswer) {
        const crypto = await import('crypto');
        hashedAnswer = crypto.createHash('sha256').update(securityAnswer.toLowerCase().trim()).digest('hex');
      }

      const peer = await storage.createPeer({
        name,
        role,
        pin,
        connectionId: connectionId || `BTC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        familyName: role === "parent" ? familyNameToUse : undefined,
        securityQuestion: role === "parent" ? securityQuestion : undefined,
        securityAnswer: role === "parent" ? hashedAnswer : undefined,
      } as any);

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

  // Reset parent PIN using security question
  app.post("/api/peers/reset-pin", async (req, res) => {
    try {
      const { name, role, securityAnswer, newPin } = req.body;

      if (role !== "parent") {
        return res.status(400).json({ error: "PIN Reset nur für Eltern" });
      }

      if (!name || !securityAnswer || !newPin || newPin.length !== 4) {
        return res.status(400).json({ error: "Name, Antwort und 4-stellige PIN erforderlich" });
      }

      // Validate and reset PIN
      const updated = await storage.resetPinWithSecurityAnswer(name, securityAnswer, newPin);
      res.json({ success: true, message: "PIN erfolgreich zurückgesetzt", peer: updated });
    } catch (error) {
      console.error("PIN Reset error:", error);
      const message = (error as Error).message;
      res.status(400).json({ error: message || "PIN Reset fehlgeschlagen" });
    }
  });

  // Get security question for parent
  app.get("/api/peers/:name/security-question", async (req, res) => {
    try {
      const peer = await storage.getPeerByName(req.params.name);
      if (!peer || peer.role !== "parent") {
        return res.status(404).json({ error: "Elternteil nicht gefunden" });
      }
      res.json({ securityQuestion: peer.securityQuestion });
    } catch (error) {
      res.status(500).json({ error: "Fehler beim Abrufen der Sicherheitsfrage" });
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

  // Delete LNbits wallet connection
  app.delete("/api/wallet/lnbits", async (req, res) => {
    try {
      const { peerId } = req.body;
      
      if (!peerId) {
        return res.status(400).json({ error: "peerId erforderlich" });
      }

      const peer = await storage.updatePeerWallet(peerId, "", "");
      console.log("LNbits wallet deleted successfully for peer:", peerId);
      res.json({ success: true, peer });
    } catch (error) {
      console.error("LNbits wallet delete error:", error);
      res.status(500).json({ error: "Fehler beim Löschen der Wallet-Verbindung" });
    }
  });

  // Setup LNbits wallet for Parent
  app.post("/api/wallet/setup-lnbits", async (req, res) => {
    try {
      const { peerId, lnbitsUrl, lnbitsAdminKey } = req.body;
      
      if (!peerId || !lnbitsUrl || !lnbitsAdminKey) {
        return res.status(400).json({ error: "peerId, lnbitsUrl, and lnbitsAdminKey erforderlich" });
      }

      // Validate URL format
      if (!lnbitsUrl.startsWith("http://") && !lnbitsUrl.startsWith("https://")) {
        return res.status(400).json({ error: "LNbits URL muss mit http:// oder https:// beginnen" });
      }

      // Normalize URL (remove trailing slash)
      const normalizedUrl = lnbitsUrl.replace(/\/$/, "");

      // Test LNbits connection by checking wallet endpoint
      try {
        console.log("Testing LNbits wallet connection with URL:", normalizedUrl);
        
        // Try multiple endpoints to check wallet
        const walletEndpoints = [
          `${normalizedUrl}/api/v1/wallet`,
          `${normalizedUrl}/wallet`,
        ];
        
        let walletConnected = false;
        
        for (const endpoint of walletEndpoints) {
          try {
            const response = await fetch(endpoint, {
              headers: {
                "X-Api-Key": lnbitsAdminKey,
              },
            });
            
            if (response.ok) {
              console.log("LNbits wallet connection successful with endpoint:", endpoint);
              walletConnected = true;
              break;
            }
          } catch (e) {
            // Try next endpoint
          }
        }
        
        if (!walletConnected) {
          return res.status(400).json({ 
            error: "Wallet nicht erreichbar. Überprüfe URL und Admin API Key." 
          });
        }
      } catch (error) {
        console.error("LNbits wallet test failed:", error);
        return res.status(400).json({ error: `LNbits Fehler: ${(error as Error).message}` });
      }

      // Save LNbits credentials
      const peer = await storage.updatePeerWallet(peerId, normalizedUrl, lnbitsAdminKey);
      console.log("LNbits wallet saved successfully for peer:", peerId);
      res.json(peer);
    } catch (error) {
      console.error("LNbits wallet setup error:", error);
      res.status(500).json({ error: "Wallet-Setup fehlgeschlagen: " + (error as Error).message });
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

  // Unlink child from parent
  app.post("/api/peers/unlink", async (req, res) => {
    try {
      const { childId } = req.body;
      
      if (!childId) {
        return res.status(400).json({ error: "childId required" });
      }

      const updatedChild = await storage.unlinkChildFromParent(childId);
      res.json(updatedChild);
    } catch (error) {
      console.error("Unlink error:", error);
      res.status(500).json({ error: "Failed to unlink child from parent" });
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

  // Get leaderboard for a family
  app.get("/api/leaderboard/:connectionId", async (req, res) => {
    try {
      const { connectionId } = req.params;
      const leaderboard = await storage.getLeaderboard(connectionId);
      res.json(leaderboard);
    } catch (error) {
      console.error("Leaderboard error:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // Get sats spent by parent
  app.get("/api/parent/:peerId/sats-spent/:connectionId", async (req, res) => {
    try {
      const { peerId, connectionId } = req.params;
      const satsSpent = await storage.getSatsSpentByParent(parseInt(peerId), connectionId);
      res.json({ satsSpent });
    } catch (error) {
      console.error("Sats spent error:", error);
      res.status(500).json({ error: "Failed to fetch sats spent" });
    }
  });

  // Get parent wallet balance from LNbits
  app.get("/api/parent/:peerId/wallet-balance", async (req, res) => {
    try {
      const { peerId } = req.params;
      const parent = await storage.getPeer(parseInt(peerId));
      
      if (!parent) {
        return res.status(404).json({ error: "Parent not found" });
      }

      if (!parent.lnbitsUrl || !parent.lnbitsAdminKey) {
        return res.json({ walletBalance: null, message: "Wallet not configured" });
      }

      try {
        const lnbits = new LNBitsClient(parent.lnbitsUrl, parent.lnbitsAdminKey);
        const balance = await lnbits.getBalance();
        res.json({ walletBalance: balance });
      } catch (error) {
        console.warn("LNbits wallet balance fetch failed:", error);
        res.json({ walletBalance: null, message: "Failed to fetch wallet balance" });
      }
    } catch (error) {
      console.error("Wallet balance error:", error);
      res.status(500).json({ error: "Failed to fetch wallet balance" });
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

      // If approving, send sats to child's lightning address if wallet is configured
      if (updates.status === "approved" && task.status !== "approved") {
        const child = await storage.getPeer(task.assignedTo!);
        const parent = await storage.getPeer(task.createdBy);
        
        if (!child || !parent) {
          return res.status(404).json({ error: "Child or parent not found" });
        }

        // Update child's balance IMMEDIATELY
        const newBalance = (child.balance || 0) + task.sats;
        await storage.updateBalance(child.id, newBalance);

        let paymentHash = "";

        // Try to send payment if both wallet and lightning address are configured
        if (child.lightningAddress && parent.lnbitsUrl && parent.lnbitsAdminKey) {
          try {
            const parentLnbits = new LNBitsClient(parent.lnbitsUrl, parent.lnbitsAdminKey);
            paymentHash = await parentLnbits.payToLightningAddress(
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
            console.warn("Payment sending warning (but approval continues):", error);
          }
        } else if (!child.lightningAddress) {
          console.warn(`Child ${child.name} has no lightning address configured`);
        }
      }

      const updatedTask = await storage.updateTask(id, updates);
      res.json(updatedTask);
    } catch (error) {
      console.error("Update task error:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // Parent: Reset child PIN
  app.post("/api/peers/:childId/reset-pin", async (req, res) => {
    try {
      const { childId } = req.params;
      const { parentId, newPin } = req.body;

      if (!parentId || !newPin || newPin.length !== 4 || !/^\d+$/.test(newPin)) {
        return res.status(400).json({ error: "Valid 4-digit PIN required" });
      }

      const child = await storage.getPeer(parseInt(childId));
      if (!child || child.role !== "child") {
        return res.status(404).json({ error: "Child not found" });
      }

      const parent = await storage.getPeer(parentId);
      if (!parent || parent.role !== "parent") {
        return res.status(403).json({ error: "Only parents can reset child PINs" });
      }

      // Verify parent is in same family
      if (child.connectionId !== parent.connectionId) {
        return res.status(403).json({ error: "Parent and child must be in same family" });
      }

      const updatedChild = await storage.updatePeerPin(parseInt(childId), newPin);
      res.json({ success: true, child: updatedChild });
    } catch (error) {
      console.error("Reset PIN error:", error);
      res.status(500).json({ error: "Failed to reset PIN" });
    }
  });

  // Upload proof photo for task
  app.post("/api/tasks/:id/proof", async (req, res) => {
    try {
      const { id } = req.params;
      const { proof } = req.body;
      
      if (!proof) {
        return res.status(400).json({ error: "Proof image required" });
      }

      const taskId = parseInt(id);
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Update task with proof and set status to submitted
      const updatedTask = await storage.updateTask(taskId, {
        proof: proof,
        status: "submitted"
      });

      res.json({ success: true, proof: updatedTask?.proof });
    } catch (error) {
      console.error("Upload proof error:", error);
      res.status(500).json({ error: "Failed to upload proof" });
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

  // Get RSVPs for an event
  app.get("/api/events/:id/rsvps", async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const rsvps = await storage.getRsvpsByEvent(eventId);
      
      // Enrich with child names
      const enrichedRsvps = await Promise.all(rsvps.map(async (rsvp) => {
        const child = await storage.getPeer(rsvp.peerId);
        return {
          ...rsvp,
          childName: child?.name || "Unknown",
        };
      }));
      
      res.json(enrichedRsvps);
    } catch (error) {
      console.error("Get RSVPs error:", error);
      res.status(500).json({ error: "Failed to fetch RSVPs" });
    }
  });

  // Submit RSVP (child accepts/declines event)
  app.post("/api/events/:id/rsvps", async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const { peerId, response } = req.body;

      if (!peerId || !response || !["accepted", "declined"].includes(response)) {
        return res.status(400).json({ error: "peerId and response (accepted/declined) required" });
      }

      const rsvp = await storage.createOrUpdateRsvp(peerId, eventId, response);
      res.json(rsvp);
    } catch (error) {
      console.error("Create RSVP error:", error);
      res.status(500).json({ error: "Failed to submit RSVP" });
    }
  });

  // Get Chat Messages
  app.get("/api/chat/:connectionId", async (req, res) => {
    try {
      const messages = await storage.getChatMessages(req.params.connectionId);
      res.json(messages);
    } catch (error) {
      console.error("Get chat error:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Send Chat Message
  app.post("/api/chat", async (req, res) => {
    try {
      const { connectionId, fromPeerId, message } = req.body;
      
      if (!connectionId || !fromPeerId || !message) {
        return res.status(400).json({ error: "connectionId, fromPeerId, and message required" });
      }

      const newMessage = await storage.createChatMessage({
        connectionId,
        fromPeerId,
        message,
      });
      res.json(newMessage);
    } catch (error) {
      console.error("Send chat error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
