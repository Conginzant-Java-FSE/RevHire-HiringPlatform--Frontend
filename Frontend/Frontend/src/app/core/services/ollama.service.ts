import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface OllamaResponse {
    model: string;
    created_at: string;
    message: ChatMessage;
    done: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class OllamaService {
    private http = inject(HttpClient);
    private readonly OLLAMA_URL = 'http://localhost:11434/api/chat';

    private getSystemPrompt(role?: string): string {
        const base = `You are the RevHire AI Assistant, a helpful and professional companion for the RevHire recruitment platform.
        CRITICAL RULE: only provide assistance relevant to the user's current role. Always check the USER ROLE before answering.`;

        if (role === 'JOB_SEEKER') {
            return `${base} 
            USER ROLE: Job Seeker.
            CAPABILITIES: Job searching, applications, resume building, interview preparation, and career advice.
            STRICT RESTRICTION: You MUST NOT provide any information on how to post jobs, manage company profiles, or oversee applicants. These are Employer-only features. If asked about these, politely explain that your current account role is a Job Seeker and does not have access to those features.`;
        } else if (role === 'EMPLOYER') {
            return `${base} 
            USER ROLE: Employer.
            CAPABILITIES: Posting jobs, managing candidates, company profile management, and hiring tips.
            STRICT RESTRICTION: Focus exclusively on recruitment and hiring management. If asked about seeker-specific features like "how to apply", focus your answer on how the employer handles those applications.`;
        }

        return `${base} Your goal is to assist Job Seekers and Employers with their recruitment needs.`;
    }

    chat(messages: ChatMessage[], role?: string): Observable<string> {
        const payload = {
            model: 'llama3.2',
            messages: [
                { role: 'system', content: this.getSystemPrompt(role) },
                ...messages
            ],
            stream: false
        };

        return this.http.post<OllamaResponse>(this.OLLAMA_URL, payload).pipe(
            map(res => res.message.content)
        );
    }
}
