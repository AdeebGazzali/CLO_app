import { useState, useEffect } from 'react';

export interface SriLankaHoliday {
    uid: string;
    summary: string;
    categories: string[];
    start: string;
    end: string;
}

const cache: Record<number, SriLankaHoliday[] | undefined> = {};
const pendingRequests: Record<number, Promise<SriLankaHoliday[]> | undefined> = {};

const fetchHolidaysForYear = async (year: number): Promise<SriLankaHoliday[]> => {
    const cached = cache[year];
    if (cached) {
        return cached;
    }
    
    const pending = pendingRequests[year];
    if (pending) {
        return pending;
    }

    const request = fetch(`https://raw.githubusercontent.com/Dilshan-H/srilanka-holidays/main/json/${year}.json`)
        .then(res => {
            if (!res.ok) {
                if (res.status === 404) {
                    return [];
                }
                throw new Error(`Failed to fetch holidays for ${year}`);
            }
            return res.json();
        })
        .then(data => {
            cache[year] = data;
            return data;
        })
        .finally(() => {
            delete pendingRequests[year];
        });

    pendingRequests[year] = request;
    return request;
};

export function useSriLankaHolidays(currentDate: Date) {
    const [holidays, setHolidays] = useState<SriLankaHoliday[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let isMounted = true;

        const loadHolidays = async () => {
            setLoading(true);
            try {
                const year = currentDate.getFullYear();
                const month = currentDate.getMonth();

                const yearsToFetch = new Set<number>([year]);

                // Handle year boundaries for month view display
                if (month === 11) { // December
                    yearsToFetch.add(year + 1);
                } else if (month === 0) { // January
                    yearsToFetch.add(year - 1);
                }

                const fetchPromises = Array.from(yearsToFetch).map(y => fetchHolidaysForYear(y));
                const results = await Promise.all(fetchPromises);
                
                if (isMounted) {
                    // Flatten the array of arrays
                    setHolidays(results.flat());
                    setError(null);
                }
            } catch (err: any) {
                if (isMounted) {
                    setError(err);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        loadHolidays();

        return () => {
            isMounted = false;
        };
    }, [currentDate.getFullYear(), currentDate.getMonth()]); // Re-run if year or month changes, as we might need to fetch boundary years

    return { holidays, loading, error };
}
