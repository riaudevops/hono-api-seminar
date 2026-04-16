import { Context } from 'hono';

export const zodError = (result: any, c: Context) => {
  if (!result.success) {
    const errors = result.error.issues.map((issue: any) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    return c.json(
      {
        response: false,
        message: 'Format data tidak valid.',
        errors: errors,
      },
      400
    );
  }
};
