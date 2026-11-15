import { diallingRegions } from "@/lib/resume";
import type { Education, Experience, ResumeData } from "@/lib/resume";

export type ImportedResume = Pick<ResumeData,
  "fullName" | "role" | "email" | "phone" | "location" | "website" | "summary" |
  "experience" | "education" | "skills" | "projects" | "certifications" | "languages"
> & { phoneCountryCode?: string };

type ResumeSection = "summary" | "experience" | "education" | "skills" | "projects" | "certifications" | "languages";

const sectionHeadings: Array<[ResumeSection, RegExp]> = [
  ["summary", /^(?:professional\s+)?summary|^(?:career\s+)?profile|^about(?:\s+me)?|^objective$/i],
  ["experience", /^(?:(?:work|professional|employment|career)\s+)?experience(?:\s+history)?$|^employment\s+history$|^work\s+history$/i],
  ["education", /^(?:academic\s+)?education(?:\s+&\s+training)?$|^qualifications$/i],
  ["skills", /^(?:core\s+)?skills(?:\s+&\s+competencies)?$|^technical\s+skills$|^areas\s+of\s+expertise$/i],
  ["projects", /^(?:selected\s+)?projects$|^portfolio$/i],
  ["certifications", /^(?:licenses\s+&\s+)?certifications?$|^licenses$/i],
  ["languages", /^languages?$/i],
];

const bulletPattern = /^\s*(?:[•●▪◦‣*-]|\d+[.)])\s*/;
const dateRangePattern = /\b((?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+)?(?:19|20)\d{2})\s*(?:–|—|-|\bto\b)\s*((?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+)?(?:19|20)\d{2}|present|current|now)\b/i;

function cleanLine(line: string) {
  return line.replace(/\u00a0/g, " ").replace(/[\t ]+/g, " ").trim();
}

function isDateLine(line: string) {
  return dateRangePattern.test(line) || /^(?:19|20)\d{2}\s*(?:–|—|-|to)\s*(?:present|current|now|(?:19|20)\d{2})$/i.test(line.trim());
}

function isBullet(line: string) {
  return bulletPattern.test(line);
}

function splitIntoBlocks(lines: string[]) {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (!line) {
      if (current.length) blocks.push(current);
      current = [];
      continue;
    }
    // Many PDF extractors omit blank lines between jobs. A new non-bullet
    // heading after dated bullet content is a useful, reviewable boundary.
    const hasDate = current.some(isDateLine);
    const hasBullets = current.some(isBullet);
    if (hasDate && hasBullets && !isBullet(line) && !isDateLine(line)) {
      blocks.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length) blocks.push(current);
  return blocks;
}

function parseExperience(lines: string[]): Experience[] {
  return splitIntoBlocks(lines).map((block) => {
    const content = block.map((line) => line.replace(bulletPattern, "").trim()).filter(Boolean);
    const joined = content.join(" ");
    const range = joined.match(dateRangePattern);
    const dateLineIndex = block.findIndex(isDateLine);
    const header = content.map((line) => line.replace(dateRangePattern, "").trim()).filter((line) => line && !/^\d{4}\s*(?:–|—|-|to)\s*(?:present|current|now|\d{4})$/i.test(line));
    const combinedHeader = header[0] ?? "";
    const parts = combinedHeader.split(/\s+(?:\||·|—|–)\s+|\s+ at \s+/i).map((part) => part.trim()).filter(Boolean);
    const role = parts[0] ?? "";
    const company = parts[1] ?? header[1] ?? "";
    const location = parts[2] ?? "";
    const bullets = content.filter((line, index) => {
      if (dateRangePattern.test(line) || /^\d{4}\s*(?:–|—|-|to)\s*(?:present|current|now|\d{4})$/i.test(line)) return false;
      if (line === role || line === company || line === combinedHeader) return false;
      if (index < (dateLineIndex >= 0 ? Math.max(2, dateLineIndex) : 2) && !isBullet(block[index] ?? "")) return false;
      return true;
    });
    return { role, company, location, start: range?.[1] ?? "", end: range?.[2] ?? "", bullets: bullets.length ? bullets : [""] };
  }).filter((item) => item.role || item.company || item.bullets.some(Boolean));
}

