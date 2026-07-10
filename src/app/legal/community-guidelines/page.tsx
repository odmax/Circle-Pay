import { LegalDoc } from "@/components/legal/legal-doc"

const sections = [
  { id: "overview", label: "Overview" },
  { id: "prohibited", label: "Prohibited Activities" },
  { id: "conduct", label: "Member Conduct" },
  { id: "reporting", label: "Reporting Violations" },
  { id: "enforcement", label: "Enforcement" },
]

export default function CommunityGuidelinesPage() {
  return (
    <LegalDoc title="Community Guidelines" updated="1 July 2026" sections={sections}>
      <section id="overview">
        <h3 className="font-semibold mb-2">Our Community</h3>
        <p>Circle Pay is built on trust. Circles manage real money, real projects, and real relationships. These Community Guidelines define acceptable behaviour for all Circle Pay users. Violation of these guidelines may result in account suspension, circle removal, and legal action where appropriate.</p>
      </section>
      <section id="prohibited">
        <h3 className="font-semibold mb-2">Prohibited Activities</h3>
        <p>The following activities are strictly prohibited on Circle Pay:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Running Ponzi schemes, pyramid schemes, or fraudulent investment operations</li>
          <li>Money laundering or facilitating the movement of proceeds of crime</li>
          <li>Fraudulently misrepresenting investment opportunities or expected returns</li>
          <li>Creating fake circles or projects to solicit payments under false pretences</li>
          <li>Harassment, intimidation, or abusive behaviour toward other members</li>
          <li>Illegal fundraising for unregistered securities or collective investment schemes</li>
          <li>Terrorist financing or any activity supporting illegal organisations</li>
          <li>Creating multiple fake accounts to manipulate group decisions or finances</li>
          <li>Impersonating other individuals, organisations, or Circle Pay staff</li>
          <li>Spamming members with unsolicited commercial messages</li>
          <li>Posting illegal content, hate speech, or content that violates South African law</li>
          <li>Scraping, data mining, or unauthorised automated access to the platform</li>
        </ul>
      </section>
      <section id="conduct">
        <h3 className="font-semibold mb-2">Member Conduct</h3>
        <p>We expect all members to: honour their financial commitments and contribution pledges, provide accurate information when creating circles and projects, verify payment records honestly, treat other members with respect, report suspicious activity to circle administrators or Circle Pay support, and comply with all applicable laws. Circle owners and administrators have additional responsibilities: vetting members before approving join requests, managing circle finances transparently, and promptly addressing member concerns.</p>
      </section>
      <section id="reporting">
        <h3 className="font-semibold mb-2">Reporting Violations</h3>
        <p>If you encounter behaviour that violates these guidelines, report it immediately via the Circle Pay support system or by contacting support@circlepay.app. We review all reports and take appropriate action. We protect the identity of reporters to the extent permitted by law.</p>
      </section>
      <section id="enforcement">
        <h3 className="font-semibold mb-2">Enforcement</h3>
        <p>Violations of these guidelines may result in: a warning, temporary suspension of account features, permanent account termination, removal from specific circles, reporting to relevant authorities, and legal action. Enforcement decisions are made at our sole discretion based on the severity and nature of the violation.</p>
      </section>
    </LegalDoc>
  )
}
