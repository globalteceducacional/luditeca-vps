import { prisma } from './prisma.js';
import { evaluateAchievements, ACHIEVEMENT_DEFINITIONS } from './achievements.js';
export async function syncAchievementsForUser(userId) {
    const row = await prisma.profile.findUnique({ where: { userId } });
    const evaluated = evaluateAchievements({
        badges: row?.badges ?? [],
        progress: row?.progress ?? {},
        booksRead: row?.booksRead ?? 0,
        favorites: row?.favorites ?? [],
        xpTotal: row?.xpTotal ?? 0,
        xpBalance: row?.xpBalance ?? 0,
    });
    const changed = evaluated.unlocked.length > 0 ||
        evaluated.xpTotal !== (row?.xpTotal ?? 0) ||
        evaluated.xpBalance !== (row?.xpBalance ?? 0);
    if (changed) {
        await prisma.profile.upsert({
            where: { userId },
            create: {
                userId,
                badges: evaluated.badges,
                xpTotal: evaluated.xpTotal,
                xpBalance: evaluated.xpBalance,
                progress: row?.progress ?? {},
            },
            update: {
                badges: evaluated.badges,
                xpTotal: evaluated.xpTotal,
                xpBalance: evaluated.xpBalance,
            },
        });
    }
    return evaluated;
}
export function achievementsCatalogPayload(badges, stats) {
    const owned = new Set(Array.isArray(badges) ? badges.map((b) => String(b)) : []);
    return ACHIEVEMENT_DEFINITIONS.map((def) => {
        let current = 0;
        switch (def.metric) {
            case 'pages_read':
                current = stats.pages_read;
                break;
            case 'books_read':
                current = stats.books_read;
                break;
            case 'level':
                current = stats.level;
                break;
            case 'reading_hours':
                current = stats.reading_hours;
                break;
            case 'favorites':
                current = stats.favorites;
                break;
            case 'xp_total':
                current = stats.xp_total;
                break;
            default:
                current = 0;
        }
        const progress = def.threshold > 0 ? Math.min(1, current / def.threshold) : 0;
        return {
            id: def.id,
            emoji: def.emoji,
            title: def.title,
            description: def.description,
            metric: def.metric,
            threshold: def.threshold,
            xp_reward: def.xpReward,
            coming_soon: def.comingSoon === true,
            unlocked: owned.has(def.id),
            current,
            progress,
        };
    });
}
