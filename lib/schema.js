// Exact answer shapes for Claude's structured outputs (guarantees valid JSON).
import { CATS } from "./guide.js";

const O = props => ({ type: "object", properties: props, required: Object.keys(props), additionalProperties: false });
const A = items => ({ type: "array", items });
const S = { type: "string" }, N = { type: "number" }, I = { type: "integer" }, B = { type: "boolean" };
const E = (...vals) => ({ type: "string", enum: vals });
const PT = A(N);

const ELEMENT = E("fluff", "lights", "primary_picks", "ribbon", "florals", "statement", "medium", "small", "small_picks", "crown", "base");
const PLAN = {
  quick_fixes: A(O({ title: S, how: S, x: N, y: N })),
  plan: A(O({ element: ELEMENT, step: S, title: S, how: S, effort: S, shop: S })),
  ideas: A(O({ label: S, request: S })),
  mockup: O({
    lights: O({ add: B, kind: E("warm", "multicolor", "solid"), color: S, density: E("light", "medium", "heavy") }),
    ribbon_technique: E("cascade", "loops"),
    ribbons: A(O({ role: E("base", "overlay", "accent"), width_in: N, color: S, texture: E("satin", "velvet", "metallic", "sheer", "plaid", "stripe", "burlap"), accent: S, owned: B })),
    picks: O({
      primary: O({ kind: E("pine", "cedar", "eucalyptus", "magnolia", "none"), finish: E("natural", "frosted", "gold", "silver") }),
      floral: O({ kind: E("poinsettia", "rose", "magnolia", "hydrangea", "orchid", "none"), color: S }),
      small: O({ kind: E("berries", "spray", "none"), color: S })
    }),
    moments: A(O({ x: N, y: N, size: I, floral: B })),
    ornaments: A(O({ x: N, y: N, color: S, size: E("xl", "l", "m", "s"), shape: E("ball", "drop", "finial", "geometric", "candy"), finish: E("shiny", "matte", "glitter") })),
    clusters: A(O({ x: N, y: N, color: S, size: E("m", "s"), count: I, finish: E("shiny", "matte", "glitter") })),
    crown: E("light", "medium", "full"),
    topper: O({ style: E("star", "bow", "floral", "finial", "none"), color: S, delicate: B })
  }),
  render_brief: S
};

// First call: everything except the written step instructions (those come from DETAILS_SCHEMA)
const PLAN_COMPACT = { ...PLAN, plan: A(O({ element: ELEMENT, step: S, title: S, shop: S })) };
export const DETAILS_SCHEMA = O({ steps: A(O({ how: S, effort: S })) });

// The evaluation runs as two calls at once: first impression + scores (fast) and the plan (slower)
export const LOOK_SCHEMA = O({
  tree: O({ kind: E("artificial", "natural"), density: E("open", "dense"), flocked: B, height_ft: N, stage: E("partial", "finished", "bare") }),
  eye_first: S,
  headline: S,
  summary: S,
  categories: A(O({ name: E(...CATS.map(c => c[0])), score: I, note: S })),
  potential: O({ after_quick_fixes: I, after_full_plan: I }),
  cone: O({ apex: PT, left: PT, right: PT })
});
export const PLAN_SCHEMA = O(PLAN_COMPACT);

export const EVAL_SCHEMA = O({
  tree: O({ kind: E("artificial", "natural"), density: E("open", "dense"), flocked: B, height_ft: N, stage: E("partial", "finished", "bare") }),
  eye_first: S,
  headline: S,
  summary: S,
  categories: A(O({ name: E(...CATS.map(c => c[0])), score: I, note: S })),
  potential: O({ after_quick_fixes: I, after_full_plan: I }),
  cone: O({ apex: PT, left: PT, right: PT }),
  ...PLAN_COMPACT
});

export const REVISE_SCHEMA = O({
  reply: S,
  changes: A(S),
  version_label: S,
  change_brief: S,
  ...PLAN_COMPACT
});
