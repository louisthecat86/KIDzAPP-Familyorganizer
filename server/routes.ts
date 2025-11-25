import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPeerSchema, insertTaskSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Peer Registration
  app.post("/api/peers/register", async (req, res) => {
    try {
      const { name, role, pin, connectionId } = req.body;
      
      if (!name || !role || !pin || !connectionId) {
        return res.status(400).json({ error: "Name, role, pin, and connectionId required" });
      }

      // Create new peer
      const peer = await storage.createPeer({
        name,
        role,
        pin,
        connectionId,
        pairedWithPin: null,
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

  // Pair child with family using parent's connection ID
  app.post("/api/peers/pair", async (req, res) => {
    try {
      const { name, personalPin, role, parentConnectionId } = req.body;
      
      if (!name || !personalPin || !role || !parentConnectionId) {
        return res.status(400).json({ error: "Name, personalPin, role, and parentConnectionId required" });
      }

      if (role === "parent") {
        return res.status(400).json({ error: "Parents cannot pair with another connection" });
      }
      
      // Create child peer with parent's connectionId
      const childPeer = await storage.createPeer({
        name,
        role,
        pin: personalPin,
        connectionId: parentConnectionId,
        pairedWithPin: null,
      });
      
      res.json(childPeer);
    } catch (error) {
      if ((error as any).message?.includes("unique constraint")) {
        return res.status(400).json({ error: "PIN already in use" });
      }
      res.status(500).json({ error: "Failed to pair" });
    }
  });

  // Get peer by connection ID and role
  app.get("/api/peers/:connectionId/:role", async (req, res) => {
    try {
      const { connectionId, role } = req.params;
      const peer = await storage.getPeerByConnectionId(connectionId, role);
      
      if (!peer) {
        return res.status(404).json({ error: "Peer not found" });
      }
      
      res.json(peer);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch peer" });
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

  // Create a new task
  app.post("/api/tasks", async (req, res) => {
    try {
      const data = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(data);
      res.json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create task" });
      }
    }
  });

  // Update a task
  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      
      const task = await storage.updateTask(id, updates);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
