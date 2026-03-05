import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { CompanyService } from '../../../core/services/company.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { Router } from '@angular/router';
import { LoadingService } from '../../../core/services/loading.service';
import { Company } from '../../../core/models/company.model';

@Component({
    selector: 'app-company-profile',
    standalone: true,
    imports: [ReactiveFormsModule, NgClass],
    templateUrl: './company-profile.html',
    styleUrl: './company-profile.css'
})
export class CompanyProfileComponent implements OnInit {
    private companyService = inject(CompanyService);
    private authService = inject(AuthService);
    private fb = inject(FormBuilder);
    private toast = inject(ToastService);
    private ls = inject(LoadingService);
    private router = inject(Router);

    company = signal<Company | null>(null);
    saving = signal(false);
    selectedTab = signal<'PROFILE' | 'TEAM' | 'SETTINGS' | 'EMPLOYEE_PROFILE'>('PROFILE');
    avatarPreview = signal<string | null>(null);

    companyForm = this.fb.group({
        name: ['', Validators.required],
        description: ['', Validators.required],
        industry: ['', Validators.required],
        website: ['', Validators.required],
        location: [''],
        size: [''],
        userName: ['', Validators.required],
        userEmail: [{ value: '', disabled: true }],
        userPhone: ['', Validators.pattern(/^\d{10}$/)]
    });

    get f() { return this.companyForm.controls; }

    ngOnInit(): void {
        const user = this.authService.currentUser();
        this.avatarPreview.set(user?.avatar || null);

        this.companyService.getCompany().subscribe(company => {
            if (company) {
                this.company.set(company);
                const resolvedEmail = this.resolveEmail(company, user?.email || '');
                this.companyForm.patchValue({ ...company, userEmail: resolvedEmail });
                if (this.companyForm.valid) {
                    this.authService.updateProfileStatus(true);
                }
            } else {
                // Pre-fill from auth if profile not found
                if (user) {
                    this.companyForm.patchValue({
                        name: user.name,
                        userName: user.name,
                        userEmail: user.email
                    });
                }
            }
        });
    }

    onAvatarSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.toast.error('Please select a valid image file.');
            input.value = '';
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            this.toast.error('Image size exceeds 2MB limit');
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = typeof reader.result === 'string' ? reader.result : null;
            if (!dataUrl) {
                this.toast.error('Failed to read selected image.');
                return;
            }

            this.avatarPreview.set(dataUrl);
            this.authService.updateCurrentUser({ avatar: dataUrl });
            this.toast.success('Profile image updated.');
        };
        reader.onerror = () => {
            this.toast.error('Failed to load selected image.');
        };
        reader.readAsDataURL(file);
        input.value = '';
    }

    removeProfileImage(): void {
        if (!this.avatarPreview()) return;
        this.avatarPreview.set(null);
        this.authService.updateCurrentUser({ avatar: undefined });
        this.toast.success('Profile image removed.');
    }

    saveProfile(): void {
        const tab = this.selectedTab();
        const requiredControls = tab === 'EMPLOYEE_PROFILE'
            ? (['userName', 'userPhone'] as const)
            : (['name', 'description', 'industry', 'website'] as const);

        const invalid = requiredControls.some((key) => {
            const control = this.f[key];
            control.markAsTouched();
            return control.invalid;
        });

        if (invalid) {
            return;
        }
        this.saving.set(true);
        this.ls.start();

        const email = (this.companyForm.getRawValue().userEmail || this.resolveEmail(this.company(), this.authService.currentUser()?.email || '')).trim();
        const payload = {
            ...(this.company() || {}),
            ...this.companyForm.getRawValue(),
            email,
            userEmail: email
        } as Company;

        this.companyService.updateCompany(payload).subscribe({
            next: (updated) => {
                this.ls.stop();
                this.saving.set(false);
                this.company.set(updated);
                const resolvedEmail = this.resolveEmail(updated, email);
                this.companyForm.patchValue({ ...updated, userEmail: resolvedEmail });
                this.authService.updateCurrentUser({ email: resolvedEmail });
                const message = this.selectedTab() === 'EMPLOYEE_PROFILE'
                    ? 'Employee profile updated!'
                    : 'Company profile updated!';
                this.toast.success(message);

                // Update auth status to indicate profile is complete
                this.authService.updateProfileStatus(true);
                this.router.navigateByUrl('/employer/dashboard');
            },
            error: (err) => {
                this.ls.stop();
                this.saving.set(false);
                this.toast.error(err.message || 'Failed to update profile');
            }
        });
    }

    private resolveEmail(company: Partial<Company> | null, fallback: string): string {
        return (company?.userEmail || company?.email || fallback || '').trim();
    }
}
