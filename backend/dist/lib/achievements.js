import { levelFromTotalXp } from './xpLevel.js';
import { buildProfileStats, countPagesRead, countReadingHours } from './profileStats.js';
export const ACHIEVEMENT_DEFINITIONS = [
    {
        id: 'pages_1',
        emoji: '📄',
        title: 'Primeira página',
        description: 'Leia 1 página',
        metric: 'pages_read',
        threshold: 1,
        xpReward: 25,
    },
    {
        id: 'pages_10',
        emoji: '📖',
        title: 'Leitor curioso',
        description: 'Leia 10 páginas',
        metric: 'pages_read',
        threshold: 10,
        xpReward: 50,
    },
    {
        id: 'pages_25',
        emoji: '📚',
        title: 'Maratonista',
        description: 'Leia 25 páginas',
        metric: 'pages_read',
        threshold: 25,
        xpReward: 75,
    },
    {
        id: 'pages_50',
        emoji: '🦉',
        title: 'Coruja literária',
        description: 'Leia 50 páginas',
        metric: 'pages_read',
        threshold: 50,
        xpReward: 100,
    },
    {
        id: 'pages_100',
        emoji: '🏅',
        title: 'Centurião',
        description: 'Leia 100 páginas',
        metric: 'pages_read',
        threshold: 100,
        xpReward: 200,
    },
    {
        id: 'pages_250',
        emoji: '⭐',
        title: 'Mestre das páginas',
        description: 'Leia 250 páginas',
        metric: 'pages_read',
        threshold: 250,
        xpReward: 400,
    },
    {
        id: 'pages_500',
        emoji: '👑',
        title: 'Lenda das páginas',
        description: 'Leia 500 páginas',
        metric: 'pages_read',
        threshold: 500,
        xpReward: 800,
    },
    {
        id: 'books_1',
        emoji: '🎉',
        title: 'Primeiro livro',
        description: 'Termine 1 livro',
        metric: 'books_read',
        threshold: 1,
        xpReward: 100,
    },
    {
        id: 'books_3',
        emoji: '🌟',
        title: 'Colecionador',
        description: 'Termine 3 livros',
        metric: 'books_read',
        threshold: 3,
        xpReward: 150,
    },
    {
        id: 'books_5',
        emoji: '🚀',
        title: 'Explorador',
        description: 'Termine 5 livros',
        metric: 'books_read',
        threshold: 5,
        xpReward: 250,
    },
    {
        id: 'books_10',
        emoji: '🏆',
        title: 'Bibliófilo',
        description: 'Termine 10 livros',
        metric: 'books_read',
        threshold: 10,
        xpReward: 400,
    },
    {
        id: 'books_25',
        emoji: '💎',
        title: 'Guardião da história',
        description: 'Termine 25 livros',
        metric: 'books_read',
        threshold: 25,
        xpReward: 750,
    },
    {
        id: 'books_50',
        emoji: '🌈',
        title: 'Lenda Luditeca',
        description: 'Termine 50 livros',
        metric: 'books_read',
        threshold: 50,
        xpReward: 1200,
    },
    {
        id: 'level_2',
        emoji: '🌱',
        title: 'Subindo de nível',
        description: 'Alcance o nível 2',
        metric: 'level',
        threshold: 2,
        xpReward: 50,
    },
    {
        id: 'level_3',
        emoji: '🚀',
        title: 'Explorador',
        description: 'Alcance o nível 3',
        metric: 'level',
        threshold: 3,
        xpReward: 100,
    },
    {
        id: 'level_5',
        emoji: '📚',
        title: 'Leitor dedicado',
        description: 'Alcance o nível 5',
        metric: 'level',
        threshold: 5,
        xpReward: 200,
    },
    {
        id: 'level_7',
        emoji: '🌟',
        title: 'Super leitor',
        description: 'Alcance o nível 7',
        metric: 'level',
        threshold: 7,
        xpReward: 350,
    },
    {
        id: 'level_10',
        emoji: '👑',
        title: 'Lenda viva',
        description: 'Alcance o nível 10',
        metric: 'level',
        threshold: 10,
        xpReward: 500,
    },
    {
        id: 'hours_1',
        emoji: '⏱️',
        title: 'Hora de leitura',
        description: 'Acumule 1 hora de leitura',
        metric: 'reading_hours',
        threshold: 1,
        xpReward: 60,
    },
    {
        id: 'hours_5',
        emoji: '⌛',
        title: 'Maratona',
        description: 'Acumule 5 horas de leitura',
        metric: 'reading_hours',
        threshold: 5,
        xpReward: 200,
    },
    {
        id: 'hours_10',
        emoji: '🕰️',
        title: 'Viajante do tempo',
        description: 'Acumule 10 horas de leitura',
        metric: 'reading_hours',
        threshold: 10,
        xpReward: 400,
    },
    {
        id: 'hours_24',
        emoji: '🌙',
        title: 'Noite de histórias',
        description: 'Acumule 24 horas de leitura',
        metric: 'reading_hours',
        threshold: 24,
        xpReward: 800,
    },
    {
        id: 'fav_1',
        emoji: '❤️',
        title: 'Primeiro favorito',
        description: 'Guarde 1 livro nos favoritos',
        metric: 'favorites',
        threshold: 1,
        xpReward: 30,
    },
    {
        id: 'fav_5',
        emoji: '💝',
        title: 'Lista especial',
        description: 'Guarde 5 livros nos favoritos',
        metric: 'favorites',
        threshold: 5,
        xpReward: 100,
    },
    {
        id: 'fav_10',
        emoji: '💖',
        title: 'Coração literário',
        description: 'Guarde 10 livros nos favoritos',
        metric: 'favorites',
        threshold: 10,
        xpReward: 200,
    },
    {
        id: 'xp_500',
        emoji: '✨',
        title: 'Brilho inicial',
        description: 'Acumule 500 XP',
        metric: 'xp_total',
        threshold: 500,
        xpReward: 50,
    },
    {
        id: 'xp_2000',
        emoji: '🔥',
        title: 'Em chamas',
        description: 'Acumule 2000 XP',
        metric: 'xp_total',
        threshold: 2000,
        xpReward: 150,
    },
    {
        id: 'xp_5000',
        emoji: '💫',
        title: 'Estrela Luditeca',
        description: 'Acumule 5000 XP',
        metric: 'xp_total',
        threshold: 5000,
        xpReward: 300,
    },
    {
        id: 'activity_1',
        emoji: '🎮',
        title: 'Primeira atividade',
        description: 'Complete 1 atividade',
        metric: 'activities_done',
        threshold: 1,
        xpReward: 100,
        comingSoon: true,
    },
    {
        id: 'activity_5',
        emoji: '🎯',
        title: 'Aventureiro',
        description: 'Complete 5 atividades',
        metric: 'activities_done',
        threshold: 5,
        xpReward: 250,
        comingSoon: true,
    },
    {
        id: 'puzzle_1',
        emoji: '🧩',
        title: 'Mestre dos puzzles',
        description: 'Complete 1 puzzle',
        metric: 'activities_done',
        threshold: 1,
        xpReward: 80,
        comingSoon: true,
    },
];
function parseBadgeIds(badges) {
    if (!Array.isArray(badges))
        return [];
    return badges.map((b) => String(b)).filter((id) => id.length > 0);
}
function metricValue(metric, stats, xpBeforeAchievements) {
    switch (metric) {
        case 'pages_read':
            return stats.pages_read;
        case 'books_read':
            return stats.books_read;
        case 'level':
            return levelFromTotalXp(xpBeforeAchievements);
        case 'reading_hours':
            return stats.reading_hours;
        case 'favorites':
            return stats.favorites;
        case 'xp_total':
            return xpBeforeAchievements;
        case 'activities_done':
            return 0;
        default:
            return 0;
    }
}
export function evaluateAchievements(input) {
    const xpBeforeAchievements = Math.max(0, Math.floor(input.xpTotal));
    const stats = buildProfileStats({
        progress: input.progress,
        booksRead: input.booksRead,
        favorites: input.favorites,
        xpTotal: xpBeforeAchievements,
    });
    const owned = new Set(parseBadgeIds(input.badges));
    const unlocked = [];
    let xpBonus = 0;
    for (const def of ACHIEVEMENT_DEFINITIONS) {
        if (def.comingSoon || owned.has(def.id))
            continue;
        const value = metricValue(def.metric, stats, xpBeforeAchievements);
        if (value < def.threshold)
            continue;
        owned.add(def.id);
        xpBonus += def.xpReward;
        unlocked.push({
            id: def.id,
            emoji: def.emoji,
            title: def.title,
            description: def.description,
            xp_reward: def.xpReward,
        });
    }
    const xpTotal = xpBeforeAchievements + xpBonus;
    const xpBalance = Math.max(0, Math.floor(input.xpBalance)) + xpBonus;
    return {
        badges: [...owned],
        xpTotal,
        xpBalance,
        unlocked,
        xpFromAchievements: xpBonus,
        stats: buildProfileStats({
            progress: input.progress,
            booksRead: input.booksRead,
            favorites: input.favorites,
            xpTotal,
        }),
    };
}
export { countPagesRead, countReadingHours };
