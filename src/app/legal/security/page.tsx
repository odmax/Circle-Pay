import { LegalDoc } from "@/components/legal/legal-doc"

const sections = [
  { id: "overview", label: "Our Security Commitment" },
  { id: "auth", label: "Authentication & Access Control" },
  { id: "data", label: "Data Protection" },
  { id: "infra", label: "Infrastructure Security" },
  { id: "monitoring", label: "Monitoring & Audit" },
  { id: "disclosure", label: "Responsible Disclosure" },
  { id: "future", label: "Future Security Enhancements" },
]

export default function SecurityPage() {
  return (
    <LegalDoc title="Security" updated="1 July 2026" sections={sections}>
      <section id="overview">
        <h3 className="font-semibold mb-2">Our Security Commitment</h3>
        <p>Circle Pay takes the security of your data seriously. This page describes the security measures we implement to protect your account, your data, and your financial records. Security is an ongoing process, and we continuously improve our practices.</p>
      </section>
      <section id="auth">
        <h3 className="font-semibold mb-2">Authentication & Access Control</h3>
        <p><strong>Password hashing:</strong> All user passwords are hashed using bcrypt with unique per-password salts. Plain-text passwords are never stored. We cannot recover your password — only you can reset it.</p>
        <p className="mt-2"><strong>Google OAuth:</strong> We support sign-in via Google OAuth, which uses Google's security infrastructure for authentication.</p>
        <p className="mt-2"><strong>Role-based permissions:</strong> Platform access is governed by a granular role-based permission system. Internal administrators are assigned specific roles (SUPER_ADMIN, ADMIN, SUPPORT, FINANCE) with defined access scopes. All administrative actions are logged and auditable.</p>
        <p className="mt-2"><strong>Circle-level permissions:</strong> Within circles, access to features and data is controlled by member roles (OWNER, ADMIN, MEMBER). Sensitive operations require owner or administrator authorisation.</p>
      </section>
      <section id="data">
        <h3 className="font-semibold mb-2">Data Protection</h3>
        <p><strong>Encryption in transit:</strong> All data transmitted between your browser and Circle Pay is encrypted using TLS/SSL. Our API endpoints enforce HTTPS connections.</p>
        <p className="mt-2"><strong>Database encryption:</strong> Our PostgreSQL database uses encrypted connections (SSL/TLS). Database credentials are stored securely in environment variables and never exposed to client-side code.</p>
        <p className="mt-2"><strong>Immutable financial records:</strong> Ledger entries, once recorded, cannot be modified. All financial mutations are recorded as immutable audit events, ensuring a complete and verifiable transaction history.</p>
        <p className="mt-2"><strong>Soft deletion:</strong> Financial records are soft-deleted rather than permanently removed, preserving data integrity for audit purposes.</p>
      </section>
      <section id="infra">
        <h3 className="font-semibold mb-2">Infrastructure Security</h3>
        <p><strong>Hosting:</strong> Circle Pay is hosted on Vercel, which provides DDoS protection, a global CDN, and Web Application Firewall capabilities.</p>
        <p className="mt-2"><strong>Database:</strong> Our database runs on Neon (PostgreSQL on AWS) with automated backups, point-in-time recovery, and encrypted data at rest.</p>
        <p className="mt-2"><strong>Backups:</strong> Database backups are performed automatically by our hosting provider. We maintain the ability to restore data in the event of data loss or corruption.</p>
        <p className="mt-2"><strong>Incident response:</strong> We have procedures in place for identifying, containing, and resolving security incidents. Affected users will be notified promptly if their data is compromised.</p>
      </section>
      <section id="monitoring">
        <h3 className="font-semibold mb-2">Monitoring & Audit</h3>
        <p><strong>Audit logs:</strong> All significant actions on the platform — including data changes, administrative actions, permission changes, and financial mutations — are recorded in immutable audit logs. These logs are retained for security and compliance purposes.</p>
        <p className="mt-2"><strong>Fraud detection:</strong> Our owner dashboard includes fraud and abuse monitoring tools that detect unusual patterns such as rapid membership growth, suspicious payment activity, and low-reputation circles.</p>
      </section>
      <section id="disclosure">
        <h3 className="font-semibold mb-2">Responsible Disclosure</h3>
        <p>If you discover a security vulnerability in Circle Pay, we encourage you to report it responsibly. Please email security@circlepay.app with a detailed description. We request that you: give us reasonable time to investigate and address the issue before public disclosure, avoid exploiting the vulnerability beyond what is necessary to demonstrate it, and respect the privacy of other users' data. We do not currently operate a bug bounty program but we acknowledge and appreciate responsible disclosures.</p>
      </section>
      <section id="future">
        <h3 className="font-semibold mb-2">Future Security Enhancements</h3>
        <p>We are evaluating additional security features including: multi-factor authentication (MFA), session management improvements, API rate limiting enhancements, email verification requirements for sensitive operations, and enhanced password policy enforcement.</p>
      </section>
    </LegalDoc>
  )
}
