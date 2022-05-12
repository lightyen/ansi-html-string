import { ASCII, isNumber, SGR } from "./code"
import { ColorMode, ContrastCache, createPalette, ensureContrastRatio, ThemeConfig, toCss, toRgb } from "./colors"

export interface Attributes {
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

export interface Word {
	fgMode: ColorMode
	foreground?: string
	bgMode: ColorMode
	background?: string
	bold: boolean
	dim: boolean
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

export function isAnchorWord(w: Word | AnchorWord | undefined): w is AnchorWord {
	return Object.prototype.hasOwnProperty.call(w, "words")
}

export interface Options {
	/** minimum contrast ratio: 1 - 21 (default: 3) */
	minimumContrastRatio?: number
	/** mode (default: inline) */
	mode?: "inline" | "class"
	/** user theme */
	theme?: ThemeConfig
}

export const defaultMinimumContrastRatio = 3

export interface Context extends Attributes {
	contrastCache: ContrastCache
	minimumContrastRatio: number
	mode: "inline" | "class"
	palette: ReturnType<typeof createPalette>
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
	let a = 0
	let b = 0
	let words = _words
	let anchor: AnchorWord | undefined
	while (b < rawText.length) {
		const char = rawText.charCodeAt(b)
		if (char === ASCII.ESC) {
			pushWord()
			const nextChar = rawText.charCodeAt(b + 1)
			if (nextChar === ASCII.LeftSquareBracket) {
				b = readCSI(b + 2)
			} else if (nextChar === ASCII.RightSquareBracket) {
				b = readOSC(b + 2)
			} else {
				b = other(b + 1)
			}
			a = b
			continue
		} else if (char === ASCII.CSI) {
			pushWord()
			b = readCSI(b + 1)
			a = b
			continue
		} else if (char === ASCII.OSC) {
			pushWord()
			b = readOSC(b + 1)
			a = b
			continue
		} else {
			switch (char) {
				case ASCII.BS:
				case ASCII.DEL: {
					pushWord()
					a = b
					let lastWord = words.at(words.length - 1)
					lastWord = isAnchorWord(lastWord) ? lastWord.words[lastWord.words.length - 1] : lastWord
					if (lastWord) lastWord.value = lastWord.value.slice(0, -1)
					break
				}
				case ASCII.NUL:
				case ASCII.HT:
				case ASCII.LF:
					break
				default:
					if (char < 0x1f || char === ASCII.DEL) {
						pushWord()
						a = b + 1
					}
					break
			}
		}

		b++
	}
	pushWord()
	if (anchor) _words.push(anchor)
	return _words

	function pushWord() {
		if (a < b) words.push(makeWord(rawText.slice(a, b)))
	}

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
			bold: ctx.bold,
			dim: ctx.dim,
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
				if (inverse) return "inverse"
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
				if (inverse) return "inverse"
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
		for (let k = a; k < b; k++) {
			ans = 10 * ans + rawText.charCodeAt(k) - ASCII._0
		}
		return ans
	}

