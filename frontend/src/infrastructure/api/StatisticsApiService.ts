/**
 * Fetches real statistics from the backend API.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export type StatisticsSummary = {
    totalActive: number;
    criticalPatients: number;
    averageWaitTime: number;
    attendedToday: number;
};

export type StatisticsByLevelItem = {
    level: string;
    count: number;
};

export type TopComplaintItem = {
    complaint: string;
    count: number;
};

export type WaitByLevelItem = {
    level: string;
    actual: number;
    recommended: number;
};

export type StatisticsPeriod = 'today' | 'week' | 'month';

const DEFAULT_SUMMARY: StatisticsSummary = {
    totalActive: 0,
    criticalPatients: 0,
    averageWaitTime: 0,
    attendedToday: 0,
};

const DEFAULT_BY_LEVEL: StatisticsByLevelItem[] = [
    { level: 'Nivel 1', count: 0 },
    { level: 'Nivel 2', count: 0 },
    { level: 'Nivel 3', count: 0 },
    { level: 'Nivel 4', count: 0 },
    { level: 'Nivel 5', count: 0 },
];

const DEFAULT_WAIT_BY_LEVEL: WaitByLevelItem[] = [
    { level: 'Nivel 1', actual: 0, recommended: 0 },
    { level: 'Nivel 2', actual: 0, recommended: 10 },
    { level: 'Nivel 3', actual: 0, recommended: 30 },
    { level: 'Nivel 4', actual: 0, recommended: 60 },
    { level: 'Nivel 5', actual: 0, recommended: 120 },
];

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

export class StatisticsApiService {
    async getSummary(period: StatisticsPeriod = 'today'): Promise<StatisticsSummary> {
        try {
            const response = await fetch(`${API_URL}/api/statistics/summary?period=${period}`);
            if (!response.ok) {
                throw new Error('Failed to load statistics summary');
            }

            const data = (await response.json()) as unknown;
            if (!isObject(data)) {
                return DEFAULT_SUMMARY;
            }

            return {
                totalActive: Number(data.totalActive ?? 0),
                criticalPatients: Number(data.criticalPatients ?? 0),
                averageWaitTime: Number(data.averageWaitTime ?? 0),
                attendedToday: Number(data.attendedToday ?? 0),
            };
        }
        catch (error) {
            console.error('StatisticsApiService.getSummary error:', error);
            return DEFAULT_SUMMARY;
        }
    }

    async getByLevel(period: StatisticsPeriod = 'today'): Promise<StatisticsByLevelItem[]> {
        try {
            const response = await fetch(`${API_URL}/api/statistics/by-level?period=${period}`);
            if (!response.ok) {
                throw new Error('Failed to load statistics by level');
            }

            const data = (await response.json()) as unknown;
            if (!Array.isArray(data)) {
                return DEFAULT_BY_LEVEL;
            }

            const mapped = data
                .filter(isObject)
                .map(item => ({
                    level: String(item.level ?? ''),
                    count: Number(item.count ?? 0),
                }))
                .filter(item => item.level.length > 0);

            return mapped.length > 0 ? mapped : DEFAULT_BY_LEVEL;
        }
        catch (error) {
            console.error('StatisticsApiService.getByLevel error:', error);
            return DEFAULT_BY_LEVEL;
        }
    }

    async getTopComplaints(period: StatisticsPeriod = 'today'): Promise<TopComplaintItem[]> {
        try {
            const response = await fetch(`${API_URL}/api/statistics/top-complaints?period=${period}`);
            if (!response.ok) {
                throw new Error('Failed to load top complaints');
            }

            const data = (await response.json()) as unknown;
            if (!Array.isArray(data)) {
                return [];
            }

            return data
                .filter(isObject)
                .map(item => ({
                    complaint: String(item.complaint ?? ''),
                    count: Number(item.count ?? 0),
                }))
                .filter(item => item.complaint.length > 0)
                .slice(0, 5);
        }
        catch (error) {
            console.error('StatisticsApiService.getTopComplaints error:', error);
            return [];
        }
    }

    async getWaitByLevel(period: StatisticsPeriod = 'today'): Promise<WaitByLevelItem[]> {
        try {
            const response = await fetch(`${API_URL}/api/statistics/wait-by-level?period=${period}`);
            if (!response.ok) {
                throw new Error('Failed to load wait time by level');
            }

            const data = (await response.json()) as unknown;
            if (!Array.isArray(data)) {
                return DEFAULT_WAIT_BY_LEVEL;
            }

            const mapped = data
                .filter(isObject)
                .map(item => ({
                    level: String(item.level ?? ''),
                    actual: Number(item.actual ?? 0),
                    recommended: Number(item.recommended ?? 0),
                }))
                .filter(item => item.level.length > 0);

            return mapped.length > 0 ? mapped : DEFAULT_WAIT_BY_LEVEL;
        }
        catch (error) {
            console.error('StatisticsApiService.getWaitByLevel error:', error);
            return DEFAULT_WAIT_BY_LEVEL;
        }
    }
}
