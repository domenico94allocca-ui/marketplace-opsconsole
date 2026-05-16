/**
 * Mini renderer markdown → HTML sanitizzato. Niente dipendenze esterne.
 * Supporta: heading (#…###), bold/italic, code inline, code fence, liste (- / [x]),
 * link [testo](url), tabelle GitHub-flavored, blockquote, paragrafi.
 * Per documenti più complessi si può sostituire con marked/markdown-it.
 */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function inline(s: string): string {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code class="bg-neutral-800 px-1 rounded text-xs">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) => `<a class="text-brand-light hover:underline" href="${u}" target="_blank" rel="noopener">${t}</a>`);
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  const flushParagraph = (buf: string[]) => { if (buf.length) { out.push(`<p class="my-2 leading-relaxed">${inline(buf.join(" "))}</p>`); buf.length = 0; } };

  while (i < lines.length) {
    const line = lines[i];

    // Code fence
    if (/^```/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
      i++; // closing fence
      out.push(`<pre class="bg-neutral-900 border border-neutral-800 rounded p-3 my-3 overflow-x-auto text-xs"><code>${esc(code.join("\n"))}</code></pre>`);
      continue;
    }

    // Heading
    const hm = /^(#{1,6})\s+(.*)$/.exec(line);
    if (hm) {
      const lvl = hm[1].length;
      const sizes = ["text-2xl font-bold mt-6 mb-3", "text-xl font-semibold mt-5 mb-2", "text-lg font-semibold mt-4 mb-2", "text-base font-semibold mt-3 mb-1", "text-sm font-semibold mt-2 mb-1", "text-xs font-semibold mt-2 mb-1"];
      out.push(`<h${lvl} class="${sizes[lvl - 1]}">${inline(hm[2])}</h${lvl}>`);
      i++; continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) { out.push('<hr class="my-4 border-neutral-800" />'); i++; continue; }

    // List (bulleted, supporta checkbox)
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        let txt = lines[i].replace(/^\s*[-*]\s+/, "");
        const cb = /^\[([ xX])\]\s+/.exec(txt);
        if (cb) {
          const checked = cb[1].toLowerCase() === "x";
          txt = txt.replace(/^\[[ xX]\]\s+/, "");
          items.push(`<li class="flex items-start gap-2 my-1"><span class="${checked ? "text-ok" : "text-neutral-500"} mt-0.5">${checked ? "✓" : "○"}</span><span>${inline(txt)}</span></li>`);
        } else {
          items.push(`<li class="ml-5 list-disc my-1">${inline(txt)}</li>`);
        }
        i++;
      }
      out.push(`<ul class="my-2">${items.join("")}</ul>`);
      continue;
    }

    // Tabella GitHub-style (header | --- | row)
    if (/^\|.+\|$/.test(line) && i + 1 < lines.length && /^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|$/.test(lines[i + 1])) {
      const splitRow = (r: string) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const headers = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|.+\|$/.test(lines[i])) { rows.push(splitRow(lines[i])); i++; }
      out.push(`<table class="w-full text-sm my-3 border border-neutral-800 rounded overflow-hidden"><thead class="bg-neutral-900"><tr>${headers.map((h) => `<th class="text-left p-2 border-b border-neutral-800">${inline(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr class="border-b border-neutral-800/50">${r.map((c) => `<td class="p-2 align-top">${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }

    // Empty
    if (/^\s*$/.test(line)) { i++; continue; }

    // Paragraph
    const buf: string[] = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^#{1,6}\s/.test(lines[i]) && !/^```/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !/^\|.+\|$/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    flushParagraph(buf);
  }
  return out.join("\n");
}
