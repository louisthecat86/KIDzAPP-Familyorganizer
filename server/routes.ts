import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPeerSchema, insertTaskSchema, insertFamilyEventSchema, insertEventRsvpSchema, insertChatMessageSchema, peers, recurringTasks, transactions, pushSubscriptions } from "@shared/schema";
import { z } from "zod";
import { LNBitsClient } from "./lnbits";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import cron from "node-cron";
import { encrypt, decrypt, isEncrypted } from "./crypto";
import { getVapidPublicKey, notifyTaskCreated, notifyTaskSubmitted, notifyTaskApproved, notifyPaymentReceived, notifyLevelUp, notifyGraduation, notifyNewEvent, notifyNewChatMessage, notifyPaymentFailed } from "./push";

const DEV_FALLBACK_KEY = "kid-app-dev-encryption-key-32chars!!";
const DEVELOPER_DONATION_ADDRESS = "mw860602@blink.sv"; // Fixed developer donation address

function getWalletEncryptionKey(): string {
  if (process.env.WALLET_ENCRYPTION_KEY) {
    return process.env.WALLET_ENCRYPTION_KEY;
  }
  console.warn("[Security] WALLET_ENCRYPTION_KEY not set - using development fallback. Set this in Secrets for production!");
  return DEV_FALLBACK_KEY;
}

const WALLET_ENCRYPTION_KEY = getWalletEncryptionKey();

function encryptWalletData(data: string): string {
  try {
    return encrypt(data, WALLET_ENCRYPTION_KEY);
  } catch (error) {
    console.error("Encryption failed:", error);
    return data;
  }
}

function decryptWalletData(data: string): string {
  if (!data) return data;
  if (!isEncrypted(data)) return data;
  try {
    return decrypt(data, WALLET_ENCRYPTION_KEY);
  } catch (error) {
    console.error("Decryption failed, returning original data:", error);
    return data;
  }
}

function validatePassword(password: string): { valid: boolean; error: string } {
  if (!password || password.length < 8) {
    return { valid: false, error: "Passwort muss mindestens 8 Zeichen haben" };
  }
  if (password.length > 12) {
    return { valid: false, error: "Passwort darf maximal 12 Zeichen haben" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Passwort muss mindestens einen Großbuchstaben enthalten" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Passwort muss mindestens eine Zahl enthalten" };
  }
  return { valid: true, error: "" };
}

function sanitizePeerForClient(peer: any): any {
  if (!peer) return peer;
  const { lnbitsAdminKey, lnbitsUrl, nwcConnectionString, ...safePeer } = peer;
  return {
    ...safePeer,
    hasLnbitsConfigured: !!(lnbitsUrl && lnbitsAdminKey),
    hasNwcConfigured: !!nwcConnectionString,
  };
}

function sanitizePeersForClient(peers: any[]): any[] {
  return peers.map(sanitizePeerForClient);
}

// Helper to get Berlin time
function getBerlinTime(date: Date = new Date()): Date {
  const formatter = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  const parts = formatter.formatToParts(date);
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
  
  return new Date(
    parseInt(partMap.year),
    parseInt(partMap.month) - 1,
    parseInt(partMap.day),
    parseInt(partMap.hour),
    parseInt(partMap.minute),
    parseInt(partMap.second)
  );
}

