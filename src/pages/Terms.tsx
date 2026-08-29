import { LegalPage, LegalSection } from "../components/LegalPage"

export function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      description="The rules that apply when you use ResuMate accounts, software tools, and paid plans."
      summary={
        <p>
          You keep ownership of your resume content. Use ResuMate lawfully, review AI-generated
          suggestions before relying on them, and cancel a paid subscription before its next renewal
          if you do not want another charge.
        </p>
      }
    >
      <LegalSection title="1. Agreement to these Terms">
        <p>
          These Terms are an agreement between you and Built WAI for use of ResuMate (the
          "Service"). By accessing or using the Service, you agree to these Terms and our Privacy
          Policy. If you do not agree, do not use the Service.
        </p>
        <p>
          You must be at least 16 years old to create an account or purchase a plan. If local law
          requires you to be older to contract on your own, a parent or legal guardian must agree on
          your behalf.
        </p>
      </LegalSection>

      <LegalSection title="2. What ResuMate provides">
        <p>
          ResuMate provides resume editing, importing, exporting, ATS analysis, writing assistance,
          cover-letter tools, interview preparation, and related features. Features may be added,
          changed, suspended, or discontinued. We will give reasonable notice when a material change
          affects an active paid plan.
        </p>
        <p>
          ResuMate is a career-writing tool, not an employer, recruiter, legal adviser, or guarantee
          of interviews, employment, salary, or applicant-tracking-system results.
        </p>
      </LegalSection>

      <LegalSection title="3. Accounts and security">
        <p>
          When you create an account, provide accurate information, protect your login credentials, and
          promptly notify us of unauthorized access. You are responsible for activity under your
          account unless caused by our failure to use reasonable security. You may not transfer or
          sell an account.
        </p>
      </LegalSection>

      <LegalSection title="4. Your content">
        <p>
          You retain ownership of resumes, job descriptions, and other content you provide. You give
          us a limited, non-exclusive license to host, copy, transmit, format, and process that
          content only as needed to provide, secure, and improve the Service or comply with law. This
          license ends when the content is deleted, subject to limited backups and legal retention.
        </p>
        <p>
          You confirm that you have the rights needed to submit your content and that it does not
          violate law or another person's rights. You are responsible for reviewing exports and AI
          suggestions before using or submitting them.
        </p>
      </LegalSection>

      <LegalSection title="5. Acceptable use">
        <p>You may not:</p>
        <ul className="bullet-list">
          <li>Use the Service unlawfully, deceptively, or to infringe privacy, intellectual-property, or other rights.</li>
          <li>Upload malware, probe for vulnerabilities, bypass access controls, or disrupt the Service.</li>
          <li>Use automated means to scrape, overload, or access the Service contrary to published limits.</li>
          <li>Resell or misrepresent the Service, remove notices, or reverse engineer it except where law expressly permits.</li>
          <li>Use AI features to generate fraudulent credentials, impersonate another person, or fabricate material qualifications.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. AI and third-party services">
        <p>
          AI output can be incomplete, incorrect, or similar to content generated for others. It is
          provided as a drafting aid, and you must independently review it. Third-party services,
          including AI and payment providers, may have their own terms. We are not responsible for a
          third-party service outside our control.
        </p>
      </LegalSection>

      <LegalSection title="7. Paid plans, trials, and renewal">
        <p>
          For a paid plan, the checkout page will show the price, currency, billing
          period, included features, taxes, trial terms, and whether the plan renews automatically
          before you authorize payment. Subscriptions renew for the displayed period until canceled.
        </p>
        <p>
          You can cancel through the account billing controls or the method identified on your
          receipt. Cancellation stops future renewals; access normally continues through the paid
          period. Price changes apply no earlier than the next renewal after reasonable notice. Our
          Refund Policy and any mandatory consumer rights govern refunds.
        </p>
      </LegalSection>

      <LegalSection title="8. Intellectual property">
        <p>
          The Service, software, visual design, templates, branding, and documentation are owned by
          Built WAI or its licensors and protected by law. Subject to these Terms, we grant you a
          limited, revocable, non-transferable right to use the Service for personal or internal
          business purposes. Your exported resume remains yours.
        </p>
      </LegalSection>

      <LegalSection title="9. Suspension and termination">
        <p>
          You may stop using the Service at any time and may delete an account when that feature is
          available. We may restrict or terminate access for material or repeated violations, fraud,
          security risk, nonpayment, or legal requirements. Where practical, we will provide notice
          and an opportunity to export your content before termination.
        </p>
      </LegalSection>

      <LegalSection title="10. Disclaimers and liability">
        <p>
          To the extent permitted by law, the Service is provided "as is" and "as available." We do
          not promise uninterrupted operation or that output will be error-free or accepted by an
          employer. Nothing in these Terms excludes warranties or rights that cannot lawfully be
          excluded.
        </p>
        <p>
          To the extent permitted by law, Built WAI will not be liable for indirect, incidental,
          special, consequential, or punitive damages, or lost profits, opportunities, or data. Our
          total liability arising from the Service will not exceed the greater of US $100 or the
          amount you paid for the Service during the 12 months before the event giving rise to the
          claim. These limits do not apply where prohibited by law or to liability that cannot be
          limited.
        </p>
      </LegalSection>

      <LegalSection title="11. Governing rules and disputes">
        <p>
          Applicable law and courts depend on where Built WAI is legally established and on any
          mandatory protections in your place of residence. Before filing a formal claim, contact us
          so we can try to resolve the issue informally. These Terms do not limit any non-waivable
          consumer right or your ability to contact a regulator.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes and contact">
        <p>
          We may update these Terms. We will post the revised date and give additional notice of
          material changes where required. Continued use after the effective date means you accept
          the updated Terms, unless law requires another form of consent.
        </p>
        <p>
          Questions can be sent to <a href="mailto:support@builtwai.com">support@builtwai.com</a>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
