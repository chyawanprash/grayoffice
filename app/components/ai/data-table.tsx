/**
 * Compact records table for agent tool output. The chat-states RecordsTable is
 * a full interactive spreadsheet (~1000 lines) that ships its own `.records-*`
 * stylesheet not included in the reference file, so this is the lean
 * equivalent: sortable-free, read-only, themed to match.
 */
export type DataColumn = { key: string; label: string; align?: "left" | "right" };
export type DataRow = Record<string, string | number | null | undefined>;

export function DataTable({
	columns,
	rows,
	caption,
}: {
	columns: DataColumn[];
	rows: DataRow[];
	caption?: string;
}) {
	return (
		<div className="w-full max-w-110 overflow-hidden rounded-card bg-surface shadow-card">
			{caption && (
				<div className="border-b border-line px-3 py-2 text-[12.5px] font-medium text-ink-2">{caption}</div>
			)}
			<div className="overflow-x-auto">
				<table className="w-full text-[13px]">
					<thead>
						<tr className="border-b border-line text-[12px] font-medium text-ink-2">
							{columns.map((c) => (
								<th key={c.key} className={`px-3 py-2 ${c.align === "right" ? "text-right" : "text-left"}`}>
									{c.label}
								</th>
							))}
						</tr>
					</thead>
					<tbody className="divide-y divide-line/60">
						{rows.map((r, i) => (
							<tr key={i} className="transition-colors hover:bg-hover">
								{columns.map((c) => (
									<td
										key={c.key}
										className={`px-3 py-1.5 text-ink ${c.align === "right" ? "text-right tabular-nums" : ""}`}
									>
										{r[c.key] ?? "—"}
									</td>
								))}
							</tr>
						))}
						{rows.length === 0 && (
							<tr>
								<td colSpan={columns.length} className="px-3 py-3 text-ink-3">
									No rows.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
