import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { NgClass } from '@angular/common';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
    selector: 'app-employer-notifications',
    standalone: true,
    imports: [NgClass],
    templateUrl: './employer-notifications.html',
    styleUrl: './employer-notifications.css'
})
export class EmployerNotificationsComponent implements OnInit {
    notifService = inject(NotificationService);
    private auth = inject(AuthService);

    showUnreadOnly = signal(false);

    filteredNotifications = computed(() => {
        const notifs = this.notifService.notifications();
        if (this.showUnreadOnly()) {
            return notifs.filter(n => !n.isRead);
        }
        return notifs;
    });

    ngOnInit(): void {
        // Notifications are now loaded proactively by NotificationService effect
    }

    getIcon(type: string): string {
        switch (type) {
            case 'SUCCESS': return 'bi-check-circle-fill';
            case 'WARNING': return 'bi-exclamation-triangle-fill';
            case 'ERROR': return 'bi-x-circle-fill';
            default: return 'bi-info-circle-fill';
        }
    }

    markRead(id: number): void {
        this.notifService.markRead(id).subscribe();
    }

    markAllRead(): void {
        this.notifService.markAllRead().subscribe();
    }
}
