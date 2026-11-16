// ---------- Spec reader: turns a caption / description into ingredients, preps and method (no AI) ----------
const SPEC_FRAC = { "½": "1/2", "¼": "1/4", "¾": "3/4", "⅓": "1/3", "⅔": "2/3", "⅛": "1/8" };
const SPEC_UNIT = "(?:oz|ounces?|fl\\.? ?oz|ml|cl|l|tsp|teaspoons?|tbsp|tablespoons?|cups?|c\\b|dash(?:es)?|drops?|bar ?spoons?|bsp|parts?|g|grams?|pinch(?:es)?|sprigs?|leaves|slices?|wedges?|pieces?|whole|large|small|scoops?|shots?|jiggers?|splash(?:es)?|lbs?|pounds?|quarts?|qt|pints?|bottles?|cans?|sticks?|pods?|stalks?)";
const SPEC_QTY = "(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:[.,]\\d+)?(?:\\s*-\\s*\\d+(?:[.,]\\d+)?)?|one|two|three|four|five|six|half|a few|a couple(?: of)?|a|an)";
const SPEC_AMT_START = new RegExp("^(?:" + SPEC_QTY + "\\s*" + SPEC_UNIT + "\\b|\\d|top(?: up)?(?: with)?\\b|splash\\b|dash(?:es)?\\b|rinse\\b|float\\b|pinch\\b|barspoon\\b|bar spoon\\b|a few\\b|few\\b|fill\\b(?=.*\\b(?:soda|tonic|beer|prosecco|champagne|water)))", "i");
const SPEC_AMT_END = new RegExp("^(.+?)\\s*[-–:,]?\\s*\\(?(" + SPEC_QTY + "\\s*" + SPEC_UNIT + ")\\)?\\.?$", "i");
const SPEC_VERB = /^(?:then\s+|next\s+|finally\s+|\d+[.)]\s*)?(shake|stir|strain|double[- ]strain|fine[- ]strain|add|combine|pour|build|garnish|serve|express|muddle|dry[- ]shake|reverse[- ]dry|whip|fill|rim|blend|simmer|steep|chill|let (?:it |them )?(?:steep|sit|cool|rest|chill)|bring|heat|remove|bottle|store|mix|place|cut|slice|zest|peel|infuse|cook|boil|dissolve|whisk|pulse|top|float|layer|spray|mist|in a|into a|using|once|after|keep|refrigerate|lightly|gently|quickly|torch|smoke|dip|squeeze|discard|pour)\b(?!!)/i;
const SPEC_INGR_WORD = /\b(gin|vodka|rum|tequila|mezcal|whiske?y|bourbon|rye|scotch|brandy|cognac|amaro|aperol|campari|vermouth|liqueur|cordial|syrup|simple|bitters|juice|lime|lemon|orange|grapefruit|soda|tonic|ginger beer|ginger ale|prosecco|champagne|cava|wine|sherry|port|chartreuse|absinthe|falernum|orgeat|grenadine|honey|agave|maple|cream|milk|egg|aquafaba|coffee|espresso|tea|cola|water|salt|saline|sugar|mint|basil|rosemary|thyme|cucumber|ice cream|purée|puree|nectar|shrub|tincture)\b/i;
const SPEC_JUNK = /(https?:\/\/|www\.|link in (?:my )?bio|subscribe|follow (?:me|us|for|@)|turn on notifications|patreon|merch|affiliate|use code|discount code|promo code|shop (?:my|our|the)|sponsored|#ad\b|\bad\b:|giveaway|^\d{1,2}:\d{2}\b|like and share|save this|share this|tag a friend|comment below|let me know|check out|click|available at|amazon|music:|song:|filmed|camera|instagram:|tiktok:|facebook:|twitter:|website:|email:|business inquiries|disclaimer|please drink responsibly|sponsor|commission|let.?s connect|head to https|^(?!.*recipe)[^:]{1,40}:?\s*\d{1,2}:\d{2}$|^add$|^\s*(?:recipe|full recipe) below\b)/i;
const SPEC_GLASS = /\b(coupe|nick ?(?:&|and) ?nora|rocks glass|double rocks|old fashioned glass|highball|collins glass|martini glass|flute|wine glass|tiki mug|copper mug|julep cup|snifter|mug|hurricane glass|shot glass|pint glass|tumbler)\b/i;
const SPEC_PREP_HEAD = /^(?:for (?:the )?|to make (?:the )?|how to make (?:the )?)?(.{2,60}?\b(?:syrup|cordial|shrub|oleo(?: saccharum)?|infusion|infused [a-z ]+|tincture|foam|batch|cream|mix|puree|purée|reduction|liqueur|brine|salt|sugar|rim|garnish))\s*(?:recipe)?\s*[:\-–]?\s*$/i;

function specClean(s) {
  s = String(s || "");
  for (const [k, v] of Object.entries(SPEC_FRAC)) s = s.split(k).join(" " + v + " ");
  return s
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, " ")
    .replace(/^[\s\-–—•·*▪▫◦●○►▶➤→✓✔︎☑️>]+/, "")
    .replace(/^\(?[a-z]\)\s+/i, "")
    .replace(/\s+/g, " ")
    .replace(/(\d)\s+(\d\/\d)/g, "$1 $2")
    .replace(/(\d)(oz|ml|cl)\b/gi, "$1 $2")
    .replace(/^\.(\d)/, "0.$1")
    .replace(/\s+\d{1,2}:\d{2}\s*$/, "")
    .replace(/\b(oz|ml|cl|tsp|tbsp)\./gi, "$1")
    .replace(/\s*\(\s*\d+(?:[.,]\d+)?\s*(?:ml|cl|g)\s*\)/gi, "")
    .replace(/\s+or\s+\d+(?:[.,]\d+)?\s*(?:ml|cl)\b\.?/gi, "")
    .trim();
}
function specTitle(t) {
  return String(t || "")
    .replace(/#\S+/g, "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s[|•–—-]\s.*$/, "")
    .replace(/^(how to make (?:a |an |the )?|recipe for (?:a |an |the )?|the perfect |my )/i, "")
    .replace(/\b(cocktail recipe|recipe|\(?shorts\)?|full video.*)$/i, "")
    .replace(/[!?.:]+$/, "").replace(/\s+/g, " ").trim();
}
function specNiceAmount(line) {
  return line.replace(/^(\d*)[.,](\d+)(?=\s*(?:oz|ounces?|cups?|tsp|tbsp)\b)/i, (m, w, f) => {
    const v = parseFloat("0." + f), whole = w ? parseInt(w, 10) : 0;
    const map = [[0, ""], [0.125, "1/8"], [0.25, "1/4"], [0.333, "1/3"], [0.5, "1/2"], [0.667, "2/3"], [0.75, "3/4"]];
    const hit = map.find(([x]) => Math.abs(x - v) < 0.02);
    if (!hit) return m.startsWith(".") ? "0" + m : m;
    return hit[1] ? (whole ? whole + " " + hit[1] : hit[1]) : String(whole);
  });
}
function specAmountFirst(line) {
  const r = specAmountFirst0(line);
  return r ? specNiceAmount(r) : r;
}
function specAmountFirst0(line) {
  if (SPEC_AMT_START.test(line)) return line;
  const m = line.match(SPEC_AMT_END);
  if (m && !SPEC_VERB.test(line)) return `${m[2]} ${m[1].replace(/[-–:,]\s*$/, "").trim()}`;
  return null;
}
function guessSpirit(ing) {
  const t = ing.join(" | ").toLowerCase();
  const found = new Set();
  if (/bourbon|\brye\b|whisk|scotch/.test(t)) found.add("Whiskey");
  if (/\bgin\b/.test(t)) found.add("Gin");
  if (/\brum\b|cachaça|cachaca/.test(t)) found.add("Rum");
  if (/tequila|mezcal/.test(t)) found.add("Tequila/Mezcal");
  if (/vodka/.test(t)) found.add("Vodka");
  if (/brandy|cognac|armagnac|calvados|applejack|pisco/.test(t)) found.add("Brandy/Cognac");
  if (found.size > 1) return "Multi-Spirit";
  if (found.size === 1) return [...found][0];
  if (/amaro|campari|aperol|vermouth|sherry|fernet|cynar|\bport\b/.test(t)) return "Amaro/Fortified";
  if (/\b(na|non-alcoholic|zero[- ]proof|alcohol[- ]free|mocktail)\b/.test(t)) return "NA/Zero-Proof";
  return "";
}
function guessFamily(ing, method) {
  const t = (ing.join(" | ") + " | " + method).toLowerCase();
  const it = ing.join(" | ").toLowerCase().replace(/[^|]*\b(zest|peel|twist|wheel|wedge)\b[^|]*/g, "");
  const citrus = /lemon|lime|grapefruit|yuzu|sour mix/.test(it), fizzy = /soda|tonic|ginger beer|ginger ale|cola|sparkling water/.test(it);
  if (/hot water|hot coffee|hot milk|hot tea|hot cider|mulled|toddy/.test(t)) return "Hot Drinks";
  if (/espresso|cold brew/.test(t) || /coffee/.test(t.replace(/coffee liqueur/g, ""))) return "Coffee";
  if (/eggnog|egg nog|whole egg|\bflip\b/.test(t)) return "Flips & Eggnog";
  if (/prosecco|champagne|cava|sparkling wine/.test(t)) return "Sparkling & Aperitif";
  if (/\bshot\b|shooter/.test(t)) return "Shots & Shooters";
  if (/cream|milk|ice cream|half and half|half & half/.test(t) && !/cream of coconut/.test(t)) return "Creamy & Dessert";
  if (/orgeat|falernum|pineapple|passion|coconut|tiki/.test(t)) return "Tiki & Tropical";
  if (fizzy && citrus && /egg white|gin fizz|collins/.test(t)) return "Fizzes & Collinses";
  if (fizzy) return "Highballs & Mules";
  if (citrus) return "Sours";
  if (/campari|amaro|fernet|cynar|aperol|suze|gentian/.test(it)) return "Amaro & Bitter-Forward";
  if (/stir|vermouth|bitters|lillet|liqueur/.test(t) || (ing.length && !/juice|cream|milk|soda/.test(it))) return "Stirred & Spirit-Forward";
  return "";
}

// text: caption/description. meta: {title, author, ingredients[], instructions[]} from a link (optional)
function parseSpec(text, meta) {
  meta = meta || {};
  const out = { title: specTitle(meta.title || ""), creator: meta.author || "", lines: [], prepName: "", method: [], prepMethod: [], glass: "", garnish: "", unsure: [], more: [] };
  // Structured recipe data (recipe websites) is the most reliable source.
  if (Array.isArray(meta.ingredients) && meta.ingredients.length) {
    meta.ingredients.forEach((x) => { const s = specClean(x); if (s) out.lines.push({ text: (specAmountFirst(s) || s).replace(/\.$/, ""), role: "drink" }); });
    (meta.instructions || []).forEach((x) => { const s = specClean(x); if (s) out.method.push(s); });
  }
  let mode = "drink", seenIngredient = out.lines.length > 0, titleFromText = "", afterHeader = false, headerTitle = "";
  const amtLike = (x) => !!specAmountFirst(x) || /^top(?: up)?(?: with)?\b/i.test(x);
  const raw = String(text || "").replace(/\r/g, "").split(/\n|(?<!\b(?:oz|ml|cl|tsp|tbsp|approx|e\.g|etc|no|vs|st|mr|dr)\.)(?<=[a-z)]\.)\s+(?=[A-Z])/);
  const rows = [];
  raw.forEach((r) => {
    // "Ingredients: 2 oz gin, 1 oz lime, 3/4 oz simple" → split on commas when it holds several amounts
    const m = r.match(/^\s*(?:ingredients?|you(?:'ll)? need|what you need|spec)\s*[:\-–]\s*(.+)$/i);
    const body = m ? m[1] : r;
    if ((body.match(/\d\s*(?:oz|ml|cl|dash|tsp|tbsp)/gi) || []).length >= 2 && /,|;| \| /.test(body)) body.split(/,|;| \| /).forEach((x, i) => {
      const lead = i === 0 && x.match(/^(.*?[a-z!?)].*?)\s+((?:\d+\s+\d\/\d|\d+\/\d|\d+(?:[.,]\d+)?)\s*(?:oz|ml|cl)\b.*)$/i);
      if (lead && !/\d/.test(lead[1])) rows.push(lead[1], lead[2]); else rows.push(x);
    });
    else rows.push(m ? "Ingredients:" : r, ...(m ? [m[1]] : []));
  });
  for (let r of rows) {
    const line = specClean(r);
    if (!line || line.length < 2) continue;
    if (/^(#\S+\s*)+$/.test(line) || /^(@\S+\s*)+$/.test(line) || SPEC_JUNK.test(line)) continue;
    const noTags = line.replace(/#\S+/g, "").trim();
    if (!noTags) continue;
    if (/^(?:the )?(tools?|gear|links?|shop|follow(?: me| us)?|socials?|music|time ?stamps|chapters|equipment|my (?:gear|tools)|bottles?|where to buy|affiliate links?)\s*[:\-–]?$/i.test(noTags)) { mode = "skip"; continue; }
    const rh = noTags.match(/^(?:the )?(.{2,40}?)\s+recipe\s*[:\-–]?$/i);
    const realName = rh && !/^(the|full|my|a|this|our|the full|drink|cocktail)$/i.test(rh[1].trim());
    if (/^(ingredients?|you(?:'ll)? need|what you need|spec|recipe|the spec)\s*[:\-–]?$/i.test(noTags) || realName) {
      if (seenIngredient && out.lines.length) { out.more.push(noTags.replace(/\s*recipe\s*[:\-–]?$/i, "")); mode = "skip"; continue; }
      mode = "drink"; afterHeader = true;
      const h = noTags.match(/^(?:the )?(.{2,40}?)\s+recipe\b/i); if (h && !headerTitle) headerTitle = h[1].replace(/\b\w+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
      continue;
    }
    if (mode === "skip" && !/^(method|instructions?|directions?|garnish)/i.test(noTags)) continue;
    const fg = noTags.match(/^(.+?)\s+(?:for|as)\s+(?:a\s+|the\s+)?garnish\.?$/i);
    if (fg) { out.garnish = out.garnish || fg[1]; continue; }
    if (/^(method|instructions?|directions?|steps?|how to(?: make it)?|preparation|to make|build)\s*[:\-–]?$/i.test(noTags)) { mode = "method"; continue; }
    const gm = noTags.match(/^garnish(?:ed)?(?: with)?\s*[:\-–]?\s*(.+)$/i);
    if (gm) { out.garnish = gm[1].replace(/\.$/, ""); continue; }
    const glm = noTags.match(/^(?:glass(?:ware)?|serve(?:d)? in)\s*[:\-–]?\s*(.+)$/i);
    if (glm) { out.glass = glm[1].replace(/\.$/, ""); continue; }
    if (/:$/.test(noTags) && !SPEC_AMT_START.test(noTags) && noTags.split(" ").length <= 6 && !SPEC_PREP_HEAD.test(noTags)) {
      const name = noTags.replace(/[:*]+$/, "").trim();
      if (seenIngredient && out.lines.some((l) => l.role === "drink")) { out.more.push(name); mode = "skip"; continue; }
      if (!headerTitle) headerTitle = name;
      mode = "drink"; afterHeader = true; continue;
    }
    const ph = noTags.match(SPEC_PREP_HEAD);
    if (ph && !SPEC_AMT_START.test(noTags) && seenIngredient) { mode = "prep"; out.prepName = out.prepName || ph[1].replace(/^(the|a|an)\s+/i, "").replace(/\b\w/g, (c) => c.toUpperCase()); continue; }
    const amt = specAmountFirst(noTags);
    const isVerb = SPEC_VERB.test(noTags);
    if (/^top(?: up)?(?: with)?\b/i.test(noTags) && noTags.split(" ").length <= 6) {
      out.lines.push({ text: noTags.replace(/^top(?: up)? with/i, "Top with"), role: mode.startsWith("prep") ? "prep" : "drink" }); seenIngredient = true; continue;
    }
    if (amt && !(isVerb && noTags.split(" ").length > 7)) {
      out.lines.push({ text: amt.replace(/[.!]+$/, ""), role: mode.startsWith("prep") ? "prep" : "drink" });
      seenIngredient = true;
      if (mode === "method") mode = "drink";
      if (mode === "prepmethod") mode = "prep";
      continue;
    }
    if (isVerb || noTags.split(" ").length > 8) {
      if (!seenIngredient && !isVerb) { if (!titleFromText && !out.title && noTags.split(" ").length <= 8) titleFromText = noTags; continue; }
      (mode.startsWith("prep") ? out.prepMethod : out.method).push(/[.!?]$/.test(noTags) ? noTags : noTags + ".");
      const g = noTags.match(SPEC_GLASS); if (g && !out.glass) out.glass = g[1];
      const gw = noTags.match(/garnish(?:ed)? with (?:an? |the )?([^.,;]+)/i); if (gw && !out.garnish) out.garnish = gw[1];
      continue;
    }
    if (!seenIngredient && !afterHeader && !amtLike(noTags) && noTags.split(" ").length <= 8 && !/[:]$/.test(noTags)) {
      if (!titleFromText && !out.title) titleFromText = noTags;
      else if (noTags.split(" ").length <= 6 && !/[.!?:]$/.test(noTags)) { const k = (x) => String(x).toLowerCase().replace(/[^a-z]/g, "").replace(/and/g, ""); if (k(specTitle(noTags)) !== k(out.title || titleFromText)) out.unsure.push(noTags); }
      continue;
    }
    if (mode !== "method" && SPEC_INGR_WORD.test(noTags) && noTags.split(" ").length <= 6) {
      out.lines.push({ text: noTags, role: mode.startsWith("prep") ? "prep" : "drink" }); seenIngredient = true; continue;
    }
    if (!seenIngredient && !titleFromText && noTags.split(" ").length <= 8) { titleFromText = noTags; continue; }
    out.unsure.push(noTags);
  }
  const generic = /^(everyone|why|how|this|my|i |we |the best|3 |\d+ )/i;
  if (headerTitle && (!out.title || generic.test(out.title) || /[-–|]/.test(meta.title || ""))) out.title = specTitle(headerTitle);
  if (!out.title) out.title = specTitle(titleFromText);
  if (out.prepMethod.length) out.lines.push({ text: out.prepMethod.join(" "), role: "prep" });
  if (out.lines.some((l) => l.role === "drink" && /syrup|cordial|shrub|oleo/i.test(l.text))) {
    out.lines.forEach((l) => { if (l.role === "drink" && /^[\d\s/.]+\s*(?:cups?|g|grams?|lbs?|pounds?|quarts?|qt)\b/i.test(l.text)) l.role = "prep"; });
    if (!out.prepName) { const s = out.lines.find((l) => l.role === "drink" && /syrup|cordial|shrub|oleo/i.test(l.text) && !/simple|demerara|agave|maple syrup|honey/i.test(l.text)); if (s && out.lines.some((l) => l.role === "prep")) out.prepName = s.text.replace(/^[\d\s/.]+\s*(?:oz|ml|cl|tsp|tbsp|dashes?|barspoons?)?\s*/i, "").replace(/\b\w/g, (c) => c.toUpperCase()); }
  }
  const drinkIng = out.lines.filter((l) => l.role === "drink").map((l) => l.text);
  const parts = [];
  if (out.method.length) parts.push(out.method.join(" "));
  if (out.glass && !parts.join(" ").toLowerCase().includes(out.glass.toLowerCase())) parts.push("Glass: " + out.glass + ".");
  if (out.garnish && !/garnish/i.test(parts.join(" "))) parts.push("Garnish: " + out.garnish + ".");
  out.note = parts.join(" ").replace(/\s+/g, " ").trim();
  out.spirit = guessSpirit(drinkIng);
  out.family = guessFamily(drinkIng, out.note);
  return out;
}
