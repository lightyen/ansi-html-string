import { createToDemo, createToHtml } from "../src"

const options = {
	minimumContrastRatio: 1,
	theme: {
		black: "#000000",
		red: "#D34F56",
		green: "#B9C954",
		yellow: "#E6C452",
		blue: "#7CA7D8",
		magenta: "#C299D6",
		cyan: "#73BFB1",
		white: "#FFFFFF",
	},
}

it("simple", () => {
	const toHtml = createToHtml(options)
	expect(toHtml(`\x1b[9;31mhelloworld\x1b[0m`)).toEqual(
		'<span style="color:#D34F56;text-decoration:line-through">helloworld</span>',
	)
})

it("start with ESC", () => {
	const toHtml = createToHtml(options)
	expect(toHtml(`\x1b[30mhello\x9bmworld`)).toEqual('<span style="color:#000000">hello</span>world')
})

it("start with CSI", () => {
	const toHtml = createToHtml(options)
	expect(toHtml(`\x9b30mhello\x1b[0mworld`)).toEqual('<span style="color:#000000">hello</span>world')
})

it("endurance failure", () => {
	const toHtml = createToHtml(options)
	expect(toHtml(`\x1b[31m\x1b[0;;31;mhelloworld\x1b[m`)).toEqual("helloworld")
	expect(toHtml(`\x1b[31m\x1b[0;;;31mhelloworld\x1b[m`)).toEqual('<span style="color:#D34F56">helloworld</span>')
})

it("hyperlink", () => {
	const toHtml = createToHtml(options)
	const rawText = `he\x1b[31mllo\x1b]8;id=app;http://example.com\x1b\\This is \x1b]8;id=app:rel=noopener noreferrer;http://example.com\x1b\\a \x1b[34mli\x1b[34mnk\x1b]8;;\x1b\\world\x1b[m`
	expect(toHtml(rawText)).toEqual(
		'he<span style="color:#D34F56">llo</span><a href="http://example.com" class="ansi-link" id="app"><span style="color:#D34F56">This is </span></a><a href="http://example.com" class="ansi-link" id="app" rel="noopener noreferrer"><span style="color:#D34F56">a </span><span style="color:#7CA7D8">link</span></a><span style="color:#7CA7D8">world</span>',
	)
})

it("clear", () => {
	const toHtml = createToHtml(options)
	expect(
		toHtml(
			`he\x1b[31mllo\x1b]8;id=app;http://example.com\x1b\\This is \x1b]8;id=app:rel=noopener noreferrer;http://example.com\x1b\\a \x1b[34mli\x1b[34mnk\x1b]8;;\x1b\\world\x1b[0m\x1b[?2Jhelloworld`,
		),
	).toEqual("helloworld")
	expect(toHtml(`sdfsdsdf\x1b[0;1J`)).toEqual("sdfsdsdf")
	expect(toHtml(`sdfsdsdf\x1b[1;2J`)).toEqual("sdfsdsdf")
	expect(toHtml(`sdfsdsdf\x1b[1J`)).toEqual("")
	expect(toHtml(`sdfsdsdf\x1b[2J`)).toEqual("")
	expect(toHtml(`sdfsdsdf\x9b?0;1J`)).toEqual("sdfsdsdf")
	expect(toHtml(`sdfsdsdf\x9b?1;2J`)).toEqual("sdfsdsdf")
	expect(toHtml(`sdfsdsdf\x9b?1J`)).toEqual("")
	expect(toHtml(`sdfsdsdf\x1b[?2J`)).toEqual("")
})

const demoText = `MacroError:
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

it("render", () => {
	const toDemo = createToDemo(options)
	const output = toDemo(demoText)
	expect(output).toMatchSnapshot()
})

it("render with classes", () => {
	const toDemo = createToDemo({ ...options, mode: "class" })
	const output = toDemo(demoText)
	expect(output).toMatchSnapshot()
})
