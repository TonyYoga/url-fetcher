export interface UrlFetchResult {
    url: string;
    finalUrl: string | null;
    statusCode: number | null;
    contentType: string | null;
    content: string | null;
    error: string | null;
}

export interface RequestResult {
    id: string;
    createdAt: number;
    urls: string[];
    results: UrlFetchResult[];
}