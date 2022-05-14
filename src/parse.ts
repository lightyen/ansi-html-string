import { ASCII, isNumber, SGR } from "./code"
import { ColorMode, ContrastCache, createPalette, ensureContrastRatio, Palette, Theme, toCss, toRgb } from "./colors"

interface Attributes {
	fgIndexOrRgb: number
	bgIndexOrRgb: number
	fgMode: ColorMode
	bgMode: ColorMode
	bold: boolean
	dim: boolean
	underline: boolean
	inverse: boolean
	italic: boolean
	strike: boolean
	hidden: boolean
}

interface SpanStyle {
	foreground?: string
	background?: string
	fgMode: ColorMode
	bgMode: ColorMode
	bold: boolean
	dim: boolean
	underline: boolean
	italic: boolean
	strike: boolean
	hidden: boolean
}

interface Anchor {
	params: Record<string, string>
	url: string
}

enum Mode {
	Inline,
	Class,
}

interface Context extends Attributes {
	classPrefix: string
	minimumContrastRatio: number
	contrastCache: ContrastCache
	mode: Mode
	palette: Palette
	isSpan: boolean
	prevStyle: SpanStyle
	isAnchor: boolean
	prevAnchor?: Anchor
	styleChanged: boolean
}

function createContext({ minimumContrastRatio = 3, mode = "inline", theme }: Options = {}): Context {
	return {
		classPrefix: "ansi-",
		contrastCache: new ContrastCache(),
		minimumContrastRatio,
		mode: mode === "class" ? Mode.Class : Mode.Inline,
		palette: createPalette(theme),
		fgIndexOrRgb: -1,
		bgIndexOrRgb: -1,
		fgMode: ColorMode.DEFAULT,
		bgMode: ColorMode.DEFAULT,
		bold: false,
		dim: false,
		underline: false,
		inverse: false,
		italic: false,
		strike: false,
		hidden: false,
		styleChanged: true,
		isSpan: false,
		isAnchor: false,
		prevStyle: {
			fgMode: ColorMode.DEFAULT,
			bgMode: ColorMode.DEFAULT,
			bold: false,
			dim: false,
			italic: false,
			underline: false,
			hidden: false,
			strike: false,
		},
	}
}

export interface Options {
	/** minimum contrast ratio: 1 - 21 (default: 3) */
	minimumContrastRatio?: number
	/** mode (default: inline) */
	mode?: "inline" | "class"
	/** user theme */
	theme?: Theme
}

interface Converter {
	toHtml(text: string): string
	toDemo(text?: string | null | undefined): string
	applyOptions(options: Options): void
}

