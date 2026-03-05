import { Component, OnInit, inject, signal } from '@angular/core';
import { NgClass, NgFor, NgIf, DatePipe, AsyncPipe, NgTemplateOutlet, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { InterviewPrepService, InterviewQuestion } from '../../../core/services/interview-prep.service';
import { ApplicationService } from '../../../core/services/application.service';

@Component({
    selector: 'app-interview-prep',
    standalone: true,
    imports: [RouterLink, RouterLinkActive, NgClass, NgFor, NgIf, DatePipe, FormsModule, AsyncPipe, NgTemplateOutlet, TitleCasePipe],
    templateUrl: './interview-prep.html',
    styleUrl: './interview-prep.css'
})
export class InterviewPrepComponent implements OnInit {
    private prepService = inject(InterviewPrepService);
    private route = inject(ActivatedRoute);
    private appService = inject(ApplicationService);

    roles = signal<string[]>([]);
    skills = signal<string[]>([]);

    selectedType = signal<'ROLE' | 'SKILL' | 'HR'>('ROLE');
    selectedCategory = signal<string>('');

    // Grouping questions by difficulty
    basicQuestions = signal<InterviewQuestion[]>([]);
    moderateQuestions = signal<InterviewQuestion[]>([]);
    advancedQuestions = signal<InterviewQuestion[]>([]);

    questions = signal<InterviewQuestion[]>([]); // Keep for backward compatibility or simple lists
    loading = signal<boolean>(true);

    // Track user's applied roles
    appliedRoles = signal<string[]>([]);

    ngOnInit() {
        this.loadFilterOptions();
        this.loadAppliedRoles();

        // Check if a role or skill was passed in the URL (e.g. from My Applications)
        this.route.queryParams.subscribe(params => {
            const roleParam = params['role'];
            const skillParam = params['skill'];
            const hrParam = params['hr'];

            if (roleParam) {
                this.selectedType.set('ROLE');
                this.selectedCategory.set(roleParam);
            } else if (skillParam) {
                this.selectedType.set('SKILL');
                this.selectedCategory.set(skillParam);
            } else if (hrParam) {
                this.selectedType.set('HR');
                this.selectedCategory.set('HR Interview');
            }

            // If we have an initial selection, fetch the questions
            if (this.selectedCategory() || this.selectedType() === 'HR') {
                // Use a small timeout to let the options load first so the dropdown matches
                setTimeout(() => this.fetchQuestions(), 100);
            }
        });
    }

    loadFilterOptions() {
        this.prepService.getAvailableRoles().subscribe(roles => this.roles.set(roles));
        this.prepService.getAvailableSkills().subscribe(skills => this.skills.set(skills));
    }

    loadAppliedRoles() {
        this.appService.getMyApplications().subscribe({
            next: (apps) => {
                // Extract unique job titles from applications
                const titles = apps.map(app => app.jobTitle);
                const uniqueTitles = [...new Set(titles)];
                this.appliedRoles.set(uniqueTitles);
            },
            error: (err) => {
                console.error('Failed to load user applications', err);
            }
        });
    }

    onTypeChange(type: 'ROLE' | 'SKILL' | 'HR') {
        this.selectedType.set(type);
        if (type === 'HR') {
            this.selectedCategory.set('HR Interview');
            this.fetchQuestions();
        } else {
            this.selectedCategory.set(''); // Reset category when switching type
            this.questions.set([]);
            this.basicQuestions.set([]);
            this.moderateQuestions.set([]);
            this.advancedQuestions.set([]);
        }
    }

    fetchQuestions() {
        if (!this.selectedCategory() && this.selectedType() !== 'HR') return;

        this.loading.set(true);

        const obs$ = this.selectedType() === 'ROLE'
            ? this.prepService.getQuestionsByRole(this.selectedCategory())
            : this.selectedType() === 'SKILL'
                ? this.prepService.getQuestionsBySkill(this.selectedCategory())
                : this.prepService.getHRQuestions();

        obs$.subscribe({
            next: (data) => {
                // If it's a role, let's do a soft-match incase the DB job title doesn't exactly match the JSON keys
                if (this.selectedType() === 'ROLE' && data.length === 0) {
                    this.prepService.getInterviewData().subscribe(fullData => {
                        const target = this.selectedCategory().toLowerCase();
                        let foundQuestions: InterviewQuestion[] = [];

                        Object.keys(fullData.roles).forEach(key => {
                            if (target.includes(key.toLowerCase()) || key.toLowerCase().includes(target)) {
                                foundQuestions = [...foundQuestions, ...fullData.roles[key]];
                            }
                        });

                        if (foundQuestions.length > 0) {
                            this.processQuestions(foundQuestions);
                        } else {
                            this.clearQuestions();
                            this.loading.set(false);
                        }
                    });
                    return;
                }

                this.processQuestions(data);
            },
            error: (err) => {
                console.error('Failed to load questions', err);
                this.clearQuestions();
                this.loading.set(false);
            }
        });
    }

    private clearQuestions() {
        this.questions.set([]);
        this.basicQuestions.set([]);
        this.moderateQuestions.set([]);
        this.advancedQuestions.set([]);
    }

    private processQuestions(data: InterviewQuestion[]) {
        // Map over data and add an answer hint to legacy objects missing the new param
        const annotatedData = data.map(q => ({
            ...q,
            answer: q.answer || "This is a comprehensive, mock answer designed to help you prepare. In a real scenario, you would expand on the core concepts mentioned in the hint and provide practical examples from your experience.",
            show: false
        }));

        this.questions.set(annotatedData);

        // Categorize by difficulty
        this.basicQuestions.set(annotatedData.filter(q => q.difficulty === 'BASIC'));
        this.moderateQuestions.set(annotatedData.filter(q => q.difficulty === 'MODERATE'));
        this.advancedQuestions.set(annotatedData.filter(q => q.difficulty === 'ADVANCED'));

        this.loading.set(false);
    }
}
