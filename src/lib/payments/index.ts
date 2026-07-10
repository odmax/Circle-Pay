import { PayFastProvider } from "./payfast"
import type { PaymentProvider } from "./types"

export type { PaymentProvider, CheckoutParams } from "./types"

const providers: Record<string, PaymentProvider> = {
  payfast: new PayFastProvider(),
}

export function getPaymentProvider(name: string): PaymentProvider {
  const provider = providers[name.toLowerCase()]
  if (!provider) throw new Error(`Unknown payment provider: ${name}`)
  return provider
}

export function getDefaultProvider(): PaymentProvider {
  return providers.payfast
}
