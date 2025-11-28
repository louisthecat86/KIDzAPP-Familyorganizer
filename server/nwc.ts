import { getPublicKey, finalizeEvent, nip04 } from "nostr-tools";
import WebSocket from "ws";

interface NWCInfo {
  relay: string;
  secret: Uint8Array;
  walletPubkey: string;
  clientPubkey: string;
}

interface NWCResponse {
  result_type: string;
  result?: any;
  error?: { code: string; message: string };
}

export class NWCClient {
  private info: NWCInfo;
  private ws: WebSocket | null = null;
  private pendingRequests: Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }> = new Map();

  constructor(connectionString: string) {
    this.info = this.parseConnectionString(connectionString);
  }

  private parseConnectionString(connectionString: string): NWCInfo {
    try {
      const url = new URL(connectionString);
      const relay = url.searchParams.get("relay");
      const secretHex = url.searchParams.get("secret");
      const walletPubkey = url.hostname;

      if (!relay || !secretHex || !walletPubkey) {
        throw new Error("Invalid NWC connection string: missing relay, secret, or pubkey");
      }

      const secret = new Uint8Array(Buffer.from(secretHex, "hex"));
      const clientPubkey = getPublicKey(secret);

      return { relay, secret, walletPubkey, clientPubkey };
    } catch (error) {
      throw new Error(`Failed to parse NWC connection string: ${(error as Error).message}`);
    }
  }

  private async connect(): Promise<WebSocket> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this.ws;
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.info.relay);
      
      ws.on("open", () => {
        console.log("NWC WebSocket connected to", this.info.relay);
        this.ws = ws;
        resolve(ws);
      });

      ws.on("error", (error) => {
        console.error("NWC WebSocket error:", error);
        reject(error);
      });

      ws.on("close", () => {
        console.log("NWC WebSocket closed");
        this.ws = null;
      });

      ws.on("message", async (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message[0] === "EVENT") {
            const event = message[2];
            await this.handleEvent(event);
          }
        } catch (error) {
          console.error("NWC message parse error:", error);
        }
      });

      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          reject(new Error("NWC connection timeout"));
        }
      }, 10000);
    });
  }

  private async handleEvent(event: any) {
    try {
      const decrypted = await nip04.decrypt(this.info.secret, event.pubkey, event.content);
      const response: NWCResponse = JSON.parse(decrypted);
      
      const requestId = event.tags.find((t: string[]) => t[0] === "e")?.[1];
      if (requestId && this.pendingRequests.has(requestId)) {
        const { resolve, reject } = this.pendingRequests.get(requestId)!;
        this.pendingRequests.delete(requestId);
        
        if (response.error) {
          reject(new Error(`NWC Error: ${response.error.message}`));
        } else {
          resolve(response.result);
        }
      }
    } catch (error) {
      console.error("NWC event handling error:", error);
    }
  }

  private async sendRequest(method: string, params: any = {}): Promise<any> {
    const ws = await this.connect();
    
    return new Promise(async (resolve, reject) => {
      try {
        const content = JSON.stringify({ method, params });
        const encrypted = await nip04.encrypt(this.info.secret, this.info.walletPubkey, content);
        
        const eventTemplate = {
          kind: 23194,
          created_at: Math.floor(Date.now() / 1000),
          tags: [["p", this.info.walletPubkey]],
          content: encrypted,
        };

        const signedEvent = finalizeEvent(eventTemplate, this.info.secret);
        
        this.pendingRequests.set(signedEvent.id, { resolve, reject });
        
        ws.send(JSON.stringify(["EVENT", signedEvent]));
        
        ws.send(JSON.stringify([
          "REQ",
          signedEvent.id,
          {
            kinds: [23195],
            "#e": [signedEvent.id],
            "#p": [this.info.clientPubkey],
          },
        ]));

        setTimeout(() => {
          if (this.pendingRequests.has(signedEvent.id)) {
            this.pendingRequests.delete(signedEvent.id);
            reject(new Error("NWC request timeout"));
          }
        }, 30000);
      } catch (error) {
        reject(error);
      }
    });
  }

  async getBalance(): Promise<number> {
    try {
      const result = await this.sendRequest("get_balance");
      return Math.floor((result.balance || 0) / 1000);
    } catch (error) {
      console.error("NWC getBalance error:", error);
      throw error;
    }
  }

  async payInvoice(paymentRequest: string): Promise<string> {
    try {
      const result = await this.sendRequest("pay_invoice", { invoice: paymentRequest });
      return result.preimage || result.payment_hash || "";
    } catch (error) {
      console.error("NWC payInvoice error:", error);
      throw error;
    }
  }

  async makeInvoice(amount: number, description: string): Promise<string> {
    try {
      const result = await this.sendRequest("make_invoice", {
        amount: amount * 1000,
        description,
      });
      return result.invoice || "";
    } catch (error) {
      console.error("NWC makeInvoice error:", error);
      throw error;
    }
  }

  async payToLightningAddress(lightningAddress: string, amountSats: number, comment?: string): Promise<string> {
    try {
      const [username, domain] = lightningAddress.split("@");
      if (!username || !domain) {
        throw new Error("Invalid lightning address format");
      }

      const lnurlUrl = `https://${domain}/.well-known/lnurlp/${username}`;
      const metaResponse = await fetch(lnurlUrl);
      if (!metaResponse.ok) {
        throw new Error(`Failed to resolve lightning address: ${metaResponse.statusText}`);
      }
      
      const lnurlData = await metaResponse.json();
      if (lnurlData.status === "ERROR") {
        throw new Error(lnurlData.reason || "LNURL error");
      }

      const amountMsats = amountSats * 1000;
      if (amountMsats < lnurlData.minSendable || amountMsats > lnurlData.maxSendable) {
        throw new Error(`Amount ${amountSats} sats is outside allowed range`);
      }

      let callbackUrl = `${lnurlData.callback}?amount=${amountMsats}`;
      if (comment && lnurlData.commentAllowed && comment.length <= lnurlData.commentAllowed) {
        callbackUrl += `&comment=${encodeURIComponent(comment)}`;
      }

      const invoiceResponse = await fetch(callbackUrl);
      if (!invoiceResponse.ok) {
        throw new Error(`Failed to get invoice: ${invoiceResponse.statusText}`);
      }
      
      const invoiceData = await invoiceResponse.json();
      if (invoiceData.status === "ERROR") {
        throw new Error(invoiceData.reason || "Invoice request failed");
      }

      return await this.payInvoice(invoiceData.pr);
    } catch (error) {
      console.error("NWC payToLightningAddress error:", error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      await this.getBalance();
      return true;
    } catch (error) {
      console.error("NWC connection test failed:", error);
      return false;
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
