import {
  type NextRequest,
  type NextFetchEvent,
  NextResponse,
} from "next/server";
import type { z } from "zod";

const apiZodValidator = <
  SB extends z.AnyZodObject,
  SQP extends z.AnyZodObject,
  SP extends z.AnyZodObject
>(
  config: { body?: SB; queryParams?: SQP; params?: SP },
  handler: (
    req: NextRequest,
    nfe: NextFetchEvent,
    validated: {
      body: z.infer<SB>;
      params: z.infer<SP>;
      queryParams: z.infer<SQP>;
    }
  ) => NextResponse | Promise<NextResponse>
) => {
  const validationError = (type: string, data: z.ZodIssue | undefined) =>
    NextResponse.json(
      {
        type,
        status: "validation_error",
        message: data?.message ?? "",
        path: data?.path ?? [],
      },
      {
        status: 400,
      }
    );

  return async (
    req: NextRequest,
    nfe: NextFetchEvent & { params: unknown }
  ) => {
    const reqClone = req.clone() as NextRequest;

    const validated = {} as {
      body: z.infer<SB>;
      queryParams: z.infer<SQP>;
      params: z.infer<SP>;
    };

    if (config.body) {
      const body = await req.json();
      const bodyParsed = config.body.safeParse(body);

      if (!bodyParsed.success) {
        return validationError("body", bodyParsed.error.errors[0]);
      }
      validated.body = bodyParsed.data;
    }

    if (config.params) {
      const params = nfe.params;
      const paramsParsed = config.params.safeParse(params);

      if (!paramsParsed.success) {
        return validationError("params", paramsParsed.error.errors[0]);
      }
      validated.params = paramsParsed.data;
    }

    if (config.queryParams) {
      const qp = Object.fromEntries(new URL(req.url).searchParams);
      const qpParsed = config.queryParams.safeParse(qp);

      if (!qpParsed.success) {
        return validationError("queryParams", qpParsed.error.errors[0]);
      }
      validated.queryParams = qpParsed.data;
    }

    return handler(reqClone, nfe, validated);
  };
};

export { apiZodValidator as default };