	/** @return last index */
	function readCSI(index: number): number {
		if (index >= rawText.length) return index
		let b = index

		while (b < rawText.length) {
			const char = rawText.charCodeAt(b)
			if (isEnd(char)) {
				handle(index, b + 1)
				b++
				break
			}
			b++
		}
		return b

		function isEnd(char: number) {
			return char < 0x20 || char >= 0x40
		}

		function handle(a: number, b: number): void {
			b--
			const lastChar = rawText.charCodeAt(b)
			switch (lastChar) {
				case ASCII.m:
					{
						const attrs: number[] = []
						let i = a
						while (i < b) {
							const c = rawText.charCodeAt(i)
							if (c === ASCII.SemiColon) {
								attrs.push(getNumber(a, i))
								i++
								a = i
							} else if (isNumber(c)) {
								i++
							} else {
								// failed
								return
							}
						}
						attrs.push(getNumber(a, i))
						setAttributes(attrs)
					}
					break
				case ASCII.J:
					{
						if (rawText.charCodeAt(a) === ASCII.Question) a++
						let i = a
						while (i < b) {
							const c = rawText.charCodeAt(i)
							if (isNumber(c)) {
								i++
							} else {
								// failed
								return
							}
						}
						const v = getNumber(a, i)
						if (v === 1 || v === 2) words.splice(0)
					}

					break
			}
		}

		function resetAttributes() {
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
		}

		function setAttributes(attrs: number[]) {
			for (let i = 0; i < attrs.length; i++) {
				const code = attrs[i]
				switch (code) {
					case SGR.Reset:
						resetAttributes()
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
					case SGR.RapidBlink:
						// undefined
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
						ctx.fgMode = ColorMode.P256
						if (i + 2 >= attrs.length) {
							ctx.fgIndexOrRgb = 0
							break
						}
						ctx.fgIndexOrRgb = attrs[i + 2]
						i += 2
					} else if (attrs[i + 1] === 2) {
						ctx.fgMode = ColorMode.RGB
						if (i + 4 >= attrs.length) {
							ctx.fgIndexOrRgb = 0
							break
						}
						const r = attrs[i + 2]
						const g = attrs[i + 3]
						const b = attrs[i + 4]
						ctx.fgIndexOrRgb = toRgb(r, g, b)

						i += 4
					}
				} else if (code === SGR.BgExt) {
					if (attrs[i + 1] === 5) {
						ctx.bgMode = ColorMode.P256
						if (i + 2 >= attrs.length) {
							ctx.bgIndexOrRgb = 0
							break
						}
						ctx.bgIndexOrRgb = attrs[i + 2]
						i += 2
					} else if (attrs[i + 1] === 2) {
						ctx.bgMode = ColorMode.RGB
						if (i + 4 >= attrs.length) {
							ctx.bgIndexOrRgb = 0
							break
						}
						const r = attrs[i + 2]
						const g = attrs[i + 3]
						const b = attrs[i + 4]
						ctx.bgIndexOrRgb = toRgb(r, g, b)
						i += 4
					}
				}
			}
		}
	}

	/** @return last index */
	function readOSC(index: number): number {
		// format: OSC 8 ; params ; URI ST
		// params format: id=xyz123:foo=bar:baz=quux
		if (index >= rawText.length) return index
		let mode: number = Number.NaN
		let state = 0
		let params: Record<string, string> = {}
		let a = index
		let b = index
		while (b < rawText.length) {
			const char = rawText.charCodeAt(b)
			if (char === ASCII.ST || char === ASCII.BEL) {
				addAnchor()
				b = b + 1
				break
			}
			if (char === ASCII.ESC && rawText.charCodeAt(b + 1) === ASCII.Backslash) {
				addAnchor()
				b = b + 2
				break
			}
			if (char !== ASCII.SemiColon) {
				b++
				continue
			}
			if (Number.isNaN(mode)) {
				mode = getNumber(a, b)
				b++
				a = b
				continue
			}

			if (mode === 8) {
				if (state === 0) {
					params = getMap(rawText.slice(a, b))
					state = 1
					b++
					a = b
					continue
				}

				// failed
				state = 2

				b++
				a = b
				continue
			}

			b++
		}

		return b

		function addAnchor() {
			if (anchor) {
				_words.push(anchor)
				anchor = undefined
				words = _words
			}
			if (state === 1 && a < b) {
				const url = rawText.slice(a, b)
				anchor = { url, params, words: [] }
				words = anchor.words
			}
		}

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

	/** @return last index */
	function other(index: number): number {
		if (index >= rawText.length) return index
		let b = index
		while (b < rawText.length) {
			const char = rawText.charCodeAt(b)
			if (isEnd(char)) {
				b++
				break
			}
			b++
		}
		return b

		function isEnd(char: number) {
			return true
		}
	}
}
