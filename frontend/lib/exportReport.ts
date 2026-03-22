"use client";

import type { jsPDF } from "jspdf";

export async function exportAsImage(elementId: string, filename = "startup-arena-report") {
  const element = document.getElementById(elementId);
  if (!element) return;

  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--bg-0").trim() || "#FAFAFA",
    logging: false,
  });

  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

export async function exportAsPDF(elementId: string, filename = "startup-arena-report") {
  const element = document.getElementById(elementId);
  if (!element) return;

  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--bg-0").trim() || "#FAFAFA",
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  // A4: 210 x 297 mm
  const pdfWidth = 210;
  const pdfHeight = (imgHeight * pdfWidth) / imgWidth;

  const pdf = new jsPDF({
    orientation: pdfHeight > 297 ? "portrait" : "portrait",
    unit: "mm",
    format: [pdfWidth, Math.max(pdfHeight, 297)],
  });

  pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
  pdf.save(`${filename}.pdf`);
}