export function createConverter(options?: Options): Converter {
	let c = createContext(options)
	return {
		toHtml,
		toDemo,
		applyOptions,
	}

	function toHtml(rawText: string): string {
		reset()
		return convert(rawText)
	}

	function toDemo(rawText?: string | null | undefined): string {
		reset()
		return buildDemo(c, convert(rawText ?? debugText))
	}

	function applyOptions(options: Options) {
		c = createContext(options)
	}

	function convert(rawText: string): string {
		let buffer = ""
		let i = 0
		let char = rawText.charCodeAt(i)
		while (i < rawText.length) {
			if (char === ASCII.ESC) {
				i++
				const nextChar = rawText.charCodeAt(i)
				if (Number.isNaN(nextChar)) {
					return buffer
				}
				if (nextChar === ASCII.LeftSquareBracket) {
					i++
					readCSI()
					c.styleChanged = true
				} else if (nextChar === ASCII.RightSquareBracket) {
					i++
					readOSC()
				}
				i++
				char = rawText.charCodeAt(i)
				continue
			}

			switch (char) {
				case ASCII.BS:
				case ASCII.VT:
				case ASCII.DEL:
					i++
					char = rawText.charCodeAt(i)
					continue
			}

			concat(char)

			i++
			char = rawText.charCodeAt(i)
		}

		if (c.isSpan) buffer += spanClose()
		if (c.isAnchor) buffer += anchorClose()
		return buffer

		function readCSI() {
			let char = rawText.charCodeAt(i)
			let num = 0
			const params: number[] = []
			while (!Number.isNaN(char)) {
				if (char < ASCII.Space || char >= ASCII.At) {
					params.push(num)
					if (char === ASCII.m) {
						setAttributes(params)
					}
					break
				}
				if (char === ASCII.SemiColon) {
					params.push(num)
					num = 0
				} else if (isNumber(char)) {
					num = 10 * num + (char - ASCII._0)
				}
				i++
				char = rawText.charCodeAt(i)
			}
		}

		function readOSC() {
			let state = 0
			let char = rawText.charCodeAt(i)
			let mode = -1
			const paramsPart: number[] = []
			const urlPart: number[] = []
			while (!Number.isNaN(char)) {
				if (char === ASCII.ST || char === ASCII.BEL) {
					if (mode == 8) ret()
					break
				}

				if (char === ASCII.ESC) {
					i++
					char = rawText.charCodeAt(i)
					if (Number.isNaN(char)) {
						return
					}
					if (char === ASCII.Backslash) {
						if (mode == 8) ret()
						break
					}
					return
				}

				if (char == ASCII.SemiColon) {
					state++
				} else if (state === 0) {
					mode = char - ASCII._0
				} else if (state === 1) {
					paramsPart.push(char)
				} else if (state === 2) {
					urlPart.push(char)
				}

				i++
				char = rawText.charCodeAt(i)
			}
			return

			function wrapSpan(cb: () => string) {
				if (c.isSpan) {
					buffer += spanClose()
					buffer += cb()
					buffer += spanOpen(c.prevStyle)
					return
				}
				buffer += cb()
			}

			function ret() {
				const url = String.fromCharCode(...urlPart)
				if (url) {
					const params = String.fromCharCode(...paramsPart)
					const a: Anchor = {
						url: url,
						params: {},
					}
					params.split(":").forEach(str => {
						const values = str.split("=")
						if (values.length === 2 && values[0] && values[1]) {
							a.params[values[0]] = values[1]
						}
					})
					if (c.prevAnchor) wrapSpan(() => anchorNext(a))
					else wrapSpan(() => anchorOpen(a))

					c.prevAnchor = a
					c.isAnchor = true
					return
				}
				if (c.isAnchor) {
					wrapSpan(() => {
						c.prevAnchor = undefined
						return anchorClose()
					})
				}
				c.isAnchor = false
			}
		}

		function resetAttributes() {
			c.fgIndexOrRgb = -1
			c.bgIndexOrRgb = -1
			c.fgMode = ColorMode.DEFAULT
			c.bgMode = ColorMode.DEFAULT
			c.bold = false
			c.dim = false
			c.italic = false
			c.underline = false
			c.inverse = false
			c.hidden = false
			c.strike = false
		}

		function setAttributes(attrs: number[]) {
			for (let i = 0; i < attrs.length; i++) {
				const code = attrs[i]
				switch (code) {
					case SGR.Reset:
						resetAttributes()
						break
					case SGR.Bold:
						c.bold = true
						break
					case SGR.Dim:
						c.dim = true
						break
					case SGR.Italic:
						c.italic = true
						break
					case SGR.Underline:
						c.underline = true
						break
					case SGR.Inverse:
						c.inverse = true
						break
					case SGR.Hidden:
						c.hidden = true
						break
					case SGR.Strike:
						c.strike = true
						break
					case SGR.SlowBlink:
					case SGR.RapidBlink:
						// undefined
						break
				}
				if (code >= SGR.FgBlack && code <= SGR.FgWhite) {
					c.fgIndexOrRgb = code - SGR.FgBlack
					c.fgMode = ColorMode.P16
				} else if (code >= SGR.BgBlack && code <= SGR.BgWhite) {
					c.bgIndexOrRgb = code - SGR.BgBlack
					c.bgMode = ColorMode.P16
				} else if (code >= SGR.BrightFgGray && code <= SGR.BrightFgWhite) {
					c.fgIndexOrRgb = 8 + code - SGR.BrightFgGray
					c.fgMode = ColorMode.P16
				} else if (code >= SGR.BrightBgGray && code <= SGR.BrightBgWhite) {
					c.bgIndexOrRgb = 8 + code - SGR.BrightBgGray
					c.bgMode = ColorMode.P16
				} else if (code === SGR.FgReset) {
					c.fgIndexOrRgb = -1
					c.fgMode = ColorMode.DEFAULT
				} else if (code === SGR.BgReset) {
					c.bgIndexOrRgb = -1
					c.bgMode = ColorMode.DEFAULT
				} else if (code === SGR.FgExt) {
					if (attrs[i + 1] === 5) {
						c.fgMode = ColorMode.P256
						if (i + 2 >= attrs.length) {
							c.fgIndexOrRgb = 0
							break
						}
						c.fgIndexOrRgb = attrs[i + 2]
						i += 2
					} else if (attrs[i + 1] === 2) {
						c.fgMode = ColorMode.RGB
						if (i + 4 >= attrs.length) {
							c.fgIndexOrRgb = 0
							break
						}
						const r = attrs[i + 2]
						const g = attrs[i + 3]
						const b = attrs[i + 4]
						c.fgIndexOrRgb = toRgb(r, g, b)

						i += 4
					}
				} else if (code === SGR.BgExt) {
					if (attrs[i + 1] === 5) {
						c.bgMode = ColorMode.P256
						if (i + 2 >= attrs.length) {
							c.bgIndexOrRgb = 0
							break
						}
						c.bgIndexOrRgb = attrs[i + 2]
						i += 2
					} else if (attrs[i + 1] === 2) {
						c.bgMode = ColorMode.RGB
						if (i + 4 >= attrs.length) {
							c.bgIndexOrRgb = 0
							break
						}
						const r = attrs[i + 2]
						const g = attrs[i + 3]
						const b = attrs[i + 4]
						c.bgIndexOrRgb = toRgb(r, g, b)
						i += 4
					}
				}
			}
		}

		function concat(char: number) {
			if (c.styleChanged) {
				const style = currentStyle()
				if (!equalStyle(c.prevStyle, style)) {
					if (needStyle(c.prevStyle)) {
						buffer += spanClose()
					}
					c.isSpan = needStyle(style)
					c.prevStyle = style
					if (c.isSpan) {
						buffer += spanOpen(style)
					}
				}
				c.styleChanged = false
			}
			buffer += String.fromCharCode(char)
		}
	}

	function needStyle(style: SpanStyle): boolean {
		if (style == undefined) return false
		return (
			!!style.foreground ||
			!!style.background ||
			style.bold ||
			style.dim ||
			style.italic ||
			style.underline ||
			style.hidden ||
			style.strike
		)
	}

	function equalStyle(a: SpanStyle, b: SpanStyle): boolean {
		if (a == undefined) return !needStyle(b)
		if (b == undefined) return !needStyle(a)
		return (
			a.foreground === b.foreground &&
			a.background === b.background &&
			a.bold === b.bold &&
			a.dim === b.dim &&
			a.italic === b.italic &&
			a.underline == b.underline &&
			a.hidden === b.hidden &&
			a.strike === b.strike
		)
	}

	function reset() {
		c.contrastCache.clear()
		c.styleChanged = true
		c.isSpan = false
		c.isAnchor = false
		c.fgIndexOrRgb = -1
		c.bgIndexOrRgb = -1
		c.fgMode = ColorMode.DEFAULT
		c.bgMode = ColorMode.DEFAULT
		c.bold = false
		c.dim = false
		c.italic = false
		c.underline = false
		c.inverse = false
		c.hidden = false
		c.strike = false
		c.prevStyle = {
			fgMode: ColorMode.DEFAULT,
			bgMode: ColorMode.DEFAULT,
			bold: false,
			dim: false,
			italic: false,
			underline: false,
			hidden: false,
			strike: false,
		}
		c.prevAnchor = undefined
	}

	function currentStyle(): SpanStyle {
		let fgColor = c.fgIndexOrRgb
		let bgColor = c.bgIndexOrRgb
		let fgMode = c.fgMode
		let bgMode = c.bgMode

		if (c.inverse) {
			let tmp = fgColor
			fgColor = bgColor
			bgColor = tmp
			tmp = fgMode
			fgMode = bgMode
			bgMode = tmp
		}

		if (fgMode === ColorMode.P256 && fgColor < 16) fgMode = ColorMode.P16
		if (bgMode === ColorMode.P256 && bgColor < 16) bgMode = ColorMode.P16

		const foreground =
			c.mode === Mode.Class && fgMode !== ColorMode.RGB
				? getForegroundClass(fgMode, fgColor)
				: getForegroundCss(bgMode, bgColor, fgMode, fgColor)

		const background =
			c.mode === Mode.Class && bgMode !== ColorMode.RGB
				? getBackgroundClass(bgMode, bgColor)
				: getBackgroundCss(bgMode, bgColor)

		return {
			fgMode,
			bgMode,
			foreground,
			background,
			bold: c.bold,
			dim: c.dim,
			underline: c.underline,
			italic: c.italic,
			strike: c.strike,
			hidden: c.hidden,
		}
	}

	function spanOpen(s: SpanStyle): string {
		const classes: string[] = []
		const props: Record<string, string> = {}
		if (c.mode === Mode.Class) {
			if (s.foreground) {
				if (s.fgMode !== ColorMode.RGB) classes.push(c.classPrefix + "fg-" + s.foreground)
				else props["color"] = s.foreground
			}
			if (s.background) {
				if (s.bgMode !== ColorMode.RGB) classes.push(c.classPrefix + "bg-" + s.background)
				else props["background-color"] = s.background
			}
			if (s.bold) classes.push(c.classPrefix + "bold")
			if (s.underline) classes.push(c.classPrefix + "underline")
			if (s.strike) classes.push(c.classPrefix + "strike")
			if (s.italic) classes.push(c.classPrefix + "italic")
			if (s.dim) classes.push(c.classPrefix + "dim")
			if (s.hidden) classes.push(c.classPrefix + "hidden")
		} else {
			if (s.foreground) props["color"] = s.foreground
			if (s.background) props["background-color"] = s.background
			if (s.bold) props["font-weight"] = "700"
			if (s.underline || s.strike) {
				const values: string[] = []
				if (s.underline) values.push("underline")
				if (s.strike) values.push("line-through")
				props["text-decoration"] = values.join(" ")
			}
			if (s.italic) props["font-style"] = "italic"
			if (s.hidden) {
				props["opacity"] = "0"
			} else if (s.dim) {
				if (!s.background) {
					props["opacity"] = "0.5"
				} else if (s.foreground) {
					props["color"] = s.foreground + "80"
				} else if (c.palette.foreground?.css) {
					props["color"] = c.palette.foreground.css + "80"
				}
			}
		}
		return `<span${getClasses()}${getCss()}>`
		function getClasses(): string {
			if (classes.length === 0) return ""
			return ' class="' + classes.join(" ") + '"'
		}
		function getCss(): string {
			const keys = Object.keys(props).sort()
			if (keys.length === 0) return ""
			return ' style="' + keys.map(k => `${k}:${props[k]}`).join(";") + '"'
		}
	}
	function spanClose(): string {
		return "</span>"
	}
	function anchorOpen(anchor: Anchor): string {
		const keys = Object.keys(anchor.params).sort()
		return (
			`<a href="${anchor.url}" class="${c.classPrefix}link"` +
			keys.map(k => ` ${k}="${anchor.params[k]}"`).reduce((result, value) => (result += value), "") +
			">"
		)
	}
	function anchorNext(anchor: Anchor): string {
		return anchorClose() + anchorOpen(anchor)
	}
	function anchorClose(): string {
		return "</a>"
	}

	function getForegroundClass(fgColorMode: ColorMode, fgIndexOrRgb: number): string | undefined | never {
		switch (fgColorMode) {
			case ColorMode.P16:
			case ColorMode.P256:
				if (c.bold && fgIndexOrRgb < 8) fgIndexOrRgb += 8
				return `${fgIndexOrRgb}`
		}
		if (c.inverse) return "inverse"
		return undefined
	}
	function getBackgroundClass(bgColorMode: ColorMode, bgIndexOrRgb: number): string | undefined | never {
		switch (bgColorMode) {
			case ColorMode.P16:
			case ColorMode.P256:
				return `${bgIndexOrRgb}`
		}
		if (c.inverse) return "inverse"
		return undefined
	}
	function getForegroundCss(
		bgColorMode: ColorMode,
		bgIndexOrRgb: number,
		fgColorMode: ColorMode,
		fgIndexOrRgb: number,
	): string | undefined | never {
		const minimumContrastCss = getMinimumContrastCss(bgColorMode, bgIndexOrRgb, fgColorMode, fgIndexOrRgb)
		if (minimumContrastCss) return minimumContrastCss
		return _getForegroundCss(fgColorMode, fgIndexOrRgb)
	}
	function getBackgroundCss(bgColorMode: ColorMode, bgIndexOrRgb: number): string | undefined | never {
		switch (bgColorMode) {
			case ColorMode.P16:
			case ColorMode.P256: {
				const color = c.palette.colors.at(bgIndexOrRgb)
				if (!color) throw Error(`background is not defined: ${bgIndexOrRgb}`)
				return color.css
			}
			case ColorMode.RGB:
				return toCss(bgIndexOrRgb)
		}
		if (c.inverse) return c.palette.foreground?.css
		return c.palette.background?.css
	}
	function getMinimumContrastCss(
		bgColorMode: ColorMode,
		bgIndexOrRgb: number,
		fgColorMode: ColorMode,
		fgIndexOrRgb: number,
	) {
		if (c.minimumContrastRatio <= 1) return undefined
		const bg = (bgIndexOrRgb << 8) | bgColorMode
		const fg = (fgIndexOrRgb << 8) | fgColorMode
		const adjustedColor = c.contrastCache.getCss(bg, fg)
		if (adjustedColor !== undefined) return adjustedColor || undefined

		const fgRgb = getForegroundRgb(fgColorMode, fgIndexOrRgb)
		const bgRgb = getBackgroundRgb(bgColorMode, bgIndexOrRgb)

		if (fgRgb != undefined && bgRgb != undefined) {
			const rgb = ensureContrastRatio(fgRgb, bgRgb, c.minimumContrastRatio)
			if (!rgb) {
				c.contrastCache.setCss(bg, fg, null)
				return undefined
			}
			const css = toCss(rgb)
			c.contrastCache.setCss(bg, fg, css)
			return css
		}
		return undefined
	}
	function _getForegroundCss(fgColorMode: ColorMode, fgIndexOrRgb: number): string | undefined | never {
		switch (fgColorMode) {
			case ColorMode.P16:
			case ColorMode.P256: {
				if (c.bold && fgIndexOrRgb < 8) fgIndexOrRgb += 8
				const color = c.palette.colors.at(fgIndexOrRgb)
				if (!color) throw Error(`foreground is not defined: ${fgIndexOrRgb}`)
				return color.css
			}
			case ColorMode.RGB:
				return toCss(fgIndexOrRgb)
		}
		if (c.inverse) return c.palette.background?.css
		return c.palette.foreground?.css
	}
	function getForegroundRgb(fgColorMode: ColorMode, fgIndexOrRgb: number): number | undefined | never {
		switch (fgColorMode) {
			case ColorMode.P16:
			case ColorMode.P256: {
				if (c.bold && fgIndexOrRgb < 8) fgIndexOrRgb += 8
				const color = c.palette.colors.at(fgIndexOrRgb)
				if (!color) throw Error(`foreground is not defined: ${fgIndexOrRgb}`)
				return color.rgb
			}
			case ColorMode.RGB:
				return fgIndexOrRgb
		}
		if (c.inverse) return c.palette.background?.rgb
		return c.palette.foreground?.rgb
	}
	function getBackgroundRgb(bgColorMode: number, bgIndexOrRgb: number): number | undefined | never {
		switch (bgColorMode) {
			case ColorMode.P16:
			case ColorMode.P256: {
				const color = c.palette.colors.at(bgIndexOrRgb)
				if (!color) throw Error(`background is not defined: ${bgIndexOrRgb}`)
				return color.rgb
			}
			case ColorMode.RGB:
				return bgIndexOrRgb
		}
		if (c.inverse) return c.palette.foreground?.rgb
		return c.palette.background?.rgb
	}
}

