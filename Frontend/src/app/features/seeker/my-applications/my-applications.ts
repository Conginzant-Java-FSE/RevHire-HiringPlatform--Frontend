import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass, DatePipe } from '@angular/common';
import { ApplicationService } from '../../../core/services/application.service';
import { AuthService } from '../../../core/services/auth.service';
import { Application } from '../../../core/models/application.model';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge';
import { JobService } from '../../../core/services/job.service';

@Component({
    selector: 'app-my-applications',
    standalone: true,
    imports: [RouterLink, NgClass, StatusBadgeComponent, DatePipe],
    templateUrl: './my-applications.html',
    styleUrl: './my-applications.css'
})
export class MyApplicationsComponent implements OnInit {
    private appService = inject(ApplicationService);
    private auth = inject(AuthService);
    private jobService = inject(JobService);

    loading = signal(true);
    applications = signal<Application[]>([]);
    activeFilter = signal<string>('ALL');
    expandedId = signal<number | null>(null);

    filters = [
        { id: 'ALL', label: 'All Jobs' },
        { id: 'APPLIED', label: 'Applied' },
        { id: 'REVIEWING', label: 'Reviewing' },
        { id: 'SHORTLISTED', label: 'Shortlisted' },
        { id: 'SELECTED', label: 'Selected' },
        { id: 'REJECTED', label: 'Rejected' },
        { id: 'WITHDRAWN', label: 'Withdrawn' },
    ];

    showWithdrawModal = signal(false);
    isWithdrawing = signal(false);
    withdrawReason = signal('');
    selectedApp = signal<Application | null>(null);
    jobDeadlineById = signal<Record<number, string>>({});
    Math = Math;

    ngOnInit(): void {
        const user = this.auth.currentUser();
        if (user) {
            this.appService.getMyApplications().subscribe(apps => {
                this.applications.set(apps);
                this.loading.set(false);
            });

            this.jobService.getAllJobs().subscribe({
                next: (jobs) => {
                    const map: Record<number, string> = {};
                    jobs.forEach(j => map[j.id] = j.deadline);
                    this.jobDeadlineById.set(map);
                },
                error: () => { }
            });
        }
    }

    filteredApps() {
        const filter = this.activeFilter();
        if (filter === 'ALL') return this.applications();
        return this.applications().filter(a => a.status === filter);
    }

    getCount(id: string): number {
        if (id === 'ALL') return this.applications().length;
        return this.applications().filter(a => a.status === id).length;
    }

    toggleExpand(id: number): void {
        this.expandedId.set(this.expandedId() === id ? null : id);
    }

    openWithdrawModal(app: Application): void {
        this.selectedApp.set(app);
        this.withdrawReason.set('');
        this.showWithdrawModal.set(true);
    }

    closeWithdrawModal(): void {
        this.showWithdrawModal.set(false);
        this.selectedApp.set(null);
    }

    confirmWithdraw(): void {
        const app = this.selectedApp();
        if (!app) return;

        this.isWithdrawing.set(true);
        this.appService.withdrawApplication(app.id, this.withdrawReason()).subscribe({
            next: () => {
                this.applications.update(apps =>
                    apps.map(a => a.id === app.id ? { ...a, status: 'WITHDRAWN' as any } : a)
                );
                this.isWithdrawing.set(false);
                this.closeWithdrawModal();
            },
            error: () => {
                this.isWithdrawing.set(false);
            }
        });
    }

    private isDeadlinePassed(jobId: number): boolean {
        const deadlineRaw = this.jobDeadlineById()[jobId];
        if (!deadlineRaw) return false;

        const parsed = new Date(deadlineRaw);
        if (Number.isNaN(parsed.getTime())) return false;

        // If only a date is provided, treat deadline as end of that day.
        const hasTime = /T|\d{1,2}:\d{2}/.test(deadlineRaw);
        if (!hasTime) {
            parsed.setHours(23, 59, 59, 999);
        }

        return Date.now() > parsed.getTime();
    }

    isRegistrationClosed(app: Application): boolean {
        return this.isDeadlinePassed(app.jobId);
    }

    isWithdrawDisabled(app: Application): boolean {
        return ['SELECTED', 'REJECTED', 'WITHDRAWN'].includes(app.status) || this.isDeadlinePassed(app.jobId);
    }
}
