// LNBits API Integration
export interface LNBitsInvoice {
  payment_hash: string;
  payment_request: string;
  checking_id: string;
}

export interface LNBitsPayment {
  checking_id: string;
  paid: boolean;
}

export class LNBitsClient {
  constructor(
    private baseUrl: string,
    private adminKey: string
  ) {}

  async createInvoice(amount: number, memo: string): Promise<LNBitsInvoice> {
    // Try new API path first
    let url = `${this.baseUrl}/api/v1/invoices`;
    console.log("LNBits createInvoice - URL:", url);
    
    let response = await fetch(url, {
      method: "POST",
      headers: {
        "X-Api-Key": this.adminKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amount,
        memo: memo,
        out: false,
      }),
    });

    // If new API fails, try old invoices endpoint
    if (!response.ok && response.status === 404) {
      console.log("New invoice API returned 404, trying legacy endpoint...");
      url = `${this.baseUrl}/invoices`;
      response = await fetch(url, {
        method: "POST",
        headers: {
          "X-Api-Key": this.adminKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amount,
          memo: memo,
          out: false,
        }),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LNBits error:", response.status, errorText);
      throw new Error(`LNBits error (${response.status}): ${errorText || response.statusText}`);
    }

    return response.json();
  }

  async checkPayment(checkingId: string): Promise<boolean> {
    let response = await fetch(
      `${this.baseUrl}/api/v1/invoices/${checkingId}`,
      {
        headers: {
          "X-Api-Key": this.adminKey,
        },
      }
    );

    // Try legacy endpoint if not found
    if (!response.ok && response.status === 404) {
      response = await fetch(
        `${this.baseUrl}/invoices/${checkingId}`,
        {
          headers: {
            "X-Api-Key": this.adminKey,
          },
        }
      );
    }

    if (!response.ok) {
      throw new Error(`Failed to check payment: ${response.statusText}`);
    }

    const data: LNBitsPayment = await response.json();
    return data.paid;
  }

  async payInvoice(paymentRequest: string): Promise<string> {
    let response = await fetch(`${this.baseUrl}/api/v1/payments`, {
      method: "POST",
      headers: {
        "X-Api-Key": this.adminKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        out: true,
        bolt11: paymentRequest,
      }),
    });

    // Try legacy endpoint if not found
    if (!response.ok && response.status === 404) {
      response = await fetch(`${this.baseUrl}/payments`, {
        method: "POST",
        headers: {
          "X-Api-Key": this.adminKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          out: true,
          bolt11: paymentRequest,
        }),
      });
    }

    if (!response.ok) {
      throw new Error(`Failed to pay invoice: ${response.statusText}`);
    }

    const data = await response.json();
    return data.payment_hash;
  }

  async createPaylink(amount: number, memo: string): Promise<string> {
    // Try Invoice API first (modern LNBits)
    let response = await fetch(`${this.baseUrl}/api/v1/invoices`, {
      method: "POST",
      headers: {
        "X-Api-Key": this.adminKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amount,
        memo: memo,
        out: false,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.payment_request;
    }

    // Fallback to Paylinks API (older LNBits)
    console.log("Invoice API failed, trying Paylinks API");
    response = await fetch(`${this.baseUrl}/api/v1/links`, {
      method: "POST",
      headers: {
        "X-Api-Key": this.adminKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amount * 1000,
        description: memo,
        max_repay: amount * 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create paylink: ${errorText || response.statusText}`);
    }

    const data = await response.json();
    return `${this.baseUrl}/lnurlp/${data.id}`;
  }

  async payToLightningAddress(amount: number, lnAddress: string, memo: string): Promise<string> {
    // Create a payment request to the lightning address using LNURL
    try {
      // Fetch LNURL metadata from lightning address
      const [name, domain] = lnAddress.split("@");
      const lnurlEndpoint = `https://${domain}/.well-known/lnurlp/${name}`;
      
      const lnurlResponse = await fetch(lnurlEndpoint);
      if (!lnurlResponse.ok) {
        throw new Error("Failed to fetch LNURL from lightning address");
      }

      const lnurlData = await lnurlResponse.json();
      
      // Request invoice from LNURL endpoint
      const invoiceUrl = `${lnurlData.callback}?amount=${amount * 1000}&comment=${encodeURIComponent(memo)}`;
      const invoiceResponse = await fetch(invoiceUrl);
      if (!invoiceResponse.ok) {
        throw new Error("Failed to get invoice from LNURL");
      }

      const invoiceData = await invoiceResponse.json();
      
      // Pay the invoice using parent wallet
      return await this.payInvoice(invoiceData.pr);
    } catch (error) {
      throw new Error(`Failed to pay to lightning address: ${error}`);
    }
  }

  async getBalance(): Promise<number> {
    let response = await fetch(`${this.baseUrl}/api/v1/wallet`, {
      headers: {
        "X-Api-Key": this.adminKey,
      },
    });

    // Try legacy endpoint if not found
    if (!response.ok && response.status === 404) {
      response = await fetch(`${this.baseUrl}/wallet`, {
        headers: {
          "X-Api-Key": this.adminKey,
        },
      });
    }

    if (!response.ok) {
      throw new Error(`Failed to get wallet balance: ${response.statusText}`);
    }

    const data = await response.json();
    return data.balance || 0;
  }
}
