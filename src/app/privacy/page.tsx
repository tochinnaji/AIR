import Link from "next/link";
import { DataExportButton } from "@/components/data-export-button";

export const metadata = {
  title: "Privacy notice | Forme",
  description: "How Forme handles account, resume, and service data.",
};

export default function PrivacyPage() {
  const privacyEmail = process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "privacy@example.com";
  const privacyEmailIsPlaceholder = !process.env.NEXT_PUBLIC_PRIVACY_EMAIL;
  return <main className="dashboard" style={{ maxWidth: 900, margin: "0 auto", lineHeight: 1.7 }}>
    <Link href="/" className="signin-back">← Back to Forme</Link>
    <div className="eyebrow" style={{ marginTop: 24 }}>Privacy</div>
    <h1>Privacy notice</h1>
    <p className="subhead">This notice explains the data Forme handles while you use the resume builder. Last updated November 13, 2026.</p>
    <h2>Information Forme handles</h2>
    <p>When you create an account, Forme receives your name and email address and stores a password hash for email-and-password accounts. Google sign-in also returns account identifiers and profile information needed to sign you in. Resume content can include contact details, employment history, education, skills, and any other information you choose to enter.</p>
    <p>Forme saves a local draft in this browser and, when you are signed in, saves resumes and versions to the application database. Signing out does not remove the local browser draft. You can delete that browser data by clearing site data in your browser.</p>

    <h2>Cookies and browser storage</h2>
    <p>Forme uses the browser storage needed to keep your local resume draft and the authentication cookie needed to keep you signed in. The current project does not add advertising or analytics trackers. Clearing browser site data removes the local draft and may sign you out.</p>

    <h2>Files and AI assistance</h2>
    <p>When you import a PDF or DOCX, the server extracts readable text in memory to prepare a draft. The uploaded file is not stored by the import endpoint. Imported fields are approximate, so review them before using the resume.</p>
    <p>If AI assistance is enabled, the text selected for a request is sent to Google Gemini only after you give consent in the app. The Gemini API free tier may use prompts and responses to improve Google products. Do not send information you are not comfortable sharing with Google. Google may process requests outside your country; the applicable terms, data region, retention settings, and suitability for public launch must be confirmed before launch.</p>

    <h2>Sharing and payments</h2>
    <p>A public resume link can be viewed by anyone who has the link until you turn it off or delete the resume. Avoid including private information you do not intend to share.</p>
    <p>Paystack processes payments for Forme's one-time ₦1,500 export unlock and ₦3,000 monthly AI plan. Each account receives one free AI rewrite and one free PDF or DOCX export trial. Forme stores transaction references, status, amount, and product entitlements; it does not store full card details. Monthly AI subscribers can cancel in the app. Paystack handles payment credentials.</p>

    <h2>Why data is used</h2>
    <p>Forme uses account and resume data to provide sign-in, save and restore drafts, import documents, create exports, and operate sharing features you request. It uses service and security information to protect and maintain the app. AI processing is optional and requires your choice to send text.</p>
    <p>The expected legal bases are providing the service you request for account and resume processing, your consent for optional AI requests, and legitimate interests in keeping the service secure. Payment and recordkeeping duties may add legal-obligation processing once paid plans are active. The final bases and any cross-border safeguards need review against the live setup.</p>

    <h2>Service providers and storage</h2>
    <p>Forme relies on Google for Google sign-in and Gemini AI requests, Hostless for the managed database, Backblaze B2 for encrypted off-site database backups once activated, and Paystack for payments. These providers may process data in countries other than yours; the production regions and transfer safeguards must be confirmed before launch.</p>

    <h2>Retention and security</h2>
    <p>Your server-side account and resumes remain until you delete your account or request deletion. Account deletion removes the account and linked resume, payment, and entitlement records from the live database. Local drafts are held separately in your browser. Once activated, encrypted off-site backups are planned to be hidden after 30 days and permanently deleted one day later; Backblaze processes lifecycle rules daily, so actual deletion may take longer. Deletion from a backup may therefore be delayed until that backup expires. No online service can promise absolute security, so use a unique password and avoid adding sensitive information that a resume does not need.</p>

    <h2>Your choices and requests</h2>
    <p>You can correct resume fields in the editor, download account and resume data while signed in, turn off a public link, or delete your account from the account menu. You may also ask to access, correct, export, object to, or delete personal data, subject to applicable legal requirements. You may contact the Nigeria Data Protection Commission or your local data protection authority if you believe your rights have not been respected.</p>
    <p>Privacy requests: <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a>{privacyEmailIsPlaceholder && <small> (temporary placeholder; replace with a monitored address before launch)</small>}</p>

    <h2>Changes to this notice</h2>
    <p>Forme will update this notice when its data practices or providers change and show the new effective date.</p>
    <div className="modal-actions" style={{ justifyContent: "flex-start" }}><DataExportButton/><Link className="button" href="/">Return to Forme</Link></div>
  </main>;
}
