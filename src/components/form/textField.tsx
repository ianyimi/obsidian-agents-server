import { ComponentPropsWithRef } from "react";
import { useFieldContext } from ".";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export function TextField({ label, inputProps, ...divProps }: { label: string, inputProps?: Omit<ComponentPropsWithRef<"input">, "id" | "name" | "onBlur" | "value"> } & ComponentPropsWithRef<"div">) {
	const field = useFieldContext<string>()
	return (
		<div {...divProps}>
			<Label htmlFor={field.name}>{label}</Label>
			<Input
				id={field.name}
				name={field.name}
				onBlur={field.handleBlur}
				value={field.state.value}
				onChange={(e) => field.handleChange(e.target.value)}
				{...inputProps}
			/>
		</div>
	)
}
