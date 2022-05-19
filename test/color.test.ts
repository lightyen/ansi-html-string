import { blend, parseColor } from "../src/colors"

it("parse", () => {
	expect(parseColor("#365842")).toEqual(0x365842)
	expect(parseColor("rgb(54, 88, 66)")).toEqual(0x365842)
	expect(parseColor("rgb(54 88 66)")).toEqual(0x365842)
	expect(parseColor("rgba(54, 88, 66, 0.5)")).toEqual(0x365842)
	expect(parseColor("rgba(54  88  66/ 0.5)")).toEqual(0x365842)
	expect(parseColor("hsl( 357, 60%, 57%)")).toEqual(parseColor("rgb(211 80  86)"))
})

it("blend color", () => {
	expect(blend(0x231ee780, 0x330212ff)).toBeCloseTo(0x2b107d00, -1)
})
