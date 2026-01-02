import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
import { TextField } from "./textField";
import { CheckboxField } from "./checkboxField";
import { TextareaField } from "./textareaField";
import { SelectField } from "./selectField";
import { MultiSelectField } from "./multiSelectField";
import { FolderPathField } from "./folderPathField";

export const { fieldContext, formContext, useFieldContext } = createFormHookContexts()

export const { useAppForm, withForm } = createFormHook({
	fieldContext,
	formContext,
	fieldComponents: {
		TextField,
		TextareaField,
		SelectField,
		MultiSelectField,
		CheckboxField,
		FolderPathField
	},
	formComponents: {}
})
