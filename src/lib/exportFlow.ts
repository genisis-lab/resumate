import { toast } from "sonner"
import type { Resume } from "../types/resume"
import type { PlanId } from "./billing"
import { canUseTemplate, consumeFreeAction, FREE_PLAN_LIMITS } from "./usage"
import { templateMeta } from "../templates/registry"
import { confirmDialog } from "../components/ui/dialogs"
import { exportPdf } from "./exportPdf"
import { exportDocx } from "./exportDocx"
import { paperSizeOf } from "./fitPage"
import { openUpgrade, trackEvent, upgradePromptViewed } from "./analytics"
import { navigate } from "../router"

// Shared export rules for the toolbar, mobile sheet, and keyboard shortcuts.
// Premium templates can be previewed on Free; downloading one needs a paid plan.

async function premiumTemplateBlocked(resume: Resume, plan: PlanId): Promise<boolean> {
  if (canUseTemplate(plan, resume.settings.template)) return false
  const meta = templateMeta(resume.settings.template)
  upgradePromptViewed("export_premium_template", { template: meta.id, plan })
  const upgrade = await confirmDialog({
    title: `${meta.label} is a Premium template`,
    description: "You can keep previewing it on your resume. Career Sprint and Pro unlock PDF downloads for every template, or switch to Modern, Classic, or ATS-Safe from the Template menu to export free.",
    confirmLabel: "See plans",
    cancelLabel: "Not now",
  })
  if (upgrade) openUpgrade("export_premium_template", { template: meta.id, plan })
  else trackEvent("export_blocked", { source: "export_premium_template", template: meta.id, plan })
  return true
}

async function exportAllowed(plan: PlanId): Promise<boolean> {
  const quota = await consumeFreeAction(plan, "documentExports")
  if (!quota.allowed) {
    upgradePromptViewed("export_limit", { plan })
    trackEvent("export_blocked", { source: "export_limit", plan })
    if (quota.blockedBy === "network") {
      toast.error("Free exports from this network are used up for the month.", {
        description: "Sign in to a free account to use your own 3 exports, or upgrade for unlimited exports.",
        action: { label: "Sign in", onClick: () => navigate("/login") },
      })
      return false
    }
    toast.error(`The Free plan includes ${FREE_PLAN_LIMITS.documentExports} PDF or Word exports each month.`, {
      description: "Upgrade for unlimited exports and every template.",
      action: { label: "See plans", onClick: () => openUpgrade("export_limit", { plan }) },
    })
    return false
  }
  if (plan === "free" && quota.remaining !== null) {
    toast.message(`${quota.remaining} of ${FREE_PLAN_LIMITS.documentExports} free exports left this month`)
  }
  return true
}

export async function exportResumePdf(resume: Resume, plan: PlanId): Promise<void> {
  if (await premiumTemplateBlocked(resume, plan)) return
  if (!(await exportAllowed(plan))) return
  exportPdf(resume.contact.fullName || resume.name, paperSizeOf(resume))
  trackEvent("export_completed", { format: "pdf", template: resume.settings.template, plan })
}

export async function exportResumeWord(resume: Resume, plan: PlanId): Promise<void> {
  if (!(await exportAllowed(plan))) return
  // Word files reuse the template's fonts only when the template is unlocked.
  exportDocx(resume, { templateStyles: canUseTemplate(plan, resume.settings.template) })
  toast.success("Word document downloaded")
  trackEvent("export_completed", { format: "docx", template: resume.settings.template, plan })
}
