import { ComponentPropsWithRef } from "react";
import { useFieldContext } from ".";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { cn } from "~/lib/utils";

export function CheckboxField({ label, orientation = "vertical", checkboxProps, className, ...divProps }: { label: string, orientation?: "horizontal" | "vertical", checkboxProps?: ComponentPropsWithRef<"button"> } & ComponentPropsWithRef<"div">) {
	const field = useFieldContext<boolean>()
	return (
		<div className={cn(orientation === "horizontal" && "flex gap-4", className)} {...divProps}>
			<Label htmlFor={field.name}>{label}</Label>
			<Checkbox
				id={field.name}
				name={field.name}
				checked={field.state.value}
				onBlur={field.handleBlur}
				onCheckedChange={(checked) => field.handleChange(checked === true)}
				{...checkboxProps}
			/>
		</div>
	)
}
