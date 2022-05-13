import { createToDemo, createToHtml } from "../src"
import { blend } from "../src/colors"

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
		'<span style="color:#d34f56;text-decoration:line-through">helloworld</span>',
	)
})

it("start with ESC", () => {
	const toHtml = createToHtml(options)
	expect(toHtml(`\x1b[30mhello\x1b[mworld`)).toEqual('<span style="color:#000000">hello</span>world')
})

it("hyperlink", () => {
	const toHtml = createToHtml(options)
	const rawText = `he\x1b[31mllo\x1b]8;id=app;http://example.com\x1b\\This is \x1b]8;id=app:rel=noopener noreferrer;http://example.com\x1b\\a \x1b[34mli\x1b[34mnk\x1b]8;;\x1b\\world\x1b[m`
	expect(toHtml(rawText)).toEqual(
		'he<span style="color:#d34f56">llo</span><a href="http://example.com" class="ansi-link" id="app"><span style="color:#d34f56">This is </span></a><a href="http://example.com" class="ansi-link" id="app" rel="noopener noreferrer"><span style="color:#d34f56">a </span><span style="color:#7ca7d8">link</span></a><span style="color:#7ca7d8">world</span>',
	)
})

it("endurance failure", () => {
	const toHtml = createToHtml()
	expect(toHtml(`\x1b[31m\x1b[0;;31;mhelloworld\x1b[m`)).toEqual("helloworld")
	expect(toHtml(`hello\x1b[??2Jhelloworld\x1b[m`)).toEqual("hellohelloworld")
	expect(toHtml(`\x1b[35?35mhello\x1b[m`)).toEqual("hello")
	expect(toHtml(`\x1b[30$?!;;;;;hello\x1b[m`)).toEqual("ello")
	expect(toHtml(`hello\x1b[?0001J\x1b[m`)).toEqual("")
	expect(toHtml(`hello\x1b[?,002J\x1b[m`)).toEqual("hello")
	expect(toHtml(`\x1b[31m\x1b[0;;;31mhelloworld\x1b[m`)).toEqual('<span style="color:#e05561">helloworld</span>')
	expect(toHtml(`\x1b[31m\x1b[0;;31w;mhelloworld\x1b[m`)).toEqual('<span style="color:#e05561">;mhelloworld</span>')
	expect(toHtml(`\x1b[38;5mhelloworld\x1b[m`)).toEqual('<span style="color:#3f4451">helloworld</span>')
	expect(toHtml(`\x1b[38;5;mhelloworld\x1b[m`)).toEqual('<span style="color:#3f4451">helloworld</span>')
	expect(toHtml(`\x1b[38;2;3;mblack\x1b[m`)).toEqual('<span style="color:#000000">black</span>')
	expect(toHtml(`\x1b[48;5mhelloworld\x1b[m`)).toEqual('<span style="background-color:#3f4451">helloworld</span>')
	expect(toHtml(`\x1b[48;5;mhelloworld\x1b[m`)).toEqual('<span style="background-color:#3f4451">helloworld</span>')
	expect(toHtml(`\x1b[48;2;3;mblack\x1b[m`)).toEqual('<span style="background-color:#000000">black</span>')
	expect(toHtml(`abcde\x1b[`)).toEqual("abcde")
	expect(toHtml(`abcde\x1b]`)).toEqual("abcde")
	expect(toHtml(`\x1b7helloworld`)).toEqual("helloworld")
	expect(toHtml(`\x1b[?25hhelloworld`)).toEqual("helloworld")
	expect(toHtml(`\x1b[?1049hhelloworld`)).toEqual("helloworld")
	expect(toHtml(`\x1b[20;3Hhelloworld`)).toEqual("helloworld")
	expect(toHtml(`abcde\x1b]6;id=app;http://example.com\x1b\\`)).toEqual("abcde")
	expect(toHtml(`\x1b]8;;;;http://example.com\x1b\\helloworld\x1b\\`)).toEqual("helloworld")
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
	expect(toHtml(`sdfsdsdf\x1b[?2J`)).toEqual("")
})

it("unicode", () => {
	const toHtml = createToHtml(options)
	expect(toHtml(`\x1b[4;31m咖啡\x1b[34m真的\x1b[0m很好喝`)).toEqual(
		'<span style="color:#d34f56;text-decoration:underline">咖啡</span><span style="color:#7ca7d8;text-decoration:underline">真的</span>很好喝',
	)
})

