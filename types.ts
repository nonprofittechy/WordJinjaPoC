export enum SuggestionStatus {
    Pending,
    Accepted,
    Rejected,
}

export interface Suggestion {
    id: string;
    context: string;
    original: string;
    replacement: string;
    status: SuggestionStatus;
}

export interface AISuggestion {
    context: string;
    original: string;
    replacement: string;
}
