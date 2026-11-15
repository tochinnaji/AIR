import { NextResponse } from "next/server";
import mammoth from "mammoth";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { parseResumeText } from "@/lib/resume-import";

export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a PDF or DOCX file." }, { status: 400 });
  if (file.size === 0 || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Files must be smaller than 5 MB." }, { status: 413 });
  const ext = file.name.toLowerCase().split(".").pop();
  const bytes = Buffer.from(await file.arrayBuffer());
  let text: string;
  if (ext === "pdf" && bytes.subarray(0, 5).toString() === "%PDF-") {
    try {
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes), useWorkerFetch: false, useSystemFonts: true }).promise;
      const pages = await Promise.all(Array.from({ length: pdf.numPages }, async (_, i) => (await (await pdf.getPage(i + 1)).getTextContent()).items.map((item) => "str" in item ? `${item.str}${item.hasEOL ? "\n" : " "}` : "").join("")));
      text = pages.join("\n");
    } catch { return NextResponse.json({ error: "This PDF could not be read. Try a text based PDF or DOCX." }, { status: 422 }); }
  } else if (ext === "docx" && bytes.subarray(0, 2).toString("hex") === "504b") {
    try { text = (await mammoth.extractRawText({ buffer: bytes })).value; }
    catch { return NextResponse.json({ error: "This DOCX could not be read. Check the file and try again." }, { status: 422 }); }
  } else return NextResponse.json({ error: "Only valid PDF and DOCX files are supported." }, { status: 415 });
  const extractedText = text.replace(/\n[ \t]+/g, "\n").trim().slice(0, 30000);
  if (!extractedText) return NextResponse.json({ error: "No readable text was found. Try a text based PDF or DOCX." }, { status: 422 });
  return NextResponse.json({ text: extractedText, data: parseResumeText(extractedText), filename: file.name });
}
