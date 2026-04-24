import LegalLayout from "@/components/LegalLayout";

export default function Privacy() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="How Capraly handles your data — written in plain English. Last updated: April 2026."
    >
      <p>
        This policy explains what we collect when you use Capraly, how we use it, and the rights
        you have over your data — wherever in the world you live. We aim to comply with major
        international privacy frameworks including the EU/UK <strong>GDPR</strong>, the
        <strong> California Consumer Privacy Act (CCPA/CPRA)</strong>, Brazil's
        <strong> LGPD</strong>, Canada's <strong>PIPEDA</strong>, and Australia's
        <strong> Privacy Act</strong>.
      </p>

      <h2>1. Who we are</h2>
      <p>
        "Capraly" ("we", "us") provides an AI-powered code editor at the URL you accessed this
        page from. For privacy questions, contact <a href="mailto:privacy@capraly.app">privacy@capraly.app</a>.
      </p>

      <h2>2. What we collect</h2>
      <ul>
        <li><strong>Account data:</strong> email address, and (if you sign in with Google) your name and avatar URL.</li>
        <li><strong>Project data:</strong> the projects, files, and code you create and save.</li>
        <li><strong>AI prompts:</strong> the file contents and chat messages you send to the bug finder or chat assistant.</li>
        <li><strong>Operational logs:</strong> IP address, user agent, timestamps, and error traces (kept ≤ 30 days).</li>
      </ul>

      <h2>3. How we use it</h2>
      <ul>
        <li>To run the editor (store and serve your files).</li>
        <li>To provide AI features by forwarding the relevant code/prompt to our model providers.</li>
        <li>To secure the service (rate-limiting, abuse detection).</li>
        <li>We do <strong>not</strong> sell your personal information and we do <strong>not</strong> use your code to train AI models.</li>
      </ul>

      <h2>4. Sub-processors</h2>
      <p>We share data with the minimum necessary providers to run the service:</p>
      <ul>
        <li><strong>Lovable Cloud / Supabase</strong> — database, authentication, edge functions.</li>
        <li><strong>Lovable AI Gateway</strong> (Google Gemini, OpenAI GPT) — AI inference. Prompts are processed under each provider's enterprise no-training terms.</li>
        <li><strong>Google</strong> — only if you choose Google sign-in.</li>
      </ul>

      <h2>5. International transfers</h2>
      <p>
        Your data may be processed in regions other than your own (e.g. the United States,
        European Union, Asia-Pacific). Where required, we rely on Standard Contractual Clauses
        (SCCs) or equivalent mechanisms to lawfully transfer personal data.
      </p>

      <h2>6. Your rights</h2>
      <p>Depending on your region, you may have the right to:</p>
      <ul>
        <li>Access, correct, or download a copy of your personal data.</li>
        <li>Delete your account and all associated projects/files.</li>
        <li>Object to or restrict certain processing.</li>
        <li>Withdraw consent (where processing is based on consent).</li>
        <li>Lodge a complaint with your local data protection authority.</li>
      </ul>
      <p>Email <a href="mailto:privacy@capraly.app">privacy@capraly.app</a> to exercise any of these rights. We respond within 30 days.</p>

      <h2>7. Retention</h2>
      <p>
        Account and project data is retained until you delete it or close your account. Operational
        logs are retained for up to 30 days. Backups are rotated within 35 days.
      </p>

      <h2>8. Children</h2>
      <p>Capraly is not directed to children under 13 (or 16 in the EEA). We do not knowingly collect data from minors below those ages.</p>

      <h2>9. Cookies</h2>
      <p>We use essential cookies/local storage only (session token, theme). No advertising or cross-site tracking cookies.</p>

      <h2>10. Changes</h2>
      <p>We may update this policy. Material changes will be announced in-app at least 14 days before they take effect.</p>
    </LegalLayout>
  );
}
