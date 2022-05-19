//  reset, bold, reverse, underline, strike, italic, dark, faint, blink, concealed

export enum ColorMode {
	DEFAULT,
	P16,
	P256,
	RGB,
}

export class ContrastCache {
	private _rgb: { [bg: number]: { [fg: number]: string | null | undefined } | undefined } = {}

	public clear(): void {
		this._rgb = {}
	}

	public setCss(bg: number, fg: number, value: string | null) {
		const m = this._rgb[bg]
		if (!m) {
			this._rgb[bg] = { [fg]: value }
		} else {
			m[fg] = value
		}
	}

	public getCss(bg: number, fg: number) {
		const m = this._rgb[bg]
		if (!m) return undefined
		return m[fg]
	}
}

export function toCss(rgb: number): string {
	return "#" + rgb.toString(16).padStart(6, "0")
}

export function toRgb(r: number, g: number, b: number): number {
	return (r << 16) | (g << 8) | b
}

export function relativeLuminance(rgb: number) {
	const r = (rgb >> 16) & 0xff
	const g = (rgb >> 8) & 0xff
	const b = rgb & 0xff
	return _relativeLuminance(r, g, b)
}

// https://www.w3.org/TR/WCAG20/#relativeluminancedef
function _relativeLuminance(r: number, g: number, b: number) {
	r /= 255
	g /= 255
	b /= 255
	r = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4)
	g = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4)
	b = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4)
	return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** @return rgba */
export function blend(fg_rgba: number, bg_rgba: number): number {
	const alpha = (fg_rgba & 0xff) / 255
	if (alpha >= 1) return fg_rgba

	const fgR = (fg_rgba >> 24) & 0xff
	const fgG = (fg_rgba >> 16) & 0xff
	const fgB = (fg_rgba >> 8) & 0xff
	const bgR = (bg_rgba >> 24) & 0xff
	const bgG = (bg_rgba >> 16) & 0xff
	const bgB = (bg_rgba >> 8) & 0xff
	const bg_alpha = (bg_rgba & 0xff) / 255

	const r = Math.round(fgR * alpha + bgR * (1 - alpha) * bg_alpha)
	const g = Math.round(fgG * alpha + bgG * (1 - alpha) * bg_alpha)
	const b = Math.round(fgB * alpha + bgB * (1 - alpha) * bg_alpha)
	const a = alpha + (1 - alpha) * bg_alpha
	return toRgba(r, g, b, a)
	function toRgba(r: number, g: number, b: number, a = 0xff): number {
		return (r << 24) | (g << 16) | (b << 8) | a
	}
}

export function contrastRatio(l1: number, l2: number) {
	if (l1 < l2) return (l2 + 0.05) / (l1 + 0.05)
	return (l1 + 0.05) / (l2 + 0.05)
}

export function ensureContrastRatio(fg_rgb: number, bg_rgb: number, ratio: number): number | undefined {
	const fgL = relativeLuminance(fg_rgb)
	const bgL = relativeLuminance(bg_rgb)
	const r = contrastRatio(fgL, bgL)
	if (r < ratio) {
		if (fgL < bgL) return reduceLuminance(fg_rgb, bg_rgb, ratio)
		return increaseLuminance(fg_rgb, bg_rgb, ratio)
	}
	return undefined
}

export function reduceLuminance(fg_rgb: number, bg_rgb: number, ratio: number): number {
	const bgR = (bg_rgb >> 16) & 0xff
	const bgG = (bg_rgb >> 8) & 0xff
	const bgB = bg_rgb & 0xff
	let fgR = (fg_rgb >> 16) & 0xff
	let fgG = (fg_rgb >> 8) & 0xff
	let fgB = fg_rgb & 0xff
	const bgL = _relativeLuminance(bgR, bgG, bgB)
	const p = 0.1
	let r = contrastRatio(_relativeLuminance(fgR, fgB, fgG), bgL)
	while (r < ratio && (fgR > 0 || fgG > 0 || fgB > 0)) {
		fgR = fgR - Math.max(0, Math.ceil(fgR * p))
		fgG = fgG - Math.max(0, Math.ceil(fgG * p))
		fgB = fgB - Math.max(0, Math.ceil(fgB * p))
		r = contrastRatio(_relativeLuminance(fgR, fgB, fgG), bgL)
	}
	return (fgR << 16) | (fgG << 8) | fgB
}

