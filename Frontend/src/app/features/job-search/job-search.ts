import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass, TitleCasePipe } from '@angular/common';
import { JobService } from '../../core/services/job.service';
import { Job, JobFilter } from '../../core/models/job.model';
import { JobCardComponent } from '../../shared/components/job-card/job-card';
import { ToastService } from '../../core/services/toast.service';

@Component({
    selector: 'app-job-search',
    standalone: true,
    imports: [RouterLink, FormsModule, NgClass, TitleCasePipe, JobCardComponent],
    templateUrl: './job-search.html',
    styleUrl: './job-search.css'
})
export class JobSearchComponent implements OnInit {
    private jobService = inject(JobService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private toastService = inject(ToastService);

    loading = signal(true);
    allJobs = signal<Job[]>([]);
    filteredJobs = signal<Job[]>([]);

    keyword = '';
    locationFilter = '';
    selectedCategory = '';
    selectedTypes: string[] = [];
    selectedLevels: string[] = [];
    salaryMin = 0;
    sortBy = 'recent';

    jobTypes = [
        { value: 'FULL_TIME', label: 'Full Time' },
        { value: 'PART_TIME', label: 'Part Time' },
        { value: 'REMOTE', label: 'Remote' },
        { value: 'CONTRACT', label: 'Contract' },
        { value: 'INTERNSHIP', label: 'Internship' },
    ];

    categories = [
        { value: 'TECHNOLOGY', label: 'Technology', icon: '💻' },
        { value: 'DESIGN', label: 'Design', icon: '🎨' },
        { value: 'FINANCE', label: 'Finance', icon: '📊' },
        { value: 'MARKETING', label: 'Marketing', icon: '📣' },
        { value: 'HEALTHCARE', label: 'Healthcare', icon: '🏥' },
        { value: 'OPERATIONS', label: 'Operations', icon: '⚙️' },
    ];

    expLevels = [
        { value: 'ENTRY', label: 'Entry Level (0 - 1 yrs)' },
        { value: 'MID', label: 'Mid Level (1 - 3 yrs)' },
        { value: 'SENIOR', label: 'Senior Level (3 - 5 yrs)' },
        { value: 'LEAD', label: 'Lead / Manager (5+ yrs)' }
    ];

    ngOnInit(): void {
        this.route.queryParams.subscribe(params => {
            this.keyword = params['keyword'] || '';
            this.locationFilter = params['location'] || '';
            this.selectedCategory = params['category'] || '';
            this.doSearch();
        });
    }

    doSearch(): void {
        this.loading.set(true);

        // Map experience levels to numerical years (max requirement)
        let expYears: number | undefined = undefined;
        if (this.selectedLevels.length > 0) {
            const levels = this.selectedLevels.map(lvl => {
                if (lvl === 'ENTRY') return 2;
                if (lvl === 'MID') return 5;
                if (lvl === 'SENIOR') return 10;
                if (lvl === 'LEAD') return 20;
                return 0;
            });
            expYears = Math.max(...levels);
        }

        const filter: JobFilter = {
            keyword: this.keyword || undefined,
            location: this.locationFilter || undefined,
            category: (this.selectedCategory || undefined) as any,
            types: this.selectedTypes.length > 0 ? (this.selectedTypes as any) : undefined,
            experienceLevel: expYears,
            salaryMin: this.salaryMin || undefined,
        };

        this.jobService.searchJobs(filter).subscribe({
            next: (jobs) => {
                this.allJobs.set(jobs);
                this.filteredJobs.set(jobs);
                this.sortJobs();
                this.loading.set(false);
            },
            error: (err) => {
                this.toastService.error('Failed to load jobs');
                this.loading.set(false);
            }
        });
    }

    sortJobs(): void {
        let sorted = [...this.allJobs()];
        if (this.sortBy === 'recent') {
            sorted.sort((a, b) => new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime());
        } else if (this.sortBy === 'salary_high') {
            sorted.sort((a, b) => {
                const salA = parseInt(a.salary.replace(/[^0-9]/g, '')) || 0;
                const salB = parseInt(b.salary.replace(/[^0-9]/g, '')) || 0;
                return salB - salA;
            });
        } else if (this.sortBy === 'applicants') {
            // This would ideally be a back-end property, but if we have the applications list 
            // or a count from the backend, we would use it here. 
            // Mocking for now if property doesn't exist.
            sorted.sort((a, b) => (b as any).applicationCount - (a as any).applicationCount);
        }
        this.filteredJobs.set(sorted);
    }

    toggleType(type: string): void {
        const idx = this.selectedTypes.indexOf(type);
        if (idx >= 0) this.selectedTypes.splice(idx, 1);
        else this.selectedTypes.push(type);
        this.doSearch();
    }

    toggleLevel(lvl: string): void {
        const idx = this.selectedLevels.indexOf(lvl);
        if (idx >= 0) this.selectedLevels.splice(idx, 1);
        else this.selectedLevels.push(lvl);
        this.doSearch();
    }

    toggleCategory(cat: string): void {
        this.selectedCategory = this.selectedCategory === cat ? '' : cat;
        this.doSearch();
    }

    clearFilters(): void {
        this.keyword = '';
        this.locationFilter = '';
        this.selectedCategory = '';
        this.selectedTypes = [];
        this.selectedLevels = [];
        this.salaryMin = 0;
        this.doSearch();
    }

    onSaveToggle(jobId: number): void {
        this.jobService.toggleSave(jobId).subscribe({
            next: (isSaved) => {
                this.toastService.success(isSaved ? 'Job bookmarked' : 'Bookmark removed');
            },
            error: (err) => {
                this.toastService.error(err.error || 'Failed to update bookmark. Please login.');
            }
        });
    }
}
