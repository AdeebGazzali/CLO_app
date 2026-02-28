

export const generateId = () => Math.random().toString(36).substr(2, 9);
export const getDayName = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' });
export const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
export const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
export const getFirstDayOfMonth = (date: Date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return (day + 6) % 7; // Monday = 0, Sunday = 6
};

export const mergeScheduleWithHolidays = (events: any[], holidays: any[], dateFilter?: string) => {
    const relevantHolidays = dateFilter ? holidays.filter(h => h.start === dateFilter) : holidays;
    
    const holidayBlocks = relevantHolidays.map(h => {
        const isPriority = h.categories.includes('Mercantile') || h.categories.includes('Poya');
        return {
            id: h.uid,
            activity: h.summary,
            type: 'HOLIDAY',
            date: h.start,
            time_range: 'Anytime',
            is_priority: isPriority,
            is_goal: false,
            meta: { isSriLankaHoliday: true, categories: h.categories },
            completed: false // holidays cannot be completed like tasks
        };
    });

    return [...holidayBlocks, ...events];
};

export const getColorForType = (type: string) => {
    if (!type) return 'border-zinc-700 bg-zinc-900/50 text-zinc-300';
    switch (type.toUpperCase()) {
        case 'GENERAL':
        case 'WORK':
        case 'STUDY':
        case 'TRANSIT':
        case 'REST':
        case 'OTHER':
             return 'border-zinc-500 bg-zinc-900/50 text-zinc-100';
        case 'RELIGIOUS':
        case 'SPIRITUAL':
             return 'border-indigo-500 bg-indigo-900/30 text-indigo-100';
        case 'FITNESS':
        case 'PHYSICAL':
             return 'border-emerald-500 bg-emerald-900/30 text-emerald-100';
        case 'COACHING':
             return 'border-amber-500 bg-amber-900/30 text-amber-100';
        case 'CHAOS':
             return 'border-rose-600 bg-rose-900/40 text-rose-100 animate-pulse-slow';
        default: return 'border-zinc-700 bg-zinc-900/50 text-zinc-300';
    }
};

