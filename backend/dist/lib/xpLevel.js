/** Paridade com [ProfileXpLevel] no app Flutter. */
const FIXED_THRESHOLDS = [0, 100, 200, 400];
export function totalXpForLevel(level) {
    if (level <= 1)
        return 0;
    if (level <= FIXED_THRESHOLDS.length) {
        return FIXED_THRESHOLDS[level - 1] ?? 0;
    }
    let threshold = 400;
    for (let l = 5; l <= level; l++)
        threshold *= 2;
    return threshold;
}
export function levelFromTotalXp(totalXp) {
    if (totalXp < 0)
        return 1;
    let level = 1;
    while (totalXpForLevel(level + 1) <= totalXp) {
        level++;
        if (level >= 99)
            break;
    }
    return level;
}
