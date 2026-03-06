import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SeekerService } from '../../../core/services/seeker.service';
import { ToastService } from '../../../core/services/toast.service';
import { NgClass } from '@angular/common';

@Component({
    selector: 'app-seeker-profile-view',
    standalone: true,
    imports: [RouterLink, NgClass],
    templateUrl: './seeker-profile-view.html',
    styleUrl: './seeker-profile-view.css'
})
export class SeekerProfileViewComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private seekerService = inject(SeekerService);
    private toast = inject(ToastService);

    loading = signal(true);
    profile = signal<any | null>(null);

    ngOnInit(): void {
        const seekerId = Number(this.route.snapshot.paramMap.get('id'));
        if (!seekerId) {
            this.loading.set(false);
            this.toast.error('Invalid seeker id');
            return;
        }

        this.seekerService.getProfileById(seekerId).subscribe({
            next: (res) => {
                this.profile.set(res);
                this.loading.set(false);
            },
            error: () => {
                this.loading.set(false);
                this.toast.error('Failed to load seeker profile');
            }
        });
    }

    skills(): string[] {
        const p = this.profile();
        if (!p) return [];
        if (Array.isArray(p.skillsList) && p.skillsList.length) {
            return p.skillsList.map((s: any) => s?.name).filter(Boolean);
        }
        if (typeof p.skills === 'string') {
            return p.skills.split(',').map((x: string) => x.trim()).filter(Boolean);
        }
        return [];
    }
}
