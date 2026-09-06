import { Fragment, type ReactNode } from "react";

/**
 * Small, dependency-free Markdown renderer for assistant messages. Supports
 * headings, bold/italic/`code`/links, ordered + unordered lists, blockquotes,
 * fenced code blocks, GFM pipe tables, and `---` rules. Not a full CommonMark
 * implementation — just what the finance assistant actually emits.
 */

export function Markdown({ text }: { text: string }) {
	return <div className="space-y-2 text-[13px] leading-relaxed text-ink">{parseBlocks(text)}</div>;
}

/* ── inline ── */

function inline(src: string, keyBase = ""): ReactNode[] {
	const nodes: ReactNode[] = [];
	// order matters: code first (so ** inside code is literal), then links, bold, italic
	const re =
		/(`[^`]+`)|(\[([^\]]+)\]\(([^)\s]+)[^)]*\))|(\*\*([^*]+)\*\*)|(__([^_]+)__)|(\*([^*]+)\*)|(_([^_]+)_)/g;
	let last = 0;
	let m: RegExpExecArray | null;
	let i = 0;
	while ((m = re.exec(src))) {
		if (m.index > last) nodes.push(src.slice(last, m.index));
		const k = `${keyBase}i${i++}`;
		if (m[1]) {
			nodes.push(
				<code key={k} className="rounded bg-black/5 px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/10">
					{m[1].slice(1, -1)}
				</code>,
			);
		} else if (m[2]) {
			nodes.push(
				<a key={k} href={m[4]} target="_blank" rel="noreferrer" className="text-brand underline underline-offset-2">
					{m[3]}
				</a>,
			);
		} else if (m[5] || m[7]) {
			nodes.push(<strong key={k} className="font-semibold text-foreground">{inline(m[6] ?? m[8]!, k)}</strong>);
		} else if (m[9] || m[11]) {
			nodes.push(<em key={k}>{inline(m[10] ?? m[12]!, k)}</em>);
		}
		last = m.index + m[0].length;
	}
	if (last < src.length) nodes.push(src.slice(last));
	return nodes;
}

/* ── blocks ── */

const isTableSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(l);
const splitRow = (l: string) =>
	l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());

function parseBlocks(text: string): ReactNode[] {
	const lines = text.replace(/\r\n/g, "\n").split("\n");
	const out: ReactNode[] = [];
	let i = 0;
	let key = 0;
	const push = (n: ReactNode) => out.push(<Fragment key={key++}>{n}</Fragment>);

	while (i < lines.length) {
		let line = lines[i];

		// blank
		if (!line.trim()) { i++; continue; }

		// fenced code
		if (/^\s*```/.test(line)) {
			const lang = line.trim().slice(3).trim();
			const buf: string[] = [];
			i++;
			while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
			i++; // closing fence
			push(
				<pre className="overflow-x-auto rounded-lg bg-black/5 p-3 text-[12px] dark:bg-white/10">
					<code data-lang={lang}>{buf.join("\n")}</code>
				</pre>,
			);
			continue;
		}

		// table: header row + separator
		if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
			const header = splitRow(line);
			i += 2;
			const rows: string[][] = [];
			while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
				rows.push(splitRow(lines[i]));
				i++;
			}
			push(
				<div className="overflow-x-auto">
					<table className="w-full border-separate border-spacing-0 text-[12px]">
						<thead>
							<tr>
								{header.map((h, j) => (
									<th key={j} className="border-b border-border bg-muted/40 px-2.5 py-1.5 text-left font-medium text-muted-foreground">
										{inline(h, `th${j}`)}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rows.map((r, ri) => (
								<tr key={ri}>
									{header.map((_, ci) => (
										<td key={ci} className="border-b border-border/60 px-2.5 py-1.5 align-top">
											{inline(r[ci] ?? "", `td${ri}-${ci}`)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>,
			);
			continue;
		}

		// heading
		const h = line.match(/^(#{1,4})\s+(.*)$/);
		if (h) {
			const lvl = h[1].length;
			const cls =
				lvl === 1 ? "text-base font-semibold" : lvl === 2 ? "text-sm font-semibold" : "text-[13px] font-semibold";
			push(<div className={`${cls} text-foreground`}>{inline(h[2], `h${key}`)}</div>);
			i++;
			continue;
		}

		// horizontal rule
		if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
			push(<hr className="border-border/60" />);
			i++;
			continue;
		}

		// blockquote
		if (/^\s*>\s?/.test(line)) {
			const buf: string[] = [];
			while (i < lines.length && /^\s*>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ""));
			push(
				<blockquote className="border-l-2 border-border pl-3 text-muted-foreground">
					{parseBlocks(buf.join("\n"))}
				</blockquote>,
			);
			continue;
		}

		// lists
		const ul = line.match(/^(\s*)[-*+]\s+(.*)$/);
		const ol = line.match(/^(\s*)\d+[.)]\s+(.*)$/);
		if (ul || ol) {
			const ordered = !!ol;
			const items: string[] = [];
			const rowRe = ordered ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
			while (i < lines.length && rowRe.test(lines[i])) {
				items.push(lines[i].match(rowRe)![1]);
				i++;
			}
			const Tag = ordered ? "ol" : "ul";
			push(
				<Tag className={`${ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5`}>
					{items.map((it, j) => (
						<li key={j}>{inline(it, `li${j}`)}</li>
					))}
				</Tag>,
			);
			continue;
		}

		// paragraph (consume consecutive non-blank, non-special lines)
		const buf: string[] = [line];
		i++;
		while (
			i < lines.length &&
			lines[i].trim() &&
			!/^\s*(```|#{1,4}\s|>\s?|[-*+]\s|\d+[.)]\s|([-*_])\2{2,}\s*$)/.test(lines[i]) &&
			!(lines[i].includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1]))
		) {
			buf.push(lines[i++]);
		}
		push(<p className="whitespace-pre-wrap">{inline(buf.join("\n"), `p${key}`)}</p>);
	}

	return out;
}
