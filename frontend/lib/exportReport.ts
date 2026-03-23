"use client";

const EXPORT_SCALE = 2;
const EXPORT_WINDOW_WIDTH = 1280;
const EXPORT_CONTENT_WIDTH = 1120;

interface RenderedExport {
  canvas: HTMLCanvasElement;
  breakpoints: number[];
}

function getExportBackgroundColor() {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--bg-0")
      .trim() || "#FAFAFA"
  );
}

function normalizeFilename(filename: string) {
  const normalized = filename
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .trim();
  return normalized || "startup-arena-report";
}

async function renderElementToCanvas(
  elementId: string
): Promise<RenderedExport> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Export target "${elementId}" not found`);
  }

  let breakpoints: number[] = [];

  if ("fonts" in document) {
    await document.fonts.ready;
  }

  await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));

  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(element, {
    scale: EXPORT_SCALE,
    useCORS: true,
    backgroundColor: getExportBackgroundColor(),
    logging: false,
    windowWidth: EXPORT_WINDOW_WIDTH,
    width: EXPORT_CONTENT_WIDTH,
    onclone: (clonedDocument) => {
      const style = clonedDocument.createElement("style");
      style.textContent = `
        *, *::before, *::after {
          animation: none !important;
          transition: none !important;
        }
      `;
      clonedDocument.head.appendChild(style);

      clonedDocument
        .querySelectorAll<HTMLElement>("[data-export-hidden='true']")
        .forEach((node) => {
          node.style.display = "none";
        });

      const clonedElement = clonedDocument.getElementById(elementId);
      if (clonedElement) {
        clonedElement.style.width = `${EXPORT_CONTENT_WIDTH}px`;
        clonedElement.style.maxWidth = `${EXPORT_CONTENT_WIDTH}px`;
        clonedElement.style.margin = "0 auto";
        clonedElement.style.boxSizing = "border-box";
        clonedElement.style.padding = "24px";

        const rootRect = clonedElement.getBoundingClientRect();
        const blockBreaks = new Set<number>();
        clonedElement
          .querySelectorAll<HTMLElement>("[data-export-block='true']")
          .forEach((block) => {
            const rect = block.getBoundingClientRect();
            const top = Math.round((rect.top - rootRect.top) * EXPORT_SCALE);
            const bottom = Math.round((rect.bottom - rootRect.top) * EXPORT_SCALE);
            if (top > 0) blockBreaks.add(top);
            if (bottom > 0) blockBreaks.add(bottom);
          });
        breakpoints = Array.from(blockBreaks).sort((a, b) => a - b);
      }
    },
  });

  return {
    canvas,
    breakpoints: breakpoints.filter((point) => point > 0 && point < canvas.height),
  };
}

export async function exportAsImage(
  elementId: string,
  filename = "startup-arena-report"
) {
  const { canvas } = await renderElementToCanvas(elementId);
  const link = document.createElement("a");
  link.download = `${normalizeFilename(filename)}.png`;
  link.href = canvas.toDataURL("image/png");
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function exportAsPDF(
  elementId: string,
  filename = "startup-arena-report"
) {
  const { canvas, breakpoints } = await renderElementToCanvas(elementId);
  const { jsPDF } = await import("jspdf");

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageHeightPx = Math.floor((canvas.width * pageHeight) / pageWidth);
  const minSliceHeight = Math.floor(pageHeightPx * 0.6);

  let offsetY = 0;
  let pageIndex = 0;

  while (offsetY < canvas.height) {
    let targetEnd = Math.min(offsetY + pageHeightPx, canvas.height);
    if (targetEnd < canvas.height) {
      const candidateBreaks = breakpoints.filter(
        (point) => point > offsetY + minSliceHeight && point <= targetEnd
      );
      if (candidateBreaks.length > 0) {
        targetEnd = candidateBreaks[candidateBreaks.length - 1];
      }
    }

    let sliceHeight = targetEnd - offsetY;
    if (sliceHeight <= 0) {
      sliceHeight = Math.min(pageHeightPx, canvas.height - offsetY);
    }

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;

    const context = pageCanvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create PDF canvas context");
    }

    context.drawImage(
      canvas,
      0,
      offsetY,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight
    );

    if (pageIndex > 0) {
      pdf.addPage();
    }

    const imgData = pageCanvas.toDataURL("image/png");
    const renderedHeight = (sliceHeight * pageWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pageWidth, renderedHeight);

    offsetY += sliceHeight;
    pageIndex += 1;
  }

  pdf.save(`${normalizeFilename(filename)}.pdf`);
}
