import { ComponentPropsWithRef, useEffect, useRef, useState } from "react";
import { useFieldContext } from ".";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { cn } from "~/lib/utils";
import { App } from "obsidian";

interface FolderPathFieldProps extends ComponentPropsWithRef<"div"> {
	label: string;
	app: App;
	inputProps?: Omit<ComponentPropsWithRef<"input">, "id" | "name" | "onBlur" | "value">;
	placeholder?: string;
}

export function FolderPathField({
	label,
	app,
	inputProps,
	placeholder = "Start typing a folder path...",
	...divProps
}: FolderPathFieldProps) {
	const field = useFieldContext<string>();
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [filteredPaths, setFilteredPaths] = useState<string[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [allPaths, setAllPaths] = useState<string[]>([]);

	const inputRef = useRef<HTMLInputElement>(null);
	const suggestionsRef = useRef<HTMLDivElement>(null);
	const suggestionItemsRef = useRef<(HTMLDivElement | null)[]>([]);

	// Get all folder paths from vault on mount
	useEffect(() => {
		const folders = app.vault.getAllFolders();
		const paths = folders
			.map(folder => folder.path)
			.filter(path => path !== "")
			.sort();
		setAllPaths(["", ...paths]); // Include empty path for vault root
	}, [app]);

	// Fuzzy match function - matches if all search terms appear in order in the path
	const fuzzyMatch = (path: string, search: string): boolean => {
		const searchLower = search.toLowerCase().trim();
		const pathLower = path.toLowerCase();

		// If empty search, match all
		if (searchLower === "") return true;

		// Split search by spaces to get individual terms
		const searchTerms = searchLower.split(/\s+/).filter(term => term.length > 0);

		// Check if all search terms appear in the path in order
		let lastIndex = -1;
		for (const term of searchTerms) {
			const index = pathLower.indexOf(term, lastIndex + 1);
			if (index === -1) return false;
			lastIndex = index;
		}

		return true;
	};

	// Calculate match score for sorting (lower is better)
	const getMatchScore = (path: string, search: string): number => {
		if (search === "") return 0;

		const searchLower = search.toLowerCase().trim();
		const pathLower = path.toLowerCase();

		// Exact match gets best score
		if (pathLower === searchLower) return -1000;

		// Starts with search gets very good score
		if (pathLower.startsWith(searchLower)) return -100;

		// Calculate score based on how early and close together matches are
		const searchTerms = searchLower.split(/\s+/).filter(term => term.length > 0);
		let totalDistance = 0;
		let lastIndex = -1;

		for (const term of searchTerms) {
			const index = pathLower.indexOf(term, lastIndex + 1);
			if (index === -1) return 10000; // No match

			// Add distance from start and gap from previous match
			totalDistance += index;
			if (lastIndex >= 0) {
				totalDistance += (index - lastIndex - 1);
			}
			lastIndex = index + term.length - 1;
		}

		return totalDistance;
	};

	// Filter paths based on input
	useEffect(() => {
		const inputValue = field.state.value || "";

		if (inputValue === "") {
			setFilteredPaths(allPaths.slice(0, 10));
		} else {
			// Filter and sort by match quality
			const matches = allPaths
				.filter(path => fuzzyMatch(path, inputValue))
				.sort((a, b) => getMatchScore(a, inputValue) - getMatchScore(b, inputValue))
				.slice(0, 10);
			setFilteredPaths(matches);
		}
		setSelectedIndex(0);
	}, [field.state.value, allPaths]);

	// Handle keyboard navigation
	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (!showSuggestions || filteredPaths.length === 0) {
			if (e.key === "ArrowDown" && !showSuggestions) {
				setShowSuggestions(true);
				e.preventDefault();
			}
			return;
		}

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setSelectedIndex(prev =>
					prev < filteredPaths.length - 1 ? prev + 1 : prev
				);
				break;
			case "ArrowUp":
				e.preventDefault();
				setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
				break;
			case "Enter":
			case "Tab":
				e.preventDefault();
				selectPath(filteredPaths[selectedIndex]);
				break;
			case "Escape":
				e.preventDefault();
				setShowSuggestions(false);
				break;
		}
	};

	// Scroll selected item into view
	useEffect(() => {
		if (showSuggestions && suggestionItemsRef.current[selectedIndex]) {
			suggestionItemsRef.current[selectedIndex]?.scrollIntoView({
				block: "nearest",
				behavior: "smooth"
			});
		}
	}, [selectedIndex, showSuggestions]);

	const selectPath = (path: string) => {
		field.handleChange(path);
		setShowSuggestions(false);
		inputRef.current?.blur();
	};

	const handleFocus = () => {
		setShowSuggestions(true);
	};

	const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		// Delay blur to allow click on suggestion
		setTimeout(() => {
			setShowSuggestions(false);
			field.handleBlur(e);
		}, 200);
	};

	return (
		<div {...divProps} className={cn("relative", divProps.className)}>
			<Label htmlFor={field.name}>{label}</Label>
			<Input
				ref={inputRef}
				id={field.name}
				name={field.name}
				onBlur={handleBlur}
				onFocus={handleFocus}
				value={field.state.value || ""}
				onChange={(e) => field.handleChange(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				autoComplete="off"
				{...inputProps}
			/>

			{showSuggestions && filteredPaths.length > 0 && (
				<div
					ref={suggestionsRef}
					className={cn(
						"absolute z-50 w-full mt-1 bg-background border border-input rounded shadow-lg",
						"max-h-60 overflow-y-auto"
					)}
				>
					{filteredPaths.map((path, index) => (
						<div
							key={path}
							ref={el => suggestionItemsRef.current[index] = el}
							className={cn(
								"px-3 py-2 cursor-pointer transition-colors",
								"hover:bg-accent hover:text-accent-foreground",
								index === selectedIndex && "bg-accent text-accent-foreground"
							)}
							onClick={() => selectPath(path)}
							onMouseEnter={() => setSelectedIndex(index)}
						>
							<div className="text-sm">
								{path === "" ? (
									<span className="text-muted-foreground italic">Vault Root</span>
								) : (
									path
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
