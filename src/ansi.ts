import { ANSI, isNumber, isPrintable, SGR } from "./code"
import { ColorMode, ContrastCache, createPalette, ensureContrastRatio, ThemeConfig, toCss, toRgb } from "./colors"

export interface Word {
	fgMode: ColorMode
	foreground?: string
	bgMode: ColorMode
	background?: string
	bold: boolean
	underline: boolean
	italic: boolean
	strike: boolean
	hidden: boolean
	value: string
}

export interface AnchorWord {
	params: Record<string, string>
	url: string
	words: Word[]
}

export interface Options {
	/** minimum contrast ratio: 1 - 21 (default: 3) */
	minimumContrastRatio?: number
	/** mode (default: inline) */
	mode?: "inline" | "class"
	/** user theme */
	theme?: ThemeConfig
}

// sdfsd<a>sdsd<span>sdfds</span></a>sdds

const defaultMinimumContrastRatio = 3

export interface Context {
	contrastCache: ContrastCache
	minimumContrastRatio: number
	mode: "inline" | "class"
	palette: ReturnType<typeof createPalette>
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

export function createContext({
	minimumContrastRatio = defaultMinimumContrastRatio,
	mode = "inline",
	theme,
}: Options = {}): Context {
	return {
		contrastCache: new ContrastCache(),
		minimumContrastRatio,
		mode,
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
	}
}

export function parseWithContext(ctx: Context, rawText: string) {
	const _words: Array<Word | AnchorWord> = []
	const buffer: number[] = []

	let a = 0
	let b = 0
	let words = _words
	let anchor: AnchorWord | undefined

	while (b < rawText.length) {
		const char = rawText.charCodeAt(b)
		if (isPrintable(char)) {
			buffer.push(char)
			b++
			continue
		}

		if (a < b) {
			words.push(makeWord(rawText.slice(a, b)))
			a = b
		}
		switch (char) {
			case ANSI.ESC: {
				const nextChar = rawText.charCodeAt(b + 1)
				switch (nextChar) {
					case ANSI.LeftSquareBracket:
						b = readCSI(b + 2)
						break
					case ANSI.RightSquareBracket:
						b = readOSC(b + 2)
						break
					default:
						b = b + 2
				}
				a = b
				break
			}
			case ANSI.CSI:
				b = readCSI(b + 1)
				a = b
				break
			case ANSI.OSC:
				b = readOSC(b + 1)
				a = b
				break
			default:
				b++
		}
	}

	if (a < b) {
		words.push(makeWord(rawText.slice(a, b)))
	}

	if (anchor) _words.push(anchor)

	return _words

	function makeWord(value: string): Word {
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

		if (fgMode === ColorMode.P256 && fgColor < 16) fgMode = ColorMode.P16
		if (bgMode === ColorMode.P256 && bgColor < 16) bgMode = ColorMode.P16

		const foreground =
			ctx.mode === "class" && fgMode !== ColorMode.RGB
				? getForegroundClass(fgMode, fgColor, ctx.inverse, ctx.bold)
				: getForegroundCss(bgMode, bgColor, fgMode, fgColor, ctx.inverse, ctx.bold)

		const background =
			ctx.mode === "class" && bgMode !== ColorMode.RGB
				? getBackgroundClass(bgMode, bgColor, ctx.inverse)
				: getBackgroundCss(bgMode, bgColor, ctx.inverse)

		const word: Word = {
			fgMode,
			foreground,
			bgMode,
			background,
			bold: ctx.bold || ctx.dim,
			underline: ctx.underline,
			italic: ctx.italic,
			strike: ctx.strike,
			hidden: ctx.hidden,
			value,
		}

		return word
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

	function getForegroundClass(
		fgColorMode: ColorMode,
		fgIndexOrRgb: number,
		inverse: boolean,
		bold: boolean,
	): string | undefined | never {
		switch (fgColorMode) {
			case ColorMode.P16:
			case ColorMode.P256:
				if (bold && fgIndexOrRgb < 8) fgIndexOrRgb += 8
				return `${fgIndexOrRgb}`
			case ColorMode.DEFAULT:
			default:
				if (inverse) return "default-inverse"
				return undefined
		}
	}

	function getBackgroundClass(
		bgColorMode: ColorMode,
		bgIndexOrRgb: number,
		inverse: boolean,
	): string | undefined | never {
		switch (bgColorMode) {
			case ColorMode.P16:
			case ColorMode.P256:
				return `${bgIndexOrRgb}`
			case ColorMode.DEFAULT:
			default:
				if (inverse) return "bg-inverse"
				return undefined
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

	function getNumber(a: number, b: number): number {
		let ans = 0
		for (let k = a; k < b; k++) ans = 10 * ans + rawText.charCodeAt(k) - ANSI._0
		return ans
	}

	/** @return last index */
	function readCSI(index: number): number {
		if (index >= rawText.length) return index

		// format: CSI memo # end
		// memo: <, =, ... or null
		// #: 1;2;3;4 ...
		// end: s, r, m, $p, ... (non-null)

		let a = index
		let b = index
		let memo: ANSI | null = ANSI.Undefined
		let invalid = false
		const valueIndices: number[] = []

		while (b < rawText.length) {
			const char = rawText.charCodeAt(b)
			if (!isPrintable(char)) return b

			if (Number.isNaN(memo)) {
				switch (char) {
					case ANSI.LessThan:
					case ANSI.Equal:
					case ANSI.GreaterThan:
					case ANSI.Question:
					case ANSI.SingleQuote:
					case ANSI.Exclamation:
						memo = char
						b++
						a = b
						break
					default:
						memo = null
				}
				continue
			}

			const e = end(char, b)
			if (e > 0) return e

			if (e === -2) {
				b++
				continue
			}

			eatNum()
			b++
			a = b
		}
		return b

		function eatNum() {
			if (a < b) valueIndices.push(a, b)
			else invalid = true
		}

		function end(lastChar: number, currentIndex: number): number {
			if (isNumber(lastChar)) {
				return -2
			}

			switch (memo) {
				case null:
					switch (lastChar) {
						case ANSI.m:
							eatNum()
							ctx.strike = false
							if (invalid) {
								ctx.fgIndexOrRgb = -1
								ctx.bgIndexOrRgb = -1
								ctx.fgMode = ColorMode.DEFAULT
								ctx.bgMode = ColorMode.DEFAULT
								ctx.bold = false
								ctx.dim = false
								ctx.italic = false
								ctx.underline = false
								ctx.inverse = false
								ctx.hidden = false
							} else {
								setAttribute(valueIndices)
							}
							return currentIndex + 1
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
						case ANSI.b: // case ANSI.c:
						case ANSI.d:
						case ANSI.e:
						case ANSI.f:
						case ANSI.g:
						case ANSI.h:
						case ANSI.i:
						case ANSI.j:
						case ANSI.k:
						case ANSI.n:
						case ANSI.r:
						case ANSI.s:
						case ANSI.t:
						case ANSI.u:
							// eatNum()
							return currentIndex + 1
						case ANSI.Space:
							switch (lastChar) {
								case ANSI.q:
									return currentIndex + 1
								default:
									return currentIndex
							}
						case ANSI.DoubleQuote:
							switch (lastChar) {
								case ANSI.p:
								case ANSI.q:
									return currentIndex + 1
								default:
									return currentIndex
							}
						case ANSI.Dollar:
							switch (lastChar) {
								case ANSI.p:
								case ANSI.z:
								case ANSI.LeftCurlyBracket:
								case ANSI.RightCurlyBracket:
								case ANSI.Tilde:
									return currentIndex + 1
								default:
									return currentIndex
							}
						case ANSI.SingleQuote:
							switch (lastChar) {
								case ANSI.w:
								case ANSI.z:
								case ANSI.LeftCurlyBracket:
									return currentIndex + 1
								default:
									return currentIndex
							}
					}
					break
				case ANSI.LessThan:
					switch (lastChar) {
						case ANSI.r:
						case ANSI.s:
						case ANSI.t:
							// eatNum()
							return currentIndex + 1
						default:
							return currentIndex
					}
				case ANSI.Equal:
					switch (lastChar) {
						case ANSI.c:
							// eatNum()
							return currentIndex + 1
						default:
							return currentIndex
					}
				case ANSI.GreaterThan:
					switch (lastChar) {
						case ANSI.c:
						case ANSI.J:
						case ANSI.K:
							// eatNum()
							return currentIndex + 1
						default:
							return currentIndex
					}
				case ANSI.Question:
					eatNum()
					switch (lastChar) {
						case ANSI.J: {
							const values: number[] = []
							for (let i = 0; i < valueIndices.length; i += 2) {
								values.push(getNumber(valueIndices[i], valueIndices[i + 1]))
							}
							const v = values[values.length - 1]
							if (v === 1 || v === 2) words.splice(0)
							return currentIndex + 1
						}
						case ANSI.K:
						case ANSI.h:
						case ANSI.i:
						case ANSI.l:
						case ANSI.n:
							return currentIndex + 1
						case ANSI.Dollar:
							if (rawText.charCodeAt(currentIndex) === ANSI.p) return currentIndex + 1
							return currentIndex
						default:
							return currentIndex
					}
				case ANSI.SingleQuote:
					if (lastChar === ANSI.LeftCurlyBracket) return currentIndex + 1
					return currentIndex
				case ANSI.Exclamation:
					if (lastChar === ANSI.p) return currentIndex + 1
					return currentIndex
			}
			return -1
		}
	}

	/** @return last index */
	function readOSC(index: number): number {
		// format: OSC 8 ; params ; URI ST
		// params format: id=xyz123:foo=bar:baz=quux
		if (index >= rawText.length) return index
		let mode: number = Number.NaN
		let anchorMode = Number.NaN
		let params: Record<string, string> = {}

		let a = index
		let b = index
		while (b < rawText.length) {
			const char = rawText.charCodeAt(b)
			if (char === ANSI.ST || char === ANSI.BEL) {
				if (anchor) {
					_words.push(anchor)
					anchor = undefined
					words = _words
				}
				if (anchorMode === 1) {
					const url = rawText.slice(a, b)
					if (url) {
						anchor = { url, params, words: [] }
						words = anchor.words
					}
				}
				return b + 1
			}
			if (char === ANSI.ESC && rawText.charCodeAt(b + 1) === ANSI.Backslash) {
				if (anchor) {
					_words.push(anchor)
					anchor = undefined
					words = _words
				}
				if (anchorMode === 1) {
					const url = rawText.slice(a, b)
					if (url) {
						anchor = { url, params, words: [] }
						words = anchor.words
					}
				}
				return b + 2
			}
			if (!isPrintable(char)) return b
			if (char !== ANSI.SemiColon) {
				b++
				continue
			}

			if (Number.isNaN(mode)) {
				const value = parseInt(rawText.slice(a, b))
				if (Number.isNaN(value)) mode = -1
				else mode = value
				b++
				a = b
				continue
			}

			switch (mode) {
				case 8:
					if (char !== ANSI.SemiColon) {
						b++
						continue
					}
					if (Number.isNaN(anchorMode)) {
						params = getMap(rawText.slice(a, b))
						anchorMode = 1
						b++
						a = b
						continue
					}
					break
				default:
					b++
					break
			}
		}
		return b

		function getMap(value: string) {
			const result: Record<string, string> = {}
			value.split(":").forEach(val => {
				const i = val.indexOf("=")
				if (i > 0) {
					result[val.slice(0, i)] = val.slice(i + 1)
				}
			})
			return result
		}
	}

	function setAttribute(attributes: number[]) {
		if (attributes.length === 0) {
			ctx.fgIndexOrRgb = -1
			ctx.bgIndexOrRgb = -1
			ctx.fgMode = ColorMode.DEFAULT
			ctx.bgMode = ColorMode.DEFAULT
			ctx.bold = false
			ctx.dim = false
			ctx.italic = false
			ctx.underline = false
			ctx.inverse = false
			ctx.hidden = false
			return
		}
		const attrs: number[] = []
		for (let i = 0; i < attributes.length; i += 2) {
			attrs.push(getNumber(attributes[i], attributes[i + 1]))
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
					ctx.dim = false
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
					ctx.dim = true
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
