import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPeerSchema, insertTaskSchema, insertFamilyEventSchema, insertEventRsvpSchema, insertChatMessageSchema, peers } from "@shared/schema";
import { z } from "zod";
import { LNBitsClient } from "./lnbits";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import cron from "node-cron";

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

  // Verify for PIN reset
  app.post("/api/peers/verify-reset", async (req, res) => {
    try {
      const { name, favoriteColor, role } = req.body;
      
      if (!name || !favoriteColor || !role) {
        return res.status(400).json({ error: "Name, favoriteColor und role erforderlich" });
      }

      const peer = await db.select().from(peers)
        .where(and(eq(peers.name, name), eq(peers.role, role)))
        .limit(1);
      
      if (!peer || peer.length === 0) {
        return res.status(404).json({ error: "Name nicht gefunden" });
      }

      if (peer[0].favoriteColor?.toLowerCase() !== favoriteColor.toLowerCase()) {
        return res.status(400).json({ error: "Lieblingsfarbe ist falsch" });
      }

      res.json({ id: peer[0].id, pin: peer[0].pin });
    } catch (error) {
      console.error("Verify reset error:", error);
      res.status(500).json({ error: "Verifizierung fehlgeschlagen" });
    }
  });

  // Peer Registration
  app.post("/api/peers/register", async (req, res) => {
    try {
      const { name, role, pin, familyName, joinParentConnectionId, favoriteColor } = req.body;
      
      if (!name || !role || !pin) {
        return res.status(400).json({ error: "Name, role, and pin required" });
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

      const peer = await storage.createPeer({
        name,
        role,
        pin,
        connectionId: connectionId || `BTC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        familyName: role === "parent" ? familyNameToUse : undefined,
        favoriteColor: role === "parent" ? favoriteColor : undefined,
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

  // Change parent's own PIN
  app.post("/api/peers/:peerId/change-pin", async (req, res) => {
    try {
      const { peerId } = req.params;
      const { oldPin, newPin } = req.body;

      if (!oldPin || !newPin || newPin.length !== 4 || !/^\d+$/.test(newPin)) {
        return res.status(400).json({ error: "Alte PIN und neue 4-stellige PIN erforderlich" });
      }

      // Verify old PIN
      const peer = await storage.getPeer(parseInt(peerId));
      if (!peer) {
        return res.status(404).json({ error: "Elternteil nicht gefunden" });
      }

      if (peer.pin !== oldPin) {
        return res.status(400).json({ error: "Alte PIN ist falsch" });
      }

      // Update PIN
      const updated = await storage.updatePeerPin(parseInt(peerId), newPin);
      res.json({ success: true, message: "PIN erfolgreich geändert", peer: updated });
    } catch (error) {
      console.error("PIN change error:", error);
      res.status(500).json({ error: "PIN-Änderung fehlgeschlagen" });
    }
  });

  // Update family name
  app.post("/api/peers/:peerId/family-name", async (req, res) => {
    try {
      const { peerId } = req.params;
      const { familyName } = req.body;

      if (!familyName || !familyName.trim()) {
        return res.status(400).json({ error: "Familienname erforderlich" });
      }

      const peer = await storage.getPeer(parseInt(peerId));
      if (!peer) {
        return res.status(404).json({ error: "Benutzer nicht gefunden" });
      }

      // If parent, update all connected children too
      if (peer.role === "parent") {
        const connectionId = peer.connectionId;
        const peers_result = await db.select().from(peers).where(eq(peers.connectionId, connectionId));
        for (const child of peers_result) {
          if (child.role === "child") {
            await storage.updatePeerFamilyName(child.id, familyName.trim());
          }
        }
      }

      const updated = await storage.updatePeerFamilyName(parseInt(peerId), familyName.trim());
      res.json({ success: true, peer: updated });
    } catch (error) {
      console.error("Family name update error:", error);
      res.status(500).json({ error: "Familienname-Update fehlgeschlagen" });
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

  // Get spending breakdown by child
  app.get("/api/parent/:parentId/spending-by-child/:connectionId", async (req, res) => {
    try {
      const { parentId, connectionId } = req.params;
      const spending = await storage.getSatsSpentByChild(parseInt(parentId), connectionId);
      res.json(spending);
    } catch (error) {
      console.error("Spending breakdown error:", error);
      res.status(500).json({ error: "Failed to fetch spending breakdown" });
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

  // Get parent wallet balances (LNbits only)
  app.get("/api/parent/:peerId/wallet-balance", async (req, res) => {
    try {
      const { peerId } = req.params;
      const parent = await storage.getPeer(parseInt(peerId));
      
      if (!parent) {
        return res.status(404).json({ error: "Parent not found" });
      }

      let lnbitsBalance = null;

      // Try to get LNbits balance
      if (parent.lnbitsUrl && parent.lnbitsAdminKey) {
        try {
          const lnbits = new LNBitsClient(parent.lnbitsUrl, parent.lnbitsAdminKey);
          lnbitsBalance = await lnbits.getBalance();
        } catch (error) {
          console.warn("LNbits balance fetch failed:", error);
        }
      }

      res.json({ lnbitsBalance });
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

      // LNbits must be configured
      if (!parent.lnbitsUrl || !parent.lnbitsAdminKey) {
        return res.status(400).json({ 
          error: "LNbits ist nicht konfiguriert. Bitte verbinde dein LNbits-Konto in den Einstellungen." 
        });
      }

      // Try to validate and create escrow invoice, but allow task creation without it
      try {
        const lnbits = new LNBitsClient(parent.lnbitsUrl, parent.lnbitsAdminKey);
        const balance = await lnbits.getBalance();
        
        if (balance < data.sats) {
          return res.status(400).json({ 
            error: `Unzureichende Balance. Benötigt: ${data.sats} Sats, verfügbar: ${balance} Sats` 
          });
        }

        // Try to create escrow invoice if balance is sufficient
        try {
          invoice = await lnbits.createPaylink(data.sats, `Task: ${data.title}`);
          escrowLocked = true;
        } catch (paylinksError) {
          console.log("Paylinks failed, trying Invoice API:", paylinksError);
          try {
            // Fallback to Invoice API if Paylinks fails
            const invoiceData = await lnbits.createInvoice(data.sats, `Task: ${data.title}`);
            invoice = invoiceData.payment_request || invoiceData.payment_hash;
            escrowLocked = true;
          } catch (invoiceError) {
            // Invoice also failed - allow task creation anyway without escrow
            console.warn("Both Paylinks and Invoice APIs failed, creating task without escrow:", invoiceError);
            escrowLocked = false;
          }
        }
      } catch (error) {
        if ((error as any).message?.includes("Unzureichende") || (error as any).message?.includes("nicht konfiguriert")) {
          throw error;
        }
        console.warn("LNbits balance check failed:", error);
        // Don't fail - let task creation proceed
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
      } else if ((error as any).message?.includes("Unzureichende")) {
        res.status(400).json({ error: (error as Error).message });
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
        console.log(`[Task Approval] Approving task ${id}, assigning sats to child ${task.assignedTo}`);
        const child = await storage.getPeer(task.assignedTo!);
        const parent = await storage.getPeer(task.createdBy);
        
        if (!child || !parent) {
          return res.status(404).json({ error: "Child or parent not found" });
        }

        // Update child's balance IMMEDIATELY
        const newBalance = (child.balance || 0) + task.sats;
        console.log(`[Task Approval] New balance for ${child.name}: ${newBalance} sats (was ${child.balance}, +${task.sats})`);
        await storage.updateBalance(child.id, newBalance);

        // Create a new Bitcoin snapshot when child receives sats
        try {
          console.log(`[Task Approval] About to create snapshot for ${child.name}...`);
          const btcPrice = await getFreshBitcoinPrice();
          const valueEur = (newBalance / 1e8) * btcPrice.eur;
          console.log(`[Task Approval] Creating snapshot: ${newBalance} sats × €${btcPrice.eur} = €${valueEur.toFixed(2)}`);
          await storage.createDailyBitcoinSnapshot({
            peerId: child.id,
            connectionId: child.connectionId,
            valueEur: Math.round(valueEur * 100), // Convert to cents
            satoshiAmount: newBalance
          });
          console.log(`[Task Approval Snapshot] ✓ Created for ${child.name}: €${valueEur.toFixed(2)}`);
        } catch (snapshotError) {
          console.error("[Task Approval Snapshot] ✗ Failed:", snapshotError);
        }

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

  // Get Allowances for family
  app.get("/api/allowances/:connectionId", async (req, res) => {
    try {
      const allowances = await storage.getAllowances(req.params.connectionId);
      res.json(allowances);
    } catch (error) {
      console.error("Get allowances error:", error);
      res.status(500).json({ error: "Failed to fetch allowances" });
    }
  });

  // Create Allowance
  app.post("/api/allowances", async (req, res) => {
    try {
      const { parentId, childId, connectionId, sats, frequency } = req.body;
      
      if (!parentId || !childId || !connectionId || !sats || !frequency) {
        return res.status(400).json({ error: "parentId, childId, connectionId, sats, frequency required" });
      }

      if (!["daily", "weekly", "biweekly", "monthly"].includes(frequency)) {
        return res.status(400).json({ error: "frequency must be: daily, weekly, biweekly, or monthly" });
      }

      const allowance = await storage.createAllowance({
        parentId,
        childId,
        connectionId,
        sats,
        frequency,
        isActive: true,
      } as any);
      res.json(allowance);
    } catch (error) {
      console.error("Create allowance error:", error);
      res.status(500).json({ error: "Failed to create allowance" });
    }
  });

  // Update Allowance
  app.post("/api/allowances/:id", async (req, res) => {
    try {
      const allowanceId = parseInt(req.params.id);
      const { sats, frequency, isActive } = req.body;

      const allowance = await storage.updateAllowance(allowanceId, {
        sats,
        frequency,
        isActive,
      } as any);
      
      if (!allowance) {
        return res.status(404).json({ error: "Allowance not found" });
      }
      res.json(allowance);
    } catch (error) {
      console.error("Update allowance error:", error);
      res.status(500).json({ error: "Failed to update allowance" });
    }
  });

  // Delete Allowance
  app.delete("/api/allowances/:id", async (req, res) => {
    try {
      const allowanceId = parseInt(req.params.id);
      const success = await storage.deleteAllowance(allowanceId);
      
      if (!success) {
        return res.status(404).json({ error: "Allowance not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete allowance error:", error);
      res.status(500).json({ error: "Failed to delete allowance" });
    }
  });

  // Get all children for a parent
  app.get("/api/parent/:id/children", async (req, res) => {
    try {
      const parentId = parseInt(req.params.id);
      const children = await storage.getChildrenForParent(parentId);
      res.json(children);
    } catch (error) {
      console.error("Get children error:", error);
      res.status(500).json({ error: "Failed to fetch children" });
    }
  });

  // Get children with active allowances
  app.get("/api/parent/:id/children-with-allowances/:connectionId", async (req, res) => {
    try {
      const parentId = parseInt(req.params.id);
      const connectionId = req.params.connectionId;
      
      const children = await storage.getChildrenWithAllowances(parentId, connectionId);
      res.json(children);
    } catch (error) {
      console.error("Get children with allowances error:", error);
      res.status(500).json({ error: "Failed to fetch children with allowances" });
    }
  });

  // Payout allowance to child
  app.post("/api/parent/:id/payout-allowance", async (req, res) => {
    try {
      const parentId = parseInt(req.params.id);
      const { allowanceId, childId, sats, paymentMethod } = req.body;

      if (!allowanceId || !childId || !sats) {
        return res.status(400).json({ error: "allowanceId, childId, sats required" });
      }

      const parent = await storage.getPeer(parentId);
      if (!parent || (!parent.lnbitsUrl && !parent.nwcConnectionString)) {
        return res.status(400).json({ error: "Parent has no payment method configured (LNbits or NWC)" });
      }

      const child = await storage.getPeer(childId);
      if (!child || !child.lightningAddress) {
        return res.status(400).json({ error: "Child Lightning address not set" });
      }

      let paymentHash: string;

      // Use selected payment method if specified
      if (paymentMethod === "nwc" && parent.nwcConnectionString) {
        console.log("[Payout] Using NWC for allowance payment");
        const nwc = new NWCClient(parent.nwcConnectionString);
        paymentHash = await nwc.payToLightningAddress(sats, child.lightningAddress, `Taschengeld für ${child.name}`);
      } else if (paymentMethod === "lnbits" && parent.lnbitsUrl && parent.lnbitsAdminKey) {
        console.log("[Payout] Using LNbits for allowance payment");
        const lnbits = new LNBitsClient(parent.lnbitsUrl, parent.lnbitsAdminKey);
        paymentHash = await lnbits.payToLightningAddress(sats, child.lightningAddress, `Taschengeld für ${child.name}`);
      } else if (parent.lnbitsUrl && parent.lnbitsAdminKey) {
        console.log("[Payout] Fallback: Using LNbits for allowance payment");
        const lnbits = new LNBitsClient(parent.lnbitsUrl, parent.lnbitsAdminKey);
        paymentHash = await lnbits.payToLightningAddress(sats, child.lightningAddress, `Taschengeld für ${child.name}`);
      } else if (parent.nwcConnectionString) {
        console.log("[Payout] Fallback: Using NWC for allowance payment");
        const nwc = new NWCClient(parent.nwcConnectionString);
        paymentHash = await nwc.payToLightningAddress(sats, child.lightningAddress, `Taschengeld für ${child.name}`);
      } else {
        throw new Error("No valid payment method available");
      }
      
      // Update allowance lastPaidDate
      await storage.updateAllowance(allowanceId, { lastPaidDate: new Date() });

      res.json({ success: true, paymentHash });
    } catch (error) {
      console.error("Payout allowance error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Instant payout to child
  app.post("/api/parent/:id/payout-instant", async (req, res) => {
    try {
      const parentId = parseInt(req.params.id);
      const { childId, sats, message, paymentMethod } = req.body;

      if (!childId || !sats) {
        return res.status(400).json({ error: "childId and sats required" });
      }

      const parent = await storage.getPeer(parentId);
      if (!parent || (!parent.lnbitsUrl && !parent.nwcConnectionString)) {
        return res.status(400).json({ error: "Parent has no payment method configured (LNbits or NWC)" });
      }

      const child = await storage.getPeer(childId);
      if (!child || !child.lightningAddress) {
        return res.status(400).json({ error: "Child Lightning address not set" });
      }

      const memo = message || `Sofortzahlung für ${child.name}`;
      let paymentHash: string;

      // Use selected payment method if specified
      if (paymentMethod === "nwc" && parent.nwcConnectionString) {
        console.log("[Payout] Using NWC for instant payment");
        const nwc = new NWCClient(parent.nwcConnectionString);
        paymentHash = await nwc.payToLightningAddress(sats, child.lightningAddress, memo);
      } else if (paymentMethod === "lnbits" && parent.lnbitsUrl && parent.lnbitsAdminKey) {
        console.log("[Payout] Using LNbits for instant payment");
        const lnbits = new LNBitsClient(parent.lnbitsUrl, parent.lnbitsAdminKey);
        paymentHash = await lnbits.payToLightningAddress(sats, child.lightningAddress, memo);
      } else if (parent.lnbitsUrl && parent.lnbitsAdminKey) {
        console.log("[Payout] Fallback: Using LNbits for instant payment");
        const lnbits = new LNBitsClient(parent.lnbitsUrl, parent.lnbitsAdminKey);
        paymentHash = await lnbits.payToLightningAddress(sats, child.lightningAddress, memo);
      } else if (parent.nwcConnectionString) {
        console.log("[Payout] Fallback: Using NWC for instant payment");
        const nwc = new NWCClient(parent.nwcConnectionString);
        paymentHash = await nwc.payToLightningAddress(sats, child.lightningAddress, memo);
      } else {
        throw new Error("No valid payment method available");
      }

      // Update child's balance
      const newBalance = (child.balance || 0) + sats;
      await storage.updateBalance(child.id, newBalance);

      // Create Bitcoin snapshot for new balance with FRESH price
      try {
        console.log(`[Instant Payout] About to create snapshot for ${child.name}...`);
        const btcPrice = await getFreshBitcoinPrice();
        const valueEur = (newBalance / 1e8) * btcPrice.eur;
        console.log(`[Instant Payout] Creating snapshot: ${newBalance} sats × €${btcPrice.eur} = €${valueEur.toFixed(2)}`);
        await storage.createDailyBitcoinSnapshot({
          peerId: child.id,
          connectionId: child.connectionId,
          valueEur: Math.round(valueEur * 100),
          satoshiAmount: newBalance
        });
        console.log(`[Instant Payout Snapshot] ✓ Created for ${child.name}: €${valueEur.toFixed(2)}`);
      } catch (snapshotError) {
        console.error(`[Instant Payout Snapshot] ✗ Failed for ${child.name}:`, snapshotError);
      }

      res.json({ success: true, paymentHash });
    } catch (error) {
      console.error("Instant payout error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Helper function to get FRESH Bitcoin price (always fetch, never cache for snapshots)
  async function getFreshBitcoinPrice(): Promise<{ eur: number }> {
    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur"
      );
      if (response.ok) {
        const data = await response.json();
        if (data?.bitcoin?.eur) {
          console.log(`[getFreshBitcoinPrice] Fresh price: €${data.bitcoin.eur}`);
          return { eur: data.bitcoin.eur };
        }
      }
    } catch (e) {
      console.warn("[getFreshBitcoinPrice] Failed to fetch:", e);
    }
    // Fallback to lastKnownPrice or default
    if (lastKnownPrice) {
      console.log(`[getFreshBitcoinPrice] Using cached price: €${lastKnownPrice.eur}`);
      return { eur: lastKnownPrice.eur };
    }
    console.log(`[getFreshBitcoinPrice] Using default price: €79000`);
    return { eur: 79000 };
  }

  // Helper function to check if payout is due
  function isPayoutDue(lastPaidDate: Date | null, frequency: string): boolean {
    if (!lastPaidDate) return true; // First time, always due
    
    const now = new Date();
    const lastPaid = new Date(lastPaidDate);
    const diffMs = now.getTime() - lastPaid.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    switch (frequency) {
      case "daily":
        return diffDays >= 1;
      case "weekly":
        return diffDays >= 7;
      case "biweekly":
        return diffDays >= 14;
      case "monthly":
        return diffDays >= 30;
      default:
        return false;
    }
  }

  // Helper function to process a single allowance payout
  async function processAllowancePayout(allowance: any) {
    try {
      const parent = await storage.getPeer(allowance.parentId);
      const child = await storage.getPeer(allowance.childId);

      if (!parent || !parent.lnbitsUrl || !parent.lnbitsAdminKey) {
        console.error(`Parent ${allowance.parentId} not configured with LNBits`);
        return;
      }

      if (!child || !child.lightningAddress) {
        console.error(`Child ${allowance.childId} has no Lightning address`);
        return;
      }

      const lnbits = new LNBitsClient(parent.lnbitsUrl, parent.lnbitsAdminKey);
      const paymentHash = await lnbits.payToLightningAddress(
        allowance.sats,
        child.lightningAddress,
        `Automatisches Taschengeld für ${child.name}`
      );

      // Update child's balance
      const newBalance = (child.balance || 0) + allowance.sats;
      await storage.updateBalance(child.id, newBalance);

      // Create Bitcoin snapshot for new balance with FRESH price
      try {
        console.log(`[Allowance] About to create snapshot for ${child.name}...`);
        const btcPrice = await getFreshBitcoinPrice();
        const valueEur = (newBalance / 1e8) * btcPrice.eur;
        console.log(`[Allowance] Creating snapshot: ${newBalance} sats × €${btcPrice.eur} = €${valueEur.toFixed(2)}`);
        await storage.createDailyBitcoinSnapshot({
          peerId: child.id,
          connectionId: child.connectionId,
          valueEur: Math.round(valueEur * 100),
          satoshiAmount: newBalance
        });
        console.log(`[Allowance Snapshot] ✓ Created for ${child.name}: €${valueEur.toFixed(2)}`);
      } catch (snapshotError) {
        console.error(`[Allowance Snapshot] ✗ Failed for ${child.name}:`, snapshotError);
      }

      // Update allowance lastPaidDate
      await storage.updateAllowance(allowance.id, { lastPaidDate: new Date() });
      console.log(`[Allowance Scheduler] Paid ${allowance.sats} sats to ${child.name} (${paymentHash})`);
    } catch (error) {
      console.error(`[Allowance Scheduler] Error processing allowance ${allowance.id}:`, error);
    }
  }

  // Simple in-memory cache for API responses (30 min TTL)
  const cache: { [key: string]: { data: any; expires: number } } = {};
  let lastKnownPrice: { usd: number; eur: number } | null = null;
  
  const getCached = (key: string) => {
    const item = cache[key];
    if (!item || Date.now() > item.expires) {
      delete cache[key];
      return null;
    }
    return item.data;
  };
  
  const setCached = (key: string, data: any, ttlMs = 1800000) => {
    cache[key] = { data, expires: Date.now() + ttlMs };
  };

  // Get current BTC price
  app.get("/api/btc-price", async (req, res) => {
    try {
      const cacheKey = "btc-price";
      const cached = getCached(cacheKey);
      if (cached) {
        console.log("[BTC Price] Returning cached data");
        return res.json(cached);
      }

      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,eur"
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log("[BTC Price] Data:", JSON.stringify(data).substring(0, 100));
        
        if (data?.bitcoin?.usd && data?.bitcoin?.eur) {
          const responseData = {
            usd: data.bitcoin.usd,
            eur: data.bitcoin.eur,
            timestamp: new Date().toISOString()
          };
          lastKnownPrice = { usd: data.bitcoin.usd, eur: data.bitcoin.eur };
          setCached(cacheKey, responseData, 1800000); // 30 min cache
          return res.json(responseData);
        }
      }
      
      // Fallback: use last known price or default
      if (lastKnownPrice) {
        console.log("[BTC Price] Using last known price");
        return res.json({
          usd: lastKnownPrice.usd,
          eur: lastKnownPrice.eur,
          timestamp: new Date().toISOString()
        });
      }
      
      // Final fallback: return reasonable default
      console.log("[BTC Price] Using default fallback price");
      res.json({
        usd: 91000,
        eur: 79000,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("[BTC Price Error]:", error);
      // Still return something so app doesn't break
      if (lastKnownPrice) {
        return res.json({
          usd: lastKnownPrice.usd,
          eur: lastKnownPrice.eur,
          timestamp: new Date().toISOString()
        });
      }
      res.json({
        usd: 91000,
        eur: 79000,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Get historical BTC prices for comparison charts
  app.get("/api/btc-history", async (req, res) => {
    try {
      const days = req.query.days || "30";
      const cacheKey = `btc-history-${days}`;
      const cached = getCached(cacheKey);
      if (cached && cached.length > 0) {
        console.log(`[BTC History] Returning cached data for ${days} days (${cached.length} points)`);
        return res.json(cached);
      }

      console.log(`[BTC History] Fetching data for ${days} days (no valid cache)`);
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=eur&days=${days}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      
      if (!response.ok) {
        console.log(`[BTC History] API returned ${response.status}, serving old cache only`);
        // Only return old cache if it has data
        const oldCache = cache[cacheKey];
        if (oldCache && Array.isArray(oldCache.data) && oldCache.data.length > 0) {
          return res.json(oldCache.data);
        }
        // Don't cache empty arrays! Just return empty
        return res.status(500).json({ error: "Unable to fetch data" });
      }
      
      const data = await response.json();
      console.log("[BTC History] Got data with keys:", Object.keys(data), "prices length:", data?.prices?.length);
      
      if (data?.prices && Array.isArray(data.prices) && data.prices.length > 0) {
        const chartData = data.prices.map((price: [number, number]) => ({
          date: new Date(price[0]).toLocaleDateString("de-DE", { month: "short", day: "numeric" }),
          timestamp: price[0],
          price: Math.round(price[1] * 100) / 100
        }));
        
        setCached(cacheKey, chartData, 1800000); // 30 min cache
        console.log(`[BTC History] Cached ${chartData.length} data points`);
        return res.json(chartData);
      }
      console.log("[BTC History] Invalid data structure, not caching");
      res.status(500).json({ error: "Invalid data from API" });
    } catch (error) {
      console.error("[BTC History Error]:", error);
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  // Get daily Bitcoin snapshots for a child
  app.get("/api/bitcoin-snapshots/:peerId", async (req, res) => {
    try {
      const peerId = parseInt(req.params.peerId);
      const snapshots = await storage.getDailyBitcoinSnapshots(peerId);
      res.json(snapshots.map(s => ({
        date: new Date(s.createdAt).toLocaleDateString("de-DE", { month: "short", day: "numeric" }),
        timestamp: s.createdAt,
        value: s.valueEur / 100 // Convert from cents to euros
      })));
    } catch (error) {
      console.error("[Bitcoin Snapshots Error]:", error);
      res.status(500).json({ error: "Failed to fetch snapshots" });
    }
  });

  // Create new daily Bitcoin snapshot
  app.post("/api/bitcoin-snapshots", async (req, res) => {
    try {
      const { peerId, connectionId, valueEur, satoshiAmount } = req.body;
      
      if (!peerId || !connectionId || valueEur === undefined || !satoshiAmount) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const snapshot = await storage.createDailyBitcoinSnapshot({
        peerId,
        connectionId,
        valueEur: Math.round(valueEur * 100), // Convert to cents
        satoshiAmount
      });

      res.json(snapshot);
    } catch (error) {
      console.error("[Create Bitcoin Snapshot Error]:", error);
      res.status(500).json({ error: "Failed to create snapshot" });
    }
  });

  // Get monthly savings snapshots for a child
  app.get("/api/savings-snapshots/:peerId", async (req, res) => {
    try {
      const peerId = parseInt(req.params.peerId);
      const snapshots = await storage.getMonthlySavingsSnapshots(peerId);
      const formattedSnapshots = snapshots.map(s => ({
        date: new Date(s.createdAt).toLocaleDateString("de-DE", { month: "short", day: "numeric" }),
        timestamp: s.createdAt,
        value: s.valueEur / 100, // Convert from cents to euros
        interestEarned: s.interestEarned / 100
      }));
      console.log(`[Savings Snapshots] Fetched ${formattedSnapshots.length} snapshots for child ${peerId}`);
      res.json(formattedSnapshots);
    } catch (error) {
      console.error("[Savings Snapshots Error]:", error);
      res.status(500).json({ error: "Failed to fetch snapshots" });
    }
  });

  // Create new monthly savings snapshot
  app.post("/api/savings-snapshots", async (req, res) => {
    try {
      const { peerId, connectionId, valueEur, satoshiAmount, interestEarned } = req.body;
      
      if (!peerId || !connectionId || valueEur === undefined || !satoshiAmount) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const snapshot = await storage.createMonthlySavingsSnapshot({
        peerId,
        connectionId,
        valueEur: Math.round(valueEur * 100), // Convert to cents
        satoshiAmount,
        interestEarned: Math.round((interestEarned || 0) * 100)
      });

      res.json(snapshot);
    } catch (error) {
      console.error("[Create Savings Snapshot Error]:", error);
      res.status(500).json({ error: "Failed to create snapshot" });
    }
  });

  // Start automatic allowance payout scheduler (runs every minute)
  cron.schedule("* * * * *", async () => {
    try {
      // Get all active allowances
      const allPeers = await db.select().from(peers);
      const connectionIds = [...new Set(allPeers.map((p: any) => p.connectionId))];

      for (const connectionId of connectionIds) {
        const allowances = await storage.getAllowances(connectionId);
        
        for (const allowance of allowances) {
          if (!allowance.isActive) continue;

          if (isPayoutDue(allowance.lastPaidDate, allowance.frequency)) {
            console.log(`[Allowance Scheduler] Processing payout for allowance ${allowance.id}`);
            await processAllowancePayout(allowance);
          }
        }
      }
    } catch (error) {
      console.error("[Allowance Scheduler] Error:", error);
    }
  });

  // Simulate 30 days of savings with varying daily rates
  app.post("/api/simulate-savings/:peerId", async (req, res) => {
    try {
      const peerId = parseInt(req.params.peerId);
      const child = await storage.getPeer(peerId);
      
      if (!child || child.role !== "child") {
        return res.status(404).json({ error: "Child not found" });
      }

      // Different daily savings rates for 30 days (varying amounts)
      const dailyRates = [
        5, 8, 3, 12, 6, 4, 10, 7, 9, 5,    // Week 1
        15, 6, 8, 4, 11, 7, 9, 5, 13, 6,   // Week 2
        7, 10, 5, 8, 12, 6, 4, 9, 7, 11    // Week 3-4
      ];

      let cumulativeValue = 0;
      const monthlyRate = 0.2 / 100; // 0.2% per month

      // Create weekly snapshots (4 snapshots for ~30 days)
      for (let week = 0; week < 4; week++) {
        let weekValue = 0;
        for (let day = 0; day < 7.5; day++) {
          const dayIndex = Math.floor(week * 7.5 + day);
          if (dayIndex < dailyRates.length) {
            weekValue += dailyRates[dayIndex];
          }
        }
        cumulativeValue += weekValue;

        // Add weekly interest
        const weekInterest = cumulativeValue * (monthlyRate / 4);
        cumulativeValue += weekInterest;

        // Create snapshot
        const now = new Date();
        const snapshotDate = new Date(now.getTime() - (4 - week - 1) * 7 * 24 * 60 * 60 * 1000);

        await storage.createMonthlySavingsSnapshot({
          peerId,
          connectionId: child.connectionId,
          valueEur: Math.round(cumulativeValue * 100),
          satoshiAmount: child.balance || 0,
          interestEarned: Math.round(weekInterest * 100)
        });
      }

      // Final month-end snapshot with full interest
      const finalInterest = cumulativeValue * monthlyRate;
      const finalValue = cumulativeValue + finalInterest;

      await storage.createMonthlySavingsSnapshot({
        peerId,
        connectionId: child.connectionId,
        valueEur: Math.round(finalValue * 100),
        satoshiAmount: child.balance || 0,
        interestEarned: Math.round(finalInterest * 100)
      });

      res.json({
        success: true,
        totalSaved: cumulativeValue,
        totalInterest: finalInterest,
        finalValue,
        snapshotsCreated: 5,
        message: `Simuliert: €${cumulativeValue.toFixed(2)} Ersparnisse + €${finalInterest.toFixed(2)} Zinsen = €${finalValue.toFixed(2)} Gesamtwert`
      });
    } catch (error) {
      console.error("[Simulate Savings Error]:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Simulate 30 days of Bitcoin price growth
  app.post("/api/simulate-bitcoin/:peerId", async (req, res) => {
    try {
      const peerId = parseInt(req.params.peerId);
      const child = await storage.getPeer(peerId);
      
      if (!child || child.role !== "child") {
        return res.status(404).json({ error: "Child not found" });
      }

      // Bitcoin price per satoshi (in EUR) - simulating daily price changes
      const dailyBtcPrices = [
        0.022, 0.023, 0.021, 0.024, 0.025, 0.024, 0.026, // Week 1
        0.027, 0.025, 0.026, 0.028, 0.027, 0.029, 0.030, // Week 2
        0.031, 0.030, 0.032, 0.033, 0.032, 0.034, 0.035, // Week 3
        0.036, 0.035, 0.037, 0.038, 0.037, 0.039, 0.040  // Week 4
      ];

      // Create daily snapshots (one per day for 28 days)
      for (let day = 0; day < Math.min(dailyBtcPrices.length, 28); day++) {
        const pricePerSat = dailyBtcPrices[day];
        const valueEur = (child.balance || 2100) * pricePerSat; // Calculate value based on balance
        
        const now = new Date();
        const snapshotDate = new Date(now.getTime() - (28 - day) * 24 * 60 * 60 * 1000);

        await storage.createDailyBitcoinSnapshot({
          peerId,
          connectionId: child.connectionId,
          valueEur: Math.round(valueEur * 100), // Convert to cents
          satoshiAmount: child.balance || 2100
        });
      }

      const finalValue = (child.balance || 2100) * dailyBtcPrices[dailyBtcPrices.length - 1];
      const initialValue = (child.balance || 2100) * dailyBtcPrices[0];
      const gainEur = finalValue - initialValue;

      res.json({
        success: true,
        snapshotsCreated: Math.min(dailyBtcPrices.length, 28),
        initialValue: initialValue.toFixed(2),
        finalValue: finalValue.toFixed(2),
        gainEur: gainEur.toFixed(2),
        message: `Simuliert: 28 Tage Bitcoin-Preisveränderung - Start: €${initialValue.toFixed(2)} → Ende: €${finalValue.toFixed(2)} (Gewinn: €${gainEur.toFixed(2)})`
      });
    } catch (error) {
      console.error("[Simulate Bitcoin Error]:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Monthly savings snapshot scheduler (runs on the 1st of each month at 00:01)
  cron.schedule("1 0 1 * *", async () => {
    try {
      console.log("[Monthly Savings Scheduler] Running monthly snapshot calculation");
      const allPeers = await db.select().from(peers).where(eq(peers.role, "child"));
      
      for (const child of allPeers) {
        const lastSnapshot = await storage.getLastMonthlySavingsSnapshot(child.id);
        const previousValue = lastSnapshot ? lastSnapshot.valueEur / 100 : 0;
        
        // Calculate interest on previous month's value
        const monthlyRate = 0.2 / 100; // 0.2% per month
        const interestEarned = previousValue * monthlyRate;
        const newValue = previousValue + interestEarned;
        
        // Create snapshot with accumulated value
        await storage.createMonthlySavingsSnapshot({
          peerId: child.id,
          connectionId: child.connectionId,
          valueEur: Math.round(newValue * 100),
          satoshiAmount: child.balance || 0,
          interestEarned: Math.round(interestEarned * 100)
        });
        
        console.log(`[Monthly Savings Scheduler] Created snapshot for ${child.name}: €${newValue.toFixed(2)} (interest: €${interestEarned.toFixed(2)})`);
      }
    } catch (error) {
      console.error("[Monthly Savings Scheduler] Error:", error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