export function increaseLuminance(fg_rgb: number, bg_rgb: number, ratio: number): number {
	const bgR = (bg_rgb >> 16) & 0xff
	const bgG = (bg_rgb >> 8) & 0xff
	const bgB = bg_rgb & 0xff
	let fgR = (fg_rgb >> 16) & 0xff
	let fgG = (fg_rgb >> 8) & 0xff
	let fgB = fg_rgb & 0xff
	const bgL = _relativeLuminance(bgR, bgG, bgB)
	const p = 0.1
	let r = contrastRatio(_relativeLuminance(fgR, fgB, fgG), bgL)
	while (r < ratio && (fgR < 0xff || fgG < 0xff || fgB < 0xff)) {
		fgR = Math.min(0xff, fgR + Math.ceil((255 - fgR) * p))
		fgG = Math.min(0xff, fgG + Math.ceil((255 - fgG) * p))
		fgB = Math.min(0xff, fgB + Math.ceil((255 - fgB) * p))
		r = contrastRatio(_relativeLuminance(fgR, fgB, fgG), bgL)
	}
	return (fgR << 16) | (fgG << 8) | fgB
}

const _colors: string[] = [
	// standard colors
	"#3f4451", // 30
	"#e05561", // 31
	"#8cc265", // 32
	"#d18f52", // 33
	"#4aa5f0", // 34
	"#c162de", // 35
	"#42b3c2", // 36
	"#e6e6e6", // 37
	// bright colors
	"#4f5666", // 90
	"#ff616e", // 91
	"#a5e075", // 92
	"#f0a45d", // 93
	"#4dc4ff", // 94
	"#de73ff", // 95
	"#4cd1e0", // 96
	"#d7dae0", // 97
	// 256-colors
	"#000000",
	"#00005f",
	"#000087",
	"#0000af",
	"#0000d7",
	"#0000ff",
	"#005f00",
	"#005f5f",
	"#005f87",
	"#005faf",
	"#005fd7",
	"#005fff",
	"#008700",
	"#00875f",
	"#008787",
	"#0087af",
	"#0087d7",
	"#0087ff",
	"#00af00",
	"#00af5f",
	"#00af87",
	"#00afaf",
	"#00afd7",
	"#00afff",
	"#00d700",
	"#00d75f",
	"#00d787",
	"#00d7af",
	"#00d7d7",
	"#00d7ff",
	"#00ff00",
	"#00ff5f",
	"#00ff87",
	"#00ffaf",
	"#00ffd7",
	"#00ffff",
	"#5f0000",
	"#5f005f",
	"#5f0087",
	"#5f00af",
	"#5f00d7",
	"#5f00ff",
	"#5f5f00",
	"#5f5f5f",
	"#5f5f87",
	"#5f5faf",
	"#5f5fd7",
	"#5f5fff",
	"#5f8700",
	"#5f875f",
	"#5f8787",
	"#5f87af",
	"#5f87d7",
	"#5f87ff",
	"#5faf00",
	"#5faf5f",
	"#5faf87",
	"#5fafaf",
	"#5fafd7",
	"#5fafff",
	"#5fd700",
	"#5fd75f",
	"#5fd787",
	"#5fd7af",
	"#5fd7d7",
	"#5fd7ff",
	"#5fff00",
	"#5fff5f",
	"#5fff87",
	"#5fffaf",
	"#5fffd7",
	"#5fffff",
	"#870000",
	"#87005f",
	"#870087",
	"#8700af",
	"#8700d7",
	"#8700ff",
	"#875f00",
	"#875f5f",
	"#875f87",
	"#875faf",
	"#875fd7",
	"#875fff",
	"#878700",
	"#87875f",
	"#878787",
	"#8787af",
	"#8787d7",
	"#8787ff",
	"#87af00",
	"#87af5f",
	"#87af87",
	"#87afaf",
	"#87afd7",
	"#87afff",
	"#87d700",
	"#87d75f",
	"#87d787",
	"#87d7af",
	"#87d7d7",
	"#87d7ff",
	"#87ff00",
	"#87ff5f",
	"#87ff87",
	"#87ffaf",
	"#87ffd7",
	"#87ffff",
	"#af0000",
	"#af005f",
	"#af0087",
	"#af00af",
	"#af00d7",
	"#af00ff",
	"#af5f00",
	"#af5f5f",
	"#af5f87",
	"#af5faf",
	"#af5fd7",
	"#af5fff",
	"#af8700",
	"#af875f",
	"#af8787",
	"#af87af",
	"#af87d7",
	"#af87ff",
	"#afaf00",
	"#afaf5f",
	"#afaf87",
	"#afafaf",
	"#afafd7",
	"#afafff",
	"#afd700",
	"#afd75f",
	"#afd787",
	"#afd7af",
	"#afd7d7",
	"#afd7ff",
	"#afff00",
	"#afff5f",
	"#afff87",
	"#afffaf",
	"#afffd7",
	"#afffff",
	"#d70000",
	"#d7005f",
	"#d70087",
	"#d700af",
	"#d700d7",
	"#d700ff",
	"#d75f00",
	"#d75f5f",
	"#d75f87",
	"#d75faf",
	"#d75fd7",
	"#d75fff",
	"#d78700",
	"#d7875f",
	"#d78787",
	"#d787af",
	"#d787d7",
	"#d787ff",
	"#d7af00",
	"#d7af5f",
	"#d7af87",
	"#d7afaf",
	"#d7afd7",
	"#d7afff",
	"#d7d700",
	"#d7d75f",
	"#d7d787",
	"#d7d7af",
	"#d7d7d7",
	"#d7d7ff",
	"#d7ff00",
	"#d7ff5f",
	"#d7ff87",
	"#d7ffaf",
	"#d7ffd7",
	"#d7ffff",
	"#ff0000",
	"#ff005f",
	"#ff0087",
	"#ff00af",
	"#ff00d7",
	"#ff00ff",
	"#ff5f00",
	"#ff5f5f",
	"#ff5f87",
	"#ff5faf",
	"#ff5fd7",
	"#ff5fff",
	"#ff8700",
	"#ff875f",
	"#ff8787",
	"#ff87af",
	"#ff87d7",
	"#ff87ff",
	"#ffaf00",
	"#ffaf5f",
	"#ffaf87",
	"#ffafaf",
	"#ffafd7",
	"#ffafff",
	"#ffd700",
	"#ffd75f",
	"#ffd787",
	"#ffd7af",
	"#ffd7d7",
	"#ffd7ff",
	"#ffff00",
	"#ffff5f",
	"#ffff87",
	"#ffffaf",
	"#ffffd7",
	"#ffffff",
	"#080808",
	"#121212",
	"#1c1c1c",
	"#262626",
	"#303030",
	"#3a3a3a",
	"#444444",
	"#4e4e4e",
	"#585858",
	"#626262",
	"#6c6c6c",
	"#767676",
	"#808080",
	"#8a8a8a",
	"#949494",
	"#9e9e9e",
	"#a8a8a8",
	"#b2b2b2",
	"#bcbcbc",
	"#c6c6c6",
	"#d0d0d0",
	"#dadada",
	"#e4e4e4",
	"#eeeeee",
]

