import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return '—';
  try {
    const date = parseISO(dateString);
    return format(date, 'MMM d, yyyy h:mm a');
  } catch {
    return dateString;
  }
}

export function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return '—';
  try {
    const date = parseISO(dateString);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return dateString;
  }
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function parseEmailsFromString(input: string): string[] {
  // Handles comma, newline, semicolon, and space separated emails
  const tokens = input
    .split(/[\r\n,;]+/)
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);

  const validSet = new Set<string>();
  for (const token of tokens) {
    // If it's CSV format like "John Doe,john@example.com", extract the email part
    const emailMatch = token.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch && isValidEmail(emailMatch[0])) {
      validSet.add(emailMatch[0].toLowerCase());
    } else if (isValidEmail(token)) {
      validSet.add(token.toLowerCase());
    }
  }

  return Array.from(validSet);
}
