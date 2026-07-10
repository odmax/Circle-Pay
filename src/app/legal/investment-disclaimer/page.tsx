import { LegalDoc } from "@/components/legal/legal-doc"

const sections = [
  { id: "nature", label: "Nature of the Platform" },
  { id: "not", label: "What Circle Pay Does NOT Do" },
  { id: "user-risk", label: "User Responsibilities & Risk" },
  { id: "roi", label: "ROI & Financial Calculations" },
  { id: "funding", label: "Project Funding & Contributions" },
  { id: "ownership", label: "Ownership & Profit Distribution" },
  { id: "contact", label: "Contact" },
]

export default function InvestmentDisclaimerPage() {
  return (
    <LegalDoc title="Investment Disclaimer" updated="1 July 2026" sections={sections}>
      <section id="nature">
        <h3 className="font-semibold mb-2">Nature of the Platform</h3>
        <p>Circle Pay is a group finance management software platform. It provides organisational tools for circles to track contributions, expenses, goals, settlements, projects, assets, revenue, ROI calculations, and profit distributions. Circle Pay is a technology service — it is not a financial institution, investment platform, or money management service. Circle Pay does not hold, custody, manage, transfer, or invest any user funds. All financial transactions between members occur outside the Circle Pay platform.</p>
      </section>

      <section id="not">
        <h3 className="font-semibold mb-2">What Circle Pay Does NOT Do</h3>
        <p>Circle Pay does not manage investments. Circle Pay does not provide investment advice of any kind, including financial, legal, or tax advice. Circle Pay does not guarantee any returns, profits, or return on investment. ROI calculations displayed on the platform are based solely on data entered by users — they are informational and do not represent guaranteed or actual financial returns. Circle Pay does not guarantee that members will make payments, honour contribution commitments, or participate in funding rounds. Circle Pay does not guarantee project success, completion, or profitability. Circle Pay does not verify asset valuations, ownership claims, or the accuracy of financial data entered by users. Circle Pay does not resolve disputes between circle members regarding money, contributions, expenses, or profit distributions. Circle Pay is not a trustee, financial advisor, bank, insurer, escrow service, or investment manager.</p>
      </section>

      <section id="user-risk">
        <h3 className="font-semibold mb-2">User Responsibilities & Risk Assumption</h3>
        <p>Users remain solely responsible for all investment decisions made within their circles and projects. Users are responsible for their tax obligations arising from any financial activities tracked on the platform. Users are responsible for legal compliance with all applicable laws including securities regulations, tax laws, and financial services regulations. Users are responsible for project management, including vetting investment opportunities, managing funds, and accurately recording financial data. Users assume all risk associated with their investment activities. Circle Pay shall not be liable for any financial losses, failed projects, inaccurate valuations, or disputes arising from the use of the platform's investment tracking features. Past performance data shown on Circle Pay does not guarantee future results. Projected returns and ROI calculations are estimates based on user-provided data and should not be relied upon as financial forecasts.</p>
      </section>

      <section id="roi">
        <h3 className="font-semibold mb-2">ROI & Financial Calculations</h3>
        <p>All return on investment (ROI) calculations, profit estimates, ownership percentages, and distribution amounts displayed on Circle Pay are derived from user-entered financial data. These calculations are provided for informational purposes only. Circle Pay does not validate, audit, or guarantee the accuracy of these calculations. Users should independently verify all financial data before making investment decisions.</p>
      </section>

      <section id="funding">
        <h3 className="font-semibold mb-2">Project Funding & Contributions</h3>
        <p>Project funding rounds and contribution tracking features help circles organise capital raising efforts. Circle Pay tracks member pledges, confirmed payments, and funding progress. Circle Pay does not process, hold, or transfer contributed funds. Payment confirmation relies on proof-of-payment records submitted by users and verified by circle administrators. Circle Pay does not guarantee that confirmed contributions represent actual funds received.</p>
      </section>

      <section id="ownership">
        <h3 className="font-semibold mb-2">Ownership & Profit Distribution</h3>
        <p>Ownership percentages displayed in projects are calculated based on confirmed contribution amounts relative to total project contributions. These percentages are for informational and organisational purposes. Circle Pay does not create, confer, or guarantee any legal ownership rights, equity, or securities in any project or asset. Profit distribution calculations are based on user-entered data and user-selected distribution methods. Circle Pay does not process, transfer, or guarantee the payment of distributed profits.</p>
      </section>

      <section id="contact">
        <h3 className="font-semibold mb-2">Questions</h3>
        <p>For questions about this Investment Disclaimer, contact us at legal@circlepay.app. For financial advice, consult a qualified financial advisor.</p>
      </section>
    </LegalDoc>
  )
}
