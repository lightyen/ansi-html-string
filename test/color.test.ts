import { blend, parseColor } from "../src/colors"

it("parse", () => {
	expect(parseColor("hsl( 357, 60%, 57%)")).toEqual(parseColor("rgb(211 80  86)"))
})

it("blend color", () => {
	expect(blend(0x231ee780, 0x330212ff)).toBeCloseTo(0x2b107d00, -1)
})
