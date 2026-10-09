/** List contract shared by every read view: one page of rows plus the total row count. */
export interface Page<T> {
  items: T[];
  total: number;
  /** 0-based page index. */
  page: number;
  size: number;
}

/**
 * Paging and sorting parameters every list endpoint accepts.
 * `sort` is `campo,asc` or `campo,desc`, using the view's own column name.
 */
export interface PageQuery {
  page: number;
  size: number;
  sort?: string;
}

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
