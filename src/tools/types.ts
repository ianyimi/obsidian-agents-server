import { z, ZodNull } from "zod"

export const TFolderSchema = z.object({
	name: z.string(),
	parent: z.union(TFolderSchema, ZodNull)
})

export const FileStatsSchema = z.object({
})

export const TFileSchema = z.object({
	basename: z.string(),
	extension: z.string(),
	name: z.string(),
	parent: TFolderSchema,
	path: z.string(),
	stat: FileStatsSchema,
})

// export const TAbstractFileSchema = z.union(TFileSchema, TFolderSchema)
