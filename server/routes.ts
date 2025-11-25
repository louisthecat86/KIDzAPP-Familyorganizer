import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPeerSchema, insertTaskSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Peer Registration/Login
  app.post("/api/peers/register", async (req, res) => {
    try {
      const data = insertPeerSchema.parse(req.body);
      
      // Check if peer already exists
      const existingPeer = await storage.getPeerByConnectionId(data.connectionId, data.role);
      if (existingPeer) {
        return res.json(existingPeer);
      }
      
      // Create new peer
      const peer = await storage.createPeer(data);
      res.json(peer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to register peer" });
      }
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

  // Pair with family using parent's PIN
  app.post("/api/peers/pair", async (req, res) => {
    try {
      const { name, personalPin, role, parentPin } = req.body;
      
      if (!name || !personalPin || !role || !parentPin) {
        return res.status(400).json({ error: "Name, personalPin, role, and parentPin required" });
      }

      if (role === "parent") {
        return res.status(400).json({ error: "Parents cannot pair with another PIN" });
      }
      
      // Find parent by their PIN
      const parentPeer = await storage.getPeerByPin(parentPin);
      
      if (!parentPeer || parentPeer.role !== "parent") {
        return res.status(404).json({ error: "Parent PIN not found" });
      }
      
      // Create child peer with parent's connectionId
      const childPeer = await storage.createPeer({
        name,
        role,
        pin: personalPin,
        connectionId: parentPeer.connectionId,
        pairedWithPin: parentPin,
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