it("blend color", () => {
	expect(blend(0x231ee780, 0x330212ff)).toBeCloseTo(0x2b107d00, -1)
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

it("inverse", () => {
	const toHtml = createToHtml({ theme: { foreground: "#eee" } })
	expect(toHtml(`hello\x1b[7mworld\x1b[m`)).toEqual(
		'<span style="color:#eeeeee">hello</span><span style="background-color:#eeeeee">world</span>',
	)
})

it("dim", () => {
	const toHtml = createToHtml(options)
	expect(toHtml(`hello\x1b[2mworld\x1b[m`)).toEqual('hello<span style="opacity:0.5">world</span>')
	expect(toHtml(`hello\x1b[44;2mworld\x1b[m`)).toEqual('hello<span style="background-color:#7ca7d8">world</span>')
	expect(toHtml(`hello\x1b[34;2mworld\x1b[m`)).toEqual('hello<span style="color:#7ca7d8;opacity:0.5">world</span>')
	expect(toHtml(`hello\x1b[34;44;2mworld\x1b[m`)).toEqual(
		'hello<span style="color:#7ca7d880;background-color:#7ca7d8">world</span>',
	)
})

it("minimumContrastRatio", () => {
	let toHtml = createToHtml({ minimumContrastRatio: 1 })
	expect(toHtml(`\x1b[31;41mhelloworld\x1b[m`)).toEqual(
		'<span style="color:#e05561;background-color:#e05561">helloworld</span>',
	)
	toHtml = createToHtml({ minimumContrastRatio: 4.5 })
	expect(toHtml(`\x1b[31;41mhelloworld\x1b[m`)).toEqual(
		'<span style="color:#ffffff;background-color:#e05561">helloworld</span>',
	)
	expect(toHtml(`\x1b[107;92mhelloworld\x1b[m`)).toEqual(
		'<span style="color:#6b914b;background-color:#d7dae0">helloworld</span>',
	)
})

it("other (inline)", () => {
	let toHtml = createToHtml()
	expect(toHtml("helloworld")).toEqual("helloworld")
	expect(toHtml("\x1b[3;100mhelloworl\x1b[8md\x1b[m")).toEqual(
		'<span style="background-color:#4f5666;font-style:italic">helloworl</span><span style="background-color:#4f5666;font-style:italic;opacity:0">d</span>',
	)
	expect(toHtml("\x1b[3;100;49mhelloworld\x1b[m")).toEqual('<span style="font-style:italic">helloworld</span>')
	expect(toHtml(`\x1b[48;2;3;4;5mhelloworld\x1b[m`)).toEqual(
		'<span style="background-color:#030405">helloworld</span>',
	)
	expect(toHtml(`hello\x0bwo\x1bmrld\x1b[m`)).toEqual("helloworld")
	expect(toHtml(`\x1b[38;5;2mhelloworld\x1b[m`)).toEqual('<span style="color:#8cc265">helloworld</span>')
	expect(toHtml(`\x1b[38;5;2;1mhelloworld\x1b[m`)).toEqual(
		'<span style="color:#a5e075;font-weight:700">helloworld</span>',
	)
	expect(toHtml(`\x1b[38;2;2;4;6mhelloworld\x1b[m`)).toEqual('<span style="color:#020406">helloworld</span>')
	expect(toHtml(`\x1b]8;;http://example.com\x1b\\This is a link`)).toEqual(
		'<a href="http://example.com" class="ansi-link">This is a link</a>',
	)
	expect(toHtml(`\x1b[2;31;41mhelloworld\x1b[m`)).toEqual(
		'<span style="color:#fcdfe380;background-color:#e05561">helloworld</span>',
	)
	toHtml = createToHtml({ theme: { foreground: "#eeeeee" } })
	expect(toHtml(`\x1b[2;41mhelloworld\x1b[m`)).toEqual(
		'<span style="color:#eeeeee80;background-color:#e05561">helloworld</span>',
	)
})

it("other (class)", () => {
	const toHtml = createToHtml({ mode: "class" })
	expect(toHtml(`\x1b[7mhelloworld\x1b[m`)).toEqual('<span class="ansi-fg-inverse ansi-bg-inverse">helloworld</span>')
	expect(toHtml(`\x1b[1;38;5;1mhelloworld\x1b[m`)).toEqual('<span class="ansi-fg-9 ansi-bold">helloworld</span>')
	expect(toHtml(`\x1b[2;3;4;5;6;7;8;9mhelloworld\x1b[m`)).toEqual(
		'<span class="ansi-fg-inverse ansi-bg-inverse ansi-underline ansi-strike ansi-italic ansi-dim ansi-hidden">helloworld</span>',
	)
	expect(toHtml(`\x1b[2;31mhelloworld\x1b[m`)).toEqual('<span class="ansi-fg-1 ansi-dim">helloworld</span>')
})

it("throw error", () => {
	const toHtml = createToHtml()
	expect(() => toHtml(`\x1b[38;5;288mhelloworld288\x1b[m`)).toThrowError("foreground is not defined: 288")
})

it("throw error", () => {
	const toHtml = createToHtml()
	expect(() => toHtml(`\x1b[48;5;728mhelloworld728\x1b[m`)).toThrowError("background is not defined: 728")
})
