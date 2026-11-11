// ANCHOR: concaténation de classes conditionnelles, sans dépendance externe.
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
