// ─────────────────────────────────────────────────────────────────────────────
// Razorpay Checkout Loader & Modal Helper
// ─────────────────────────────────────────────────────────────────────────────

export interface RazorpayOrderPayload {
  orderId: string;
  amountPaise: number;
  amountInr: number;
  currency: 'INR';
  keyId: string;
  isSimulated: boolean;
  description: string;
  organizationName: string;
  prefill: {
    name?: string;
    email?: string;
  };
}

export interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout(
  order: RazorpayOrderPayload,
): Promise<RazorpaySuccessResponse> {
  if (order.isSimulated) {
    return {
      razorpay_order_id: order.orderId,
      razorpay_payment_id: `pay_sim_${Date.now()}`,
      razorpay_signature: 'sim_sig',
    };
  }

  const loaded = await loadRazorpayScript();
  if (!loaded || !(window as any).Razorpay) {
    throw new Error('Failed to load Razorpay Checkout SDK. Check your internet connection.');
  }

  return new Promise<RazorpaySuccessResponse>((resolve, reject) => {
    const rzp = new (window as any).Razorpay({
      key: order.keyId,
      amount: order.amountPaise,
      currency: order.currency,
      name: order.organizationName || 'Eigen Estate',
      description: order.description,
      order_id: order.orderId,
      prefill: {
        name: order.prefill?.name || '',
        email: order.prefill?.email || '',
      },
      theme: {
        color: '#0A0A0A',
      },
      handler: (response: RazorpaySuccessResponse) => {
        resolve(response);
      },
      modal: {
        ondismiss: () => {
          reject(new Error('Payment cancelled by user'));
        },
      },
    });

    rzp.on('payment.failed', (resp: any) => {
      reject(new Error(resp?.error?.description || 'Razorpay payment failed'));
    });

    rzp.open();
  });
}