function buildDemo(ctx: Context, html: string): string {
	return `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>ANSI Demo</title>
		<style>
	${classes()}
	.ansi-link {
		text-decoration: underline dotted;
	}
	.ansi-link:hover {
		text-decoration: underline;
	}
	</style>
	</head>
	<body style="color:${ctx.palette.foreground?.css ?? "initial"};background-color:${
		ctx.palette.background?.css ?? "initial"
	}">
		<pre id="demo" style="font-size:20px;font-family:Cascadia Code PL, Cascadia Mono PL, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace">${html}</pre>
	</body>
</html>`

	function classes() {
		if (ctx.mode !== Mode.Class) return ""
		return `.ansi-fg-0 { color: #3f4451 }
.ansi-fg-1 { color: #e05561 }
.ansi-fg-2 { color: #8cc265 }
.ansi-fg-3 { color: #d18f52 }
.ansi-fg-4 { color: #4aa5f0 }
.ansi-fg-5 { color: #c162de }
.ansi-fg-6 { color: #42b3c2 }
.ansi-fg-7 { color: #e6e6e6 }
.ansi-fg-8 { color: #4f5666 }
.ansi-fg-9 { color: #ff616e }
.ansi-fg-10 { color: #a5e075 }
.ansi-fg-11 { color: #f0a45d }
.ansi-fg-12 { color: #4dc4ff }
.ansi-fg-13 { color: #de73ff }
.ansi-fg-14 { color: #4cd1e0 }
.ansi-bg-15 { color: #d7dae0 }
.ansi-bg-0 { background-color: #3f4451 }
.ansi-bg-1 { background-color: #e05561 }
.ansi-bg-2 { background-color: #8cc265 }
.ansi-bg-3 { background-color: #d18f52 }
.ansi-bg-4 { background-color: #4aa5f0 }
.ansi-bg-5 { background-color: #c162de }
.ansi-bg-6 { background-color: #42b3c2 }
.ansi-bg-7 { background-color: #e6e6e6 }
.ansi-bg-8 { background-color: #4f5666 }
.ansi-bg-9 { background-color: #ff616e }
.ansi-bg-10 { background-color: #a5e075 }
.ansi-bg-11 { background-color: #f0a45d }
.ansi-bg-12 { background-color: #4dc4ff }
.ansi-bg-13 { background-color: #de73ff }
.ansi-bg-14 { background-color: #4cd1e0 }
.ansi-bg-15 { background-color: #d7dae0 }
.ansi-fg-inverse { color: ${ctx.palette.background?.css ?? "initial"} }
.ansi-bg-inverse { background-color: ${ctx.palette.foreground?.css ?? "initial"} }
.ansi-bold { font-weight: 700 }
.ansi-underline { text-decoration: underline }
.ansi-strike { text-decoration: line-through }
.ansi-underline.ansi-strike { text-decoration: underline line-through }
.ansi-italic { font-style:italic }
.ansi-hidden { opacity: 0 }
.ansi-link { color: ${ctx.palette.foreground?.css ?? "initial"}; text-decoration: none }
.ansi-link:hover { text-decoration: underline }`
	}
}

