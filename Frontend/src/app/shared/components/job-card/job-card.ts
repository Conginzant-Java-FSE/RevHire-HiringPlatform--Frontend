import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass, SlicePipe } from '@angular/common';
import { Job } from '../../../core/models/job.model';
import { JobService } from '../../../core/services/job.service';

@Component({
    selector: 'app-job-card',
    standalone: true,
    imports: [RouterLink, NgClass, SlicePipe],
    templateUrl: './job-card.html',
    styleUrl: './job-card.css'
})
export class JobCardComponent {
    @Input({ required: true }) job!: Job;
    @Input() flat = false;
    @Output() saveToggle = new EventEmitter<number>();

    jobService = inject(JobService);
    flipped = signal(false);

    toggleFlip(): void {
        if (!this.flat) {
            this.flipped.set(!this.flipped());
        }
    }

    toggleSave(event: Event): void {
        event.preventDefault();
        event.stopPropagation();
        this.saveToggle.emit(this.job.id);
    }

    displayEducation(): string {
        const raw = (this.job.education || '').trim();
        if (raw) {
            const normalized = raw.toUpperCase();
            const map: Record<string, string> = {
                HIGH_SCHOOL: 'High School',
                ASSOCIATE: 'Associate Degree',
                BACHELOR: "Bachelor's Degree",
                BACHELORS: "Bachelor's Degree",
                MASTER: "Master's Degree",
                MASTERS: "Master's Degree",
                PHD: 'PhD / Doctorate'
            };
            return map[normalized] || raw;
        }

        const probe = `${this.job.requirements || ''} ${this.job.description || ''}`.toLowerCase();
        if (/\bb\.?\s?tech\b|\bbtech\b/.test(probe)) return 'BTech';
        if (/\bb\.?\s?e\b|\bbe\b/.test(probe)) return 'BE';
        if (/\bbachelor|bsc|bca|bcom\b/.test(probe)) return "Bachelor's Degree";
        if (/\bmaster|msc|mca|mba|m\.?\s?tech\b/.test(probe)) return "Master's Degree";
        if (/\bphd|doctorate\b/.test(probe)) return 'PhD / Doctorate';
        if (/\bdiploma\b/.test(probe)) return 'Diploma';
        if (/\bhigh school|12th|intermediate\b/.test(probe)) return 'High School';

        return 'Not specified by employer';
    }
}
