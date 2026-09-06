import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/dashboard.banking";
import { Button } from "~/components/ui/button";
import { getUser, requireUserId } from "~/lib/auth.server";
import { requireOrg } from "~/lib/org.server";
import {
	bankAction,
	connectBank,
	disconnectBank,
	getBankSummary,
	getOrgBank,
	listBranches,
	type BankIntent,
} from "~/lib/bank.server";

export function meta() {
	return [{ title: "Banking | Gray Office" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env;
	const { orgId } = await requireOrg(request, env);
	const row = await getOrgBank(env.DB, orgId);

	if (!row) {
		let branches: Awaited<ReturnType<typeof listBranches>> = [];
		let bankError: string | null = null;
		try {
			branches = await listBranches(env);
		} catch (err) {
			bankError = err instanceof Error ? err.message : String(err);
		}
		return { connected: false as const, branches, bankError };
	}

	let summary = null;
	let bankError: string | null = null;
	try {
		summary = await getBankSummary(row);
	} catch (err) {
		bankError = err instanceof Error ? err.message : String(err);
	}
	return { connected: true as const, branchCode: row.branch_code, summary, bankError };
}

export async function action({ request, context }: Route.ActionArgs) {
	const env = context.cloudflare.env;
	const { orgId, org } = await requireOrg(request, env);
	const userId = await requireUserId(request, env.SESSION_SECRET);
	const form = await request.formData();
	const intent = String(form.get("intent") ?? "");
	const num = (k: string) => Number(form.get(k) ?? 0);
	const str = (k: string) => {
		const v = String(form.get(k) ?? "").trim();
		return v || undefined;
	};

	try {
		if (intent === "connect") {
			const me = await getUser(env.DB, userId);
			await connectBank(
				env,
				orgId,
				me?.email ?? `org-${orgId}@grayoffice.app`,
				org.name,
				String(form.get("branch_code") ?? ""),
				Math.max(0, num("opening_balance")),
			);
			return { ok: "connected" as const };
		}

		const row = await getOrgBank(env.DB, orgId);
		if (!row) return { error: "Connect a bank account first." };

		if (intent === "disconnect") {
			await disconnectBank(env.DB, orgId);
			return { ok: "disconnected" as const };
		}

		if (["credit", "debit", "tick"].includes(intent)) {
			await bankAction(row, intent as BankIntent, {
				amount: num("amount"),
				description: str("description") ?? "",
			});
			return { ok: intent as "credit" | "debit" | "tick" };
		}

		if (intent === "subscribe") {
			await bankAction(row, "subscribe", {
				company_name: str("company_name"),
				charge_amount: num("charge_amount"),
			});
			return { ok: "subscribe" as const };
		}

		if (intent === "transfer") {
			await bankAction(row, "transfer", {
				method: str("method"),
				amount: num("amount"),
				description: str("description") ?? "",
				to_account: str("to_account"),
				beneficiary_name: str("beneficiary_name"),
				beneficiary_ifsc: str("beneficiary_ifsc"),
				upi_id: str("upi_id"),
				swift: str("swift"),
			});
			return { ok: "transfer" as const };
		}

		return { error: "Unknown action." };
	} catch (err) {
		return { error: err instanceof Error ? err.message : String(err) };
	}
}

const card = "rounded-xl border border-border bg-card p-4";
const field =
	"h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring";
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

export default function Banking({ loaderData, actionData }: Route.ComponentProps) {
	const nav = useNavigation();
	const busy = nav.formData != null; // a form submit is in flight (not a plain link nav)
	const err = actionData && "error" in actionData ? actionData.error : null;

	return (
		<div className="mx-auto max-w-4xl p-4 md:p-6">
			<div className="mb-6">
				<h1 className="text-2xl font-normal text-foreground">Banking</h1>
				<p className="text-sm text-muted-foreground">
					A live account on bank.grayoffice.app. Trigger real credits, debits,
					transfers and subscriptions against it.
				</p>
			</div>

			{err && (
				<p className="mb-4 rounded-lg border border-destructive/30 bg-[color-mix(in_oklch,var(--destructive)_10%,transparent)] px-3 py-2 text-sm text-destructive">{err}</p>
			)}
			{"bankError" in loaderData && loaderData.bankError && (
				<p className="mb-4 rounded-lg border border-[var(--dashboard-no-show)]/30 bg-[color-mix(in_oklch,var(--dashboard-no-show)_10%,transparent)] px-3 py-2 text-sm text-[var(--dashboard-no-show)]">
					Bank unreachable: {loaderData.bankError}
				</p>
			)}

			{!loaderData.connected && (
				<section className={card}>
					<h2 className="text-sm font-medium text-foreground">Connect a bank account</h2>
					<Form method="post" className="mt-3 grid gap-2 sm:max-w-sm">
						<input type="hidden" name="intent" value="connect" />
						<label className="text-sm text-muted-foreground">
							Branch
							<select name="branch_code" required className={field}>
								<option value="">Select a branch…</option>
								{loaderData.branches.map((b) => (
									<option key={b.code} value={b.code}>
										{b.name} ({b.ifsc})
									</option>
								))}
							</select>
						</label>
						<label className="text-sm text-muted-foreground">
							Opening balance (₹)
							<input name="opening_balance" type="number" min={0} defaultValue={100000} className={field} />
						</label>
						<Button type="submit" size="sm" disabled={busy}>
							{busy ? "Connecting…" : "Open account"}
						</Button>
					</Form>
				</section>
			)}

			{loaderData.connected && loaderData.summary && (
				<div className="grid gap-4">
					<section className={card}>
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<div className="text-xs uppercase tracking-wide text-muted-foreground">Balance</div>
								<div className="mt-1 text-2xl font-semibold text-foreground">
									{inr(loaderData.summary.account.balance)}
								</div>
								<div className="mt-1 text-sm text-muted-foreground">
									{loaderData.summary.account.holder_name} ·{" "}
									{loaderData.summary.account.account_id} ·{" "}
									{loaderData.summary.account.branch?.name ?? loaderData.branchCode}
								</div>
							</div>
							<Form method="post">
								<input type="hidden" name="intent" value="disconnect" />
								<Button type="submit" size="sm" variant="outline" className="text-destructive" disabled={busy}>
									Disconnect
								</Button>
							</Form>
						</div>
					</section>

					<div className="grid gap-4 md:grid-cols-2">
						<ActionCard title="Credit" intent="credit" busy={busy}>
							<input name="amount" type="number" step="0.01" min="0.01" placeholder="Amount ₹" required className={field} />
							<input name="description" placeholder="Description" className={field} />
						</ActionCard>
						<ActionCard title="Debit" intent="debit" busy={busy}>
							<input name="amount" type="number" step="0.01" min="0.01" placeholder="Amount ₹" required className={field} />
							<input name="description" placeholder="Description" className={field} />
						</ActionCard>
						<ActionCard title="Transfer" intent="transfer" busy={busy}>
							<select name="method" className={field} defaultValue="neft">
								<option value="neft">NEFT</option>
								<option value="imps">IMPS</option>
								<option value="upi">UPI</option>
								<option value="wire">Wire</option>
							</select>
							<input name="amount" type="number" step="0.01" min="0.01" placeholder="Amount ₹" required className={field} />
							<input name="to_account" placeholder="To account (APNA… or IBAN)" className={field} />
							<input name="upi_id" placeholder="UPI id (for UPI)" className={field} />
							<input name="beneficiary_name" placeholder="Beneficiary name (external)" className={field} />
							<input name="beneficiary_ifsc" placeholder="Beneficiary IFSC (external)" className={field} />
							<input name="swift" placeholder="SWIFT/BIC (wire)" className={field} />
							<input name="description" placeholder="Description" className={field} />
						</ActionCard>
						<ActionCard title="Subscribe (recurring charge)" intent="subscribe" busy={busy}>
							<input name="company_name" placeholder="Company" required className={field} />
							<input name="charge_amount" type="number" step="0.01" min="0.01" placeholder="Charge ₹ / hour" required className={field} />
						</ActionCard>
					</div>

					<Form method="post">
						<input type="hidden" name="intent" value="tick" />
						<Button type="submit" size="sm" variant="outline" disabled={busy}>
							Add a random live transaction
						</Button>
					</Form>

					<section className={card}>
						<h2 className="mb-3 text-sm font-medium text-foreground">Recent transactions</h2>
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<tbody className="divide-y divide-border/60">
									{loaderData.summary.transactions.map((t) => (
										<tr key={t.id}>
											<td className="py-2 pr-3 text-muted-foreground">
												{new Date(t.created_at).toLocaleString()}
											</td>
											<td className="py-2 pr-3">{t.description}</td>
											<td className={`py-2 pr-3 text-right ${t.type === "credit" ? "text-[var(--dashboard-completed)]" : "text-destructive"}`}>
												{t.type === "credit" ? "+" : "−"}{inr(t.amount)}
											</td>
											<td className="py-2 text-right text-muted-foreground">{inr(t.balance_after)}</td>
										</tr>
									))}
									{loaderData.summary.transactions.length === 0 && (
										<tr><td className="py-3 text-muted-foreground">No transactions yet.</td></tr>
									)}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			)}
		</div>
	);
}

function ActionCard({
	title,
	intent,
	busy,
	children,
}: {
	title: string;
	intent: string;
	busy: boolean;
	children: React.ReactNode;
}) {
	return (
		<section className={card}>
			<h3 className="text-sm font-medium text-foreground">{title}</h3>
			<Form method="post" className="mt-2 grid gap-2">
				<input type="hidden" name="intent" value={intent} />
				{children}
				<Button type="submit" size="sm" disabled={busy}>Run</Button>
			</Form>
		</section>
	);
}