const debugText = `	Standard colors:
	\x1b[48;5;0m  \x1b[48;5;1m  \x1b[48;5;2m  \x1b[48;5;3m  \x1b[48;5;4m  \x1b[48;5;5m  \x1b[48;5;6m  \x1b[48;5;7m  \x1b[0m
	\x1b[48;5;8m  \x1b[48;5;9m  \x1b[48;5;10m  \x1b[48;5;11m  \x1b[48;5;12m  \x1b[48;5;13m  \x1b[48;5;14m  \x1b[48;5;15m  \x1b[0m

	Color cube, 6x6x6:
	\x1b[48;5;16m  \x1b[48;5;17m  \x1b[48;5;18m  \x1b[48;5;19m  \x1b[48;5;20m  \x1b[48;5;21m  \x1b[0m \x1b[48;5;52m  \x1b[48;5;53m  \x1b[48;5;54m  \x1b[48;5;55m  \x1b[48;5;56m  \x1b[48;5;57m  \x1b[0m \x1b[48;5;88m  \x1b[48;5;89m  \x1b[48;5;90m  \x1b[48;5;91m  \x1b[48;5;92m  \x1b[48;5;93m  \x1b[0m \x1b[48;5;124m  \x1b[48;5;125m  \x1b[48;5;126m  \x1b[48;5;127m  \x1b[48;5;128m  \x1b[48;5;129m  \x1b[0m \x1b[48;5;160m  \x1b[48;5;161m  \x1b[48;5;162m  \x1b[48;5;163m  \x1b[48;5;164m  \x1b[48;5;165m  \x1b[0m \x1b[48;5;196m  \x1b[48;5;197m  \x1b[48;5;198m  \x1b[48;5;199m  \x1b[48;5;200m  \x1b[48;5;201m  \x1b[0m
	\x1b[48;5;22m  \x1b[48;5;23m  \x1b[48;5;24m  \x1b[48;5;25m  \x1b[48;5;26m  \x1b[48;5;27m  \x1b[0m \x1b[48;5;58m  \x1b[48;5;59m  \x1b[48;5;60m  \x1b[48;5;61m  \x1b[48;5;62m  \x1b[48;5;63m  \x1b[0m \x1b[48;5;94m  \x1b[48;5;95m  \x1b[48;5;96m  \x1b[48;5;97m  \x1b[48;5;98m  \x1b[48;5;99m  \x1b[0m \x1b[48;5;130m  \x1b[48;5;131m  \x1b[48;5;132m  \x1b[48;5;133m  \x1b[48;5;134m  \x1b[48;5;135m  \x1b[0m \x1b[48;5;166m  \x1b[48;5;167m  \x1b[48;5;168m  \x1b[48;5;169m  \x1b[48;5;170m  \x1b[48;5;171m  \x1b[0m \x1b[48;5;202m  \x1b[48;5;203m  \x1b[48;5;204m  \x1b[48;5;205m  \x1b[48;5;206m  \x1b[48;5;207m  \x1b[0m
	\x1b[48;5;28m  \x1b[48;5;29m  \x1b[48;5;30m  \x1b[48;5;31m  \x1b[48;5;32m  \x1b[48;5;33m  \x1b[0m \x1b[48;5;64m  \x1b[48;5;65m  \x1b[48;5;66m  \x1b[48;5;67m  \x1b[48;5;68m  \x1b[48;5;69m  \x1b[0m \x1b[48;5;100m  \x1b[48;5;101m  \x1b[48;5;102m  \x1b[48;5;103m  \x1b[48;5;104m  \x1b[48;5;105m  \x1b[0m \x1b[48;5;136m  \x1b[48;5;137m  \x1b[48;5;138m  \x1b[48;5;139m  \x1b[48;5;140m  \x1b[48;5;141m  \x1b[0m \x1b[48;5;172m  \x1b[48;5;173m  \x1b[48;5;174m  \x1b[48;5;175m  \x1b[48;5;176m  \x1b[48;5;177m  \x1b[0m \x1b[48;5;208m  \x1b[48;5;209m  \x1b[48;5;210m  \x1b[48;5;211m  \x1b[48;5;212m  \x1b[48;5;213m  \x1b[0m
	\x1b[48;5;34m  \x1b[48;5;35m  \x1b[48;5;36m  \x1b[48;5;37m  \x1b[48;5;38m  \x1b[48;5;39m  \x1b[0m \x1b[48;5;70m  \x1b[48;5;71m  \x1b[48;5;72m  \x1b[48;5;73m  \x1b[48;5;74m  \x1b[48;5;75m  \x1b[0m \x1b[48;5;106m  \x1b[48;5;107m  \x1b[48;5;108m  \x1b[48;5;109m  \x1b[48;5;110m  \x1b[48;5;111m  \x1b[0m \x1b[48;5;142m  \x1b[48;5;143m  \x1b[48;5;144m  \x1b[48;5;145m  \x1b[48;5;146m  \x1b[48;5;147m  \x1b[0m \x1b[48;5;178m  \x1b[48;5;179m  \x1b[48;5;180m  \x1b[48;5;181m  \x1b[48;5;182m  \x1b[48;5;183m  \x1b[0m \x1b[48;5;214m  \x1b[48;5;215m  \x1b[48;5;216m  \x1b[48;5;217m  \x1b[48;5;218m  \x1b[48;5;219m  \x1b[0m
	\x1b[48;5;40m  \x1b[48;5;41m  \x1b[48;5;42m  \x1b[48;5;43m  \x1b[48;5;44m  \x1b[48;5;45m  \x1b[0m \x1b[48;5;76m  \x1b[48;5;77m  \x1b[48;5;78m  \x1b[48;5;79m  \x1b[48;5;80m  \x1b[48;5;81m  \x1b[0m \x1b[48;5;112m  \x1b[48;5;113m  \x1b[48;5;114m  \x1b[48;5;115m  \x1b[48;5;116m  \x1b[48;5;117m  \x1b[0m \x1b[48;5;148m  \x1b[48;5;149m  \x1b[48;5;150m  \x1b[48;5;151m  \x1b[48;5;152m  \x1b[48;5;153m  \x1b[0m \x1b[48;5;184m  \x1b[48;5;185m  \x1b[48;5;186m  \x1b[48;5;187m  \x1b[48;5;188m  \x1b[48;5;189m  \x1b[0m \x1b[48;5;220m  \x1b[48;5;221m  \x1b[48;5;222m  \x1b[48;5;223m  \x1b[48;5;224m  \x1b[48;5;225m  \x1b[0m
	\x1b[48;5;46m  \x1b[48;5;47m  \x1b[48;5;48m  \x1b[48;5;49m  \x1b[48;5;50m  \x1b[48;5;51m  \x1b[0m \x1b[48;5;82m  \x1b[48;5;83m  \x1b[48;5;84m  \x1b[48;5;85m  \x1b[48;5;86m  \x1b[48;5;87m  \x1b[0m \x1b[48;5;118m  \x1b[48;5;119m  \x1b[48;5;120m  \x1b[48;5;121m  \x1b[48;5;122m  \x1b[48;5;123m  \x1b[0m \x1b[48;5;154m  \x1b[48;5;155m  \x1b[48;5;156m  \x1b[48;5;157m  \x1b[48;5;158m  \x1b[48;5;159m  \x1b[0m \x1b[48;5;190m  \x1b[48;5;191m  \x1b[48;5;192m  \x1b[48;5;193m  \x1b[48;5;194m  \x1b[48;5;195m  \x1b[0m \x1b[48;5;226m  \x1b[48;5;227m  \x1b[48;5;228m  \x1b[48;5;229m  \x1b[48;5;230m  \x1b[48;5;231m  \x1b[0m

	Grayscale:
	\x1b[48;5;232m  \x1b[48;5;233m  \x1b[48;5;234m  \x1b[48;5;235m  \x1b[48;5;236m  \x1b[48;5;237m  \x1b[48;5;238m  \x1b[48;5;239m  \x1b[48;5;240m  \x1b[48;5;241m  \x1b[48;5;242m  \x1b[48;5;243m  \x1b[48;5;244m  \x1b[48;5;245m  \x1b[48;5;246m  \x1b[48;5;247m  \x1b[48;5;248m  \x1b[48;5;249m  \x1b[48;5;250m  \x1b[48;5;251m  \x1b[48;5;252m  \x1b[48;5;253m  \x1b[48;5;254m  \x1b[48;5;255m  \x1b[0m

	\x1b[0;30;40m   $E[30;40m   \x1b[0m \x1b[0;1;30;40m  $E[1;30;40m  \x1b[0m \x1b[0;30;4;40m  $E[30;4;40m  \x1b[0m \x1b[0;1;30;4;40m $E[1;30;4;40m \x1b[0m \x1b[0;30;5;40m  $E[30;5;40m  \x1b[0m \x1b[0;1;30;5;40m $E[1;30;5;40m \x1b[0m
	\x1b[0;31;40m   $E[31;40m   \x1b[0m \x1b[0;1;31;40m  $E[1;31;40m  \x1b[0m \x1b[0;31;4;40m  $E[31;4;40m  \x1b[0m \x1b[0;1;31;4;40m $E[1;31;4;40m \x1b[0m \x1b[0;31;5;40m  $E[31;5;40m  \x1b[0m \x1b[0;1;31;5;40m $E[1;31;5;40m \x1b[0m
	\x1b[0;32;40m   $E[32;40m   \x1b[0m \x1b[0;1;32;40m  $E[1;32;40m  \x1b[0m \x1b[0;32;4;40m  $E[32;4;40m  \x1b[0m \x1b[0;1;32;4;40m $E[1;32;4;40m \x1b[0m \x1b[0;32;5;40m  $E[32;5;40m  \x1b[0m \x1b[0;1;32;5;40m $E[1;32;5;40m \x1b[0m
	\x1b[0;33;40m   $E[33;40m   \x1b[0m \x1b[0;1;33;40m  $E[1;33;40m  \x1b[0m \x1b[0;33;4;40m  $E[33;4;40m  \x1b[0m \x1b[0;1;33;4;40m $E[1;33;4;40m \x1b[0m \x1b[0;33;5;40m  $E[33;5;40m  \x1b[0m \x1b[0;1;33;5;40m $E[1;33;5;40m \x1b[0m
	\x1b[0;34;40m   $E[34;40m   \x1b[0m \x1b[0;1;34;40m  $E[1;34;40m  \x1b[0m \x1b[0;34;4;40m  $E[34;4;40m  \x1b[0m \x1b[0;1;34;4;40m $E[1;34;4;40m \x1b[0m \x1b[0;34;5;40m  $E[34;5;40m  \x1b[0m \x1b[0;1;34;5;40m $E[1;34;5;40m \x1b[0m
	\x1b[0;35;40m   $E[35;40m   \x1b[0m \x1b[0;1;35;40m  $E[1;35;40m  \x1b[0m \x1b[0;35;4;40m  $E[35;4;40m  \x1b[0m \x1b[0;1;35;4;40m $E[1;35;4;40m \x1b[0m \x1b[0;35;5;40m  $E[35;5;40m  \x1b[0m \x1b[0;1;35;5;40m $E[1;35;5;40m \x1b[0m
	\x1b[0;36;40m   $E[36;40m   \x1b[0m \x1b[0;1;36;40m  $E[1;36;40m  \x1b[0m \x1b[0;36;4;40m  $E[36;4;40m  \x1b[0m \x1b[0;1;36;4;40m $E[1;36;4;40m \x1b[0m \x1b[0;36;5;40m  $E[36;5;40m  \x1b[0m \x1b[0;1;36;5;40m $E[1;36;5;40m \x1b[0m
	\x1b[0;37;40m   $E[37;40m   \x1b[0m \x1b[0;1;37;40m  $E[1;37;40m  \x1b[0m \x1b[0;37;4;40m  $E[37;4;40m  \x1b[0m \x1b[0;1;37;4;40m $E[1;37;4;40m \x1b[0m \x1b[0;37;5;40m  $E[37;5;40m  \x1b[0m \x1b[0;1;37;5;40m $E[1;37;5;40m \x1b[0m
	\x1b[0;30;41m   $E[30;41m   \x1b[0m \x1b[0;1;30;41m  $E[1;30;41m  \x1b[0m \x1b[0;30;4;41m  $E[30;4;41m  \x1b[0m \x1b[0;1;30;4;41m $E[1;30;4;41m \x1b[0m \x1b[0;30;5;41m  $E[30;5;41m  \x1b[0m \x1b[0;1;30;5;41m $E[1;30;5;41m \x1b[0m
	\x1b[0;31;41m   $E[31;41m   \x1b[0m \x1b[0;1;31;41m  $E[1;31;41m  \x1b[0m \x1b[0;31;4;41m  $E[31;4;41m  \x1b[0m \x1b[0;1;31;4;41m $E[1;31;4;41m \x1b[0m \x1b[0;31;5;41m  $E[31;5;41m  \x1b[0m \x1b[0;1;31;5;41m $E[1;31;5;41m \x1b[0m
	\x1b[0;32;41m   $E[32;41m   \x1b[0m \x1b[0;1;32;41m  $E[1;32;41m  \x1b[0m \x1b[0;32;4;41m  $E[32;4;41m  \x1b[0m \x1b[0;1;32;4;41m $E[1;32;4;41m \x1b[0m \x1b[0;32;5;41m  $E[32;5;41m  \x1b[0m \x1b[0;1;32;5;41m $E[1;32;5;41m \x1b[0m
	\x1b[0;33;41m   $E[33;41m   \x1b[0m \x1b[0;1;33;41m  $E[1;33;41m  \x1b[0m \x1b[0;33;4;41m  $E[33;4;41m  \x1b[0m \x1b[0;1;33;4;41m $E[1;33;4;41m \x1b[0m \x1b[0;33;5;41m  $E[33;5;41m  \x1b[0m \x1b[0;1;33;5;41m $E[1;33;5;41m \x1b[0m
	\x1b[0;34;41m   $E[34;41m   \x1b[0m \x1b[0;1;34;41m  $E[1;34;41m  \x1b[0m \x1b[0;34;4;41m  $E[34;4;41m  \x1b[0m \x1b[0;1;34;4;41m $E[1;34;4;41m \x1b[0m \x1b[0;34;5;41m  $E[34;5;41m  \x1b[0m \x1b[0;1;34;5;41m $E[1;34;5;41m \x1b[0m
	\x1b[0;35;41m   $E[35;41m   \x1b[0m \x1b[0;1;35;41m  $E[1;35;41m  \x1b[0m \x1b[0;35;4;41m  $E[35;4;41m  \x1b[0m \x1b[0;1;35;4;41m $E[1;35;4;41m \x1b[0m \x1b[0;35;5;41m  $E[35;5;41m  \x1b[0m \x1b[0;1;35;5;41m $E[1;35;5;41m \x1b[0m
	\x1b[0;36;41m   $E[36;41m   \x1b[0m \x1b[0;1;36;41m  $E[1;36;41m  \x1b[0m \x1b[0;36;4;41m  $E[36;4;41m  \x1b[0m \x1b[0;1;36;4;41m $E[1;36;4;41m \x1b[0m \x1b[0;36;5;41m  $E[36;5;41m  \x1b[0m \x1b[0;1;36;5;41m $E[1;36;5;41m \x1b[0m
	\x1b[0;37;41m   $E[37;41m   \x1b[0m \x1b[0;1;37;41m  $E[1;37;41m  \x1b[0m \x1b[0;37;4;41m  $E[37;4;41m  \x1b[0m \x1b[0;1;37;4;41m $E[1;37;4;41m \x1b[0m \x1b[0;37;5;41m  $E[37;5;41m  \x1b[0m \x1b[0;1;37;5;41m $E[1;37;5;41m \x1b[0m
	\x1b[0;30;42m   $E[30;42m   \x1b[0m \x1b[0;1;30;42m  $E[1;30;42m  \x1b[0m \x1b[0;30;4;42m  $E[30;4;42m  \x1b[0m \x1b[0;1;30;4;42m $E[1;30;4;42m \x1b[0m \x1b[0;30;5;42m  $E[30;5;42m  \x1b[0m \x1b[0;1;30;5;42m $E[1;30;5;42m \x1b[0m
	\x1b[0;31;42m   $E[31;42m   \x1b[0m \x1b[0;1;31;42m  $E[1;31;42m  \x1b[0m \x1b[0;31;4;42m  $E[31;4;42m  \x1b[0m \x1b[0;1;31;4;42m $E[1;31;4;42m \x1b[0m \x1b[0;31;5;42m  $E[31;5;42m  \x1b[0m \x1b[0;1;31;5;42m $E[1;31;5;42m \x1b[0m
	\x1b[0;32;42m   $E[32;42m   \x1b[0m \x1b[0;1;32;42m  $E[1;32;42m  \x1b[0m \x1b[0;32;4;42m  $E[32;4;42m  \x1b[0m \x1b[0;1;32;4;42m $E[1;32;4;42m \x1b[0m \x1b[0;32;5;42m  $E[32;5;42m  \x1b[0m \x1b[0;1;32;5;42m $E[1;32;5;42m \x1b[0m
	\x1b[0;33;42m   $E[33;42m   \x1b[0m \x1b[0;1;33;42m  $E[1;33;42m  \x1b[0m \x1b[0;33;4;42m  $E[33;4;42m  \x1b[0m \x1b[0;1;33;4;42m $E[1;33;4;42m \x1b[0m \x1b[0;33;5;42m  $E[33;5;42m  \x1b[0m \x1b[0;1;33;5;42m $E[1;33;5;42m \x1b[0m
	\x1b[0;34;42m   $E[34;42m   \x1b[0m \x1b[0;1;34;42m  $E[1;34;42m  \x1b[0m \x1b[0;34;4;42m  $E[34;4;42m  \x1b[0m \x1b[0;1;34;4;42m $E[1;34;4;42m \x1b[0m \x1b[0;34;5;42m  $E[34;5;42m  \x1b[0m \x1b[0;1;34;5;42m $E[1;34;5;42m \x1b[0m
	\x1b[0;35;42m   $E[35;42m   \x1b[0m \x1b[0;1;35;42m  $E[1;35;42m  \x1b[0m \x1b[0;35;4;42m  $E[35;4;42m  \x1b[0m \x1b[0;1;35;4;42m $E[1;35;4;42m \x1b[0m \x1b[0;35;5;42m  $E[35;5;42m  \x1b[0m \x1b[0;1;35;5;42m $E[1;35;5;42m \x1b[0m
	\x1b[0;36;42m   $E[36;42m   \x1b[0m \x1b[0;1;36;42m  $E[1;36;42m  \x1b[0m \x1b[0;36;4;42m  $E[36;4;42m  \x1b[0m \x1b[0;1;36;4;42m $E[1;36;4;42m \x1b[0m \x1b[0;36;5;42m  $E[36;5;42m  \x1b[0m \x1b[0;1;36;5;42m $E[1;36;5;42m \x1b[0m
	\x1b[0;37;42m   $E[37;42m   \x1b[0m \x1b[0;1;37;42m  $E[1;37;42m  \x1b[0m \x1b[0;37;4;42m  $E[37;4;42m  \x1b[0m \x1b[0;1;37;4;42m $E[1;37;4;42m \x1b[0m \x1b[0;37;5;42m  $E[37;5;42m  \x1b[0m \x1b[0;1;37;5;42m $E[1;37;5;42m \x1b[0m
	\x1b[0;30;43m   $E[30;43m   \x1b[0m \x1b[0;1;30;43m  $E[1;30;43m  \x1b[0m \x1b[0;30;4;43m  $E[30;4;43m  \x1b[0m \x1b[0;1;30;4;43m $E[1;30;4;43m \x1b[0m \x1b[0;30;5;43m  $E[30;5;43m  \x1b[0m \x1b[0;1;30;5;43m $E[1;30;5;43m \x1b[0m
	\x1b[0;31;43m   $E[31;43m   \x1b[0m \x1b[0;1;31;43m  $E[1;31;43m  \x1b[0m \x1b[0;31;4;43m  $E[31;4;43m  \x1b[0m \x1b[0;1;31;4;43m $E[1;31;4;43m \x1b[0m \x1b[0;31;5;43m  $E[31;5;43m  \x1b[0m \x1b[0;1;31;5;43m $E[1;31;5;43m \x1b[0m
	\x1b[0;32;43m   $E[32;43m   \x1b[0m \x1b[0;1;32;43m  $E[1;32;43m  \x1b[0m \x1b[0;32;4;43m  $E[32;4;43m  \x1b[0m \x1b[0;1;32;4;43m $E[1;32;4;43m \x1b[0m \x1b[0;32;5;43m  $E[32;5;43m  \x1b[0m \x1b[0;1;32;5;43m $E[1;32;5;43m \x1b[0m
	\x1b[0;33;43m   $E[33;43m   \x1b[0m \x1b[0;1;33;43m  $E[1;33;43m  \x1b[0m \x1b[0;33;4;43m  $E[33;4;43m  \x1b[0m \x1b[0;1;33;4;43m $E[1;33;4;43m \x1b[0m \x1b[0;33;5;43m  $E[33;5;43m  \x1b[0m \x1b[0;1;33;5;43m $E[1;33;5;43m \x1b[0m
	\x1b[0;34;43m   $E[34;43m   \x1b[0m \x1b[0;1;34;43m  $E[1;34;43m  \x1b[0m \x1b[0;34;4;43m  $E[34;4;43m  \x1b[0m \x1b[0;1;34;4;43m $E[1;34;4;43m \x1b[0m \x1b[0;34;5;43m  $E[34;5;43m  \x1b[0m \x1b[0;1;34;5;43m $E[1;34;5;43m \x1b[0m
	\x1b[0;35;43m   $E[35;43m   \x1b[0m \x1b[0;1;35;43m  $E[1;35;43m  \x1b[0m \x1b[0;35;4;43m  $E[35;4;43m  \x1b[0m \x1b[0;1;35;4;43m $E[1;35;4;43m \x1b[0m \x1b[0;35;5;43m  $E[35;5;43m  \x1b[0m \x1b[0;1;35;5;43m $E[1;35;5;43m \x1b[0m
	\x1b[0;36;43m   $E[36;43m   \x1b[0m \x1b[0;1;36;43m  $E[1;36;43m  \x1b[0m \x1b[0;36;4;43m  $E[36;4;43m  \x1b[0m \x1b[0;1;36;4;43m $E[1;36;4;43m \x1b[0m \x1b[0;36;5;43m  $E[36;5;43m  \x1b[0m \x1b[0;1;36;5;43m $E[1;36;5;43m \x1b[0m
	\x1b[0;37;43m   $E[37;43m   \x1b[0m \x1b[0;1;37;43m  $E[1;37;43m  \x1b[0m \x1b[0;37;4;43m  $E[37;4;43m  \x1b[0m \x1b[0;1;37;4;43m $E[1;37;4;43m \x1b[0m \x1b[0;37;5;43m  $E[37;5;43m  \x1b[0m \x1b[0;1;37;5;43m $E[1;37;5;43m \x1b[0m
	\x1b[0;30;44m   $E[30;44m   \x1b[0m \x1b[0;1;30;44m  $E[1;30;44m  \x1b[0m \x1b[0;30;4;44m  $E[30;4;44m  \x1b[0m \x1b[0;1;30;4;44m $E[1;30;4;44m \x1b[0m \x1b[0;30;5;44m  $E[30;5;44m  \x1b[0m \x1b[0;1;30;5;44m $E[1;30;5;44m \x1b[0m
	\x1b[0;31;44m   $E[31;44m   \x1b[0m \x1b[0;1;31;44m  $E[1;31;44m  \x1b[0m \x1b[0;31;4;44m  $E[31;4;44m  \x1b[0m \x1b[0;1;31;4;44m $E[1;31;4;44m \x1b[0m \x1b[0;31;5;44m  $E[31;5;44m  \x1b[0m \x1b[0;1;31;5;44m $E[1;31;5;44m \x1b[0m
	\x1b[0;32;44m   $E[32;44m   \x1b[0m \x1b[0;1;32;44m  $E[1;32;44m  \x1b[0m \x1b[0;32;4;44m  $E[32;4;44m  \x1b[0m \x1b[0;1;32;4;44m $E[1;32;4;44m \x1b[0m \x1b[0;32;5;44m  $E[32;5;44m  \x1b[0m \x1b[0;1;32;5;44m $E[1;32;5;44m \x1b[0m
	\x1b[0;33;44m   $E[33;44m   \x1b[0m \x1b[0;1;33;44m  $E[1;33;44m  \x1b[0m \x1b[0;33;4;44m  $E[33;4;44m  \x1b[0m \x1b[0;1;33;4;44m $E[1;33;4;44m \x1b[0m \x1b[0;33;5;44m  $E[33;5;44m  \x1b[0m \x1b[0;1;33;5;44m $E[1;33;5;44m \x1b[0m
	\x1b[0;34;44m   $E[34;44m   \x1b[0m \x1b[0;1;34;44m  $E[1;34;44m  \x1b[0m \x1b[0;34;4;44m  $E[34;4;44m  \x1b[0m \x1b[0;1;34;4;44m $E[1;34;4;44m \x1b[0m \x1b[0;34;5;44m  $E[34;5;44m  \x1b[0m \x1b[0;1;34;5;44m $E[1;34;5;44m \x1b[0m
	\x1b[0;35;44m   $E[35;44m   \x1b[0m \x1b[0;1;35;44m  $E[1;35;44m  \x1b[0m \x1b[0;35;4;44m  $E[35;4;44m  \x1b[0m \x1b[0;1;35;4;44m $E[1;35;4;44m \x1b[0m \x1b[0;35;5;44m  $E[35;5;44m  \x1b[0m \x1b[0;1;35;5;44m $E[1;35;5;44m \x1b[0m
	\x1b[0;36;44m   $E[36;44m   \x1b[0m \x1b[0;1;36;44m  $E[1;36;44m  \x1b[0m \x1b[0;36;4;44m  $E[36;4;44m  \x1b[0m \x1b[0;1;36;4;44m $E[1;36;4;44m \x1b[0m \x1b[0;36;5;44m  $E[36;5;44m  \x1b[0m \x1b[0;1;36;5;44m $E[1;36;5;44m \x1b[0m
	\x1b[0;37;44m   $E[37;44m   \x1b[0m \x1b[0;1;37;44m  $E[1;37;44m  \x1b[0m \x1b[0;37;4;44m  $E[37;4;44m  \x1b[0m \x1b[0;1;37;4;44m $E[1;37;4;44m \x1b[0m \x1b[0;37;5;44m  $E[37;5;44m  \x1b[0m \x1b[0;1;37;5;44m $E[1;37;5;44m \x1b[0m
	\x1b[0;30;45m   $E[30;45m   \x1b[0m \x1b[0;1;30;45m  $E[1;30;45m  \x1b[0m \x1b[0;30;4;45m  $E[30;4;45m  \x1b[0m \x1b[0;1;30;4;45m $E[1;30;4;45m \x1b[0m \x1b[0;30;5;45m  $E[30;5;45m  \x1b[0m \x1b[0;1;30;5;45m $E[1;30;5;45m \x1b[0m
	\x1b[0;31;45m   $E[31;45m   \x1b[0m \x1b[0;1;31;45m  $E[1;31;45m  \x1b[0m \x1b[0;31;4;45m  $E[31;4;45m  \x1b[0m \x1b[0;1;31;4;45m $E[1;31;4;45m \x1b[0m \x1b[0;31;5;45m  $E[31;5;45m  \x1b[0m \x1b[0;1;31;5;45m $E[1;31;5;45m \x1b[0m
	\x1b[0;32;45m   $E[32;45m   \x1b[0m \x1b[0;1;32;45m  $E[1;32;45m  \x1b[0m \x1b[0;32;4;45m  $E[32;4;45m  \x1b[0m \x1b[0;1;32;4;45m $E[1;32;4;45m \x1b[0m \x1b[0;32;5;45m  $E[32;5;45m  \x1b[0m \x1b[0;1;32;5;45m $E[1;32;5;45m \x1b[0m
	\x1b[0;33;45m   $E[33;45m   \x1b[0m \x1b[0;1;33;45m  $E[1;33;45m  \x1b[0m \x1b[0;33;4;45m  $E[33;4;45m  \x1b[0m \x1b[0;1;33;4;45m $E[1;33;4;45m \x1b[0m \x1b[0;33;5;45m  $E[33;5;45m  \x1b[0m \x1b[0;1;33;5;45m $E[1;33;5;45m \x1b[0m
	\x1b[0;34;45m   $E[34;45m   \x1b[0m \x1b[0;1;34;45m  $E[1;34;45m  \x1b[0m \x1b[0;34;4;45m  $E[34;4;45m  \x1b[0m \x1b[0;1;34;4;45m $E[1;34;4;45m \x1b[0m \x1b[0;34;5;45m  $E[34;5;45m  \x1b[0m \x1b[0;1;34;5;45m $E[1;34;5;45m \x1b[0m
	\x1b[0;35;45m   $E[35;45m   \x1b[0m \x1b[0;1;35;45m  $E[1;35;45m  \x1b[0m \x1b[0;35;4;45m  $E[35;4;45m  \x1b[0m \x1b[0;1;35;4;45m $E[1;35;4;45m \x1b[0m \x1b[0;35;5;45m  $E[35;5;45m  \x1b[0m \x1b[0;1;35;5;45m $E[1;35;5;45m \x1b[0m
	\x1b[0;36;45m   $E[36;45m   \x1b[0m \x1b[0;1;36;45m  $E[1;36;45m  \x1b[0m \x1b[0;36;4;45m  $E[36;4;45m  \x1b[0m \x1b[0;1;36;4;45m $E[1;36;4;45m \x1b[0m \x1b[0;36;5;45m  $E[36;5;45m  \x1b[0m \x1b[0;1;36;5;45m $E[1;36;5;45m \x1b[0m
	\x1b[0;37;45m   $E[37;45m   \x1b[0m \x1b[0;1;37;45m  $E[1;37;45m  \x1b[0m \x1b[0;37;4;45m  $E[37;4;45m  \x1b[0m \x1b[0;1;37;4;45m $E[1;37;4;45m \x1b[0m \x1b[0;37;5;45m  $E[37;5;45m  \x1b[0m \x1b[0;1;37;5;45m $E[1;37;5;45m \x1b[0m
	\x1b[0;30;46m   $E[30;46m   \x1b[0m \x1b[0;1;30;46m  $E[1;30;46m  \x1b[0m \x1b[0;30;4;46m  $E[30;4;46m  \x1b[0m \x1b[0;1;30;4;46m $E[1;30;4;46m \x1b[0m \x1b[0;30;5;46m  $E[30;5;46m  \x1b[0m \x1b[0;1;30;5;46m $E[1;30;5;46m \x1b[0m
	\x1b[0;31;46m   $E[31;46m   \x1b[0m \x1b[0;1;31;46m  $E[1;31;46m  \x1b[0m \x1b[0;31;4;46m  $E[31;4;46m  \x1b[0m \x1b[0;1;31;4;46m $E[1;31;4;46m \x1b[0m \x1b[0;31;5;46m  $E[31;5;46m  \x1b[0m \x1b[0;1;31;5;46m $E[1;31;5;46m \x1b[0m
	\x1b[0;32;46m   $E[32;46m   \x1b[0m \x1b[0;1;32;46m  $E[1;32;46m  \x1b[0m \x1b[0;32;4;46m  $E[32;4;46m  \x1b[0m \x1b[0;1;32;4;46m $E[1;32;4;46m \x1b[0m \x1b[0;32;5;46m  $E[32;5;46m  \x1b[0m \x1b[0;1;32;5;46m $E[1;32;5;46m \x1b[0m
	\x1b[0;33;46m   $E[33;46m   \x1b[0m \x1b[0;1;33;46m  $E[1;33;46m  \x1b[0m \x1b[0;33;4;46m  $E[33;4;46m  \x1b[0m \x1b[0;1;33;4;46m $E[1;33;4;46m \x1b[0m \x1b[0;33;5;46m  $E[33;5;46m  \x1b[0m \x1b[0;1;33;5;46m $E[1;33;5;46m \x1b[0m
	\x1b[0;34;46m   $E[34;46m   \x1b[0m \x1b[0;1;34;46m  $E[1;34;46m  \x1b[0m \x1b[0;34;4;46m  $E[34;4;46m  \x1b[0m \x1b[0;1;34;4;46m $E[1;34;4;46m \x1b[0m \x1b[0;34;5;46m  $E[34;5;46m  \x1b[0m \x1b[0;1;34;5;46m $E[1;34;5;46m \x1b[0m
	\x1b[0;35;46m   $E[35;46m   \x1b[0m \x1b[0;1;35;46m  $E[1;35;46m  \x1b[0m \x1b[0;35;4;46m  $E[35;4;46m  \x1b[0m \x1b[0;1;35;4;46m $E[1;35;4;46m \x1b[0m \x1b[0;35;5;46m  $E[35;5;46m  \x1b[0m \x1b[0;1;35;5;46m $E[1;35;5;46m \x1b[0m
	\x1b[0;36;46m   $E[36;46m   \x1b[0m \x1b[0;1;36;46m  $E[1;36;46m  \x1b[0m \x1b[0;36;4;46m  $E[36;4;46m  \x1b[0m \x1b[0;1;36;4;46m $E[1;36;4;46m \x1b[0m \x1b[0;36;5;46m  $E[36;5;46m  \x1b[0m \x1b[0;1;36;5;46m $E[1;36;5;46m \x1b[0m
	\x1b[0;37;46m   $E[37;46m   \x1b[0m \x1b[0;1;37;46m  $E[1;37;46m  \x1b[0m \x1b[0;37;4;46m  $E[37;4;46m  \x1b[0m \x1b[0;1;37;4;46m $E[1;37;4;46m \x1b[0m \x1b[0;37;5;46m  $E[37;5;46m  \x1b[0m \x1b[0;1;37;5;46m $E[1;37;5;46m \x1b[0m
	\x1b[0;30;47m   $E[30;47m   \x1b[0m \x1b[0;1;30;47m  $E[1;30;47m  \x1b[0m \x1b[0;30;4;47m  $E[30;4;47m  \x1b[0m \x1b[0;1;30;4;47m $E[1;30;4;47m \x1b[0m \x1b[0;30;5;47m  $E[30;5;47m  \x1b[0m \x1b[0;1;30;5;47m $E[1;30;5;47m \x1b[0m
	\x1b[0;31;47m   $E[31;47m   \x1b[0m \x1b[0;1;31;47m  $E[1;31;47m  \x1b[0m \x1b[0;31;4;47m  $E[31;4;47m  \x1b[0m \x1b[0;1;31;4;47m $E[1;31;4;47m \x1b[0m \x1b[0;31;5;47m  $E[31;5;47m  \x1b[0m \x1b[0;1;31;5;47m $E[1;31;5;47m \x1b[0m
	\x1b[0;32;47m   $E[32;47m   \x1b[0m \x1b[0;1;32;47m  $E[1;32;47m  \x1b[0m \x1b[0;32;4;47m  $E[32;4;47m  \x1b[0m \x1b[0;1;32;4;47m $E[1;32;4;47m \x1b[0m \x1b[0;32;5;47m  $E[32;5;47m  \x1b[0m \x1b[0;1;32;5;47m $E[1;32;5;47m \x1b[0m
	\x1b[0;33;47m   $E[33;47m   \x1b[0m \x1b[0;1;33;47m  $E[1;33;47m  \x1b[0m \x1b[0;33;4;47m  $E[33;4;47m  \x1b[0m \x1b[0;1;33;4;47m $E[1;33;4;47m \x1b[0m \x1b[0;33;5;47m  $E[33;5;47m  \x1b[0m \x1b[0;1;33;5;47m $E[1;33;5;47m \x1b[0m
	\x1b[0;34;47m   $E[34;47m   \x1b[0m \x1b[0;1;34;47m  $E[1;34;47m  \x1b[0m \x1b[0;34;4;47m  $E[34;4;47m  \x1b[0m \x1b[0;1;34;4;47m $E[1;34;4;47m \x1b[0m \x1b[0;34;5;47m  $E[34;5;47m  \x1b[0m \x1b[0;1;34;5;47m $E[1;34;5;47m \x1b[0m
	\x1b[0;35;47m   $E[35;47m   \x1b[0m \x1b[0;1;35;47m  $E[1;35;47m  \x1b[0m \x1b[0;35;4;47m  $E[35;4;47m  \x1b[0m \x1b[0;1;35;4;47m $E[1;35;4;47m \x1b[0m \x1b[0;35;5;47m  $E[35;5;47m  \x1b[0m \x1b[0;1;35;5;47m $E[1;35;5;47m \x1b[0m
	\x1b[0;36;47m   $E[36;47m   \x1b[0m \x1b[0;1;36;47m  $E[1;36;47m  \x1b[0m \x1b[0;36;4;47m  $E[36;4;47m  \x1b[0m \x1b[0;1;36;4;47m $E[1;36;4;47m \x1b[0m \x1b[0;36;5;47m  $E[36;5;47m  \x1b[0m \x1b[0;1;36;5;47m $E[1;36;5;47m \x1b[0m
	\x1b[0;37;47m   $E[37;47m   \x1b[0m \x1b[0;1;37;47m  $E[1;37;47m  \x1b[0m \x1b[0;37;4;47m  $E[37;4;47m  \x1b[0m \x1b[0;1;37;4;47m $E[1;37;4;47m \x1b[0m \x1b[0;37;5;47m  $E[37;5;47m  \x1b[0m \x1b[0;1;37;5;47m $E[1;37;5;47m \x1b[0m`
