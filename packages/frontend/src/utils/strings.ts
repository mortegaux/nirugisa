/**
 * Centralized UI strings — first step toward i18n.
 *
 * MIGRATION PATH:
 * 1. New code should import strings from here instead of hardcoding copy:
 *      import { strings } from '@/utils/strings';
 *      <button>{strings.actions.cancel}</button>
 * 2. When ready for full localization, swap this module for react-i18next
 *    (or similar) — every call site already reads from one place, so only
 *    this file's implementation changes.
 * 3. Don't do a big-bang rewrite of existing call sites; migrate a page
 *    at a time when you're already touching it.
 */
export const strings = {
  actions: {
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    close: 'Close',
    confirm: 'Confirm',
    create: 'Create',
    edit: 'Edit',
    add: 'Add',
    remove: 'Remove',
    retry: 'Retry',
    clear: 'Clear',
    search: 'Search',
  },
  common: {
    loading: 'Loading…',
    noResults: 'No results found. Try adjusting your search.',
    deleteConfirmTitle: 'Are you sure?',
    nameRequired: 'Name is required',
    somethingWentWrong: 'Something went wrong. Please try again.',
    unsavedChanges: 'You have unsaved changes. Discard them?',
  },
  recipes: {
    emptyTitle: 'No recipes yet',
    emptyBody: 'Create your first recipe to get started!',
    emptyFiltered: 'No recipes match your filters. Try adjusting your search.',
    createCta: 'Create Recipe',
  },
  a11y: {
    closeDialog: 'Close dialog',
    clearSearch: 'Clear search',
    moreInfo: 'More information',
    closeNotification: 'Close notification',
  },
} as const;

export type Strings = typeof strings;
