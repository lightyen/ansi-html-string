// reference:
//
// https://man7.org/linux/man-pages/man7/ascii.7.html
// https://ttssh2.osdn.jp/manual/4/en/about/ctrlseq.html
// https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda

export enum Code {
	Undefined = Number.NaN,
	// C0
	NUL = 0x00,
	SOH = 0x01,
	STX = 0x02,
	ETX = 0x03,
	EOT = 0x04,
	ENQ = 0x05,
	ACK = 0x06,
	BEL = 0x07,
	BS = 0x08,
	HT = 0x09,
	LF = 0x0a,
	VT = 0x0b,
	FF = 0x0c,
	CR = 0x0d,
	SO = 0x0e,
	SI = 0x0f,
	//
	DLE = 0x10,
	DC1 = 0x11,
	DC2 = 0x12,
	DC3 = 0x13,
	DC4 = 0x14,
	NAK = 0x15,
	SYN = 0x16,
	ETB = 0x17,
	CAN = 0x18,
	EM = 0x19,
	SUB = 0x1a,
	ESC = 0x1b,
	FS = 0x1c,
	GS = 0x1d,
	RS = 0x1e,
	US = 0x1f,
	//
	Space = 0x20,
	Exclamation = 0x21,
	DoubleQuote = 0x22,
	Hash = 0x23,
	Dollar = 0x24,
	Percent = 0x25,
	And = 0x26,
	SingleQuote = 0x27,
	LeftRoundBracket = 0x28,
	RightRoundBracket = 0x29,
	Asterisk = 0x2a,
	Plus = 0x2b,
	Comma = 0x2c,
	Hyphen = 0x2d,
	Dot = 0x2e,
	Slash = 0x2f,
	_0 = 0x30,
	_1,
	_2,
	_3,
	_4,
	_5,
	_6,
	_7,
	_8,
	_9,
	Colon = 0x3a,
	SemiColon = 0x3b,
	LessThan = 0x3c,
	Equal = 0x3d,
	GreaterThan = 0x3e,
	Question = 0x3f,
	//
	At = 0x40,
	A = 0x41,
	B,
	C,
	D,
	E,
	F,
	G,
	H,
	I,
	J,
	K,
	L,
	M,
	N,
	O,
	P,
	Q,
	R,
	S,
	T,
	U,
	V,
	W,
	X,
	Y,
	Z,
	LeftSquareBracket = 0x5b,
	Backslash = 0x5c,
	RightSquareBracket = 0x5d,
	Caret = 0x5e,
	Underscore = 0x5f,
	Backstick = 0x60,
	a = 0x61,
	b,
	c,
	d,
	e,
	f,
	g,
	h,
	i,
	j,
	k,
	l,
	m,
	n,
	o,
	p,
	q,
	r,
	s,
	t,
	u,
	v,
	w,
	x,
	y,
	z,
	LeftCurlyBracket = 0x7b,
	VerticalBar = 0x7c,
	RightCurlyBracket = 0x7d,
	Tilde = 0x7e,
	DEL = 0x7f,

	// C1 https://en.wikipedia.org/wiki/C0_and_C1_control_codes
	PAD = 0x80,
	HOP = 0x81,
	BPH = 0x82,
	NBH = 0x83,
	IND = 0x84,
	NEL = 0x85, // CRLF
	SSA = 0x86,
	ESA,
	HTS,
	HTJ,
	VTS,
	PLD,
	PLU,
	RI,
	SS2,
	SS3,
	DCS = 0x90, // ESC 0x80
	PU1,
	PU2,
	STS,
	CCH,
	MW,
	SPA,
	EPA,
	SOS,
	SGC,
	SCI,
	CSI = 0x9b, // ESC 0x5b
	ST = 0x9c, // ESC 0x5c
	OSC = 0x9d, // ESC 0x5d
	PM = 0x9e, // ESC 0x5e
	APC = 0x9f, // ESC 0x5f
}

export enum SGR {
	// reset all attribute
	Reset = 0,
	// set attribute
	Bold = 1,
	Dim = 2,
	Italic = 3,
	Underline = 4,
	SlowBlink = 5,
	RapidBlink = 6,
	Inverse = 7,
	Hidden = 8,
	Strike = 9,
	// reset attribute
	NotBold = 21,
	NotDim = 22,
	NotItalic = 23,
	NotUnderline = 24,
	NotBlinking = 25,
	NotInverse = 27,
	NotHidden = 28,
	NotStrike = 29,
	// set foreground color
	FgBlack = 30,
	FgRed = 31,
	FgGreen = 32,
	FgYellow = 33,
	FgBlue = 34,
	FgMagenta = 35,
	FgCyan = 36,
	FgWhite = 37,
	FgExt = 38,
	FgReset = 39,
	// set background color
	BgBlack = 40,
	BgRed = 41,
	BgGreen = 42,
	BgYellow = 43,
	BgBlue = 44,
	BgMagenta = 45,
	BgCyan = 46,
	BgWhite = 47,
	BgExt = 48,
	BgReset = 49,
	// set bright foreground color
	BrightFgGray = 90,
	BrightFgRed = 91,
	BrightFgGreen = 92,
	BrightFgYellow = 93,
	BrightFgBlue = 94,
	BrightFgMagenta = 95,
	BrightFgCyan = 96,
	BrightFgWhite = 97,
	// set bright background color
	BrightBgGray = 100,
	BrightBgRed = 101,
	BrightBgGreen = 102,
	BrightBgYellow = 103,
	BrightBgBlue = 104,
	BrightBgMagenta = 105,
	BrightBgCyan = 106,
	BrightBgWhite = 107,
}

export function isNumber(charCode: number) {
	return charCode >= 0x30 && charCode < 0x3a
}
