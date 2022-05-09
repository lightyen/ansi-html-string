import { ANSI, isNumber, isPrintable, SGR } from "./code"
import { ColorMode, ContrastCache, createPalette, ensureContrastRatio, ThemeConfig, toCss, toRgb } from "./colors"

export interface Word {
	value: string
	foreground?: string
	background?: string
	bold: boolean
	underline: boolean
	italic: boolean
	strike: boolean
	hidden: boolean
}

export interface Options {
	/** minimum contrast ratio: 1 - 21 (default: 3) */
	minimumContrastRatio?: number
	/** user theme */
	theme?: ThemeConfig
}

const defaultMinimumContrastRatio = 3

export function createContext({ minimumContrastRatio, theme }: Options = {}) {
	return {
		contrastCache: new ContrastCache(),
		minimumContrastRatio: minimumContrastRatio ?? defaultMinimumContrastRatio,
		palette: createPalette(theme),
		fgIndexOrRgb: -1,
		bgIndexOrRgb: -1,
		fgMode: ColorMode.DEFAULT,
		bgMode: ColorMode.DEFAULT,
		bold: false,
		underline: false,
		inverse: false,
		italic: false,
		strike: false,
		hidden: false,
	}
}

export type Context = ReturnType<typeof createContext>

export function parseWithContext(ctx: Context, rawText: string) {
	const words: Word[] = []
	const buffer: number[] = []

	let a = 0,
		b = 0
	while (b < rawText.length) {
		const char = rawText.charCodeAt(b)
		if (isPrintable(char)) {
			buffer.push(char)
			b++
			continue
		}

		if (a < b) {
			addWord(rawText.slice(a, b))
			a = b
		}
		switch (char) {
			case ANSI.ESC:
				if (rawText.charCodeAt(b + 1) === ANSI.LeftSquareBracket) {
					b = setContext(b + 2)
				} else {
					b = b + 2 // skip
				}
				a = b
				break
			case ANSI.CSI:
				b = setContext(b + 1)
				a = b
				break
			default:
				b++
		}
	}

	if (a < b) addWord(rawText.slice(a, b))

	return words

	function addWord(value: string) {
		let fgColor = ctx.fgIndexOrRgb
		let bgColor = ctx.bgIndexOrRgb
		let fgMode = ctx.fgMode
		let bgMode = ctx.bgMode

		if (ctx.inverse) {
			let tmp = fgColor
			fgColor = bgColor
			bgColor = tmp
			tmp = fgMode
			fgMode = bgMode
			bgMode = tmp
		}

		const w: Word = {
			value,
			foreground: getForegroundCss(bgMode, bgColor, fgMode, fgColor, ctx.inverse, ctx.bold),
			background: getBackgroundCss(bgMode, bgColor, ctx.inverse),
			bold: ctx.bold,
			underline: ctx.underline,
			italic: ctx.italic,
			strike: ctx.strike,
			hidden: ctx.hidden,
		}

		words.push(w)
	}

	function getForegroundCss(
		bgColorMode: ColorMode,
		bgIndexOrRgb: number,
		fgColorMode: ColorMode,
		fgIndexOrRgb: number,
		inverse: boolean,
		bold: boolean,
	): string | undefined | never {
		const minimumContrastCss = getMinimumContrastCss(
			bgColorMode,
			bgIndexOrRgb,
			fgColorMode,
			fgIndexOrRgb,
			inverse,
			bold,
		)
		if (minimumContrastCss) return minimumContrastCss
		return _getForegroundCss(fgColorMode, fgIndexOrRgb, inverse, bold)
	}

	function getBackgroundCss(
		bgColorMode: ColorMode,
		bgIndexOrRgb: number,
		inverse: boolean,
	): string | undefined | never {
		switch (bgColorMode) {
			case ColorMode.P16:
			case ColorMode.P256: {
				const color = ctx.palette.colors.at(bgIndexOrRgb)
				if (!color) throw Error(`background is not defined: ${bgIndexOrRgb}`)
				return color.css
			}
			case ColorMode.RGB:
				return toCss(bgIndexOrRgb)
			case ColorMode.DEFAULT:
			default:
				if (inverse) return ctx.palette.foreground?.css
				return ctx.palette.background?.css
		}
	}

	function getMinimumContrastCss(
		bgColorMode: ColorMode,
		bgIndexOrRgb: number,
		fgColorMode: ColorMode,
		fgIndexOrRgb: number,
		inverse: boolean,
		bold: boolean,
	) {
		if (ctx.minimumContrastRatio <= 1) return undefined
		const bg = (bgIndexOrRgb << 8) | bgColorMode
		const fg = (fgIndexOrRgb << 8) | fgColorMode
		const adjustedColor = ctx.contrastCache.getCss(bg, fg)
		if (adjustedColor !== undefined) return adjustedColor || undefined

		const fgRgb = getForegroundRgb(fgColorMode, fgIndexOrRgb, inverse, bold)
		const bgRgb = getBackgroundRgb(bgColorMode, bgIndexOrRgb, inverse)

		if (fgRgb != undefined && bgRgb != undefined) {
			const rgb = ensureContrastRatio(fgRgb, bgRgb, ctx.minimumContrastRatio)
			if (!rgb) {
				ctx.contrastCache.setCss(bg, fg, null)
				return undefined
			}

			const css = toCss(rgb)
			ctx.contrastCache.setCss(bg, fg, css)
			return css
		}

		return undefined
	}

	function _getForegroundCss(
		fgColorMode: ColorMode,
		fgIndexOrRgb: number,
		inverse: boolean,
		bold: boolean,
	): string | undefined | never {
		switch (fgColorMode) {
			case ColorMode.P16:
			case ColorMode.P256: {
				if (bold && fgIndexOrRgb < 8) fgIndexOrRgb += 8
				const color = ctx.palette.colors.at(fgIndexOrRgb)
				if (!color) throw Error(`foreground is not defined: ${fgIndexOrRgb}`)
				return color.css
			}
			case ColorMode.RGB:
				return toCss(fgIndexOrRgb)
			case ColorMode.DEFAULT:
			default:
				if (inverse) return ctx.palette.background?.css
				return ctx.palette.foreground?.css
		}
	}

	function getForegroundRgb(
		fgColorMode: ColorMode,
		fgIndexOrRgb: number,
		inverse: boolean,
		bold: boolean,
	): number | undefined | never {
		switch (fgColorMode) {
			case ColorMode.P16:
			case ColorMode.P256: {
				if (bold && fgIndexOrRgb < 8) fgIndexOrRgb += 8
				const color = ctx.palette.colors.at(fgIndexOrRgb)
				if (!color) throw Error(`foreground is not defined: ${fgIndexOrRgb}`)
				return color.rgb
			}
			case ColorMode.RGB:
				return fgIndexOrRgb
			case ColorMode.DEFAULT:
			default:
				if (inverse) return ctx.palette.background?.rgb
				return ctx.palette.foreground?.rgb
		}
	}

	function getBackgroundRgb(bgColorMode: number, bgIndexOrRgb: number, inverse: boolean): number | undefined | never {
		switch (bgColorMode) {
			case ColorMode.P16:
			case ColorMode.P256: {
				const color = ctx.palette.colors.at(bgIndexOrRgb)
				if (!color) throw Error(`background is not defined: ${bgIndexOrRgb}`)
				return color.rgb
			}
			case ColorMode.RGB:
				return bgIndexOrRgb
			case ColorMode.DEFAULT:
			default:
				if (inverse) return ctx.palette.foreground?.rgb
				return ctx.palette.background?.rgb
		}
	}

	function setContext(index: number): number {
		if (index >= rawText.length) return index
		const n: number[] = []
		let a = index
		let b = index
		let m: ANSI = Number.NaN

		while (b < rawText.length) {
			const char = rawText.charCodeAt(b)

			if (!isPrintable(char)) return b

			if (isNumber(char)) {
				b++
				m = Number.NaN
				continue
			}

			if (a < b) {
				n.push(a, b)
			}

			b++
			a = b

			switch (m) {
				case ANSI.LessThan:
					if (char === ANSI.t) return b
					return b - 1
				case ANSI.Equal:
					if (char === ANSI.c) return b
					return b - 1
				case ANSI.GreaterThan:
					switch (char) {
						case ANSI.J:
						case ANSI.K:
							return b
						default:
							return b - 1
					}
				case ANSI.Question:
					switch (char) {
						case ANSI.J:
						case ANSI.K:
						case ANSI.h:
						case ANSI.i:
						case ANSI.l:
						case ANSI.n:
							return b
						case ANSI.Dollar:
							if (rawText.charCodeAt(b) === ANSI.p) return b
							return b - 1
						default:
							return b - 1
					}
				case ANSI.Exclamation:
					if (char === ANSI.p) return b
					return b - 1
			}

			const nextChar = rawText.charCodeAt(b)
			switch (char) {
				case ANSI.SemiColon:
					m = ANSI.SemiColon
					continue
				case ANSI.m:
					ctx.strike = false
					if (m !== ANSI.SemiColon) setAttribute(n)
					else {
						ctx.fgIndexOrRgb = -1
						ctx.bgIndexOrRgb = -1
						ctx.fgMode = ColorMode.DEFAULT
						ctx.bgMode = ColorMode.DEFAULT
						ctx.bold = false
						ctx.italic = false
						ctx.underline = false
						ctx.inverse = false
						ctx.hidden = false
					}
					break
				case ANSI.At:
				case ANSI.A:
				case ANSI.B:
				case ANSI.C:
				case ANSI.D:
				case ANSI.E:
				case ANSI.F:
				case ANSI.G:
				case ANSI.H:
				case ANSI.I:
				case ANSI.J:
				case ANSI.K:
				case ANSI.L:
				case ANSI.M:
				case ANSI.P:
				case ANSI.S:
				case ANSI.T:
				case ANSI.X:
				case ANSI.Z:
				case ANSI.Backstick:
				case ANSI.a:
				case ANSI.b:
				case ANSI.c:
				case ANSI.d:
				case ANSI.e:
				case ANSI.f:
				case ANSI.g:
				case ANSI.h:
				case ANSI.i:
				case ANSI.j:
				case ANSI.k:
				case ANSI.l:
				case ANSI.n:
				case ANSI.r:
				case ANSI.s:
				case ANSI.t:
				case ANSI.u:
					return b
				case ANSI.LessThan:
					if (nextChar === ANSI.r) return b + 1
					if (nextChar === ANSI.s) return b + 1
					m = ANSI.LessThan
					if (isNumber(nextChar)) continue
					break
				case ANSI.GreaterThan:
					m = ANSI.GreaterThan
					if (isNumber(nextChar)) continue
					break
				case ANSI.Question:
					m = ANSI.Question
					if (isNumber(nextChar)) continue
					break
				case ANSI.Space:
					if (nextChar === ANSI.q) return b + 1
					break
				case ANSI.DoubleQuote:
					if (nextChar === ANSI.p) return b + 1
					if (nextChar === ANSI.q) return b + 1
					break
				case ANSI.Dollar:
					if (nextChar === ANSI.p) return b + 1
					if (nextChar === ANSI.z) return b + 1
					if (nextChar === ANSI.LeftCurlyBracket) return b + 1
					if (nextChar === ANSI.RightCurlyBracket) return b + 1
					if (nextChar === ANSI.Tilde) return b + 1
					break
				case ANSI.SingleQuote:
					if (nextChar === ANSI.w) return b + 1
					if (nextChar === ANSI.z) return b + 1
					if (nextChar === ANSI.LeftCurlyBracket) return b + 1
					if (nextChar === ANSI.VerticalBar) return b + 1
					break
			}
			return b
		}

		return b
	}

	function setAttribute(attributes: number[]) {
		if (attributes.length === 0) {
			ctx.fgIndexOrRgb = -1
			ctx.bgIndexOrRgb = -1
			ctx.fgMode = ColorMode.DEFAULT
			ctx.bgMode = ColorMode.DEFAULT
			ctx.bold = false
			ctx.italic = false
			ctx.underline = false
			ctx.inverse = false
			ctx.hidden = false
			return
		}
		const attrs: number[] = []
		for (let i = 0; i < attributes.length; i += 2) {
			const a = attributes[i]
			const b = attributes[i + 1]
			let code = 0
			for (let k = a; k < b; k++) code = 10 * code + rawText.charCodeAt(k) - ANSI._0
			attrs.push(code)
		}

		for (let i = 0; i < attrs.length; i++) {
			const code = attrs[i]
			switch (code) {
				case SGR.Reset:
					ctx.fgIndexOrRgb = -1
					ctx.bgIndexOrRgb = -1
					ctx.fgMode = ColorMode.DEFAULT
					ctx.bgMode = ColorMode.DEFAULT
					ctx.bold = false
					ctx.italic = false
					ctx.underline = false
					ctx.inverse = false
					ctx.hidden = false
					ctx.strike = false
					break
				case SGR.Bold:
					ctx.bold = true
					break
				case SGR.Dim:
					// TODO: change contrast
					break
				case SGR.Italic:
					ctx.italic = true
					break
				case SGR.Underline:
					ctx.underline = true
					break
				case SGR.Inverse:
					ctx.inverse = true
					break
				case SGR.Hidden:
					ctx.hidden = true
					break
				case SGR.Strike:
					ctx.strike = true
					break
				case SGR.SlowBlink:
					break
				case SGR.RapidBlink:
					break
			}
			if (code >= SGR.FgBlack && code <= SGR.FgWhite) {
				ctx.fgIndexOrRgb = code - SGR.FgBlack
				ctx.fgMode = ColorMode.P16
			} else if (code >= SGR.BgBlack && code <= SGR.BgWhite) {
				ctx.bgIndexOrRgb = code - SGR.BgBlack
				ctx.bgMode = ColorMode.P16
			} else if (code >= SGR.BrightFgGray && code <= SGR.BrightFgWhite) {
				ctx.fgIndexOrRgb = 8 + code - SGR.BrightFgGray
				ctx.fgMode = ColorMode.P16
			} else if (code >= SGR.BrightBgGray && code <= SGR.BrightBgWhite) {
				ctx.bgIndexOrRgb = 8 + code - SGR.BrightBgGray
				ctx.bgMode = ColorMode.P16
			} else if (code === SGR.FgReset) {
				ctx.fgIndexOrRgb = -1
				ctx.fgMode = ColorMode.DEFAULT
			} else if (code === SGR.BgReset) {
				ctx.bgIndexOrRgb = -1
				ctx.bgMode = ColorMode.DEFAULT
			} else if (code === SGR.FgExt) {
				if (attrs[i + 1] === 5) {
					if (i + 2 >= attrs.length) break
					ctx.fgIndexOrRgb = attrs[i + 2]
					ctx.fgMode = ColorMode.P256
					i += 2
				} else if (attrs[i + 1] === 2) {
					if (i + 4 >= attrs.length) break
					const r = attrs[i + 2]
					const g = attrs[i + 3]
					const b = attrs[i + 4]
					ctx.fgIndexOrRgb = toRgb(r, g, b)
					ctx.fgMode = ColorMode.RGB
					i += 4
				}
			} else if (code === SGR.BgExt) {
				if (attrs[i + 1] === 5) {
					if (i + 2 >= attrs.length) break
					ctx.bgIndexOrRgb = attrs[i + 2]
					ctx.bgMode = ColorMode.P256
					i += 2
				} else if (attrs[i + 1] === 2) {
					if (i + 4 >= attrs.length) break
					const r = attrs[i + 2]
					const g = attrs[i + 3]
					const b = attrs[i + 4]
					ctx.bgIndexOrRgb = toRgb(r, g, b)
					ctx.bgMode = ColorMode.RGB
					i += 4
				}
			}
		}
	}
}
