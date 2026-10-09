import { z } from 'zod';

export const PAGINATION_DEFAULT = { limit: 20, offset: 0 };
export const PAGINATION_BOUNDARIES = { limitMin: 1, limitMax: 500 };

export const pagination = {
  schema: {
    limit: z.coerce
      .number()
      .int()
      .min(PAGINATION_BOUNDARIES.limitMin)
      .max(PAGINATION_BOUNDARIES.limitMax)
      .default(PAGINATION_DEFAULT.limit),
    offset: z.coerce.number().int().min(0).default(PAGINATION_DEFAULT.offset)
  },
  formatLinkHeader: (count: number, limit: number, offset: number): Record<string, string> => {
    return {
      self: `?limit=${limit}&offset=${offset}`,
      next: `?limit=${limit}&offset=${offset + limit}`,
      last: `?limit=${limit}&offset=${Math.max(0, Math.floor((count - 1) / limit) * limit)}`
    };
  },
  addPaginationHeaders: (
    headers: Record<string, unknown>,
    count: number,
    limit: number,
    offset: number
  ): Record<string, unknown> => {
    return Object.assign(headers, {
      link: JSON.stringify(pagination.formatLinkHeader(count, limit, offset)),
      'X-total-count': String(count)
    });
  }
};

export const sort = {
  fields: <const T extends string>(
    strFields: [T, ...T[]],
    defaultField: T = strFields[0],
    defaultOrder: 'ASC' | 'DESC' = 'DESC'
  ) => ({
    sortField: z.enum(strFields).default(defaultField),
    sortOrder: z.enum(['ASC', 'DESC']).default(defaultOrder)
  })
};
