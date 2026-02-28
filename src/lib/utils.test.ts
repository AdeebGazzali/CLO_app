import { expect, test, describe } from 'vitest';
import { getFirstDayOfMonth, mergeScheduleWithHolidays } from './utils';

describe('getFirstDayOfMonth (Monday Start)', () => {
    test('returns 0 for Monday', () => {
        // Sep 1, 2025 is a Monday
        const date = new Date(2025, 8, 1);
        expect(getFirstDayOfMonth(date)).toBe(0);
    });

    test('returns 6 for Sunday', () => {
        // Jun 1, 2025 is a Sunday
        const date = new Date(2025, 5, 1);
        expect(getFirstDayOfMonth(date)).toBe(6);
    });

    test('returns 2 for Wednesday', () => {
        // Jan 1, 2025 is a Wednesday
        const date = new Date(2025, 0, 1);
        expect(getFirstDayOfMonth(date)).toBe(2);
    });
});

describe('mergeScheduleWithHolidays', () => {
    const sampleHolidays = [
        {
            uid: 'h1',
            summary: 'Public Holiday Only',
            categories: ['Public'],
            start: '2026-01-01',
            end: '2026-01-02'
        },
        {
            uid: 'h2',
            summary: 'Mercantile Holiday',
            categories: ['Public', 'Bank', 'Mercantile'],
            start: '2026-01-02',
            end: '2026-01-03'
        },
        {
            uid: 'h3',
            summary: 'Poya Day',
            categories: ['Public', 'Bank', 'Poya'],
            start: '2026-01-03',
            end: '2026-01-04'
        }
    ];

    const sampleEvents = [
        { id: '1', date: '2026-01-02', activity: 'Work' }
    ];

    test('correctly flags priority for Mercantile and Poya days ONLY', () => {
        const results = mergeScheduleWithHolidays([], sampleHolidays);
        
        const h1 = results.find(r => r.id === 'h1');
        const h2 = results.find(r => r.id === 'h2');
        const h3 = results.find(r => r.id === 'h3');

        expect(h1?.is_priority).toBe(false);
        expect(h2?.is_priority).toBe(true);
        expect(h3?.is_priority).toBe(true);
    });

    test('filters holidays by date Filter if provided', () => {
        const results = mergeScheduleWithHolidays(sampleEvents, sampleHolidays, '2026-01-02');
        
        expect(results.length).toBe(2);
        expect(results.some(r => r.id === 'h2')).toBe(true);
        expect(results.some(r => r.id === '1')).toBe(true);
        expect(results.some(r => r.id === 'h1')).toBe(false); // filtered out
    });

    test('includes all events regardless of dateFilter', () => {
        const results = mergeScheduleWithHolidays(sampleEvents, sampleHolidays, '2026-01-01');
        
        expect(results.length).toBe(2);
        expect(results.some(r => r.id === '1')).toBe(true); // event stays
        expect(results.some(r => r.id === 'h1')).toBe(true); // matching holiday
        expect(results.some(r => r.id === 'h2')).toBe(false); // non-matching holiday
    });
});
