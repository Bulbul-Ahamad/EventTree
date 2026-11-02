import { z } from "zod";
import { isValidPhone, normalizePhone, PHONE_MESSAGE } from "@/lib/phone";

// 02_AppFlow S02: name 1-100, email format, password >= 10 with a letter and a digit.
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

export const passwordRule = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(72, "Use at most 72 characters.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/\d/, "Include at least one number.");

const fullName = z
  .string()
  .trim()
  .min(1, "Enter your name.")
  .max(100, "Use at most 100 characters.");

// Required (US-18). Trimmed, normalized to "+<digits>", then checked.
export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Enter your phone number.")
  .pipe(z.string().transform(normalizePhone).refine(isValidPhone, PHONE_MESSAGE));

export const updateProfileSchema = z.object({ fullName, phone: phoneSchema }).strict();

export const completeProfileSchema = z
  .object({ phone: phoneSchema, next: z.string().optional() })
  .strict();

export const signUpSchema = z
  .object({
    fullName,
    email,
    phone: phoneSchema,
    password: passwordRule,
  })
  .strict();

export const signInSchema = z
  .object({
    email,
    password: z.string().min(1, "Enter your password."),
    next: z.string().optional(),
  })
  .strict();

export const emailOnlySchema = z.object({ email }).strict();

export const resetPasswordSchema = z
  .object({ password: passwordRule, confirm: z.string() })
  .strict()
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords do not match.",
  });

export const oauthSchema = z.object({ next: z.string().optional() }).strict();

export type SignUpInput = z.infer<typeof signUpSchema>;
