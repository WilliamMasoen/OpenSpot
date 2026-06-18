import { router } from 'expo-router';

let busy = false;

export function navigate(href: Parameters<typeof router.push>[0]): void {
  if (busy) return;
  busy = true;
  router.push(href);
  setTimeout(() => { busy = false; }, 700);
}
