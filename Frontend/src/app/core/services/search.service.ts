import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Job } from '../models/job.model';

export interface SearchResult {
    id: number;
    title: string;
    subtitle?: string;
    type: 'JOB' | 'SEEKER';
    link: string;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
    private http = inject(HttpClient);
    private readonly API_URL = `${environment.apiUrl}/search`;

    searchJobs(keyword: string): Observable<any[]> {
        const params = new HttpParams().set('keyword', keyword);
        return this.http.get<any[]>(`${this.API_URL}/jobs`, { params });
    }

    searchSeekers(keyword: string): Observable<any[]> {
        const params = new HttpParams().set('keyword', keyword);
        return this.http.get<any[]>(`${this.API_URL}/seekers`, { params });
    }
}
