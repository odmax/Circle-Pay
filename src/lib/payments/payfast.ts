import crypto from "crypto"
import type { PaymentProvider, CheckoutParams } from "./types"

function getPayFastConfig() {
  const sandbox = process.env.PAYFAST_SANDBOX === "true"
  return {
    merchantId: process.env.PAYFAST_MERCHANT_ID!,
    merchantKey: process.env.PAYFAST_MERCHANT_KEY!,
    passphrase: process.env.PAYFAST_PASSPHRASE || "",
    baseUrl: sandbox
      ? "https://sandbox.payfast.co.za/eng/process"
      : "https://www.payfast.co.za/eng/process",
  }
}

export class PayFastProvider implements PaymentProvider {
  name = "payfast"

  async createCheckoutUrl(params: CheckoutParams): Promise<string> {
    const config = getPayFastConfig()

    const data: Record<string, string> = {
      merchant_id: config.merchantId,
      merchant_key: config.merchantKey,
      return_url: params.returnUrl,
      cancel_url: params.cancelUrl,
      notify_url: params.notifyUrl,
      m_payment_id: params.merchantReference,
      amount: params.amount.toFixed(2),
      item_name: params.itemName,
      item_description: params.itemDescription || params.itemName,
      ...(params.email && { email_address: params.email }),
      ...(params.nameFirst && { name_first: params.nameFirst }),
      ...(params.nameLast && { name_last: params.nameLast }),
    }

    const signature = this.generateSignature(data, config.passphrase)
    const queryString = new URLSearchParams({ ...data, signature }).toString()

    return `${config.baseUrl}?${queryString}`
  }

  private generateSignature(data: Record<string, string>, passphrase: string): string {
    const fields = Object.keys(data).sort()
    let paramString = ""
    for (const key of fields) {
      if (key !== "signature" && data[key] !== "") {
        paramString += `${key}=${encodeURIComponent(data[key].trim()).replace(/%20/g, "+")}&`
      }
    }
    paramString = paramString.slice(0, -1)
    if (passphrase) paramString += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, "+")}`

    return crypto.createHash("md5").update(paramString).digest("hex")
  }

  verifySignature(data: Record<string, string>): boolean {
    const config = getPayFastConfig()
    const receivedSignature = data.signature
    const fields: Record<string, string> = {}
    for (const key of Object.keys(data).sort()) {
      if (key !== "signature") fields[key] = data[key]
    }
    const computed = this.generateSignature(fields, config.passphrase)
    return computed === receivedSignature
  }

  validatePayment(data: Record<string, string>, expectedAmount: number): boolean {
    const amount = parseFloat(data.amount_gross || "0")
    const status = data.payment_status
    const config = getPayFastConfig()

    if (data.merchant_id !== config.merchantId) return false
    if (Math.abs(amount - expectedAmount) > 0.02) return false
    if (status !== "COMPLETE") return false

    return true
  }
}
