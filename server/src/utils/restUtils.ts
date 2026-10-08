import Joi from 'joi';

export const PAGINATION_DEFAULT = { limit: 20, offset: 0 };
export const PAGINATION_BOUNDARIES = { limitMin: 1, limitMax: 500 };

export const pagination = {
  schema: {
    limit: Joi.number()
      .integer()
      .min(PAGINATION_BOUNDARIES.limitMin)
      .max(PAGINATION_BOUNDARIES.limitMax)
      .default(PAGINATION_DEFAULT.limit),
    offset: Joi.number().integer().min(0).default(PAGINATION_DEFAULT.offset)
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
  validate: (
    strFields: [string, ...string[]],
    defaultField: string = strFields[0],
    defaultOrder: 'ASC' | 'DESC' = 'DESC'
  ): Record<string, unknown> => {
    return {
      sortField: Joi.string()
        .valid(...strFields)
        .default(defaultField),
      sortOrder: Joi.string().valid('ASC', 'DESC').default(defaultOrder)
    };
  }
};