export async function registerRoutes(app: Express): Promise<Server> {
  // DEBUG: Test if recurring scheduler is working
  console.log("[Startup] Registering recurring tasks scheduler...");
  
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

  // Password reset with security question verification - no password exposed
  app.post("/api/peers/reset-password", async (req, res) => {
    try {
      const { name, favoriteColor, role, newPassword } = req.body;
      
      if (!name || !favoriteColor || !role || !newPassword) {
        return res.status(400).json({ error: "Name, favoriteColor, role und newPassword erforderlich" });
      }

      // Validate password requirements
      if (newPassword.length < 8 || newPassword.length > 12) {
        return res.status(400).json({ error: "Passwort muss 8-12 Zeichen haben" });
      }
      if (!/[A-Z]/.test(newPassword)) {
        return res.status(400).json({ error: "Passwort muss mindestens einen Großbuchstaben enthalten" });
      }
      if (!/[0-9]/.test(newPassword)) {
        return res.status(400).json({ error: "Passwort muss mindestens eine Zahl enthalten" });
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

      // Directly update password - no old password returned
      await db.update(peers).set({ pin: newPassword }).where(eq(peers.id, peer[0].id));

      res.json({ success: true, message: "Passwort wurde zurückgesetzt" });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ error: "Passwort-Reset fehlgeschlagen" });
    }
  });

  // Peer Registration
  app.post("/api/peers/register", async (req, res) => {
    try {
      const { name, role, pin, familyName, joinParentConnectionId, favoriteColor } = req.body;
      
      if (!name || !role || !pin) {
        return res.status(400).json({ error: "Name, role, and password required" });
      }

      // Validate password requirements
      const passwordValidation = validatePassword(pin);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.error });
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

      res.json(sanitizePeerForClient(peer));
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
      
      res.json(sanitizePeerForClient(peer));
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Change parent's own PIN
  app.post("/api/peers/:peerId/change-pin", async (req, res) => {
    try {
      const { peerId } = req.params;
      const { oldPin, newPin } = req.body;

      const passwordValidation = validatePassword(newPin);
      if (!oldPin || !passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.error || "Altes und neues Passwort erforderlich" });
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

      await storage.updatePeerWallet(peerId, "", "");
      console.log("LNbits wallet deleted successfully for peer:", peerId);
      res.json({ success: true });
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

      // Encrypt and save LNbits credentials
      const encryptedAdminKey = encryptWalletData(lnbitsAdminKey);
      const peer = await storage.updatePeerWallet(peerId, normalizedUrl, encryptedAdminKey);
      console.log("LNbits wallet saved (encrypted) successfully for peer:", peerId);
      res.json(sanitizePeerForClient(peer));
    } catch (error) {
      console.error("LNbits wallet setup error:", error);
      res.status(500).json({ error: "Wallet-Setup fehlgeschlagen: " + (error as Error).message });
    }
  });

  // Setup NWC wallet for Parent
  app.post("/api/wallet/setup-nwc", async (req, res) => {
    try {
      const { peerId, nwcConnectionString } = req.body;
      
      if (!peerId || !nwcConnectionString) {
        return res.status(400).json({ error: "peerId und nwcConnectionString erforderlich" });
      }

      // Validate NWC connection string format
      if (!nwcConnectionString.startsWith("nostr+walletconnect://")) {
        return res.status(400).json({ error: "NWC Connection String muss mit nostr+walletconnect:// beginnen" });
      }

      // Test NWC connection
      try {
        const { NWCClient } = await import("./nwc");
        const nwc = new NWCClient(nwcConnectionString);
        const connected = await nwc.testConnection();
        nwc.close();
        
        if (!connected) {
          return res.status(400).json({ 
            error: "NWC Verbindung fehlgeschlagen. Überprüfe den Connection String." 
          });
        }
      } catch (error) {
        console.error("NWC connection test failed:", error);
        return res.status(400).json({ error: `NWC Fehler: ${(error as Error).message}` });
      }

      // Encrypt and save NWC credentials
      const encryptedNwc = encryptWalletData(nwcConnectionString);
      const peer = await storage.updatePeerNwcWallet(peerId, encryptedNwc);
      console.log("NWC wallet saved (encrypted) successfully for peer:", peerId);
      res.json(sanitizePeerForClient(peer));
    } catch (error) {
      console.error("NWC wallet setup error:", error);
      res.status(500).json({ error: "NWC Wallet-Setup fehlgeschlagen: " + (error as Error).message });
    }
  });

  // Delete NWC wallet connection
  app.delete("/api/wallet/nwc", async (req, res) => {
    try {
      const { peerId } = req.body;
      
      if (!peerId) {
        return res.status(400).json({ error: "peerId erforderlich" });
      }

      await storage.clearPeerNwcWallet(peerId);
      console.log("NWC wallet deleted successfully for peer:", peerId);
      res.json({ success: true });
    } catch (error) {
      console.error("NWC wallet delete error:", error);
      res.status(500).json({ error: "Fehler beim Löschen der NWC-Verbindung" });
    }
  });

  // Set active wallet type
  app.post("/api/wallet/set-active", async (req, res) => {
    try {
      const { peerId, walletType } = req.body;
      
      if (!peerId || !walletType) {
        return res.status(400).json({ error: "peerId und walletType erforderlich" });
      }

      if (!["lnbits", "nwc"].includes(walletType)) {
        return res.status(400).json({ error: "walletType muss 'lnbits' oder 'nwc' sein" });
      }

      const peer = await storage.updatePeerWalletType(peerId, walletType);
      res.json(sanitizePeerForClient(peer));
    } catch (error) {
      console.error("Set active wallet error:", error);
      res.status(500).json({ error: "Fehler beim Setzen der aktiven Wallet" });
    }
  });

  // Set donation address for parent (to receive donations)
  app.post("/api/donation/set-address", async (req, res) => {
    try {
      const { peerId, donationAddress } = req.body;
      
      if (!peerId || !donationAddress) {
        return res.status(400).json({ error: "peerId und donationAddress erforderlich" });
      }

      const peer = await storage.updateDonationAddress(peerId, donationAddress.trim());
      res.json({ 
        success: true, 
        donationAddress: peer.donationAddress,
        donationLink: `lightning:${peer.donationAddress}`
      });
    } catch (error) {
      console.error("Set donation address error:", error);
      res.status(500).json({ error: "Fehler beim Speichern der Spendendadresse" });
    }
  });

  // Get donation link for parent
  app.get("/api/donation/link/:parentId", async (req, res) => {
    try {
      const parentId = parseInt(req.params.parentId);
      const peer = await storage.getPeer(parentId);
      
      if (!peer || peer.role !== "parent") {
        return res.status(404).json({ error: "Parent nicht gefunden" });
      }

      if (!peer.donationAddress) {
        return res.status(400).json({ error: "Keine Spendendadresse konfiguriert" });
      }

      res.json({
        donationAddress: peer.donationAddress,
        donationLink: `lightning:${peer.donationAddress}`,
        lightningDeepLink: `lightning:${peer.donationAddress}`
      });
    } catch (error) {
      console.error("Get donation link error:", error);
      res.status(500).json({ error: "Fehler beim Abrufen des Spendenlinks" });
    }
  });

  // Donate to developer - uses same wallet logic as child payments
  app.post("/api/donate", async (req, res) => {
    try {
      const { peerId, donationSats, memo } = req.body;
      
      if (!peerId || !donationSats || donationSats <= 0) {
        return res.status(400).json({ error: "peerId und donationSats erforderlich" });
      }

      const peer = await storage.getPeer(peerId);
      if (!peer) {
        return res.status(404).json({ error: "Peer nicht gefunden" });
      }

      // Decrypt wallet credentials (same as child payments)
      const decryptedNwc = decryptWalletData(peer.nwcConnectionString || "");
      const decryptedLnbitsKey = decryptWalletData(peer.lnbitsAdminKey || "");
      const hasNwc = !!decryptedNwc;
      const hasLnbits = !!(peer.lnbitsUrl && decryptedLnbitsKey);
      const activeWallet = peer.walletType || (hasNwc ? "nwc" : hasLnbits ? "lnbits" : null);

      if (!hasNwc && !hasLnbits) {
        return res.status(400).json({ error: "Keine Wallet (NWC oder LNbits) konfiguriert. Bitte konfiguriere eine Wallet in den Einstellungen." });
      }

      const memoText = memo || `Spende von ${peer.name}`;
      let paymentHash: string | null = null;

      console.log("[Donation] Starting payment to", DEVELOPER_DONATION_ADDRESS, "amount:", donationSats, "sats");
      console.log("[Donation] Wallet config: activeWallet=", activeWallet, "hasNwc=", hasNwc, "hasLnbits=", hasLnbits);

      // Use same wallet selection logic as child payments
      if (activeWallet === "nwc" && hasNwc) {
        console.log("[Donation] Using NWC for payment");
        const { NWCClient } = await import("./nwc");
        const nwc = new NWCClient(decryptedNwc);
        paymentHash = await nwc.payToLightningAddress(DEVELOPER_DONATION_ADDRESS, donationSats, memoText);
        nwc.close();
        console.log("[Donation] NWC payment successful:", paymentHash);
      } else if (hasLnbits) {
        console.log("[Donation] Using LNbits for payment, URL:", peer.lnbitsUrl);
        const lnbits = new LNBitsClient(peer.lnbitsUrl!, decryptedLnbitsKey);
        paymentHash = await lnbits.payToLightningAddress(donationSats, DEVELOPER_DONATION_ADDRESS, memoText);
        console.log("[Donation] LNbits payment successful:", paymentHash);
      } else if (hasNwc) {
        // Fallback to NWC if LNbits not configured
        console.log("[Donation] Falling back to NWC");
        const { NWCClient } = await import("./nwc");
        const nwc = new NWCClient(decryptedNwc);
        paymentHash = await nwc.payToLightningAddress(DEVELOPER_DONATION_ADDRESS, donationSats, memoText);
        nwc.close();
        console.log("[Donation] NWC fallback payment successful:", paymentHash);
      }

      if (!paymentHash) {
        return res.status(400).json({ error: "Zahlung fehlgeschlagen - keine erfolgreiche Wallet-Verbindung" });
      }

      // Record transaction (fromPeerId = parent who pays, toPeerId = null for external)
      await storage.createTransaction({
        fromPeerId: peerId,
        toPeerId: null,
        sats: donationSats,
        type: "donation",
        description: `Spende: ${memoText}`,
        paymentHash,
        status: "completed"
      });

      console.log("[Donation] Success:", { peerId, donationSats, paymentHash, address: DEVELOPER_DONATION_ADDRESS });
      res.json({ success: true, paymentHash, sats: donationSats });
    } catch (error) {
      console.error("[Donation] Error:", error);
      res.status(500).json({ error: "Spende fehlgeschlagen: " + (error as Error).message });
    }
  });

  // Get NWC balance
  app.get("/api/wallet/nwc-balance/:peerId", async (req, res) => {
    try {
      const { peerId } = req.params;
      const parent = await storage.getPeer(parseInt(peerId));
      
      if (!parent) {
        return res.status(404).json({ error: "Parent nicht gefunden" });
      }

      const decryptedNwc = decryptWalletData(parent.nwcConnectionString || "");
      if (!decryptedNwc) {
        return res.status(400).json({ error: "NWC nicht konfiguriert" });
      }

      const { NWCClient } = await import("./nwc");
      const nwc = new NWCClient(decryptedNwc);
      const balance = await nwc.getBalance();
      nwc.close();

      res.json({ balance });
    } catch (error) {
      console.error("NWC balance error:", error);
      res.status(500).json({ error: "Fehler beim Abrufen der NWC Balance" });
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
      res.json(sanitizePeerForClient(peer));
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
      res.json(sanitizePeerForClient(updatedChild));
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
      res.json(sanitizePeerForClient(updatedChild));
    } catch (error) {
      console.error("Unlink error:", error);
      res.status(500).json({ error: "Failed to unlink child from parent" });
    }
  });

  // Get all parents
  app.get("/api/peers/parents", async (req, res) => {
    try {
      const parents = await storage.getAllParents();
      res.json(sanitizePeersForClient(parents));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch parents" });
    }
  });

  // Get all peers by connection ID
  app.get("/api/peers/connection/:connectionId", async (req, res) => {
    try {
      const { connectionId } = req.params;
      const peers = await storage.getPeersByConnectionId(connectionId);
      res.json(sanitizePeersForClient(peers));
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

  // Get task unlock status for a child (family tasks vs paid tasks)
  app.get("/api/tasks/unlock-status/:childId/:connectionId", async (req, res) => {
    try {
      const { childId, connectionId } = req.params;
      const status = await storage.getTaskUnlockStatus(parseInt(childId), connectionId);
      res.json(status);
    } catch (error) {
      console.error("Unlock status error:", error);
      res.status(500).json({ error: "Failed to fetch unlock status" });
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

  // Get sats breakdown for a child (task sats vs allowance/instant payout sats)
  app.get("/api/peers/:childId/sats-breakdown", async (req, res) => {
    try {
      const childId = parseInt(req.params.childId);
      const child = await storage.getPeer(childId);
      
      if (!child || child.role !== "child") {
        return res.status(404).json({ error: "Child not found" });
      }

      // Get task payment transactions for this child (most reliable source of task sats)
      const taskTransactions = await db.select()
        .from(transactions)
        .where(and(eq(transactions.toPeerId, childId), eq(transactions.type, "task_payment")));
      const taskSats = taskTransactions.reduce((sum: number, t) => sum + t.sats, 0);
      
      // Get all level bonus payouts for this child
      const bonusPayouts = await storage.getLevelBonusPayouts(childId);
      const levelBonusSats = bonusPayouts.reduce((sum: number, p) => sum + p.sats, 0);
      
      // Get graduation bonus transactions for this child
      const graduationBonusTransactions = await db.select()
        .from(transactions)
        .where(and(eq(transactions.toPeerId, childId), eq(transactions.type, "graduation_bonus")));
      const graduationBonusSats = graduationBonusTransactions.reduce((sum: number, t) => sum + t.sats, 0);
      
      // Total bonus = level bonus + graduation bonus
      const bonusSats = levelBonusSats + graduationBonusSats;
      
      // Get instant payout and allowance payout transactions
      const otherPayoutTransactions = await db.select()
        .from(transactions)
        .where(and(eq(transactions.toPeerId, childId), eq(transactions.type, "instant_payout")));
      const allowanceTransactions = await db.select()
        .from(transactions)
        .where(and(eq(transactions.toPeerId, childId), eq(transactions.type, "allowance_payout")));
      
      const instantPayoutSats = otherPayoutTransactions.reduce((sum: number, t) => sum + t.sats, 0);
      const allowancePayoutSats = allowanceTransactions.reduce((sum: number, t) => sum + t.sats, 0);
      const allowanceSats = instantPayoutSats + allowancePayoutSats;
      
      console.log(`[Sats Breakdown] ${child.name}: total=${child.balance}, tasks=${taskSats}, bonus=${bonusSats} (level=${levelBonusSats}+grad=${graduationBonusSats}), allowance=${allowanceSats}`);
      
      res.json({
        totalSats: child.balance || 0,
        taskSats: taskSats,
        bonusSats: bonusSats,
        allowanceSats: allowanceSats
      });
    } catch (error) {
      console.error("[Sats Breakdown Error]:", error);
      res.status(500).json({ error: "Failed to fetch sats breakdown" });
    }
  });

  // Get parent wallet balances (LNbits and NWC)
  app.get("/api/parent/:peerId/wallet-balance", async (req, res) => {
    try {
      const { peerId } = req.params;
      const parent = await storage.getPeer(parseInt(peerId));
      
      if (!parent) {
        return res.status(404).json({ error: "Parent not found" });
      }

      let lnbitsBalance = null;
      let nwcBalance = null;

      // Try to get LNbits balance (decrypt admin key)
      const decryptedLnbitsKey = decryptWalletData(parent.lnbitsAdminKey || "");
      if (parent.lnbitsUrl && decryptedLnbitsKey) {
        try {
          const lnbits = new LNBitsClient(parent.lnbitsUrl, decryptedLnbitsKey);
          lnbitsBalance = await lnbits.getBalance();
        } catch (error) {
          console.warn("LNbits balance fetch failed:", error);
        }
      }

      // Try to get NWC balance (decrypt connection string)
      const decryptedNwcBalance = decryptWalletData(parent.nwcConnectionString || "");
      if (decryptedNwcBalance) {
        try {
          const { NWCClient } = await import("./nwc");
          const nwc = new NWCClient(decryptedNwcBalance);
          nwcBalance = await nwc.getBalance();
          nwc.close();
        } catch (error) {
          console.warn("NWC balance fetch failed:", error);
        }
      }

      res.json({ lnbitsBalance, nwcBalance, activeWallet: parent.walletType });
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

      // Validate assignedFor child belongs to same family
      if (data.assignedFor) {
        const targetChild = await storage.getPeer(data.assignedFor);
        if (!targetChild || targetChild.connectionId !== data.connectionId || targetChild.role !== "child") {
          return res.status(400).json({ error: "Ausgewähltes Kind gehört nicht zur Familie" });
        }
      }

      let invoice = "";
      let escrowLocked = false;

      // Check which wallet is configured (decrypt keys first)
      const decryptedLnbitsKeyTask = decryptWalletData(parent.lnbitsAdminKey || "");
      const decryptedNwcTask = decryptWalletData(parent.nwcConnectionString || "");
      const hasLnbits = parent.lnbitsUrl && decryptedLnbitsKeyTask;
      const hasNwc = !!decryptedNwcTask;
      const activeWallet = parent.walletType || (hasLnbits ? "lnbits" : hasNwc ? "nwc" : null);

      if (!hasLnbits && !hasNwc) {
        return res.status(400).json({ 
          error: "Keine Wallet konfiguriert. Bitte verbinde LNbits oder NWC in den Einstellungen." 
        });
      }

      // Try to validate balance with active wallet
      try {
        let balance = 0;
        
        if (activeWallet === "nwc" && hasNwc) {
          const { NWCClient } = await import("./nwc");
          const nwc = new NWCClient(decryptedNwcTask);
          balance = await nwc.getBalance();
          nwc.close();
        } else if (hasLnbits) {
          const lnbits = new LNBitsClient(parent.lnbitsUrl!, decryptedLnbitsKeyTask);
          balance = await lnbits.getBalance();
          
          // For LNbits, try to create escrow invoice
          if (balance >= data.sats) {
            try {
              invoice = await lnbits.createPaylink(data.sats, `Task: ${data.title}`);
              escrowLocked = true;
            } catch (paylinksError) {
              console.log("Paylinks failed, trying Invoice API:", paylinksError);
              try {
                const invoiceData = await lnbits.createInvoice(data.sats, `Task: ${data.title}`);
                invoice = invoiceData.payment_request || invoiceData.payment_hash;
                escrowLocked = true;
              } catch (invoiceError) {
                console.warn("Both Paylinks and Invoice APIs failed, creating task without escrow:", invoiceError);
                escrowLocked = false;
              }
            }
          }
        }
        
        if (balance < data.sats) {
          return res.status(400).json({ 
            error: `Unzureichende Balance. Benötigt: ${data.sats} Sats, verfügbar: ${balance} Sats` 
          });
        }
      } catch (error) {
        if ((error as any).message?.includes("Unzureichende") || (error as any).message?.includes("nicht konfiguriert")) {
          throw error;
        }
        console.warn("Wallet balance check failed:", error);
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

      // Send push notification for new task
      try {
        await notifyTaskCreated(data.connectionId, data.title, data.sats, createdBy);
      } catch (pushError) {
        console.warn("[Push] Failed to notify task created:", pushError);
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

  // Get recurring tasks
  app.get("/api/recurring-tasks/:connectionId", async (req, res) => {
    try {
      const tasks = await storage.getRecurringTasks(req.params.connectionId);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recurring tasks" });
    }
  });

  // Create recurring task
  app.post("/api/recurring-tasks", async (req, res) => {
    try {
      const data = req.body;
      const task = await storage.createRecurringTask({
        connectionId: data.connectionId,
        createdBy: data.createdBy,
        title: data.title,
        description: data.description,
        sats: data.sats,
        frequency: data.frequency,
        dayOfWeek: data.dayOfWeek,
        dayOfMonth: data.dayOfMonth,
        time: data.time,
        isActive: true,
      });
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to create recurring task" });
    }
  });

  // Update recurring task
  app.patch("/api/recurring-tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const task = await storage.updateRecurringTask(id, req.body);
      if (task) {
        res.json(task);
      } else {
        res.status(404).json({ error: "Recurring task not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to update recurring task" });
    }
  });

  // Delete recurring task
  app.delete("/api/recurring-tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteRecurringTask(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete recurring task" });
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

      // LOCK-CHECK: If child is trying to accept a PAID task (isRequired=false), check freeSlots
      // BUT: Skip check if bypassRatio=true (sofort freischalten)
      if (updates.status === "assigned" && updates.assignedTo && task.isRequired === false && task.bypassRatio !== true) {
        const unlockStatus = await storage.getTaskUnlockStatus(updates.assignedTo, task.connectionId);
        console.log(`[Task Lock] Child ${updates.assignedTo} trying to accept paid task ${id}: freeSlots=${unlockStatus.freeSlots}, progress=${unlockStatus.progressToNext}/3`);
        
        if (unlockStatus.freeSlots <= 0) {
          console.log(`[Task Lock] BLOCKED: No freeSlots available. Child must complete ${3 - unlockStatus.progressToNext} more family tasks`);
          return res.status(423).json({ 
            error: `Du musst erst ${3 - unlockStatus.progressToNext} Familienaufgaben erledigen`,
            freeSlots: unlockStatus.freeSlots,
            progressToNext: unlockStatus.progressToNext,
            familyTasksCompleted: unlockStatus.familyTasksCompleted
          });
        }
        console.log(`[Task Lock] APPROVED: Child has ${unlockStatus.freeSlots} freeSlots`);
      } else if (updates.status === "assigned" && task.bypassRatio) {
        console.log(`[Task Lock] BYPASSED: Task ${id} has bypassRatio=true, allowing immediate assignment`);
      }

      // IDEMPOTENCY CHECK: If task is already approved OR has a paymentHash, reject duplicate approval
      if (updates.status === "approved") {
        if (task.status === "approved") {
          console.log(`[Task Approval] BLOCKED: Task ${id} already approved, returning existing task`);
          return res.status(409).json({ error: "Task already approved", task });
        }
        if (task.paymentHash) {
          console.log(`[Task Approval] BLOCKED: Task ${id} already has paymentHash, returning existing task`);
          return res.status(409).json({ error: "Payment already processed", task });
        }
        
        // ATOMIC: Set status to approved FIRST before any payment processing
        // This prevents race conditions where multiple requests could pass the check above
        const immediateUpdate = await storage.updateTask(id, { status: "approved" });
        if (!immediateUpdate || immediateUpdate.status !== "approved") {
          console.log(`[Task Approval] BLOCKED: Failed to atomically update task ${id}`);
          return res.status(409).json({ error: "Task approval conflict" });
        }
        console.log(`[Task Approval] Task ${id} status set to approved atomically`);
      }

      // If status is being set to approved AND task was not already approved, process payment
      if (updates.status === "approved" && task.status !== "approved") {
        console.log(`[Task Approval] Processing approval for task ${id}, assigning sats to child ${task.assignedTo}`);
        const child = await storage.getPeer(task.assignedTo!);
        const parent = await storage.getPeer(task.createdBy);
        
        if (!child || !parent) {
          return res.status(404).json({ error: "Child or parent not found" });
        }

        // Update child's balance IMMEDIATELY (only for first approval)
        const newBalance = (child.balance || 0) + task.sats;
        console.log(`[Task Approval] New balance for ${child.name}: ${newBalance} sats (was ${child.balance}, +${task.sats})`);
        await storage.updateBalance(child.id, newBalance);

        // Create a new Bitcoin snapshot when child receives sats
        try {
          console.log(`[Task Approval] About to create snapshot for ${child.name}...`);
          const btcPrice = await getFreshBitcoinPrice();
          console.log(`[getFreshBitcoinPrice] Response: ${JSON.stringify(btcPrice)}`);
          const valueEur = (newBalance / 1e8) * btcPrice.eur;
          console.log(`[Task Approval] Creating snapshot: ${newBalance} sats × €${btcPrice.eur} = €${valueEur.toFixed(2)}`);
          const snapshotResult = await storage.createDailyBitcoinSnapshot({
            peerId: child.id,
            connectionId: child.connectionId,
            valueEur: Math.round(valueEur * 100), // Convert to cents
            satoshiAmount: newBalance,
            btcPrice: Math.round(btcPrice.eur * 100) // Store BTC price in cents
          });
          console.log(`[Task Approval Snapshot] ✓ Created for ${child.name}: €${valueEur.toFixed(2)}, Result:`, JSON.stringify(snapshotResult));
        } catch (snapshotError) {
          console.error("[Task Approval Snapshot] ✗ Failed:", snapshotError);
        }

        let paymentHash = "";

        // Check for level bonus
        try {
          // Get number of completed tasks for this child
          const allTasks = await storage.getTasks(task.connectionId);
          const completedTasks = allTasks.filter((t: any) => 
            t.assignedTo === child.id && 
            (t.status === "approved" || t.id === task.id)
          ).length;

          // Calculate level
          const getLevel = (completed: number) => {
            if (completed >= 30) return 10;
            if (completed >= 27) return 9;
            if (completed >= 24) return 8;
            if (completed >= 21) return 7;
            if (completed >= 18) return 6;
            if (completed >= 15) return 5;
            if (completed >= 12) return 4;
            if (completed >= 9) return 3;
            if (completed >= 6) return 2;
            if (completed >= 3) return 1;
            return 0;
          };
          
          const currentLevel = getLevel(completedTasks);
          console.log(`[Level Bonus] Child ${child.name} now has ${completedTasks} tasks, Level ${currentLevel}`);

          // Check for bonus
          if (currentLevel > 0) {
            const bonusSettings = await storage.getLevelBonusSettings(task.connectionId);
            if (bonusSettings && bonusSettings.isActive) {
              // Check if this level is a milestone
              if (currentLevel % bonusSettings.milestoneInterval === 0) {
                // Check if bonus already paid for this level
                const alreadyPaid = await storage.hasLevelBonusBeenPaid(child.id, currentLevel);
                if (!alreadyPaid) {
                  console.log(`[Level Bonus] Paying ${bonusSettings.bonusSats} sats bonus for Level ${currentLevel} to ${child.name}`);
                  
                  // Update child's balance with bonus (newBalance already includes task.sats from earlier)
                  const bonusBalance = newBalance + bonusSettings.bonusSats;
                  await storage.updateBalance(child.id, bonusBalance);
                  console.log(`[Level Bonus] Updated balance to ${bonusBalance} (added ${bonusSettings.bonusSats} bonus to ${newBalance})`);

                  // Record the payout
                  await storage.createLevelBonusPayout({
                    childId: child.id,
                    connectionId: task.connectionId,
                    level: currentLevel,
                    sats: bonusSettings.bonusSats
                  });

                  // Create Bitcoin snapshot for level bonus (task approval)
                  try {
                    const btcPrice = await getFreshBitcoinPrice();
                    const valueEur = (bonusBalance / 1e8) * btcPrice.eur;
                    await storage.createDailyBitcoinSnapshot({
                      peerId: child.id,
                      connectionId: child.connectionId,
                      valueEur: Math.round(valueEur * 100),
                      satoshiAmount: bonusBalance,
                      btcPrice: Math.round(btcPrice.eur * 100)
                    });
                    console.log(`[Level Bonus Snapshot] ✓ Created for ${child.name}: ${bonusSettings.bonusSats} sats (task approval)`);
                  } catch (snapshotError) {
                    console.error(`[Level Bonus Snapshot] ✗ Failed:`, snapshotError);
                  }

                  // Send push notification for level up
                  try {
                    await notifyLevelUp(child.id, currentLevel, bonusSettings.bonusSats);
                  } catch (pushError) {
                    console.warn("[Push] Failed to notify level up:", pushError);
                  }

                  // Try to send bonus via Lightning if configured (decrypt wallet data)
                  if (child.lightningAddress) {
                    const decryptedNwcBonus = decryptWalletData(parent.nwcConnectionString || "");
                    const decryptedLnbitsBonus = decryptWalletData(parent.lnbitsAdminKey || "");
                    const activeWallet = parent.walletType || (parent.lnbitsUrl ? "lnbits" : decryptedNwcBonus ? "nwc" : null);
                    try {
                      if (activeWallet === "nwc" && decryptedNwcBonus) {
                        const { NWCClient } = await import("./nwc");
                        const nwc = new NWCClient(decryptedNwcBonus);
                        await nwc.payToLightningAddress(
                          child.lightningAddress,
                          bonusSettings.bonusSats,
                          `Level ${currentLevel} Bonus!`
                        );
                        nwc.close();
                        console.log(`[Level Bonus] NWC payment sent for Level ${currentLevel} bonus`);
                      } else if (parent.lnbitsUrl && decryptedLnbitsBonus) {
                        const parentLnbits = new LNBitsClient(parent.lnbitsUrl, decryptedLnbitsBonus);
                        await parentLnbits.payToLightningAddress(
                          bonusSettings.bonusSats,
                          child.lightningAddress,
                          `Level ${currentLevel} Bonus!`
                        );
                        console.log(`[Level Bonus] LNbits payment sent for Level ${currentLevel} bonus`);
                      }
                    } catch (bonusPayError) {
                      console.warn("[Level Bonus] Lightning payment failed:", bonusPayError);
                    }
                  }
                }
              }
            }
          }
        } catch (bonusError) {
          console.error("[Level Bonus] Error checking/paying bonus:", bonusError);
        }

        // Try to send payment if both wallet and lightning address are configured (decrypt wallet data)
        if (child.lightningAddress) {
          const decryptedNwcPayment = decryptWalletData(parent.nwcConnectionString || "");
          const decryptedLnbitsPayment = decryptWalletData(parent.lnbitsAdminKey || "");
          const activeWallet = parent.walletType || (parent.lnbitsUrl ? "lnbits" : decryptedNwcPayment ? "nwc" : null);
          try {
            if (activeWallet === "nwc" && decryptedNwcPayment) {
              const { NWCClient } = await import("./nwc");
              const nwc = new NWCClient(decryptedNwcPayment);
              paymentHash = await nwc.payToLightningAddress(
                child.lightningAddress,
                task.sats,
                `Task: ${task.title}`
              );
              nwc.close();
              console.log(`[Task Payment] NWC payment sent for task ${task.title}`);
            } else if (parent.lnbitsUrl && decryptedLnbitsPayment) {
              const parentLnbits = new LNBitsClient(parent.lnbitsUrl, decryptedLnbitsPayment);
              paymentHash = await parentLnbits.payToLightningAddress(
                task.sats,
                child.lightningAddress,
                `Task: ${task.title}`
              );
              console.log(`[Task Payment] LNbits payment sent for task ${task.title}`);
            }

            if (paymentHash) {
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
            } else {
              // No Lightning payment but still record transaction for statistics
              await storage.createTransaction({
                fromPeerId: task.createdBy,
                toPeerId: child.id,
                sats: task.sats,
                taskId: task.id,
                type: "task_payment",
                status: "internal",
                paymentHash: null,
              });
              console.log(`[Task Payment] Internal transaction recorded (no Lightning payment)`);
            }
          } catch (error) {
            console.warn("Payment sending warning (but approval continues):", error);
            // Still record transaction even if Lightning fails
            await storage.createTransaction({
              fromPeerId: task.createdBy,
              toPeerId: child.id,
              sats: task.sats,
              taskId: task.id,
              type: "task_payment",
              status: "internal",
              paymentHash: null,
            });
            
            // Record failed payment for parent to retry later
            await storage.createFailedPayment({
              connectionId: task.connectionId,
              fromPeerId: task.createdBy,
              toPeerId: child.id,
              toName: child.name,
              toLightningAddress: child.lightningAddress || null,
              sats: task.sats,
              paymentType: "task",
              taskId: task.id,
              errorMessage: (error as Error).message,
              status: "pending"
            });
            console.log(`[Failed Payment] Recorded failed task payment for ${child.name}: ${task.sats} sats`);
            
            // Send push notification to parents about failed payment
            try {
              await notifyPaymentFailed(task.connectionId, child.name, task.sats, "task", (error as Error).message);
            } catch (pushError) {
              console.warn("[Push] Failed to notify payment failed:", pushError);
            }
          }
        } else {
          // No lightning address - record internal transaction for statistics
          await storage.createTransaction({
            fromPeerId: task.createdBy,
            toPeerId: child.id,
            sats: task.sats,
            taskId: task.id,
            type: "task_payment",
            status: "internal",
            paymentHash: null,
          });
          console.log(`[Task Payment] Internal transaction recorded for ${child.name} (no Lightning address)`);
        }
        
        // Create Bitcoin snapshot for task payment
        try {
          const btcPrice = await getFreshBitcoinPrice();
          const valueEur = (newBalance / 1e8) * btcPrice.eur;
          await storage.createDailyBitcoinSnapshot({
            peerId: child.id,
            connectionId: child.connectionId,
            valueEur: Math.round(valueEur * 100),
            satoshiAmount: newBalance,
            btcPrice: Math.round(btcPrice.eur * 100)
          });
          console.log(`[Task Payment Snapshot] ✓ Created for ${child.name}: ${task.sats} sats, €${valueEur.toFixed(2)}`);
        } catch (snapshotError) {
          console.error(`[Task Payment Snapshot] ✗ Failed:`, snapshotError);
        }

        // Send push notification for task approved
        try {
          await notifyTaskApproved(child.id, task.title, task.sats);
        } catch (pushError) {
          console.warn("[Push] Failed to notify task approved:", pushError);
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

      const passwordValidation = validatePassword(newPin);
      if (!parentId || !passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.error || "Gültiges Passwort erforderlich" });
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
      res.json({ success: true, child: sanitizePeerForClient(updatedChild) });
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

      // Send push notification for task submitted
      try {
        const child = task.assignedTo ? await storage.getPeer(task.assignedTo) : null;
        if (child && task.connectionId) {
          await notifyTaskSubmitted(task.connectionId, child.name, task.title);
        }
      } catch (pushError) {
        console.warn("[Push] Failed to notify task submitted:", pushError);
      }

      res.json({ success: true, proof: updatedTask?.proof });
    } catch (error) {
      console.error("Upload proof error:", error);
      res.status(500).json({ error: "Failed to upload proof" });
    }
  });

  // Submit task without proof (optional photo)
  app.put("/api/tasks/:id/submit", async (req, res) => {
    try {
      const { id } = req.params;

      const taskId = parseInt(id);
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Update task status to submitted (proof remains null if not provided)
      const updatedTask = await storage.updateTask(taskId, {
        status: "submitted"
      });

      // Send push notification for task submitted
      try {
        const child = task.assignedTo ? await storage.getPeer(task.assignedTo) : null;
        if (child && task.connectionId) {
          await notifyTaskSubmitted(task.connectionId, child.name, task.title);
        }
      } catch (pushError) {
        console.warn("[Push] Failed to notify task submitted:", pushError);
      }

      res.json({ success: true, task: updatedTask });
    } catch (error) {
      console.error("Submit task error:", error);
      res.status(500).json({ error: "Failed to submit task" });
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
      const decryptedNwcWithdraw = decryptWalletData(parent?.nwcConnectionString || "");
      const decryptedLnbitsWithdraw = decryptWalletData(parent?.lnbitsAdminKey || "");
      const hasLnbits = parent?.lnbitsUrl && decryptedLnbitsWithdraw;
      const hasNwc = !!decryptedNwcWithdraw;
      const activeWallet = parent?.walletType || (hasLnbits ? "lnbits" : hasNwc ? "nwc" : null);

      if (!hasLnbits && !hasNwc) {
        return res.status(500).json({ error: "Parent wallet not configured" });
      }

      try {
        if (activeWallet === "nwc" && hasNwc) {
          const { NWCClient } = await import("./nwc");
          const nwc = new NWCClient(decryptedNwcWithdraw);
          paymentHash = await nwc.payInvoice(paymentRequest);
          nwc.close();
        } else if (hasLnbits) {
          const parentLnbits = new LNBitsClient(parent!.lnbitsUrl!, decryptedLnbitsWithdraw);
          paymentHash = await parentLnbits.payInvoice(paymentRequest);
        }
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

  // Family Events (includes birthdays as recurring annual events)
  app.get("/api/events/:connectionId", async (req, res) => {
    try {
      const { connectionId } = req.params;
      const events = await storage.getFamilyEvents(connectionId);
      
      // Fetch birthdays and convert them to virtual calendar events
      const birthdays = await storage.getBirthdayReminders(connectionId);
      const today = new Date();
      const currentYear = today.getFullYear();
      
      // Generate birthday events for current year and next year
      const birthdayEvents = birthdays.flatMap((birthday) => {
        const eventsForBirthday = [];
        
        // Current year birthday
        const thisYearDate = new Date(currentYear, birthday.birthMonth - 1, birthday.birthDay);
        eventsForBirthday.push({
          id: -birthday.id, // Negative ID to distinguish from real events
          connectionId: birthday.connectionId,
          title: `🎂 ${birthday.personName}`,
          description: birthday.relation ? `${birthday.relation}${birthday.birthYear ? ` - ${currentYear - birthday.birthYear} Jahre` : ""}` : (birthday.birthYear ? `${currentYear - birthday.birthYear} Jahre` : ""),
          startDate: thisYearDate,
          endDate: null,
          location: null,
          color: "pink",
          eventType: "birthday",
          createdBy: birthday.createdBy,
          createdAt: birthday.createdAt,
          updatedAt: birthday.updatedAt,
          birthdayId: birthday.id, // Reference to original birthday
        });
        
        // Next year birthday
        const nextYearDate = new Date(currentYear + 1, birthday.birthMonth - 1, birthday.birthDay);
        eventsForBirthday.push({
          id: -(birthday.id + 100000), // Different negative ID for next year
          connectionId: birthday.connectionId,
          title: `🎂 ${birthday.personName}`,
          description: birthday.relation ? `${birthday.relation}${birthday.birthYear ? ` - ${currentYear + 1 - birthday.birthYear} Jahre` : ""}` : (birthday.birthYear ? `${currentYear + 1 - birthday.birthYear} Jahre` : ""),
          startDate: nextYearDate,
          endDate: null,
          location: null,
          color: "pink",
          eventType: "birthday",
          createdBy: birthday.createdBy,
          createdAt: birthday.createdAt,
          updatedAt: birthday.updatedAt,
          birthdayId: birthday.id,
        });
        
        return eventsForBirthday;
      });
      
      // Combine regular events with birthday events
      const allEvents = [...events, ...birthdayEvents];
      res.json(allEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
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

      // Send push notification for new event
      try {
        await notifyNewEvent(data.connectionId, data.title, data.createdBy);
      } catch (pushError) {
        console.warn("[Push] Failed to notify new event:", pushError);
      }

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

      // Send push notification for new chat message
      try {
        const sender = await storage.getPeer(fromPeerId);
        if (sender) {
          await notifyNewChatMessage(connectionId, sender.name, message, fromPeerId);
        }
      } catch (pushError) {
        console.warn("[Push] Failed to notify new chat message:", pushError);
      }

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
      res.json(sanitizePeersForClient(children));
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
      res.json(sanitizePeersForClient(children));
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
      const decryptedNwcAllowance = decryptWalletData(parent?.nwcConnectionString || "");
      const decryptedLnbitsAllowance = decryptWalletData(parent?.lnbitsAdminKey || "");
      const hasLnbits = parent?.lnbitsUrl && decryptedLnbitsAllowance;
      const hasNwc = !!decryptedNwcAllowance;
      const activeWallet = parent?.walletType || (hasLnbits ? "lnbits" : hasNwc ? "nwc" : null);
      
      if (!hasLnbits && !hasNwc) {
        return res.status(400).json({ error: "Keine Wallet konfiguriert (LNbits oder NWC)" });
      }

      const child = await storage.getPeer(childId);
      if (!child || !child.lightningAddress) {
        return res.status(400).json({ error: "Kind hat keine Lightning-Adresse" });
      }

      let paymentHash = "";
      if (activeWallet === "nwc" && hasNwc) {
        console.log("[Payout] Using NWC for allowance payment");
        const { NWCClient } = await import("./nwc");
        const nwc = new NWCClient(decryptedNwcAllowance);
        paymentHash = await nwc.payToLightningAddress(child.lightningAddress, sats, `Taschengeld für ${child.name}`);
        nwc.close();
      } else if (hasLnbits) {
        console.log("[Payout] Using LNbits for allowance payment");
        const lnbits = new LNBitsClient(parent!.lnbitsUrl!, decryptedLnbitsAllowance);
        paymentHash = await lnbits.payToLightningAddress(sats, child.lightningAddress, `Taschengeld für ${child.name}`);
      }
      
      // Update child's balance
      const newBalance = (child.balance || 0) + sats;
      await storage.updateBalance(child.id, newBalance);

      // Create transaction for sats breakdown tracking
      await storage.createTransaction({
        fromPeerId: parentId,
        toPeerId: child.id,
        sats,
        type: "allowance_payout",
        taskId: null,
        paymentHash: paymentHash,
        status: "completed"
      });

      // Create Bitcoin snapshot for allowance payment
      try {
        const btcPrice = await getFreshBitcoinPrice();
        const valueEur = (newBalance / 1e8) * btcPrice.eur;
        await storage.createDailyBitcoinSnapshot({
          peerId: child.id,
          connectionId: child.connectionId,
          valueEur: Math.round(valueEur * 100),
          satoshiAmount: newBalance,
          btcPrice: Math.round(btcPrice.eur * 100)
        });
        console.log(`[Allowance Snapshot] ✓ Created for ${child.name}: ${sats} sats, €${valueEur.toFixed(2)}`);
      } catch (snapshotError) {
        console.error(`[Allowance Snapshot] ✗ Failed:`, snapshotError);
      }

      // Send push notification for allowance payment
      try {
        await notifyPaymentReceived(child.id, sats, 'Taschengeld');
      } catch (pushError) {
        console.warn("[Push] Failed to notify allowance payment:", pushError);
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
      const decryptedNwcInstant = decryptWalletData(parent?.nwcConnectionString || "");
      const decryptedLnbitsInstant = decryptWalletData(parent?.lnbitsAdminKey || "");
      const hasLnbits = parent?.lnbitsUrl && decryptedLnbitsInstant;
      const hasNwc = !!decryptedNwcInstant;
      const activeWallet = parent?.walletType || (hasLnbits ? "lnbits" : hasNwc ? "nwc" : null);
      
      if (!hasLnbits && !hasNwc) {
        return res.status(400).json({ error: "Keine Wallet konfiguriert (LNbits oder NWC)" });
      }

      const child = await storage.getPeer(childId);
      if (!child || !child.lightningAddress) {
        return res.status(400).json({ error: "Kind hat keine Lightning-Adresse" });
      }

      const memo = message || `Sofortzahlung für ${child.name}`;
      let paymentHash = "";
      
      if (activeWallet === "nwc" && hasNwc) {
        console.log("[Payout] Using NWC for instant payment");
        const { NWCClient } = await import("./nwc");
        const nwc = new NWCClient(decryptedNwcInstant);
        paymentHash = await nwc.payToLightningAddress(child.lightningAddress, sats, memo);
        nwc.close();
      } else if (hasLnbits) {
        console.log("[Payout] Using LNbits for instant payment");
        const lnbits = new LNBitsClient(parent!.lnbitsUrl!, decryptedLnbitsInstant);
        paymentHash = await lnbits.payToLightningAddress(sats, child.lightningAddress, memo);
      }

      // Update child's balance
      const newBalance = (child.balance || 0) + sats;
      await storage.updateBalance(child.id, newBalance);

      // Create transaction for sats breakdown tracking
      await storage.createTransaction({
        fromPeerId: parentId,
        toPeerId: child.id,
        sats,
        type: "instant_payout",
        taskId: null,
        paymentHash: paymentHash,
        status: "completed"
      });

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
          satoshiAmount: newBalance,
          btcPrice: Math.round(btcPrice.eur * 100) // Store BTC price in cents
        });
        console.log(`[Instant Payout Snapshot] ✓ Created for ${child.name}: €${valueEur.toFixed(2)}`);
      } catch (snapshotError) {
        console.error(`[Instant Payout Snapshot] ✗ Failed for ${child.name}:`, snapshotError);
      }

      // Send push notification for instant payment
      try {
        await notifyPaymentReceived(child.id, sats, message || 'Sofortzahlung');
      } catch (pushError) {
        console.warn("[Push] Failed to notify instant payment:", pushError);
      }

      res.json({ success: true, paymentHash });
    } catch (error) {
      console.error("Instant payout error:", error);
      
      // Record failed instant payment for parent to retry later
      try {
        const parentId = parseInt(req.params.id);
        const { childId, sats, message } = req.body;
        const parent = await storage.getPeer(parentId);
        const child = await storage.getPeer(childId);
        if (parent && child) {
          await storage.createFailedPayment({
            connectionId: parent.connectionId,
            fromPeerId: parentId,
            toPeerId: childId,
            toName: child.name,
            toLightningAddress: child.lightningAddress || null,
            sats,
            paymentType: "instant",
            taskId: null,
            errorMessage: (error as Error).message,
            status: "pending"
          });
          console.log(`[Failed Payment] Recorded failed instant payment for ${child.name}: ${sats} sats`);
          
          // Send push notification to parents about failed payment
          try {
            await notifyPaymentFailed(parent.connectionId, child.name, sats, "instant", (error as Error).message);
          } catch (pushError) {
            console.warn("[Push] Failed to notify payment failed:", pushError);
          }
        }
      } catch (recordError) {
        console.error("[Failed Payment] Error recording failed payment:", recordError);
      }
      
      res.status(500).json({ error: String(error) });
    }
  });

  // Get tracker data for a child (from daily Bitcoin snapshots for accurate historical data)
  app.get("/api/tracker/:childId", async (req, res) => {
    try {
      const childId = parseInt(req.params.childId);
      const child = await storage.getPeer(childId);
      
      if (!child || child.role !== "child") {
        return res.status(404).json({ error: "Child not found" });
      }

      // Use daily snapshots - they already have the correct historical BTC price
      const snapshots = await storage.getDailyBitcoinSnapshots(childId);
      
      if (snapshots.length === 0) {
        return res.json([]);
      }

      // Convert snapshots to tracker format with stored BTC price
      const trackerEntries = snapshots.map(s => {
        const euroValue = s.valueEur / 100; // Convert from cents to euros
        // Use stored BTC price if available, otherwise fallback to reverse calculation for legacy snapshots
        const btcPrice = s.btcPrice ? (s.btcPrice / 100) : ((euroValue * 1e8) / s.satoshiAmount);
        return {
          date: new Date(s.createdAt).toLocaleDateString("de-DE", { month: "short", day: "numeric" }),
          timestamp: s.createdAt,
          totalSats: s.satoshiAmount,
          btcPrice: btcPrice,
          euroValue: euroValue
        };
      });
      
      res.json(trackerEntries);
    } catch (error) {
      console.error("[Tracker Error]:", error);
      res.status(500).json({ error: "Failed to fetch tracker data" });
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

      const decryptedNwcCron = decryptWalletData(parent?.nwcConnectionString || "");
      const decryptedLnbitsCron = decryptWalletData(parent?.lnbitsAdminKey || "");
      const hasLnbits = parent?.lnbitsUrl && decryptedLnbitsCron;
      const hasNwc = !!decryptedNwcCron;
      const activeWallet = parent?.walletType || (hasLnbits ? "lnbits" : hasNwc ? "nwc" : null);

      if (!hasLnbits && !hasNwc) {
        console.error(`Parent ${allowance.parentId} not configured with LNBits or NWC`);
        return;
      }

      if (!child || !child.lightningAddress) {
        console.error(`Child ${allowance.childId} has no Lightning address`);
        return;
      }

      let paymentHash = "";
      if (activeWallet === "nwc" && hasNwc) {
        const { NWCClient } = await import("./nwc");
        const nwc = new NWCClient(decryptedNwcCron);
        paymentHash = await nwc.payToLightningAddress(
          child.lightningAddress,
          allowance.sats,
          `Automatisches Taschengeld für ${child.name}`
        );
        nwc.close();
      } else if (hasLnbits) {
        const lnbits = new LNBitsClient(parent!.lnbitsUrl!, decryptedLnbitsCron);
        paymentHash = await lnbits.payToLightningAddress(
          allowance.sats,
          child.lightningAddress,
          `Automatisches Taschengeld für ${child.name}`
        );
      }

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
          satoshiAmount: newBalance,
          btcPrice: Math.round(btcPrice.eur * 100) // Store BTC price in cents
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
      
      // Record failed allowance payment for parent to retry later
      const parent = await storage.getPeer(allowance.parentId);
      const child = await storage.getPeer(allowance.childId);
      if (parent && child) {
        await storage.createFailedPayment({
          connectionId: parent.connectionId,
          fromPeerId: allowance.parentId,
          toPeerId: allowance.childId,
          toName: child.name,
          toLightningAddress: child.lightningAddress || null,
          sats: allowance.sats,
          paymentType: "allowance",
          taskId: null,
          errorMessage: (error as Error).message,
          status: "pending"
        });
        console.log(`[Failed Payment] Recorded failed allowance payment for ${child.name}: ${allowance.sats} sats`);
        
        // Send push notification to parents about failed payment
        try {
          await notifyPaymentFailed(parent.connectionId, child.name, allowance.sats, "allowance", (error as Error).message);
        } catch (pushError) {
          console.warn("[Push] Failed to notify payment failed:", pushError);
        }
      }
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

  // Start automatic allowance payout scheduler (runs daily at 8:00 AM)
  cron.schedule("0 8 * * *", async () => {
    console.log("[Allowance Scheduler] Daily payout check started at 8:00 AM");
    try {
      // Get all active allowances
      const allPeers = await db.select().from(peers);
      const connectionIds = Array.from(new Set(allPeers.map((p: any) => p.connectionId)));

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
      console.log("[Allowance Scheduler] Daily payout check completed");
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

  // Get Level Bonus Settings for a family
  app.get("/api/level-bonus/settings/:connectionId", async (req, res) => {
    try {
      const settings = await storage.getLevelBonusSettings(req.params.connectionId);
      res.json(settings || null);
    } catch (error) {
      console.error("[Level Bonus Settings Error]:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Create or update Level Bonus Settings
  app.post("/api/level-bonus/settings", async (req, res) => {
    try {
      const { parentId, connectionId, bonusSats, milestoneInterval, isActive } = req.body;
      
      if (!parentId || !connectionId) {
        return res.status(400).json({ error: "parentId and connectionId required" });
      }

      const settings = await storage.createOrUpdateLevelBonusSettings({
        parentId,
        connectionId,
        bonusSats: bonusSats || 210,
        milestoneInterval: milestoneInterval || 5,
        isActive: isActive !== false
      });

      res.json(settings);
    } catch (error) {
      console.error("[Level Bonus Settings Error]:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Get Level Bonus Payouts for a child
  app.get("/api/level-bonus/payouts/:childId", async (req, res) => {
    try {
      const payouts = await storage.getLevelBonusPayouts(parseInt(req.params.childId));
      res.json(payouts);
    } catch (error) {
      console.error("[Level Bonus Payouts Error]:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Check and pay level bonus (called when a child levels up)
  app.post("/api/level-bonus/check-and-pay", async (req, res) => {
    try {
      const { childId, currentLevel, connectionId } = req.body;
      
      if (!childId || currentLevel === undefined || !connectionId) {
        return res.status(400).json({ error: "childId, currentLevel, and connectionId required" });
      }

      // Get bonus settings for this family
      const settings = await storage.getLevelBonusSettings(connectionId);
      if (!settings || !settings.isActive) {
        return res.json({ bonusPaid: false, reason: "No active level bonus settings" });
      }

      // Check if this level is a milestone
      if (currentLevel === 0 || currentLevel % settings.milestoneInterval !== 0) {
        return res.json({ bonusPaid: false, reason: "Not a milestone level" });
      }

      // Check if bonus was already paid for this level
      const alreadyPaid = await storage.hasLevelBonusBeenPaid(childId, currentLevel);
      if (alreadyPaid) {
        return res.json({ bonusPaid: false, reason: "Bonus already paid for this level" });
      }

      // Get child and parent info
      const child = await storage.getPeer(childId);
      if (!child) {
        return res.status(404).json({ error: "Child not found" });
      }

      // Find parent with wallet configured (prioritize parent with wallet)
      console.log(`[Level Bonus] Looking for parent with connectionId: ${connectionId}`);
      const allParents = await db.select().from(peers)
        .where(and(eq(peers.connectionId, connectionId), eq(peers.role, "parent")));
      
      // Find parent with wallet configured (LNBits or NWC)
      const parentWithWallet = allParents.find(p => (p.lnbitsUrl && p.lnbitsAdminKey) || p.nwcConnectionString);
      const parent = parentWithWallet ? [parentWithWallet] : allParents;
      
      const hasLnbits = parent[0]?.lnbitsUrl && parent[0]?.lnbitsAdminKey;
      const hasNwc = parent[0]?.nwcConnectionString;
      const activeWallet = parent[0]?.walletType || (hasLnbits ? "lnbits" : hasNwc ? "nwc" : null);
      
      console.log(`[Level Bonus] Found ${allParents.length} parents, using wallet: ${activeWallet}`);

      if (!hasLnbits && !hasNwc) {
        console.log(`[Level Bonus] No wallet configured, using internal balance`);
        // No wallet configured - just update balance internally
        const newBalance = (child.balance || 0) + settings.bonusSats;
        await storage.updateBalance(childId, newBalance);
        
        // Record the payout
        await storage.createLevelBonusPayout({
          childId,
          connectionId,
          level: currentLevel,
          sats: settings.bonusSats
        });

        // Create Bitcoin snapshot for level bonus
        try {
          const btcPrice = await getFreshBitcoinPrice();
          const valueEur = (newBalance / 1e8) * btcPrice.eur;
          await storage.createDailyBitcoinSnapshot({
            peerId: child.id,
            connectionId: child.connectionId,
            valueEur: Math.round(valueEur * 100),
            satoshiAmount: newBalance,
            btcPrice: Math.round(btcPrice.eur * 100)
          });
          console.log(`[Level Bonus Snapshot] ✓ Created for ${child.name}: ${settings.bonusSats} sats, €${valueEur.toFixed(2)}`);
        } catch (snapshotError) {
          console.error(`[Level Bonus Snapshot] ✗ Failed:`, snapshotError);
        }

        return res.json({ 
          bonusPaid: true, 
          sats: settings.bonusSats,
          level: currentLevel,
          paymentMethod: "internal"
        });
      }

      // Try to pay via Lightning if child has lightning address
      console.log(`[Level Bonus] Child lightning address: ${child.lightningAddress}`);
      
      if (child.lightningAddress) {
        try {
          console.log(`[Level Bonus] Attempting Lightning payment of ${settings.bonusSats} sats to ${child.lightningAddress} via ${activeWallet}`);
          let paymentResult = "";
          
          if (activeWallet === "nwc" && hasNwc) {
            const { NWCClient } = await import("./nwc");
            const nwc = new NWCClient(parent[0].nwcConnectionString!);
            paymentResult = await nwc.payToLightningAddress(child.lightningAddress, settings.bonusSats, `Level ${currentLevel} Bonus!`);
            nwc.close();
          } else if (hasLnbits) {
            const lnbits = new LNBitsClient(parent[0].lnbitsUrl!, parent[0].lnbitsAdminKey!);
            paymentResult = await lnbits.payToLightningAddress(settings.bonusSats, child.lightningAddress, `Level ${currentLevel} Bonus!`);
          }
          
          console.log(`[Level Bonus] Lightning payment SUCCESS! Hash: ${paymentResult}`);
          
          // Record the payout
          await storage.createLevelBonusPayout({
            childId,
            connectionId,
            level: currentLevel,
            sats: settings.bonusSats
          });

          // Create Bitcoin snapshot for level bonus (Lightning)
          try {
            const btcPrice = await getFreshBitcoinPrice();
            const virtualBalance = (child.balance || 0) + settings.bonusSats;
            const valueEur = (virtualBalance / 1e8) * btcPrice.eur;
            await storage.createDailyBitcoinSnapshot({
              peerId: child.id,
              connectionId: child.connectionId,
              valueEur: Math.round(valueEur * 100),
              satoshiAmount: virtualBalance,
              btcPrice: Math.round(btcPrice.eur * 100)
            });
            console.log(`[Level Bonus Snapshot] ✓ Created for ${child.name}: ${settings.bonusSats} sats (Lightning)`);
          } catch (snapshotError) {
            console.error(`[Level Bonus Snapshot] ✗ Failed:`, snapshotError);
          }

          return res.json({ 
            bonusPaid: true, 
            sats: settings.bonusSats,
            level: currentLevel,
            paymentMethod: "lightning"
          });
        } catch (payError) {
          console.error("[Level Bonus Lightning Payment FAILED]:", payError);
          // Fall back to internal balance
        }
      } else {
        console.log("[Level Bonus] No lightning address configured, using internal balance");
      }

      // Fallback: update internal balance
      const newBalance = (child.balance || 0) + settings.bonusSats;
      await storage.updateBalance(childId, newBalance);
      
      // Record the payout
      await storage.createLevelBonusPayout({
        childId,
        connectionId,
        level: currentLevel,
        sats: settings.bonusSats
      });

      // Create Bitcoin snapshot for level bonus (fallback)
      try {
        const btcPrice = await getFreshBitcoinPrice();
        const valueEur = (newBalance / 1e8) * btcPrice.eur;
        await storage.createDailyBitcoinSnapshot({
          peerId: child.id,
          connectionId: child.connectionId,
          valueEur: Math.round(valueEur * 100),
          satoshiAmount: newBalance,
          btcPrice: Math.round(btcPrice.eur * 100)
        });
        console.log(`[Level Bonus Snapshot] ✓ Created for ${child.name}: ${settings.bonusSats} sats (fallback)`);
      } catch (snapshotError) {
        console.error(`[Level Bonus Snapshot] ✗ Failed:`, snapshotError);
      }

      res.json({ 
        bonusPaid: true, 
        sats: settings.bonusSats,
        level: currentLevel,
        paymentMethod: "internal"
      });
    } catch (error) {
      console.error("[Level Bonus Check Error]:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Manual endpoint to test recurring tasks (DEBUG)
  app.post("/api/recurring-tasks/test-create", async (req, res) => {
    try {
      const allRecurringTasks = await db.select().from(recurringTasks).where(eq(recurringTasks.isActive, true));
      console.log(`[DEBUG] Found ${allRecurringTasks.length} recurring tasks`);
      
      let created = 0;
      const now = new Date();
      
      for (const recurring of allRecurringTasks) {
        const shouldCreate = checkIfTaskShouldBeCreated(recurring, now);
        if (shouldCreate) {
          const newTask = await storage.createTask({
            connectionId: recurring.connectionId,
            createdBy: recurring.createdBy,
            title: recurring.title,
            description: recurring.description || "",
            sats: recurring.sats || 0,
            status: "open"
          });
          await storage.updateRecurringTask(recurring.id, { lastCreatedDate: new Date() });
          created++;
          console.log(`[DEBUG] Created: ${recurring.title}`);
        }
      }
      
      res.json({ checked: allRecurringTasks.length, created });
    } catch (error) {
      console.error("[DEBUG ERROR]:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Recurring tasks scheduler (checks every 1 minute) - using setInterval as fallback
  console.log("[Startup] Cron scheduler registered for recurring tasks");
  
  // Fallback: Check every 60 seconds using setInterval
  setInterval(async () => {
    try {
      const allRecurringTasks = await db.select().from(recurringTasks).where(eq(recurringTasks.isActive, true));
      
      if (allRecurringTasks.length === 0) return;
      
      console.log(`[RECURRING CHECK] ${new Date().toLocaleTimeString('de-DE')} - Tasks: ${allRecurringTasks.length}`);
      const now = new Date();
      
      for (const recurring of allRecurringTasks) {
        const shouldCreate = checkIfTaskShouldBeCreated(recurring, now);
        
        if (shouldCreate) {
          try {
            const newTask = await storage.createTask({
              connectionId: recurring.connectionId,
              createdBy: recurring.createdBy,
              title: recurring.title,
              description: recurring.description || "",
              sats: recurring.sats || 0,
              status: "open"
            });
            
            await storage.updateRecurringTask(recurring.id, { lastCreatedDate: new Date() });
            console.log(`[RECURRING] ✅ Created: "${recurring.title}"`);
          } catch (err) {
            console.error(`[RECURRING ERROR] ${recurring.title}:`, err);
          }
        }
      }
    } catch (error) {
      console.error("[RECURRING FATAL]:", error);
    }
  }, 60000);
  
  console.log("[Startup] Recurring tasks scheduler ACTIVE with setInterval");

  function checkIfTaskShouldBeCreated(recurring: any, now: Date): boolean {
    // Convert to Berlin timezone
    const berlinTime = getBerlinTime(now);
    const lastCreated = recurring.lastCreatedDate ? getBerlinTime(new Date(recurring.lastCreatedDate)) : null;
    
    const [hours, minutes] = recurring.time.split(":").map(Number);
    
    const taskTime = new Date(berlinTime);
    taskTime.setHours(hours, minutes, 0, 0);
    
    const today = berlinTime.toDateString();
    const lastCreatedDate = lastCreated ? lastCreated.toDateString() : null;
    
    // Only proceed if we haven't created today yet
    if (today === lastCreatedDate) return false;
    
    // Check if current time has passed the scheduled time
    if (berlinTime < taskTime) return false;
    
    if (recurring.frequency === "daily") {
      return true;
    } else if (recurring.frequency === "weekly") {
      return berlinTime.getDay() === recurring.dayOfWeek;
    } else if (recurring.frequency === "monthly") {
      return berlinTime.getDate() === (recurring.dayOfMonth || 1);
    }
    return false;
  }

  // Need to import recurringTasks at top
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

  // Learning Progress Endpoints
  app.get("/api/learning-progress/:peerId", async (req, res) => {
    try {
      const peerId = parseInt(req.params.peerId);
      let progress = await storage.getLearningProgress(peerId);
      
      if (!progress) {
        progress = await storage.createLearningProgress({ 
          peerId, 
          xp: 0, 
          level: 1, 
          streak: 0, 
          longestStreak: 0 
        });
      }
      
      if (!progress.graduatedAt) {
        const completedModules = progress.completedModules || [];
        if (completedModules.length >= 20) {
          const graduationResult = await storage.checkAndProcessGraduation(peerId);
          if (graduationResult.graduated && graduationResult.newProgress) {
            progress = graduationResult.newProgress;
          }
        }
      }
      
      res.json(progress);
    } catch (error) {
      console.error("Error fetching learning progress:", error);
      res.status(500).json({ error: "Failed to fetch learning progress" });
    }
  });

  app.post("/api/learning-progress/:peerId/add-xp", async (req, res) => {
    try {
      const peerId = parseInt(req.params.peerId);
      const { xp, moduleId, achievementId } = req.body;
      
      if (!xp || xp <= 0) {
        return res.status(400).json({ error: "XP amount required" });
      }

      const progress = await storage.addXpAndCheckLevel(peerId, xp);
      
      if (moduleId) {
        await storage.completeModule(peerId, moduleId);
      }
      
      if (achievementId) {
        await storage.unlockAchievement(peerId, achievementId);
      }

      await storage.updateStreak(peerId);
      
      const updatedProgress = await storage.getLearningProgress(peerId);
      res.json(updatedProgress);
    } catch (error) {
      console.error("Error adding XP:", error);
      res.status(500).json({ error: "Failed to add XP" });
    }
  });

  app.post("/api/learning-progress/:peerId/unlock-achievement", async (req, res) => {
    try {
      const peerId = parseInt(req.params.peerId);
      const { achievementId } = req.body;
      
      if (!achievementId) {
        return res.status(400).json({ error: "Achievement ID required" });
      }

      const progress = await storage.unlockAchievement(peerId, achievementId);
      res.json(progress);
    } catch (error) {
      console.error("Error unlocking achievement:", error);
      res.status(500).json({ error: "Failed to unlock achievement" });
    }
  });

  app.post("/api/learning-progress/:peerId/complete-daily", async (req, res) => {
    try {
      const peerId = parseInt(req.params.peerId);
      const { xp } = req.body;
      
      await storage.updateStreak(peerId);
      
      const currentProgress = await storage.getLearningProgress(peerId);
      if (currentProgress) {
        await storage.updateLearningProgress(peerId, {
          dailyChallengesCompleted: currentProgress.dailyChallengesCompleted + 1,
          totalSatsEarned: currentProgress.totalSatsEarned + (xp || 0)
        });
      }
      
      if (xp && xp > 0) {
        await storage.addXpAndCheckLevel(peerId, xp);
      }
      
      const updatedProgress = await storage.getLearningProgress(peerId);
      res.json(updatedProgress);
    } catch (error) {
      console.error("Error completing daily challenge:", error);
      res.status(500).json({ error: "Failed to complete daily challenge" });
    }
  });

  app.get("/api/learning-progress/:peerId/graduation-status", async (req, res) => {
    try {
      const peerId = parseInt(req.params.peerId);
      const result = await storage.checkAndProcessGraduation(peerId);
      res.json(result);
    } catch (error) {
      console.error("Error checking graduation status:", error);
      res.status(500).json({ error: "Failed to check graduation status" });
    }
  });

  app.post("/api/learning-progress/:peerId/claim-graduation-bonus", async (req, res) => {
    try {
      const peerId = parseInt(req.params.peerId);
      const { bonusSats = 2100 } = req.body;
      
      const progress = await storage.getLearningProgress(peerId);
      if (!progress || !progress.graduatedAt) {
        return res.status(400).json({ error: "Not graduated yet" });
      }
      if (progress.graduationBonusClaimed) {
        return res.status(400).json({ error: "Bonus already claimed" });
      }
      
      const child = await storage.getPeer(peerId);
      if (!child || child.role !== 'child') {
        return res.status(400).json({ error: "Invalid child account" });
      }
      
      const familyMembers = await storage.getPeersByConnectionId(child.connectionId);
      const parents = familyMembers.filter(p => p.role === 'parent');
      
      const nwcParents = parents.filter(p => p.nwcConnectionString);
      const lnbitsParents = parents.filter(p => p.lnbitsUrl && p.lnbitsAdminKey);
      
      if (nwcParents.length === 0 && lnbitsParents.length === 0) {
        const result = await storage.claimGraduationBonus(peerId, bonusSats);
        return res.json({ 
          success: true, 
          newBalance: result.newBalance,
          paymentMethod: 'internal',
          message: 'Bonus intern gutgeschrieben (kein Wallet konfiguriert)'
        });
      }
      
      let paymentHash = '';
      let paymentSuccess = false;
      let payingParentId = 0;
      let payingParentName = '';
      
      if (child.lightningAddress) {
        for (const nwcParent of nwcParents) {
          if (paymentSuccess) break;
          try {
            console.log(`[Graduation Bonus] Trying NWC payment from ${nwcParent.name}...`);
            const decryptedNwc = decryptWalletData(nwcParent.nwcConnectionString!);
            const nwc = new (await import('./nwc')).NWCClient(decryptedNwc);
            paymentHash = await nwc.payToLightningAddress(
              child.lightningAddress, 
              bonusSats, 
              `🎓 Satoshi Guardian Graduation Bonus für ${child.name}!`
            );
            paymentSuccess = true;
            payingParentId = nwcParent.id;
            payingParentName = nwcParent.name;
            console.log(`[Graduation Bonus] NWC payment from ${nwcParent.name} successful:`, paymentHash);
          } catch (nwcError) {
            console.error(`[Graduation Bonus] NWC payment from ${nwcParent.name} failed:`, nwcError);
          }
        }
        
        for (const lnbitsParent of lnbitsParents) {
          if (paymentSuccess) break;
          try {
            console.log(`[Graduation Bonus] Trying LNBits payment from ${lnbitsParent.name}...`);
            const decryptedUrl = decryptWalletData(lnbitsParent.lnbitsUrl!);
            const decryptedKey = decryptWalletData(lnbitsParent.lnbitsAdminKey!);
            const lnbits = new LNBitsClient(decryptedUrl, decryptedKey);
            paymentHash = await lnbits.payToLightningAddress(
              bonusSats, 
              child.lightningAddress, 
              `🎓 Satoshi Guardian Graduation Bonus für ${child.name}!`
            );
            paymentSuccess = true;
            payingParentId = lnbitsParent.id;
            payingParentName = lnbitsParent.name;
            console.log(`[Graduation Bonus] LNBits payment from ${lnbitsParent.name} successful:`, paymentHash);
          } catch (lnbitsError) {
            console.error(`[Graduation Bonus] LNBits payment from ${lnbitsParent.name} failed:`, lnbitsError);
          }
        }
        
        if (!paymentSuccess) {
          console.log("[Graduation Bonus] All Lightning payments failed, using internal balance only");
        }
      }
      
      const result = await storage.claimGraduationBonus(peerId, bonusSats);
      
      if (paymentSuccess && payingParentId > 0) {
        await storage.createTransaction({
          fromPeerId: payingParentId,
          toPeerId: peerId,
          sats: bonusSats,
          type: 'graduation_bonus',
          status: 'completed',
          paymentHash
        });
      }
      
      // Create Bitcoin snapshot for graduation bonus
      try {
        const btcPrice = await getFreshBitcoinPrice();
        const valueEur = (result.newBalance / 1e8) * btcPrice.eur;
        await storage.createDailyBitcoinSnapshot({
          peerId: child.id,
          connectionId: child.connectionId,
          valueEur: Math.round(valueEur * 100),
          satoshiAmount: result.newBalance,
          btcPrice: Math.round(btcPrice.eur * 100)
        });
        console.log(`[Graduation Bonus Snapshot] ✓ Created for ${child.name}: ${bonusSats} sats, €${valueEur.toFixed(2)}`);
      } catch (snapshotError) {
        console.error(`[Graduation Bonus Snapshot] ✗ Failed:`, snapshotError);
      }

      // Send push notification for graduation
      try {
        await notifyGraduation(child.connectionId || '', child.name);
      } catch (pushError) {
        console.warn("[Push] Failed to notify graduation:", pushError);
      }
      
      res.json({ 
        success: true, 
        newBalance: result.newBalance,
        paymentMethod: paymentSuccess ? 'lightning' : 'internal',
        paymentHash,
        payingParent: payingParentName || 'System'
      });
    } catch (error) {
      console.error("Error claiming graduation bonus:", error);
      res.status(500).json({ error: "Failed to claim graduation bonus" });
    }
  });

  app.post("/api/learning-progress/:peerId/mastery-complete", async (req, res) => {
    try {
      const peerId = parseInt(req.params.peerId);
      const { xp = 25 } = req.body;
      
      await storage.addXpAndCheckLevel(peerId, xp);
      const progress = await storage.incrementMasteryStreak(peerId);
      
      if (progress) {
        res.json(progress);
      } else {
        res.status(400).json({ error: "Not graduated yet" });
      }
    } catch (error) {
      console.error("Error completing mastery challenge:", error);
      res.status(500).json({ error: "Failed to complete mastery challenge" });
    }
  });

  // Donation endpoint - send sats to developer (FIXED with decryption like child payments)
  app.post("/api/donate/:peerId", async (req, res) => {
    try {
      const peerId = parseInt(req.params.peerId);
      const { sats } = req.body;
      
      if (!sats || sats < 10) {
        return res.status(400).json({ error: "Mindestens 10 Sats erforderlich" });
      }

      const peer = await storage.getPeer(peerId);
      if (!peer) {
        return res.status(404).json({ error: "User nicht gefunden" });
      }

      // DECRYPT wallet credentials (same as child payments!)
      const decryptedNwc = decryptWalletData(peer.nwcConnectionString || "");
      const decryptedLnbitsKey = decryptWalletData(peer.lnbitsAdminKey || "");
      const hasNwc = !!decryptedNwc;
      const hasLnbits = !!(peer.lnbitsUrl && decryptedLnbitsKey);
      const activeWallet = peer.walletType || (hasNwc ? "nwc" : hasLnbits ? "lnbits" : null);
      
      if (!hasLnbits && !hasNwc) {
        return res.status(400).json({ error: "Wallet nicht konfiguriert" });
      }

      let paymentHash = "";
      const memo = `Spende von ${peer.name}`;

      console.log("[Donation] Starting payment to", DEVELOPER_DONATION_ADDRESS, "amount:", sats, "sats");
      console.log("[Donation] Wallet config: activeWallet=", activeWallet, "hasNwc=", hasNwc, "hasLnbits=", hasLnbits);

      try {
        if (activeWallet === "nwc" && hasNwc) {
          console.log("[Donation] Using NWC for payment");
          const { NWCClient } = await import("./nwc");
          const nwc = new NWCClient(decryptedNwc);
          paymentHash = await nwc.payToLightningAddress(DEVELOPER_DONATION_ADDRESS, sats, memo);
          nwc.close();
          console.log("[Donation] NWC payment successful:", paymentHash);
        } else if (hasLnbits) {
          console.log("[Donation] Using LNbits for payment, URL:", peer.lnbitsUrl);
          const lnbits = new LNBitsClient(peer.lnbitsUrl!, decryptedLnbitsKey);
          paymentHash = await lnbits.payToLightningAddress(sats, DEVELOPER_DONATION_ADDRESS, memo);
          console.log("[Donation] LNbits payment successful:", paymentHash);
        } else if (hasNwc) {
          console.log("[Donation] Falling back to NWC");
          const { NWCClient } = await import("./nwc");
          const nwc = new NWCClient(decryptedNwc);
          paymentHash = await nwc.payToLightningAddress(DEVELOPER_DONATION_ADDRESS, sats, memo);
          nwc.close();
          console.log("[Donation] NWC fallback payment successful:", paymentHash);
        }

        // Record transaction (fromPeerId = parent who pays, toPeerId = null for external)
        await storage.createTransaction({
          fromPeerId: peerId,
          toPeerId: null,
          sats,
          type: "donation",
          description: `Spende: ${memo}`,
          paymentHash,
          status: "completed"
        });

        console.log("[Donation] Success:", { peerId, sats, paymentHash, address: DEVELOPER_DONATION_ADDRESS });
        res.json({ success: true, paymentHash, sats });
      } catch (walletError) {
        console.error("[Donation] Wallet error:", walletError);
        return res.status(400).json({ error: "Wallet-Fehler: " + (walletError as Error).message });
      }
    } catch (error) {
      console.error("[Donation] Error:", error);
      res.status(500).json({ error: "Spende fehlgeschlagen: " + (error as Error).message });
    }
  });

  // Shopping List endpoints
  app.get("/api/shopping-list/:connectionId", async (req, res) => {
    try {
      const { connectionId } = req.params;
      console.log("[Shopping List] Fetching list for:", connectionId);
      const items = await storage.getShoppingList(connectionId);
      res.json(items);
    } catch (error) {
      console.error("[Shopping List] Error fetching list:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to fetch shopping list" });
    }
  });

  app.post("/api/shopping-list", async (req, res) => {
    try {
      const { connectionId, createdBy, item, quantity } = req.body;
      console.log("[Shopping List] Creating item:", { connectionId, createdBy, item, quantity });
      const result = await storage.createShoppingListItem({
        connectionId,
        createdBy: parseInt(createdBy),
        item,
        quantity: quantity || null
      });
      res.json(result);
    } catch (error) {
      console.error("[Shopping List] Error creating item:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to create item" });
    }
  });

  app.patch("/api/shopping-list/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { completed, quantity } = req.body;
      const result = await storage.updateShoppingListItem(parseInt(id), {
        completed: completed !== undefined ? completed : undefined,
        quantity: quantity !== undefined ? quantity : undefined
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to update item" });
    }
  });

  app.delete("/api/shopping-list/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteShoppingListItem(parseInt(id));
      res.json({ success });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete item" });
    }
  });

  // Daily Challenge endpoints
  app.get("/api/daily-challenge/:peerId/:date", async (req, res) => {
    try {
      const { peerId, date } = req.params;
      const challenge = await storage.getTodayChallenge(parseInt(peerId), date);
      res.json(challenge || { challengeDate: date, completed: false });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch challenge" });
    }
  });

  app.post("/api/daily-challenge/complete", async (req, res) => {
    try {
      const { peerId, challengeType } = req.body;
      
      const todayDate = getBerlinTime().toISOString().split('T')[0];
      const existingChallenge = await storage.getTodayChallenge(parseInt(peerId), todayDate);
      
      if (existingChallenge?.completed) {
        return res.status(400).json({ error: "Challenge already completed today", alreadyCompleted: true });
      }
      
      const challenge = await storage.completeTodayChallenge(parseInt(peerId), todayDate, challengeType);
      const currentProgress = await storage.getLearningProgress(parseInt(peerId));
      const newCount = (currentProgress?.dailyChallengesCompleted || 0) + 1;
      const progress = await storage.updateLearningProgress(parseInt(peerId), { dailyChallengesCompleted: newCount });
      res.json({ challenge, progress });
    } catch (error) {
      res.status(500).json({ error: "Failed to complete challenge" });
    }
  });

  // ============================================================
  // DATA CLEANUP ENDPOINTS (PARENT ONLY)
  // CRITICAL: These routes NEVER delete transactions, balances, or XP data!
  // ============================================================

  // Cleanup chat messages only
  app.delete("/api/cleanup/chat/:connectionId", async (req, res) => {
    try {
      const { connectionId } = req.params;
      const { peerId } = req.body;
      
      const peer = await storage.getPeer(parseInt(peerId));
      if (!peer || peer.role !== 'parent') {
        return res.status(403).json({ error: "Only parents can delete data" });
      }
      if (peer.connectionId !== connectionId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const deleted = await storage.cleanupChatMessages(connectionId);
      console.log(`[Cleanup] Deleted ${deleted} chat messages for family ${connectionId}`);
      res.json({ success: true, deleted });
    } catch (error) {
      console.error("[Cleanup] Error:", error);
      res.status(500).json({ error: "Failed to cleanup chat" });
    }
  });

  // Cleanup photo proofs only
  app.delete("/api/cleanup/photos/:connectionId", async (req, res) => {
    try {
      const { connectionId } = req.params;
      const { peerId } = req.body;
      
      const peer = await storage.getPeer(parseInt(peerId));
      if (!peer || peer.role !== 'parent') {
        return res.status(403).json({ error: "Only parents can delete data" });
      }
      if (peer.connectionId !== connectionId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const deleted = await storage.cleanupPhotoProofs(connectionId);
      console.log(`[Cleanup] Cleared ${deleted} photo proofs for family ${connectionId}`);
      res.json({ success: true, deleted });
    } catch (error) {
      console.error("[Cleanup] Error:", error);
      res.status(500).json({ error: "Failed to cleanup photos" });
    }
  });

  // Cleanup old events only
  app.delete("/api/cleanup/events/:connectionId", async (req, res) => {
    try {
      const { connectionId } = req.params;
      const { peerId } = req.body;
      
      const peer = await storage.getPeer(parseInt(peerId));
      if (!peer || peer.role !== 'parent') {
        return res.status(403).json({ error: "Only parents can delete data" });
      }
      if (peer.connectionId !== connectionId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const deleted = await storage.cleanupOldEvents(connectionId);
      console.log(`[Cleanup] Deleted ${deleted} old events for family ${connectionId}`);
      res.json({ success: true, deleted });
    } catch (error) {
      console.error("[Cleanup] Error:", error);
      res.status(500).json({ error: "Failed to cleanup events" });
    }
  });

  // Cleanup shopping list only
  app.delete("/api/cleanup/shopping/:connectionId", async (req, res) => {
    try {
      const { connectionId } = req.params;
      const { peerId } = req.body;
      
      const peer = await storage.getPeer(parseInt(peerId));
      if (!peer || peer.role !== 'parent') {
        return res.status(403).json({ error: "Only parents can delete data" });
      }
      if (peer.connectionId !== connectionId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const deleted = await storage.cleanupShoppingList(connectionId);
      console.log(`[Cleanup] Deleted ${deleted} shopping list items for family ${connectionId}`);
      res.json({ success: true, deleted });
    } catch (error) {
      console.error("[Cleanup] Error:", error);
      res.status(500).json({ error: "Failed to cleanup shopping list" });
    }
  });

  // DANGEROUS: Cleanup ALL family data (except transactions/balances)
  app.delete("/api/cleanup/all/:connectionId", async (req, res) => {
    try {
      const { connectionId } = req.params;
      const { peerId, confirmationCode } = req.body;
      
      const peer = await storage.getPeer(parseInt(peerId));
      if (!peer || peer.role !== 'parent') {
        return res.status(403).json({ error: "Only parents can delete data" });
      }
      if (peer.connectionId !== connectionId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Require confirmation code for safety
      if (confirmationCode !== 'DELETE-ALL') {
        return res.status(400).json({ error: "Invalid confirmation code" });
      }
      
      const result = await storage.cleanupAllFamilyData(connectionId);
      console.log(`[Cleanup] DELETED ALL for family ${connectionId}:`, result);
      res.json({ success: true, deleted: result });
    } catch (error) {
      console.error("[Cleanup] Error:", error);
      res.status(500).json({ error: "Failed to cleanup all data" });
    }
  });

  // Reset account data (keeps account, clears activity)
  app.post("/api/account/reset", async (req, res) => {
    try {
      const { peerId, confirmationCode } = req.body;
      
      const peer = await storage.getPeer(parseInt(peerId));
      if (!peer || peer.role !== 'parent') {
        return res.status(403).json({ error: "Only parents can reset data" });
      }
      
      if (confirmationCode !== 'RESET-ACCOUNT') {
        return res.status(400).json({ error: "Invalid confirmation code" });
      }
      
      const success = await storage.resetAccountData(parseInt(peerId));
      console.log(`[Account] Reset data for peer ${peerId}: ${success}`);
      res.json({ success });
    } catch (error) {
      console.error("[Account] Reset error:", error);
      res.status(500).json({ error: "Failed to reset account" });
    }
  });

  // Check if parent is the last one in family (for warning before delete)
  app.get("/api/account/:peerId/is-last-parent", async (req, res) => {
    try {
      const { peerId } = req.params;
      
      const peer = await storage.getPeer(parseInt(peerId));
      if (!peer || peer.role !== 'parent') {
        return res.status(403).json({ error: "Only parents can check this" });
      }
      
      const otherParents = await storage.getOtherParentsWithConnectionId(peer.connectionId, parseInt(peerId));
      const remainingParents = otherParents.filter(p => p.id !== parseInt(peerId));
      const children = await storage.getChildrenWithConnectionId(peer.connectionId);
      
      res.json({ 
        isLastParent: remainingParents.length === 0,
        childrenCount: children.length,
        otherParentsCount: remainingParents.length
      });
    } catch (error) {
      console.error("[Account] Check last parent error:", error);
      res.status(500).json({ error: "Failed to check parent status" });
    }
  });

  // DANGEROUS: Delete account permanently
  app.delete("/api/account/:peerId", async (req, res) => {
    try {
      const { peerId } = req.params;
      const { confirmationCode } = req.body;
      
      const peer = await storage.getPeer(parseInt(peerId));
      if (!peer || peer.role !== 'parent') {
        return res.status(403).json({ error: "Only parents can delete accounts" });
      }
      
      if (confirmationCode !== 'DELETE-ACCOUNT-FOREVER') {
        return res.status(400).json({ error: "Invalid confirmation code" });
      }
      
      const result = await storage.deleteAccount(parseInt(peerId), peer.connectionId);
      console.log(`[Account] DELETED account ${peerId}:`, result);
      
      res.json({ 
        success: result.success, 
        message: "Account permanently deleted",
        wasLastParent: result.wasLastParent,
        childrenDisconnected: result.childrenDisconnected
      });
    } catch (error) {
      console.error("[Account] Delete error:", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  // Push Notification Endpoints
  app.get("/api/push/vapid-public-key", (req, res) => {
    res.json({ publicKey: getVapidPublicKey() });
  });

  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const { peerId, connectionId, subscription } = req.body;
      
      if (!peerId || !connectionId || !subscription) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const existingSubscription = await db.select().from(pushSubscriptions)
        .where(and(
          eq(pushSubscriptions.peerId, peerId),
          eq(pushSubscriptions.endpoint, subscription.endpoint)
        ));

      if (existingSubscription.length > 0) {
        await db.update(pushSubscriptions)
          .set({
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            updatedAt: new Date()
          })
          .where(eq(pushSubscriptions.id, existingSubscription[0].id));
        return res.json({ success: true, updated: true });
      }

      await db.insert(pushSubscriptions).values({
        peerId,
        connectionId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      });

      res.json({ success: true, created: true });
    } catch (error) {
      console.error("[Push Subscribe Error]:", error);
      res.status(500).json({ error: "Failed to save subscription" });
    }
  });

  app.delete("/api/push/unsubscribe", async (req, res) => {
    try {
      const { peerId, endpoint } = req.body;
      
      if (!peerId || !endpoint) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      await db.delete(pushSubscriptions)
        .where(and(
          eq(pushSubscriptions.peerId, peerId),
          eq(pushSubscriptions.endpoint, endpoint)
        ));

      res.json({ success: true });
    } catch (error) {
      console.error("[Push Unsubscribe Error]:", error);
      res.status(500).json({ error: "Failed to remove subscription" });
    }
  });

  app.get("/api/push/status/:peerId", async (req, res) => {
    try {
      const peerId = parseInt(req.params.peerId);
      const subscriptions = await db.select().from(pushSubscriptions)
        .where(eq(pushSubscriptions.peerId, peerId));
      
      res.json({ 
        subscribed: subscriptions.length > 0,
        count: subscriptions.length
      });
    } catch (error) {
      console.error("[Push Status Error]:", error);
      res.status(500).json({ error: "Failed to check push status" });
    }
  });

  app.post("/api/push/resubscribe", async (req, res) => {
    try {
      const { oldEndpoint, newSubscription } = req.body;
      
      if (!oldEndpoint || !newSubscription) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const existingSubscriptions = await db.select().from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, oldEndpoint));

      if (existingSubscriptions.length === 0) {
        return res.status(404).json({ error: "Old subscription not found" });
      }

      const oldSub = existingSubscriptions[0];
      
      await db.update(pushSubscriptions)
        .set({
          endpoint: newSubscription.endpoint,
          p256dh: newSubscription.keys.p256dh,
          auth: newSubscription.keys.auth,
          updatedAt: new Date()
        })
        .where(eq(pushSubscriptions.id, oldSub.id));

      console.log(`[Push] Resubscribed user ${oldSub.peerId} with new endpoint`);
      res.json({ success: true });
    } catch (error) {
      console.error("[Push Resubscribe Error]:", error);
      res.status(500).json({ error: "Failed to resubscribe" });
    }
  });

  // ============================================
  // FAMILY BOARD API
  // ============================================
  
  app.get("/api/board/:connectionId", async (req, res) => {
    try {
      const { peerId } = req.query;
      if (!peerId) {
        return res.status(400).json({ error: "User ID required" });
      }
      const peer = await storage.getPeer(parseInt(peerId as string));
      if (!peer || peer.connectionId !== req.params.connectionId) {
        return res.status(403).json({ error: "Access denied - family mismatch" });
      }
      const posts = await storage.getFamilyBoardPosts(req.params.connectionId);
      res.json(posts);
    } catch (error) {
      console.error("[Board] Error fetching posts:", error);
      res.status(500).json({ error: "Failed to fetch board posts" });
    }
  });

  app.post("/api/board", async (req, res) => {
    try {
      const { connectionId, createdBy, title, body, pinned, tags, expiresAt } = req.body;
      
      if (!connectionId || !createdBy || !title || !body) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const peer = await storage.getPeer(createdBy);
      if (!peer || peer.connectionId !== connectionId) {
        return res.status(403).json({ error: "Access denied - family mismatch" });
      }

      const post = await storage.createFamilyBoardPost({
        connectionId,
        createdBy,
        title,
        body,
        pinned: pinned || false,
        tags: tags || [],
        expiresAt: expiresAt ? new Date(expiresAt) : null
      });
      
      res.json(post);
    } catch (error) {
      console.error("[Board] Error creating post:", error);
      res.status(500).json({ error: "Failed to create post" });
    }
  });

  app.patch("/api/board/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { peerId, ...updates } = req.body;
      
      if (!peerId) {
        return res.status(400).json({ error: "User ID required" });
      }
      
      const peer = await storage.getPeer(peerId);
      if (!peer) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      if (updates.expiresAt) {
        updates.expiresAt = new Date(updates.expiresAt);
      }
      
      const post = await storage.updateFamilyBoardPost(id, updates);
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }
      res.json(post);
    } catch (error) {
      console.error("[Board] Error updating post:", error);
      res.status(500).json({ error: "Failed to update post" });
    }
  });

  app.delete("/api/board/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { peerId } = req.query;
      
      if (!peerId) {
        return res.status(400).json({ error: "User ID required" });
      }
      
      const peer = await storage.getPeer(parseInt(peerId as string));
      if (!peer) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const success = await storage.deleteFamilyBoardPost(id);
      res.json({ success });
    } catch (error) {
      console.error("[Board] Error deleting post:", error);
      res.status(500).json({ error: "Failed to delete post" });
    }
  });

  // ============================================
  // LOCATION PINGS API (All family members can view and send)
  // ============================================
  
  app.get("/api/locations/:connectionId", async (req, res) => {
    try {
      const { peerId } = req.query;
      if (!peerId) {
        return res.status(400).json({ error: "User ID required" });
      }
      
      const peer = await storage.getPeer(parseInt(peerId as string));
      if (!peer || peer.connectionId !== req.params.connectionId) {
        return res.status(403).json({ error: "Access denied - family mismatch" });
      }
      
      const limit = parseInt(req.query.limit as string) || 50;
      const pings = await storage.getLocationPings(req.params.connectionId, limit);
      res.json(pings);
    } catch (error) {
      console.error("[Location] Error fetching pings:", error);
      res.status(500).json({ error: "Failed to fetch location pings" });
    }
  });

  app.get("/api/locations/child/:childId", async (req, res) => {
    try {
      const { peerId } = req.query;
      if (!peerId) {
        return res.status(400).json({ error: "User ID required" });
      }
      
      const peer = await storage.getPeer(parseInt(peerId as string));
      if (!peer) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const childId = parseInt(req.params.childId);
      const limit = parseInt(req.query.limit as string) || 10;
      const pings = await storage.getChildLocationPings(childId, limit);
      res.json(pings);
    } catch (error) {
      console.error("[Location] Error fetching child pings:", error);
      res.status(500).json({ error: "Failed to fetch child location pings" });
    }
  });

  app.post("/api/locations/arrive", async (req, res) => {
    try {
      const { connectionId, childId, latitude, longitude, accuracy, note, status } = req.body;
      
      if (!connectionId || !childId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const peer = await storage.getPeer(childId);
      if (!peer || peer.connectionId !== connectionId) {
        return res.status(403).json({ error: "Access denied - family mismatch" });
      }

      const ping = await storage.createLocationPing({
        connectionId,
        childId,
        latitude: latitude?.toString() || null,
        longitude: longitude?.toString() || null,
        accuracy: accuracy || null,
        note: note || null,
        status: status || "arrived"
      });
      
      res.json(ping);
    } catch (error) {
      console.error("[Location] Error creating ping:", error);
      res.status(500).json({ error: "Failed to create location ping" });
    }
  });

  app.delete("/api/locations/:id", async (req, res) => {
    try {
      const { peerId } = req.query;
      const pingId = parseInt(req.params.id);
      
      if (!peerId) {
        return res.status(400).json({ error: "User ID required" });
      }

      const peer = await storage.getPeer(parseInt(peerId as string));
      if (!peer) {
        return res.status(403).json({ error: "Access denied" });
      }

      const ping = await storage.getLocationPing(pingId);
      if (!ping || ping.connectionId !== peer.connectionId) {
        return res.status(404).json({ error: "Location ping not found" });
      }

      if (peer.role !== "parent" && ping.childId !== peer.id) {
        return res.status(403).json({ error: "Can only delete your own location updates" });
      }

      await storage.deleteLocationPing(pingId);
      res.json({ success: true });
    } catch (error) {
      console.error("[Location] Error deleting ping:", error);
      res.status(500).json({ error: "Failed to delete location ping" });
    }
  });

  // ============================================
  // EMERGENCY CONTACTS API (All family can read, parent-only write)
  // ============================================
  
  app.get("/api/emergency-contacts/:connectionId", async (req, res) => {
    try {
      const { peerId } = req.query;
      if (!peerId) {
        return res.status(400).json({ error: "User ID required" });
      }
      
      const peer = await storage.getPeer(parseInt(peerId as string));
      if (!peer || peer.connectionId !== req.params.connectionId) {
        return res.status(403).json({ error: "Access denied - family mismatch" });
      }
      
      const contacts = await storage.getEmergencyContacts(req.params.connectionId);
      res.json(contacts);
    } catch (error) {
      console.error("[Emergency] Error fetching contacts:", error);
      res.status(500).json({ error: "Failed to fetch emergency contacts" });
    }
  });

  app.post("/api/emergency-contacts", async (req, res) => {
    try {
      const { connectionId, createdBy, label, name, phone, notes, priority } = req.body;
      
      if (!connectionId || !createdBy || !label || !name || !phone) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const peer = await storage.getPeer(createdBy);
      if (!peer || peer.role !== "parent" || peer.connectionId !== connectionId) {
        return res.status(403).json({ error: "Only parents can add emergency contacts" });
      }

      const contact = await storage.createEmergencyContact({
        connectionId,
        createdBy,
        label,
        name,
        phone,
        notes: notes || null,
        priority: priority || 0
      });
      
      res.json(contact);
    } catch (error) {
      console.error("[Emergency] Error creating contact:", error);
      res.status(500).json({ error: "Failed to create emergency contact" });
    }
  });

  app.patch("/api/emergency-contacts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { peerId, ...updates } = req.body;
      
      if (!peerId) {
        return res.status(400).json({ error: "User ID required" });
      }
      
      const peer = await storage.getPeer(peerId);
      if (!peer || peer.role !== "parent") {
        return res.status(403).json({ error: "Only parents can update emergency contacts" });
      }
      
      const contact = await storage.updateEmergencyContact(id, updates);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      console.error("[Emergency] Error updating contact:", error);
      res.status(500).json({ error: "Failed to update emergency contact" });
    }
  });

  app.delete("/api/emergency-contacts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { peerId } = req.query;
      
      if (!peerId) {
        return res.status(400).json({ error: "User ID required" });
      }
      
      const peer = await storage.getPeer(parseInt(peerId as string));
      if (!peer || peer.role !== "parent") {
        return res.status(403).json({ error: "Only parents can delete emergency contacts" });
      }
      
      const success = await storage.deleteEmergencyContact(id);
      res.json({ success });
    } catch (error) {
      console.error("[Emergency] Error deleting contact:", error);
      res.status(500).json({ error: "Failed to delete emergency contact" });
    }
  });

  // ============================================
  // PASSWORD SAFE API (Parent-only, encrypted)
  // ============================================
  
  app.get("/api/password-safe/:connectionId", async (req, res) => {
    try {
      const { peerId } = req.query;
      if (!peerId) {
        return res.status(400).json({ error: "User ID required" });
      }
      
      const peer = await storage.getPeer(parseInt(peerId as string));
      if (!peer || peer.role !== "parent" || peer.connectionId !== req.params.connectionId) {
        return res.status(403).json({ error: "Only parents can access the password safe" });
      }
      
      const entries = await storage.getPasswordSafeEntries(req.params.connectionId);
      const safeEntries = entries.map(e => ({
        ...e,
        passwordEnc: "***",
        notesEnc: e.notesEnc ? "***" : null
      }));
      res.json(safeEntries);
    } catch (error) {
      console.error("[PasswordSafe] Error fetching entries:", error);
      res.status(500).json({ error: "Failed to fetch password entries" });
    }
  });

  app.get("/api/password-safe/reveal/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { peerId } = req.query;
      
      // Verify requester is a parent
      if (!peerId) {
        return res.status(400).json({ error: "Parent ID required" });
      }
      
      const peer = await storage.getPeer(parseInt(peerId as string));
      if (!peer || peer.role !== "parent") {
        return res.status(403).json({ error: "Only parents can reveal passwords" });
      }
      
      const entry = await storage.getPasswordSafeEntry(id);
      if (!entry) {
        return res.status(404).json({ error: "Entry not found" });
      }
      
      // Verify same family
      if (entry.connectionId !== peer.connectionId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Decrypt password for reveal
      const decryptedPassword = decryptWalletData(entry.passwordEnc);
      const decryptedNotes = entry.notesEnc ? decryptWalletData(entry.notesEnc) : null;
      
      res.json({
        password: decryptedPassword,
        notes: decryptedNotes
      });
    } catch (error) {
      console.error("[PasswordSafe] Error revealing password:", error);
      res.status(500).json({ error: "Failed to reveal password" });
    }
  });

  app.post("/api/password-safe", async (req, res) => {
    try {
      const { connectionId, createdBy, label, username, password, url, notes, category } = req.body;
      
      if (!connectionId || !createdBy || !label || !password) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Verify creator is a parent
      const peer = await storage.getPeer(createdBy);
      if (!peer || peer.role !== "parent") {
        return res.status(403).json({ error: "Only parents can create password entries" });
      }

      // Encrypt password and notes
      const encryptedPassword = encryptWalletData(password);
      const encryptedNotes = notes ? encryptWalletData(notes) : null;

      const entry = await storage.createPasswordSafeEntry({
        connectionId,
        createdBy,
        label,
        username: username || null,
        passwordEnc: encryptedPassword,
        url: url || null,
        notesEnc: encryptedNotes,
        category: category || "general"
      });
      
      res.json({ ...entry, passwordEnc: "***", notesEnc: entry.notesEnc ? "***" : null });
    } catch (error) {
      console.error("[PasswordSafe] Error creating entry:", error);
      res.status(500).json({ error: "Failed to create password entry" });
    }
  });

  app.patch("/api/password-safe/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { peerId, password, notes, ...otherUpdates } = req.body;
      
      // Verify requester is a parent
      const peer = await storage.getPeer(peerId);
      if (!peer || peer.role !== "parent") {
        return res.status(403).json({ error: "Only parents can update password entries" });
      }
      
      const updates: any = { ...otherUpdates };
      
      // Re-encrypt if password or notes changed
      if (password) {
        updates.passwordEnc = encryptWalletData(password);
        updates.lastRotatedAt = new Date();
      }
      if (notes !== undefined) {
        updates.notesEnc = notes ? encryptWalletData(notes) : null;
      }
      
      const entry = await storage.updatePasswordSafeEntry(id, updates);
      if (!entry) {
        return res.status(404).json({ error: "Entry not found" });
      }
      res.json({ ...entry, passwordEnc: "***", notesEnc: entry.notesEnc ? "***" : null });
    } catch (error) {
      console.error("[PasswordSafe] Error updating entry:", error);
      res.status(500).json({ error: "Failed to update password entry" });
    }
  });

  app.delete("/api/password-safe/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { peerId } = req.query;
      
      // Verify requester is a parent
      if (!peerId) {
        return res.status(400).json({ error: "Parent ID required" });
      }
      
      const peer = await storage.getPeer(parseInt(peerId as string));
      if (!peer || peer.role !== "parent") {
        return res.status(403).json({ error: "Only parents can delete password entries" });
      }
      
      const success = await storage.deletePasswordSafeEntry(id);
      res.json({ success });
    } catch (error) {
      console.error("[PasswordSafe] Error deleting entry:", error);
      res.status(500).json({ error: "Failed to delete password entry" });
    }
  });

  // ============================================
  // BIRTHDAY REMINDERS API (All family can read, parent-only write)
  // ============================================
  
  app.get("/api/birthdays/:connectionId", async (req, res) => {
    try {
      const { peerId } = req.query;
      if (!peerId) {
        return res.status(400).json({ error: "User ID required" });
      }
      
      const peer = await storage.getPeer(parseInt(peerId as string));
      if (!peer || peer.connectionId !== req.params.connectionId) {
        return res.status(403).json({ error: "Access denied - family mismatch" });
      }
      
      const birthdays = await storage.getBirthdayReminders(req.params.connectionId);
      res.json(birthdays);
    } catch (error) {
      console.error("[Birthday] Error fetching reminders:", error);
      res.status(500).json({ error: "Failed to fetch birthday reminders" });
    }
  });

  app.get("/api/birthdays/upcoming/:connectionId", async (req, res) => {
    try {
      const { peerId } = req.query;
      if (!peerId) {
        return res.status(400).json({ error: "User ID required" });
      }
      
      const peer = await storage.getPeer(parseInt(peerId as string));
      if (!peer || peer.connectionId !== req.params.connectionId) {
        return res.status(403).json({ error: "Access denied - family mismatch" });
      }
      
      const daysAhead = parseInt(req.query.days as string) || 30;
      const birthdays = await storage.getUpcomingBirthdays(req.params.connectionId, daysAhead);
      res.json(birthdays);
    } catch (error) {
      console.error("[Birthday] Error fetching upcoming:", error);
      res.status(500).json({ error: "Failed to fetch upcoming birthdays" });
    }
  });

  app.post("/api/birthdays", async (req, res) => {
    try {
      const { connectionId, createdBy, personName, birthMonth, birthDay, birthYear, relation, notifyDaysBefore, notes } = req.body;
      
      if (!connectionId || !createdBy || !personName || !birthMonth || !birthDay) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const peer = await storage.getPeer(createdBy);
      if (!peer || peer.role !== "parent" || peer.connectionId !== connectionId) {
        return res.status(403).json({ error: "Only parents can add birthday reminders" });
      }

      const birthday = await storage.createBirthdayReminder({
        connectionId,
        createdBy,
        personName,
        birthMonth,
        birthDay,
        birthYear: birthYear || null,
        relation: relation || null,
        notifyDaysBefore: notifyDaysBefore || [0, 1, 7],
        notes: notes || null
      });
      
      res.json(birthday);
    } catch (error) {
      console.error("[Birthday] Error creating reminder:", error);
      res.status(500).json({ error: "Failed to create birthday reminder" });
    }
  });

  app.patch("/api/birthdays/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { peerId, ...updates } = req.body;
      
      if (!peerId) {
        return res.status(400).json({ error: "User ID required" });
      }
      
      const peer = await storage.getPeer(peerId);
      if (!peer || peer.role !== "parent") {
        return res.status(403).json({ error: "Only parents can update birthday reminders" });
      }
      
      const birthday = await storage.updateBirthdayReminder(id, updates);
      if (!birthday) {
        return res.status(404).json({ error: "Birthday not found" });
      }
      res.json(birthday);
    } catch (error) {
      console.error("[Birthday] Error updating reminder:", error);
      res.status(500).json({ error: "Failed to update birthday reminder" });
    }
  });

  app.delete("/api/birthdays/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { peerId } = req.query;
      
      if (!peerId) {
        return res.status(400).json({ error: "User ID required" });
      }
      
      const peer = await storage.getPeer(parseInt(peerId as string));
      if (!peer || peer.role !== "parent") {
        return res.status(403).json({ error: "Only parents can delete birthday reminders" });
      }
      
      const success = await storage.deleteBirthdayReminder(id);
      res.json({ success });
    } catch (error) {
      console.error("[Birthday] Error deleting reminder:", error);
      res.status(500).json({ error: "Failed to delete birthday reminder" });
    }
  });

  // Failed Payments endpoints (for parents to view and retry failed payments)
  app.get("/api/failed-payments/:connectionId", async (req, res) => {
    try {
      const { connectionId } = req.params;
      const { peerId } = req.query;
      
      if (!peerId) {
        return res.status(400).json({ error: "User ID required" });
      }
      
      const peer = await storage.getPeer(parseInt(peerId as string));
      if (!peer || peer.role !== "parent" || peer.connectionId !== connectionId) {
        return res.status(403).json({ error: "Only parents can view failed payments" });
      }
      
      const payments = await storage.getFailedPayments(connectionId);
      res.json(payments);
    } catch (error) {
      console.error("[Failed Payments] Error fetching:", error);
      res.status(500).json({ error: "Failed to fetch failed payments" });
    }
  });

  app.get("/api/failed-payments/:connectionId/pending", async (req, res) => {
    try {
      const { connectionId } = req.params;
      const { peerId } = req.query;
      
      if (!peerId) {
        return res.status(400).json({ error: "User ID required" });
      }
      
      const peer = await storage.getPeer(parseInt(peerId as string));
      if (!peer || peer.role !== "parent" || peer.connectionId !== connectionId) {
        return res.status(403).json({ error: "Only parents can view failed payments" });
      }
      
      const payments = await storage.getPendingFailedPayments(connectionId);
      res.json(payments);
    } catch (error) {
      console.error("[Failed Payments] Error fetching pending:", error);
      res.status(500).json({ error: "Failed to fetch pending payments" });
    }
  });

  app.post("/api/failed-payments/:id/retry", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { peerId } = req.body;
      
      if (!peerId) {
        return res.status(400).json({ error: "User ID required" });
      }
      
      const peer = await storage.getPeer(peerId);
      if (!peer || peer.role !== "parent") {
        return res.status(403).json({ error: "Only parents can retry payments" });
      }

      const failedPayment = await storage.updateFailedPayment(id, {});
      if (!failedPayment) {
        return res.status(404).json({ error: "Failed payment not found" });
      }

      // Get child info
      const child = await storage.getPeer(failedPayment.toPeerId);
      if (!child || !child.lightningAddress) {
        return res.status(400).json({ error: "Child has no Lightning address configured" });
      }

      // Attempt payment
      const hasNwc = !!peer.nwcConnectionString;
      const hasLnbits = !!peer.lnbitsUrl && !!peer.lnbitsAdminKey;
      const activeWallet = peer.walletType || (hasNwc ? "nwc" : hasLnbits ? "lnbits" : null);

      if (!hasNwc && !hasLnbits) {
        return res.status(400).json({ error: "No wallet configured" });
      }

      let paymentHash = "";
      const memo = `Wiederholte Zahlung: ${failedPayment.sats} Sats an ${child.name}`;

      try {
        // Decrypt wallet credentials
        const decryptedNwc = hasNwc ? decryptWalletData(peer.nwcConnectionString!) : null;
        const decryptedLnbitsKey = hasLnbits ? decryptWalletData(peer.lnbitsAdminKey!) : null;

        if (activeWallet === "nwc" && hasNwc && decryptedNwc) {
          const { NWCClient } = await import("./nwc");
          const nwc = new NWCClient(decryptedNwc);
          paymentHash = await nwc.payToLightningAddress(child.lightningAddress, failedPayment.sats, memo);
          nwc.close();
        } else if (hasLnbits && decryptedLnbitsKey) {
          const lnbits = new LNBitsClient(peer.lnbitsUrl!, decryptedLnbitsKey);
          paymentHash = await lnbits.payToLightningAddress(failedPayment.sats, child.lightningAddress, memo);
        }

        if (paymentHash) {
          // Mark as resolved
          await storage.markPaymentResolved(id);
          
          // Update child balance
          await storage.updateBalance(child.id, child.balance + failedPayment.sats);

          // Create transaction record
          await storage.createTransaction({
            fromPeerId: peer.id,
            toPeerId: child.id,
            sats: failedPayment.sats,
            type: "retry_payment",
            paymentHash,
            status: "completed"
          });

          console.log(`[Failed Payments] Retry successful for payment ${id}: ${paymentHash}`);
          res.json({ success: true, paymentHash });
        } else {
          // Mark as retried but still pending
          await storage.markPaymentRetried(id);
          res.status(400).json({ error: "Payment failed again", retried: true });
        }
      } catch (payError) {
        console.error("[Failed Payments] Retry error:", payError);
        await storage.markPaymentRetried(id);
        await storage.updateFailedPayment(id, { 
          errorMessage: (payError as Error).message,
          status: "pending"
        });
        res.status(400).json({ error: "Payment retry failed: " + (payError as Error).message });
      }
    } catch (error) {
      console.error("[Failed Payments] Error retrying:", error);
      res.status(500).json({ error: "Failed to retry payment" });
    }
  });

  app.post("/api/failed-payments/:id/cancel", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { peerId } = req.body;
      
      if (!peerId) {
        return res.status(400).json({ error: "User ID required" });
      }
      
      const peer = await storage.getPeer(peerId);
      if (!peer || peer.role !== "parent") {
        return res.status(403).json({ error: "Only parents can cancel payments" });
      }
      
      const payment = await storage.updateFailedPayment(id, { status: "cancelled" });
      res.json({ success: true, payment });
    } catch (error) {
      console.error("[Failed Payments] Error cancelling:", error);
      res.status(500).json({ error: "Failed to cancel payment" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
