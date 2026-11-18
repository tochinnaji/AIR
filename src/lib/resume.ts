export type Experience = { role: string; company: string; location: string; start: string; end: string; bullets: string[] };
export type Education = { school: string; degree: string; location: string; start: string; end: string };
export type ResumeSection = "summary" | "experience" | "education" | "skills" | "projects" | "extras";
export type ResumeData = {
  id: string; title: string; fullName: string; role: string; email: string; phone: string; phoneCountryCode?: string; location: string; locationRegion?: string; website: string; isExample?: boolean; paperSize?: "a4" | "letter";
  summary: string; experience: Experience[]; education: Education[]; skills: string[]; projects: string[]; certifications: string[]; languages: string[];
  sectionOrder: ResumeSection[];
  template: "classic" | "modern" | "compact"; accent: string; font: string; spacing: "comfortable" | "compact";
};

export const initialResume: ResumeData = {
  id: "resume-1", title: "Product designer · 2026", fullName: "Jordan Lee", role: "Senior Product Designer", email: "jordan.lee@email.com", phone: "+1 (415) 555-0138", phoneCountryCode: "+1", location: "San Francisco, CA", locationRegion: "United States", website: "jordanlee.design", isExample: true,
  summary: "Product designer with 7 years of experience shaping clear, accessible digital products. I connect user research with thoughtful interaction design to help teams turn complex problems into simple experiences.",
  experience: [
    { role: "Senior Product Designer", company: "Northstar Labs", location: "San Francisco, CA", start: "2022", end: "Present", bullets: ["Led redesign of the onboarding experience across web and mobile, reducing time to first value by 32%.", "Partnered with 8 engineers and 2 product managers to launch a new design system used across 4 product teams.", "Built and tested prototypes with 24 customers, increasing activation by 18%."] },
    { role: "Product Designer", company: "Fieldwork", location: "Remote", start: "2019", end: "2022", bullets: ["Designed end-to-end workflows for a B2B platform serving 12,000 monthly users.", "Introduced a research repository that helped product teams reuse customer insights across 6 launches."] }
  ],
  education: [{ school: "California College of the Arts", degree: "BFA, Interaction Design", location: "San Francisco, CA", start: "2015", end: "2019" }],
  skills: ["Product strategy", "Interaction design", "Prototyping", "Figma", "User research", "Design systems"], projects: [], certifications: [], languages: ["English (Native)"], sectionOrder: ["summary", "experience", "education", "skills", "projects", "extras"], template: "classic", accent: "#1F2937", font: "source-serif", spacing: "comfortable", paperSize: "a4"
};

export const emptyExperience = (): Experience => ({ role: "", company: "", location: "", start: "", end: "", bullets: [""] });
export const emptyEducation = (): Education => ({ school: "", degree: "", location: "", start: "", end: "" });

export const diallingRegions = [
  { region: "Nigeria", code: "+234" }, { region: "United States / Canada", code: "+1" },
  { region: "United Kingdom", code: "+44" }, { region: "Ghana", code: "+233" },
  { region: "South Africa", code: "+27" }, { region: "Kenya", code: "+254" },
  { region: "India", code: "+91" }, { region: "Australia", code: "+61" },
  { region: "United Arab Emirates", code: "+971" }, { region: "Germany", code: "+49" },
  { region: "France", code: "+33" }, { region: "Ireland", code: "+353" },
  { region: "Other international", code: "+" },
] as const;

export const locationRegions = ["Nigeria", "United States", "Canada", "United Kingdom", "Ghana", "South Africa", "Kenya", "India", "Australia", "United Arab Emirates", "Germany", "France", "Ireland", "Other"] as const;

export function getPhoneCountryCode(resume: ResumeData) {
  return resume.phoneCountryCode ?? diallingRegions.find(({ code }) => code !== "+" && resume.phone.startsWith(code))?.code ?? "+234";
}

export function getNationalPhoneNumber(resume: ResumeData) {
  const code = getPhoneCountryCode(resume);
  return resume.phone.startsWith(code) ? resume.phone.slice(code.length).trim() : resume.phone;
}

export function getResumePhone(resume: ResumeData) {
  const number = getNationalPhoneNumber(resume).trim();
  return number ? `${getPhoneCountryCode(resume)} ${number}` : "";
}

export function getResumeLocation(resume: ResumeData) {
  return [resume.location, resume.locationRegion].filter(Boolean).join(", ");
}
