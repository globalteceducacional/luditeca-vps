import { jsonSafe } from './serialize.js';
export function activityToApi(row) {
    return jsonSafe({
        id: row.id,
        title: row.title,
        description: row.description,
        icon: row.icon,
        type: row.type,
        questions: row.questions,
        is_published: row.isPublished,
        badge_reward: row.badgeReward,
        book_id: row.bookId != null ? String(row.bookId) : null,
        sort_order: row.sortOrder,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
    });
}
export function librasLessonToApi(row) {
    return jsonSafe({
        id: row.id,
        word: row.word,
        category: row.category,
        image_url: row.imageUrl,
        description: row.description,
        quiz_question: row.quizQuestion,
        quiz_options: row.quizOptions,
        quiz_correct: row.quizCorrect,
        sort_order: row.sortOrder,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
    });
}
export function puzzleGameToApi(row) {
    return jsonSafe({
        id: row.id,
        title: row.title,
        description: row.description,
        image_url: row.imageUrl,
        piece_count: row.pieceCount,
        caption: row.caption,
        is_published: row.isPublished,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
    });
}
export function coloringPageToApi(row) {
    return jsonSafe({
        id: row.id,
        title: row.title,
        image_url: row.imageUrl,
        default_id: row.defaultId,
        svg_type: row.svgType,
        is_published: row.isPublished,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
    });
}
export function listEnvelope(data, total, limit, offset) {
    return jsonSafe({ data, total, limit, skip: offset });
}
