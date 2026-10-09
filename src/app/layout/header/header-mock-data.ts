import type { IconName } from '../../shared/ui/icon/icon.component';

export interface NotificationItem {
  icon: IconName;
  iconClass: string;
  title: string;
  description: string;
  time: string;
}

/**
 * The original static export ships these dropdown panels empty (no JS ever
 * populated them). Placeholder content standing in until the notifications
 * feed and user-menu links come from the API.
 */
export const HEADER_NOTIFICATIONS: NotificationItem[] = [
  {
    icon: 'lucideShoppingCart',
    iconClass: 'text-chart-1',
    title: 'New order placed',
    description: 'Emma Wilson purchased Pro Dashboard License',
    time: '2 min ago',
  },
  {
    icon: 'lucideUserPlus',
    iconClass: 'text-chart-2',
    title: 'New customer registered',
    description: 'James Chen created an account',
    time: '15 min ago',
  },
  {
    icon: 'lucideStar',
    iconClass: 'text-chart-5',
    title: '5-star review received',
    description: 'Amazing template, exactly what I needed!',
    time: '1 hour ago',
  },
  {
    icon: 'lucideCreditCard',
    iconClass: 'text-chart-3',
    title: 'Payment received',
    description: '$1,499 from Sofia Garcia',
    time: '2 hours ago',
  },
];
