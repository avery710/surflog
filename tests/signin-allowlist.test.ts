import { afterEach, describe, expect, it } from "vitest";
import { isSignInAllowed, signInAllowedEmails } from "@/lib/signin-allowlist";

const original = process.env.SIGNIN_ALLOWED_EMAILS;

afterEach(() => {
  if (original === undefined) delete process.env.SIGNIN_ALLOWED_EMAILS;
  else process.env.SIGNIN_ALLOWED_EMAILS = original;
});

describe("isSignInAllowed", () => {
  it("is open to everyone when the variable is unset or empty", () => {
    delete process.env.SIGNIN_ALLOWED_EMAILS;
    expect(isSignInAllowed("anyone@example.com")).toBe(true);
    expect(isSignInAllowed(null)).toBe(true);
    process.env.SIGNIN_ALLOWED_EMAILS = " , ,";
    expect(isSignInAllowed("anyone@example.com")).toBe(true);
  });

  it("allows only listed emails, ignoring case and spaces", () => {
    process.env.SIGNIN_ALLOWED_EMAILS = " Me@Gmail.com , friend@example.com ";
    expect(signInAllowedEmails()).toEqual(["me@gmail.com", "friend@example.com"]);
    expect(isSignInAllowed("me@gmail.com")).toBe(true);
    expect(isSignInAllowed("  FRIEND@example.com")).toBe(true);
    expect(isSignInAllowed("stranger@example.com")).toBe(false);
  });

  it("refuses a missing email once a list is set", () => {
    process.env.SIGNIN_ALLOWED_EMAILS = "me@gmail.com";
    expect(isSignInAllowed(null)).toBe(false);
    expect(isSignInAllowed(undefined)).toBe(false);
    expect(isSignInAllowed("")).toBe(false);
  });
});
