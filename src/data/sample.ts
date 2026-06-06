import { Resume } from "../types/resume"
import { uid } from "../lib/id"

export function createEmptyResume(name = "My Resume"): Resume {
  return {
    id: uid("resume"),
    name,
    updatedAt: Date.now(),
    contact: {
      fullName: "",
      headline: "",
      email: "",
      phone: "",
      location: "",
      website: "",
      linkedin: "",
      github: "",
    },
    summary: "",
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    customSections: [],
    settings: {
      template: "modern",
      accent: "#2563eb",
      fontScale: 1,
      sectionOrder: [
        "summary",
        "experience",
        "education",
        "skills",
        "projects",
        "certifications",
      ],
      hidden: [],
    },
  }
}

export function createSampleResume(): Resume {
  const base = createEmptyResume("Sample Resume")
  return {
    ...base,
    contact: {
      fullName: "Jordan Avery",
      headline: "Senior Product Designer",
      email: "jordan.avery@email.com",
      phone: "(415) 555-0192",
      location: "San Francisco, CA",
      website: "jordanavery.design",
      linkedin: "linkedin.com/in/jordanavery",
      github: "",
    },
    summary:
      "Senior product designer with 7+ years crafting intuitive, accessible digital products. Led design for a SaaS platform that grew from 10k to 500k users, increasing activation by 38% through data-informed redesigns. Skilled at bridging research, design systems, and cross-functional delivery.",
    experience: [
      {
        id: uid("exp"),
        company: "Brightwave",
        role: "Senior Product Designer",
        location: "San Francisco, CA",
        startDate: "2021",
        endDate: "",
        current: true,
        bullets: [
          "Led end-to-end redesign of the onboarding flow, increasing activation rate by 38% and reducing time-to-value by 2.4 days.",
          "Built and maintained a 120-component design system adopted by 4 product teams, cutting design-to-dev handoff time by 45%.",
          "Mentored 3 junior designers and established weekly critique rituals that improved design quality scores by 22%.",
        ],
      },
      {
        id: uid("exp"),
        company: "Northstar Labs",
        role: "Product Designer",
        location: "Remote",
        startDate: "2018",
        endDate: "2021",
        current: false,
        bullets: [
          "Shipped 15+ features across web and mobile, collaborating with PMs and engineers in 2-week sprints.",
          "Ran 40+ usability sessions and synthesized findings into a research repository used company-wide.",
        ],
      },
    ],
    education: [
      {
        id: uid("edu"),
        school: "University of California, Berkeley",
        degree: "B.A.",
        field: "Cognitive Science",
        location: "Berkeley, CA",
        startDate: "2014",
        endDate: "2018",
        details: "",
      },
    ],
    skills: [
      {
        id: uid("sk"),
        category: "Design",
        items: ["Figma", "Prototyping", "Design Systems", "Accessibility (WCAG)"],
      },
      {
        id: uid("sk"),
        category: "Research",
        items: ["Usability Testing", "A/B Testing", "Journey Mapping"],
      },
    ],
    projects: [
      {
        id: uid("prj"),
        name: "OpenA11y Toolkit",
        link: "github.com/jordanavery/opena11y",
        description: "Open-source accessibility audit toolkit (1.2k stars).",
        bullets: [],
      },
    ],
    certifications: [
      {
        id: uid("cert"),
        name: "Nielsen Norman UX Certification",
        issuer: "NN/g",
        date: "2022",
      },
    ],
    customSections: [
      {
        id: uid("cs"),
        title: "Awards & Recognition",
        items: [
          {
            id: uid("ci"),
            title: "Designer of the Year",
            subtitle: "Brightwave",
            date: "2023",
            description: "",
            bullets: [],
          },
        ],
      },
    ],
  }
}
