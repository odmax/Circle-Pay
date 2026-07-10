import { LegalDoc } from "@/components/legal/legal-doc"

const sections = [
  { id: "overview", label: "Overview" },
  { id: "subscriptions", label: "Subscription Refunds" },
  { id: "duplicate", label: "Duplicate Payments" },
  { id: "outages", label: "Platform Outages" },
  { id: "process", label: "Refund Process" },
]

export default function RefundPage() {
  return (
    <LegalDoc title="Refund Policy" updated="1 July 2026" sections={sections}>
      <section id="overview">
        <h3 className="font-semibold mb-2">Our Commitment</h3>
        <p>We want you to be satisfied with Circle Pay. This policy explains when refunds are available and how to request one.</p>
      </section>
      <section id="subscriptions">
        <h3 className="font-semibold mb-2">Subscription Fees</h3>
        <p>Subscription fees are generally non-refundable. When you cancel your subscription, you retain access until the end of your paid billing period. Pro-rata refunds are not provided for early cancellation of monthly or annual plans.</p>
        <p className="mt-2"><strong>Upgrades:</strong> When you upgrade from a lower-tier plan to a higher-tier plan, you are charged the difference for the remaining billing period. You receive immediate access to the new plan features.</p>
        <p className="mt-2"><strong>Downgrades:</strong> When you downgrade, the change takes effect at the end of your current billing period. You are not refunded the price difference for the current period.</p>
        <p className="mt-2"><strong>Exceptions:</strong> Refunds may be provided where required by applicable consumer protection laws, including the South African Consumer Protection Act. If you believe you are entitled to a refund under applicable law, contact us with details of your claim.</p>
      </section>
      <section id="duplicate">
        <h3 className="font-semibold mb-2">Duplicate Payments</h3>
        <p>If you are charged multiple times for the same subscription period due to a billing error, we will refund the duplicate charge upon verification. Contact support within 30 days of the duplicate charge with your payment reference.</p>
      </section>
      <section id="outages">
        <h3 className="font-semibold mb-2">Platform Outages</h3>
        <p>We strive for high availability. In the event of an extended platform outage (more than 24 consecutive hours of complete unavailability), we may, at our discretion, provide a service credit or extend your subscription period. Outages caused by factors beyond our reasonable control do not qualify.</p>
      </section>
      <section id="process">
        <h3 className="font-semibold mb-2">How to Request a Refund</h3>
        <p>To request a refund, contact our support team at support@circlepay.app with your account email and details of the transaction. We review refund requests within 7 business days. Approved refunds are processed through the original payment method and may take 5-10 business days to appear in your account.</p>
      </section>
    </LegalDoc>
  )
}
