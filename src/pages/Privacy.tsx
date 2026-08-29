import { LegalPage, LegalSection } from "../components/LegalPage"

export function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="How ResuMate handles information when you build, analyze, save, share, or pay for career tools."
      summary={
        <p>
          Ordinary editing stays in your browser. We process information on our servers only when
          you deliberately use an online feature, create an account, contact us, or buy a plan. We
          do not sell personal information.
        </p>
      }
    >
      <LegalSection title="1. Who we are">
        <p>
          ResuMate is a Built WAI service ("ResuMate," "we," "us," or "our") available at
          resume.builtwai.com. This policy applies to the ResuMate website, app, accounts, paid
          plans, and related support.
        </p>
        <p>
          Questions or privacy requests can be sent to{" "}
          <a href="mailto:support@builtwai.com">support@builtwai.com</a>.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we handle">
        <ul className="bullet-list">
          <li><strong>On-device content.</strong> Resumes, saved job descriptions, theme settings, and optional AI-provider settings are stored in your browser unless you choose an online feature or future account-sync feature.</li>
          <li><strong>Account information.</strong> If you register, we process your name, email address, password-derived authentication data, email-verification status, plan, and account activity.</li>
          <li><strong>Resume and job-search content.</strong> This may include contact details, work history, education, skills, job descriptions, cover letters, and other text you enter. Online AI features receive only the content needed for the request you initiate.</li>
          <li><strong>Payment information.</strong> For paid plans, our checkout provider processes payment-card and billing details. We receive transaction details such as the plan, amount, currency, status, and a payment-customer identifier, but not your full card number.</li>
          <li><strong>Technical and support data.</strong> Our hosting and security providers may process IP address, device and browser information, request timestamps, error data, and security events. We also process messages and attachments you send to support.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How we use information">
        <ul className="bullet-list">
          <li>Provide the editor, exports, accounts, optional AI tools, future account sync, subscriptions, and customer support.</li>
          <li>Authenticate accounts, remember settings, and maintain service security.</li>
          <li>Process purchases, prevent fraud, keep accounting records, and send service or billing notices.</li>
          <li>Debug, maintain, and improve ResuMate using aggregated or appropriately limited technical information.</li>
          <li>Comply with law, enforce our Terms, and protect users, ResuMate, and others.</li>
        </ul>
        <p>
          Where applicable, our legal bases are performing our contract with you, our legitimate
          interests in operating and securing the service, your consent, and compliance with legal
          obligations. You may withdraw consent where consent is the basis for processing.
        </p>
      </LegalSection>

      <LegalSection title="4. AI features and automated output">
        <p>
          Offline ATS checks run locally. When you choose an online AI feature, the resume and/or
          job-description text needed for that request is sent through ResuMate's serverless
          endpoint to the configured AI provider. If you use your own provider key, that provider's
          terms and privacy practices also apply. Do not submit information you do not want that
          provider to process.
        </p>
        <p>
          AI output is assistive and may be inaccurate. ResuMate does not use AI output to make
          employment decisions about you.
        </p>
      </LegalSection>

      <LegalSection title="5. Share links">
        <p>
          A ResuMate share link contains an encoded copy of the resume in the URL fragment. The
          payload is not included in ordinary web requests to our server, but it is not encrypted.
          Anyone with the link can decode and read it, and there is no server-side way to revoke a
          link that has already been copied. Treat share links like public documents.
        </p>
      </LegalSection>

      <LegalSection title="6. When we disclose information">
        <p>We may disclose the minimum information needed to:</p>
        <ul className="bullet-list">
          <li>Hosting, authentication, AI, payment, email, analytics, error-monitoring, and support providers acting for us.</li>
          <li>Comply with law, valid legal process, or requests from competent authorities.</li>
          <li>Protect rights, safety, service integrity, and prevent fraud or abuse.</li>
          <li>Complete a merger, financing, acquisition, reorganization, or sale of assets, subject to appropriate safeguards.</li>
        </ul>
        <p>We do not sell personal information or share it for cross-context behavioral advertising.</p>
      </LegalSection>

      <LegalSection title="7. Storage and retention">
        <p>
          Browser data remains on your device until you clear it, remove the browser profile, or use
          ResuMate's Clear data control. If account storage is offered, we retain account content
          while the account is active and for a limited period after deletion to complete deletion,
          maintain backups, resolve disputes, prevent fraud, and meet legal obligations. Payment and
          tax records may be kept for the legally required period. Security logs are retained only as
          long as reasonably needed for security and operations.
        </p>
      </LegalSection>

      <LegalSection title="8. Your choices and rights">
        <ul className="bullet-list">
          <li>Export or delete locally stored data from Settings.</li>
          <li>View or delete your account through the account controls. Contact support to request a correction to profile information.</li>
          <li>Request access, correction, deletion, portability, or restriction where local law provides those rights.</li>
          <li>Object to certain processing or withdraw consent where applicable.</li>
          <li>Appeal a privacy-request decision or complain to your local data-protection authority where available.</li>
        </ul>
        <p>
          We will not discriminate against you for exercising a privacy right. Email requests to{" "}
          <a href="mailto:support@builtwai.com">support@builtwai.com</a>. We may need to verify your
          identity, and an authorized agent may submit a request where permitted by law.
        </p>
      </LegalSection>

      <LegalSection title="9. Cookies and browser storage">
        <p>
          ResuMate uses browser storage for essential app functions such as saved resumes, active
          document selection, settings, and theme. We will request consent before using non-essential
          cookies where required. Browser controls can remove stored data, but doing so may reset the
          app or sign you out.
        </p>
      </LegalSection>

      <LegalSection title="10. Security, transfers, and children">
        <p>
          We use reasonable technical and organizational safeguards, but no system is completely
          secure. Providers may process information in countries other than yours; where required,
          we use recognized transfer safeguards.
        </p>
        <p>
          ResuMate is not directed to children under 16, and we do not knowingly collect their
          personal information through accounts. Contact us if you believe a child has provided
          account information without appropriate permission.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes to this policy">
        <p>
          We may update this policy as ResuMate changes. We will post the revised date and provide
          additional notice when a change is material or law requires it. Earlier versions may be
          requested by email.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
