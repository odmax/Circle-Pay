export interface PaymentProvider {
  name: string
  createCheckoutUrl(params: CheckoutParams): Promise<string>
  verifySignature(data: Record<string, string>): boolean
  validatePayment(data: Record<string, string>, expectedAmount: number): boolean
}

export interface CheckoutParams {
  merchantReference: string
  amount: number
  itemName: string
  itemDescription?: string
  returnUrl: string
  cancelUrl: string
  notifyUrl: string
  email?: string
  nameFirst?: string
  nameLast?: string
}

export interface PaymentVerifyResult {
  success: boolean
  merchantReference: string
  providerReference: string
  amount: number
  status: string
  metadata?: Record<string, unknown>
}