export interface ColorObject {
	rgb: number
	css: string
}

const hexRe = /(?:^#?([A-Fa-f0-9]{6})(?:[A-Fa-f0-9]{2})?$)|(?:^#?([A-Fa-f0-9]{3})[A-Fa-f0-9]?$)/
const rgbaRe =
	/(?:^rgba?\(\s*([+-]?(?:\d*[.])?\d+)\s*,\s*([+-]?(?:\d*[.])?\d+)\s*,\s*([+-]?(?:\d*[.])?\d+)\s*(?:,\s*([+-]?(?:\d*[.])?\d+)\s*)?\)$)/
const rgbaRe2 =
	/(?:^rgba?\(\s*([+-]?(?:\d*[.])?\d+)\s* \s*([+-]?(?:\d*[.])?\d+)\s* \s*([+-]?(?:\d*[.])?\d+)\s*(?:\/\s*([+-]?(?:\d*[.])?\d+)\s*)?\)$)/

function parseColor(value: string): number | null {
	let color = parseHexColor(value)
	if (color !== null) return color
	color = parseRgbaColor(value)
	if (color !== null) return color
	return null
	function parseHexColor(value: string): number | null {
		const result = hexRe.exec(value)
		if (result !== null) {
			if (result[1]) {
				const v = parseInt(result[1], 16)
				return Number.isNaN(v) ? null : v
			} else if (result[2]) {
				const v = parseInt(result[2], 16)
				if (!Number.isNaN(v)) {
					let r = v & 0xf00
					let g = v & 0xf0
					let b = v & 0xf
					r = (r << 12) | (r << 8)
					g = (g << 8) | (g << 4)
					b = (b << 4) | b
					return r | g | b
				}
			}
		}
		return null
	}
	function parseRgbaColor(value: string): number | null {
		let result = rgbaRe.exec(value)
		if (result !== null) {
			const r = toInt(result[1])
			const g = toInt(result[2])
			const b = toInt(result[3])
			return (r << 16) | (g << 8) | b
		}
		result = rgbaRe2.exec(value)
		if (result !== null) {
			const r = toInt(result[1])
			const g = toInt(result[2])
			const b = toInt(result[3])
			return (r << 16) | (g << 8) | b
		}
		return null
	}
	function toInt(value: string): number {
		const n = parseInt(value)
		if (Number.isNaN(n)) return 0
		return Math.round(Math.min(255, Math.max(0, n)))
	}
}

export function toColorObject(value: string): ColorObject | null {
	let rgb: number | null | undefined = colorNames[value]
	if (rgb != null) {
		return {
			rgb,
			css: toCss(rgb),
		}
	}
	rgb = parseColor(value)
	if (rgb != null) {
		return {
			rgb,
			css: toCss(rgb),
		}
	}
	return null
}

export interface Theme {
	/** color: hex, rgb */
	foreground?: string
	/** color: hex, rgb */
	background?: string
	/** color: hex, rgb */
	black?: string
	/** color: hex, rgb */
	red?: string
	/** color: hex, rgb */
	green?: string
	/** color: hex, rgb */
	yellow?: string
	/** color: hex, rgb */
	blue?: string
	/** color: hex, rgb */
	magenta?: string
	/** color: hex, rgb */
	cyan?: string
	/** color: hex, rgb */
	white?: string
	/** color: hex, rgb */
	gray?: string
	/** color: hex, rgb */
	brightRed?: string
	/** color: hex, rgb */
	brightGreen?: string
	/** color: hex, rgb */
	brightYellow?: string
	/** color: hex, rgb */
	brightBlue?: string
	/** color: hex, rgb */
	brightMagenta?: string
	/** color: hex, rgb */
	brightCyan?: string
	/** color: hex, rgb */
	brightWhite?: string
}

export interface Palette {
	foreground?: ColorObject | null
	background?: ColorObject | null
	colors: (ColorObject | null)[]
}

export function createPalette(theme?: Theme): Palette {
	return {
		foreground: theme?.foreground ? toColorObject(theme?.foreground) : null,
		background: theme?.background ? toColorObject(theme?.background) : null,
		colors: [
			toColorObject(theme?.black ?? _colors[0]),
			toColorObject(theme?.red ?? _colors[1]),
			toColorObject(theme?.green ?? _colors[2]),
			toColorObject(theme?.yellow ?? _colors[3]),
			toColorObject(theme?.blue ?? _colors[4]),
			toColorObject(theme?.magenta ?? _colors[5]),
			toColorObject(theme?.cyan ?? _colors[6]),
			toColorObject(theme?.white ?? _colors[7]),
			toColorObject(theme?.gray ?? _colors[8]),
			toColorObject(theme?.brightRed ?? _colors[9]),
			toColorObject(theme?.brightGreen ?? _colors[10]),
			toColorObject(theme?.brightYellow ?? _colors[11]),
			toColorObject(theme?.brightBlue ?? _colors[12]),
			toColorObject(theme?.brightMagenta ?? _colors[13]),
			toColorObject(theme?.brightCyan ?? _colors[14]),
			toColorObject(theme?.brightWhite ?? _colors[15]),
			..._colors.slice(16).map(toColorObject),
		],
	}
}

const colorNames: Record<string, number> = {
	aliceblue: 0xf0f8ff,
	antiquewhite: 0xfaebd7,
	aqua: 0x00ffff,
	aquamarine: 0x7fffd4,
	azure: 0xf0ffff,
	beige: 0xf5f5dc,
	bisque: 0xffe4c4,
	black: 0x000000,
	blanchedalmond: 0xffebcd,
	blue: 0x0000ff,
	blueviolet: 0x8a2be2,
	brown: 0xa52a2a,
	burlywood: 0xdeb887,
	cadetblue: 0x5f9ea0,
	chartreuse: 0x7fff00,
	chocolate: 0xd2691e,
	coral: 0xff7f50,
	cornflowerblue: 0x6495ed,
	cornsilk: 0xfff8dc,
	crimson: 0xdc143c,
	cyan: 0x00ffff,
	darkblue: 0x00008b,
	darkcyan: 0x008b8b,
	darkgoldenrod: 0xb8860b,
	darkgray: 0xa9a9a9,
	darkgreen: 0x006400,
	darkgrey: 0xa9a9a9,
	darkkhaki: 0xbdb76b,
	darkmagenta: 0x8b008b,
	darkolivegreen: 0x556b2f,
	darkorange: 0xff8c00,
	darkorchid: 0x9932cc,
	darkred: 0x8b0000,
	darksalmon: 0xe9967a,
	darkseagreen: 0x8fbc8f,
	darkslateblue: 0x483d8b,
	darkslategray: 0x2f4f4f,
	darkslategrey: 0x2f4f4f,
	darkturquoise: 0x00ced1,
	darkviolet: 0x9400d3,
	deeppink: 0xff1493,
	deepskyblue: 0x00bfff,
	dimgray: 0x696969,
	dimgrey: 0x696969,
	dodgerblue: 0x1e90ff,
	firebrick: 0xb22222,
	floralwhite: 0xfffaf0,
	forestgreen: 0x228b22,
	fuchsia: 0xff00ff,
	gainsboro: 0xdcdcdc,
	ghostwhite: 0xf8f8ff,
	gold: 0xffd700,
	goldenrod: 0xdaa520,
	gray: 0x808080,
	green: 0x008000,
	greenyellow: 0xadff2f,
	grey: 0x808080,
	honeydew: 0xf0fff0,
	hotpink: 0xff69b4,
	indianred: 0xcd5c5c,
	indigo: 0x4b0082,
	ivory: 0xfffff0,
	khaki: 0xf0e68c,
	lavender: 0xe6e6fa,
	lavenderblush: 0xfff0f5,
	lawngreen: 0x7cfc00,
	lemonchiffon: 0xfffacd,
	lightblue: 0xadd8e6,
	lightcoral: 0xf08080,
	lightcyan: 0xe0ffff,
	lightgoldenrodyellow: 0xfafad2,
	lightgray: 0xd3d3d3,
	lightgreen: 0x90ee90,
	lightgrey: 0xd3d3d3,
	lightpink: 0xffb6c1,
	lightsalmon: 0xffa07a,
	lightseagreen: 0x20b2aa,
	lightskyblue: 0x87cefa,
	lightslategray: 0x778899,
	lightslategrey: 0x778899,
	lightsteelblue: 0xb0c4de,
	lightyellow: 0xffffe0,
	lime: 0x00ff00,
	limegreen: 0x32cd32,
	linen: 0xfaf0e6,
	magenta: 0xff00ff,
	maroon: 0x800000,
	mediumaquamarine: 0x66cdaa,
	mediumblue: 0x0000cd,
	mediumorchid: 0xba55d3,
	mediumpurple: 0x9370db,
	mediumseagreen: 0x3cb371,
	mediumslateblue: 0x7b68ee,
	mediumspringgreen: 0x00fa9a,
	mediumturquoise: 0x48d1cc,
	mediumvioletred: 0xc71585,
	midnightblue: 0x191970,
	mintcream: 0xf5fffa,
	mistyrose: 0xffe4e1,
	moccasin: 0xffe4b5,
	navajowhite: 0xffdead,
	navy: 0x000080,
	oldlace: 0xfdf5e6,
	olive: 0x808000,
	olivedrab: 0x6b8e23,
	orange: 0xffa500,
	orangered: 0xff4500,
	orchid: 0xda70d6,
	palegoldenrod: 0xeee8aa,
	palegreen: 0x98fb98,
	paleturquoise: 0xafeeee,
	palevioletred: 0xdb7093,
	papayawhip: 0xffefd5,
	peachpuff: 0xffdab9,
	peru: 0xcd853f,
	pink: 0xffc0cb,
	plum: 0xdda0dd,
	powderblue: 0xb0e0e6,
	purple: 0x800080,
	red: 0xff0000,
	rosybrown: 0xbc8f8f,
	royalblue: 0x4169e1,
	saddlebrown: 0x8b4513,
	salmon: 0xfa8072,
	sandybrown: 0xf4a460,
	seagreen: 0x2e8b57,
	seashell: 0xfff5ee,
	sienna: 0xa0522d,
	silver: 0xc0c0c0,
	skyblue: 0x87ceeb,
	slateblue: 0x6a5acd,
	slategray: 0x708090,
	slategrey: 0x708090,
	snow: 0xfffafa,
	springgreen: 0x00ff7f,
	steelblue: 0x4682b4,
	tan: 0xd2b48c,
	teal: 0x008080,
	thistle: 0xd8bfd8,
	tomato: 0xff6347,
	turquoise: 0x40e0d0,
	violet: 0xee82ee,
	wheat: 0xf5deb3,
	white: 0xffffff,
	whitesmoke: 0xf5f5f5,
	yellow: 0xffff00,
	yellowgreen: 0x9acd32,
}
