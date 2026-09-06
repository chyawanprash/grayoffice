import { AgentChat } from "~/components/ai/agent-chat";

export function meta() {
	return [{ title: "Assistant | Gray Office" }];
}

export default function Assistant() {
	return (
		<div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col p-4 md:p-6">
			<div className="mb-4">
				<h1 className="text-xl font-semibold tracking-tight text-foreground">Finance assistant</h1>
				<p className="text-sm text-muted-foreground">
					Ask about your close, reconciliation, invoices, cash, banking, payments,
					or GST. It can read every entity in your organization and act on the
					bank account with your confirmation.
				</p>
			</div>
			<AgentChat />
		</div>
	);
}
