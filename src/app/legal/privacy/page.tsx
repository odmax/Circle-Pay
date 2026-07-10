import { LegalDoc } from "@/components/legal/legal-doc"

export default function PrivacyPage() {
  return (
    <LegalDoc title="Privacy Policy" updated="1 July 2026" sections={[
      { id: "intro", label: "Introduction" },
      { id: "info", label: "Information We Collect" },
      { id: "how", label: "How We Use Information" },
      { id: "sharing", label: "Who Can See Your Data" },
      { id: "popia", label: "Your POPIA Rights" },
      { id: "gdpr", label: "Your GDPR Rights" },
      { id: "retention", label: "Data Retention & Deletion" },
      { id: "security", label: "How We Protect Your Data" },
      { id: "cross-border", label: "Cross-Border Processing" },
      { id: "children", label: "Children's Privacy" },
      { id: "changes", label: "Changes to This Policy" },
      { id: "contact", label: "Contact Us" },
    ]}>
      <Section id="intro">
        <p>Circle Pay ("we," "us," or "our") is a group finance management platform operated by Mozetech. This Privacy Policy explains how we collect, use, disclose, and safeguard your personal information when you use our platform at circlepay.app and all related services (collectively, the "Service").</p>
        <p className="mt-3">By using the Service, you consent to the practices described in this policy. We are committed to complying with the Protection of Personal Information Act, 2013 (POPIA) of South Africa and the General Data Protection Regulation (GDPR) where applicable.</p>
      </Section>

      <Section id="info">
        <h3 className="font-semibold mb-2">Account & Profile Information</h3>
        <p>When you register for Circle Pay, we collect your name, email address, and optionally your phone number and profile picture. If you sign in using Google OAuth, we receive your Google account name and email address subject to your Google privacy settings.</p>

        <h3 className="font-semibold mt-4 mb-2">Financial & Circle Data</h3>
        <p>We collect and store data you enter into the platform including: circle names, member lists, contribution amounts, expense records, goal targets, settlement records, wallet tracking entries, project details, investment asset information, revenue records, and profit distribution calculations. We also store payment intent records, proof of payment references, and subscription payment transactions processed through our payment provider.</p>

        <h3 className="font-semibold mt-4 mb-2">Technical Data</h3>
        <p>We automatically collect device information, browser type, IP address, operating system, referring URLs, session duration, and page interaction data. We use cookies and similar technologies for authentication, session management, preferences, analytics, and security monitoring.</p>

        <h3 className="font-semibold mt-4 mb-2">Communication Data</h3>
        <p>We store support tickets, messages to our team, feed posts within circles, event RSVPs, poll votes, notification preferences, and audit logs of actions taken on the platform.</p>
      </Section>

      <Section id="how">
        <h3 className="font-semibold mb-2">Service Operation</h3>
        <p>We use your information to provide, maintain, and improve the Service, including: authenticating your account, processing subscription payments, displaying circle dashboards, calculating contributions and balances, generating reports, sending notifications, facilitating project funding and expense tracking, and computing ROI and ownership percentages.</p>

        <h3 className="font-semibold mt-4 mb-2">Communication</h3>
        <p>We use your email address to send service-related communications including: account verification, subscription confirmations, billing notices, circle activity notifications (based on your preferences), project updates, distribution notifications, platform announcements, and responses to support inquiries. You can manage notification preferences in your Settings.</p>

        <h3 className="font-semibold mt-4 mb-2">Analytics & Improvement</h3>
        <p>We analyse anonymised usage patterns to improve the platform, detect fraud, measure feature adoption, and optimise performance. We do not sell your personal information to third parties.</p>

        <h3 className="font-semibold mt-4 mb-2">Legal Compliance</h3>
        <p>We may process your information to comply with legal obligations, respond to lawful requests from public authorities, enforce our Terms and Conditions, protect our rights, and prevent fraud or illegal activity.</p>
      </Section>

      <Section id="sharing">
        <h3 className="font-semibold mb-2">Circle Members & Admins</h3>
        <p>Within a circle, members can see: your name, email address (as displayed in member lists), your contribution history, expense shares, settlement balances, and goal allocations relevant to that circle. Circle owners and administrators can additionally see: your payment intent status, proof of payment references, and join request details.</p>

        <h3 className="font-semibold mt-4 mb-2">Project Visibility</h3>
        <p>Within a project, members can see: contribution amounts, confirmed funding, expense records, and ownership percentages. Financial data entered into projects is visible to all members of the parent circle with access to that project.</p>

        <h3 className="font-semibold mt-4 mb-2">Platform Administrators</h3>
        <p>Authorised internal administrators of Circle Pay (SUPER_ADMIN, ADMIN, SUPPORT, and FINANCE roles) can access platform data for purposes of: providing customer support, investigating reported issues, monitoring for fraud and abuse, ensuring compliance with our terms, and generating aggregate analytics. Internal administrators cannot see your password. All administrative access is logged in audit records.</p>

        <h3 className="font-semibold mt-4 mb-2">Service Providers</h3>
        <p>We share necessary information with third-party service providers who assist us in operating the Service, including: our payment processor (for subscription billing), our database hosting provider (Neon PostgreSQL), our cloud hosting platform (Vercel), and authentication providers (Google OAuth). These providers are bound by confidentiality agreements and data processing terms.</p>

        <h3 className="font-semibold mt-4 mb-2">Legal Disclosure</h3>
        <p>We may disclose your information if required by law, court order, or governmental regulation, or if we believe disclosure is necessary to protect our rights, your safety, or the safety of others.</p>
      </Section>

      <Section id="popia">
        <h3 className="font-semibold mb-2">Your Rights Under POPIA</h3>
        <p>As a South African data subject, you have the right to: request access to your personal information held by us; request correction or deletion of inaccurate information; object to the processing of your personal information; lodge a complaint with the Information Regulator of South Africa; and withdraw consent where processing is based on consent. To exercise these rights, contact us at the email address below.</p>
      </Section>

      <Section id="gdpr">
        <h3 className="font-semibold mb-2">Your Rights Under GDPR</h3>
        <p>If you are located in the European Economic Area or the United Kingdom, you have the right to: access your personal data; rectify inaccurate data; erase your data ("right to be forgotten"); restrict processing; data portability; and object to processing. We process personal data under the following legal bases: performance of a contract (providing the Service), legitimate interests (platform improvement and security), consent (marketing communications where applicable), and legal obligations. To exercise your GDPR rights, contact us at the email address below.</p>
      </Section>

      <Section id="retention">
        <h3 className="font-semibold mb-2">Data Retention</h3>
        <p>We retain your personal information for as long as your account is active or as needed to provide the Service. If you delete your account, we will delete or anonymise your personal information within 90 days, except where retention is required by law (such as financial records for tax purposes) or necessary for legitimate business purposes (such as audit logs for security).</p>

        <h3 className="font-semibold mt-4 mb-2">Data Export & Deletion</h3>
        <p>You may request an export of your personal data in a machine-readable format by contacting us. You may request deletion of your account and associated data unless retention is legally required. Circle data contributed by you (such as transaction records) may remain visible to circle members after account deletion to preserve the integrity of the circle's financial records.</p>
      </Section>

      <Section id="security">
        <h3 className="font-semibold mb-2">Security Measures</h3>
        <p>We implement industry-standard security measures including: password hashing using bcrypt with unique salts, encrypted data transmission via TLS/SSL, role-based access controls for administrative functions, comprehensive audit logging of all data mutations, database connection pooling with encrypted connections, and regular security monitoring. For more details, see our Security page.</p>
      </Section>

      <Section id="cross-border">
        <h3 className="font-semibold mb-2">Cross-Border Data Transfers</h3>
        <p>Circle Pay is hosted on infrastructure in the United States (Vercel) and uses a database hosted in the United States (Neon PostgreSQL on AWS). By using the Service, you acknowledge that your data may be processed in countries outside your country of residence. We ensure appropriate safeguards are in place, including standard contractual clauses and data processing agreements with our infrastructure providers.</p>
      </Section>

      <Section id="children">
        <h3 className="font-semibold mb-2">Children's Privacy</h3>
        <p>Circle Pay is not intended for use by children under the age of 16. We do not knowingly collect personal information from children under 16. If we discover that a child under 16 has provided us with personal information, we will promptly delete it.</p>
      </Section>

      <Section id="changes">
        <h3 className="font-semibold mb-2">Changes to This Policy</h3>
        <p>We may update this Privacy Policy from time to time. We will notify you of material changes via email or through a prominent notice on the platform. Continued use of the Service after changes take effect constitutes acceptance of the updated policy.</p>
      </Section>

      <Section id="contact">
        <h3 className="font-semibold mb-2">Contact Information</h3>
        <p>If you have questions about this Privacy Policy or wish to exercise your data rights, contact us at:</p>
        <p className="mt-2">Email: privacy@circlepay.app</p>
        <p>Address: Mozetech, South Africa</p>
        <p className="mt-3">Information Regulator of South Africa: <a href="https://inforegulator.org.za" className="text-brand hover:underline" target="_blank">inforegulator.org.za</a></p>
      </Section>
    </LegalDoc>
  )
}

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return <section id={id}>{children}</section>
}
