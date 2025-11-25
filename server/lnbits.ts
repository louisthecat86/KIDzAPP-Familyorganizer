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
    const response = await fetch(`${this.baseUrl}/api/v1/invoices`, {
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
      throw new Error(`Failed to create invoice: ${response.statusText}`);
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
}
