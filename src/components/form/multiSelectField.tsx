import { ComponentPropsWithRef } from "react";
import { useFieldContext } from ".";
import { Label } from "../ui/label";
import { cn } from "~/lib/utils";
import { MultiSelect, MultiSelectContent, MultiSelectTrigger, MultiSelectValue } from "../ui/multi-select";

export function MultiSelectField({
	children,
	className,
	label,
	placeholder = "Select",
	multiSelectProps,
	onValuesChange,
	...divProps
}: {
	label?: string,
	placeholder?: string,
	onValuesChange?: (value: string[]) => void
	multiSelectProps?: Omit<ComponentPropsWithRef<"select">, "value" | "name" | "dir" | "defaultValue">
} & ComponentPropsWithRef<"div">) {
	const field = useFieldContext<string[]>()
	return (
		<div {...divProps}>
			<Label className={cn(className, !label && "hidden")} htmlFor={field.name}>{label}</Label>
			<MultiSelect
				id={field.name}
				values={field.state.value}
				onValuesChange={(value) => {
					field.handleChange(value)
					if (onValuesChange) {
						onValuesChange(value)
					}
				}}
				{...multiSelectProps}
			>
				<MultiSelectTrigger>
					<MultiSelectValue placeholder={placeholder} />
				</MultiSelectTrigger>
				<MultiSelectContent>
					{children}
				</MultiSelectContent>
			</MultiSelect>
		</div>
	)
}
