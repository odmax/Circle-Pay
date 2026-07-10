import { LegalDoc } from "@/components/legal/legal-doc"

const sections = [
  { id: "overview", label: "Overview" },
  { id: "prohibited", label: "Prohibited Uses" },
  { id: "enforcement", label: "Enforcement & Reporting" },
]

export default function AcceptableUsePage() {
  return (
    <LegalDoc title="Acceptable Use Policy" updated="1 July 2026" sections={sections}>
      <section id="overview">
        <h3 className="font-semibold mb-2">Purpose</h3>
        <p>This Acceptable Use Policy defines prohibited uses of Circle Pay. By using the platform, you agree not to engage in any of the activities described below. This policy applies to all users regardless of subscription plan or role.</p>
      </section>
      <section id="prohibited">
        <h3 className="font-semibold mb-2">Prohibited Uses</h3>
        <p>You may not use Circle Pay to:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Conduct or facilitate any illegal activity under South African or international law</li>
          <li>Process, track, or manage funds obtained through theft, fraud, or other criminal activity</li>
          <li>Create fake or deceptive circles for the purpose of defrauding members</li>
          <li>Commit identity fraud or impersonate another person</li>
          <li>Use automated scripts, bots, or scraping tools to extract data from the platform</li>
          <li>Reverse engineer, decompile, or attempt to extract the source code of the platform</li>
          <li>Introduce malware, viruses, or harmful code</li>
          <li>Bypass or attempt to bypass platform security measures</li>
          <li>Create multiple accounts to circumvent platform limits or suspension</li>
          <li>Violate international sanctions or trade restrictions</li>
          <li>Use the platform to facilitate unregistered financial services requiring regulatory approval</li>
          <li>Store or transmit content that infringes intellectual property rights</li>
          <li>Overload or disrupt the platform's infrastructure through excessive API calls or automated requests</li>
        </ul>
      </section>
      <section id="enforcement">
        <h3 className="font-semibold mb-2">Enforcement & Reporting</h3>
        <p>We reserve the right to investigate and take action against any violation of this policy, including account suspension or termination without prior notice. We may report illegal activity to law enforcement authorities. To report a suspected violation, contact abuse@circlepay.app.</p>
      </section>
    </LegalDoc>
  )
}
