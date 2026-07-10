import { LegalDoc } from "@/components/legal/legal-doc"

const sections = [
  { id: "acceptance", label: "Acceptance of Terms" },
  { id: "accounts", label: "Accounts" },
  { id: "subscriptions", label: "Subscriptions & Billing" },
  { id: "circles", label: "Circles & Members" },
  { id: "projects", label: "Projects & Investments" },
  { id: "disclaimer", label: "Platform Limitations" },
  { id: "liability", label: "Limitation of Liability" },
  { id: "termination", label: "Suspension & Termination" },
  { id: "disputes", label: "Dispute Resolution" },
  { id: "changes", label: "Changes to Terms" },
  { id: "contact", label: "Contact" },
]

export default function TermsPage() {
  return (
    <LegalDoc title="Terms & Conditions" updated="1 July 2026" sections={sections}>
      <section id="acceptance">
        <h3 className="font-semibold mb-2">Acceptance of Terms</h3>
        <p>By accessing or using Circle Pay ("the Service"), you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, you may not use the Service. These Terms constitute a legally binding agreement between you and Mozetech ("Circle Pay," "we," "us," or "our").</p>
        <h3 className="font-semibold mt-4 mb-2">Eligibility</h3>
        <p>You must be at least 16 years of age to use the Service. By creating an account, you represent and warrant that you have the legal capacity to enter into these Terms and that all information you provide is accurate and complete.</p>
      </section>

      <section id="accounts">
        <h3 className="font-semibold mb-2">Account Registration</h3>
        <p>You must create an account to use the Service. You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorised use of your account.</p>
        <h3 className="font-semibold mt-4 mb-2">Account Suspension</h3>
        <p>We reserve the right to suspend or terminate your account at any time for violation of these Terms, suspected fraudulent activity, or failure to pay subscription fees. Suspended accounts may lose access to circle data and project records until the issue is resolved.</p>
      </section>

      <section id="subscriptions">
        <h3 className="font-semibold mb-2">Subscription Plans</h3>
        <p>Circle Pay offers Free, Premium, and Community subscription plans. Each plan provides different features and limits as described on our pricing page. We reserve the right to modify pricing and features with reasonable notice.</p>
        <h3 className="font-semibold mt-4 mb-2">Billing</h3>
        <p>Subscription fees are billed in advance on a monthly or annual basis. You authorise us to charge your selected payment method for recurring subscription fees. All fees are non-refundable except as required by applicable law or as described in our Refund Policy.</p>
        <h3 className="font-semibold mt-4 mb-2">Cancellation</h3>
        <p>You may cancel your subscription at any time through your account settings. Cancellation takes effect at the end of your current billing period. You will retain access to the Service until the paid period expires. No pro-rata refunds are provided for early cancellation.</p>
      </section>

      <section id="circles">
        <h3 className="font-semibold mb-2">Circle Administration</h3>
        <p>Circle owners and administrators are responsible for managing their circle's membership, contributions, expenses, and financial records. Circle Pay provides the software tools for management but does not mediate disputes between members, enforce contribution payments, or guarantee the accuracy of financial records entered by users.</p>
        <h3 className="font-semibold mt-4 mb-2">Member Responsibilities</h3>
        <p>Circle members are responsible for honouring contribution commitments, verifying payment records, and engaging in good faith with their circle. Circle Pay does not guarantee that other members will fulfil their financial obligations.</p>
      </section>

      <section id="projects">
        <h3 className="font-semibold mb-2">Project Management</h3>
        <p>Circle Pay provides project management tools including funding rounds, contribution tracking, expense management, asset recording, revenue tracking, ROI calculation, and profit distribution. These tools are for informational and organisational purposes only.</p>
        <h3 className="font-semibold mt-4 mb-2">Investment Disclaimer</h3>
        <p>Circle Pay is software. Circle Pay does not: manage investments, provide investment advice, guarantee profits, guarantee ROI, guarantee member payments, guarantee project success, verify asset valuations, guarantee project ownership, resolve member disputes, hold investment funds, act as trustee, act as financial advisor, act as a bank, act as an insurer, or act as an escrow service. Users remain solely responsible for their investment decisions, tax obligations, legal compliance, project management, and the accuracy of all financial records entered into the platform. Please read our Investment Disclaimer for complete details.</p>
      </section>

      <section id="disclaimer">
        <h3 className="font-semibold mb-2">Platform Limitations</h3>
        <p>The Service is provided on an "as is" and "as available" basis. We do not warrant that the Service will be uninterrupted, error-free, or completely secure. We make no representations about the accuracy, reliability, or completeness of any data or calculations provided by the Service. Wallet tracking features record contributions and expenses for transparency purposes; Circle Pay does not hold or custody any funds. All financial transactions occur between members outside the platform.</p>
      </section>

      <section id="liability">
        <h3 className="font-semibold mb-2">Limitation of Liability</h3>
        <p>To the maximum extent permitted by law, Circle Pay and its affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages including loss of profits, data, or goodwill arising from your use of or inability to use the Service. Our total liability for any claim arising from these Terms shall not exceed the amount you paid us in the twelve months preceding the claim.</p>
        <h3 className="font-semibold mt-4 mb-2">Indemnity</h3>
        <p>You agree to indemnify and hold harmless Circle Pay and its officers, directors, and employees from any claims, damages, or expenses arising from your use of the Service, violation of these Terms, or infringement of any third-party rights.</p>
      </section>

      <section id="termination">
        <h3 className="font-semibold mb-2">Suspension & Termination</h3>
        <p>We may suspend or terminate your access to the Service at any time for: violation of these Terms, fraudulent activity, illegal conduct, non-payment of fees, or extended account inactivity. Upon termination, your right to use the Service ceases immediately. Data contributed to circles may persist after your account termination to preserve the integrity of the circle's financial records.</p>
      </section>

      <section id="disputes">
        <h3 className="font-semibold mb-2">Dispute Resolution</h3>
        <p>Any dispute arising from these Terms shall first be attempted to be resolved through good-faith negotiation. If negotiation fails, the dispute shall be referred to mediation in South Africa. If mediation fails, the dispute shall be resolved by arbitration in accordance with the rules of the Arbitration Foundation of Southern Africa.</p>
        <h3 className="font-semibold mt-4 mb-2">Governing Law</h3>
        <p>These Terms are governed by the laws of the Republic of South Africa. Any legal proceedings shall be brought exclusively in the courts of South Africa.</p>
      </section>

      <section id="changes">
        <h3 className="font-semibold mb-2">Changes to Terms</h3>
        <p>We may modify these Terms at any time. Material changes will be communicated via email or platform notice at least 14 days before taking effect. Continued use of the Service after changes take effect constitutes acceptance of the modified Terms.</p>
      </section>

      <section id="contact">
        <h3 className="font-semibold mb-2">Contact</h3>
        <p>For questions about these Terms, contact us at: legal@circlepay.app</p>
      </section>
    </LegalDoc>
  )
}
