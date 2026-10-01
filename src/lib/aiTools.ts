import { FileSignature, MessagesSquare, Sparkles, type LucideIcon } from "lucide-react"

// Paid, hosted-AI destinations shown together in navigation menus.
export const AI_TOOLS: { path: string; label: string; description: string; icon: LucideIcon }[] = [
  { path: "/coach", label: "AI coach", description: "Full resume review, role builder, grammar, and consistency checks", icon: Sparkles },
  { path: "/cover", label: "Cover letter", description: "A grounded letter for one job, in your chosen tone", icon: FileSignature },
  { path: "/interview", label: "Interview prep", description: "Likely questions, answer directions, and follow-up emails", icon: MessagesSquare },
]
