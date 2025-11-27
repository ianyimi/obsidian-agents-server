import { ComponentPropsWithRef } from "react";
import { useFieldContext } from ".";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";

export function CheckboxField({ label, ...divProps }: { label: string } & ComponentPropsWithRef<"div">) {
	const field = useFieldContext<boolean>()
	return (
		<div {...divProps}>
			<Label htmlFor={field.name}>{label}</Label>
			<Checkbox
				id={field.name}
				name={field.name}
				checked={field.state.value}
				onBlur={field.handleBlur}
				onCheckedChange={(checked) => field.handleChange(checked === true)}
			/>
		</div>
	)
}