function parseEducation(lines: string[]): Education[] {
  return splitIntoBlocks(lines).map((block) => {
    const content = block.map((line) => line.replace(bulletPattern, "").trim()).filter(Boolean);
    const joined = content.join(" ");
    const range = joined.match(dateRangePattern);
    const degreeIndex = content.findIndex((line) => /\b(?:B\.?A\.?|B\.?S\.?|BSc|M\.?A\.?|M\.?S\.?|MSc|MBA|Ph\.?D\.?|Bachelor|Master|Doctorate|Diploma|Associate|Certificate)\b/i.test(line));
    const degree = degreeIndex >= 0 ? content[degreeIndex].replace(dateRangePattern, "").trim() : (content[1] ?? "");
    const school = content.find((line, index) => index !== degreeIndex && !dateRangePattern.test(line)) ?? (content[0] ?? "");
    const location = content.find((line, index) => index > Math.max(0, degreeIndex) && line !== school && line !== degree && !dateRangePattern.test(line)) ?? "";
    return { school, degree, location, start: range?.[1] ?? "", end: range?.[2] ?? "" };
  }).filter((item) => item.school || item.degree);
}

function splitList(lines: string[]) {
  return lines.flatMap((line) => line.replace(bulletPattern, "").split(/\s*(?:\||•|●|▪|◦|;|,)\s*/)).map((item) => item.trim()).filter(Boolean);
}

export function parseResumeText(input: string): ImportedResume {
  const text = input.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").replace(/[\t ]+/g, " ");
  const lines = text.split("\n").map(cleanLine);
  const sections: Record<ResumeSection, string[]> = {
    summary: [], experience: [], education: [], skills: [], projects: [], certifications: [], languages: [],
  };
  const header: string[] = [];
  let active: ResumeSection | null = null;
  let foundSection = false;

  for (const line of lines) {
    if (!line) {
      if (active) sections[active].push("");
      continue;
    }
    const candidate = line.replace(/[:\s]+$/, "").trim();
    const heading = sectionHeadings.find(([, pattern]) => pattern.test(candidate));
    if (heading) {
      active = heading[0];
      foundSection = true;
      continue;
    }
    if (active) sections[active].push(line);
    else header.push(line);
  }

  // Some PDFs flatten all words into one line. Insert likely section breaks
  // before parsing, while still leaving the extracted text available to review.
  if (!foundSection && text.length > 0) {
    const flattened = text.replace(/\s+/g, " ");
    for (const [name, pattern] of sectionHeadings) {
      const alias = name === "summary" ? "(?:professional )?summary|profile|objective" : name === "experience" ? "(?:work |professional |employment )?experience|employment history|work history" : name === "certifications" ? "certifications?|licenses" : name;
      const matcher = new RegExp(`\\b(${alias})\\s*:?\\s*`, "ig");
      if (matcher.test(flattened)) {
        const normalized = flattened.replace(matcher, "\n$1\n");
        if (normalized !== flattened) return parseResumeText(normalized);
      }
    }
  }

  const fullText = text;
  const email = fullText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone = fullText.match(/(?:\+\d[\d ().-]{7,}\d)/)?.[0] ?? "";
  const phoneCountryCode = diallingRegions.find(({ code }) => code !== "+" && phone.replace(/[\s().-]/g, "").startsWith(code))?.code ?? (phone.startsWith("+") ? "+" : undefined);
  const website = fullText.match(/(?:https?:\/\/|www\.)[^\s|,]+/i)?.[0]?.replace(/[),.;]+$/, "") ?? "";
  const locationLabel = header.find((line) => /^(?:location|address)\s*:/i.test(line));
  const location = locationLabel?.replace(/^(?:location|address)\s*:\s*/i, "") ?? "";
  const contactLines = new Set([email, phone, website].filter(Boolean));
  const nameCandidates = header.filter((line) => !contactLines.has(line) && !/@|https?:\/\/|www\.|\d/.test(line) && !/^(?:email|phone|mobile|tel|address|location)\s*:/i.test(line));
  const fullName = nameCandidates.find((line) => line.split(/\s+/).length >= 2 && line.split(/\s+/).length <= 5) ?? "";
  const role = nameCandidates.find((line) => line !== fullName) ?? "";
  const summaryLines = sections.summary.filter(Boolean);
  // Keep unclassified text in the review panel rather than stuffing an entire
  // document into the summary field when its headings are unfamiliar.
  const summary = summaryLines.join(" ").trim();
  const skills = splitList(sections.skills);
  const projects = splitList(sections.projects);
  const certifications = splitList(sections.certifications);
  const languages = splitList(sections.languages);

  return {
    fullName,
    role,
    email,
    phone: phoneCountryCode && phoneCountryCode !== "+" ? phone.replace(/[\s().-]/g, "").slice(phoneCountryCode.length) : phone,
    phoneCountryCode,
    location,
    website,
    summary,
    experience: parseExperience(sections.experience),
    education: parseEducation(sections.education),
    skills,
    projects,
    certifications,
    languages,
  };
}
