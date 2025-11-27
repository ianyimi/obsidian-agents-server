import { ComponentPropsWithRef } from "react";
import { useFieldContext } from ".";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

export function TextareaField({ label, ...divProps }: { label: string } & ComponentPropsWithRef<"div">) {
	const field = useFieldContext<string>()
	return (
		<div {...divProps}>
			<Label htmlFor={field.name}>{label}</Label>
			<Textarea
				id={field.name}
				name={field.name}
				onBlur={field.handleBlur}
				value={field.state.value}
				onChange={(e) => field.handleChange(e.target.value)}
			/>
		</div>
	)
}
