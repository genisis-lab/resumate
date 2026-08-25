import { LegalPage, LegalSection } from "../components/LegalPage"

export function Refund() {
  return (
    <LegalPage
      title="Refund Policy"
      description="How cancellations and refunds will work when ResuMate introduces paid plans."
      summary={
        <p>
          Cancel anytime to stop future renewals. Once paid plans launch, first purchases will have
          a 14-day refund window, and renewal charges will have a 7-day refund window. Mandatory
          local consumer rights always apply.
        </p>
      }
    >
      <LegalSection title="1. When this policy applies">
        <p>
          ResuMate is currently available without a paid subscription. This policy will apply when
          ResuMate begins offering paid plans or one-time digital purchases. The checkout page and
          receipt may include product-specific terms; if they are more favorable to you, those terms
          control.
        </p>
      </LegalSection>

      <LegalSection title="2. Subscription refunds">
        <ul className="bullet-list">
          <li><strong>First purchase:</strong> request a full refund within 14 calendar days after the initial charge.</li>
          <li><strong>Renewal:</strong> request a full refund within 7 calendar days after a monthly or annual renewal charge.</li>
          <li><strong>After these windows:</strong> charges are generally non-refundable, but we will correct duplicate, unauthorized, or incorrect charges and honor any refund right required by law.</li>
        </ul>
        <p>
          An approved refund ends paid access associated with that charge. If a refund covers only a
          mistaken duplicate charge, your valid subscription remains active.
        </p>
      </LegalSection>

      <LegalSection title="3. Cancellation">
        <p>
          You may cancel a subscription at any time through account billing controls or the method
          shown on your receipt. Cancellation prevents the next renewal and normally leaves paid
          features available until the end of the current billing period. Canceling does not
          automatically refund an earlier charge; submit a refund request within the applicable
          window above.
        </p>
      </LegalSection>

      <LegalSection title="4. Free trials and promotions">
        <p>
          Before a trial begins, checkout will state its length, the price after the trial, the
          renewal schedule, and how to cancel. Cancel before the displayed deadline to avoid a
          charge. Promotional credits and free access have no cash value and are not refundable.
        </p>
      </LegalSection>

      <LegalSection title="5. One-time purchases">
        <p>
          Unless checkout states otherwise, request a refund for a one-time digital purchase within
          14 calendar days. We may deny a request where the digital product has been fully delivered,
          downloaded, or substantially used and local law permits that limitation. Defective or
          misdescribed products remain covered by mandatory legal rights.
        </p>
      </LegalSection>

      <LegalSection title="6. How to request a refund">
        <p>
          Email <a href="mailto:support@builtwai.com">support@builtwai.com</a> from the address used
          for purchase. Include the account email, receipt or transaction number, charge date, and a
          short description of the issue. Do not email full card details.
        </p>
        <p>
          We aim to review requests within 5 business days. Approved refunds go to the original
          payment method. Banks and payment providers may take an additional 5–10 business days to
          post the credit. Currency conversion, bank, or foreign-transaction fees are controlled by
          your financial institution and may not be recoverable from us.
        </p>
      </LegalSection>

      <LegalSection title="7. Consumer rights">
        <p>
          This policy does not restrict rights that cannot be waived under applicable consumer law.
          If local law gives you a longer cooling-off period, a remedy for a faulty service, or
          another mandatory right, that law controls.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
