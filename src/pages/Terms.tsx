import LegalLayout from "@/components/LegalLayout";

export default function Terms() {
  return (
    <LegalLayout
      title="Terms & Conditions"
      subtitle="The agreement between you and Capraly. Last updated: April 2026."
    >
      <p>
        By accessing or using Capraly ("the Service"), you agree to these Terms. If you do not
        agree, do not use the Service.
      </p>

      <h2>1. Accounts</h2>
      <p>
        You must be at least 13 years old (or 16 in the EEA) to create an account. You are
        responsible for keeping your credentials secure and for activity carried out under
        your account.
      </p>

      <h2>2. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service to develop or distribute malware, phishing kits, or other malicious code.</li>
        <li>Reverse engineer, scrape, or attempt to bypass usage quotas or AI rate-limits.</li>
        <li>Upload illegal content or content that infringes others' intellectual property.</li>
        <li>Resell access to AI features without our written consent.</li>
      </ul>

      <h2>3. Your content</h2>
      <p>
        You retain ownership of all code and content you upload. You grant us a limited license
        to store, transmit, and process it solely as needed to provide the Service (e.g.
        forwarding code to AI providers when you click "Scan for bugs").
      </p>

      <h2>4. AI output</h2>
      <p>
        AI-generated suggestions are provided as-is. They may be incorrect, insecure, or
        infringe third-party rights. <strong>Always review AI output before applying it</strong>,
        and never deploy code you don't understand.
      </p>

      <h2>5. Plans, billing, and refunds</h2>
      <p>
        See our <a href="/pricing">Pricing page</a> for current plans. Paid plans renew automatically
        until cancelled. Cancellation takes effect at the end of the current billing period; no
        partial refunds, except where required by law.
      </p>

      <h2>6. Service availability</h2>
      <p>
        We aim for high availability but do not guarantee uninterrupted service. Scheduled
        maintenance will be announced in-app where reasonably possible.
      </p>

      <h2>7. Termination</h2>
      <p>
        We may suspend or terminate your account if you breach these Terms or if your use
        endangers the Service or other users. You may delete your account at any time from the
        editor footer.
      </p>

      <h2>8. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
        TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, CAPRALY'S TOTAL LIABILITY ARISING OUT OF OR
        RELATED TO THE SERVICE WILL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS
        PRECEDING THE CLAIM, OR USD $100, WHICHEVER IS GREATER.
      </p>

      <h2>10. Governing law</h2>
      <p>
        These Terms are governed by the laws of the jurisdiction in which Capraly is
        established, without regard to conflict-of-laws principles. Mandatory consumer
        protections in your country of residence still apply.
      </p>

      <h2>11. Contact</h2>
      <p>Questions? Email <a href="mailto:legal@capraly.app">legal@capraly.app</a>.</p>
    </LegalLayout>
  );
}
