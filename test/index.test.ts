import { toDemo } from "../src"

it("render", () => {
	const text = `MacroError:
src/AppMain.tsx

\x1b[38;2;255;131;131m&#10005; \x1b[38;2;255;211;211mbg-indigoa-400\x1b[39m\x1b[38;2;255;131;131m was not found\x1b[39m

Try one of these classes:

\x1b[38;2;153;153;153m-\x1b[39m \x1b[93mbg-indigo-400\x1b[39m \x1b[38;2;153;153;153m&gt;\x1b[39m \x1b[38;2;129;140;248m&#9635; \x1b[39m#818cf8
\x1b[38;2;153;153;153m-\x1b[39m \x1b[93mbg-indigo-100\x1b[39m \x1b[38;2;153;153;153m&gt;\x1b[39m \x1b[38;2;224;231;255m&#9635; \x1b[39m#e0e7ff
\x1b[38;2;153;153;153m-\x1b[39m \x1b[93mbg-indigo-200\x1b[39m \x1b[38;2;153;153;153m&gt;\x1b[39m \x1b[38;2;199;210;254m&#9635; \x1b[39m#c7d2fe
\x1b[38;2;153;153;153m-\x1b[39m \x1b[93mbg-indigo-300\x1b[39m \x1b[38;2;153;153;153m&gt;\x1b[39m \x1b[38;2;165;180;252m&#9635; \x1b[39m#a5b4fc
\x1b[38;2;153;153;153m-\x1b[39m \x1b[93mbg-indigo-500\x1b[39m \x1b[38;2;153;153;153m&gt;\x1b[39m \x1b[38;2;99;102;241m&#9635; \x1b[39m#6366f1

	Standard colors:
	\x1b[48;5;0m  \x1b[48;5;1m  \x1b[48;5;2m  \x1b[48;5;3m  \x1b[48;5;4m  \x1b[48;5;5m  \x1b[48;5;6m  \x1b[48;5;7m  \x1b[0m
	\x1b[48;5;8m  \x1b[48;5;9m  \x1b[48;5;10m  \x1b[48;5;11m  \x1b[48;5;12m  \x1b[48;5;13m  \x1b[48;5;14m  \x1b[48;5;15m  \x1b[0m

`

	const output = toDemo(text, {
		theme: {
			// background: "#23272e",
			// foreground: "#abb2bf",
			black: "#000000",
			red: "#D34F56",
			green: "#B9C954",
			yellow: "#E6C452",
			blue: "#7CA7D8",
			magenta: "#C299D6",
			cyan: "#73BFB1",
			white: "#FFFFFF",
		},
	})

	expect(output).toMatchSnapshot()
})
