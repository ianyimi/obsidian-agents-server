import { ComponentPropsWithRef } from "react";
import { useFieldContext } from ".";
import { Select, SelectContent, SelectGroup, SelectTrigger, SelectValue } from "../ui/select";
import { Label } from "../ui/label";
import { cn } from "~/lib/utils";

export function SelectField({
	children,
	className,
	label,
	placeholder = "Select",
	selectProps,
	onValueChange,
	...divProps
}: {
	label?: string,
	placeholder?: string,
	onValueChange?: (value: string) => void
	selectProps?: Omit<ComponentPropsWithRef<"select">, "value" | "name" | "dir" | "defaultValue">
} & ComponentPropsWithRef<"div">) {
	const field = useFieldContext<string>()
	return (
		<div {...divProps}>
			<Label className={cn(className, !label && "hidden")} htmlFor={field.name}>{label}</Label>
			<Select
				name={field.name}
				value={field.state.value}
				onValueChange={(value) => {
					field.handleChange(value)
					if (onValueChange) {
						onValueChange(value)
					}
				}}
				{...selectProps}
			>
				<SelectTrigger>
					<SelectValue placeholder={placeholder} />
				</SelectTrigger>
				<SelectContent>
					{children}
				</SelectContent>
			</Select>
		</div>
	)
}
