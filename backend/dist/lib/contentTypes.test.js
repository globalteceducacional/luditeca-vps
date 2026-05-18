import { describe, expect, it } from 'vitest';
import { ACTIVITY_TYPES, isActivityType, parseBoolean, parsePagination, parsePuzzlePieceCount, PUZZLE_PIECE_COUNTS, validateActivityPayload, validatePuzzlePayload, } from './contentTypes.js';
describe('contentTypes', () => {
    it('isActivityType aceita tipos v1', () => {
        for (const t of ACTIVITY_TYPES) {
            expect(isActivityType(t)).toBe(true);
        }
        expect(isActivityType('matching')).toBe(false);
        expect(isActivityType('')).toBe(false);
    });
    it('parsePuzzlePieceCount só aceita contagens definidas', () => {
        expect(parsePuzzlePieceCount(15)).toBe(15);
        expect(parsePuzzlePieceCount('30')).toBe(30);
        expect(parsePuzzlePieceCount(16)).toBeNull();
        expect(PUZZLE_PIECE_COUNTS).toContain(120);
    });
    it('parseBoolean interpreta strings comuns', () => {
        expect(parseBoolean(true)).toBe(true);
        expect(parseBoolean('1')).toBe(true);
        expect(parseBoolean('false')).toBe(false);
        expect(parseBoolean(undefined)).toBeUndefined();
    });
    it('parsePagination aplica limites', () => {
        const { limit, offset } = parsePagination({ limit: 200, offset: -5 });
        expect(limit).toBe(100);
        expect(offset).toBe(0);
    });
    it('validateActivityPayload exige title e type', () => {
        expect(validateActivityPayload({ title: 'Quiz 1', type: 'quiz', questions: [] }).ok).toBe(true);
        expect(validateActivityPayload({ title: '', type: 'quiz' }).ok).toBe(false);
        expect(validateActivityPayload({ title: 'X', type: 'matching' }).ok).toBe(false);
    });
    it('validatePuzzlePayload exige title, image e piece_count válido', () => {
        const ok = validatePuzzlePayload({
            title: 'Puzzle',
            image_url: 'https://cdn/x.png',
            piece_count: 30,
        });
        expect(ok.ok).toBe(true);
        if (ok.ok)
            expect(ok.value.pieceCount).toBe(30);
        expect(validatePuzzlePayload({ title: 'P', image_url: '' }).ok).toBe(false);
        expect(validatePuzzlePayload({ title: 'P', image_url: 'u', piece_count: 99 }).ok).toBe(false);
    });
});