export const INITIAL_SCHEDULE_TEMPLATES: Record<string, any[]> = {
  Monday: [
    { time: '08:30-17:30', activity: 'Office Work', type: 'WORK' },
    { time: '18:20-19:00', activity: 'IFTAAR', type: 'SPIRITUAL' },
    { time: '20:30-22:00', activity: 'Tharaweeh', type: 'SPIRITUAL' },
    { time: '22:15-23:00', activity: 'Gym (Upper Body)', type: 'PHYSICAL' },
    { time: '23:00-00:00', activity: 'Study Block (Assign 1)', type: 'STUDY' },
  ],
  Tuesday: [
    { time: '10:30-12:30', activity: 'Uni Lecture (Mobile App Dev)', type: 'STUDY' },
    { time: '12:30-15:30', activity: 'Rest (Anime / Reading)', type: 'REST' },
    { time: '15:30-17:30', activity: 'Uni Tutorial', type: 'STUDY' },
    { time: '18:20-19:00', activity: 'IFTAAR', type: 'SPIRITUAL' },
    { time: '20:30-22:00', activity: 'Tharaweeh', type: 'SPIRITUAL' },
    { time: '22:15-23:00', activity: 'RUN #1', type: 'PHYSICAL', link: 'fitness' },
  ],
  Wednesday: [
    { time: '08:30-17:30', activity: 'Office Work', type: 'WORK' },
    { time: '18:20-19:00', activity: 'IFTAAR', type: 'SPIRITUAL' },
    { time: '20:30-22:00', activity: 'Tharaweeh', type: 'SPIRITUAL' },
    { time: '22:15-23:45', activity: 'Study Block (Android Dev)', type: 'STUDY' },
  ],
  Thursday: [
    { time: '08:30-17:30', activity: 'Office Work', type: 'WORK' },
    { time: '18:20-19:00', activity: 'IFTAAR', type: 'SPIRITUAL' },
    { time: '20:30-22:00', activity: 'Tharaweeh', type: 'SPIRITUAL' },
    { time: '22:15-23:00', activity: 'RUN #2', type: 'PHYSICAL', link: 'fitness' },
  ],
  Friday: [
    { time: '08:30-17:00', activity: 'Office Work', type: 'WORK' },
    { time: '17:00-18:00', activity: 'Transit to Port City', type: 'TRANSIT' },
    { time: '18:00-21:00', activity: 'Coaching: Savinu', type: 'COACHING', meta: { client: 'Savinu' } },
    { time: '18:20', activity: 'IFTAAR on track', type: 'SPIRITUAL' },
    { time: '20:00-21:00', activity: '⚠️ CHAOS HOUR', type: 'CHAOS' },
    { time: '21:00-22:00', activity: 'Coaching: Umar', type: 'COACHING', meta: { client: 'Umar' } },
    { time: '22:00', activity: 'Track Closed/Home', type: 'TRANSIT' },
  ],
  Saturday: [
    { time: '10:00', activity: 'Sleep In/Recovery', type: 'REST' },
    { time: '10:30-14:00', activity: 'Study & Reading', type: 'STUDY' },
    { time: '14:00-17:00', activity: 'Coaching: Savinu', type: 'COACHING', meta: { client: 'Savinu' } },
    { time: '18:00-20:00', activity: 'Date Night w/ Anali', type: 'REST' },
    { time: '18:20', activity: 'IFTAAR', type: 'SPIRITUAL' },
    { time: '20:00-22:00', activity: 'RUN #3', type: 'PHYSICAL', link: 'fitness' },
  ],
  Sunday: [
    { time: '10:00-13:00', activity: 'Downtime', type: 'REST' },
    { time: '13:00-14:00', activity: 'Prep', type: 'OTHER' },
    { time: '14:00-15:00', activity: 'Transit to Bandaragama', type: 'TRANSIT' },
    { time: '15:00-18:00', activity: 'Coaching: Piers', type: 'COACHING', meta: { client: 'Piers' } },
    { time: '18:00-20:00', activity: 'Transit to Port City', type: 'TRANSIT' },
    { time: '20:00-22:00', activity: 'Coaching: Umar', type: 'COACHING', meta: { client: 'Umar' } },
    { time: '22:00', activity: 'Weekly Review', type: 'STUDY' },
  ],
};

export const generateRecurrencePayloads = (baseData: any, user_id: string, recurrenceRule: string, interval: number, endDateStr?: string, customDays: number[] = []) => {
    const payloads: any[] = [];
    let currentDate = new Date(baseData.date);
    let endDate = endDateStr ? new Date(endDateStr) : new Date(new Date(baseData.date).setMonth(currentDate.getMonth() + 12)); // Cap at 1 year

    const seriesId = crypto.randomUUID();

    while (currentDate <= endDate) {
        // Only push payload if it's not CUSTOM_DAYS, or if it IS CUSTOM_DAYS and today matches the selected days.
        if (recurrenceRule !== 'CUSTOM_DAYS' || customDays.includes(currentDate.getDay())) {
            payloads.push({
                user_id: user_id,
                series_id: seriesId,
                date: formatDate(currentDate),
                activity: baseData.activity,
                time_range: baseData.time_range,
                location: baseData.location,
                type: baseData.type,
                is_priority: baseData.is_priority,
                is_goal: baseData.is_goal,
                end_date: baseData.endDate || null,
                meta: baseData.meta || {},
                completed: false
            });
        }

        // Advance date
        if (recurrenceRule === 'DAILY' || recurrenceRule === 'CUSTOM_DAYS') {
            currentDate.setDate(currentDate.getDate() + 1);
        } else if (recurrenceRule === 'WEEKLY') {
            currentDate.setDate(currentDate.getDate() + 7);
        } else if (recurrenceRule === 'MONTHLY') {
            currentDate.setMonth(currentDate.getMonth() + 1);
        } else if (recurrenceRule === 'CUSTOM') {
            currentDate.setDate(currentDate.getDate() + (interval || 1));
        } else {
            break; // NONE
        }
    }

    // If it was NONE, we still only generated 1 payload above, but we don't need a series ID.
    if (recurrenceRule === 'NONE' && payloads.length > 0) {
        payloads[0].series_id = null;
    }

    return payloads;
};

