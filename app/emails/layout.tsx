import type { ReactNode } from "react";

/**
 * Shared shell for transactional emails. Inline styles only — email clients
 * ignore <style> and external CSS.
 */
export function EmailLayout({
	preview,
	children,
}: {
	preview: string;
	children: ReactNode;
}) {
	return (
		<html lang="en">
			<body
				style={{
					margin: 0,
					backgroundColor: "#f5f5f4",
					fontFamily:
						"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
					color: "#1c1917",
				}}
			>
				<span style={{ display: "none", opacity: 0, color: "transparent" }}>
					{preview}
				</span>
				<table
					role="presentation"
					width="100%"
					cellPadding={0}
					cellSpacing={0}
					style={{ backgroundColor: "#f5f5f4", padding: "32px 0" }}
				>
					<tbody>
						<tr>
							<td align="center">
								<table
									role="presentation"
									width={440}
									cellPadding={0}
									cellSpacing={0}
									style={{
										width: "440px",
										maxWidth: "100%",
										backgroundColor: "#ffffff",
										borderRadius: "14px",
										border: "1px solid #e7e5e4",
										overflow: "hidden",
									}}
								>
									<tbody>
										<tr>
											<td style={{ padding: "28px 32px 0" }}>
												<div
													style={{
														fontSize: "17px",
														fontWeight: 600,
														letterSpacing: "-0.01em",
													}}
												>
													Gray<span style={{ color: "#a8a29e", fontWeight: 400 }}>Office</span>
												</div>
											</td>
										</tr>
										<tr>
											<td style={{ padding: "20px 32px 32px" }}>{children}</td>
										</tr>
									</tbody>
								</table>
								<div
									style={{
										marginTop: "20px",
										fontSize: "12px",
										color: "#a8a29e",
									}}
								>
									© {new Date().getFullYear()} Gray Office, Inc.
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</body>
		</html>
	);
}

export function CodeBlock({ code }: { code: string }) {
	return (
		<div
			style={{
				margin: "20px 0",
				padding: "16px",
				textAlign: "center",
				backgroundColor: "#f5f5f4",
				borderRadius: "10px",
				fontSize: "28px",
				fontWeight: 700,
				letterSpacing: "0.35em",
				fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
			}}
		>
			{code}
		</div>
	);
}

export function Paragraph({ children }: { children: ReactNode }) {
	return (
		<p style={{ margin: "0 0 14px", fontSize: "14px", lineHeight: 1.6 }}>
			{children}
		</p>
	);
}
