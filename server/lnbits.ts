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
    const url = `${this.baseUrl}/api/v1/invoices`;
    console.log("LNBits createInvoice - URL:", url);
    
    const response = await fetch(url, {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LNBits error:", response.status, errorText);
      throw new Error(`LNBits error (${response.status}): ${errorText || response.statusText}`);
    }

    return response.json();
  }

  async checkPayment(checkingId: string): Promise<boolean> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/invoices/${checkingId}`,
      {
        headers: {
          "X-Api-Key": this.adminKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to check payment: ${response.statusText}`);
    }

    const data: LNBitsPayment = await response.json();
    return data.paid;
  }

  async payInvoice(paymentRequest: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/v1/payments`, {
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

    if (!response.ok) {
      throw new Error(`Failed to pay invoice: ${response.statusText}`);
    }

    const data = await response.json();
    return data.payment_hash;
  }

  async createPaylink(amount: number, memo: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/v1/links`, {
      method: "POST",
      headers: {
        "X-Api-Key": this.adminKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amount * 1000, // Convert sats to millisats
        description: memo,
        max_repay: amount * 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create paylink: ${response.statusText}`);
    }

    const data = await response.json();
    return `${this.baseUrl}/lnurlp/${data.id}`;
  }

  async createWithdrawLink(amount: number, memo: string, lnAddress: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/v1/withdraw`, {
      method: "POST",
      headers: {
        "X-Api-Key": this.adminKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amount * 1000, // Convert sats to millisats
        memo: memo,
        webhook_url: lnAddress,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create withdraw link: ${response.statusText}`);
    }

    const data = await response.json();
    return data.lnurl;
  }
}
