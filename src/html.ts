import { AnchorWord, Context, createContext, Options as BaseOptions, parseWithContext, Word } from "./ansi"

function isWord(w: Word | AnchorWord | undefined): w is Word {
	return !!w && !w["url"]
}

function _merge(words: Word[]) {
	type State = Omit<Word, "value">
	if (words.length === 0) return words

	const result: Word[] = []
	let currentState: State = words[0]
	let currentWord = ""

	for (let i = 0; i < words.length; i++) {
		if (equal(currentState, words[i])) {
			currentWord += words[i].value
		} else {
			result.push({
				...currentState,
				value: currentWord,
			})
			currentState = words[i]
			currentWord = words[i].value
		}
	}

	if (currentWord) {
		result.push({
			...currentState,
			value: currentWord,
		})
	}

	return result

	function equal(a: State, b: State): boolean {
		if (a.bold !== b.bold) return false
		if (a.underline !== b.underline) return false
		if (a.italic !== b.italic) return false
		if (a.strike !== b.strike) return false
		if (a.hidden !== b.hidden) return false
		if (a.foreground !== b.foreground) return false
		if (a.background !== b.background) return false
		return true
	}
}

function merge(words: Array<Word | AnchorWord>) {
	let a = 0
	let b = 0
	const result: Array<Word | AnchorWord> = []
	for (; b < words.length; b++) {
		const w = words[b]
		if (isAnchorWord(w)) {
			if (a < b) result.push(..._merge(words.slice(a, b) as Word[]))
			w.words = _merge(w.words)
			result.push(w)
			a = b + 1
		}
	}

	if (a < b) result.push(..._merge(words.slice(a, b) as Word[]))
	return result

	function isAnchorWord(w: Word | AnchorWord): w is AnchorWord {
		return !!w["url"]
	}
}

interface RenderSpanOptions {
	rel?: string
}

function renderSpan(words: Array<Word | AnchorWord>, { rel = "" }: RenderSpanOptions = {}): string {
	let result = ""
	for (let i = 0; i < words.length; i++) {
		const w = words[i]
		if (isWord(w)) {
			if (isStyled(w)) {
				result += `<span style="${getStyleSheet(w)}">${w.value}</span>`
			} else {
				result += w.value
			}
		} else {
			result += `<a href="${w.url}" ${getParams(w)}>${renderSpan(w.words)}</a>`
		}
	}

	return result

	function isStyled(w: Word) {
		return (
			w.foreground != undefined ||
			w.background != undefined ||
			w.bold ||
			w.underline ||
			w.italic ||
			w.strike ||
			w.hidden
		)
	}

	function getStyleSheet(w: Word) {
		const props: string[] = []
		if (w.foreground) props.push("color: " + w.foreground)
		if (w.background) props.push("background-color: " + w.background)
		if (w.bold) props.push("font-weight: 700")
		if (w.underline || w.strike) {
			const values: string[] = []
			if (w.underline) values.push("underline")
			if (w.strike) values.push("line-through")
			props.push("text-decoration: " + values.join(" "))
		}
		if (w.italic) props.push("font-style: italic")
		if (w.hidden) props.push("opacity: 0")
		return props.join(";")
	}

	function getParams(w: AnchorWord): string {
		const attrs: string[] = []
		// put all params
		for (const key in w.params) {
			attrs.push(`${key}="${w.params[key]}"`)
		}
		return attrs.join(" ")
	}
}

let cache: Context | undefined

function getContext(options?: BaseOptions): Context {
	if (cache && options == undefined) return cache
	cache = createContext(options)
	return cache
}

interface Options extends BaseOptions {
	anchor?: RenderSpanOptions
}

export function toHtml(ansiText: string, options?: Options) {
	const anchor = options?.anchor
	delete options?.anchor
	const ctx = getContext(options)
	return renderSpan(merge(parseWithContext(ctx, ansiText)), anchor)
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

interface DemoOptions {
	fontSize?: string
	fontFamily?: string
}

function demoTemplate(
	content: string,
	{ background, fontSize, fontFamily }: { background: string; fontSize: string; fontFamily: string },
) {
	return `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>ANSI Demo</title>
		<style>
pre#demo a {
	text-decoration: none;
}
pre#demo:hover #app {
	text-decoration: underline;
}
		</style>
	</head>
	<body style="background: ${background}">
		<pre id="demo" style="font-size: ${fontSize}; font-family: ${fontFamily}">${content}</pre>
	</body>
</html>`
}

export function toDemo(rawText: string | null | undefined, options?: Options & DemoOptions): string {
	if (rawText == undefined) rawText = debugText
	const fontSize = options?.fontSize || "initial"
	delete options?.fontSize
	const fontFamily = options?.fontFamily || "initial"
	delete options?.fontFamily
	const anchor = options?.anchor
	delete options?.anchor
	const background = options?.theme?.background || "initial"
	return demoTemplate(renderSpan(merge(parseWithContext(getContext(options), rawText)), anchor), {
		background,
		fontSize,
		fontFamily,
	})
}

export function createToHtml(options?: Options) {
	const anchor = options?.anchor
	delete options?.anchor
	const ctx = createContext(options)
	return (ansiText: string) => renderSpan(merge(parseWithContext(ctx, ansiText)), anchor)
}

export function createToDemo(options?: Options & DemoOptions) {
	const fontSize = options?.fontSize || "initial"
	delete options?.fontSize
	const fontFamily = options?.fontFamily || "initial"
	delete options?.fontFamily
	const anchor = options?.anchor
	delete options?.anchor
	const background = options?.theme?.background || "initial"
	const ctx = createContext(options)
	return (ansiText: string) =>
		demoTemplate(renderSpan(merge(parseWithContext(ctx, ansiText == undefined ? debugText : ansiText)), anchor), {
			background,
			fontSize,
			fontFamily,
		})
}
