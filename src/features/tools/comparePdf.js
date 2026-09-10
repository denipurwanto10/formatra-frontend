import { loadPdfDocument } from "../../lib/pdfjs";

const MAX_WORDS_FOR_DETAILED_DIFF = 1500;

async function extractPageTexts(file) {
  const doc = await loadPdfDocument(file);
  const texts = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const page = await doc.getPage(i);
    // eslint-disable-next-line no-await-in-loop
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => it.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    texts.push(text);
  }
  return texts;
}

/** Word-level LCS diff. Returns a list of {type: "equal"|"add"|"remove", value}. */
function diffWords(a, b) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: "equal", value: a[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "remove", value: a[i] });
      i += 1;
    } else {
      ops.push({ type: "add", value: b[j] });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ type: "remove", value: a[i] });
    i += 1;
  }
  while (j < m) {
    ops.push({ type: "add", value: b[j] });
    j += 1;
  }
  return ops;
}

/**
 * Compares the text of two PDFs page by page.
 * @param {File} fileA
 * @param {File} fileB
 * @returns {Promise<{pageCountA:number, pageCountB:number, diffPageCount:number, pages: Array}>}
 */
export async function comparePdfs(fileA, fileB, onProgress) {
  const [textsA, textsB] = await Promise.all([extractPageTexts(fileA), extractPageTexts(fileB)]);
  onProgress?.(40);

  const pageCount = Math.max(textsA.length, textsB.length);
  const pages = [];
  let diffPageCount = 0;

  for (let i = 0; i < pageCount; i += 1) {
    const textA = textsA[i] ?? null;
    const textB = textsB[i] ?? null;
    const same = textA !== null && textB !== null && textA === textB;

    let ops = null;
    let tooLarge = false;
    if (!same) {
      diffPageCount += 1;
      const wordsA = textA ? textA.split(" ") : [];
      const wordsB = textB ? textB.split(" ") : [];
      if (wordsA.length + wordsB.length <= MAX_WORDS_FOR_DETAILED_DIFF) {
        ops = diffWords(wordsA, wordsB);
      } else {
        tooLarge = true;
      }
    }

    pages.push({
      pageNumber: i + 1,
      existsInA: textA !== null,
      existsInB: textB !== null,
      same,
      tooLarge,
      ops,
    });

    onProgress?.(40 + Math.round(((i + 1) / pageCount) * 60));
  }

  return {
    pageCountA: textsA.length,
    pageCountB: textsB.length,
    diffPageCount,
    pages,
  };
}
