import { LegalDoc } from "@/components/legal/legal-doc"

const sections = [
  { id: "overview", label: "Overview" },
  { id: "types", label: "Types of Cookies" },
  { id: "third-party", label: "Third-Party Cookies" },
  { id: "control", label: "Managing Cookies" },
  { id: "contact", label: "Contact" },
]

export default function CookiePage() {
  return (
    <LegalDoc title="Cookie Policy" updated="1 July 2026" sections={sections}>
      <section id="overview">
        <h3 className="font-semibold mb-2">What Are Cookies</h3>
        <p>Cookies are small text files stored on your device when you visit websites. Circle Pay uses cookies and similar technologies to provide core functionality, enhance security, remember your preferences, and analyse platform usage.</p>
      </section>
      <section id="types">
        <h3 className="font-semibold mb-2">Types of Cookies We Use</h3>
        <p><strong>Authentication cookies:</strong> Essential for keeping you signed in and maintaining session security. Without these, you cannot use the platform.</p>
        <p className="mt-2"><strong>Session cookies:</strong> Temporary cookies that expire when you close your browser. Used to maintain your active session state.</p>
        <p className="mt-2"><strong>Preference cookies:</strong> Remember your settings such as preferred currency, compact mode, theme preference, and notification settings.</p>
        <p className="mt-2"><strong>Analytics cookies:</strong> Help us understand how users interact with the platform — which features are used, session duration, and navigation patterns — so we can improve the experience. These are anonymised and do not identify individual users.</p>
        <p className="mt-2"><strong>Security cookies:</strong> Help detect and prevent fraudulent activity, unauthorised access attempts, and abuse of the platform.</p>
      </section>
      <section id="third-party">
        <h3 className="font-semibold mb-2">Third-Party Cookies</h3>
        <p>Circle Pay uses Google OAuth for authentication, which may set its own cookies during the sign-in process. Our payment processor may set cookies during checkout for fraud prevention. These third-party cookies are governed by the respective providers' privacy policies.</p>
      </section>
      <section id="control">
        <h3 className="font-semibold mb-2">Managing Cookies</h3>
        <p>Most browsers allow you to control cookie settings. You can block or delete cookies through your browser settings. However, disabling essential cookies will prevent you from using Circle Pay. Disabling preference cookies will reset your settings to defaults on each visit.</p>
      </section>
      <section id="contact">
        <h3 className="font-semibold mb-2">Questions</h3>
        <p>For questions about our Cookie Policy, contact privacy@circlepay.app.</p>
      </section>
    </LegalDoc>
  )
}
