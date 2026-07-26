import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const tsvPath = path.join(root, "src/data/fit-distance-videos.tsv");
const exercisesPath = path.join(root, "src/data/exercises.json");
const catalogPath = path.join(root, "src/data/fit-distance-exercise-videos.json");

const skipTitle =
  /fit['’]?distance|chatgpt|claude|mcp|google|apple|sant[eé]|habitudes|recettes|agenda|notification|personalize|create your own|program with|luc l[eé]ger|audio officiel|tutoriel|fonctionnalit/i;

function parseTsv(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, title, durationRaw] = line.split("\t");
      const duration = Number(durationRaw);
      return {
        id,
        title: title || "",
        duration: Number.isFinite(duration) ? duration : null,
        url: `https://www.youtube.com/watch?v=${id}`,
      };
    })
    .filter((v) => v.id && v.title);
}

/**
 * Higher score wins. Use `reject` to exclude wrong variants.
 * Patterns are tested against normalized title (lowercase, accents stripped lightly).
 */
const matchers = [
  {
    id: "push_up",
    patterns: [/^pompes?(?!.*phoque)(?!.*mur)/i, /push[- ]?ups?(?!.*seal)/i],
    reject: [/phoque|seal|mur|genoux|pieds sur[eé]lev/i],
  },
  {
    id: "bench_press",
    patterns: [/d[eé]velopp[eé] couch[eé].*barre|barre.*d[eé]velopp[eé] couch[eé]|bench press.*barbell|barbell bench/i],
    reject: [/halt[eè]re|serre|unilat/i],
  },
  {
    id: "dumbbell_chest_press",
    patterns: [/d[eé]velopp[eé] couch[eé].*halt[eè]re|halt[eè]re.*d[eé]velopp[eé] couch[eé]|dumbbell.*(bench|chest) press/i],
    reject: [/serre|prise marteau|inclin/i],
  },
  {
    id: "lateral_raise",
    patterns: [/[eé]l[eé]vation lat[eé]rale.*(halt|[eé]paule|deltoid)|lateral raise|oisseau|side lateral/i],
    reject: [/jambe|leg|hanche|hip|fessier|glute/i],
  },
  {
    id: "face_pull",
    patterns: [/face ?pull|facepull|tirage.*(face|visage)/i],
  },
  {
    id: "pull_up",
    patterns: [/^tractions?(?!.*brachial)|pull[- ]?ups?|chin[- ]?ups?/i],
    reject: [/brachial|avant-bras|assist|n[eé]gatif|australien/i],
  },
  {
    id: "lat_pulldown",
    patterns: [/tirage vertical.*barre|tirage vertical.*poulie|lat pull.?down|pulldown/i],
    reject: [/prise neutre.*unilat/i],
  },
  {
    id: "barbell_row",
    patterns: [/rowing barre|row.*barre|barbell row|tirage.*barre pench/i],
    reject: [/prise disque|unilat|halt[eè]re/i],
  },
  {
    id: "bicep_curl",
    patterns: [/curl biceps.*(halt[eè]re|debout)|curl.*halt[eè]re.*biceps|^curl biceps/i],
    reject: [/marteau|hammer|pupitre|machine|guid|poulie|corde/i],
  },
  {
    id: "hammer_curl",
    patterns: [/curl marteau|hammer curl/i],
  },
  {
    id: "tricep_pushdown",
    patterns: [/pushdown|extension.*triceps.*poulie|triceps.*poulie.*extension/i],
    reject: [/inclin[eé]|unilat|overhead|nuque/i],
  },
  {
    id: "overhead_tricep",
    patterns: [/extension.*triceps.*(nuque|overhead|halt[eè]re)|overhead.*triceps|triceps.*au.?dessus/i],
  },
  {
    id: "plank",
    patterns: [/^planche normale|planche \(gainage\)|^plank\b|gainage ventral/i],
    reject: [/lat[eé]ral|side|dynamique|mountain|creux|hollow/i],
  },
  {
    id: "cable_crunch",
    patterns: [/crunch.*(poulie|c[aâ]ble)|cable crunch/i],
  },
  {
    id: "russian_twist",
    patterns: [/russian twist|rotation russe/i],
    reject: [/une jambe|single/i],
  },
  {
    id: "squat",
    patterns: [/^squat\b(?!.*sumo)(?!.*bulgare)(?!.*goblet)|squat.*barre|barbell squat|back squat/i],
    reject: [/sumo|bulgare|goblet|sissy|hack|jump|saut|plateforme|pistolet/i],
  },
  {
    id: "leg_extension",
    patterns: [/leg extension(?!.*unilat)|^extension de jambes/i],
    reject: [/unilat/i],
  },
  {
    id: "rdl",
    patterns: [/soulev[eé].*terre roumain|roumain.*barre|rdl|romanian deadlift/i],
    reject: [/halt[eè]re|unilat|jambe/i],
  },
  {
    id: "leg_curl",
    patterns: [/leg curl(?!.*glissant)|curl.*ischio|lying leg curl|curl allong/i],
    reject: [/glissant|swiss|ball/i],
  },
  {
    id: "hip_thrust",
    patterns: [/hip[- ]?thrust|pont des hanches|hip thrust/i],
    reject: [/au sol|floor|unilat|une jambe/i],
  },
  {
    id: "glute_bridge",
    patterns: [/glute bridge|pont fessier|pont au sol.*fess|hip-thrust \(pont\) au sol/i],
  },
  {
    id: "calf_raise",
    patterns: [/mollets?|calf raise|extension.*mollet|relev[eé].*mollet/i],
    reject: [/shrug|haussement/i],
  },
  {
    id: "deadlift",
    patterns: [/^soulev[eé] de terre(?!.*roumain)(?!.*sumo)|conventional deadlift|deadlift(?!.*roman)/i],
    reject: [/roumain|rdl|sumo|jambe|unilat|bande|elast/i],
  },
  {
    id: "shrug",
    patterns: [/shrug|haussement d['’ ]?[eé]paules/i],
    reject: [/mollet/i],
  },
  {
    id: "reverse_lunge",
    patterns: [/fentes? arri[eè]re|reverse lunge/i],
  },
  {
    id: "bench_hops",
    patterns: [/bench hop|sauts? alt[eé]rn[eé]s?.*banc|saut.*c[oô]t[eé].*banc/i],
  },
];

function isExerciseClip(v) {
  if (skipTitle.test(v.title)) return false;
  if (v.duration != null && v.duration > 90) return false;
  if (v.duration != null && v.duration < 3) return false;
  return true;
}

function scoreMatch(video, matcher) {
  if (matcher.reject?.some((p) => p.test(video.title))) return 0;
  let score = 0;
  for (const p of matcher.patterns) {
    if (p.test(video.title)) score += 10;
  }
  if (!score) return 0;
  if (video.duration != null && video.duration <= 15) score += 3;
  else if (video.duration != null && video.duration <= 30) score += 1;
  // slight preference for simpler titles
  if (video.title.length < 45) score += 1;
  return score;
}

const tsv = fs.readFileSync(tsvPath, "utf8");
const all = parseTsv(tsv);
const exerciseClips = all.filter(isExerciseClip);

fs.writeFileSync(
  catalogPath,
  JSON.stringify(
    exerciseClips.map((v) => ({
      id: v.id,
      title: v.title,
      duration: v.duration,
      url: v.url,
    })),
    null,
    2,
  ) + "\n",
  "utf8",
);

const exercises = JSON.parse(fs.readFileSync(exercisesPath, "utf8"));
const updates = [];
const unmatched = [];

for (const matcher of matchers) {
  let best = null;
  let bestScore = 0;
  const candidates = [];
  for (const video of exerciseClips) {
    const s = scoreMatch(video, matcher);
    if (s >= 10) candidates.push({ video, s });
    if (s > bestScore) {
      bestScore = s;
      best = video;
    }
  }
  candidates.sort((a, b) => b.s - a.s);
  if (!best || bestScore < 10) {
    unmatched.push(matcher.id);
    continue;
  }
  const ex = exercises.find((e) => e.id === matcher.id);
  if (!ex) continue;
  const prev = ex.videoUrl;
  ex.videoUrl = best.url;
  ex.videoSource = "youtube";
  updates.push({
    exerciseId: matcher.id,
    name: ex.name,
    title: best.title,
    url: best.url,
    previousUrl: prev,
    topCandidates: candidates.slice(0, 3).map((c) => `${c.s}:${c.video.title}`),
  });
}

fs.writeFileSync(exercisesPath, JSON.stringify(exercises, null, 2) + "\n", "utf8");

console.log(
  JSON.stringify(
    {
      totalChannelVideos: all.length,
      exerciseClips: exerciseClips.length,
      matchedExercises: updates.length,
      unmatched,
      updates,
    },
    null,
    2,
  ),
);
