/**
 * Rich block dispatcher. Agent tools may attach a `_display` payload to their
 * output; AgentChat renders it as one of the ported chat-states components.
 */
import { ContextCards, type ContextChunk } from "./context-cards";
import { DataTable, type DataColumn, type DataRow } from "./data-table";
import { FilterTable, type TableRow } from "./filter-table";
import { Flowchart, type StepNode } from "./flowchart";
import { InsightCards } from "./insight-cards";
import { RecommendationCard, type RecommendationOption } from "./recommendation-card";
import { TaskRows, type TaskRowData } from "./task-rows";

export type DisplayBlock =
	| { kind: "context"; chunks: ContextChunk[]; count?: string }
	| { kind: "table"; columns: DataColumn[]; rows: DataRow[]; caption?: string }
	| { kind: "filterTable"; rows: TableRow[] }
	| { kind: "flowchart"; steps: StepNode[] }
	| { kind: "insights" }
	| { kind: "recommendation"; options: RecommendationOption[]; title?: string }
	| { kind: "tasks"; rows: TaskRowData[] };

export function RichBlock({ block }: { block: DisplayBlock }) {
	switch (block.kind) {
		case "context":
			return <ContextCards chunks={block.chunks} labels={block.count ? { count: block.count } : undefined} />;
		case "table":
			return <DataTable columns={block.columns} rows={block.rows} caption={block.caption} />;
		case "filterTable":
			return <FilterTable rows={block.rows} />;
		case "flowchart":
			return <Flowchart steps={block.steps} />;
		case "insights":
			return <InsightCards />;
		case "recommendation":
			return <RecommendationCard options={block.options} labels={block.title ? { title: block.title } : undefined} />;
		case "tasks":
			return <TaskRows rows={block.rows} />;
		default:
			return null;
	}
}

/** Pull a `_display` block out of an arbitrary tool output value. */
export function displayBlockOf(output: unknown): DisplayBlock | null {
	if (output && typeof output === "object" && "_display" in output) {
		const b = (output as { _display: unknown })._display;
		if (b && typeof b === "object" && "kind" in b) return b as DisplayBlock;
	}
	return null;
}
