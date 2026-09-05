import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const buttonVariants = cva(
	"group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-brand/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				primary:
					"bg-brand text-white shadow-xs ring-1 ring-brand hover:bg-brand-hover",
				outline:
					"bg-surface text-neutral-700 ring-1 ring-neutral-950/10 hover:bg-tint",
				ghost: "text-neutral-600 hover:bg-tint hover:text-neutral-900",
				danger: "bg-danger text-white hover:bg-danger/90",
			},
			size: {
				sm: "px-4 py-2 text-sm",
				md: "px-5 py-2.5 text-[15px]",
				lg: "px-6 py-3 text-[15px]",
				block: "h-11 w-full text-[15px]",
			},
		},
		defaultVariants: { variant: "primary", size: "md" },
	},
);

function Button({
	className,
	variant,
	size,
	...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
	return (
		<ButtonPrimitive
			data-slot="button"
			className={cn(buttonVariants({ variant, size }), className)}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
