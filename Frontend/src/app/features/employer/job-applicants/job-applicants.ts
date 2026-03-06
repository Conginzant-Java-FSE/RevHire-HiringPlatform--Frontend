import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgClass, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApplicationService } from '../../../core/services/application.service';
import { AuthService } from '../../../core/services/auth.service';
import { SavedResumeService } from '../../../core/services/saved-resume.service';
import { Application, ApplicationStatus } from '../../../core/models/application.model';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge';
import { SeekerService } from '../../../core/services/seeker.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
    selector: 'app-job-applicants',
    standalone: true,
    imports: [RouterLink, NgClass, StatusBadgeComponent, FormsModule, DatePipe],
    templateUrl: './job-applicants.html',
    styleUrl: './job-applicants.css'
})
export class JobApplicantsComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private appService = inject(ApplicationService);
    private auth = inject(AuthService);
    private savedResumeService = inject(SavedResumeService);
    private seekerService = inject(SeekerService);
    private toast = inject(ToastService);

    loading = signal(true);
    applicants = signal<Application[]>([]);
    filteredApplicants = signal<Application[]>([]);
    statusFilter = signal('ALL');
    currentJobId: number | null = null;
    savedResumeIds = signal<Set<string>>(new Set());

    // Advanced Filters
    searchTerm = signal('');
    skillFilter = signal('');
    expFilters = signal<string[]>([]);
    eduFilters = signal<string[]>([]);
    appliedAfter = signal('');
    showFilters = signal(false);

    experienceOptions = ['Entry', 'Junior', 'Mid', 'Senior', 'Lead', 'Manager'];
    educationOptions = ['Bachelor', 'Master', 'PhD', 'Diploma', 'Certification'];

    showExpMenu = signal(false);
    showEduMenu = signal(false);

    // Bulk update
    selectedIds = signal<Set<number>>(new Set());
    bulkStatus: string = '';
    allSelected = computed(() =>
        this.filteredApplicants().length > 0 &&
        this.filteredApplicants().every((a: Application) => this.selectedIds().has(a.id))
    );

    // Notes panel toggle
    openNotes = signal<Set<number>>(new Set());

    ngOnInit(): void {
        const user = this.auth.currentUser();
        this.route.queryParams.subscribe(params => {
            this.currentJobId = params['jobId'] ? Number(params['jobId']) : null;
            if (user) {
                this.appService.getApplicationsByEmployer(user.id).subscribe(apps => {
                    let list = apps;
                    if (this.currentJobId) {
                        list = list.filter(a => a.jobId === this.currentJobId);
                    }
                    this.applicants.set(list);
                    this.applyFilters();
                    this.loading.set(false);
                });

                // Load saved resumes to check status
                this.savedResumeService.getSavedResumes().subscribe(resumes => {
                    this.savedResumeIds.set(new Set(
                        resumes
                            .filter(r => r?.jobId != null)
                            .map(r => this.savedKey(r.id, r.jobId))
                    ));
                });
            }
        });
    }

    refresh(): void {
        this.loading.set(true);
        const user = this.auth.currentUser();
        if (user) {
            this.appService.getApplicationsByEmployer(user.id).subscribe(apps => {
                let list = apps;
                if (this.currentJobId) {
                    list = list.filter(a => a.jobId === this.currentJobId);
                }
                this.applicants.set(list);
                this.applyFilters();
                this.loading.set(false);
            });
        }
    }

    applyFilters(): void {
        const search = this.searchTerm().toLowerCase().trim();
        const skill = this.skillFilter().toLowerCase().trim();
        const selectedExp = this.expFilters();
        const selectedEdu = this.eduFilters();
        const status = this.statusFilter();
        const date = this.appliedAfter();

        let filtered = this.applicants();

        // Status Filter
        if (status !== 'ALL') {
            filtered = filtered.filter(a => a.status === status);
        }

        // Search (Name/Email)
        if (search) {
            filtered = filtered.filter(a =>
                a.jobSeekerName.toLowerCase().includes(search) ||
                a.jobSeekerEmail.toLowerCase().includes(search)
            );
        }

        // Skill Filter
        if (skill) {
            filtered = filtered.filter(a =>
                a.jobSeekerSkills?.toLowerCase().includes(skill)
            );
        }

        // Experience Filter (Multi-select)
        if (selectedExp.length > 0) {
            filtered = filtered.filter(a => {
                const text = a.jobSeekerExperience?.toLowerCase() || '';
                return selectedExp.some(exp => text.includes(exp.toLowerCase()));
            });
        }

        // Education Filter (Multi-select)
        if (selectedEdu.length > 0) {
            filtered = filtered.filter(a => {
                const text = a.jobSeekerEducation?.toLowerCase() || '';
                return selectedEdu.some(edu => text.includes(edu.toLowerCase()));
            });
        }

        // Date Filter
        if (date) {
            const afterDate = new Date(date);
            filtered = filtered.filter(a => {
                if (!a.appliedAt) return false;
                const appDate = new Date(a.appliedAt);
                return appDate >= afterDate;
            });
        }

        this.filteredApplicants.set(filtered);
    }

    toggleExp(val: string): void {
        this.expFilters.update(curr =>
            curr.includes(val) ? curr.filter(v => v !== val) : [...curr, val]
        );
        this.applyFilters();
    }

    toggleEdu(val: string): void {
        this.eduFilters.update(curr =>
            curr.includes(val) ? curr.filter(v => v !== val) : [...curr, val]
        );
        this.applyFilters();
    }

    resetFilters(): void {
        this.searchTerm.set('');
        this.skillFilter.set('');
        this.expFilters.set([]);
        this.eduFilters.set([]);
        this.appliedAfter.set('');
        this.statusFilter.set('ALL');
        this.showExpMenu.set(false);
        this.showEduMenu.set(false);
        this.applyFilters();
    }

    updateStatus(appId: number, status: ApplicationStatus | string): void {
        const normalizedStatus = String(status).toUpperCase() as ApplicationStatus;
        this.appService.updateStatus(appId, normalizedStatus).subscribe({
            next: () => {
                this.applicants.update(list => {
                    const item = list.find(a => a.id === appId);
                    if (item) {
                        item.status = normalizedStatus;
                    }
                    return [...list];
                });
                this.applyFilters();
                this.toast.success(`Status updated to ${normalizedStatus}`);
            },
            error: (err) => {
                const msg =
                    (typeof err?.error === 'string' && err.error) ||
                    err?.error?.message ||
                    err?.message ||
                    'Failed to update status. Please try again.';
                this.toast.error(msg);
                console.error('Status update error:', err);
            }
        });
    }

    downloadResume(app: Application): void {
        this.seekerService.downloadResume(app.jobSeekerId).subscribe({
            next: (blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Resume_${app.jobSeekerName.replace(/\s+/g, '_')}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            },
            error: (err) => {
                this.toast.error('Could not download resume. No file found.');
            }
        });
    }

    // Bulk selection
    toggleSelect(id: number): void {
        this.selectedIds.update(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    }
    toggleSelectAll(): void {
        if (this.allSelected()) {
            this.selectedIds.set(new Set());
        } else {
            this.selectedIds.set(new Set(this.filteredApplicants().map(a => a.id)));
        }
    }
    clearSelection(): void { this.selectedIds.set(new Set()); this.bulkStatus = ''; }

    applyBulkStatus(): void {
        if (!this.bulkStatus) return;
        const status = String(this.bulkStatus).toUpperCase() as ApplicationStatus;
        // Filter out applications that are already WITHDRAWN to prevent updating them
        const validIds = Array.from(this.selectedIds()).filter((id: number) => {
            const app = this.applicants().find((a: Application) => a.id === id);
            return app && app.status !== 'WITHDRAWN';
        });

        if (validIds.length === 0) {
            this.toast.warning('No valid applications selected for update.');
            this.clearSelection();
            return;
        }

        this.appService.updateBulkStatus(validIds, status).subscribe({
            next: (updatedApps) => {
                this.applicants.update(list => {
                    validIds.forEach(id => {
                        const item = list.find(a => a.id === id);
                        if (item) item.status = status;
                    });
                    return [...list];
                });
                const count = validIds.length;
                this.clearSelection();
                this.applyFilters();
                this.toast.success(`${count} application(s) updated to ${status}`);
            },
            error: (err) => {
                const msg =
                    (typeof err?.error === 'string' && err.error) ||
                    err?.error?.message ||
                    err?.message ||
                    'Failed to update bulk status';
                this.toast.error(msg);
                console.error('Bulk update error:', err);
            }
        });
    }

    // Notes
    toggleNotes(appId: number): void {
        this.openNotes.update(s => { const n = new Set(s); n.has(appId) ? n.delete(appId) : n.add(appId); return n; });
    }
    saveNote(app: Application, note: string): void {
        this.appService.addNote(app.id, note).subscribe(() => {
            app.notes = note;
            this.toast.success('Note saved');
        });
    }

    // Saved Resumes
    isResumeSaved(seekerId: number, jobId: number): boolean {
        return this.savedResumeIds().has(this.savedKey(seekerId, jobId));
    }

    toggleSaveResume(app: Application): void {
        const seekerId = app.jobSeekerId;
        const key = this.savedKey(seekerId, app.jobId);
        const exists = this.savedResumeIds().has(key);

        // Optimistic Update
        this.savedResumeIds.update(set => {
            const n = new Set(set);
            exists ? n.delete(key) : n.add(key);
            return n;
        });

        if (exists) {
            this.savedResumeService.unsaveResume(seekerId, app.jobId).subscribe({
                next: () => this.toast.success(`Removed from saved.`),
                error: () => {
                    this.toast.error('Failed to unsave');
                    // Rollback
                    this.savedResumeIds.update(set => { const n = new Set(set); n.add(key); return n; });
                }
            });
        } else {
            this.savedResumeService.saveResume(seekerId, app.jobId).subscribe({
                next: () => this.toast.success(`Resume saved!`),
                error: () => {
                    this.toast.error('Failed to save');
                    // Rollback
                    this.savedResumeIds.update(set => { const n = new Set(set); n.delete(key); return n; });
                }
            });
        }
    }

    private savedKey(seekerId: number, jobId: number): string {
        return `${seekerId}-${jobId}`;
    }
}
